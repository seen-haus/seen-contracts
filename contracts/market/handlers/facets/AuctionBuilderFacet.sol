// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "../../../interfaces/IAuctionHandler.sol";
import "../../../interfaces/IAuctionBuilder.sol";
import "../MarketHandlerBase.sol";

/**
 * @title AuctionBuilderFacet
 * @author Cliff Hall
 * @notice Handles the creation of Seen.Haus auctions.
 */
contract AuctionBuilderFacet is IAuctionBuilder, MarketHandlerBase {

    /**
     * @dev Modifier to protect initializer function from being invoked twice.
     */
    modifier onlyUnInitialized()
    {
        MarketHandlerLib.MarketHandlerInitializers storage mhi = MarketHandlerLib.marketHandlerInitializers();
        require(!mhi.auctionBuilderFacet, "Initializer: contract is already initialized");
        mhi.auctionBuilderFacet = true;
        _;
    }

    /**
     * @notice Facet Initializer
     *
     * Register supported interfaces
     */
    function initialize()
    public
    onlyUnInitialized
    {
        DiamondLib.addSupportedInterface(type(IAuctionBuilder).interfaceId);   // when combined with IAuctionRunner ...
        DiamondLib.addSupportedInterface(type(IAuctionHandler).interfaceId);   // ... Diamond supports IAuctionHandler
    }

    /**
     * @notice The auction getter
     */
    function getAuction(uint256 _consignmentId)
    external
    view
    override
    returns (Auction memory)
    {

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

        // Make sure auction doesn't exist (start would always be non-zero on an actual auction)
        require(auction.start == 0, "Auction exists");

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
     *  - Start time is in the past
     *  - This contract not approved to transfer seller's tokens
     *  - Seller doesn't own the asset(s) to be auctioned
     *  - Token contract does not implement either IERC1155 or IERC721
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
        // N.B. The following will work because isApprovedForAll has the same signature on both IERC721 and IERC1155
        require(IERC1155(_tokenAddress).isApprovedForAll(_seller, address(this)), "Not approved to transfer seller's tokens");

        // To register the consignment, tokens must first be in MarketController's possession
        if (IERC165(_tokenAddress).supportsInterface(type(IERC1155).interfaceId)) {

            // Ensure seller a positive number of tokens
            require(IERC1155(_tokenAddress).balanceOf(_seller, _tokenId) > 0, "Seller has zero balance of consigned token");

            // Transfer supply to MarketController
            IERC1155(_tokenAddress).safeTransferFrom(
                _seller,
                address(getMarketController()),
                _tokenId,
                1, // Supply is always 1 for auction
                new bytes(0x0)
            );

        } else {

            // Token must be a single token NFT
            require(IERC165(_tokenAddress).supportsInterface(type(IERC721).interfaceId), "Invalid token type");

            // Ensure the consigned token has been transferred to this contract
            require(IERC721(_tokenAddress).ownerOf(_tokenId) == (address(this)));

            // Transfer tokenId to MarketController
            IERC721(_tokenAddress).safeTransferFrom(
                _seller,
                address(getMarketController()),
                _tokenId
            );

        }

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

}