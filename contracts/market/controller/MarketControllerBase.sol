// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.5;

import "./MarketControllerLib.sol";
import "../../domain/SeenTypes.sol";

/**
 * @title MarketControllerBase
 * @author Cliff Hall
 * @notice Provides domain, initializer, modifiers to MarketController facets
 */
abstract contract MarketControllerBase is SeenTypes {

    /**
     * @dev Modifier that checks that the consignment exists
     *
     * Reverts if the consignment does not exist
     */
    modifier consignmentExists(uint256 _consignmentId) {

        MarketControllerLib.MarketControllerStorage storage mcs = MarketControllerLib.marketControllerStorage();

        // Make sure the consignment exists
        require(_consignmentId < mcs.nextConsignment, "Consignment does not exist");
        _;
    }

    /**
     * @dev Modifier that checks that the caller has a specific role.
     *
     * Reverts if caller doesn't have role.
     *
     * See: {AccessController.hasRole}
     */
    modifier onlyRole(bytes32 _role) {
        MarketControllerLib.MarketControllerStorage storage mcs = MarketControllerLib.marketControllerStorage();
        require(mcs.accessController.hasRole(_role, msg.sender), "Access denied, caller doesn't have role");
        _;
    }

}