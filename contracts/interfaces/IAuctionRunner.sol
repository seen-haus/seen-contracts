// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "../domain/SeenTypes.sol";
import "./IMarketHandler.sol";

/**
 * @title IAuctionRunner
 *
 * @notice Handles the operation of Seen.Haus auctions.
 *
 * The ERC-165 identifier for this interface is: 0xac85defe
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
interface IAuctionRunner is IMarketHandler {

    // Events
    event AuctionStarted(uint256 indexed consignmentId);
    event AuctionExtended(uint256 indexed consignmentId);
    event AuctionEnded(uint256 indexed consignmentId, SeenTypes.Outcome indexed outcome);
    event BidAccepted(uint256 indexed consignmentId, address indexed buyer, uint256 indexed bid);
    event BidReturned(uint256 indexed consignmentId, address indexed buyer, uint256 indexed bid);

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
    function changeAuctionAudience(uint256 _consignmentId, SeenTypes.Audience _audience) external;

    /**
     * @notice Bid on an active auction.
     *
     * If successful, the bidder's payment will be held and accepted as the standing bid.
     *
     * Reverts if:
     *  - Caller is not in audience
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
    function bid(uint256 _consignmentId) external payable;

    /**
     * @notice Close out a successfully completed auction.
     *
     * Funds are disbursed as normal. See {MarketHandlerBase.disburseFunds}
     *
     * Reverts if:
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
    function closeAuction(uint256 _consignmentId) external;

    /**
     * @notice Cancel an auction that hasn't ended yet.
     *
     * If there is a standing bid, it is returned to the bidder.
     * Consigned inventory will be transferred back to the seller.
     *
     * Reverts if:
     *  - Caller does not have ADMIN role
     *  - Auction doesn't exist
     *  - Auction has already been settled
     *
     * Emits a AuctionEnded event on success.
     *
     * @param _consignmentId - the id of the consignment being sold
     */
    function cancelAuction(uint256 _consignmentId) external;

}