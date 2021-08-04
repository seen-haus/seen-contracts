// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "./IMarketConfig.sol";
import "./IMarketClerk.sol";

/**
 * @title IMarketController
 * @author Cliff Hall
 *
 * @notice Manages configuration and consignments used by the Seen.Haus contract suite.
 *
 * The ERC-165 identifier for this interface is: 0xe5f2f941 // TODO make sure this is still correct
 */
interface IMarketController is IMarketConfig, IMarketClerk {

}