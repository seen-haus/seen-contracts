// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * This ticket contract represents the right to claim a certain
 * number of a physical item, bought in a sale or auction.
 *
 * Since this is an ERC155 implementation, the holder can
 * sell / transfer part or all of the balance of their ticketed
 * items rather than claim them all.
 *
 * Claiming some or all of their ticket balance burns that
 * amount.
 *
 * N.B.: This contract supports whale behavior, e.g., a person
 * scooping up a bunch of the available items in a multi-edition
 * sale with the purpose of flipping them individually later.
 */
contract Seen1155Ticket is AccessControl, ERC1155 {

    // Roles
    bytes32 public constant ADMIN = keccak256("ADMIN");
    bytes32 public constant MINTER = keccak256("MINTER");

    // The token contract that this contract issues tickets against
    IERC11155 public token;

    /**
     * Constructor
     * Grant MINTER role to deployer
     */
    constructor(string memory _baseURI, address _token) ERC1155(_baseURI) public {
        token = IERC1155(_token);
        _setupRole(ADMIN, _msgSender());
        _setupRole(MINTER, _msgSender());
        _setRoleAdmin(MINTER, ADMIN);
    }

    /**
     * Mint a ticket with the given amount of a claim token and send it to the buyer
     */
    function mint(uint256 _id, uint256 _amount, address _buyer)
    external
    onlyRole(MINTER) {
        require(_amount > 0, "Ticket amount cannot be zero");
        _mint(_buyer, _id, _amount, new bytes(0x0));
    }

    /**
     * Burn a ticket
     * TODO: Currently caller is responsible for also transferring the proof of ownership tokens.
     * Possibly have sale contract approved to do both, and the redeem function is there.
     */
    function burn(uint256 _id, uint256 _amount)
    external {
        require(balanceOf(_msgSender(), _id) >= _amount, "Claim amount is greater than ticket holder's balance");
        _burn(_msgSender(), _id, _amount, new bytes(0x0));
    }

}