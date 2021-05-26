// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../MarketClient.sol";

contract HandleAuction is MarketClient {

    // Events
    event AuctionPending(Consignment indexed consignment, Auction indexed auction);
    event AuctionStarted(Consignment indexed consignment, Auction indexed auction);
    event AuctionExtended(Consignment indexed consignment, Auction indexed auction);
    event AuctionEnded(Consignment indexed consignment, Auction indexed auction);
    event BidAccepted(Consignment indexed consignment, Auction indexed auction);

    /// @notice map a consignment id to an auction
    mapping(uint256 => Auction) public auctions;

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
     * @param _seller - the current owner of the consignment
     * @param _token - the contract address issuing the NFT behind the consignment
     * @param _tokenId - the id of the token being consigned
     * @param _start - the scheduled start time of the auction
     * @param _duration - the scheduled duration of the auction
     * @param _reserve - the reserve price of the auction
     * @param _audience - the initial audience that can participate. See {SeenTypes.Audience}
     * @param _market - the market for the consignment. See {SeenTypes.Market}
     * @param _clock - the type of clock used for the auction. See {SeenTypes.Clock}
     */
    function createAuction (
        address payable _seller,
        address _token,
        uint256 _tokenId,
        uint256 _start,
        uint256 _duration,
        uint256 _reserve,
        Audience _audience,
        Market _market,
        Clock _clock
    )
    external
    onlyRole(SELLER) {

        // Make sure start time isn't in the past
        require (_start >= block.timestamp, "Time runs backward?");

        // Make sure this contract is approved to transfer the token
        require(IERC1155(_token).isApprovedForAll(_seller, address(this)), "Not approved to transfer seller's tokens");

        // Ensure seller owns _lotSize tokens
        require(IERC1155(_token).balanceOf(_seller, _tokenId) >= 1, "Seller has zero balance of consigned token");

        // Register the consignment
        Consignment memory consignment = marketController.registerConsignment(_market, _audience, _seller, _token, _tokenId);

        // Set up the auction
        setAudience(consignment.id, _audience);
        Auction storage auction = Auction(
            address(0), // empty initial buyer
            consignment.id,
            _start,
            _duration,
            _reserve,
            0,
            _clock,
            State.Pending,
            Outcome.Pending
        );

        // Transfer a balance of one of the ERC-1155 to this auction contract
        IERC1155(_token).safeTransferFrom(
            _seller,
            address(this),
            _tokenId,
            1,
            new bytes(0x0)
        );

        // Notify listeners of state change
        emit AuctionPending(consignment.id, auction);
    }

    /**
     * @notice Change the audience for a auction.
     *
     * Reverts if:
     *  - Caller does not have ADMIN role
     *  - Auction doesn't exist or has already been settled
     *
     * @param _consignmentId - the id of the consignment being sold
     * @param _audience - the new audience for the auction
     */
    function changeAudience(uint256 _consignmentId, Audience _audience)
    external
    onlyRole(ADMIN) {

        // Make sure the auction exists and hasn't been settled
        Auction storage auction = auctions[_consignmentId];
        require(auction.start != 0, "Auction does not exist");
        require(auction.state != State.Ended, "Auction has already been settled");

        // Set the new audience for the consignment
        setAudience(_consignmentId, _audience);

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
     * @param _consignmentId - the id of the consignment being sold
     */
    function bid(uint256 _consignmentId) external payable {

        // Make sure the auction exists
        Auction storage auction = auctions[_consignmentId];
        require(auction.start != 0, "Auction does not exist");

        // Determine time after which no more bids will be accepted
        uint256 endTime = auction.start + auction.duration;

        // Determine time after which a bid could possibly extend the run time
        uint256 extendTime = (endTime - 15 minutes);

        // Make sure we can accept the caller's bid
        require(!Address.isContract(msg.sender), "Contracts may not bid");
        require(block.timestamp >= auction.start, "Auction hasn't started");
        require(block.timestamp <= endTime, "Auction timer has elapsed");
        require(msg.value >= auction.reserve, "Bid below reserve price");

        // Unless auction is for an open audience, check buyer's staking status
        Audience audience = audiences[_consignmentId];
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
            require(msg.value >= (auction.bid * (100 + marketController.outBidPercentage())) / 100, "Bid too small");
            auction.buyer.transfer(auction.bid);
        }

        // Record the new bid
        auction.bid = msg.value;
        auction.buyer = msg.sender;

        // If this was the first successful bid...
        if (auction.state == State.Pending) {

            // First bid updates auction state to Running
            auction.state = State.Running;

            // For auctions where clock is triggered by first bid, update start time
            if (auction.clock == Clock.Trigger) {
                auction.start = block.timestamp;
            }

            // Notify listeners of state change
            emit AuctionStarted(_consignmentId, auction);

        // Otherwise, if auction is already underway
        } else if (auction.state == State.Running) {

            // For bids placed within the extension window, extend the run time by 15 minutes
            if (block.timestamp <= endTime && block.timestamp >= extendTime) {
                auction.duration += 15 minutes;
                emit AuctionExtended(_consignmentId, auction);
            }

        }

        // Announce the bid
        emit BidAccepted(_consignmentId, auction);
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
     * @param _consignmentId - the id of the consignment being sold
     */
    function close(uint256 _consignmentId) external onlyRole(ADMIN) {

        // Make sure the auction exists
        Auction storage auction = auctions[_consignmentId];
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

        // Get consignment
        Consignment memory consignment = marketController.consignments(_consignmentId);

        // Distribute the funds (pay royalties, staking, multisig, and seller)
        disburseFunds(consignment, auction.bid);

        // Determine if consignment is tangible
        ISeenHausNFT nft = marketController.nft();
        if (address(nft) == consignment.token && nft.isTangible(consignment.token)) {

            // Transfer the ERC-1155 to escrow contract
            IEscrowHandler escrowTicket = marketController.escrowTicket();
            IERC1155(consignment.token).safeTransferFrom(
                address(this),
                address(escrowTicket),
                consignment.tokenId,
                1,
                new bytes(0x0)
            );

            // For tangibles, issue an escrow ticket to the buyer
            escrowTicket.issueTicket(consignment.tokenId, 1, auction.buyer);

        } else {

            // Transfer the ERC-1155 to winner
            IERC1155(consignment.token).safeTransferFrom(
                address(this),
                auction.buyer,
                consignment.tokenId,
                1,
                new bytes(0x0)
            );

        }

        // Notify listeners about state change
        emit AuctionEnded(_consignmentId, auction);

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
     * @param _consignmentId - the id of the consignment being sold
     */
    // TODO: is there really a need to have pull AND cancel? Cancel would do the same if it ignored end time.
    function pull(uint256 _consignmentId) external onlyRole(ADMIN) {

        // Make sure the auction exists
        Auction storage auction = auctions[_consignmentId];
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
        Consignment memory consignment = marketController.consignments(_consignmentId);
        IERC1155(consignment.token).safeTransferFrom(
            address(this),
            consignment.seller,
            consignment.tokenId,
            1,
            new bytes(0x0)
        );

        // Notify listeners about state change
        emit AuctionEnded(_consignmentId, auction);

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
     * @param _consignmentId - the id of the consignment being sold
     */
    function cancel(uint256 _consignmentId) external onlyRole(ADMIN) {

        // Make sure auction exists
        Auction storage auction = auctions[_consignmentId];
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
        Consignment memory consignment = marketController.consignments(_consignmentId);
        IERC1155(consignment.token).safeTransferFrom(
            address(this),
            consignment.seller,
            consignment.tokenId,
            1,
            new bytes(0x0)
        );

        // Notify listeners about state change
        emit AuctionEnded(_consignmentId, auction);

    }

}