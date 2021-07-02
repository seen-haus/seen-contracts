// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.5;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../../token/nft/ISeenHausNFT.sol";
import "../../token/escrow/IEscrowTicketer.sol";
import "../MarketClient.sol";

/**
 * @title SaleHandler
 * @author Cliff Hall
 * @notice Handles the creation, running, and disposition of Seen.Haus sales.
 */
contract SaleHandler is MarketClient {

    // Events
    event SalePending(Sale indexed sale);
    event SaleStarted(uint256 indexed consignmentId);
    event SaleEnded(uint256 indexed consignmentId, Outcome indexed outcome);
    event Purchase(uint256 indexed consignmentId,  uint256 indexed amount, address indexed buyer);

    /// @dev map a consignment id to a sale
    mapping(uint256 => Sale) private sales;

    /**
     * @notice Constructor
     *
     * This contract is granted the MARKET_HANDLER role with the AccessController
     *
     * @param _accessController - the Seen.Haus AccessController
     * @param _marketController - the Seen.Haus MarketController
     */
    constructor(address _accessController, address _marketController)
    AccessClient(_accessController)
    MarketClient(_marketController)
    {}

    /**
     * @notice The sale getter
     */
    function getSale(uint256 _consignmentId)
    external view
    returns (Sale memory) {
        return sales[_consignmentId];
    }

    /**
     * @notice Create a new sale.
     *
     * For some lot size of one ERC-1155 token.
     *
     * Ownership of the consigned inventory is transferred to this contract
     * for the duration of the sale.
     *
     * Reverts if:
     *  - Sale exists for consignment
     *  - Sale starts in the past
     *
     * Emits a SalePending event.
     *
     * @param _consignmentId - id of the consignment being sold
     * @param _start - the scheduled start time of the sale
     * @param _price - the price of each item in the lot
     * @param _perTxCap - the maximum amount that can be bought in a single transaction
     * @param _audience - the initial audience that can participate. See {SeenTypes.Audience}
     */
    function createPrimarySale (
        uint256 _consignmentId,
        uint256 _start,
        uint256 _price,
        uint256 _perTxCap,
        Audience _audience
    )
    external
    onlyRole(SELLER) {

        // Fetch the consignment
        Consignment memory consignment = marketController.getConsignment(_consignmentId);

        // Make sure auction doesn't exist
        require(consignment.id == _consignmentId, "Consignment doesn't exist");

        // Get the storage location for the sale
        Sale storage sale = sales[_consignmentId];

        // Make sure auction doesn't exist
        require(sale.consignmentId == 0, "Sale exists");

        // Make sure start time isn't in the past
        require (_start >= block.timestamp, "Time runs backward?");

        // Set up the sale
        setAudience(_consignmentId, _audience);
        sale.consignmentId = _consignmentId;
        sale.start = _start;
        sale.price = _price;
        sale.perTxCap = _perTxCap;
        sale.state = State.Pending;
        sale.outcome = Outcome.Pending;

        // Notify listeners of state change
        emit SalePending(sale);
    }

    /**
     * @notice Create a new sale.
     *
     * For some lot size of one ERC-1155 token.
     *
     * Ownership of the consigned inventory is transferred to this contract
     * for the duration of the sale.
     *
     * Reverts if:
     *  - Sale exists for consignment
     *  - Sale starts in the past
     *  - This contract isn't approved to transfer seller's tokens
     *
     * Emits a SalePending event.
     *
     * @param _seller - the current owner of the consignment
     * @param _tokenAddress - the contract address issuing the NFT behind the consignment
     * @param _tokenId - the id of the token being consigned
     * @param _start - the scheduled start time of the sale
     * @param _supply - the supply of the given consigned token being sold
     * @param _price - the price of each item in the lot
     * @param _perTxCap - the maximum amount that can be bought in a single transaction
     * @param _audience - the initial audience that can participate. See {SeenTypes.Audience}
     */
    function createSecondarySale (
        address payable _seller,
        address _tokenAddress,
        uint256 _tokenId,
        uint256 _start,
        uint256 _supply,
        uint256 _price,
        uint256 _perTxCap,
        Audience _audience,
        Market _market
    )
    external
    onlyRole(SELLER) {

        // Make sure start time isn't in the past
        require (_start >= block.timestamp, "Time runs backward?");

        // Make sure this contract is approved to transfer the token
        require(IERC1155(_tokenAddress).isApprovedForAll(_seller, address(this)), "Not approved to transfer seller's tokens");

        // Ensure seller owns sufficient supply of token
        require(IERC1155(_tokenAddress).balanceOf(_seller, _tokenId) >= _supply, "Seller has insufficient balance of token");

        // Transfer the token supply of the ERC-1155 to the MarketController
        IERC1155(_tokenAddress).safeTransferFrom(
            _seller,
            address(marketController),
            _tokenId,
            _supply,
            new bytes(0x0)
        );

        // Register the consignment
        Consignment memory consignment = marketController.registerConsignment(_market, _seller, _tokenAddress, _tokenId, _supply);

        // Set up the sale
        setAudience(consignment.id, _audience);
        Sale storage sale = sales[consignment.id];
        sale.consignmentId = consignment.id;
        sale.start = _start;
        sale.price = _price;
        sale.perTxCap = _perTxCap;
        sale.state = State.Pending;
        sale.outcome = Outcome.Pending;

        // Notify listeners of state change
        emit SalePending(sale);
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
    function changeAudience(uint256 _consignmentId, Audience _audience)
    external
    onlyRole(ADMIN) {

        // Make sure the sale exists and hasn't been settled
        Sale storage sale = sales[_consignmentId];
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
    function buy(uint256 _consignmentId, uint256 _amount) external payable {

        // Make sure the sale exists
        Sale storage sale = sales[_consignmentId];
        require(sale.start != 0, "Sale does not exist");

        // Make sure we can accept the buy order
        require(block.timestamp >= sale.start, "Sale hasn't started");
        require(!Address.isContract(msg.sender), "Contracts may not buy");
        require(_amount <= sale.perTxCap, "Per transaction limit for this sale exceeded");
        require(msg.value == sale.price * _amount, "Payment does not cover order price");

        // Unless sale is for an open audience, check buyer's staking status
        Audience audience = audiences[_consignmentId];
        if (audience != Audience.Open) {
            if (audience == Audience.Staker) {
                require(isStaker() == true, "Buyer is not a staker");
            } else if (audience == Audience.VipStaker) {
                require(isVipStaker() == true, "Buyer is not a VIP staker");
            }
        }

        // Get the consignment
        Consignment memory consignment = marketController.getConsignment(_consignmentId);

        // If this was the first successful purchase...
        if (sale.state == State.Pending) {

            // First buy updates sale state to Running
            sale.state = State.Running;

            // Notify listeners of state change
            emit SaleStarted(_consignmentId);
        }

        // Determine if consignment is physical
        if (ISeenHausNFT(consignment.tokenAddress).isPhysical(consignment.tokenId)) {

            // Issue an escrow ticket to the buyer
            address escrowTicketer = marketController.getEscrowTicketer(_consignmentId);
            IEscrowTicketer(escrowTicketer).issueTicket(_consignmentId, _amount, payable(msg.sender));

        } else {

            // Release the purchased amount of the consigned token supply to buyer
            marketController.releaseConsignment(_consignmentId, _amount, msg.sender);

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
    function close(uint256 _consignmentId) external {

        // Make sure the consignment exists
        Consignment memory consignment = marketController.getConsignment(_consignmentId);
        require(consignment.id == _consignmentId, "Invalid consignment id");

        // Make sure the sale exists and can be closed normally
        Sale storage sale = sales[_consignmentId];
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
    function cancel(uint256 _consignmentId) external onlyRole(ADMIN) {

        // Make sure the consignment exists
        Consignment memory consignment = marketController.getConsignment(_consignmentId);
        require(consignment.id == _consignmentId, "Invalid consignment id");

        // Make sure the sale exists and can canceled
        Sale storage sale = sales[_consignmentId];
        require(sale.start != 0, "Sale does not exist");
        require(sale.state != State.Ended, "Sale has already been settled");

        // Mark sale as settled
        sale.state = State.Ended;
        sale.outcome = Outcome.Canceled;

        // Determine the amount sold and remaining
        uint256 remaining = supply(consignment);
        uint256 sold = consignment.supply - remaining;

        // Disburse the funds for the sold items
        if (sold > 0) {
            uint256 salesTotal = sold * sale.price;
            disburseFunds(_consignmentId, salesTotal);
        }

        if (remaining > 0) {

            // Transfer the remaining supply back to the seller
            marketController.releaseConsignment(_consignmentId, remaining, consignment.seller);

        }

        // Notify listeners about state change
        emit SaleEnded(_consignmentId, sale.outcome);

    }

    /**
     * @notice Get the remaining supply of the given consignment.
     *
     * @param _consignment - the unique consignment being sold
     */
    function supply(Consignment memory _consignment) public view returns(uint256) {
        return IERC1155(_consignment.tokenAddress).balanceOf(address(this), _consignment.tokenId);
    }

}