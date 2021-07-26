// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;

/**
 * @title Diamond
 *
 * @notice Diamond Proxy based on Nick Mudge's gas-optimized diamond-2 reference.
 * Reference Implementation  : https://github.com/mudgen/diamond-2-hardhat
 * EIP-2535 Diamond Standard : https://eips.ethereum.org/EIPS/eip-2535
 *
 * @author Nick Mudge
 * @author Cliff Hall
 */

// Libraries
import { LibDiamond } from "./libraries/LibDiamond.sol";

// Interfaces
import { IAccessControl } from "./interfaces/IAccessControl.sol";
import { IDiamondLoupe } from "./interfaces/IDiamondLoupe.sol";
import { IDiamondCut } from "./interfaces/IDiamondCut.sol";
import { IERC165 } from "./interfaces/IERC165.sol";

contract Diamond {

    /**
     * @notice Constructor
     *
     * - Store the access controller
     * - Make the initial facet cuts
     * - Declare support for interfaces
     *
     * @param _accessController - the Seen.Haus AccessController
     * @param _facetCuts - the initial facet cuts to make
     * @param _interfaceIds - the initially supported ERC-165 interface ids
     */
    constructor(
        IAccessControl _accessController,
        IDiamondCut.FacetCut[] memory _facetCuts,
        bytes4[] memory _interfaceIds
    ) payable {

        // Get the DiamondStorage struct
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        // Set the AccessController instance
        ds.accessController = _accessController;

        // Cut the diamond with the given facets
        LibDiamond.diamondCut(_facetCuts, address(0), new bytes(0));

        // Add supported interfaces
        if (_interfaceIds.length > 0) {
            for (uint8 x = 0; x < _interfaceIds.length; x++) {
                ds.supportedInterfaces[_interfaceIds[x]] = true;
            }
        }

    }

    /**
     * @notice Onboard implementation of ERC-165 interface detection standard.
     *
     * Allows proper operation even with optional omission of DiamondLoupeFacet
     *
     * @param _interfaceId - the sighash of the given interface
     */
    function supportsInterface(bytes4 _interfaceId) external view returns (bool) {
        // Get the DiamondStorage struct
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        // Return the value
        return ds.supportedInterfaces[_interfaceId] || false;
    }

    /**
     * Fallback function. Called when the specified function doesn't exist
     *
     * Find facet for function that is called and execute the
     * function if a facet is found and returns any value.
     */
    fallback() external payable {

        // Get the DiamondStorage struct
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        // Make sure the function exists
        address facet = address(bytes20(ds.facets[msg.sig]));
        require(facet != address(0), "Diamond: Function does not exist");

        // Invoke the function with delagatecall
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
                case 0 {
                    revert(0, returndatasize())
                }
                default {
                    return(0, returndatasize())
                }
        }

    }

    /// Contract can receive ETH
    receive() external payable {}
}
