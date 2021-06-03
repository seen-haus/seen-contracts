// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.0;

import "ds-test/test.sol";

import "./SeenHaus.sol";

interface Hevm {
    function warp(uint256) external;
    function roll(uint256) external;
    function store(address, bytes32, bytes32) external;
}

contract User {
    IERC20 public seen;
    SeenHaus public haus;

    constructor(address _seen, address payable _haus) {
        seen = IERC20(_seen);
        haus = SeenHaus(_haus);
        seen.approve(_haus, type(uint256).max);
    }

    function callEnter(uint256 _amount) public {
        haus.enter(_amount);
    }

    function callLeave(uint256 _share) public {
        haus.leave(_share);
    }

    function callTransfer(address _who, uint256 _amount) public {
        haus.transfer(_who, _amount);
    }
}

contract SeenHausTest is DSTest {
    Hevm public hevm;

    SeenHaus public haus;

    IERC20 public seen;

    User public user1;
    User public user2;

    function setUp() public {
        hevm = Hevm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
        haus = new SeenHaus();

        seen = IERC20(0xCa3FE04C7Ee111F0bbb02C328c699226aCf9Fd33);

        hevm.store(
            address(seen),
            keccak256(abi.encode(address(this), uint256(1))), // Mint us SEEN
            bytes32(uint256(10000000000000000000000))
        );

        user1 = new User(address(seen), payable(address(haus)));
        user2 = new User(address(seen), payable(address(haus)));

        seen.transfer(address(user1), 3000000000000000000000);
        seen.transfer(address(user2), 3000000000000000000000);
    }

    function test_enter() public {
        user1.callEnter(3000000000000000000000);
        assertTrue(haus.balanceOf(address(user1)) > 0);
    }

    function testFail_enter() public {
        user1.callEnter(4000000000000000000000);
    }

    function test_leave() public {
        user1.callEnter(3000000000000000000000);
        uint256 shares = haus.balanceOf(address(user1));
        hevm.warp(block.timestamp + 3 days);
        user1.callLeave(shares);
        assertEq(seen.balanceOf(address(user1)), 3000000000000000000000);
    }

    function testFail_leave() public {
        user1.callLeave(1);
    }

    function test_transfer() public {
        user1.callEnter(3000000000000000000000);
        hevm.warp(block.timestamp + 3 days);
        user1.callTransfer(address(user2), 100);
    }

    function test_transfer2() public {
        user1.callEnter(3000000000000000000000);
        hevm.warp(block.timestamp + 3 days);
        user1.callTransfer(address(user2), 100);
        user2.callTransfer(address(user1), 100);
    }

    function testFail_transfer() public {
        user1.callEnter(3000000000000000000000);
        hevm.warp(block.timestamp + 3 days - 1);
        user1.callTransfer(address(user2), 100);
    }

    function testFail_transfer2() public {
        user1.callEnter(1000000000000000000000);
        hevm.warp(block.timestamp + 3 days);
        user1.callTransfer(address(user2), 100);
        user1.callEnter(1000000000000000000000);
        user1.callTransfer(address(user2), 100);
    }

    function test_swapAndClaim() public {
        user1.callEnter(1000000000000000000000);
        user2.callEnter(3000000000000000000000);
        payable(address(haus)).transfer(5 ether);
        uint256 before = seen.balanceOf(address(haus));
        haus.swap();
        uint256 profit = seen.balanceOf(address(haus)) - before;
        assertTrue(profit > 0);
        hevm.warp(block.timestamp + 3 days);
        uint256 shares = haus.balanceOf(address(user1));
        user1.callLeave(shares);
        assertEq(seen.balanceOf(address(user1)), 3000000000000000000000 + (profit / 4));
        shares = haus.balanceOf(address(user2));
        user2.callLeave(shares);
        assertEq(seen.balanceOf(address(user2)), 3000000000000000000000 + profit - (profit / 4));
    }

    function test_enterSwapEnter() public {
        user1.callEnter(1000000000000000000000);
        payable(address(haus)).transfer(5 ether);
        haus.swap();
        user2.callEnter(1000000000000000000000);
        hevm.warp(block.timestamp + 3 days);
        uint256 shares = haus.balanceOf(address(user1));
        user1.callLeave(shares);
        shares = haus.balanceOf(address(user2));
        user2.callLeave(shares);
        assertTrue(seen.balanceOf(address(user1)) > seen.balanceOf(address(user2)));
    }
}
