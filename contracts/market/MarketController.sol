// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.5;

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "../access/AccessClient.sol";
import "../token/nft/ISeenHausNFT.sol";
import "../token/escrow/IEscrowTicketer.sol";
import "./IMarketController.sol";

/**
 * @title MarketController
 * @author Cliff Hall
 * @notice Provides centralized management of consignments and various market-related settings.
 */
contract MarketController is AccessClient, ERC1155Holder {

    /// Events
    event NFTAddressChanged(address indexed nft);
    event EscrowTicketerAddressChanged(address indexed escrowTicketer, Ticketer indexed ticketerType);
    event StakingAddressChanged(address indexed staking);
    event MultisigAddressChanged(address indexed multisig);
    event PhysicalItemsAddressChanged(address indexed physicalItems);
    event PhysicalLotsAddressChanged(address indexed physicalLots);
    event VipStakerAmountChanged(uint256 indexed vipStakerAmount);
    event FeePercentageChanged(uint16 indexed feePercentage);
    event MaxRoyaltyPercentageChanged(uint16 indexed maxRoyaltyPercentage);
    event OutBidPercentageChanged(uint16 indexed outBidPercentage);
    event DefaultTicketerTypeChanged(Ticketer indexed ticketerType);
    event ConsignmentRegistered(address indexed consignor, Consignment consignment);
    event ConsignmentTicketerChanged(uint256 consignmentId, Ticketer indexed ticketerType);
    event ConsignmentReleased(Consignment consignment, uint256 amount, address releasedTo);

    /// @dev the address of the Seen.Haus NFT contract
    address internal nft;

    /// @dev the address of the xSEEN ERC-20 Seen.Haus staking contract
    address payable internal staking;

    /// @dev the address of the Seen.Haus multi-sig wallet
    address payable internal multisig;

    /// @dev address of the Seen.Haus lots-based escrow ticketing contract
    address public lotsTicketer;

    /// @dev address of the Seen.Haus items-based escrow ticketing contract
    address public itemsTicketer;

    /// @dev the default escrow ticketer type to use for physical consignments unless overridden with setConsignmentTicketer
    Ticketer internal defaultTicketerType;

    /// @dev the minimum amount of xSEEN ERC-20 a caller must hold to participate in VIP events
    uint256 internal vipStakerAmount;

    /// @dev the percentage that will be taken as a fee from the net of a Seen.Haus sale or auction (after royalties)
    uint16 internal feePercentage;         // 1.75% = 175, 100% = 10000

    /// @dev the maximum percentage of a Seen.Haus sale or auction that will be paid as a royalty
    uint16 internal maxRoyaltyPercentage;  // 1.75% = 175, 100% = 10000

    /// @dev the minimum percentage a Seen.Haus auction bid must be above the previous bid to prevail
    uint16 internal outBidPercentage;      // 1.75% = 175, 100% = 10000

    /// @dev next consignment id
    uint256 internal nextConsignment;

    /// @dev consignment id => consignment
    mapping(uint256 => Consignment) public consignments;

    /// @dev consignmentId to consignor address
    mapping(uint256 => address) public consignors;

    /// @dev consignment id => ticketer type
    mapping(uint256 => Ticketer) public consignmentTicketers;

    /**
     * @notice Constructor
     *
     * @param _accessController - the Seen.Haus AccessController
     * @param _staking - Seen.Haus staking contract
     * @param _multisig - Seen.Haus multi-sig wallet
     * @param _vipStakerAmount - the minimum amount of xSEEN ERC-20 a caller must hold to participate in VIP events
     * @param _feePercentage - percentage that will be taken as a fee from the net of a Seen.Haus sale or auction (after royalties)
     * @param _maxRoyaltyPercentage - maximum percentage of a Seen.Haus sale or auction that will be paid as a royalty
     * @param _outBidPercentage - minimum percentage a Seen.Haus auction bid must be above the previous bid to prevail
     */
    constructor(
        address _accessController,
        address payable _staking,
        address payable _multisig,
        uint256 _vipStakerAmount,
        uint16 _feePercentage,
        uint16 _maxRoyaltyPercentage,
        uint16 _outBidPercentage,
        Ticketer _defaultTicketerType
    )
    AccessClient(_accessController)
    {
        staking = _staking;
        multisig = _multisig;
        vipStakerAmount = _vipStakerAmount;
        feePercentage = _feePercentage;
        maxRoyaltyPercentage = _maxRoyaltyPercentage;
        outBidPercentage = _outBidPercentage;
        defaultTicketerType = _defaultTicketerType;
    }

    /**
     * @dev Modifier that checks that the consignment exists
     *
     * Reverts if the consignment does not exist
     */
    modifier consignmentExists(uint256 _consignmentId) {

        // Make sure the consignment exists
        require(_consignmentId < nextConsignment, "Consignment does not exist");
        _;
    }

    /**
     * @notice Sets the address of the xSEEN ERC-20 staking contract.
     *
     * Emits a NFTAddressChanged event.
     *
     * @param _nft - the address of the nft contract
     */
    function setNft(address _nft)
    external
    onlyRole(ADMIN) {
        nft = _nft;
        emit NFTAddressChanged(nft);
    }

    /**
     * @notice The nft getter
     */
    function getNft()
    external view
    returns (address) {
        return nft;
    }

    /**
     * @notice Sets the address of the Seen.Haus lots-based escrow ticketer contract.
     *
     * Emits a EscrowTicketerAddressChanged event.
     *
     * @param _lotsTicketer - the address of the lots-based escrow ticketer contract
     */
    function setLotsTicketer(address _lotsTicketer)
    external
    onlyRole(ADMIN) {
        lotsTicketer = _lotsTicketer;
        emit EscrowTicketerAddressChanged(lotsTicketer, Ticketer.Lots);
    }

    /**
     * @notice The lots-based escrow ticketer getter
     */
    function getLotsTicketer()
    external view
    returns (address) {
        return lotsTicketer;
    }

    /**
     * @notice Sets the address of the Seen.Haus items-based escrow ticketer contract.
     *
     * Emits a EscrowTicketerAddressChanged event.
     *
     * @param _itemsTicketer - the address of the items-based escrow ticketer contract
     */
    function setItemsTicketer(address _itemsTicketer)
    external
    onlyRole(ADMIN) {
        itemsTicketer = _itemsTicketer;
        emit EscrowTicketerAddressChanged(itemsTicketer, Ticketer.Items);
    }

    /**
     * @notice The items-based ticketer getter
     */
    function getItemsTicketer()
    external view
    returns (address) {
        return itemsTicketer;
    }

    /**
     * @notice Sets the address of the xSEEN ERC-20 staking contract.
     *
     * Emits a StakingAddressChanged event.
     *
     * @param _staking - the address of the staking contract
     */
    function setStaking(address payable _staking)
    external
    onlyRole(ADMIN) {
        staking = _staking;
        emit StakingAddressChanged(staking);
    }

    /**
     * @notice The staking getter
     */
    function getStaking()
    external view
    returns (address payable) {
        return staking;
    }

    /**
     * @notice Sets the address of the Seen.Haus multi-sig wallet.
     *
     * Emits a MultisigAddressChanged event.
     *
     * @param _multisig - the address of the multi-sig wallet
     */
    function setMultisig(address payable _multisig)
    external
    onlyRole(ADMIN) {
        multisig = _multisig;
        emit MultisigAddressChanged(multisig);
    }

    /**
     * @notice The multisig getter
     */
    function getMultisig()
    external view
    returns (address payable) {
        return multisig;
    }

    /**
     * @notice Sets the VIP staker amount.
     *
     * Emits a VipStakerAmountChanged event.
     *
     * @param _vipStakerAmount - the minimum amount of xSEEN ERC-20 a caller must hold to participate in VIP events
     */
    function setVipStakerAmount(uint256 _vipStakerAmount)
    external
    onlyRole(ADMIN) {
        vipStakerAmount = _vipStakerAmount;
        emit VipStakerAmountChanged(vipStakerAmount);
    }

    /**
     * @notice The vipStakerAmount getter
     */
    function getVipStakerAmount()
    external view
    returns (uint256) {
        return vipStakerAmount;
    }

    /**
     * @notice Sets the marketplace fee percentage.
     * Emits a FeePercentageChanged event.
     *
     * @param _feePercentage - the percentage that will be taken as a fee from the net of a Seen.Haus sale or auction (after royalties)
     *
     * N.B. Represent percentage value as an unsigned int by multiplying the percentage by 100:
     * e.g, 1.75% = 175, 100% = 10000
     */
    function setFeePercentage(uint16 _feePercentage)
    external
    onlyRole(ADMIN) {
        require(_feePercentage > 0 && _feePercentage <= 10000,
            "Percentage representation must be between 1 and 10000");
        feePercentage = _feePercentage;
        emit FeePercentageChanged(feePercentage);
    }

    /**
     * @notice The feePercentage getter
     */
    function getFeePercentage()
    external view
    returns (uint16) {
        return feePercentage;
    }

    /**
     * @notice Sets the maximum royalty percentage the marketplace will pay.
     *
     * Emits a MaxRoyaltyPercentageChanged event.
     *
     * @param _maxRoyaltyPercentage - the maximum percentage of a Seen.Haus sale or auction that will be paid as a royalty
     *
     * N.B. Represent percentage value as an unsigned int by multiplying the percentage by 100:
     * e.g, 1.75% = 175, 100% = 10000
     */
    function setMaxRoyaltyPercentage(uint16 _maxRoyaltyPercentage)
    external
    onlyRole(ADMIN) {
        require(_maxRoyaltyPercentage > 0 && _maxRoyaltyPercentage <= 10000,
            "Percentage representation must be between 1 and 10000");
        maxRoyaltyPercentage = _maxRoyaltyPercentage;
        emit MaxRoyaltyPercentageChanged(maxRoyaltyPercentage);
    }

    /**
     * @notice The maxRoyaltyPercentage getter
     */
    function getMaxRoyaltyPercentage()
    external view
    returns (uint16) {
        return maxRoyaltyPercentage;
    }

    /**
     * @notice Sets the marketplace auction outbid percentage.
     *
     * Emits a OutBidPercentageChanged event.
     *
     * @param _outBidPercentage - the minimum percentage a Seen.Haus auction bid must be above the previous bid to prevail
     *
     * N.B. Represent percentage value as an unsigned int by multiplying the percentage by 100:
     * e.g, 1.75% = 175, 100% = 10000
     */
    function setOutBidPercentage(uint16 _outBidPercentage)
    external
    onlyRole(ADMIN) {
        require(_outBidPercentage > 0 && _outBidPercentage <= 10000,
            "Percentage representation must be between 1 and 10000");
        outBidPercentage = _outBidPercentage;
        emit OutBidPercentageChanged(outBidPercentage);
    }

    /**
     * @notice The outBidPercentage getter
     */
    function getOutBidPercentage()
    external
    view
    returns (uint16) {
        return outBidPercentage;
    }

    /**
     * @notice Sets the default escrow ticketer type.
     *
     * Emits a DefaultTicketerTypeChanged event.
     *
     * Reverts if _ticketerType is Ticketer.Default
     * Reverts if _ticketerType is already the defaultTicketerType
     *
     * @param _ticketerType - the new default escrow ticketer type.
     */
    function setDefaultTicketerType(Ticketer _ticketerType)
    external
    onlyRole(ADMIN) {
        require(_ticketerType != Ticketer.Default, "Invalid ticketer type.");
        require(_ticketerType != defaultTicketerType, "Type is already default.");
        defaultTicketerType = _ticketerType;
        emit DefaultTicketerTypeChanged(_ticketerType);
    }

    /**
     * @notice The defaultTicketerType getter
     */
    function getDefaultTicketerType()
    external
    view
    returns (Ticketer) {
        return defaultTicketerType;
    }

    /**
     * @notice Get the Escrow Ticketer to be used for a given consignment
     *
     * If a specific ticketer has not been set for the consignment,
     * the default escrow ticketer will be returned.
     *
     * Reverts if consignment doesn't exist
     *     *
     * @param _consignmentId - the id of the consignment
     * @return ticketer = the address of the escrow ticketer to use
     */
    function getEscrowTicketer(uint256 _consignmentId)
    external
    view
    consignmentExists(_consignmentId)
    returns (address) {
        Ticketer specified = consignmentTicketers[_consignmentId];
        Ticketer ticketerType = (specified == Ticketer.Default) ? defaultTicketerType : specified;
        return (ticketerType == Ticketer.Lots) ? lotsTicketer : itemsTicketer;
    }

    /**
     * @notice The nextConsignment getter
     * @dev does not increment counter
     */
    function getNextConsignment()
    external view
    returns (uint256) {
        return nextConsignment;
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
    view
    consignmentExists(_consignmentId)
    returns (Consignment memory consignment) {
        consignment = consignments[_consignmentId];
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
    view
    consignmentExists(_consignmentId)
    returns(uint256)
    {
        Consignment storage consignment = consignments[_consignmentId];
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
    view
    consignmentExists(_consignmentId)
    returns(bool)
    {
        return consignors[_consignmentId] == _account;
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
        SeenTypes.Market _market,
        address _consignor,
        address payable _seller,
        address _tokenAddress,
        uint256 _tokenId,
        uint256 _supply
    )
    external
    onlyRole(MARKET_HANDLER)
    returns (Consignment memory consignment)
    {
        // Ensure the consigned token has been transferred to this contract
        require(IERC1155(_tokenAddress).balanceOf(address(this), _tokenId) == _supply);

        // Get the id for the new consignment
        uint256 id = nextConsignment++;

        // Create and store the consignment
        consignment = Consignment(
            _market,
            _seller,
            _tokenAddress,
            _tokenId,
            _supply,
            id
        );
        consignments[id] = consignment;

        // Associate the consignor
        consignors[id] = _consignor;

        // Notify listeners of state change
        emit ConsignmentRegistered(_consignor, consignment);

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
    onlyRole(MARKET_HANDLER)
    consignmentExists(_consignmentId)
    {

        // Get the consignment into memory
        Consignment memory consignment = consignments[_consignmentId];

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
        emit ConsignmentReleased(consignment, _amount, _releaseTo);

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
    onlyRole(ESCROW_AGENT)
    consignmentExists(_consignmentId)
    {
        // Set the ticketer for the consignment if not different
        if (_ticketerType != consignmentTicketers[_consignmentId]) {

            // Set the ticketer for the consignment
            consignmentTicketers[_consignmentId] = _ticketerType;

            // Notify listeners of state change
            emit ConsignmentTicketerChanged(_consignmentId, _ticketerType);

        }
    }

}