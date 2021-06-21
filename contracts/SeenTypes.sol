// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

/**
 * @title SeenTypes
 * @author Cliff Hall
 * @notice Constants, enums, and structs used by the Seen.Haus contract ecosystem.
 */
contract SeenTypes {

    string public constant ESCROW_TICKET_URI_BASE = "https://seen.haus/escrowticket/";

    bytes4 public constant INTERFACE_ID_2981 = bytes4(keccak256("royaltyInfo(uint256,uint256)"));

    bytes32 public constant ADMIN = keccak256("ADMIN");                   // Deployer and any other admins as needed
    bytes32 public constant SELLER = keccak256("SELLER");                 // Whitelisted sellers amd Seen.Haus reps
    bytes32 public constant MINTER = keccak256("MINTER");                 // Whitelisted artists and Seen.Haus reps
    bytes32 public constant ESCROW_AGENT = keccak256("ESCROW_AGENT");     // Seen.Haus Physical Item Escrow Agent
    bytes32 public constant MARKET_HANDLER = keccak256("MARKET_HANDLER"); // Market Handler contracts

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

    struct Token {
        address payable creator;
        uint16 royaltyPercentage;
        bool isPhysical;
        uint256 supply;
        string uri;
    }

    struct Consignment {
        Market market;
        address payable seller;
        address tokenAddress;
        uint256 tokenId;
        uint256 id;
    }

    struct Auction {
        address payable buyer;
        uint256 consignmentId;
        uint256 start;
        uint256 duration;
        uint256 reserve;
        uint256 bid;
        Clock clock;
        State state;
        Outcome outcome;
    }

    struct Sale {
        uint256 consignmentId;
        uint256 start;
        uint256 quantity;
        uint256 price;
        uint256 perTxCap;
        State state;
        Outcome outcome;
    }

    struct EscrowTicket {
        uint256 tokenId;
        uint256 amount;
    }

}
