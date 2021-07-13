// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.5;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./AccessController.sol";
import "../domain/SeenTypes.sol";

/**
 * @title AccessClient
 * @author Cliff Hall
 * @notice Extended by Seen.Haus contracts that need centralized role-based access.
 * See {AccessController}
 */
abstract contract AccessClient is SeenTypes  {

    // Events
    event AccessControllerAddressChanged(address indexed accessController);

    /// @notice the Seen.Haus AccessController
    IAccessControl internal accessController;

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

    /**
     * @notice Gets the address of the Seen.Haus AccessController contract.
     *
     * @return the address of the AccessController contract
     */
    function getAccessController()
    public
    view
    returns(address) {
        return address(accessController);
    }

}