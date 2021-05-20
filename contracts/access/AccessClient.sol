pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./AccessController.sol";
import "../SeenTypes.sol";

abstract contract AccessClient is SeenTypes  {

    IAccessControl public accessController;

    constructor(address _accessController) {
        accessController = IAccessControl(_accessController);
    }

    modifier onlyRole(bytes32 role) {
        require(accessController.hasRole(role, _msgSender(), "Access denied, caller doesn't have role"));
        _;
    }

}