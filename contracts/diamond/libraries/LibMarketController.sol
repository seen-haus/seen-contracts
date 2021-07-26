// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;

/**
 * @title LibMarketController
 *
 * @author Cliff Hall
 */
import "../interfaces/IAccessControl.sol";
import "../../domain/SeenTypes.sol";

library LibMarketController {

    bytes32 constant MARKET_CONTROLLER_STORAGE_POSITION = keccak256("haus.seen.market.controller.storage");

    struct MarketControllerStorage {

        // the Seen.Haus AccessController
        IAccessControl accessController;

        // the address of the Seen.Haus NFT contract
        address nft;

        // the address of the xSEEN ERC-20 Seen.Haus staking contract
        address payable staking;

        // the address of the Seen.Haus multi-sig wallet
        address payable multisig;

        // address of the Seen.Haus lots-based escrow ticketing contract
        address lotsTicketer;

        // address of the Seen.Haus items-based escrow ticketing contract
        address itemsTicketer;

        // the default escrow ticketer type to use for physical consignments unless overridden with setConsignmentTicketer
        SeenTypes.Ticketer defaultTicketerType;

        // the minimum amount of xSEEN ERC-20 a caller must hold to participate in VIP events
        uint256 vipStakerAmount;

        // the percentage that will be taken as a fee from the net of a Seen.Haus sale or auction (after royalties)
        uint16 feePercentage;         // 1.75% = 175, 100% = 10000

        // the maximum percentage of a Seen.Haus sale or auction that will be paid as a royalty
        uint16 maxRoyaltyPercentage;  // 1.75% = 175, 100% = 10000

        // the minimum percentage a Seen.Haus auction bid must be above the previous bid to prevail
        uint16 outBidPercentage;      // 1.75% = 175, 100% = 10000

        // next consignment id
        uint256 nextConsignment;

        // consignment id => consignment
        mapping(uint256 => SeenTypes.Consignment) consignments;

        // consignmentId to consignor address
        mapping(uint256 => address) consignors;

        // consignment id => ticketer type
        mapping(uint256 => SeenTypes.Ticketer) consignmentTicketers;

    }

    function marketControllerStorage() internal pure returns (MarketControllerStorage storage mcs) {
        bytes32 position = MARKET_CONTROLLER_STORAGE_POSITION;
        assembly {
            mcs.slot := position
        }
    }

}
