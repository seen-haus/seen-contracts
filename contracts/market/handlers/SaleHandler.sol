// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
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
contract SaleHandler is MarketClient, ERC1155Holder {

    // Events
    event SalePending(Sale sale);
    event SaleStarted(uint256 indexed consignmentId);
    event SaleEnded(uint256 indexed consignmentId, Outcome outcome);
    event Purchase(uint256 indexed consignmentId, address indexed buyer, uint256 amount);

    /// @notice map a consignment id to a sale
    mapping(uint256 => Sale) public sales;

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
     *  - This contract isn't approved to transfer seller's tokens
     *
     * Emits a SalePending event.
     *
     * @param _seller - the current owner of the consignment
     * @param _tokenAddress - the contract address issuing the NFT behind the consignment
     * @param _tokenId - the id of the token being consigned
     * @param _start - the scheduled start time of the sale
     * @param _quantity - the supply of the given consigned token being sold
     * @param _price - the price of each item in the lot
     * @param _perTxCap - the maximum amount that can be bought in a single transaction
     * @param _audience - the initial audience that can participate. See {SeenTypes.Audience}
     * @param _market - the market for the consignment. See {SeenTypes.Market}
     */
    function createSale (
        address payable _seller,
        address _tokenAddress,
        uint256 _tokenId,
        uint256 _start,
        uint256 _quantity,
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

        // Ensure seller owns _quantity tokens
        require(IERC1155(_tokenAddress).balanceOf(_seller, _tokenId) >= _quantity, "Seller token balance less than quantity");

        // Register the consignment
        Consignment memory consignment = marketController.registerConsignment(_market, _seller, _tokenAddress, _tokenId);

        // Set up the sale
        setAudience(consignment.id, _audience);
        Sale storage sale = sales[consignment.id];
        sale.consignmentId = consignment.id;
        sale.start = _start;
        sale.quantity = _quantity;
        sale.price = _price;
        sale.perTxCap = _perTxCap;
        sale.state = State.Pending;
        sale.outcome = Outcome.Pending;

        // Transfer the sale's lot size of the ERC-1155 to this sale contract
        IERC1155(_tokenAddress).safeTransferFrom(
            _seller,
            address(this),
            _tokenId,
            _quantity,
            new bytes(0x0)
        );

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
     * @param _quantity - the amount of the remaining supply to buy
     */
    function buy(uint256 _consignmentId, uint256 _quantity) external payable {

        // Make sure the sale exists
        Sale storage sale = sales[_consignmentId];
        require(sale.start != 0, "Sale does not exist");

        // Make sure we can accept the buy order
        require(block.timestamp >= sale.start, "Sale hasn't started");
        require(!Address.isContract(msg.sender), "Contracts may not buy");
        require(_quantity <= sale.perTxCap, "Per transaction limit for this sale exceeded");
        require(msg.value == sale.price * _quantity, "Payment does not cover order price");

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
            emit SaleStarted(consignment.id);
        }

        // Determine if consignment is physical
        address nft = marketController.getNft();
        if (nft == consignment.tokenAddress && ISeenHausNFT(nft).isPhysical(consignment.tokenId)) {

            // Transfer the ERC-1155 to escrow contract
            address escrowTicketer = marketController.getEscrowTicketer(_consignmentId);
            IERC1155(consignment.tokenAddress).safeTransferFrom(
                address(this),
                escrowTicketer,
                consignment.tokenId,
                _quantity,
                new bytes(0x0)
            );

            // Issue an escrow ticket to the buyer
            IEscrowTicketer(escrowTicketer).issueTicket(consignment.tokenId, _quantity, payable(msg.sender));

        } else {

            // For digital, transfer the purchase to the buyer
            IERC1155(consignment.tokenAddress).safeTransferFrom(
                address(this),
                msg.sender,
                consignment.tokenId,
                _quantity,
                new bytes(0x0)
            );

        }

        // Announce the purchase
        emit Purchase(consignment.id, msg.sender, _quantity);
    }

    /**
     * @notice Close out a successfully completed sale.
     *
     * Funds are disbursed as normal. See: {MarketClient.disburseFunds}
     *
     * Reverts if:
     * - Caller doesn't have ADMIN role
     * - Sale doesn't exist or hasn't started
     * - There is remaining inventory
     *
     * Emits a SaleEnded event.
     *
     * @param _consignmentId - id of the consignment being sold
     */
    function close(uint256 _consignmentId) external onlyRole(ADMIN) {

        // Make sure the sale exists and can be closed normally
        Sale storage sale = sales[_consignmentId];
        require(sale.start != 0, "Sale does not exist");
        require(sale.state != State.Ended, "Sale has already been settled");
        require(sale.state == State.Running, "Sale hasn't started");

        // Mark sale as settled
        sale.state = State.Ended;
        sale.outcome = Outcome.Closed;

        // Distribute the funds (handles royalties, staking, multisig, and seller)
        disburseFunds(_consignmentId, sale.quantity * sale.price);

        // Get the consignment
        Consignment memory consignment = marketController.getConsignment(_consignmentId);

        // Notify listeners about state change
        emit SaleEnded(consignment.id, sale.outcome);

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

        // Make sure the sale exists and can canceled
        Sale storage sale = sales[_consignmentId];
        require(sale.start != 0, "Sale does not exist");
        require(sale.state != State.Ended, "Sale has already been settled");

        // Mark sale as settled
        sale.state = State.Ended;
        sale.outcome = Outcome.Canceled;

        // Get the consignment
        Consignment memory consignment = marketController.getConsignment(_consignmentId);

        // Determine the amount sold and remaining
        uint256 remaining = supply(consignment);
        uint256 sold = sale.quantity - remaining;

        // Disburse the funds for the sold items
        if (sold > 0) {
            uint256 salesTotal = sold * sale.price;
            disburseFunds(_consignmentId, salesTotal);
        }

        // Transfer the remaining ERC-1155 balance back to the seller
        if (remaining > 0) {
            IERC1155(consignment.tokenAddress).safeTransferFrom(
                address(this),
                consignment.seller,
                consignment.tokenId,
                remaining,
                new bytes(0x0)
            );
        }

        // Notify listeners about state change
        emit SaleEnded(consignment.id, sale.outcome);

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