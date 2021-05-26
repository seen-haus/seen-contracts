// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "../../../market/MarketClient.sol";
import "../IEscrowHandler.sol";

/**
 * Holders of this ticket have the right to transfer or claim a
 * given number of a physical consignment, escrowed by Seen.Haus.
 *
 * Since this is an ERC155 implementation, the holder can
 * sell / transfer part or all of the balance of their ticketed
 * items rather than claim them all.
 *
 * N.B.: This contract supports piece-level reseller behavior,
 * e.g., an entity scooping up a bunch of the available items
 * in a multi-edition sale with the purpose of flipping each
 * item individually to make maximum profit.
 */
contract HandleAsItems is IEscrowHandler, MarketClient, ERC1155 {

    // Ticket ID => Ticket
    mapping (uint256 => IEscrowHandler) tickets;

    /// @dev Next ticket number
    uint256 public nextTicket;

    /**
     * @notice Constructor
     *
     * @param _accessController - the Seen.Haus AccessController
     * @param _marketController - the Seen.Haus MarketController
     * @param _baseURI - base URI for all tokens, with {id} embedded for token id replacement
     */
    constructor(address _accessController, address _marketController, string memory _baseURI)
    AccessClient(_accessController)
    MarketClient(_marketController)
    ERC1155(_baseURI)
    {}

    /**
     * Issue an escrow ticket to the buyer
     *
     * For tangible consignments, Seen.Haus must hold physical items in escrow
     * until the buyer(s) claim them.
     *
     * When a buyer wins an auction or makes a purchase in a sale, the market
     * handler contract they interacted with will call this method to issue an
     * escrow ticket, which is an NFT that can be sold, transferred, or claimed.
     *
     * @param _tokenId - the token id on the Seen.Haus NFT contract
     * @param _amount - the amount of the given token to escrow
     * @param _buyer - the buyer of the escrowed item(s) to whom the ticket is issued
     */
    function issueTicket(uint256 _tokenId, uint256 _amount, address payable _buyer)
    external override
    onlyRole(MARKET_HANDLER) {

        // Create and store escrow ticket
        uint256 ticketId = nextTicket++;
        EscrowTicket memory ticket = new EscrowTicket(_tokenId, _amount);
        tickets[ticketId] = ticket;

        // Mint escrow ticket and send to buyer
        _mint(_buyer, ticketId, _amount, new bytes(0x0));
    }

    /**
     * Claim escrowed items associated with the ticket.
     *
     * @param _ticketId - the ticket representing the escrowed item(s)
     */
    function claim(uint256 _ticketId) external override {
        uint256 amount = balanceOf(msg.sender, _ticketId);
        require(amount > 0, "Caller has no balance for this ticket");

        // Get the ticket
        EscrowTicket memory ticket = tickets[_ticketId];

        // Burn the caller's balance
        _burn(msg.sender, _ticketId, amount, new bytes(0x0));

        // Transfer the ERC-1155 to escrow contract
        marketController.nft().safeTransferFrom(
            address(this),
            msg.sender,
            ticket.tokenId(),
            amount,
            new bytes(0x0)
        );
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155,ERC1155Receiver) returns (bool) {
        return interfaceId == type(IERC165).interfaceId;
    }

}