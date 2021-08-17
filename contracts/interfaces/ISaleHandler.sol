// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "../interfaces/ISaleBuilder.sol";
import "../interfaces/ISaleRunner.sol";

/**
 * @title ISaleHandler
 *
 * @notice Handles the creation, running, and disposition of Seen.Haus sales.
 *
 * The ERC-165 identifier for this interface is: 0x6164b6a0
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
interface ISaleHandler is ISaleBuilder, ISaleRunner {}