// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "../access/AccessClient.sol";

contract MarketController is AccessClient {

    /// @notice the address of the Seen.Haus staking contract
    address payable public staking;

    /// @notice the address of the Seen.Haus multi-sig wallet
    address payable public multisig;

    /// @notice the percentage that will be taken as a fee from the net of a Seen.Haus sale or auction (after royalties)
    uint8 public feePercentage;         // 0 - 100

    /// @notice The percentage of a Seen.Haus secondary sale that should go to the token's creator
    uint8 public royaltyPercentage;   // 0 - 100

    /// @notice the maximum percentage of a Seen.Haus sale or auction that will be paid as a royalty
    uint8 public maxRoyaltyPercentage;  // 0 - 100

    /// @notice the minimum percentage a Seen.Haus auction bid must be above the previous bid to prevail
    uint8 public outBidPercentage;      // 0 - 100

    /**
     * @notice Constructor
     *
     * @param _staking - Seen.Haus staking contract
     * @param _multisig - Seen.Haus multi-sig wallet
     * @param _feePercentage - percentage that will be taken as a fee from the net of a Seen.Haus sale or auction (after royalties)
     * @param _royaltyPercentage - percentage of a Seen.Haus secondary sale that should go to the token's creator
     * @param _maxRoyaltyPercentage - maximum percentage of a Seen.Haus sale or auction that will be paid as a royalty
     * @param _outBidPercentage - minimum percentage a Seen.Haus auction bid must be above the previous bid to prevail
     */
    constructor(
        address payable _staking,
        address payable _multisig,
        uint8 _feePercentage,
        uint8 _royaltyPercentage,
        uint8 _maxRoyaltyPercentage,
        uint8 _outBidPercentage
    ) {
        staking = _staking;
        multisig = _multisig;
        feePercentage = _feePercentage;
        royaltyPercentage = _royaltyPercentage;
        maxRoyaltyPercentage = _maxRoyaltyPercentage;
        outBidPercentage = _outBidPercentage;
    }

    function setHaus(uint8 _staking)
    external
    onlyRole(ADMIN) {
        staking = _staking;
    }

    function setMultisig(address payable _multisig)
    external
    onlyRole(ADMIN) {
        multisig = _multisig;
    }

    function setFeePercentage(uint8 _feePercentage)
    external
    onlyRole(ADMIN) {
        feePercentage = _feePercentage;
    }

    function setMaxRoyaltyPercentage(uint8 _maxRoyaltyPercentage)
    external
    onlyRole(ADMIN) {
        maxRoyaltyPercentage = _maxRoyaltyPercentage;
    }

    function setOutBidPercentage(uint8 _outBidPercentage)
    external
    onlyRole(ADMIN) {
        outBidPercentage = _outBidPercentage;
    }

}