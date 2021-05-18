// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

contract SeenTypes {

    bytes4 internal constant INTERFACE_ID_2981 = 0x6057361d;

    enum Market {
        Primary,
        Secondary
    }

    enum Style {
        Live,       // countdown starts at start time
        Trigger     // countdown triggered by first bid
    }

    enum Outcome {
        Pending,
        Closed,
        Pulled,
        Canceled
    }

    enum State {
        Pending,
        Live,
        Ended
    }

    struct Consignment {
        Market market;
        address payable seller;
        address token;
        uint256 tokenId;
    }

    struct Auction {
        address payable buyer;
        uint256 start;
        uint256 duration;
        uint256 reserve;
        uint256 bid;
        Style style;
        State state;
        Outcome outcome;
    }

    struct Sale {
        uint256 lotSize;
        uint256 price;
        uint256 start;
    }

}
