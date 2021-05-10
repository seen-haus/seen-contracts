// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../governance/GovernableERC20.sol";

interface IWETH {
    function deposit() external payable;
}

interface Sushiswap {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

contract SeenHaus is GovERC20 {
    address public constant weth = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant sushiswap = 0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F;
    IERC20 public constant seen = IERC20(0xCa3FE04C7Ee111F0bbb02C328c699226aCf9Fd33);

    // accounts balances are locked for 3 days after entering
    mapping(address => uint256) locked;

    constructor() {
        IERC20(weth).approve(sushiswap, type(uint256).max);
    }

    function _beforeTokenTransfer(address from) internal view override {
        require(locked[from] <= block.timestamp, "transfer:too soon after minting");
    }

    // Enter the haus. Pay some SEENs. Earn some shares.
    function enter(uint256 _amount) public {
        uint256 totalSeen = seen.balanceOf(address(this));
        uint256 totalShares = totalSupply;

        locked[msg.sender] = block.timestamp + 3 days;

        if (totalShares == 0 || totalSeen == 0) {
            _mint(msg.sender, _amount);
        } else {
        uint256 what = _amount * totalShares / totalSeen;
            _mint(msg.sender, what);
        }
        seen.transferFrom(msg.sender, address(this), _amount);
    }

    // Leave the haus. Claim back your SEENs.
    function leave(uint256 _share) public {
        uint256 totalShares = totalSupply;
        uint256 what = _share * seen.balanceOf(address(this)) / totalShares;
        _burn(msg.sender, _share);
        seen.transfer(msg.sender, what);
    }

    function swap() public {
        IWETH(weth).deposit{value: address(this).balance}();
        uint256 amountIn = IERC20(weth).balanceOf(address(this));

        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = address(seen);

        Sushiswap(sushiswap).swapExactTokensForTokens(
            amountIn,
            0,
            path,
            address(this),
            block.timestamp
        );
    }

    receive() external payable {}

}