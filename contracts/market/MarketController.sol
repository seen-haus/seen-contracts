// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.5;

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "../diamond/libraries/LibMarketController.sol";
import "../token/escrow/IEscrowTicketer.sol";
import "../token/nft/ISeenHausNFT.sol";
import "../domain/SeenTypes.sol";
import "./IMarketController.sol";


/**
 * @title MarketController
 * @author Cliff Hall
 * @notice Provides centralized management of consignments and various market-related settings.
 */
contract MarketController is SeenTypes, ERC1155Holder, IMarketController {

    /**
     * @dev Modifier to protect initializer function from being invoked twice.
     */
    modifier initializer() {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        require(mcs.initializing || !mcs.initialized, "Initializable: contract is already initialized");

        bool isTopLevelCall = !mcs.initializing;
        if (isTopLevelCall) {
            mcs.initializing = true;
            mcs.initialized = true;
        }

        _;

        if (isTopLevelCall) {
            mcs.initializing = false;
        }
    }

    /**
     * @notice Intitializer
     *
     * @param _accessController - Seen.Haus AccessController contract
     * @param _staking - Seen.Haus staking contract
     * @param _multisig - Seen.Haus multi-sig wallet
     * @param _vipStakerAmount - the minimum amount of xSEEN ERC-20 a caller must hold to participate in VIP events
     * @param _feePercentage - percentage that will be taken as a fee from the net of a Seen.Haus sale or auction (after royalties)
     * @param _maxRoyaltyPercentage - maximum percentage of a Seen.Haus sale or auction that will be paid as a royalty
     * @param _outBidPercentage - minimum percentage a Seen.Haus auction bid must be above the previous bid to prevail
     * @param _defaultTicketerType - which ticketer type to use if none has been specified for a given consignment
     */
    function initialize (
        address _accessController,
        address payable _staking,
        address payable _multisig,
        uint256 _vipStakerAmount,
        uint16 _feePercentage,
        uint16 _maxRoyaltyPercentage,
        uint16 _outBidPercentage,
        Ticketer _defaultTicketerType
    )
    public
    initializer
    {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        mcs.accessController = IAccessControl(_accessController);
        mcs.staking = _staking;
        mcs.multisig = _multisig;
        mcs.vipStakerAmount = _vipStakerAmount;
        mcs.feePercentage = _feePercentage;
        mcs.maxRoyaltyPercentage = _maxRoyaltyPercentage;
        mcs.outBidPercentage = _outBidPercentage;
        mcs.defaultTicketerType = _defaultTicketerType;
    }

    /**
     * @dev Modifier that checks that the consignment exists
     *
     * Reverts if the consignment does not exist
     */
    modifier consignmentExists(uint256 _consignmentId) {

        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();

        // Make sure the consignment exists
        require(_consignmentId < mcs.nextConsignment, "Consignment does not exist");
        _;
    }

    /**
     * @dev Modifier that checks that the caller has a specific role.
     *
     * Reverts if caller doesn't have role.
     *
     * See: {AccessController.hasRole}
     */
    modifier onlyRole(bytes32 _role) {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        require(mcs.accessController.hasRole(_role, msg.sender), "Access denied, caller doesn't have role");
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
    override
    onlyRole(ADMIN) {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        mcs.nft = _nft;
        emit NFTAddressChanged(_nft);
    }

    /**
     * @notice The nft getter
     */
    function getNft()
    external
    view
    override
    returns (address) {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        return mcs.nft;
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
    override
    onlyRole(ADMIN) {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        mcs.lotsTicketer = _lotsTicketer;
        emit EscrowTicketerAddressChanged(mcs.lotsTicketer, Ticketer.Lots);
    }

    /**
     * @notice The lots-based escrow ticketer getter
     */
    function getLotsTicketer()
    external
    view
    override
    returns (address) {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        return mcs.lotsTicketer;
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
    override
    onlyRole(ADMIN) {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        mcs.itemsTicketer = _itemsTicketer;
        emit EscrowTicketerAddressChanged(mcs.itemsTicketer, Ticketer.Items);
    }

    /**
     * @notice The items-based ticketer getter
     */
    function getItemsTicketer()
    external
    view
    override
    returns (address) {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        return mcs.itemsTicketer;
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
    override
    onlyRole(ADMIN) {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        mcs.staking = _staking;
        emit StakingAddressChanged(mcs.staking);
    }

    /**
     * @notice The staking getter
     */
    function getStaking()
    external
    view
    override
    returns (address payable) {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        return mcs.staking;
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
    override
    onlyRole(ADMIN) {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        mcs.multisig = _multisig;
        emit MultisigAddressChanged(mcs.multisig);
    }

    /**
     * @notice The multisig getter
     */
    function getMultisig()
    external
    view
    override
    returns (address payable) {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        return mcs.multisig;
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
    override
    onlyRole(ADMIN) {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        mcs.vipStakerAmount = _vipStakerAmount;
        emit VipStakerAmountChanged(mcs.vipStakerAmount);
    }

    /**
     * @notice The vipStakerAmount getter
     */
    function getVipStakerAmount()
    external
    view
    override
    returns (uint256) {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        return mcs.vipStakerAmount;
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
    override
    onlyRole(ADMIN) {
        require(_feePercentage > 0 && _feePercentage <= 10000,
            "Percentage representation must be between 1 and 10000");
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        mcs.feePercentage = _feePercentage;
        emit FeePercentageChanged(mcs.feePercentage);
    }

    /**
     * @notice The feePercentage getter
     */
    function getFeePercentage()
    external
    view
    override
    returns (uint16) {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        return mcs.feePercentage;
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
    override
    onlyRole(ADMIN) {
        require(_maxRoyaltyPercentage > 0 && _maxRoyaltyPercentage <= 10000,
            "Percentage representation must be between 1 and 10000");
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        mcs.maxRoyaltyPercentage = _maxRoyaltyPercentage;
        emit MaxRoyaltyPercentageChanged(mcs.maxRoyaltyPercentage);
    }

    /**
     * @notice The maxRoyaltyPercentage getter
     */
    function getMaxRoyaltyPercentage()
    external
    view
    override
    returns (uint16) {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        return mcs.maxRoyaltyPercentage;
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
    override
    onlyRole(ADMIN) {
        require(_outBidPercentage > 0 && _outBidPercentage <= 10000,
            "Percentage representation must be between 1 and 10000");
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        mcs.outBidPercentage = _outBidPercentage;
        emit OutBidPercentageChanged(mcs.outBidPercentage);
    }

    /**
     * @notice The outBidPercentage getter
     */
    function getOutBidPercentage()
    external
    view
    override
    returns (uint16) {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        return mcs.outBidPercentage;
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
    override
    onlyRole(ADMIN) {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        require(_ticketerType != Ticketer.Default, "Invalid ticketer type.");
        require(_ticketerType != mcs.defaultTicketerType, "Type is already default.");
        mcs.defaultTicketerType = _ticketerType;
        emit DefaultTicketerTypeChanged(mcs.defaultTicketerType);
    }

    /**
     * @notice The defaultTicketerType getter
     */
    function getDefaultTicketerType()
    external
    view
    override
    returns (Ticketer) {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        return mcs.defaultTicketerType;
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
    override
    consignmentExists(_consignmentId)
    returns (address) {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
        Ticketer specified = mcs.consignmentTicketers[_consignmentId];
        Ticketer ticketerType = (specified == Ticketer.Default) ? mcs.defaultTicketerType : specified;
        return (ticketerType == Ticketer.Lots) ? mcs.lotsTicketer : mcs.itemsTicketer;
    }

    /**
     * @notice The nextConsignment getter
     * @dev does not increment counter
     */
    function getNextConsignment()
    external
    view
    override
    returns (uint256) {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
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
    view
    override
    consignmentExists(_consignmentId)
    returns (Consignment memory consignment) {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
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
    view
    override
    consignmentExists(_consignmentId)
    returns(uint256)
    {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
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
    view
    override
    consignmentExists(_consignmentId)
    returns(bool)
    {
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();
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
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();

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
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();

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
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();

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
        LibMarketController.MarketControllerStorage storage mcs = LibMarketController.marketControllerStorage();

        // Set the ticketer for the consignment if not different
        if (_ticketerType != mcs.consignmentTicketers[_consignmentId]) {

            // Set the ticketer for the consignment
            mcs.consignmentTicketers[_consignmentId] = _ticketerType;

            // Notify listeners of state change
            emit ConsignmentTicketerChanged(_consignmentId, _ticketerType);

        }
    }

}