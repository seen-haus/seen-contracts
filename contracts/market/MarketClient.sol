// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "../access/AccessClient.sol";
import "./MarketController.sol";
import "./IMarketController.sol";


abstract contract MarketClient is AccessClient, ERC1155Holder {

    // Events
    event RoyaltyDisbursed(uint256 indexed consignmentId, address indexed recipient, uint256 amount);
    event FeeDisbursed(uint256 indexed consignmentId, address indexed recipient, uint256 amount);
    event PayoutDisbursed(uint256 indexed consignmentId, address indexed recipient, uint256 amount);
    event AudienceChanged(uint256 indexed consignmentId, Audience indexed audience);
    event MarketControllerAddressChanged(address indexed marketController);

    /// @notice the Seen.Haus MarketController
    IMarketController public marketController;

    /// @notice map a consignment id to an audience
    mapping(uint256 => Audience) public audiences;

    /**
     * @notice Constructor
     *
     * @param _marketController - the Seen.Haus MarketController
     */
    constructor(address _marketController) {
        marketController = IMarketController(_marketController);
    }

    /**
     * @notice Set the Seen.Haus MarketController
     *
     * Emits an MarketControllerAddressChanged event.
     *
     * @param _marketController - the Seen.Haus MarketController
     */
    function setMarketController(address _marketController)
    external onlyRole(ADMIN)
    {
        marketController = IMarketController(_marketController);
        emit MarketControllerAddressChanged(_marketController);
    }

    /**
 * @notice Sets the audience for a consignment at sale or auction.
 *
 * Emits an AudienceChanged event.
 *
 * @param _consignmentId - the id of the consignment
 * @param _audience - the new audience for the consignment
 */
    function setAudience(uint256 _consignmentId, Audience _audience)
    internal
    {

        // Set the new audience
        audiences[_consignmentId] = _audience;

        // Notify listeners of state change
        emit AudienceChanged(_consignmentId, _audience);

    }

    /**
     * @notice Check if the caller is a Staker.
     *
     * @return status - true if caller's xSEEN ERC-20 balance is non-zero.
     */
    function isStaker()
    internal
    returns (bool status)
    {
        status = IERC20(marketController.getStaking()).balanceOf(msg.sender) > 0;
    }

    /**
     * @notice Check if the caller is a VIP Staker.
     *
     * See {MarketController:vipStakerAmount}
     *
     * @return status - true if caller's xSEEN ERC-20 balance is at least equal to the VIP Staker Amount.
     */
    function isVipStaker()
    internal
    returns (bool status)
    {
        status = IERC20(marketController.getStaking()).balanceOf(msg.sender) >= marketController.getVipStakerAmount();
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
            try IERC165(_consignment.token).supportsInterface(INTERFACE_ID_2981) returns (bool supported) {

                // If so, find out the who to pay and how much
                if (supported == true) {

                    // Get the royalty recipient and expected payment
                    (address recipient, uint256 expected,) = IERC2981(_consignment.token).royaltyInfo(_consignment.tokenId, _grossSale, "");

                    // Determine the max royalty we will pay
                    uint256 maxRoyalty = (_grossSale / 100) * marketController.getMaxRoyaltyPercentage();

                    // If a royalty is expected...
                    if (expected > 0) {

                        // Lets pay, but only up to our platform policy maximum
                        royaltyAmount = (expected <= maxRoyalty) ? expected : maxRoyalty;
                        payable(recipient).transfer(royaltyAmount);

                        // Notify listeners of payment
                        emit RoyaltyDisbursed(_consignment.id, recipient, royaltyAmount);
                    }

                }

            // Any case where the check for interface support fails can be ignored
            } catch Error(string memory reason) {
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
        uint256 feeAmount = (_netAmount / 100) * marketController.getFeePercentage();
        uint256 split = feeAmount / 2;
        address payable staking = marketController.getStaking();
        address payable multisig = marketController.getMultisig();
        staking.transfer(split);
        multisig.transfer(split);

        // Return the seller payout amount after fee deduction
        payout = _netAmount - feeAmount;

        // Notify listeners of payment
        emit FeeDisbursed(_consignment.id, staking, split);
        emit FeeDisbursed(_consignment.id, multisig, split);
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
     * @param _consignmentId - the id of the consignment being sold
     * @param _saleAmount - the gross sale amount
     */
    function disburseFunds(uint256 _consignmentId, uint256 _saleAmount)
    internal virtual
    {
        // Get consignment
        Consignment memory consignment = marketController.getConsignment(_consignmentId);

        // Pay royalties if needed
        uint256 net = deductRoyalties(consignment, _saleAmount);

        // Pay marketplace fee
        uint256 payout = deductFee(consignment, net);

        // Pay seller
        consignment.seller.transfer(payout);

        // Notify listeners of payment
        emit PayoutDisbursed(_consignmentId, consignment.seller, payout);
    }

}