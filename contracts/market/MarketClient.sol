// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "../access/AccessClient.sol";

abstract contract MarketClient is AccessClient, ERC1155Holder {

    // Events
    event RoyaltyDisbursed(Consignment indexed consignment, address indexed recipient, uint256 amount);
    event FeeDisbursed(Consignment indexed consignment, address indexed recipient, uint256 amount);
    event PayoutDisbursed(Consignment indexed consignment, address indexed recipient, uint256 amount);

    /// @notice the Seen.Haus MarketController
    address public marketController;

    /**
     * @notice Constructor
     *
     * @param _marketController - the Seen.Haus MarketController
     */
    constructor(address _marketController) {
        marketController = _marketController;
    }

    /**
     * @notice Deduct and pay royalties on sold secondary market consignments
     *
     * @param _consignment - the consigned item
     * @param _saleAmount - the final sale amount
     */
    function deductRoyalties(Consignment memory _consignment, uint256 _saleAmount)
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
                    uint256 maxRoyalty = (_saleAmount / 100) * marketController.maxRoyaltyPercentage;

                    // If a royalty is expected...
                    if (expected > 0) {

                        // Lets pay, but only up to our platform policy maximum
                        royaltyAmount = (expected <= maxRoyalty) ? expected : maxRoyalty;
                        recipient.transfer(royaltyAmount);

                        // Notify listeners of payment
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
    function deductFee(Consignment memory _consignment, uint256 _netAmount)
    internal
    returns (uint256 payout){

        // With the net after royalties, calculate and split
        // the auction fee between SEEN staking and multisig,
        uint256 feeAmount = (_netAmount / 100) * marketController.feePercentage;
        uint256 split = feeAmount / 2;
        address payable staking = marketController.staking;
        address payable multisig = marketController.multisig;
        staking.transfer(split);
        multisig.transfer(split);

        // Return the seller payout amount after fee deduction
        payout = _netAmount - feeAmount;

        // Notify listeners of payment
        emit FeeDisbursed(_consignment, staking, split);
        emit FeeDisbursed(_consignment, multisig, split);
    }

    /**
     * @notice Disburse funds for a sale or auction, primary or secondary
     *
     * @param _consignment - the consigned item
     * @param _saleAmount - the final sale amount
     */
    function disburseFunds(Consignment memory _consignment, uint256 _saleAmount)
    internal virtual
    {
        // Pay royalties if needed
        uint256 net = deductRoyalties(_consignment, _saleAmount);

        // Pay auction fee
        uint256 payout = deductFee(_consignment, net);

        // Pay seller
        _consignment.seller.transfer(payout);

        // Notify listeners of payment
        emit PayoutDisbursed(_consignment, _consignment.seller, payout);
    }

}