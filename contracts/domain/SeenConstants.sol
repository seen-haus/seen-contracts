// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

/**
 * @title SeenConstants
 * @author Cliff Hall
 * @notice Constants used by the Seen.Haus contract ecosystem.
 */
contract SeenConstants {

    // Endpoint will serve dynamic metadata composed of ticket and ticketed item's info
    string internal constant ESCROW_TICKET_URI = "https://seen.haus/ticket/metadata/";

    // Access Control Roles
    bytes32 internal constant ADMIN = keccak256("ADMIN");                   // Deployer and any other admins as needed
    bytes32 internal constant SELLER = keccak256("SELLER");                 // Whitelisted sellers amd Seen.Haus reps
    bytes32 internal constant MINTER = keccak256("MINTER");                 // Whitelisted artists and Seen.Haus reps
    bytes32 internal constant ESCROW_AGENT = keccak256("ESCROW_AGENT");     // Seen.Haus Physical Item Escrow Agent
    bytes32 internal constant MARKET_HANDLER = keccak256("MARKET_HANDLER"); // Market Handler contracts

}