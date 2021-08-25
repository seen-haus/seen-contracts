// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

/**
 * @title SeenStaking
 *
 * @notice Mock Seen staking contract for Unit Testing
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
contract SeenStaking {

    mapping(address => uint256) internal balances;

    /**
      * @notice Sets the balance for a mock staker address.
      *
      * @param _staker - the address of the staker
      * @param _balance - the balance for the staker
      */
    function setStakerBalance(address _staker, uint256 _balance)
    external
    {
        balances[_staker] = _balance;
    }

    /**
     * @notice The faux ERC-20 balanceOf implementation
     */
    function balanceOf(address _staker)
    external
    view
    returns (uint256) {
        return balances[_staker];
    }

    receive() external payable {}

}