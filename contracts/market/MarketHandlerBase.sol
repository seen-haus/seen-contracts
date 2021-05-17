// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "../SeenTypes.sol";

contract MarketHandlerBase is AccessControl, SeenTypes  {

    bytes32 public constant ADMIN = keccak256("ADMIN");
    bytes32 public constant SELLER = keccak256("SELLER");

    address payable public haus;
    address payable public multisig;
    uint256 public feePercentage;
    uint256 public maxRoyaltyPercentage;

    event RoyaltyDisbursed(Consignment indexed consignment, address indexed recipient, uint256 amount);
    event FeeDisbursed(Consignment indexed consignment, address indexed recipient, uint256 amount);
    event PayoutDisbursed(Consignment indexed consignment, address indexed recipient, uint256 amount);

    constructor(address payable _haus, address payable _multisig, uint256 _feePercentage, uint256 _maxRoyaltyPercentage) {
        haus = _haus;
        multisig = _multisig;
        feePercentage = _feePercentage; // 0 - 100
        maxRoyaltyPercentage = _maxRoyaltyPercentage; // 0 - 100
        _setupRole(ADMIN, _msgSender());
        _setupRole(MINTER, _msgSender());
    }

    function updateFeePercentage(uint256 _feePercentage)
    external
    onlyRole(ADMIN) {
        feePercentage = _feePercentage;
    }

    function updateMaxRoyaltyPercentage(uint256 _maxRoyaltyPercentage)
    external
    onlyRole(ADMIN) {
        maxRoyaltyPercentage = _maxRoyaltyPercentage;
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
     * @notice Deduct and pay royalties on sold secondary market consignments
     *
     * @param _consignment - the consigned item
     * @param _saleAmount - the final sale amount
     */
    function deductRoyalties(Consignment _consignment, uint256 _saleAmount)
    internal
    returns (uint256 net){

        uint256 royaltyAmount = 0;

        // Only pay royalties on secondary market sales
        if (_consignment.market == Market.Secondary) {

            // Determine if NFT contract supports NFT Royalty Standard EIP-2981
            try IERC165(consignment.token).supportsInterface(INTERFACE_ID_2981) returns (bool supports) {

                // If so, find out the who to pay and how much
                if (supports == true) {

                    // Get the royalty recipient and expected payment
                    (address payable recipient, uint256 expected,) = royaltyInfo(Consignment.tokenId, _saleAmount, 0x0);

                    // Determine the max royalty we will pay
                    uint256 maxRoyalty = (_saleAmount / 100) * maxRoyaltyPercentage;

                    // If we got a royalty amount, lets pay it, up to our platform policy maximum
                    if (expected > 0) {
                        royaltyAmount = (expected <= maxRoyalty) ? expected : maxRoyalty;
                        recipient.transfer(royaltyAmount);
                        emit RoyaltyDisbursed(_consignment, recipient, royaltyAmount);
                    }

                }

            // Any case where the check for interface support fails can be ignored
            } catch Error(string memory reason) {
            } catch Panic(uint errorCode) {
            } catch (bytes memory lowLevelData) {
            }

        }

        // Return the net amount after royalty deduction
        net = _saleAmount - royaltyAmount;
    }

    /**
     * @notice Deduct and pay fee on a sold consignment
     *
     * @param _consignment - the consigned item
     * @param _netAmount - the net amount after royalties
     */
    function deductFee(Consignment _consignment, uint256 _netAmount)
    internal
    returns (uint256 payout){

        // With the net after royalties, calculate and split
        // the auction fee between SEEN staking and multisig,
        uint256 feeAmount = (_netAmount / 100) * feePercentage;
        uint256 split = feeAmount / 2;
        haus.transfer(split);
        multisig.transfer(split);

        emit FeeDisbursed(_consignment, haus, split);
        emit FeeDisbursed(_consignment, multisig, split);

        // Return the seller payout amount after fee deduction
        payout = _netAmount - feeAmount;

    }

    /**
     * @notice Disburse funds for a sale or auction, primary or secondary
     *
     * @param _consignment - the consigned item
     * @param _saleAmount - the final sale amount
     */
    function disburseFunds(Consignment _consignment, uint256 _saleAmount)
    internal virtual
    {
        // Pay royalties if needed
        uint256 net = deductRoyalties(_consignment, _saleAmount);

        // Pay auction fee
        uint256 payout = deductFee(_consignment, net);

        // Pay seller
        consignment.seller.transfer(payout);
        emit PayoutDisbursed(_consignment, _consignment.seller, payout);
    }

}