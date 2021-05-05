// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.0;

import "ds-test/test.sol";

import "./ERC1155AuctionHouse.sol";

import "./OpenZeppelin/ERC20/ERC20Burnable.sol";

interface Hevm {
    function warp(uint256) external;
    function roll(uint256) external;
    function store(address, bytes32, bytes32) external;
}

contract ERC1155t is ERC1155Burnable {
    constructor() ERC1155("http://testing.xyz") {

    }

    function mint(uint256 id, uint256 amount) external {
        _mint(_msgSender(), id, amount, new bytes(0x0));
    }
}

contract Haus is ERC20 {
    uint256 tes;

    constructor() ERC20("SeenHaus", "xSEEN") {
        tes = 1;
        _mint(msg.sender, 100);
    }

    function callUpdateMinSeen(address _house, uint256 _amount) public {
        AuctionHouse(_house).updateMinSeen(_amount);
    }

    receive() external payable {}
}

contract Seller is ERC1155Holder {
    ERC1155t public test1155;

    constructor(address _addr, address _house) {
        test1155 = ERC1155t(_addr);
        test1155.mint(1, 1);
        test1155.mint(2, 1);
        test1155.mint(3, 1);

        test1155.setApprovalForAll(address(_house), true);
    }

    receive() external payable {}
}

contract Bidder is ERC1155Holder {
    AuctionHouse public house;

    constructor(address _house) {
        house = AuctionHouse(_house);
    }

    function callBid(uint256 _id) public payable {
        house.bid{value: msg.value}(_id);
    }

    receive() external payable {}
}

contract AuctionHouseTest is DSTest, ERC1155Holder {
    Hevm public hevm;
    AuctionHouse public house;

    Bidder public bidder1;
    Bidder public bidder2;
    Bidder public bidder3;

    Haus public haus;
    Seller public seller;

    // ERC20Burnable test20;
    ERC1155t public test1155;

    function setUp() public {
        hevm = Hevm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
        haus = new Haus();
        house = new AuctionHouse(payable(address(haus)), 150, 0);

        test1155 = new ERC1155t();

        seller = new Seller(address(test1155), address(house));

        haus.transfer(address(seller), 10);

        house.newAuction(payable(address(seller)), address(test1155), 1, block.timestamp, block.timestamp + 1, 1 ether);
        house.newAuction(payable(address(seller)), address(test1155), 2, block.timestamp, block.timestamp + 1, 1 ether);

        bidder1 = new Bidder(address(house));
        payable(address(bidder1)).transfer(10 ether);
        bidder2 = new Bidder(address(house));
        payable(address(bidder2)).transfer(10 ether);
        bidder3 = new Bidder(address(house));
        payable(address(bidder3)).transfer(10 ether);


        bidder1.callBid{value: 2 ether}(0);
    }

    function test_bid() public {
        uint256 bal = address(bidder1).balance;
        bidder2.callBid{value: 3 ether}(0);

        // make sure bidder got their money back
        assertEq(bal + 2 ether, address(bidder1).balance);

        // end the auction
        hevm.warp(block.timestamp + 1);
        house.close(0);

        // check everyone got the right stuff
        assertEq(450000000000000000, address(haus).balance);

        assertEq(2550000000000000000, address(seller).balance);
        assertEq(0, address(house).balance);
        bal = test1155.balanceOf(address(bidder2), 1);
        assertEq(bal, 1);
    }

    function testFail_bid() public {
        bidder2.callBid{value: 2.01 ether}(0);
    }

    function testFail_tooEarlyClose() public {
        uint256 bal = address(bidder1).balance;
        bidder2.callBid{value: 3 ether}(0);

        // make sure bidder got their money back
        assertEq(bal + 2 ether, address(bidder1).balance);

        // end the auction
        house.close(0);
    }

    function testFail_noPull() public {
        uint256 bal = address(bidder1).balance;
        bidder2.callBid{value: 3 ether}(0);

        // make sure bidder got their money back
        assertEq(bal + 2 ether, address(bidder1).balance);

        // end the auction
        house.pull(0);
    }

    function test_noBid() public {
        // end the auction
        hevm.warp(block.timestamp + 1);
        house.pull(1);

        uint256 bal = test1155.balanceOf(address(seller), 2);
        assertEq(bal, 1);
    }

    function testFail_noClose() public {
        // end the auction
        hevm.warp(block.timestamp + 1);
        house.close(1);
    }

    function testFail_notEnoughSeen() public {
        haus.callUpdateMinSeen(address(house), 11000);
        house.newAuction(payable(address(seller)), address(test1155), 3, block.timestamp, block.timestamp + 1, 1 ether);
    }

    receive() external payable {}
}
