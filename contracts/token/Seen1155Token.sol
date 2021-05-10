// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Seen1155Tokens is AccessControl, ERC1155 {

    // Roles
    bytes32 public constant ADMIN = keccak256("ADMIN");
    bytes32 public constant MINTER = keccak256("MINTER");

    // Market handlers
    mapping(address => bool) public handlers;

    /**
     * Constructor
     * Grant both ADMIN and MINTER roles to deployer
     */
    constructor(string memory _baseURI) ERC1155(_baseURI) public {
        _setupRole(ADMIN, _msgSender());
        _setupRole(MINTER, _msgSender());
    }

    /**
     * List or de-list a market handler contract
     */
    function setHandlerStatus(address _handler, bool _whitelisted)
    external
    onlyRole(ADMIN) {
        if (!_whitelisted) {
            delete handlers[_handler];
        } else {
            handlers[_handler] = _whitelisted;
        }
    }

    /**
     * Mint a given supply of a token and send it to a whitelisted
     * market handler contract (auction, sale, etc.)
     */
    function mint(uint256 _id, uint256 _supply, address _handler)
    external
    onlyRole(MINTER) {
        require(handlers[_handler] == true, "Market handler not whitelisted");
        _mint(_handler, _id, _supply, new bytes(0x0));
    }
}