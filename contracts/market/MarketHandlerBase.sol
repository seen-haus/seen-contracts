// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../SeenTypes.sol";

abstract contract MarketHandlerBase is AccessControl, SeenTypes  {

    bytes32 public constant ADMIN = keccak256("ADMIN");
    bytes32 public constant SELLER = keccak256("SELLER");

    address payable public haus;
    address payable public multisig;
    uint256 public feePercentage;

    event FeeDisbursed(address indexed recipient, uint256 amount);
    event PayoutDisbursed(address indexed seller, uint256 amount);

    constructor(address payable _haus, address payable _multisig, uint256 _feePercentage) {
        haus = _haus;
        multisig = _multisig;
        fee = _feePercentage; // 0 - 100
        _setupRole(ADMIN, _msgSender());
        _setupRole(MINTER, _msgSender());
    }

    function updateFeePercentage(uint256 _feePercentage)
    external
    onlyRole(ADMIN) {
        feePercentage = _feePercentage;
    }

    function updateHaus(uint256 _haus)
    external
    onlyRole(ADMIN) {
        haus = _haus;
    }

    function updateMultisig(address payable _multisig)
    external
    onlyRole(ADMIN) {
        multisig = _multisig;
    }

    /**
     * @notice Disburse funds for a secondary market sale or auction
     *
     * @param _creator - the creator of the NFT
     * @param _amount - the final sale amount
     */
    function disburseFunds(Market _market, address payable _seller, uint256 _amount)
    internal virtual
    {
        uint256 net = _amount;
        if (_market == Market.secondary) {
            // TODO check if token contract supports ERC2981 interface
            // TODO if so, get royalty info, and set net to amount less royalty
        }

        uint256 fee = (net / 100) * feePercentage;
        uint256 split = fee / 2;
        uint256 payout = _amount - fee;

        haus.transfer(split);
        multisig.transfer(split);
        _seller.transfer(payout);

        emit FeeDisbursed(haus, split);
        emit FeeDisbursed(multisig, split);
        emit PayoutDisbursed(_seller, split);
    }

}