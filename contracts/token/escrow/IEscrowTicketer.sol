// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

/**
 * @title IEscrowTicketer
 * @author Cliff Hall
 * @notice Manages the issue and claim of escrow tickets.
 */
interface IEscrowTicketer {

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
    function issueTicket(uint256 _tokenId, uint256 _amount, address payable _buyer) external;

    /**
     * Claim the holder's escrowed items associated with the ticket.
     *
     * @param _ticketId - the ticket representing the escrowed items
     */
    function claim(uint256 _ticketId) external;


}