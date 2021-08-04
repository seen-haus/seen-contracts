// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "../interfaces/ISaleBuilder.sol";
import "../interfaces/ISaleRunner.sol";

/**
 * @title ISaleHandler
 * @author Cliff Hall
 * @notice Handles the creation, running, and disposition of Seen.Haus sales.
 */
interface ISaleHandler is ISaleBuilder, ISaleRunner {}