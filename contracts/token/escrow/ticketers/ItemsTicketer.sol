// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.5;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "../../../market/MarketClient.sol";
import "../IEscrowTicketer.sol";

/**
 * @title ItemsTicketer
 * @author Cliff Hall
 * @notice An IEscrowTicketer contract implemented with ERC-1155.
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
contract ItemsTicketer is IEscrowTicketer, MarketClient, ERC1155 {

    // Ticket ID => Ticket
    mapping (uint256 => EscrowTicket) internal tickets;

    /// @dev Next ticket number
    uint256 internal nextTicket;

    /**
     * @notice Constructor
     *
     * @param _accessController - the Seen.Haus AccessController
     * @param _marketController - the Seen.Haus MarketController
     */
    constructor(address _accessController, address _marketController)
    AccessClient(_accessController)
    MarketClient(_marketController)
    ERC1155(ESCROW_TICKET_URI)
    {}

    /**
     * @notice The getNextTicket getter
     * @dev does not increment counter
     */
    function getNextTicket()
    external
    view
    override
    returns (uint256)
    {
        return nextTicket;
    }

    /**
 * @notice Get info about the ticket
 */
    function getTicketInfo(uint256 ticketId)
    external
    view
    override
    returns (EscrowTicket memory)
    {
        require(ticketId < nextTicket, "Ticket does not exist");
        return tickets[ticketId];
    }

    /**
     * @notice Get the token URI
     *
     * Same for all tickets, since they are dynamically created.
     *
     * @param _tokenId - the ticket's token id
     * @return tokenURI - the URI for the given token id's metadata
     */
    function uri(uint256 _tokenId)
    public
    pure
    override
    returns (string memory)
    {
        return ESCROW_TICKET_URI;
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
     * Reverts if token amount hasn't already been transferred to this contract
     *
     * @param _consignmentId - the id of the consignment being sold
     * @param _amount - the amount of the given token to escrow
     * @param _buyer - the buyer of the escrowed item(s) to whom the ticket is issued
     */
    function issueTicket(uint256 _consignmentId, uint256 _amount, address payable _buyer)
    external
    override
    onlyRole(MARKET_HANDLER)
    {
        // Fetch consignment (reverting if consignment doesn't exist)
        Consignment memory consignment = marketController.getConsignment(_consignmentId);

        // Make sure amount is non-zero
        require(_amount > 0, "Token amount cannot be zero.");

        // Get the ticketed token
        Token memory token = ISeenHausNFT(consignment.tokenAddress).getTokenInfo(consignment.tokenId);

        // Create and store escrow ticket
        uint256 ticketId = nextTicket++;
        EscrowTicket storage ticket = tickets[ticketId];
        ticket.amount = _amount;
        ticket.consignmentId = _consignmentId;
        ticket.id = ticketId;
        ticket.itemURI = token.uri;

        // Mint escrow ticket and send to buyer
        _mint(_buyer, ticketId, _amount, new bytes(0x0));

        // Notify listeners about state change
        emit TicketIssued(ticketId, _consignmentId, _buyer, _amount);

    }

    /**
     * Claim escrowed items associated with the ticket.
     *
     * @param _ticketId - the ticket representing the escrowed item(s)
     */
    function claim(uint256 _ticketId) external override
    {
        // Make sure the ticket exists
        EscrowTicket memory ticket = tickets[_ticketId];
        require(ticket.id == _ticketId, "Ticket does not exist");

        uint256 amount = balanceOf(msg.sender, _ticketId);
        require(amount > 0, "Caller has no balance for this ticket");

        // Burn the caller's balance
        _burn(msg.sender, _ticketId, amount);

        // Reduce the ticket's amount by the claim amount
        ticket.amount -= amount;

        // When entire supply is claimed and burned, delete the ticket structure
        if (ticket.amount == 0) {
            delete tickets[_ticketId];
        } else {
            tickets[_ticketId] = ticket;
        }

        // Release the consignment to claimant
        marketController.releaseConsignment(ticket.consignmentId, amount, msg.sender);

        // Notify listeners of state change
        emit TicketClaimed(_ticketId, msg.sender, amount);

    }

    /**
     * @notice Implementation of the {IERC165} interface.
     *
     * N.B. This method is inherited from several parents and
     * the compiler cannot decide which to use. Thus, they must
     * be overridden here.
     *
     * if you just call super.supportsInterface, it chooses
     * 'the most derived contract'. But that's not good for this
     * particular function because you may inherit from several
     * IERC165 contracts, and all concrete ones need to be allowed
     * to respond.
     */
    function supportsInterface(bytes4 interfaceId)
    public
    view
    override(ERC1155)
    returns (bool)
    {
        return (
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IERC1155).interfaceId ||
            interfaceId == type(IEscrowTicketer).interfaceId
        );
    }

}