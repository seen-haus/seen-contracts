// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../../access/AccessClient.sol";

/**
 * This ticket contract represents the right to claim a specified
 * quantity of a physical consignment, bought in a sale or auction.
 *
 * Example: 1/1 painting. Clearly indivisible, qty = 1
 * Example: 20/500 tee-shirts. Also indivisible, qty = 20 of 500 made
 *
 * Since this is an ERC721 implementation, the holder must
 * claim, sell, or transfer the entire lot of the ticketed
 * items at once.
 *
 * N.B.: This contract disincentivizes whale behavior, e.g., a person
 * scooping up a bunch of the available items in a multi-edition
 * sale must flip or claim them all at once, not individually.
 */
contract TransferableLot is AccessClient, ERC721 {

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
    constructor(string memory _name, string memory _symbol)
    AccessClient(_accessController)
    MarketClient(_marketController)
    ERC721(_name, _symbol) public {
        token = IERC1155(token);
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