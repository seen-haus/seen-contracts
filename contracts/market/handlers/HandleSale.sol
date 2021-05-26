// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../../token/nft/ISeenHausNFT.sol";
import "../../token/escrow/IEscrowTicket.sol";
import "../MarketClient.sol";

contract HandleSale is MarketClient {

    // Events
    event SalePending(Consignment indexed consignment, Sale indexed sale);
    event SaleStarted(Consignment indexed consignment, Sale indexed sale);
    event SaleEnded(Consignment indexed consignment, Sale indexed sale);
    event Purchase(Consignment indexed consignment, Sale indexed sale, address indexed buyer, uint256 amount);

    /// @notice map a consignment to a sale
    mapping(Consignment => Sale) public sales;

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
    {
        grantRole(MARKET_HANDLER, address(this));
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
     * @param _consignment - the unique consignment being auctioned
     * @param _start - the scheduled start time of the sale
     * @param _lotSize - the supply of the given consigned token being sold
     * @param _itemPrice - the price of each item in the lot
     * @param _maxBuy - the maximum amount that can be bought in a single transaction
     * @param _audience - the initial audience that can execute buy transactions. (Open, Staker, VipStaker)
     */
    function createSale (
        Consignment memory _consignment,
        uint256 _start,
        uint256 _lotSize,
        uint256 _itemPrice,
        uint256 _maxBuy,
        Audience _audience
    )
    external
    onlyRole(SELLER) {

        // Be sure the sale doesn't already exist and doesn't start in the past
        Sale storage sale = sales[_consignment];
        require(sale.start == 0, "Sale exists");
        require (_start >= block.timestamp, "Time runs backward?");

        // Make sure this contract is approved to transfer the token
        require(IERC1155(_consignment.token).isApprovedForAll(_consignment.seller, address(this)), "Not approved to transfer seller's tokens");

        // Set up the sale
        setAudience(_consignment, _audience);
        sale = Sale(
            _start,
            _lotSize,
            _itemPrice,
            _maxBuy,
            State.Pending,
            Outcome.Pending
        );

        // Transfer the sale's lot size of the ERC-1155 to this sale contract
        IERC1155(_consignment.token).safeTransferFrom(
            _consignment.seller,
            address(this),
            _consignment.tokenId,
            _lotSize,
            new bytes(0x0)
        );

        // Notify listeners of state change
        emit SalePending(_consignment, sale);
    }

    /**
     * @notice Change the audience for a sale.
     *
     * Reverts if:
     *  - Caller does not have ADMIN role
     *  - Sale doesn't exist or has already been settled
     *
     * @param _consignment - the unique consignment being sold
     * @param _audience - the new audience for the sale
     */
    function changeAudience(Consignment memory _consignment, Audience _audience) onlyRole(ADMIN) {

        // Make sure the sale exists and hasn't been settled
        Sale storage sale = sales[_consignment];
        require(sale.start != 0, "Sale does not exist");
        require(sale.state != State.Ended, "Sale has already been settled");

        // Set the new audience for the consignment
        setAudience(_consignment, _audience);

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
     * @param _consignment - the unique consignment being sold
     * @param _amount - the amount of the remaining supply to buy
     */
    function buy(Consignment memory _consignment, uint256 _amount) external payable {

        // Make sure the sale exists
        Sale storage sale = sales[_consignment];
        require(sale.start != 0, "Sale does not exist");

        // Make sure we can accept the buy order
        require(block.timestamp >= sale.start, "Sale hasn't started");
        require(!Address.isContract(_msgSender()), "Contracts may not buy");
        require(_amount <= sale.maxBuy, "Per transaction limit for this sale exceeded");
        require(msg.value == sale.itemPrice * _amount, "Payment does not cover order price");

        // Unless sale is for an open audience, check buyer's staking status
        if (sale.audience != Audience.Open) {
            if (sale.audience == Audience.Staker) {
                require(isStaker() == true, "Buyer is not a staker");
            } else if (sale.audience == Audience.VipStaker) {
                require(isVipStaker() == true, "Buyer is not a VIP staker");
            }
        }

        // First buy updates sale state to Running
        if (sale.state == State.Pending) {

            // First bid updates auction state to Running
            auction.state = State.Running;

            // Notify listeners of state change
            emit SaleStarted(_consignment, sale);
        }

        // Determine if consignment is tangible
        if (address(marketController.nft()) == _consignment.token &&
            marketController.nft().isTangible(_consignment.token)) {

            // Transfer the ERC-1155 to escrow contract
            IERC1155(_consignment.token).safeTransferFrom(
                address(this),
                address(marketController.escrowTicket()),
                _consignment.tokenId,
                _amount,
                new bytes(0x0)
            );

            // Issue an escrow ticket to the buyer
            marketController.escrowTicket().issueTicket(_consignment.tokenId, _amount, _msgSender());

        } else {

            // For digital, transfer the purchase to the buyer
            IERC1155(_consignment.token).safeTransferFrom(
                address(this),
                _msgSender(),
                _consignment.tokenId,
                _amount,
                new bytes(0x0)
            );

        }

        // Announce the purchase
        emit Purchase(_consignment, sale, _msgSender(), _amount);
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
     * @param _consignment - the unique consignment being sold
     */
    function close(Consignment memory _consignment) external onlyRole(ADMIN) {

        // Make sure the sale exists and can be closed normally
        Sale storage sale = auctions[_consignment];
        require(sale.start != 0, "Sale does not exist");
        require(sale.state == State.Running, "Sale has not yet started");
        require(supply(_consignment) == 0, "Sale not over");

        // Mark sale as settled
        sale.state = State.Ended;
        sale.outcome = Outcome.Closed;

        // Distribute the funds (handles royalties, staking, multisig, and seller)
        disburseFunds(_consignment, sale.lotSize * sale.itemPrice);

        // Notify listeners about state change
        emit SaleEnded(_consignment, sale);

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
     * @param _consignment - the unique consignment being auctioned
     */
    function cancel(Consignment memory _consignment) external onlyRole(ADMIN) {

        // Make sure the sale exists and can canceled
        Sale storage sale = sales[_consignment];
        require(sale.start != 0, "Sale does not exist");
        require(sale.state != State.Ended, "Sale has already been settled");

        // Mark sale as settled
        sale.state = State.Ended;
        sale.outcome = Outcome.Canceled;

        // Determine the amount sold and remaining
        uint256 remaining = supply(_consignment);
        uint256 sold = lotSize - remaining;

        // Disburse the funds for the sold items
        if (sold > 0) {
            uint256 salesTotal = sold * sale.itemPrice;
            disburseFunds(_consignment, salesTotal);
        }

        // Transfer the remaining ERC-1155 balance back to the seller
        if (remaining > 0) {
            IERC1155(_consignment.token).safeTransferFrom(
                address(this),
                _consignment.seller,
                _consignment.tokenId,
                remaining,
                new bytes(0x0)
            );
        }

        // Notify listeners about state change
        emit SaleEnded(_consignment, sale);

    }

    /**
     * @notice Get the remaining supply of the given consignment.
     *
     * @param _consignment - the unique consignment being sold
     */
    function supply(Consignment memory _consignment) public view returns(uint256) {
        return IERC1155(_consignment.token).balanceOf(address(this), _consignment.tokenId);
    }
    
}