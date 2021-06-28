// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

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
contract MarketController is AccessClient {

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
    event ConsignmentRegistered(Consignment consignment);
    event ConsignmentTicketerChanged(uint256 consignmentId, Ticketer indexed ticketerType);

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
    external view
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
    external view
    returns (Ticketer) {
        return defaultTicketerType;
    }

    /**
     * @notice Get the Escrow Ticketer to be used for a given consignment
     *
     * If a specific ticketer has not been set for the consignment,
     * the default escrow ticketer will be returned.
     *
     * @param _consignmentId - the id of the consignment
     * @return ticketer = the address of the escrow ticketer to use
     */
    function getEscrowTicketer(uint256 _consignmentId)
    external view
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
     */
    function getConsignment(uint256 _consignmentId)
    external view
    returns (Consignment memory) {
        return consignments[_consignmentId];
    }

    /**
     * @notice Registers a new consignment for sale or auction.
     *
     * Emits a ConsignmentRegistered event.
     *
     * @param _market - the market for the consignment. See {SeenTypes.Market}
     * @param _seller - the current owner of the consignment
     * @param _tokenAddress - the contract address issuing the NFT behind the consignment
     * @param _tokenId - the id of the token being consigned
     *
     * @return consignment - the registered consignment
     */
    function registerConsignment(
        Market _market,
        address payable _seller,
        address _tokenAddress,
        uint256 _tokenId
    )
    external
    onlyRole(MARKET_HANDLER)
    returns (Consignment memory consignment)
    {
        // Get the id for the new consignment
        uint256 id = nextConsignment++;

        // Create and store the consignment
        consignment = Consignment(
            _market,
            _seller,
            _tokenAddress,
            _tokenId,
            id
        );
        consignments[id] = consignment;

        // Notify listeners of state change
        emit ConsignmentRegistered(consignment);

    }

    /**
     * @notice Set the type of Escrow Ticketer to be used for a consignment
     *
     * Default escrow ticketer is Ticketer.Lots. This only needs to be called
     * if overriding to Ticketer.Items for a given consignment.
     *
     * Emits a ConsignmentTicketerSet event.
     * Reverts if consignment is not registered.
     *
     * @param _consignmentId - the id of the consignment
     * @param _ticketerType - the type of ticketer to use. See: {SeenTypes.Ticketer}
     */
    function setConsignmentTicketer(uint256 _consignmentId, Ticketer _ticketerType)
    external
    onlyRole(ESCROW_AGENT)
    {

        // Be sure this is an existing consignment
        require(_consignmentId < nextConsignment, "Invalid consignment id.");

        // Set the ticketer for the consignment if not different
        if (_ticketerType != consignmentTicketers[_consignmentId]) {

            // Set the ticketer for the consignment
            consignmentTicketers[_consignmentId] = _ticketerType;

            // Notify listeners of state change
            emit ConsignmentTicketerChanged(_consignmentId, _ticketerType);

        }
    }

}