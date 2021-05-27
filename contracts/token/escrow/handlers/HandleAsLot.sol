// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../../../access/AccessClient.sol";
import "../../../market/MarketClient.sol";
import "../IEscrowHandler.sol";

/**
 * Holders of this ticket have the right to transfer or claim a
 * given number of a physical consignment, escrowed by Seen.Haus.
 *
 * Example: 1/1 painting. Indivisible, lot = 1
 * Example: 20/500 tee-shirts. Indivisible, lot = 20 of 500
 *
 * Since this is an ERC721 implementation, the holder must
 * claim, sell, or transfer the entire lot of the ticketed
 * items at once.
 *
 * N.B.: This contract disincentivizes whale behavior, e.g., a person
 * scooping up a bunch of the available items in a multi-edition
 * sale must flip or claim them all at once, not individually.
 */
contract HandleAsLot is IEscrowHandler, MarketClient, ERC721 {

    // Ticket ID => Ticket
    mapping (uint256 => EscrowTicket) tickets;

    /// @dev Next ticket number
    uint256 public nextTicket;

    string public constant NAME = "Seen.Haus Escrowed Lot Ticket";
    string public constant SYMBOL = "ESCROW_TICKET";

    /**
     * @notice Constructor
     *
     * @param _accessController - the Seen.Haus AccessController
     * @param _marketController - the Seen.Haus MarketController
     */
    constructor(address _accessController, address _marketController)
    AccessClient(_accessController)
    MarketClient(_marketController)
    ERC721(NAME, SYMBOL)
    {}

    /**
     * Mint an escrow ticket
     *
     * @param _tokenId - the token id on the Seen.Haus NFT contract
     * @param _amount - the amount of the given token to escrow
     */
    function issueTicket(uint256 _tokenId, uint256 _amount, address payable _buyer)
    external override
    onlyRole(MARKET_HANDLER) {

        // Create and store escrow ticket
        uint256 ticketId = nextTicket++;
        EscrowTicket storage ticket = tickets[ticketId];
        ticket.tokenId = _tokenId;
        ticket.amount = _amount;

        // Mint the ticket and send to the buyer
        _mint(_buyer, ticketId);
    }

    /**
      * Claim the escrowed items associated with the ticket.
      *
      * @param _ticketId - the ticket representing the escrowed items
      */
    function claim(uint256 _ticketId)
    external override
    {
        require(_exists(_ticketId), "Invalid ticket id");
        require(ownerOf(_ticketId) == msg.sender, "Caller not ticket holder");

        // Get the ticket
        EscrowTicket memory ticket = tickets[_ticketId];

        // Burn the ticket
        _burn(_ticketId);

        // Transfer the proof of ownership NFT to the caller
        IERC1155 nft = IERC1155(marketController.getNft());
        nft.safeTransferFrom(
            address(this),
            msg.sender,
            ticket.tokenId,
            ticket.amount,
            new bytes(0x0)
        );

    }

    function supportsInterface(bytes4 interfaceId)
    public pure override(ERC721,ERC1155Receiver)
    returns (bool)
    {
        return interfaceId == type(IERC165).interfaceId;
    }

}