// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../../../interfaces/IEscrowTicketer.sol";
import "../../../interfaces/ISaleBuilder.sol";
import "../../../interfaces/ISaleHandler.sol";
import "../../../interfaces/ISeenHausNFT.sol";
import "../MarketHandlerBase.sol";

/**
 * @title SaleBuilderFacet
 * @author Cliff Hall
 * @notice Handles the operation of Seen.Haus sales.
 */
contract SaleBuilderFacet is ISaleBuilder, MarketHandlerBase {

    /**
     * @dev Modifier to protect initializer function from being invoked twice.
     */
    modifier onlyUnInitialized()
    {
        MarketHandlerLib.MarketHandlerInitializers storage mhi = MarketHandlerLib.marketHandlerInitializers();
        require(!mhi.saleBuilderFacet, "Initializer: contract is already initialized");
        mhi.saleBuilderFacet = true;
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
        DiamondLib.addSupportedInterface(type(ISaleBuilder).interfaceId);   // when combined with ISaleRunner ...
        DiamondLib.addSupportedInterface(type(ISaleHandler).interfaceId);   // ... Diamond supports ISaleHandler
    }

    /**
     * @notice The sale getter
     */
    function getSale(uint256 _consignmentId)
    external
    override
    view
    returns (Sale memory)
    {
        // Get Market Handler Storage struct
        MarketHandlerLib.MarketHandlerStorage storage mhs = MarketHandlerLib.marketHandlerStorage();

        // Return sale
        return mhs.sales[_consignmentId];
    }

    /**
     * @notice Create a new sale.
     *
     * For some lot size of one ERC-1155 token.
     *
     * Ownership of the consigned inventory is transferred to this contract
     * for the duration of the sale.
     *
     * Reverts if:
     *  - Sale starts in the past
     *  - Sale exists for consignment
     *  - Consignment has already been marketed
     *
     * Emits a SalePending event.
     *
     * @param _consignmentId - id of the consignment being sold
     * @param _start - the scheduled start time of the sale
     * @param _price - the price of each item in the lot
     * @param _perTxCap - the maximum amount that can be bought in a single transaction
     * @param _audience - the initial audience that can participate. See {SeenTypes.Audience}
     */
    function createPrimarySale (
        uint256 _consignmentId,
        uint256 _start,
        uint256 _price,
        uint256 _perTxCap,
        Audience _audience
    )
    external
    override
    onlyRole(SELLER)
    onlyConsignor(_consignmentId)
    {
        // Get Market Handler Storage slot
        MarketHandlerLib.MarketHandlerStorage storage mhs = MarketHandlerLib.marketHandlerStorage();

        // Fetch the consignment
        Consignment memory consignment = getMarketController().getConsignment(_consignmentId);

        // Make sure the consignment hasn't been marketed
        require(consignment.marketed == false, "Consignment has already been marketed");

        // Get the storage location for the sale
        Sale storage sale = mhs.sales[consignment.id];

        // Make sure sale doesn't exist (start would always be non-zero on an actual sale)
        require(sale.start == 0, "Sale exists");

        // Make sure start time isn't in the past
        require (_start >= block.timestamp, "Time runs backward?");

        // Set up the sale
        setAudience(_consignmentId, _audience);
        sale.consignmentId = _consignmentId;
        sale.start = _start;
        sale.price = _price;
        sale.perTxCap = _perTxCap;
        sale.state = State.Pending;
        sale.outcome = Outcome.Pending;

        // Notify MarketController the consignment has been marketed
        getMarketController().marketConsignment(consignment.id);

        // Notify listeners of state change
        emit SalePending(msg.sender, consignment.seller, sale);
    }

    /**
     * @notice Create a new sale.
     *
     * For some lot size of one ERC-1155 token.
     *
     * Ownership of the consigned inventory is transferred to this contract
     * for the duration of the sale.
     *
     * Reverts if:
     *  - Sale starts in the past
     *  - Supply is zero
     *  - Sale exists for consignment
     *  - This contract isn't approved to transfer seller's tokens
     *  - Token contract does not implement either IERC1155 or IERC721
     *
     * Emits a SalePending event.
     *
     * @param _seller - the current owner of the consignment
     * @param _tokenAddress - the contract address issuing the NFT behind the consignment
     * @param _tokenId - the id of the token being consigned
     * @param _start - the scheduled start time of the sale
     * @param _supply - the supply of the given consigned token being sold
     * @param _price - the price of each item in the lot
     * @param _perTxCap - the maximum amount that can be bought in a single transaction
     * @param _audience - the initial audience that can participate. See {SeenTypes.Audience}
     */
    function createSecondarySale (
        address payable _seller,
        address _tokenAddress,
        uint256 _tokenId,
        uint256 _start,
        uint256 _supply,
        uint256 _price,
        uint256 _perTxCap,
        Audience _audience
    )
    external
    override
    onlyRole(SELLER)
    {
        // Get Market Handler Storage slot
        MarketHandlerLib.MarketHandlerStorage storage mhs = MarketHandlerLib.marketHandlerStorage();

        // Make sure start time isn't in the past
        require (_start >= block.timestamp, "Time runs backward?");

        // Make sure supply is non-zero
        require (_supply > 0, "Supply must be non-zero");

        // Make sure this contract is approved to transfer the token
        // N.B. The following will work because isApprovedForAll has the same signature on both IERC721 and IERC1155
        require(IERC1155(_tokenAddress).isApprovedForAll(_seller, address(this)), "Not approved to transfer seller's tokens");

        // To register the consignment, tokens must first be in MarketController's possession
        if (IERC165(_tokenAddress).supportsInterface(type(IERC1155).interfaceId)) {

            // Ensure seller owns sufficient supply of token
            require(IERC1155(_tokenAddress).balanceOf(_seller, _tokenId) >= _supply, "Seller has insufficient balance of token");

            // Transfer supply to MarketController
            IERC1155(_tokenAddress).safeTransferFrom(
                _seller,
                address(getMarketController()),
                _tokenId,
                _supply,
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
        Consignment memory consignment = getMarketController().registerConsignment(Market.Secondary, msg.sender, _seller, _tokenAddress, _tokenId, _supply);

        // Set up the sale
        setAudience(consignment.id, _audience);
        Sale storage sale = mhs.sales[consignment.id];
        sale.consignmentId = consignment.id;
        sale.start = _start;
        sale.price = _price;
        sale.perTxCap = _perTxCap;
        sale.state = State.Pending;
        sale.outcome = Outcome.Pending;

        // Notify listeners of state change
        emit SalePending(msg.sender, consignment.seller, sale);
    }

}