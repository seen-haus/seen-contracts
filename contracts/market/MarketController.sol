// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "../access/AccessClient.sol";
import "../token/nft/ISeenHausNFT.sol";
import "../token/escrow/IEscrowTicket.sol";

contract MarketController is AccessClient {

    // Events
    event NFTAddressChanged(address indexed nft);
    event EscrowTicketAddressChanged(address indexed escrowTicket);
    event StakingAddressChanged(address indexed staking);
    event MultisigAddressChanged(address indexed multisig);
    event TangibleItemsAddressChanged(address indexed tangibleItems);
    event TangibleLotsAddressChanged(address indexed tangibleLots);
    event VipStakerAmountChanged(uint256 indexed vipStakerAmount);
    event FeePercentageChanged(uint8 indexed feePercentage);
    event RoyaltyPercentageChanged(uint8 indexed royaltyPercentage);
    event MaxRoyaltyPercentageChanged(uint8 indexed maxRoyaltyPercentage);
    event OutBidPercentageChanged(uint8 indexed outBidPercentage);

    /// @notice the address of the Seen.Haus NFT contract
    ISeenHausNFT public nft;

    /// @notice address of the Seen.Haus escrow ticket contract
    IEscrowTicket public escrowTicket;

    /// @notice the address of the xSEEN ERC-20 Seen.Haus staking contract
    address payable public staking;

    /// @notice the address of the Seen.Haus multi-sig wallet
    address payable public multisig;

    /// @notice the minimum amount of xSEEN ERC-20 a caller must hold to participate in VIP events
    uint256 public vipStakerAmount;

    /// @notice the percentage that will be taken as a fee from the net of a Seen.Haus sale or auction (after royalties)
    uint8 public feePercentage;         // 0 - 100

    /// @notice The percentage of a Seen.Haus minted secondary sale that should go to the token's creator
    uint8 public royaltyPercentage;     // 0 - 100

    /// @notice the maximum percentage of a Seen.Haus sale or auction that will be paid as a royalty (meant for foreign consignments)
    uint8 public maxRoyaltyPercentage;  // 0 - 100

    /// @notice the minimum percentage a Seen.Haus auction bid must be above the previous bid to prevail
    uint8 public outBidPercentage;      // 0 - 100

    /**
     * @notice Constructor
     *
     * @param _nft - Seen.Haus NFT contract
     * @param _escrowTicket - Seen.Haus escrow ticket contract
     * @param _staking - Seen.Haus staking contract
     * @param _multisig - Seen.Haus multi-sig wallet
     * @param _vipStakerAmount - the minimum amount of xSEEN ERC-20 a caller must hold to participate in VIP events
     * @param _feePercentage - percentage that will be taken as a fee from the net of a Seen.Haus sale or auction (after royalties)
     * @param _royaltyPercentage - percentage of a Seen.Haus secondary sale that should go to the token's creator
     * @param _maxRoyaltyPercentage - maximum percentage of a Seen.Haus sale or auction that will be paid as a royalty
     * @param _outBidPercentage - minimum percentage a Seen.Haus auction bid must be above the previous bid to prevail
     */
    constructor(
        address _nft,
        address _escrowTicket,
        address payable _staking,
        address payable _multisig,
        uint256 _vipStakerAmount,
        uint8 _feePercentage,
        uint8 _royaltyPercentage,
        uint8 _maxRoyaltyPercentage,
        uint8 _outBidPercentage
    ) {
        nft = ISeenHausNFT(_nft);
        escrowTicket = IEscrowTicket(_escrowTicket);
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
     * @param _NFT - the address of the nft contract
     */
    function setNFT(address _nft)
    external
    onlyRole(ADMIN) {
        nft = _nft;
        emit NFTAddressChanged(nft);
    }

    /**
     * @notice Sets the address of the Seen.Haus escrow ticket contract.
     *
     * Emits a EscrowTicketAddressChanged event.
     *
     * @param _escrowTicket - the address of the escrow ticket contract
     */
    function setEscrowTicket(address _escrowTicket)
    external
    onlyRole(ADMIN) {
        escrowTicket = _escrowTicket;
        emit EscrowTicketAddressChanged(escrowTicket);
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

}