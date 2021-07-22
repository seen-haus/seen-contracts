// SPDX-License-Identifier: MIT
pragma solidity ^0.8.5;

/**
 * @title DiamondCutFacet
 *
 * @notice DiamondCut facet based on Nick Mudge's gas-optimized diamond-2 reference.
 * Reference Implementation  : https://github.com/mudgen/diamond-2-hardhat
 * EIP-2535 Diamond Standard : https://eips.ethereum.org/EIPS/eip-2535
 *
 * @author Nick Mudge
 * @author Cliff Hall
 */
import { IDiamondCut } from "../interfaces/IDiamondCut.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";
import { SeenTypes } from"../../domain/SeenTypes.sol";

contract DiamondCutFacet is SeenTypes, IDiamondCut {

    /**
     * @notice Cut facets of the Diamond
     *
     * Add/replace/remove any number of function selectors
     *
     * If populated, _calldata is executed with delegatecall on _init
     *
     * @param _facetCuts Contains the facet addresses and function selectors
     * @param _init The address of the contract or facet to execute _calldata
     * @param _calldata A function call, including function selector and arguments
     */
    function diamondCut( FacetCut[] calldata _facetCuts, address _init, bytes calldata _calldata)
    external override
    {
        // Get the diamond storage slot
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        // Ensure the caller has the ADMIN role
        ds.accessController.hasRole(ADMIN, msg.sender);

        // Determine how many existing selectors we have
        uint256 originalSelectorCount = ds.selectorCount;
        uint256 selectorCount = originalSelectorCount;
        bytes32 selectorSlot;

        // TODO: Demystify these operations. @mudgen?
        // Check if last selector slot is full
        if (selectorCount & 7 > 0) {
            // get last selectorSlot
            selectorSlot = ds.selectorSlots[selectorCount >> 3];
        }
        
        // Cut the facets
        for (uint256 facetIndex; facetIndex < _facetCuts.length; facetIndex++) {
            (selectorCount, selectorSlot) = LibDiamond.addReplaceRemoveFacetSelectors(
                selectorCount,
                selectorSlot,
                _facetCuts[facetIndex].facetAddress,
                _facetCuts[facetIndex].action,
                _facetCuts[facetIndex].functionSelectors
            );
        }

        // Update the selector count if it changed
        if (selectorCount != originalSelectorCount) {
            ds.selectorCount = uint16(selectorCount);
        }

        // Update last selector slot
        if (selectorCount & 7 > 0) {
            ds.selectorSlots[selectorCount >> 3] = selectorSlot;
        }

        // Notify listeners of state change
        emit DiamondCut(_facetCuts, _init, _calldata);

        // Initialize the facet
        LibDiamond.initializeDiamondCut(_init, _calldata);
    }
}
