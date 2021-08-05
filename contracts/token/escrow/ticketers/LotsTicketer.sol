// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../../../interfaces/IEscrowTicketer.sol";
import "../../../interfaces/ISeenHausNFT.sol";
import "../../../access/AccessClient.sol";
import "../../../market/MarketClient.sol";
import "../../../util/StringUtils.sol";

/**
 * @title LotsTicketer
 * @author Cliff Hall
 * @notice An escrow ticketer contract implemented with ERC-721.
 *
 * Holders of this ticket have the right to transfer or claim a
 * given number of a physical consignment, escrowed by Seen.Haus.
 *
 * Since this is an ERC721 implementation, the holder must
 * claim, sell, or transfer the entire lot of the ticketed
 * items at once.
 *
 * N.B.: This contract disincentivizes whale behavior, e.g., a person
 * scooping up a bunch of the available items in a multi-edition
 * sale must flip or claim them all at once, not individually.
 */
contract LotsTicketer is IEscrowTicketer, StringUtils, MarketClient, ERC721 {

    // Ticket ID => Ticket
    mapping (uint256 => EscrowTicket) internal tickets;

    /// @dev Next ticket number
    uint256 internal nextTicket;

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
    function getTicket(uint256 ticketId)
    external
    view
    override
    returns (EscrowTicket memory)
    {
        require(_exists(ticketId), "Ticket does not exist");
        return tickets[ticketId];
    }

    /**
     * @notice Gets the URI for the ticket metadata
     *
     * IEscrowTicketer method that normalizes how you get the URI,
     * since ERC721 and ERC1155 differ in approach.
     *
     * @param _ticketId - the token id of the ticket
     */
    function getTicketURI(uint256 _ticketId)
    external
    pure
    override
    returns (string memory)
    {
        return tokenURI(_ticketId);
    }

    /**
     * @notice Get the token URI
     *
     * This method is overrides the Open Zeppelin version, returning
     * a unique endpoint address on the seen.haus site for each token id.
     *
     * Tickets are transient and will be burned when claimed to obtain
     * proof of ownership NFTs with their metadata on IPFS as usual.
     *
     * TODO: metadata with fixed name, description, and image, identifying it as a Seen.Haus Escrow Ticket
     * adding these fields, perhaps in OpenSea attributes format
     *  - ticketId
     *  - consignmentId
     *  - tokenAddress
     *  - tokenId
     *  - amount
     *
     * @param _tokenId - the ticket's token id
     *
     * @return tokenURI - the URI for the given token id's metadata
     */
    function tokenURI(uint256 _tokenId)
    public
    pure
    override
    returns (string memory)
    {
        return strConcat(_baseURI(), uintToStr(_tokenId));
    }

    /**
     * @dev Base URI for computing {tokenURI}. Empty by default, can be overriden
     * in child contracts.
     */
    function _baseURI()
    internal
    pure
    override
    returns (string memory)
    {
        return ESCROW_TICKET_URI;
    }

    /**
     * Mint an escrow ticket
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

        // Mint the ticket and send to the buyer
        _mint(_buyer, ticketId);

        // Notify listeners about state change
        emit TicketIssued(ticketId, _consignmentId, _buyer, _amount);
    }

    /**
      * Claim the escrowed items associated with the ticket.
      *
      * @param _ticketId - the ticket representing the escrowed items
      */
    function claim(uint256 _ticketId)
    external
    override
    {
        require(_exists(_ticketId), "Invalid ticket id");
        require(ownerOf(_ticketId) == msg.sender, "Caller not ticket holder");

        // Get the ticket
        EscrowTicket memory ticket = tickets[_ticketId];

        // Burn the ticket
        _burn(_ticketId);

        // Release the consignment to claimant
        marketController.releaseConsignment(ticket.consignmentId, ticket.amount, msg.sender);

        // Notify listeners of state change
        emit TicketClaimed(_ticketId, msg.sender, ticket.amount);

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
    pure
    override(ERC721)
    returns (bool)
    {
        return (
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IERC721).interfaceId ||
            interfaceId == type(IEscrowTicketer).interfaceId
        );
    }

}