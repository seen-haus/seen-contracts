// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../MarketClient.sol";

contract HandleAuction is MarketClient {

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
     * @notice Create a new auction. (English style)
     *
     * For a single edition of one ERC-1155 token.
     *
     * @param _consignment - the unique consignment being auctioned
     * @param _start - the scheduled start time of the auction
     * @param _duration - the scheduled duration of the auction
     * @param _reserve - the reserve price of the auction
     * @param _clock - the type of clock used for the auction (live or trigger)
     */
    function createAuction (
        Consignment memory _consignment,
        uint256 _start,
        uint256 _duration,
        uint256 _reserve,
        Clock _clock
    )
    external
    onlyRole(SELLER) {

        // Be sure the auction doesn't already exist and doesn't start in the past
        Auction storage auction = auctions[_consignment];
        require(auction.start == 0, "Auction exists");
        require (_start >= block.timestamp, "Time runs backward?");

        // Make sure this contract is approved to transfer the token
        require(IERC1155(_consignment.token).isApprovedForAll(_consignment.seller, address(this)), "Not approved to transfer seller's tokens");

        // Set up the auction
        setAudience(_consignment, _audience);
        auction = Auction(
            address(0),
            _start,
            _duration,
            _reserve,
            _clock,
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
     * @notice Change the audience for a sale.
     *
     * Reverts if:
     *  - Caller does not have ADMIN role
     *  - Auction doesn't exist or has already been settled
     *
     * @param _consignment - the unique consignment being sold
     * @param _audience - the new audience for the sale
     */
    function changeAudience(Consignment memory _consignment, Audience _audience) onlyRole(ADMIN) {

        // Make sure the auction exists and hasn't been settled
        Auction storage auction = auctions[_consignment];
        require(auction.start != 0, "Auction does not exist");
        require(auction.state != State.Ended, "Auction has already been settled");

        // Set the new audience for the consignment
        setAudience(_consignment, _audience);

    }

    /**
     * @notice Bid on an active auction.
     *
     * If successful, the bidder's payment will be held and accepted as the standing bid.
     *
     * Reverts if:
     *  - Caller is a contract
     *  - Auction doesn't exist or hasn't started
     *  - Auction timer has elapsed
     *  - Bid is below the reserve price
     *  - Bid is less than the outbid percentage above the standing bid, if one exists
     *
     * Emits a BidAccepted event on success.
     * May emit a AuctionStarted event, on the first bid.
     * May emit a AuctionExtended event, on bids placed in the last 15 minutes
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
        require(!Address.isContract(_msgSender()), "Contracts may not bid");
        require(block.timestamp >= auction.start, "Auction hasn't started");
        require(block.timestamp <= endTime, "Auction timer has elapsed");
        require(msg.value >= auction.reserve, "Bid below reserve price");

        // Unless auction is for an open audience, check buyer's staking status
        Audience audience = audiences[_consignment];
        if (audience != Audience.Open) {
            if (audience == Audience.Staker) {
                require(isStaker() == true, "Buyer is not a staker");
            } else if (audience == Audience.VipStaker) {
                require(isVipStaker() == true, "Buyer is not a VIP staker");
            }
        }

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
            if (auction.clock == Clock.Trigger) {
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
     * @notice Close out a successfully completed auction.
     *
     * Consigned inventory will be transferred back to the seller.
     * Funds are disbursed as normal. See {MarketClient.disburseFunds}
     *
     * Reverts if:
     *  - Caller does not have ADMIN role
     *  - Auction doesn't exist
     *  - Auction timer has not yet elapsed
     *  - Auction has not yet started
     *  - Auction has already been settled
     *  - Bids have been placed
     *
     * Emits a AuctionEnded event on success.
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

        // Mark auction as settled
        auction.state = State.Ended;
        auction.outcome = Outcome.Closed;

        // Distribute the funds (pay royalties, staking, multisig, and seller)
        disburseFunds(_consignment, auction.bid);

        // Determine if consignment is tangible
        if (address(marketController.nft()) == _consignment.token &&
            marketController.nft().isTangible(_consignment.token)) {

            // Transfer the ERC-1155 to escrow contract
            IERC1155(_consignment.token).safeTransferFrom(
                address(this),
                address(marketController.escrowTicket()),
                _consignment.tokenId,
                1,
                new bytes(0x0)
            );

            // For tangibles, issue an escrow ticket to the buyer
            marketController.escrowTicket().issueTicket(_consignment.tokenId, 1, auction.buyer);

        } else {

            // Transfer the ERC-1155 to winner
            IERC1155(_consignment.token).safeTransferFrom(
                address(this),
                auction.buyer,
                _consignment.tokenId,
                1,
                new bytes(0x0)
            );

        }
        // Notify listeners about state change
        emit AuctionEnded(_consignment, auction);

    }    
    
    /**
     * @notice Close out an auction when it ends with no bids.
     *
     * Consigned inventory will be transferred back to the seller.
     *
     * Reverts if:
     *  - Caller does not have ADMIN role
     *  - Auction doesn't exist
     *  - Auction timer has not yet elapsed
     *  - Auction has already been settled
     *  - Bids have been placed
     *
     * Emits a AuctionEnded event on success.
     *
     * @param _consignment - the unique consignment being auctioned
     */
    // TODO: is there really a need to have pull AND cancel? Cancel would do the same if it ignored end time.
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

        // Mark auction as settled
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
     * If there is a standing bid, it is returned to the bidder.
     * Consigned inventory will be transferred back to the seller.
     *
     * Reverts if:
     *  - Caller does not have ADMIN role
     *  - Auction doesn't exist
     *  - Auction timer has elapsed
     *  - Auction has already been settled
     *
     * Emits a AuctionEnded event on success.
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
        require(auction.state != State.Ended, "Auction has already been settled");

        // Mark auction as settled
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