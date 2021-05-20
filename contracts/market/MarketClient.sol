// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "../access/AccessClient.sol";
import "./MarketController.sol";

abstract contract MarketClient is AccessClient, ERC1155Holder {

    // Events
    event RoyaltyDisbursed(Consignment indexed consignment, address indexed recipient, uint256 amount);
    event FeeDisbursed(Consignment indexed consignment, address indexed recipient, uint256 amount);
    event PayoutDisbursed(Consignment indexed consignment, address indexed recipient, uint256 amount);
    event AudienceChanged(Consignment indexed consignment, Audience indexed audience);
    event MarketControllerAddressChanged(address indexed marketController);

    /// @notice the Seen.Haus MarketController
    MarketController public marketController;

    /// @notice map a consignment to an audience
    mapping(Consignment => Audience) public audiences;

    /**
     * @notice Constructor
     *
     * @param _marketController - the Seen.Haus MarketController
     */
    constructor(address _marketController) {
        marketController = MarketController(_marketController);
    }

    /**
     * @notice Sets the audience for a consignment at sale or auction.
     *
     * Emits an AudienceChanged event.
     *
     * @param _consignment - the unique consignment being sold
     * @param _audience - the new audience for the consignment
     */
    function setMarketController(address _marketController)
    external onlyRole(ADMIN)
    {
        marketController = MarketController(_marketController);
        emit MarketControllerAddressChanged(marketController);
    }

    /**
     * @notice Sets the audience for a consignment at sale or auction.
     *
     * Emits an AudienceChanged event.
     *
     * @param _consignment - the unique consignment being sold
     * @param _audience - the new audience for the consignment
     */
    function setAudience(Consignment memory _consignment, Audience _audience)
    internal
    {

        // Set the new audience
        audiences[_consignment] = _audience;

        // Notify listeners of state change
        emit AudienceChanged(_consignment, _audience);

    }

    /**
     * @notice Check if the caller is a Staker.
     *
     * @returns boolean - true if caller's xSEEN ERC-20 balance is non-zero.
     */
    function isStaker()
    internal
    returns (bool status)
    {
        status = IERC20(marketController.staking()).balanceOf(_msgSender()) > 0;
    }

    /**
     * @notice Check if the caller is a VIP Staker.
     *
     * See {MarketController:vipStakerAmount}
     *
     * @returns boolean - true if caller's xSEEN ERC-20 balance is at least equal to the VIP Staker Amount.
     */
    function isVipStaker()
    internal
    returns (bool status)
    {
        status = IERC20(marketController.staking()).balanceOf(_msgSender()) >= marketController.vipStakerAmount();
    }

    /**
     * @notice Deduct and pay royalties on sold secondary market consignments.
     *
     * Does nothing is this is a primary market sale.
     *
     * If the consigned item's contract supports NFT Royalty Standard EIP-2981,
     * it is queried for the expected royalty amount and recipient.
     *
     * Deducts royalty and pays to recipient:
     * - entire expected amount, if below or equal to the marketplace's maximum royalty percentage
     * - the marketplace's maximum royalty percentage {see: MarketController.maxRoyaltyPercentage}
     *
     * Emits a RoyaltyDisbursed event with the amount actually paid.
     *
     * @param _consignment - the consigned item
     * @param _grossSale - the gross sale amount
     *
     * @return net - the net amount of the sale after the royalty has been paid
     */
    function deductRoyalties(Consignment memory _consignment, uint256 _grossSale)
    internal
    returns (uint256 net)
    {

        uint256 royaltyAmount = 0;

        // Only pay royalties on secondary market sales
        if (_consignment.market == Market.Secondary) {

            // Determine if NFT contract supports NFT Royalty Standard EIP-2981
            try IERC165(consignment.token).supportsInterface(INTERFACE_ID_2981) returns (bool supports) {

                // If so, find out the who to pay and how much
                if (supports == true) {

                    // Get the royalty recipient and expected payment
                    (address payable recipient, uint256 expected,) = royaltyInfo(Consignment.tokenId, _grossSale, 0x0);

                    // Determine the max royalty we will pay
                    uint256 maxRoyalty = (_grossSale / 100) * marketController.maxRoyaltyPercentage();

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
        net = _grossSale - royaltyAmount;
    }

    /**
     * @notice Deduct and pay fee on a sold consignment.
     *
     * Deducts marketplace fee and pays:
     * - Half to the staking contract
     * - Half to the multisig contract
     *
     * Emits a FeeDisbursed event for staking payment.
     * Emits a FeeDisbursed event for multisig payment.
     *
     * @param _consignment - the consigned item
     * @param _netAmount - the net amount after royalties
     *
     * @return payout - the payout amount for the seller
     */
    function deductFee(Consignment memory _consignment, uint256 _netAmount)
    internal
    returns (uint256 payout)
    {

        // With the net after royalties, calculate and split
        // the auction fee between SEEN staking and multisig,
        uint256 feeAmount = (_netAmount / 100) * marketController.feePercentage();
        uint256 split = feeAmount / 2;
        address payable staking = marketController.staking();
        address payable multisig = marketController.multisig();
        staking.transfer(split);
        multisig.transfer(split);

        // Return the seller payout amount after fee deduction
        payout = _netAmount - feeAmount;

        // Notify listeners of payment
        emit FeeDisbursed(_consignment, staking, split);
        emit FeeDisbursed(_consignment, multisig, split);
    }

    /**
     * @notice Disburse funds for a sale or auction, primary or secondary.
     *
     * Disburses funds in this order
     * - Pays any necessary royalties first. See {deductRoyalties}
     * - Deducts and distributes marketplace fee. See {deductFee}
     * - Pays the remaining amount to the seller.
     *
     * Emits a PayoutDisbursed event on success.
     *
     * @param _consignment - the consigned item
     * @param _saleAmount - the gross sale amount
     */
    function disburseFunds(Consignment memory _consignment, uint256 _saleAmount)
    internal virtual
    {
        // Pay royalties if needed
        uint256 net = deductRoyalties(_consignment, _saleAmount);

        // Pay marketplace fee
        uint256 payout = deductFee(_consignment, net);

        // Pay seller
        _consignment.seller.transfer(payout);

        // Notify listeners of payment
        emit PayoutDisbursed(_consignment, _consignment.seller, payout);
    }

}