// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

contract SeenTypes {

    bytes4 public constant INTERFACE_ID_2981 = 0x6057361d;

    bytes32 public constant ADMIN = keccak256("ADMIN");
    bytes32 public constant SELLER = keccak256("SELLER");
    bytes32 public constant MINTER = keccak256("MINTER");
    bytes32 public constant ESCROW_AGENT = keccak256("ESCROW_AGENT");
    bytes32 public constant MARKET_HANDLER = keccak256("MARKET_HANDLER");

    enum Market {
        Primary,
        Secondary
    }

    enum Clock {
        Live,
        Trigger
    }

    enum Audience {
        Open,
        Staker,
        VipStaker
    }

    enum Outcome {
        Pending,
        Closed,
        Pulled,
        Canceled
    }

    enum State {
        Pending,
        Running,
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
        Clock clock;
        State state;
        Outcome outcome;
    }

    struct Sale {
        uint256 start;
        uint256 lotSize;
        uint256 itemPrice;
        uint256 maxBuy;
        State state;
        Outcome outcome;
    }

}
