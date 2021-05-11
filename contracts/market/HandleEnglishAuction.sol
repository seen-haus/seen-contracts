// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./MarketHandlerBase.sol";

contract HandleEnglishAuction is MarketHandlerBase, ERC1155Holder {

    uint256 public count;
    mapping(uint256 => Auction) public auctions;

    event Bid(uint256 auction, address who, uint96 amount);
    event Won(uint256 auction, address who, uint96 amount);

    constructor(address payable _haus, uint256 _fee) MarketHandlerBase(_haus, _fee) {}

    /// @notice deploy new english auction
    function createAuction (
        address payable _seller,
        address _token,
        uint256 _id,
        uint256 _start,
        uint256 _end,
        uint256 _reserve,
        uint96 _startPrice
    )
    external
    onlyRole(SELLER) {

        // Make sure this contract is approved to transfer the token
        require(IERC1155(_token).isApprovedForAll(_seller, address(this)), "Not approved to transfer seller's tokens" );

        // Create the auction and bump the auction count
        auctions[count] = Auction(
                address payable(0),
                _seller,
                _token,
                _id,
                _start,
                _end,
                _reserve,
                _startPrice,
                false
        );
        count++;

        // transfer erc1155 to auction
        IERC1155(_token).safeTransferFrom(
            _seller,
            address(this),
            _id,
            1,
            new bytes(0x0)
        );
    }

    /// @notice bid on an active auction
    /// @param _id the ID of the auction we are bidding on
    function bid (uint256 _id) external payable {

        require(_id < count, "Invalid auction id");
        Auction storage auction = auctions[_id];

        require(!Address.isContract(_msgSender()), "Contracts may not bid");
        require(block.timestamp >= auction.start, "Auction hasn't started");
        require(block.timestamp < auction.end, "Auction has ended");
        require(msg.value >= ((auction.bid * 105) / 100), "Bid too small");

        Auction storage auction = auctions[_id];

        // Give back the last bidders money
        if (auction.buyer != address(0)) {
            auction.buyer.transfer(auction.bid);
        }

        // Record the bid
        auction.bid = msg.amount;
        auction.buyer = _msgSender();

        // Announce the bid
        emit Bid(_id, _msgSender(), msg.value);
    }

    /// @notice close out a successfully completed auction
    /// @param _id the ID of the auction we are closing
    function close(uint256 _id) external {

        require(_id < count, "Invalid auction id");
        Auction storage auction = auctions[_id];

        require(!auction.closed, "Auction already closed");
        require(auction.buyer != address(0), "No bids have been placed");
        require(block.timestamp >= auction.end, "End time not reached");
        require(auction.bid >= auction.reserve, "Reserve not met");

        // Close the auction
        auction.closed = true;

        // Distribute the funds between staking, multisig, and seller
        disburseFunds(auction.seller, auction.bid);

        // Transfer the ERC-1155 to winner
        IERC1155(auction.token).safeTransferFrom(
            address(this),
            auction.buyer,
            auction.tokenId,
            1,
            new bytes(0x0)
        );

        // Announce the winner
        emit Won(_id, auction.buyer, auction.bid);
    }    
    
    /// @notice call this when an auction ends with no bids
    function pull(uint256 _id) external {

        require(_id < count, "Invalid auction id");
        Auction storage auction = auctions[_id];

        require(!auction.closed, "Auction already closed");
        require(auction.buyer != address(0), "No bids have been placed");
        require(block.timestamp >= auction.end, "End time not reached");

        // Close the auction
        auction.closed = true;

        // Transfer erc1155 back to seller
        IERC1155(auction.token).safeTransferFrom(
            address(this),
            auction.seller,
            auction.tokenId,
            1,
            new bytes(0x0)
        );

    }

    /// @notice call this to cancel an auction that hasn't ended
    function cancel(uint256 _id) external onlyOwner {

        require(_id < count, "auction doesn't exist");
        Auction storage auction = auctions[_id];

        require(!auction.closed, "auction already closed");
        require(block.timestamp < auction.end, "End time has passed");

        // Give back the last bidders money
        if (auction.buyer != address(0)) {
            auction.buyer.transfer(auction.bid);
        }

        // transfer erc1155 to seller
        IERC1155(auction.token).safeTransferFrom(
            address(this),
            auction.seller,
            auction.tokenId,
            1,
            new bytes(0x0)
        );

        auction.closed = true;
    }

}
