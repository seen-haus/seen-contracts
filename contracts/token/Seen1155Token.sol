// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Seen1155Token is AccessControl, ERC1155 {

    // Roles
    bytes32 public constant MINTER = keccak256("MINTER");

    // id => creator
    mapping (uint256 => address) public creators;

    /**
     * Constructor
     * Grant MINTER role to deployer
     */
    constructor(string memory _baseURI) ERC1155(_baseURI) public {
        _setupRole(MINTER, _msgSender());
    }

    /**
     * Mint a given supply of a token and send it to a whitelisted
     * market handler contract (auction, sale, etc.)
     */
    function mint(uint256 _id, uint256 _supply, address _creator)
    external
    onlyRole(MINTER) {
        require(creators[_id] == address(0x0), "Token already exists");
        require(_supply > 0, "Token supply cannot be zero");
        creators[_id] = _creator;
        _mint(_creator, _id, _supply, new bytes(0x0));
    }
}