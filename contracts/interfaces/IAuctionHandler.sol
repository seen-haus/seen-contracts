// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "../domain/SeenTypes.sol";
import "./IMarketHandler.sol";

/**
 * @title IAuctionHandler
 * @author Cliff Hall
 * @notice Handles the creation, running, and disposition of Seen.Haus auctions.
 */
interface IAuctionHandler is IMarketHandler {

    // Events
    event AuctionPending(address indexed consignor, address indexed seller, SeenTypes.Auction auction);
    event AuctionStarted(uint256 indexed consignmentId);
    event AuctionExtended(uint256 indexed consignmentId);
    event AuctionEnded(uint256 indexed consignmentId, SeenTypes.Outcome indexed outcome);
    event BidAccepted(uint256 indexed consignmentId, address indexed buyer, uint256 indexed bid);
    event BidReturned(uint256 indexed consignmentId, address indexed buyer, uint256 indexed bid);

    /**
     * @notice The auction getter
     */
    function getAuction(uint256 _consignmentId) external view returns (SeenTypes.Auction memory);

    /**
     * @notice Create a new primary market auction. (English style)
     *
     * Emits an AuctionPending event
     *
     * Reverts if:
     *  - Consignment doesn't exist
     *  - Consignment has already been marketed
     *  - Auction already exists for consignment
     *  - Start time is in the past
     *
     * @param _consignmentId - the id of the consignment being sold
     * @param _start - the scheduled start time of the auction
     * @param _duration - the scheduled duration of the auction
     * @param _reserve - the reserve price of the auction
     * @param _audience - the initial audience that can participate. See {SeenTypes.Audience}
     * @param _clock - the type of clock used for the auction. See {SeenTypes.Clock}
     */
    function createPrimaryAuction (
        uint256 _consignmentId,
        uint256 _start,
        uint256 _duration,
        uint256 _reserve,
        SeenTypes.Audience _audience,
        SeenTypes.Clock _clock
    ) external;

    /**
     * @notice Create a new secondary market auction
     *
     * Emits an AuctionPending event.
     *
     * Reverts if:
     *  - Contract no approved to transfer seller's tokens
     *  - Seller doesn't own the token balance to be auctioned
     *  - Start time is in the past
     *
     * @param _seller - the current owner of the consignment
     * @param _tokenAddress - the contract address issuing the NFT behind the consignment
     * @param _tokenId - the id of the token being consigned
     * @param _start - the scheduled start time of the auction
     * @param _duration - the scheduled duration of the auction
     * @param _reserve - the reserve price of the auction
     * @param _audience - the initial audience that can participate. See {SeenTypes.Audience}
     * @param _clock - the type of clock used for the auction. See {SeenTypes.Clock}
     */
    function createSecondaryAuction (
        address payable _seller,
        address _tokenAddress,
        uint256 _tokenId,
        uint256 _start,
        uint256 _duration,
        uint256 _reserve,
        SeenTypes.Audience _audience,
        SeenTypes.Clock _clock
    ) external;

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
     * Funds are disbursed as normal. See {MarketClient.disburseFunds}
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
     * @notice Pull an auction when it ends with no bids.
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
    function pullAuction(uint256 _consignmentId) external;

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
    function cancelAuction(uint256 _consignmentId) external;

}