// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

/**
 * @title SeenConstants
 *
 * @notice Constants used by the Seen.Haus contract ecosystem.
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
contract SeenConstants {

    // Endpoint will serve dynamic metadata composed of ticket and ticketed item's info
    string internal constant ESCROW_TICKET_URI = "https://api.seen.haus/ticket/metadata/";

    // Access Control Roles
    bytes32 internal immutable ADMIN = keccak256("ADMIN");                   // Deployer and any other admins as needed
    bytes32 internal immutable SELLER = keccak256("SELLER");                 // Approved sellers amd Seen.Haus reps
    bytes32 internal immutable MINTER = keccak256("MINTER");                 // Approved artists and Seen.Haus reps
    bytes32 internal immutable ESCROW_AGENT = keccak256("ESCROW_AGENT");     // Seen.Haus Physical Item Escrow Agent
    bytes32 internal immutable MARKET_HANDLER = keccak256("MARKET_HANDLER"); // Market Handler contracts
    bytes32 internal immutable UPGRADER = keccak256("UPGRADER");             // Performs contract upgrades

}