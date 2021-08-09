// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title JewelerLib
 *
 * Facet management functions
 *
 * @notice Diamond library based on Nick Mudge's gas-optimized diamond-2 reference.
 * Reference Implementation  : https://github.com/mudgen/diamond-2-hardhat
 * EIP-2535 Diamond Standard : https://eips.ethereum.org/EIPS/eip-2535
 *
 * @author Nick Mudge
 * @author Cliff Hall
 */

// Libraries
import { DiamondLib } from "./DiamondLib.sol";

// Interfaces
import { IDiamondCut } from "../interfaces/IDiamondCut.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

library JewelerLib {

    event DiamondCut(IDiamondCut.FacetCut[] _diamondCut, address _init, bytes _calldata);

    bytes32 internal constant CLEAR_ADDRESS_MASK = bytes32(uint256(0xffffffffffffffffffffffff));
    bytes32 internal constant CLEAR_SELECTOR_MASK = bytes32(uint256(0xffffffff << 224));
    bytes32 internal constant ADMIN = keccak256("ADMIN");

    /**
     * @notice Cut facets of the Diamond
     *
     * Add/replace/remove any number of function selectors
     *
     * If populated, _calldata is executed with delegatecall on _init
     *
     * N.B. This is an internal function version of diamondCut. The code is almost
     * the same as that of DiamondCutFacet, except it uses 'Facet[] memory _facetCuts'
     * instead of 'Facet[] calldata _facetCuts'. The code is duplicated to prevent
     * copying _calldata to memory which causes an error for a two dimensional array.
     *
     * @param _facetCuts Contains the facet addresses and function selectors
     * @param _init The address of the contract or facet to execute _calldata
     * @param _calldata A function call, including function selector and arguments
     */
    function diamondCut(
        IDiamondCut.FacetCut[] memory _facetCuts,
        address _init,
        bytes memory _calldata
    ) internal {

        // Get the diamond storage slot
        DiamondLib.DiamondStorage storage ds = DiamondLib.diamondStorage();

        // Ensure the caller has the ADMIN role
        require(ds.accessController.hasRole(ADMIN, msg.sender), "Caller must have ADMIN role");

        // Determine how many existing selectors we have
        uint256 originalSelectorCount = ds.selectorCount;
        uint256 selectorCount = originalSelectorCount;
        bytes32 selectorSlot;

        // Check if last selector slot is full
        // N.B.: selectorCount & 7 is a gas-efficient equivalent to selectorCount % 8
        if (selectorCount & 7 > 0) {

            // get last selectorSlot
            // N.B.: selectorCount >> 3 is a gas-efficient equivalent to selectorCount / 8
            selectorSlot = ds.selectorSlots[selectorCount >> 3];

        }

        // Cut the facets
        for (uint256 facetIndex; facetIndex < _facetCuts.length; facetIndex++) {
            (selectorCount, selectorSlot) = addReplaceRemoveFacetSelectors(
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
        // N.B.: selectorCount & 7 is a gas-efficient equivalent to selectorCount % 8
        if (selectorCount & 7 > 0) {

            // N.B.: selectorCount >> 3 is a gas-efficient equivalent to selectorCount / 8
            ds.selectorSlots[selectorCount >> 3] = selectorSlot;

        }

        // Notify listeners of state change
        emit DiamondCut(_facetCuts, _init, _calldata);

        // Initialize the facet
        initializeDiamondCut(_init, _calldata);
    }

    /**
     * @notice Maintain the selectors in a FacetCut
     *
     * N.B. This method is unbelievably long and dense.
     * It hails from the diamond-2 reference and works
     * under test.
     *
     * I've added comments to try and reason about it,
     * Still, "magic happens here" moments need illumination.
     *
     * - CLH
     *
     * @param _selectorCount - the current selectorCount
     * @param _selectorSlot - the selector slot
     * @param _newFacetAddress - the facet address of the new or replacement function
     * @param _action - the action to perform. See: {IDiamondCut.FacetCutAction}
     * @param _selectors - the selectors to modify
     */
    function addReplaceRemoveFacetSelectors(
        uint256 _selectorCount,
        bytes32 _selectorSlot,
        address _newFacetAddress,
        IDiamondCut.FacetCutAction _action,
        bytes4[] memory _selectors
    ) internal returns (uint256, bytes32) {

        // Make sure there are some selectors to work with
        DiamondLib.DiamondStorage storage ds = DiamondLib.diamondStorage();
        require(_selectors.length > 0, "LibDiamondCut: No selectors in facet to cut");

        // Add a selector
        if (_action == IDiamondCut.FacetCutAction.Add) {

            // Make sure facet being added has code
            enforceHasContractCode(_newFacetAddress, "LibDiamondCut: Add facet has no code");

            // Iterate selectors
            for (uint256 selectorIndex; selectorIndex < _selectors.length; selectorIndex++) {

                // Make sure function doesn't already exist
                bytes4 selector = _selectors[selectorIndex];
                bytes32 oldFacet = ds.facets[selector];
                require(address(bytes20(oldFacet)) == address(0), "LibDiamondCut: Can't add function that already exists");

                // add facet for selector
                ds.facets[selector] = bytes20(_newFacetAddress) | bytes32(_selectorCount);
                uint256 selectorInSlotPosition = (_selectorCount & 7) << 5;

                // clear selector position in slot and add selector
                _selectorSlot = (_selectorSlot & ~(CLEAR_SELECTOR_MASK >> selectorInSlotPosition)) | (bytes32(selector) >> selectorInSlotPosition);

                // if slot is full then write it to storage
                if (selectorInSlotPosition == 224) {
                    ds.selectorSlots[_selectorCount >> 3] = _selectorSlot;
                    _selectorSlot = 0;
                }

                // Increment selector count
                _selectorCount++;
            }

        // Replace a selector
        } else if (_action == IDiamondCut.FacetCutAction.Replace) {

            // Make sure replacement facet has code
            enforceHasContractCode(_newFacetAddress, "LibDiamondCut: Replace facet has no code");

            // Iterate selectors
            for (uint256 selectorIndex; selectorIndex < _selectors.length; selectorIndex++) {

                // Make sure function doesn't already exist
                bytes4 selector = _selectors[selectorIndex];
                bytes32 oldFacet = ds.facets[selector];
                address oldFacetAddress = address(bytes20(oldFacet));

                // only useful if immutable functions exist
                require(oldFacetAddress != address(this), "LibDiamondCut: Can't replace immutable function");
                require(oldFacetAddress != _newFacetAddress, "LibDiamondCut: Can't replace function with same function");
                require(oldFacetAddress != address(0), "LibDiamondCut: Can't replace function that doesn't exist");

                // replace old facet address
                ds.facets[selector] = (oldFacet & CLEAR_ADDRESS_MASK) | bytes20(_newFacetAddress);

            }

        // Remove a selector
        } else if (_action == IDiamondCut.FacetCutAction.Remove) {

            // Make sure facet address is zero address
            require(_newFacetAddress == address(0), "LibDiamondCut: Remove facet address must be address(0)");

            // Get the selector slot count and index to selector in slot
            uint256 selectorSlotCount = _selectorCount >> 3;
            uint256 selectorInSlotIndex = _selectorCount & 7;

            // Iterate selectors
            for (uint256 selectorIndex; selectorIndex < _selectors.length; selectorIndex++) {

                // Get previous selector slot, wrapping around to last from zero
                if (_selectorSlot == 0) {
                    selectorSlotCount--;
                    _selectorSlot = ds.selectorSlots[selectorSlotCount];
                    selectorInSlotIndex = 7;
                } else {
                    selectorInSlotIndex--;
                }
                bytes4 lastSelector;
                uint256 oldSelectorsSlotCount;
                uint256 oldSelectorInSlotPosition;

                // Remove selector, swapping in with last selector in last slot
                // N.B. adding a block here prevents stack too deep error
                {
                    // get selector and facet, making sure it exists
                    bytes4 selector = _selectors[selectorIndex];
                    bytes32 oldFacet = ds.facets[selector];
                    require(address(bytes20(oldFacet)) != address(0), "LibDiamondCut: Can't remove function that doesn't exist");

                    // only useful if immutable functions exist
                    require(address(bytes20(oldFacet)) != address(this), "LibDiamondCut: Can't remove immutable function");

                    // replace selector with last selector in ds.facets
                    // gets the last selector
                    lastSelector = bytes4(_selectorSlot << (selectorInSlotIndex << 5));
                    if (lastSelector != selector) {
                        // update last selector slot position info
                        ds.facets[lastSelector] = (oldFacet & CLEAR_ADDRESS_MASK) | bytes20(ds.facets[lastSelector]);
                    }
                    delete ds.facets[selector];
                    uint256 oldSelectorCount = uint16(uint256(oldFacet));
                    oldSelectorsSlotCount = oldSelectorCount >> 3;
                    oldSelectorInSlotPosition = (oldSelectorCount & 7) << 5;
                }

                // Update selector slot if count changed
                if (oldSelectorsSlotCount != selectorSlotCount) {

                    bytes32 oldSelectorSlot = ds.selectorSlots[oldSelectorsSlotCount];

                    // clears the selector we are deleting and puts the last selector in its place.
                    oldSelectorSlot =
                        (oldSelectorSlot & ~(CLEAR_SELECTOR_MASK >> oldSelectorInSlotPosition)) |
                        (bytes32(lastSelector) >> oldSelectorInSlotPosition);

                    // update storage with the modified slot
                    ds.selectorSlots[oldSelectorsSlotCount] = oldSelectorSlot;

                } else {
                    // clears the selector we are deleting and puts the last selector in its place.
                    _selectorSlot =
                        (_selectorSlot & ~(CLEAR_SELECTOR_MASK >> oldSelectorInSlotPosition)) |
                        (bytes32(lastSelector) >> oldSelectorInSlotPosition);
                }

                // delete selector
                if (selectorInSlotIndex == 0) {
                    delete ds.selectorSlots[selectorSlotCount];
                    _selectorSlot = 0;
                }
            }

            // Update selector count
            _selectorCount = selectorSlotCount * 8 + selectorInSlotIndex;

        }

        // return updated selector count and selector slot for
        return (_selectorCount, _selectorSlot);
    }

    /**
     * @notice Call a facet's initializer
     *
     * @param _init - the address of the facet to be initialized
     * @param _calldata - the
     */
    function initializeDiamondCut(address _init, bytes memory _calldata) internal {

        // If _init is not populated, then _calldata must also be unpopulated
        if (_init == address(0)) {
            require(_calldata.length == 0, "LibDiamondCut: _init is address(0) but_calldata is not empty");


        } else {

            // Revert if _calldata is not populated
            require(_calldata.length > 0, "LibDiamondCut: _calldata is empty but _init is not address(0)");

            // Make sure address to be initialized has code
            if (_init != address(this)) {
                enforceHasContractCode(_init, "LibDiamondCut: _init address has no code");
            }

            // If _init and _calldata are populated, call initializer
            (bool success, bytes memory error) = _init.delegatecall(_calldata);

            // Handle result
            if (!success) {
                if (error.length > 0) {
                    // bubble up the error
                    revert(string(error));
                } else {
                    revert("LibDiamondCut: _init function reverted");
                }
            }

        }
    }

    /**
     * @notice make sure the given address has code
     *
     * Reverts if address has no contract code
     *
     * @param _contract - the contract to check
     * @param _errorMessage - the revert reason to throw
     */
    function enforceHasContractCode(address _contract, string memory _errorMessage) internal view {
        uint256 contractSize;
        assembly {
            contractSize := extcodesize(_contract)
        }
        require(contractSize > 0, _errorMessage);
    }
}
