// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// TODO: possibly use AccessControl instead of Ownable so an artist role could also mint
contract Seen1155Tokens is Ownable, ERC1155 {

    constructor(string memory _baseURI) ERC1155(_baseURI) public {}

    // Whitelisted market
    mapping(address => bool) public handlers;

    /**
     * List or de-list a market handler contract
     */
    function setHandlerStatus(address _handler, bool _whitelisted)
    external
    onlyOwner {
        handlers[_handler] = _whitelisted;
    }

    /**
     * Mint a given supply of a token and send it to a whitelisted
     * market handler contract (auction, sale, etc.)
     */
    function mint(uint256 _id, uint256 _supply, address _handler)
    external
    onlyOwner {
        require(handlers[_handler] == true, "Market handler not whitelisted");
        _mint(_handler, _id, _supply, new bytes(0x0));
    }
}