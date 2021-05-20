pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../SeenTypes.sol";

contract AccessController is AccessControl, SeenTypes  {

    constructor() {
        _setupRole(ADMIN, _msgSender());
        _setRoleAdmin(ADMIN, ADMIN);
        _setRoleAdmin(SELLER, ADMIN);
        _setRoleAdmin(MINTER, ADMIN);
        _setRoleAdmin(HANDLER, ADMIN);
    }

}