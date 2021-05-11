// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

contract SeenTypes {

    struct Auction {
        address payable buyer;
        address payable seller;
        address token;
        uint256 tokenId;
        uint256 start;
        uint256 end;
        uint256 reserve;
        uint256 bid;
        bool closed;
    }

    struct Sale {
        address token;
        uint256 id;
        uint256 price;
        uint256 start;
    }

}
