// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../MarketClient.sol";

contract HandleSale is MarketClient {

    // Events
    event SalePending(Consignment indexed consignment, Sale indexed sale);
    event SaleStarted(Consignment indexed consignment, Sale indexed sale);
    event SaleEnded(Consignment indexed consignment, Sale indexed sale);
    event BuySuccessful(Consignment indexed consignment, Sale indexed sale, address indexed buyer, uint256 amount);

    /// @notice map a consignment to a sale
    mapping(Consignment => Sale) public sales;

    /**
     * @notice Constructor
     *
     * @param _accessController - the Seen.Haus AccessController
     * @param _marketController - the Seen.Haus MarketController
     */
    constructor(address _accessController, address _marketController)
    AccessClient(_accessController)
    MarketClient(_marketController)
    {}

    /**
     * @notice Create a new sale
     *
     * For some lot size of one ERC-1155 token
     *
     * @param _consignment - the unique consignment being auctioned
     * @param _start - the scheduled start time of the sale
     * @param _lotSize - the supply of the given consigned token being sold
     * @param _itemPrice - the price of each item in the lot
     * @param _maxBuy - the maximum amount that can be bought in a single transaction
     */
    function createSale (
        Consignment memory _consignment,
        uint256 _start,
        uint256 _lotSize,
        uint256 _itemPrice,
        uint256 _maxBuy
    )
    external
    onlyRole(SELLER) {

        // Be sure the sale doesn't already exist and doesn't start in the past
        Sale storage sale = sales[_consignment];
        require(sale.start == 0, "Sale exists");
        require (_start >= block.timestamp, "Time runs backward?");

        // Make sure this contract is approved to transfer the token
        require(IERC1155(_consignment.token).isApprovedForAll(_consignment.seller, address(this)), "Not approved to transfer seller's tokens");

        // Create the sale
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
     * @notice Buy some amount of the remaining supply of the lot for sale
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

        // First buy updates sale state to Running
        if (sale.state == State.Pending) {

            // First bid updates auction state to Running
            auction.state = State.Running;

            // Notify listeners of state change
            emit SaleStarted(_consignment, sale);
        }

        // Transfer the purchase to the buyer
        IERC1155(_consignment.token).safeTransferFrom(
            address(this),
            _msgSender(),
            _consignment,tokenId,
            _amount,
            new bytes(0x0)
        );

        // Announce the buy
        emit BuySuccessful(_consignment, sale, _msgSender(), _amount);
    }

    /**
     * @notice Close out a successfully completed sale
     *
     * Reverts if caller doesn't have ADMIN role
     *
     * @param _consignment - the unique consignment being sold
     */
    function close(Consignment memory _consignment) external onlyRole(ADMIN) {

        // Make sure the sale exists and can be closed normally
        Sale storage sale = auctions[_consignment];
        require(sale.start != 0, "Sale does not exist");
        require(sale.state == State.Running, "Sale has not yet started");
        require(supply(_consignment) == 0, "Sale not over");

        // Close the sale
        sale.state = State.Ended;
        sale.outcome = Outcome.Closed;

        // Distribute the funds (handles royalties, staking, multisig, and seller)
        disburseFunds(_consignment, sale.lotSize * sale.itemPrice);

        // Notify listeners about state change
        emit SaleEnded(_consignment, sale);

    }

    /**
     * @notice Cancel a sale that hasn't ended yet
     *
     * Reverts if caller doesn't have ADMIN role
     *
     * @param _consignment - the unique consignment being auctioned
     */
    function cancel(Consignment memory _consignment) external onlyRole(ADMIN) {

        // Make sure the sale exists and can canceled
        Sale storage sale = sales[_consignment];
        require(sale.start != 0, "Sale does not exist");
        require(sale.state == State.Running, "Sale has not yet started");
        require(sale.state != State.Ended, "Sale has already ended");

        // Cancel the sale
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
     * @notice Get the remaining supply of the given consignment
     *
     * Reverts if caller doesn't have ADMIN role
     *
     * @param _consignment - the unique consignment being sold
     */
    function supply(Consignment memory _consignment) public view returns(uint256) {
        return IERC1155(_consignment.token).balanceOf(address(this), _consignment.tokenId);
    }
    
}