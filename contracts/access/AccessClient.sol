pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./AccessController.sol";
import "../SeenTypes.sol";

abstract contract AccessClient is SeenTypes  {

    event AccessControllerAddressChanged(address indexed accessController);

    IAccessControl public accessController;

    constructor(address _accessController) {
        accessController = IAccessControl(_accessController);
    }

    /**
     * @dev Modifier that checks that the caller has a specific role.
     *
     * Reverts if caller doesn't have role.
     *
     * See: {AccessController.hasRole}
     */
    modifier onlyRole(bytes32 role) {
        require(accessController.hasRole(role, _msgSender(), "Access denied, caller doesn't have role"));
        _;
    }

    /**
     * @notice Sets the address of the Seen.Haus AccessController contract.
     *
     * Emits a AccessControllerAddressChanged event.
     *
     * @param _accessController - the address of the AccessController contract
     */
    function setAccessController(address _accessController)
    external
    onlyRole(ADMIN) {
        accessController = IAccessControl(_accessController);
        emit AccessControllerAddressChanged(accessController);
    }

}