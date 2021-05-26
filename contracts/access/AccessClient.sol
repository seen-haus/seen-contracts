// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./AccessController.sol";
import "../SeenTypes.sol";

abstract contract AccessClient is SeenTypes  {

    // Events
    event AccessControllerAddressChanged(address indexed accessController);

    /// @notice the Seen.Haus AccessController
    IAccessControl public accessController;

    /**
     * @notice Constructor
     *
     * @param _accessController - the Seen.Haus AccessController
     */
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
        require(accessController.hasRole(role, msg.sender), "Access denied, caller doesn't have role");
        _;
    }

    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     */
    function grantRole(bytes32 role, address account) internal {
        accessController.grantRole(role, account);
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
        emit AccessControllerAddressChanged(_accessController);
    }

}