// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../../../access/AccessClient.sol";
import "../../../market/MarketClient.sol";
import "../../../util/StringUtils.sol";
import "../IEscrowTicketer.sol";

/**
 * @title TicketAsLot
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
contract TicketAsLot is StringUtils, IEscrowTicketer, MarketClient, ERC1155Holder, ERC721 {

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
     *  - tokenAddress: [SeenHausNFT contract address]
     *  - tokenId: [the token id from EscrowTicket]
     *  - amount: [the amount of that token this ticket can claim]
     *
     * @param _tokenId - the ticket's token id
     * @return tokenURI - the URI for the given token id's metadata
     */
    function tokenURI(uint256 _tokenId)
    public
    pure
    override
    returns (string memory)
    {
        string memory id = uintToStr(_tokenId);
        return strConcat(ESCROW_TICKET_URI_BASE, id);
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
        return ESCROW_TICKET_URI_BASE;
    }

    /**
     * Mint an escrow ticket
     *
     * @param _tokenId - the token id on the Seen.Haus NFT contract
     * @param _amount - the amount of the given token to escrow
     */
    function issueTicket(uint256 _tokenId, uint256 _amount, address payable _buyer)
    external
    override
    onlyRole(MARKET_HANDLER)
    {
        // Make sure amount is non-zero
        require(_amount > 0, "Token amount cannot be zero.");

        // Ensure market handler has transferred the token to this contract
        address nft = marketController.getNft();
        require(IERC1155(nft).balanceOf(address(this), _tokenId) >= _amount, "Must transfer token amount to ticketer first.");

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
    external
    override
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
    override(ERC721, ERC1155Receiver)
    returns (bool)
    {
        return (
            ERC721.supportsInterface(interfaceId) ||
            ERC1155Receiver.supportsInterface(interfaceId)
        );
    }

}