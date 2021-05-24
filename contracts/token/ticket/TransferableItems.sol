// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "../../market/MarketClient.sol";

/**
 * This ticket contract represents the right to transfer or
 * claim a certain number of a tangible item, bought in a
 * Seen.Haus sale or auction.
 *
 * Since this is an ERC155 implementation, the holder can
 * sell / transfer part or all of the balance of their ticketed
 * items rather than claim them all.
 *
 * Claiming some or all of a holder's balance burns that
 * amount.
 *
 * N.B.: This contract supports piece-level reseller behavior,
 * e.g., an entity scooping up a bunch of the available items
 * in a multi-edition sale with the purpose of flipping each
 * item individually to make maximum profit.
 */
contract TransferableItems is MarketClient, ERC1155 {

    // The token contract that this contract issues tickets against
    IERC11155 public token;

    /**
     * @notice Constructor
     *
     * @param _accessController - the Seen.Haus AccessController
     * @param _marketController - the Seen.Haus MarketController
     * @param _baseURI - base URI for all tokens, with {id} embedded for token id replacement
     * @param _token - the ERC-1155 NFT this contract issues tickets against
     */
    constructor(address _accessController, address _marketController, string memory _baseURI, address _token)
    AccessClient(_accessController)
    MarketClient(_marketController)
    ERC1155(_baseURI)
    public {
        token = IERC1155(_token);
    }

    /**
     * Mint a ticket with the given amount of a claim token and send it to the buyer
     */
    function mint(uint256 _id, uint256 _amount, address _buyer)
    external
    onlyRole(MINTER) {
        require(_amount > 0, "Ticket amount cannot be zero");
        _mint(_buyer, _id, _amount, new bytes(0x0));
    }

    /**
     * Burn a ticket
     * TODO: Currently caller is responsible for also transferring the proof of ownership tokens.
     * Possibly have sale contract approved to do both, and the redeem function is there.
     */
    function burn(uint256 _id, uint256 _amount)
    external {
        require(balanceOf(_msgSender(), _id) >= _amount, "Claim amount is greater than ticket holder's balance");
        _burn(_msgSender(), _id, _amount, new bytes(0x0));
    }

}