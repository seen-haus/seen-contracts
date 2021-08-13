// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "../interfaces/IMarketController.sol";
import "../access/AccessClient.sol";

/**
 * @title MarketClient
 *
 * @notice Extended by non-facet contracts that need to communicate with the MarketController.
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
abstract contract MarketClient is AccessClient {

    // Events
    event MarketControllerAddressChanged(address indexed marketController);

    // The Seen.Haus MarketController
    IMarketController internal marketController;

    /**
     * @notice Constructor
     *
     * @param _marketController - the Seen.Haus MarketController
     */
    constructor(address _marketController) {
        marketController = IMarketController(_marketController);
    }

    /**
     * @notice Set the Seen.Haus MarketController
     *
     * Emits an MarketControllerAddressChanged event.
     *
     * @param _marketController - the Seen.Haus MarketController
     */
    function setMarketController(address _marketController)
    external onlyRole(ADMIN)
    {
        marketController = IMarketController(_marketController);
        emit MarketControllerAddressChanged(_marketController);
    }

    /**
     * @notice Gets the address of the Seen.Haus MarketController contract.
     *
     * @return the address of the MarketController contract
     */
    function getMarketController()
    public
    view
    returns(address)
    {
        return address(marketController);
    }

    /**
     * @notice Get a percentage of a given amount.
     *
     * N.B. Represent ercentage values are stored
     * as unsigned integers, the result of multiplying the given percentage by 100:
     * e.g, 1.75% = 175, 100% = 10000
     *
     * @param _amount - the amount to return a percentage of
     * @param _percentage - the percentage value represented as above
     */
    function getPercentageOf(uint256 _amount, uint16 _percentage)
    internal
    pure
    returns (uint256 share)
    {
        share = _amount * _percentage / 10000;
    }

}