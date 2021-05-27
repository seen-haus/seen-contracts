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

    // Events
    event NFTAddressChanged(address indexed nft);
    event EscrowTicketerAddressChanged(address indexed escrowTicketer);
    event StakingAddressChanged(address indexed staking);
    event MultisigAddressChanged(address indexed multisig);
    event TangibleItemsAddressChanged(address indexed tangibleItems);
    event TangibleLotsAddressChanged(address indexed tangibleLots);
    event VipStakerAmountChanged(uint256 indexed vipStakerAmount);
    event FeePercentageChanged(uint8 indexed feePercentage);
    event RoyaltyPercentageChanged(uint8 indexed royaltyPercentage);
    event MaxRoyaltyPercentageChanged(uint8 indexed maxRoyaltyPercentage);
    event OutBidPercentageChanged(uint8 indexed outBidPercentage);
    event ConsignmentRegistered(SeenTypes.Consignment consignment);

    /// @dev the address of the Seen.Haus NFT contract
    address internal nft;

    /// @dev address of the Seen.Haus escrow ticketing contract
    address public escrowTicketer;

    /// @dev the address of the xSEEN ERC-20 Seen.Haus staking contract
    address payable staking;

    /// @dev the address of the Seen.Haus multi-sig wallet
    address payable multisig;

    /// @dev the minimum amount of xSEEN ERC-20 a caller must hold to participate in VIP events
    uint256 public vipStakerAmount;

    /// @dev the percentage that will be taken as a fee from the net of a Seen.Haus sale or auction (after royalties)
    uint8 public feePercentage;         // 0 - 100

    /// @dev The percentage of a Seen.Haus minted secondary sale that should go to the token's creator
    uint8 public royaltyPercentage;     // 0 - 100

    /// @dev the maximum percentage of a Seen.Haus sale or auction that will be paid as a royalty (meant for foreign consignments)
    uint8 public maxRoyaltyPercentage;  // 0 - 100

    /// @dev the minimum percentage a Seen.Haus auction bid must be above the previous bid to prevail
    uint8 public outBidPercentage;      // 0 - 100

    /// @dev next consignment id
    uint256 public nextConsignment;

    /// @dev consignment id => consignment
    mapping(uint256 => Consignment) public consignments;

    /**
     * @notice Constructor
     *
     * @param _accessController - the Seen.Haus AccessController
     * @param _nft - Seen.Haus NFT contract
     * @param _escrowTicketer - Seen.Haus escrow ticket contract
     * @param _staking - Seen.Haus staking contract
     * @param _multisig - Seen.Haus multi-sig wallet
     * @param _vipStakerAmount - the minimum amount of xSEEN ERC-20 a caller must hold to participate in VIP events
     * @param _feePercentage - percentage that will be taken as a fee from the net of a Seen.Haus sale or auction (after royalties)
     * @param _royaltyPercentage - percentage of a Seen.Haus secondary sale that should go to the token's creator
     * @param _maxRoyaltyPercentage - maximum percentage of a Seen.Haus sale or auction that will be paid as a royalty
     * @param _outBidPercentage - minimum percentage a Seen.Haus auction bid must be above the previous bid to prevail
     */
    constructor(
        address _accessController,
        address _nft,
        address _escrowTicketer,
        address payable _staking,
        address payable _multisig,
        uint256 _vipStakerAmount,
        uint8 _feePercentage,
        uint8 _royaltyPercentage,
        uint8 _maxRoyaltyPercentage,
        uint8 _outBidPercentage
    )
    AccessClient(_accessController)
    {
        nft = _nft;
        escrowTicketer = _escrowTicketer;
        staking = _staking;
        multisig = _multisig;
        vipStakerAmount = _vipStakerAmount;
        feePercentage = _feePercentage;
        royaltyPercentage = _royaltyPercentage;
        maxRoyaltyPercentage = _maxRoyaltyPercentage;
        outBidPercentage = _outBidPercentage;
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
     * @notice Sets the address of the Seen.Haus escrow ticketer contract.
     *
     * Emits a EscrowTicketerAddressChanged event.
     *
     * @param _escrowTicketer - the address of the escrow ticketer contract
     */
    function setEscrowTicketer(address _escrowTicketer)
    external
    onlyRole(ADMIN) {
        escrowTicketer = _escrowTicketer;
        emit EscrowTicketerAddressChanged(escrowTicketer);
    }

    /**
     * @notice The escrowTicketer getter
     */
    function getEscrowTicketer()
    external view
    returns (address) {
        return escrowTicketer;
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
     *
     * Emits a FeePercentageChanged event.
     *
     * @param _feePercentage - the percentage that will be taken as a fee from the net of a Seen.Haus sale or auction (after royalties)
     */
    function setFeePercentage(uint8 _feePercentage)
    external
    onlyRole(ADMIN) {
        feePercentage = _feePercentage;
        emit FeePercentageChanged(feePercentage);
    }

    /**
     * @notice The feePercentage getter
     */
    function getFeePercentage()
    external view
    returns (uint8) {
        return feePercentage;
    }

    /**
     * @notice Sets the marketplace royalty percentage.
     *
     * Emits a RoyaltyPercentageChanged event.
     *
     * @param _royaltyPercentage - the percentage of a Seen.Haus minted secondary sale that should go to the token's creator
     */
    function setRoyaltyPercentage(uint8 _royaltyPercentage)
    external
    onlyRole(ADMIN) {
        royaltyPercentage = _royaltyPercentage;
        emit RoyaltyPercentageChanged(royaltyPercentage);
    }

    /**
     * @notice The royaltyPercentage getter
     */
    function getRoyaltyPercentage()
    external view
    returns (uint8) {
        return royaltyPercentage;
    }

    /**
     * @notice Sets the external marketplace maximum royalty percentage.
     *
     * Emits a MaxRoyaltyPercentageChanged event.
     *
     * @param _maxRoyaltyPercentage - the maximum percentage of a Seen.Haus sale or auction that will be paid as a royalty
     */
    function setMaxRoyaltyPercentage(uint8 _maxRoyaltyPercentage)
    external
    onlyRole(ADMIN) {
        maxRoyaltyPercentage = _maxRoyaltyPercentage;
        emit MaxRoyaltyPercentageChanged(maxRoyaltyPercentage);
    }

    /**
     * @notice The maxRoyaltyPercentage getter
     */
    function getMaxRoyaltyPercentage()
    external view
    returns (uint8) {
        return maxRoyaltyPercentage;
    }

    /**
     * @notice Sets the marketplace auction outbid percentage.
     *
     * Emits a OutBidPercentageChanged event.
     *
     * @param _outBidPercentage - the minimum percentage a Seen.Haus auction bid must be above the previous bid to prevail
     */
    function setOutBidPercentage(uint8 _outBidPercentage)
    external
    onlyRole(ADMIN) {
        outBidPercentage = _outBidPercentage;
        emit OutBidPercentageChanged(outBidPercentage);
    }

    /**
     * @notice The outBidPercentage getter
     */
    function getOutBidPercentage()
    external view
    returns (uint8) {
        return outBidPercentage;
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
     * @param _token - the contract address issuing the NFT behind the consignment
     * @param _tokenId - the id of the token being consigned
     *
     * @return consignment - the registered consignment
     */
    function registerConsignment(
        Market _market,
        address payable _seller,
        address _token,
        uint256 _tokenId
    )
    external
    onlyRole(MARKET_HANDLER)
    returns (Consignment memory consignment)
    {
        uint256 id = nextConsignment++;

        // Create and store the consignment
        consignment = Consignment(
            _market,
            _seller,
            _token,
            _tokenId,
            id
        );
        consignments[id] = consignment;

        // Notify listeners of state change
        emit ConsignmentRegistered(consignment);

    }

}