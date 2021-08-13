// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { SeenConstants } from "../../../domain/SeenConstants.sol";
import { IDiamondCut } from "../../../interfaces/IDiamondCut.sol";
import { DiamondLib } from "../DiamondLib.sol";
import { JewelerLib } from "../JewelerLib.sol";

/**
 * @title DiamondCutFacet
 *
 * @notice DiamondCut facet based on Nick Mudge's gas-optimized diamond-2 reference.
 * Reference Implementation  : https://github.com/mudgen/diamond-2-hardhat
 * EIP-2535 Diamond Standard : https://eips.ethereum.org/EIPS/eip-2535
 *
 * @author Nick Mudge <nick@perfectabstractions.com> (https://twitter.com/mudgen)
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
contract DiamondCutFacet is SeenConstants, IDiamondCut {

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
    function diamondCut(FacetCut[] calldata _facetCuts, address _init, bytes calldata _calldata)
    external
    override
    {
        // Get the diamond storage slot
        DiamondLib.DiamondStorage storage ds = DiamondLib.diamondStorage();

        // Ensure the caller has the ADMIN role
        ds.accessController.hasRole(ADMIN, msg.sender);

        // Determine how many existing selectors we have
        uint256 originalSelectorCount = ds.selectorCount;
        uint256 selectorCount = originalSelectorCount;
        bytes32 selectorSlot;

        // Check if last selector slot is full
        if (selectorCount & 7 > 0) {
            // get last selectorSlot
            selectorSlot = ds.selectorSlots[selectorCount >> 3];
        }
        
        // Cut the facets
        for (uint256 facetIndex; facetIndex < _facetCuts.length; facetIndex++) {
            (selectorCount, selectorSlot) = JewelerLib.addReplaceRemoveFacetSelectors(
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
        JewelerLib.initializeDiamondCut(_init, _calldata);

    }
}
