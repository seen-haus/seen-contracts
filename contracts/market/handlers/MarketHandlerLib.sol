// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/IMarketController.sol";
import "../../domain/SeenTypes.sol";
import "../diamond/DiamondLib.sol";

/**
 * @title MarketHandlerLib
 *
 * @dev Provides access to the the MarketHandler Storage and Intitializer slots for MarketHandler facets
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
library MarketHandlerLib {

    bytes32 constant MARKET_HANDLER_STORAGE_POSITION = keccak256("seen.haus.market.handler.storage");
    bytes32 constant MARKET_HANDLER_INITIALIZERS_POSITION = keccak256("seen.haus.market.handler.initializers");

    struct MarketHandlerStorage {

        // map a consignment id to an audience
        mapping(uint256 => SeenTypes.Audience) audiences;

        //s map a consignment id to a sale
        mapping(uint256 => SeenTypes.Sale) sales;

        // @dev map a consignment id to an auction
        mapping(uint256 => SeenTypes.Auction) auctions;

    }

    struct MarketHandlerInitializers {

        // AuctionBuilderFacet initialization state
        bool auctionBuilderFacet;

        // AuctionRunnerFacet initialization state
        bool auctionRunnerFacet;

        // AuctionEnderFacet initialization state
        bool auctionEnderFacet;

        // SaleBuilderFacet initialization state
        bool saleBuilderFacet;

        // SaleRunnerFacet initialization state
        bool saleRunnerFacet;

        // SaleRunnerFacet initialization state
        bool saleEnderFacet;

    }

    function marketHandlerStorage() internal pure returns (MarketHandlerStorage storage mhs) {
        bytes32 position = MARKET_HANDLER_STORAGE_POSITION;
        assembly {
            mhs.slot := position
        }
    }

    function marketHandlerInitializers() internal pure returns (MarketHandlerInitializers storage mhi) {
        bytes32 position = MARKET_HANDLER_INITIALIZERS_POSITION;
        assembly {
            mhi.slot := position
        }
    }

}