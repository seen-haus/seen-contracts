// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./MarketHandlerBase.sol";

contract HandleEnglishAuction is MarketHandlerBase, Address, AccessControl, ERC1155Holder {

    struct Auction {
        address payable buyer;
        uint96 bid;
        address token;
        address payable seller;
        uint256 tokenId;
        uint256 start;
        uint256 end;
        bool closed;
    }

    uint256 public count;
    mapping(uint256 => Auction) public auctions;

    event Bid(uint256 auction, address who, uint96 amount);
    event Won(uint256 auction, address who, uint96 amount);
    
    constructor(address payable _haus, uint256 _fee) MarketHandlerBase(_haus, _fee) {}

    /// @notice deploy new english auction
    function newAuction(address payable _seller, address _token, uint256 _id, uint256 _start, uint256 _end, uint96 _startPrice)
    external
    {
        auctions[count] = Auction(payable(address(0)), _startPrice, _token, _seller, _id, _start, _end, false);
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
    function bid(uint256 _id) external payable {
        Auction memory auction = auctions[_id];

        require(!isContract(msg.sender), "bid:no contracts");
        require(_id < count, "bid:no auction");
        require(block.timestamp >= auction.start, "bid:auction not started");
        require(block.timestamp < auction.end, "bid:auction ended");
        require(msg.value >= ((auction.bid * 105) / 100), "bid:bid too small");

        // Give back the last bidders money
        if (auction.buyer != address(0)) {
            auction.buyer.transfer(auction.bid);
        }

        auctions[_id].bid = uint96(msg.value);
        auctions[_id].buyer = payable(address(msg.sender));

        emit Bid(_id, msg.sender, uint96(msg.value));
    }

    /// @notice close out a successfully completed auction
    /// @param _id the ID of the auction we are closing
    function close(uint256 _id) external {
        Auction memory auction = auctions[_id];

        require(_id < count, "bid:no auction");
        require(!auction.closed, "close:close() already called");
        require(auction.buyer != address(0), "close:no bids");
        require(block.timestamp >= auction.end, "close:auction live");

        // transfer erc1155 to winner
        IERC1155(auction.token).safeTransferFrom(
            address(this),
            auction.buyer,
            auction.tokenId,
            1,
            new bytes(0x0)
        );

        uint256 hausFee = uint256(auction.bid) * fee / 1000;
        haus.transfer(hausFee);

        // just incase there is a rounding error
        uint256 payout = address(this).balance < auction.bid - hausFee ? address(this).balance : auction.bid - hausFee;
        auction.seller.transfer(payout);
        auctions[_id].closed = true;

        emit Won(_id, auction.buyer, auction.bid);
    }    
    
    /// @notice call this when an auction ends with no bids
    function pull(uint256 _id) external {
        Auction memory auction = auctions[_id];

        require(_id < count, "bid:no auction");
        require(!auction.closed, "close:close() already called");
        require(auction.buyer == address(0), "close:no bids");
        require(block.timestamp >= auction.end, "close:auction live");

        // transfer erc1155 to seller
        IERC1155(auction.token).safeTransferFrom(
            address(this),
            auction.seller,
            auction.tokenId,
            1,
            new bytes(0x0)
        );

        auctions[_id].closed = true;
    }

    function cancel(uint256 _id) external onlyOwner {
        Auction memory auction = auctions[_id];

        require(_id < count, "auction doesn't exist");
        require(!auction.closed, "auction already closed");
        require(block.timestamp < auction.end, "auction isn't over");

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

        auctions[_id].closed = true;
    }

    function updateHaus(address payable _haus) external onlyOwner {
        haus = _haus;
    }
    
    function updateFee(uint256 _fee) external onlyOwner {
        fee = _fee;
    }

}
