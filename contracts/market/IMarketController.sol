// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "../SeenTypes.sol";

abstract contract IMarketController is SeenTypes {

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
    event ConsignmentRegistered(Consignment consignment);

    /**
     * @notice Sets the address of the xSEEN ERC-20 staking contract.
     *
     * Emits a NFTAddressChanged event.
     *
     * @param _nft - the address of the nft contract
     */
    function setNft(address _nft) external virtual;

    /**
     * @notice The nft getter
     */
    function getNft() external virtual returns (address);

    /**
     * @notice Sets the address of the Seen.Haus escrow ticket contract.
     *
     * Emits a EscrowTicketAddressChanged event.
     *
     * @param _escrowTicket - the address of the escrow ticket contract
     */
    function setEscrowTicket(address _escrowTicket) external virtual;

    /**
     * @notice The escrowTicket getter
     */
    function getEscrowTicket() external virtual returns (address);

    /**
     * @notice Sets the address of the xSEEN ERC-20 staking contract.
     *
     * Emits a StakingAddressChanged event.
     *
     * @param _staking - the address of the staking contract
     */
    function setStaking(address payable _staking) external virtual;

    /**
     * @notice The staking getter
     */
    function getStaking() external virtual returns (address payable);

    /**
     * @notice Sets the address of the Seen.Haus multi-sig wallet.
     *
     * Emits a MultisigAddressChanged event.
     *
     * @param _multisig - the address of the multi-sig wallet
     */
    function setMultisig(address payable _multisig) external virtual;

    /**
     * @notice The multisig getter
     */
    function getMultisig() external virtual returns (address payable);

    /**
     * @notice Sets the VIP staker amount.
     *
     * Emits a VipStakerAmountChanged event.
     *
     * @param _vipStakerAmount - the minimum amount of xSEEN ERC-20 a caller must hold to participate in VIP events
     */
    function setVipStakerAmount(uint256 _vipStakerAmount) external virtual;

    /**
     * @notice The vipStakerAmount getter
     */
    function getVipStakerAmount() external virtual returns (uint256);

    /**
     * @notice Sets the marketplace fee percentage.
     *
     * Emits a FeePercentageChanged event.
     *
     * @param _feePercentage - the percentage that will be taken as a fee from the net of a Seen.Haus sale or auction (after royalties)
     */
    function setFeePercentage(uint8 _feePercentage) external virtual;

    /**
     * @notice The feePercentage getter
     */
    function getFeePercentage() external virtual returns (uint8);

    /**
     * @notice Sets the marketplace royalty percentage.
     *
     * Emits a RoyaltyPercentageChanged event.
     *
     * @param _royaltyPercentage - the percentage of a Seen.Haus minted secondary sale that should go to the token's creator
     */
    function setRoyaltyPercentage(uint8 _royaltyPercentage) external virtual;

    /**
     * @notice The royaltyPercentage getter
     */
    function getRoyaltyPercentage() external virtual returns (uint8);

    /**
     * @notice Sets the external virtual marketplace maximum royalty percentage.
     *
     * Emits a MaxRoyaltyPercentageChanged event.
     *
     * @param _maxRoyaltyPercentage - the maximum percentage of a Seen.Haus sale or auction that will be paid as a royalty
     */
    function setMaxRoyaltyPercentage(uint8 _maxRoyaltyPercentage) external virtual;

    /**
     * @notice The maxRoyaltyPercentage getter
     */
    function getMaxRoyaltyPercentage() external virtual returns (uint8);

    /**
     * @notice Sets the marketplace auction outbid percentage.
     *
     * Emits a OutBidPercentageChanged event.
     *
     * @param _outBidPercentage - the minimum percentage a Seen.Haus auction bid must be above the previous bid to prevail
     */
    function setOutBidPercentage(uint8 _outBidPercentage) external virtual;

    /**
     * @notice The outBidPercentage getter
     */
    function getOutBidPercentage() external virtual returns (uint8);

    /**
     * @notice The nextConsignment getter
     */
    function getNextConsignment() external virtual returns (uint256);

    /**
     * @notice The consignment getter
     */
    function getConsignment(uint256 _consignmentId) external virtual returns (Consignment memory);

    /**
     * @notice Registers a new consignment for sale or auction.
     *
     * Emits a ConsignmentRegistered event.
     *
     * @param _market - the market for the consignment. See {SeenTypes.Market}
     * @param _audience - the initial audience that can participate. See {SeenTypes.Audience}
     * @param _seller - the current owner of the consignment
     * @param _token - the contract address issuing the NFT behind the consignment
     * @param _tokenId - the id of the token being consigned
     *
     * @return Consignment - the registered consignment
     */
    function registerConsignment(
        Market _market,
        Audience _audience,
        address payable _seller,
        address _token,
        uint256 _tokenId
    ) external virtual returns(Consignment memory);

}