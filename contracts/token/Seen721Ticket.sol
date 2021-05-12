// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * This ticket contract represents the right to claim a certain
 * number of a physical item, bought in a sale or auction.
 *
 * Since this is an ERC721 implementation, the holder must
 * claim, sell, or transfer all of the balance of the
 * ticketed items at once.
 *
 * N.B.: This contract disincentivizes whale behavior, e.g., a person
 * scooping up a bunch of the available items in a multi-edition
 * sale must flip or claim them all at once, not individually.
 */
contract Seen721Ticket is AccessControl, ERC721 {

    // Roles
    bytes32 public constant ADMIN = keccak256("ADMIN");
    bytes32 public constant MINTER = keccak256("MINTER");

    // Ticket structure
    struct Ticket {
        uint256 tokenId;
        uint256 amount;
    }

    // Ticket ID => Ticket
    mapping (uint256 => Ticket) tickets;

    // Next ticket number
    uint256 public nextTicket;

    // The token contract that this contract issues tickets against
    IERC11155 public token;

    /**
     * Constructor
     * Grant MINTER role to deployer
     */
    constructor(string memory _baseURI, address _token) ERC1155(_baseURI) public {
        token = IERC1155(token);
        _setupRole(ADMIN, _msgSender());
        _setupRole(MINTER, _msgSender());
        _setRoleAdmin(MINTER, ADMIN);
    }

    /**
     * Mint a ticket and send it to the buyer
     */
    function mint(uint256 _tokenId, uint256 _amount, address _buyer)
    external
    onlyRole(MINTER) {
        require(_amount > 0, "Ticket amount cannot be zero");
        uint256 ticketId = nextTicket++;
        Ticket ticket = new Ticket(_tokenId, _amount);
        _mint(_buyer, _tokenId, _amount, new bytes(0x0));
    }

    /**
     * Burn a ticket
     * TODO: Currently caller is responsible for also transferring the proof of ownership token balance.
     * Possibly have sale contract approved to do both, and the redeem function is there.
     */
    function burn(uint256 _ticketId)
    external {
        require(_exists(_ticketId), "Invalid ticket id");
        require(ownerOf(_ticketId) == _msgSender(), "Caller not ticket holder");
        _burn(_msgSender(), _ticketId);
   }

}