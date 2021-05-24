// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "./OpenZeppelin/ERC1155/ERC1155Burnable.sol";
import "./OpenZeppelin/ERC1155/ERC1155Holder.sol";
import "./OpenZeppelin/ERC20/IERC20.sol";

contract AuctionHouse is ERC1155Holder {

    struct Auction {
        // Lets pack these two variables together
        address payable buyer;
        uint96 bid;
        address token;
        address payable seller;
        uint256 tokenId;
        uint256 start;
        uint256 end;
        bool closed;
    }

    address payable public haus;
    address public gov;
    uint256 public fee;
    uint256 public minSeen;

    uint256 public count;
    mapping(uint256 => Auction) public auctions;

    event Bid(uint256 auction, address who, uint96 amount);
    event Won(uint256 auction, address who, uint96 amount);
    
    constructor(address payable _haus, uint256 _fee, uint256 _min) {
        haus = _haus;
        gov = msg.sender;
        fee = _fee;
        minSeen = _min;
    }

    modifier onlyGov {
        require(msg.sender == gov, "!gov");
        _;
    }

    /// @notice deploy new english auction
    function newAuction(address payable _seller, address _token, uint256 _id, uint256 _start, uint256 _end, uint96 _startPrice) external {
        require(IERC20(haus).balanceOf(_seller) >= minSeen || IERC20(haus).balanceOf(msg.sender) >= minSeen, "newAuction:not enough seen");

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

        require(msg.sender == tx.origin, "bid:no contracts");
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

    function cancel(uint256 _id) external onlyGov {
        Auction memory auction = auctions[_id];

        require(_id < count, "bid:no auction");
        require(!auction.closed, "close:close() already called");
        require(block.timestamp < auction.end, "bid:auction ended");

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

    function updateHaus(address payable _haus) external onlyGov {
        haus = _haus;
    }

    function updateGov(address _gov) external onlyGov {
        gov = _gov;
    }

    function updateFee(uint256 _fee) external onlyGov {
        fee = _fee;
    }

    function updateMinSeen(uint256 _amount) external onlyGov {
        minSeen = _amount;
    }

}
