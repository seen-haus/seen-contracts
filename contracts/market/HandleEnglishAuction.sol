// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./MarketHandlerBase.sol";

contract HandleEnglishAuction is MarketHandlerBase, ERC1155Holder {

    // Events
    event NewAuction(Consignment consignment, uint256 reserve);
    event Bid(Consignment consignment, address bidder, uint256 amount);
    event Won(Consignment consignment, address winner, uint256 amount);

    /// @notice map a consignment to an auction
    mapping(Consignment => Auction) public auctions;

    /**
     * @notice Constructor
     *
     * @param _haus - the SeenHaus (xSEEN) contract
     * @param _multisig = the organization's multisig wallet
     * @param _feePercentage the percentage (0-100) of each auction's funds to distribute to staking and multisig
     */
    constructor(address payable _haus, address payable _multisig, uint256 _feePercentage)
        MarketHandlerBase(_haus, _multisig, _feePercentage)
    {}

    /**
     * @notice Create a new english auction
     *
     * For an auction of one ERC-1155 token
     *
     * @param _consignment - the unique consignment being auctioned
     * @param _start - the start time of the auction
     * @param _end - the end time of the auction
     * @param _reserve - the reserve price of the auction
     * @param _startPrice - the start price of the auction
     */
    function createAuction (
        Consignment _consignment,
        uint256 _start,
        uint256 _end,
        uint256 _reserve,
        uint256 _startPrice
    )
    external
    onlyRole(SELLER) {

        Auction storage auction = auctions[_consignment];
        require(auction.start == 0, "Auction exists");

        // Make sure this contract is approved to transfer the token
        require(IERC1155(_token).isApprovedForAll(_seller, address(this)), "Not approved to transfer seller's tokens");

        // Create the auction
        auction = Auction(
            address payable(0),
            _start,
            _end,
            _reserve,
            _startPrice,
            false
        );

        // Transfer the token to this auction contract
        IERC1155(_consignment.token).safeTransferFrom(
            _consignment.seller,
            address(this),
            _consignment.tokenId,
            1,
            new bytes(0x0)
        );

        // Tell the world about it
        emit NewAuction(_consignment, _reserve);
    }

    /**
     * @notice Bid on an active auction
     *
     * Caller must send an amount 5 percent greater than the previous bid.
     *
     * @param _consignment - the unique consignment being auctioned
     */
    function bid (Consignment _consignment) external payable {

        Auction storage auction = auctions[_consignment];
        require(auction.start != 0, "Auction does not exist");
        require(!auction.closed, "Auction already closed");
        require(!Address.isContract(_msgSender()), "Contracts may not bid");
        require(block.timestamp >= auction.start, "Auction hasn't started");
        require(block.timestamp < auction.end, "Auction has ended");
        require(msg.value >= ((auction.bid * 105) / 100), "Bid too small");

        // Give back the previous bidder's money
        if (auction.buyer != address(0)) {
            auction.buyer.transfer(auction.bid);
        }

        // Record the bid
        auction.bid = msg.amount;
        auction.buyer = _msgSender();

        // Announce the bid
        emit Bid(_consignment, _msgSender(), msg.value);
    }

    /**
     * @notice Close out a successfully completed auction
     *
     * @param _consignment - the unique consignment being auctioned
     */
    function close(Consignment _consignment) external {

        Auction storage auction = auctions[_consignment];
        require(auction.start != 0, "Auction does not exist");
        require(!auction.closed, "Auction already closed");
        require(auction.buyer != address(0), "No bids have been placed");
        require(block.timestamp >= auction.end, "End time not reached");
        require(auction.bid >= auction.reserve, "Reserve not met");

        // Close the auction
        auction.closed = true;

        // Distribute the funds between staking, multisig, and seller
        disburseFunds(_consignment.market, _consignment.seller, auction.bid);

        // Transfer the ERC-1155 to winner
        IERC1155(_consignment.token).safeTransferFrom(
            address(this),
            auction.buyer,
            _consignment.tokenId,
            1,
            new bytes(0x0)
        );

        // Announce the winner
        emit Won(_consignment, auction.buyer, auction.bid);

    }    
    
    /**
     * @notice Close out an auction when it ends with no bids
     *
     * @param _consignment - the unique consignment being auctioned
     */
    function pull(Consignment _consignment) external {

        Auction storage auction = auctions[_consignment];
        require(auction.start != 0, "Auction does not exist");
        require(!auction.closed, "Auction already closed");
        require(auction.buyer == address(0), "Bids have been placed");
        require(block.timestamp >= auction.end, "End time not reached");

        // Close the auction and transfer the token back to the seller
        auction.closed = true;
        IERC1155(_consignment.token).safeTransferFrom(
            address(this),
            _consignment.seller,
            _consignment.tokenId,
            1,
            new bytes(0x0)
        );

    }

    /**
     * @notice Close out an auction that hasn't ended yet.
     *
     * @param _consignment - the unique consignment being auctioned
     */
    function cancel(Consignment _consignment) external onlyOwner {

        Auction storage auction = auctions[_consignment];
        require(auction.start != 0, "Auction does not exist");
        require(!auction.closed, "Auction already closed");
        require(block.timestamp < auction.end, "End time has passed");

        // Close the auction and give back the previous bidder's money
        auction.closed = true;
        if (auction.buyer != address(0)) {
            auction.buyer.transfer(auction.bid);
        }

        // Transfer the token back to the seller
        IERC1155(auction.token).safeTransferFrom(
            address(this),
            _consignment.seller,
            _consignment.tokenId,
            1,
            new bytes(0x0)
        );

    }

}
