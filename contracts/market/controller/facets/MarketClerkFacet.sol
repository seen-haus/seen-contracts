// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "../../../interfaces/IMarketClerk.sol";
import "../../../diamond/DiamondLib.sol";
import "../MarketControllerBase.sol";
import "../MarketControllerLib.sol";

/**
 * @title MarketClerkFacet
 * @author Cliff Hall
 * @notice Manages consignments for the Seen.Haus contract suite.
 */
contract MarketClerkFacet is IMarketClerk, MarketControllerBase, ERC1155Holder, ERC721Holder {

    /**
     * @dev Modifier to protect initializer function from being invoked twice.
     */
    modifier onlyUnInitialized() {

        MarketControllerLib.MarketControllerInitializers storage mci = MarketControllerLib.marketControllerInitializers();
        require(!mci.clerkFacet, "Initializer: contract is already initialized");
        mci.clerkFacet = true;
        _;
    }

    /**
     * @notice Facet Initializer
     *
     * Register IMarketClerk,
     */
    function initialize()
    public
    onlyUnInitialized
    {
        DiamondLib.supportsInterface(type(IMarketClerk).interfaceId);
        DiamondLib.supportsInterface(type(IERC1155Receiver).interfaceId);
    }

    /**
     * @notice The nextConsignment getter
     * @dev does not increment counter
     */
    function getNextConsignment()
    external
    override
    view
    returns (uint256)
    {
        MarketControllerLib.MarketControllerStorage storage mcs = MarketControllerLib.marketControllerStorage();
        return mcs.nextConsignment;
    }

    /**
     * @notice The consignment getter
     *
     * Reverts if consignment doesn't exist
     *
     * @param _consignmentId - the id of the consignment
     * @return consignment - the consignment struct
     */
    function getConsignment(uint256 _consignmentId)
    public
    override
    view
    consignmentExists(_consignmentId)
    returns (Consignment memory consignment)
    {
        MarketControllerLib.MarketControllerStorage storage mcs = MarketControllerLib.marketControllerStorage();
        consignment = mcs.consignments[_consignmentId];
    }

    /**
     * @notice Get the remaining supply of the given consignment.
     *
     * Reverts if consignment doesn't exist
     *
     * @param _consignmentId - the id of the consignment
     * @return  uint256 - the remaining supply held by the MarketController
     */
    function getSupply(uint256 _consignmentId)
    public
    override
    view
    consignmentExists(_consignmentId)
    returns(uint256)
    {
        MarketControllerLib.MarketControllerStorage storage mcs = MarketControllerLib.marketControllerStorage();
        Consignment storage consignment = mcs.consignments[_consignmentId];
        return IERC1155(consignment.tokenAddress).balanceOf(address(this), consignment.tokenId);
    }

    /**
     * @notice Is the caller the consignor of the given consignment?
     *
     * Reverts if consignment doesn't exist
     *
     * @param _account - the _account to check
     * @param _consignmentId - the id of the consignment
     * @return  bool - true if caller is consignor
     */
    function isConsignor(uint256 _consignmentId, address _account)
    public
    override
    view
    consignmentExists(_consignmentId)
    returns(bool)
    {
        MarketControllerLib.MarketControllerStorage storage mcs = MarketControllerLib.marketControllerStorage();
        return mcs.consignors[_consignmentId] == _account;
    }

    /**
     * @notice Registers a new consignment for sale or auction.
     *
     * Emits a ConsignmentRegistered event.
     *
     * @param _market - the market for the consignment. See {SeenTypes.Market}
     * @param _consignor - the address executing the consignment transaction
     * @param _seller - the seller of the consignment
     * @param _tokenAddress - the contract address issuing the NFT behind the consignment
     * @param _tokenId - the id of the token being consigned
     * @param _supply - the amount of the token being consigned
     *
     * @return consignment - the registered consignment
     */
    function registerConsignment(
        Market _market,
        address _consignor,
        address payable _seller,
        address _tokenAddress,
        uint256 _tokenId,
        uint256 _supply
    )
    external
    override
    onlyRole(MARKET_HANDLER)
    returns (Consignment memory consignment)
    {
        MarketControllerLib.MarketControllerStorage storage mcs = MarketControllerLib.marketControllerStorage();

        // Ensure the consigned token has been transferred to this contract
        require(IERC1155(_tokenAddress).balanceOf(address(this), _tokenId) == _supply);

        // Get the id for the new consignment
        uint256 id = mcs.nextConsignment++;

        // Primary market NFTs (minted here) are not automatically marketed.
        // Secondary market NFTs are automatically marketed (sale or auction).
        bool marketed = (_market == Market.Secondary);

        // Create and store the consignment
        consignment = Consignment(
            _market,
            _seller,
            _tokenAddress,
            _tokenId,
            _supply,
            id,
            marketed
        );
        mcs.consignments[id] = consignment;

        // Associate the consignor
        mcs.consignors[id] = _consignor;

        // Notify listeners of state change
        emit ConsignmentRegistered(_consignor, _seller , consignment);
        if (marketed) {
            emit ConsignmentMarketed(_consignor, consignment.seller, consignment.id);
        }
    }

    /**
     * @notice Update consignment to indicate it has been marketed
     *
     * Emits a ConsignmentMarketed event.
     *
     * Reverts if consignment has already been marketed.
     *
     * @param _consignmentId - the id of the consignment
     */
    function marketConsignment(uint256 _consignmentId)
    external
    override
    onlyRole(MARKET_HANDLER)
    consignmentExists(_consignmentId)
    {
        MarketControllerLib.MarketControllerStorage storage mcs = MarketControllerLib.marketControllerStorage();

        // Get the consignment into memory
        Consignment storage consignment = mcs.consignments[_consignmentId];

        // A consignment can only be marketed once
        require(consignment.marketed == false, "Consignment has already been marketed");

        // Update the consignment
        consignment.marketed = true;

        // Consignor address
        address consignor = mcs.consignors[_consignmentId];

        // Notify listeners of state change
        emit ConsignmentMarketed(consignor, consignment.seller, consignment.id);
    }

    /**
     * @notice Release an amount of the consigned token balance to a given address
     *
     * Emits a ConsignmentReleased event.
     *
     * Reverts if caller is does not have MARKET_HANDLER role.     *
     * Reverts if consignment doesn't exist     *
     *
     * @param _consignmentId - the id of the consignment
     * @param _amount - the amount of the consigned supply
     * @param _releaseTo - the address to transfer the consigned token balance to
     */
    function releaseConsignment(uint256 _consignmentId, uint256 _amount, address _releaseTo)
    external
    override
    onlyRole(MARKET_HANDLER)
    consignmentExists(_consignmentId)
    {
        MarketControllerLib.MarketControllerStorage storage mcs = MarketControllerLib.marketControllerStorage();

        // Get the consignment into memory
        Consignment memory consignment = mcs.consignments[_consignmentId];

        // Get the current supply
        uint256 supply = IERC1155(consignment.tokenAddress).balanceOf(address(this), consignment.tokenId);

        // Ensure this contract holds enough supply
        require(supply >= _amount, "Consigned token supply less than amount");

        // Remove the consignment when the entire supply has been released
        //if (supply == _amount) delete consignments[_consignmentId];

        // Transfer a balance of the token from the MarketController to the recipient
        IERC1155(consignment.tokenAddress).safeTransferFrom(
            address(this),
            _releaseTo,
            consignment.tokenId,
            _amount,
            new bytes(0x0)
        );

        // Notify watchers about state change
        emit ConsignmentReleased(consignment.id, _amount, _releaseTo);

    }

    /**
     * @notice Set the type of Escrow Ticketer to be used for a consignment
     *
     * Default escrow ticketer is Ticketer.Lots. This only needs to be called
     * if overriding to Ticketer.Items for a given consignment.
     *
     * Emits a ConsignmentTicketerSet event.
     *
     * Reverts if consignment doesn't exist     *
     *
     * @param _consignmentId - the id of the consignment
     * @param _ticketerType - the type of ticketer to use. See: {SeenTypes.Ticketer}
     */
    function setConsignmentTicketer(uint256 _consignmentId, Ticketer _ticketerType)
    external
    override
    onlyRole(ESCROW_AGENT)
    consignmentExists(_consignmentId)
    {
        MarketControllerLib.MarketControllerStorage storage mcs = MarketControllerLib.marketControllerStorage();

        // Set the ticketer for the consignment if not different
        if (_ticketerType != mcs.consignmentTicketers[_consignmentId]) {

            // Set the ticketer for the consignment
            mcs.consignmentTicketers[_consignmentId] = _ticketerType;

            // Notify listeners of state change
            emit ConsignmentTicketerChanged(_consignmentId, _ticketerType);

        }
    }

}