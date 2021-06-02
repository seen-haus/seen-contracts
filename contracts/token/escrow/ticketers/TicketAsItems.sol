// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "../../../market/MarketClient.sol";
import "../../../util/StringUtils.sol";
import "../IEscrowTicketer.sol";

/**
 * @title TicketAsItems
 * @author Cliff Hall
 * @notice An escrow ticketer contract implemented with ERC-1155.
 *
 * Holders of this style of ticket have the right to transfer or
 * claim a given number of a physical consignment, escrowed by
 * Seen.Haus.
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
contract TicketAsItems is StringUtils, IEscrowTicketer, MarketClient, ERC1155 {

    // Ticket ID => Ticket
    mapping (uint256 => EscrowTicket) tickets;

    /// @dev Next ticket number
    uint256 public nextTicket;

    /**
     * @notice Constructor
     *
     * @param _accessController - the Seen.Haus AccessController
     * @param _marketController - the Seen.Haus MarketController
     */
    constructor(address _accessController, address _marketController)
    AccessClient(_accessController)
    MarketClient(_marketController)
    ERC1155(ESCROW_TICKET_URI_BASE)
    {}

    /**
     * @notice Get the token URI
     *
     * This method is overrides the Open Zeppelin version, returning
     * a unique endpoint address on the seen.haus site for each token id.
     *
     * Tickets are transient and will be burned when claimed to obtain
     * proof of ownership NFTs with their metadata on IPFS as usual.
     *
     * TODO: Create a dynamic endpoint on the web for generating the JSON
     * Just needs to call this contract: tickets(tokenId) and create JSON
     * with a fixed name, description, and image, adding these fields
     *  - token: [SeenHausNFT contract address]
     *  - tokenId: [the token id from EscrowTicket]
     *  - amount: [the amount of that token this ticket can claim]
     *
     * @param _tokenId - the ticket's token id
     * @return tokenURI - the URI for the given token id's metadata
     */
    function uri(uint256 _tokenId)
    public pure override
    returns (string memory)
    {
        string memory id = uintToStr(_tokenId);
        return strConcat(ESCROW_TICKET_URI_BASE, id);
    }

    /**
     * Issue an escrow ticket to the buyer
     *
     * For physical consignments, Seen.Haus must hold the items in escrow
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
        EscrowTicket storage ticket = tickets[ticketId];
        ticket.tokenId = _tokenId;
        ticket.amount = _amount;

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

        // Copy the ticket to memory
        EscrowTicket memory ticket = tickets[_ticketId];

        // Delete the ticket from storage
        delete tickets[_ticketId];

        // Burn the caller's balance
        _burn(msg.sender, _ticketId, amount);

        // Transfer the ERC-1155 to escrow contract
        IERC1155 nft = IERC1155(marketController.getNft());
        nft.safeTransferFrom(
            address(this),
            msg.sender,
            ticket.tokenId,
            amount,
            new bytes(0x0)
        );

    }

    /**
     * @notice Implementation of the {IERC165} interface.
     *
     * This method is inherited from several parents and
     * the compiler cannot decide which to use. Thus, it must
     * be overridden here. :(
     */
    function supportsInterface(bytes4 interfaceId)
    public pure override(ERC1155,ERC1155Receiver)
    returns (bool)
    {
        return interfaceId == type(IERC165).interfaceId;
    }

}