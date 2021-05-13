// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

contract SeenTypes {

    struct Consignment {
        Market market;
        address payable seller;
        address token;
        uint256 tokenId;
    }

    struct Auction {
        address payable buyer;
        uint256 start;
        uint256 end;
        uint256 reserve;
        uint256 bid;
        bool closed;
    }

    struct Sale {
        uint256 price;
        uint256 lotSize;
        uint256 start;
    }

    enum Market {
        Primary,
        Secondary
    }

}
