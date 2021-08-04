// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../domain/SeenConstants.sol";

/**
 * @title AccessController
 * @author Cliff Hall
 * @notice Implements centralized role-based access for Seen.Haus contracts.
 */
contract AccessController is AccessControl, SeenConstants  {

    /**
     * @notice Constructor
     *
     * Grants ADMIN role to deployer.
     * Sets ADMIN as role admin for all other roles.
     */
    constructor() {
        _setupRole(ADMIN, msg.sender);
        _setRoleAdmin(ADMIN, ADMIN);
        _setRoleAdmin(SELLER, ADMIN);
        _setRoleAdmin(MINTER, ADMIN);
        _setRoleAdmin(ESCROW_AGENT, ADMIN);
        _setRoleAdmin(MARKET_HANDLER, ADMIN);
    }

}