// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "../SeenTypes.sol";
import "../access/AccessClient.sol";
import "../market/MarketClient.sol";
import "./royalty/IERC2981.sol";

contract Seen1155Token is AccessClient, MarketClient, ERC1155, IERC2981 {

    /// @dev token id => creator
    mapping (uint256 => address) public creators;

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
    {
        _registerInterface(INTERFACE_ID_2981);
    }

    /**
     * @notice Get royalty info for a token
     *
     * For a given token id and sale price, how much should be sent to whom as royalty
     *
     * @param _tokenId - the NFT asset queried for royalty information
     * @param _value - the sale price of the NFT asset specified by _tokenId
     * @param _data - information used by extensions of ERC2981, pass through
     *
     * @return _receiver - address of who should be sent the royalty payment
     * @return _royaltyAmount - the royalty payment amount for _value sale price
     * @return _royaltyPaymentData - the _data argument passed through without modification
     */
    function royaltyInfo(uint256 _tokenId, uint256 _value, bytes calldata _data)
    external
    returns (address receiver, uint256 royaltyAmount, bytes memory royaltyPaymentData) {
        receiver = creators[_tokenId];
        royaltyAmount = (_value / 100) * marketController.royaltyPercentage();
        royaltyPaymentData = _data;
    }

    /**
     * @notice Mint a given supply of a token and send it to the creator.
     *
     * Entire supply must be minted at once.
     * More cannot be minted later for the same token id.
     * Can only be called by an address with the MINTER role.
     *
     * @param _tokenId - the NFT token to mint
     * @param _supply - the supply of the token
     * @param _creator - the creator of the NFT (where the royalties will go)
     */
    function mint(uint256 _tokenId, uint256 _supply, address _creator)
    external
    onlyRole(MINTER) {

        // Make sure we can mint this token
        require(creators[_tokenId] == address(0x0), "Token already exists");
        require(_supply > 0, "Token supply cannot be zero");

        // Record the creator of the token
        creators[_tokenId] = _creator;

        // Mint the token, sending it to the creator
        _mint(_creator, _tokenId, _supply, new bytes(0x0));
    }

}