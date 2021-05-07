// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./GovernableERC20.sol";

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

contract SeenHaus is GovERC20, Ownable, Pausable {

    // Collaborators
    address public weth;
    address public sushiswap;
    IERC20 public seen;

    // accounts balances are locked for 3 days after entering 
    mapping(address => uint256) locked;

    // Start contract paused until collaborators can be set
    constructor() {
        _pause();
    }

    // Set collaborators
    function setCollaborators(address _weth, address _sushiswap, address _seen) external onlyOwner {
        weth = _weth;
        sushiswap = _sushiswap;
        seen = IERC20(_seen);
        IERC20(weth).approve(sushiswap, type(uint256).max);
        _unpause();
    }

    function _beforeTokenTransfer(address from) internal view override {
        require(locked[from] <= block.timestamp, "transfer:too soon after minting");
    }

    // Enter the haus. Pay some SEENs. Earn some shares.
    function enter(uint256 _amount) external whenNotPaused {
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
    function leave(uint256 _share) external whenNotPaused {
        uint256 totalShares = totalSupply;
        uint256 what = _share * seen.balanceOf(address(this)) / totalShares;
        _burn(msg.sender, _share);
        seen.transfer(msg.sender, what);
    }

    function swap() public whenNotPaused {

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