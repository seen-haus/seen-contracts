// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "../domain/SeenTypes.sol";
import "./IMarketHandler.sol";
import "./IAuctionBuilder.sol";
import "./IAuctionRunner.sol";


/**
 * @title IAuctionHandler
 * @author Cliff Hall
 * @notice Handles the creation, running, and disposition of Seen.Haus auctions.
 *
 * The ERC-165 identifier for this interface is: // TODO: find interface id
 */
interface IAuctionHandler is IAuctionBuilder, IAuctionRunner {

}