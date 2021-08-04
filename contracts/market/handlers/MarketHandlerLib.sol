// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../../interfaces/IMarketController.sol";
import "../../diamond/DiamondLib.sol";
import "../../domain/SeenTypes.sol";

/**
 * @title MarketHandlerLib
 *
 * @dev Provides access to the the MarketController Storage slot for MarketHandler facets
 *
 * @author Cliff Hall
 */
library MarketHandlerLib {

    bytes32 constant MARKET_HANDLER_STORAGE_POSITION = keccak256("haus.seen.market.handler.storage");

    struct MarketHandlerStorage {

        // the Seen.Haus MarketController
        IMarketController marketController;

        // map a consignment id to an audience
        mapping(uint256 => SeenTypes.Audience) audiences;

        //s map a consignment id to a sale
        mapping(uint256 => SeenTypes.Sale) sales;

        // @dev map a consignment id to an auction
        mapping(uint256 => SeenTypes.Auction) auctions;

        // AuctionBuilderFacet initialization state
        bool auctionBuilderFacetInitialized;

        // AuctionRunnerFacet initialization state
        bool auctionRunnerFacetInitialized;

        // SaleBuilderFacet initialization state
        bool saleBuilderFacetInitialized;

        // SaleRunnerFacet initialization state
        bool saleRunnerFacetInitialized;

    }

    function marketHandlerStorage() internal pure returns (MarketHandlerStorage storage mhs) {
        bytes32 position = MARKET_HANDLER_STORAGE_POSITION;
        assembly {
            mhs.slot := position
        }
    }

}