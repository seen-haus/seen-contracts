// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

contract SeenTypes {

    bytes4 internal constant INTERFACE_ID_2981 = 0x6057361d;

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
        uint256 lotSize;
        uint256 price;
        uint256 start;
    }

    enum Outcome {
        Closed,
        Pulled,
        Canceled,
    }

    enum Market {
        Primary,
        Secondary
    }

}
