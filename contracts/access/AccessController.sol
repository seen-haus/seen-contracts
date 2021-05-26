// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../SeenTypes.sol";

contract AccessController is SeenTypes, AccessControl  {

    constructor() {
        _setupRole(ADMIN, msg.sender);
        _setRoleAdmin(ADMIN, ADMIN);
        _setRoleAdmin(SELLER, ADMIN);
        _setRoleAdmin(MINTER, ADMIN);
        _setRoleAdmin(ESCROW_AGENT, ADMIN);
        _setRoleAdmin(MARKET_HANDLER, ADMIN);
    }

}