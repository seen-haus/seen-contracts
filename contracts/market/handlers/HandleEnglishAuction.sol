// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./MarketClient.sol";

contract HandleEnglishAuction is MarketClient {

    // Events
    event AuctionPending(Consignment indexed consignment, Auction indexed auction);
    event AuctionStarted(Consignment indexed consignment, Auction indexed auction);
    event AuctionEnded(Consignment indexed consignment, Auction indexed auction);
    event BidAccepted(Consignment indexed consignment, Auction indexed auction);

    /// @notice map a consignment to an auction
    mapping(Consignment => Auction) public auctions;

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
     * @notice Create a new english auction
     *
     * For an auction of one ERC-1155 token
     *
     * @param _consignment - the unique consignment being auctioned
     * @param _start - the scheduled start time of the auction
     * @param _duration - the scheduled duration of the auction
     * @param _reserve - the reserve price of the auction
     * @param _style - the style of the auction (live or trigger)
     */
    function createAuction (
        Consignment memory _consignment,
        uint256 _start,
        uint256 _duration,
        uint256 _reserve,
        Style _style
    )
    external
    onlyRole(SELLER) {

        // Be sure the auction doesn't already exist and doesn't start in the past
        Auction storage auction = auctions[_consignment];
        require(auction.start == 0, "Auction exists");
        require (_start >= block.timestamp, "Time runs backward?");

        // Make sure this contract is approved to transfer the token
        require(IERC1155(_consignment.token).isApprovedForAll(_consignment.seller, address(this)), "Not approved to transfer seller's tokens");

        // Create the auction
        auction = Auction(
            address(0),
            _start,
            _duration,
            _reserve,
            _style,
            State.Pending,
            Outcome.Pending
        );

        // Transfer a balance of one of the ERC-1155 to this auction contract
        IERC1155(_consignment.token).safeTransferFrom(
            _consignment.seller,
            address(this),
            _consignment.tokenId,
            1,
            new bytes(0x0)
        );

        // Notify listeners of state change
        emit AuctionPending(_consignment, auction);
    }

    /**
     * @notice Bid on an active auction
     *
     * Caller must send an amount 5 percent greater than the previous bid.
     *
     * @param _consignment - the unique consignment being auctioned
     */
    function bid(Consignment memory _consignment) external payable {

        // Make sure the auction exists
        Auction storage auction = auctions[_consignment];
        require(auction.start != 0, "Auction does not exist");

        // Determine time after which no more bids will be accepted
        uint256 endTime = auction.start + auction.duration;

        // Determine time after which a bid could possibly extend the run time
        uint256 extendTime = (endTime - 15 minutes);

        // Make sure we can accept the caller's bid
        require(block.timestamp >= auction.start, "Auction hasn't started");
        require(block.timestamp <= endTime, "Auction timer has elapsed");
        require(msg.value >= auction.reserve, "Bid below reserve price");
        require(!Address.isContract(_msgSender()), "Contracts may not bid");

        // If a standing bid exists:
        // - Be sure new bid outbids previous
        // - Give back the previous bidder's money
        if (auction.bid > 0) {
            require(msg.value >= (auction.bid * (100 + marketController.outBidPercentage)) / 100, "Bid too small");
            auction.buyer.transfer(auction.bid);
        }

        // Record the new bid
        auction.bid = msg.value;
        auction.buyer = _msgSender();

        // If this was the first successful bid...
        if (auction.state == State.Pending) {

            // First bid updates auction state to Running
            auction.state = State.Running;

            // For auctions where clock is triggered by first bid, update start time
            if (auction.style == Style.Trigger) {
                auction.start = block.timestamp;
            }

            // Notify listeners of state change
            emit AuctionStarted(_consignment, auction);

        // Otherwise, if auction is already underway
        } else if (auction.state == State.Running) {

            // For bids placed within the extension window, extend the run time by 15 minutes
            if (block.timestamp <= endTime && block.timestamp >= extendTime) {
                auction.duration += 15 minutes;
                emit AuctionExtended(_consignment, auction);
            }

        }

        // Announce the bid
        emit BidAccepted(_consignment, auction);
    }

    /**
     * @notice Close out a successfully completed auction
     *
     * Reverts if caller doesn't have ADMIN role
     *
     * @param _consignment - the unique consignment being auctioned
     */
    function close(Consignment memory _consignment) external onlyRole(ADMIN) {

        // Make sure the auction exists
        Auction storage auction = auctions[_consignment];
        require(auction.start != 0, "Auction does not exist");

        // Make sure timer has elapsed
        uint256 endTime = auction.start + auction.duration;
        require(block.timestamp > endTime, "Auction end time not yet reached");

        // Make sure it can be closed normally
        require(auction.state == State.Running, "Auction has not yet started");
        require(auction.buyer != address(0), "No bids have been placed");

        // Close the auction
        auction.state = State.Ended;
        auction.outcome = Outcome.Closed;

        // Distribute the funds (handles royalties, staking, multisig, and seller)
        disburseFunds(_consignment, auction.bid);

        // Transfer the ERC-1155 to winner
        IERC1155(_consignment.token).safeTransferFrom(
            address(this),
            auction.buyer,
            _consignment.tokenId,
            1,
            new bytes(0x0)
        );

        // Notify listeners about state change
        emit AuctionEnded(_consignment, auction);

    }    
    
    /**
     * @notice Close out an auction when it ends with no bids
     *
     * Reverts if caller doesn't have ADMIN role
     *
     * @param _consignment - the unique consignment being auctioned
     */
    function pull(Consignment memory _consignment) external onlyRole(ADMIN) {

        // Make sure the auction exists
        Auction storage auction = auctions[_consignment];
        require(auction.start != 0, "Auction does not exist");

        // Determine auction end time
        uint256 endTime = auction.start + auction.duration;
        require(block.timestamp > endTime, "Auction end time not yet reached");

        // Make sure we can pull the auction
        require(auction.outcome == Outcome.Pending, "Auction has already been settled");
        require(auction.bid == 0, "Bids have been placed");

        // Pull the auction
        auction.state = State.Ended;
        auction.outcome = Outcome.Pulled;

        // Transfer the ERC-1155 back to the seller
        IERC1155(_consignment.token).safeTransferFrom(
            address(this),
            _consignment.seller,
            _consignment.tokenId,
            1,
            new bytes(0x0)
        );

        // Notify listeners about state change
        emit AuctionEnded(_consignment, auction);

    }

    /**
     * @notice Cancel an auction that hasn't ended yet.
     *
     * Reverts if caller doesn't have ADMIN role
     *
     * @param _consignment - the unique consignment being auctioned
     */
    function cancel(Consignment memory _consignment) external onlyRole(ADMIN) {

        // Make sure auction exists
        Auction storage auction = auctions[_consignment];
        require(auction.start != 0, "Auction does not exist");

        // Make sure timer hasn't elapsed
        uint256 endTime = auction.start + auction.duration;
        require(block.timestamp < endTime, "Auction timer has elapsed");

        // Make sure auction hasn't been settled
        require(auction.state != State.Ended, "Auction has already ended");

        // Cancel the auction
        auction.state = State.Ended;
        auction.outcome = Outcome.Canceled;

        // Give back the previous bidder's money
        if (auction.bid > 0) {
            auction.buyer.transfer(auction.bid);
        }

        // Transfer the ERC-1155 back to the seller
        IERC1155(_consignment.token).safeTransferFrom(
            address(this),
            _consignment.seller,
            _consignment.tokenId,
            1,
            new bytes(0x0)
        );

        // Notify listeners about state change
        emit AuctionEnded(_consignment, auction);

    }

}