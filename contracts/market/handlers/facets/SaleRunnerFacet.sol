// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "../../../interfaces/IEscrowTicketer.sol";
import "../../../interfaces/ISeenHausNFT.sol";
import "../../../interfaces/ISaleRunner.sol";
import "../MarketHandlerBase.sol";

/**
 * @title SaleRunnerFacet
 * @author Cliff Hall
 * @notice Handles the operation of Seen.Haus sales.
 */
contract SaleRunnerFacet is ISaleRunner, MarketHandlerBase {

    // Threshold to auction extension window // TODO move this to market controller configuration
    uint256 constant extensionWindow = 15 minutes;

    /**
     * @dev Modifier to protect initializer function from being invoked twice.
     */
    modifier onlyUnInitialized()
    {
        MarketHandlerLib.MarketHandlerInitializers storage mhi = MarketHandlerLib.marketHandlerInitializers();
        require(!mhi.saleRunnerFacet, "Initializer: contract is already initialized");
        mhi.saleRunnerFacet = true;
        _;
    }

    /**
     * @notice Facet Initializer
     *
     * Register supported interfaces
     */
    function initialize()
    public
    onlyUnInitialized
    {
        DiamondLib.addSupportedInterface(type(ISaleRunner).interfaceId);
    }

    /**
     * @notice Change the audience for a sale.
     *
     * Reverts if:
     *  - Caller does not have ADMIN role
     *  - Auction doesn't exist or has already been settled
     *
     * @param _consignmentId - the id of the consignment being sold
     * @param _audience - the new audience for the sale
     */
    function changeSaleAudience(uint256 _consignmentId, Audience _audience)
    external
    override
    onlyRole(ADMIN)
    {
        // Get Market Handler Storage slot
        MarketHandlerLib.MarketHandlerStorage storage mhs = MarketHandlerLib.marketHandlerStorage();

        // Get consignment (reverting if not valid)
        Consignment memory consignment = getMarketController().getConsignment(_consignmentId);

        // Make sure the sale exists and hasn't been settled
        Sale storage sale = mhs.sales[consignment.id];
        require(sale.start != 0, "Sale does not exist");
        require(sale.state != State.Ended, "Sale has already been settled");

        // Set the new audience for the consignment
        setAudience(_consignmentId, _audience);

    }

    /**
     * @notice Buy some amount of the remaining supply of the lot for sale.
     *
     * Ownership of the purchased inventory is transferred to the buyer.
     * The buyer's payment will be held for disbursement when sale is settled.
     *
     * Reverts if:
     *  - Caller is not in audience
     *  - Sale doesn't exist or hasn't started
     *  - Caller is a contract
     *  - The per-transaction buy limit is exceeded
     *  - Payment doesn't cover the order price
     *
     * Emits a Purchase event.
     * May emit a SaleStarted event, on the first purchase.
     *
     * @param _consignmentId - id of the consignment being sold
     * @param _amount - the amount of the remaining supply to buy
     */
    function buy(uint256 _consignmentId, uint256 _amount)
    external
    override
    payable
    onlyAudienceMember(_consignmentId)
    {
        // Get Market Handler Storage slot
        MarketHandlerLib.MarketHandlerStorage storage mhs = MarketHandlerLib.marketHandlerStorage();

        // Get the consignment
        Consignment memory consignment = getMarketController().getConsignment(_consignmentId);

        // Make sure the sale exists
        Sale storage sale = mhs.sales[_consignmentId];
        require(sale.start != 0, "Sale does not exist");

        // Make sure we can accept the buy order
        require(block.timestamp >= sale.start, "Sale hasn't started");
        require(!Address.isContract(msg.sender), "Contracts may not buy");
        require(_amount <= sale.perTxCap, "Per transaction limit for this sale exceeded");
        require(msg.value == sale.price * _amount, "Payment does not cover order price");

        // If this was the first successful purchase...
        if (sale.state == State.Pending) {

            // First buy updates sale state to Running
            sale.state = State.Running;

            // Notify listeners of state change
            emit SaleStarted(_consignmentId);

        }

        // Determine if consignment is physical
        address nft = getMarketController().getNft();
        if (nft == consignment.tokenAddress && ISeenHausNFT(nft).isPhysical(consignment.tokenId)) {

            // Issue an escrow ticket to the buyer
            address escrowTicketer = getMarketController().getEscrowTicketer(_consignmentId);
            IEscrowTicketer(escrowTicketer).issueTicket(_consignmentId, _amount, payable(msg.sender));

        } else {

            // Release the purchased amount of the consigned token supply to buyer
            getMarketController().releaseConsignment(_consignmentId, _amount, msg.sender);

        }

        // Announce the purchase
        emit Purchase(consignment.id, _amount, msg.sender);
    }

    /**
     * @notice Close out a successfully completed sale.
     *
     * Funds are disbursed as normal. See: {MarketClient.disburseFunds}
     *
     * Reverts if:
     * - Sale doesn't exist or hasn't started
     * - There is remaining inventory
     *
     * Emits a SaleEnded event.
     *
     * @param _consignmentId - id of the consignment being sold
     */
    function closeSale(uint256 _consignmentId)
    external
    override
    {
        // Get Market Handler Storage slot
        MarketHandlerLib.MarketHandlerStorage storage mhs = MarketHandlerLib.marketHandlerStorage();

        // Get consignment
        Consignment memory consignment = getMarketController().getConsignment(_consignmentId);

        // Make sure the sale exists and can be closed normally
        Sale storage sale = mhs.sales[_consignmentId];
        require(sale.start != 0, "Sale does not exist");
        require(sale.state != State.Ended, "Sale has already been settled");
        require(sale.state == State.Running, "Sale hasn't started");

        // Mark sale as settled
        sale.state = State.Ended;
        sale.outcome = Outcome.Closed;

        // Distribute the funds (handles royalties, staking, multisig, and seller)
        disburseFunds(_consignmentId, consignment.supply * sale.price);

        // Notify listeners about state change
        emit SaleEnded(_consignmentId, sale.outcome);

    }

    /**
     * @notice Cancel a sale that has remaining inventory.
     *
     * Remaining tokens are returned to seller. If there have been any purchases,
     * the funds are distributed normally.
     *
     * Reverts if:
     * - Caller doesn't have ADMIN role
     * - Sale doesn't exist or has already been settled
     *
     * Emits a SaleEnded event
     *
     * @param _consignmentId - id of the consignment being sold
     */
    function cancelSale(uint256 _consignmentId)
    external
    override
    onlyRole(ADMIN)
    {
        // Get Market Handler Storage slot
        MarketHandlerLib.MarketHandlerStorage storage mhs = MarketHandlerLib.marketHandlerStorage();

        // Get the consignment
        Consignment memory consignment = getMarketController().getConsignment(_consignmentId);

        // Make sure the sale exists and can canceled
        Sale storage sale = mhs.sales[_consignmentId];
        require(sale.start != 0, "Sale does not exist");
        require(sale.state != State.Ended, "Sale has already been settled");

        // Mark sale as settled
        sale.state = State.Ended;
        sale.outcome = Outcome.Canceled;

        // Determine the amount sold and remaining
        uint256 remaining = getMarketController().getSupply(_consignmentId);
        uint256 sold = consignment.supply - remaining;

        // Disburse the funds for the sold items
        if (sold > 0) {
            uint256 salesTotal = sold * sale.price;
            disburseFunds(_consignmentId, salesTotal);
        }

        if (remaining > 0) {

            // Transfer the remaining supply back to the seller
            getMarketController().releaseConsignment(_consignmentId, remaining, consignment.seller);

        }

        // Notify listeners about state change
        emit SaleEnded(_consignmentId, sale.outcome);

    }

}