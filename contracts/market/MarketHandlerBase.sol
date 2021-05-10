// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

abstract contract MarketHandlerBase {

    address public _haus;
    uint256 public fee;

    constructor(address payable _haus, uint256 _fee) {
        haus = _haus;
        fee = _fee;
    }

    function updateFee(uint256 _fee) external onlyOwner {
        fee = _fee;
    }

    function updateHaus(uint256 _haus) external onlyOwner {
        haus = _haus;
    }


}