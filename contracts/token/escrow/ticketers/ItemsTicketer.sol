// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.5;

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "../../../market/MarketClient.sol";
import "../../../util/StringUtils.sol";
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
contract ItemsTicketer is StringUtils, IEscrowTicketer, MarketClient, ERC1155Holder, ERC1155 {

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
    function uri(uint256 _tokenId)
    public
    pure
    override
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
     * Reverts if token amount hasn't already been transferred to this contract
     *
     * @param _tokenId - the token id on the Seen.Haus NFT contract
     * @param _amount - the amount of the given token to escrow
     * @param _buyer - the buyer of the escrowed item(s) to whom the ticket is issued
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

        // Mint escrow ticket and send to buyer
        _mint(_buyer, ticketId, _amount, new bytes(0x0));
    }

    /**
     * Claim escrowed items associated with the ticket.
     *
     * @param _ticketId - the ticket representing the escrowed item(s)
     */
    function claim(uint256 _ticketId) external override
    {
        uint256 amount = balanceOf(msg.sender, _ticketId);
        require(amount > 0, "Caller has no balance for this ticket");

        // Burn the caller's balance
        _burn(msg.sender, _ticketId, amount);

        // Copy the ticket to memory
        EscrowTicket memory ticket = tickets[_ticketId];

        // Reduce the ticket's amount by the claim amount
        ticket.amount -= amount;

        // When entire supply is claimed and burned, delete the ticket structure
        if (ticket.amount == 0) {
            delete tickets[_ticketId];
        } else {
            tickets[_ticketId] = ticket;
        }

        // Transfer the ERC-1155 to the caller
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
    override(ERC1155, ERC1155Receiver)
    returns (bool)
    {
        return (
            ERC1155.supportsInterface(interfaceId) ||
            ERC1155Receiver.supportsInterface(interfaceId)
        );
    }

}