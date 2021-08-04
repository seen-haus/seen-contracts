// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../../interfaces/IEscrowTicketer.sol";
import "../../interfaces/IAuctionHandler.sol";
import "../../interfaces/ISeenHausNFT.sol";
import "../../domain/SeenConstants.sol";
import "../../domain/SeenTypes.sol";
import "./MarketHandlerBase.sol";

/**
 * @title AuctionHandlerFacet
 * @author Cliff Hall
 * @notice Handles the creation, running, and disposition of Seen.Haus auctions.
 */
contract AuctionHandlerFacet is IAuctionHandler, MarketHandlerBase {

    // Threshold to auction extension window
    uint256 constant extensionWindow = 15 minutes;

    /**
 * @dev Modifier to protect initializer function from being invoked twice.
 */
    modifier onlyUnInitialized() {

        MarketHandlerLib.MarketHandlerStorage storage mhs = MarketHandlerLib.marketHandlerStorage();
        require(!mhs.auctionHandlerFacetInitialized, "Initializer: contract is already initialized");
        mhs.auctionHandlerFacetInitialized = true;
        _;
    }

    /**
     * @notice Facet Initializer
     *
     * Register supported interfaces
     */
    function initialize ()
    public
    onlyUnInitialized
    {
        // Register supported interfaces
        DiamondLib.supportsInterface(type(IAuctionHandler).interfaceId);
    }

    /**
     * @notice The auction getter
     */
    function getAuction(uint256 _consignmentId)
    external
    view
    override
    returns (Auction memory) {

        // Get Market Handler Storage struct
        MarketHandlerLib.MarketHandlerStorage storage mhs = MarketHandlerLib.marketHandlerStorage();

        // Return the auction
        return mhs.auctions[_consignmentId];
    }

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
        Audience _audience,
        Clock _clock
    )
    external
    override
    onlyRole(SELLER)
    onlyConsignor(_consignmentId)
    {
        // Get Market Handler Storage struct
        MarketHandlerLib.MarketHandlerStorage storage mhs = MarketHandlerLib.marketHandlerStorage();

        // Get the consignment (reverting if consignment doesn't exist)
        Consignment memory consignment = getMarketController().getConsignment(_consignmentId);

        // Make sure the consignment hasn't been marketed
        require(consignment.marketed == false, "Consignment has already been marketed");

        // Get the storage location for the auction
        Auction storage auction = mhs.auctions[consignment.id];

        // Make sure auction doesn't exist
        require(auction.consignmentId == 0, "Auction exists");

        // Make sure start time isn't in the past
        require(_start >= block.timestamp, "Time runs backward?");

        // Set up the auction
        setAudience(_consignmentId, _audience);
        auction.consignmentId = consignment.id;
        auction.start = _start;
        auction.duration = _duration;
        auction.reserve = _reserve;
        auction.clock = _clock;
        auction.state = State.Pending;
        auction.outcome = Outcome.Pending;

        // Notify MarketController the consignment has been marketed
        getMarketController().marketConsignment(consignment.id);

        // Notify listeners of state change
        emit AuctionPending(msg.sender, consignment.seller, auction);
    }

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
        Audience _audience,
        Clock _clock
    )
    external
    override
    onlyRole(SELLER)
    {
        // Get Market Handler Storage struct
        MarketHandlerLib.MarketHandlerStorage storage mhs = MarketHandlerLib.marketHandlerStorage();

        // Make sure start time isn't in the past
        require (_start >= block.timestamp, "Time runs backward?");

        // Make sure this contract is approved to transfer the token
        require(IERC1155(_tokenAddress).isApprovedForAll(_seller, address(this)), "Not approved to transfer seller's tokens");

        // Ensure seller a positive number of tokens
        require(IERC1155(_tokenAddress).balanceOf(_seller, _tokenId) > 0, "Seller has zero balance of consigned token");

        // To register the consignment, tokens must first be in MarketController's possession
        IERC1155(_tokenAddress).safeTransferFrom(
            _seller,
            address(getMarketController()),
            _tokenId,
            1, // Supply always 1 for auction
            new bytes(0x0)
        );

        // Register consignment (Secondaries are automatically marketed upon registration)
        Consignment memory consignment = getMarketController().registerConsignment(Market.Secondary, msg.sender, _seller, _tokenAddress, _tokenId, 1);

        // Set up the auction
        setAudience(consignment.id, _audience);
        Auction storage auction = mhs.auctions[consignment.id];
        auction.consignmentId = consignment.id;
        auction.start = _start;
        auction.duration = _duration;
        auction.reserve = _reserve;
        auction.clock = _clock;
        auction.state = State.Pending;
        auction.outcome = Outcome.Pending;

        // Notify listeners of state change
        emit AuctionPending(msg.sender, consignment.seller, auction);
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
    function changeAuctionAudience(uint256 _consignmentId, Audience _audience)
    external
    override
    onlyRole(ADMIN)
    {
        // Get Market Handler Storage struct
        MarketHandlerLib.MarketHandlerStorage storage mhs = MarketHandlerLib.marketHandlerStorage();

        // Get consignment (reverting if not valid)
        Consignment memory consignment = getMarketController().getConsignment(_consignmentId);

        // Make sure the auction exists and hasn't been settled
        Auction storage auction = mhs.auctions[consignment.id];
        require(auction.start != 0, "Auction does not exist");
        require(auction.state != State.Ended, "Auction has already been settled");

        // Set the new audience for the consignment
        setAudience(consignment.id, _audience);

    }

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
    function bid(uint256 _consignmentId)
    external
    override
    payable
    onlyAudienceMember(_consignmentId)
    {
        // Get Market Handler Storage slot
        MarketHandlerLib.MarketHandlerStorage storage mhs = MarketHandlerLib.marketHandlerStorage();

        // Get the consignment (reverting if consignment doesn't exist)
        Consignment memory consignment = getMarketController().getConsignment(_consignmentId);

        // Make sure the auction exists
        Auction memory auction = mhs.auctions[consignment.id];
        require(auction.start != 0, "Auction does not exist");

        // Determine time after which no more bids will be accepted
        uint256 endTime = auction.start + auction.duration;

        // Make sure we can accept the caller's bid
        require(!Address.isContract(msg.sender), "Contracts may not bid");
        require(block.timestamp >= auction.start, "Auction hasn't started");
        require(block.timestamp <= endTime, "Auction timer has elapsed");
        require(msg.value >= auction.reserve, "Bid below reserve price");

        // If a standing bid exists:
        // - Be sure new bid outbids previous
        // - Give back the previous bidder's money
        if (auction.bid > 0) {
            require(msg.value >= (auction.bid + getPercentageOf(auction.bid, getMarketController().getOutBidPercentage())), "Bid too small");
            auction.buyer.transfer(auction.bid);
            emit BidReturned(consignment.id, auction.buyer, auction.bid);
        }

        // Record the new bid
        auction.bid = msg.value;
        auction.buyer = payable(msg.sender);

        // If this was the first successful bid...
        if (auction.state == State.Pending) {

            // First bid updates auction state to Running
            auction.state = State.Running;

            // For auctions where clock is triggered by first bid, update start time
            if (auction.clock == Clock.Trigger) {

                // Set start time
                auction.start = block.timestamp;
                endTime = auction.start + auction.duration;

            }

            // Notify listeners of state change
            emit AuctionStarted(consignment.id);

        }

        // For bids placed within the extension window, extend the duration by 15 minutes
        if (block.timestamp + extensionWindow >= endTime) {
            auction.duration += extensionWindow;
            emit AuctionExtended(_consignmentId);
        }

        mhs.auctions[_consignmentId] = auction;

        // Announce the bid
        emit BidAccepted(_consignmentId, auction.buyer, auction.bid);

    }

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
    function closeAuction(uint256 _consignmentId)
    external
    override
    {
        // Get Market Handler Storage slot
        MarketHandlerLib.MarketHandlerStorage storage mhs = MarketHandlerLib.marketHandlerStorage();

        // Get the consignment (reverting if consignment doesn't exist)
        Consignment memory consignment = getMarketController().getConsignment(_consignmentId);

        // Make sure the auction exists
        Auction storage auction = mhs.auctions[_consignmentId];
        require(auction.start != 0, "Auction does not exist");

        // Make sure timer has elapsed
        uint256 endTime = auction.start + auction.duration;
        require(block.timestamp > endTime, "Auction end time not yet reached");

        // Make sure auction hasn't been settled
        require(auction.outcome == Outcome.Pending, "Auction has already been settled");

        // Make sure it there was at least one bid
        require(auction.buyer != address(0), "No bids have been placed");

        // Mark auction as settled
        auction.state = State.Ended;
        auction.outcome = Outcome.Closed;

        // Distribute the funds (pay royalties, staking, multisig, and seller)
        disburseFunds(_consignmentId, auction.bid);

        // Determine if consignment is physical
        address nft = getMarketController().getNft();
        if (nft == consignment.tokenAddress && ISeenHausNFT(nft).isPhysical(consignment.tokenId)) {

            // For physicals, issue an escrow ticket to the buyer
            address escrowTicketer = getMarketController().getEscrowTicketer(_consignmentId);
            IEscrowTicketer(escrowTicketer).issueTicket(_consignmentId, 1, auction.buyer);

        } else {

            // Release the purchased amount of the consigned token supply to buyer
            getMarketController().releaseConsignment(_consignmentId, 1, auction.buyer);

        }

        // Notify listeners about state change
        emit AuctionEnded(consignment.id, auction.outcome);

    }    
    
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
    function pullAuction(uint256 _consignmentId)
    external
    override
    onlyRole(ADMIN)
    {
        // Get Market Handler Storage slot
        MarketHandlerLib.MarketHandlerStorage storage mhs = MarketHandlerLib.marketHandlerStorage();

        // Get the consignment (reverting if consignment doesn't exist)
        Consignment memory consignment = getMarketController().getConsignment(_consignmentId);

        // Make sure the auction exists
        Auction storage auction = mhs.auctions[_consignmentId];
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

        // Release the unsold amount of the consigned token supply to buyer
        getMarketController().releaseConsignment(_consignmentId, 1, consignment.seller);

        // Notify listeners about state change
        emit AuctionEnded(consignment.id, auction.outcome);

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
    function cancelAuction(uint256 _consignmentId)
    external
    override
    onlyRole(ADMIN)
    {
        // Get Market Handler Storage slot
        MarketHandlerLib.MarketHandlerStorage storage mhs = MarketHandlerLib.marketHandlerStorage();

        // Get the consignment (reverting if consignment doesn't exist)
        Consignment memory consignment = getMarketController().getConsignment(_consignmentId);

        // Make sure auction exists
        Auction storage auction = mhs.auctions[_consignmentId];
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
            emit BidReturned(_consignmentId, auction.buyer, auction.bid);
        }

        // Release the consigned token supply to buyer
        getMarketController().releaseConsignment(_consignmentId, 1, consignment.seller);

        // Notify listeners about state change
        emit AuctionEnded(_consignmentId, auction.outcome);

    }

}