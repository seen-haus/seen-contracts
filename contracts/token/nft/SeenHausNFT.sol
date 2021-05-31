// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Storage.sol";
import "../../market/MarketClient.sol";
import "../royalty/IERC2981.sol";
import "./ISeenHausNFT.sol";

/**
 * @title SeenHausNFT
 * @author Cliff Hall
 * @notice This is the Seen.House ERC-1155 NFT contract.
 *
 * Key features:
 * - Supports the ERC-2981 NFT Royalty Standard
 * - Tracks the original creator of each token.
 * - Tracks which tokens have a tangible part
 * - Logically capped token supplies; a token's supply cannot be increased after minting.
 * - Only ESCROW_AGENT-roled addresses can mint tangible NFTs.
 * - Only MINTER-roled addresses can mint digital NFTs, e.g., Seen.Haus staff, whitelisted artists.
 */
contract SeenHausNFT is ISeenHausNFT, MarketClient, ERC1155, ERC165Storage {

    /// @dev token id => creator
    mapping (uint256 => address) public creators;

    /// @dev token id => true - only included if token id
    mapping (uint256 => bool) public tangibles;

    // Next token number
    uint256 public nextToken;

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
     * @notice The nextToken getter
     * @dev does not increment counter
     */
    function getNextToken()
    external view override
    returns (uint256) {
        return nextToken;
    }

    /**
     * @notice Get the creator of a given token.
     *
     * @param _tokenId - the id of the token to check
     */
    function getCreator(uint256 _tokenId)
    external view override
    returns (address creator)
    {
        return creators[_tokenId];
    }

    /**
     * @notice Check if a given token id corresponds to a tangible lot.
     *
     * @param _tokenId - the id of the token to check
     * @return tangible - true if token id corresponds to a tangible lot.
     */
    function isTangible(uint256 _tokenId)
    public view override
    returns (bool tangible) {
        tangible = (tangibles[_tokenId] == true);
    }

    /**
     * @notice Mint a given supply of a token, optionally flagging as tangible.
     *
     * Token supply is sent to the caller.
     *
     * @param _supply - the supply of the token
     * @param _creator - the creator of the NFT (where the royalties will go)
     * @param _tangible - whether the NFT should be flagged as tangible or not
     */
    function mint(uint256 _supply, address _creator, bool _tangible)
    internal
    {

        // Get the next token id
        uint256 tokenId = nextToken++;

        // Record the creator of the token
        creators[tokenId] = _creator;

        // Optionally flag it as tangible
        if (_tangible) tangibles[tokenId] = true;

        // Mint the token, sending it to the caller
        _mint(msg.sender, tokenId, _supply, new bytes(0x0));

    }

    /**
     * @notice Mint a given supply of a token, marking it as tangible.
     *
     * Entire supply must be minted at once.
     * More cannot be minted later for the same token id.
     * Can only be called by an address with the ESCROW_AGENT role.
     * Token supply is sent to the caller.
     *
     * @param _supply - the supply of the token
     * @param _creator - the creator of the NFT (where the royalties will go)
     */
    function mintTangible(uint256 _supply, address _creator)
    external override
    onlyRole(ESCROW_AGENT)
    {

        // Mint the token, flagging it as tangible, sending to caller
        mint(_supply, _creator, true);

    }

    /**
     * @notice Mint a given supply of a token.
     *
     * Entire supply must be minted at once.
     * More cannot be minted later for the same token id.
     * Can only be called by an address with the MINTER role.
     * Token supply is sent to the caller's address.
     *
     * @param _supply - the supply of the token
     * @param _creator - the creator of the NFT (where the royalties will go)
     */
    function mintDigital(uint256 _supply, address _creator)
    external override
    onlyRole(MINTER)
    {

        // Mint the token, sending to caller
        mint(_supply, _creator, false);

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
     *
     *
     * TODO: Remove _data param & _royaltyPaymentData return if they get tossed from the 2981 draft - CLH
     */
    function royaltyInfo(uint256 _tokenId, uint256 _value, bytes calldata _data)
    external view override
    returns (address _receiver, uint256 _royaltyAmount, bytes memory _royaltyPaymentData)
    {
        _receiver = creators[_tokenId];
        _royaltyAmount = (_value / 100) * marketController.getRoyaltyPercentage();
        _royaltyPaymentData = _data; // TODO: Remove me too!
    }

    /**
     * @notice Implementation of the {IERC165} interface.
     *
     * This method is inherited from several parents and
     * the compiler cannot decide which to use. Thus, it must
     * be overridden here. :(
     */
    function supportsInterface(bytes4 interfaceId)
    public pure override(IERC2981,ERC1155,ERC165Storage,ERC1155Receiver)
    returns (bool)
    {
        return interfaceId == type(IERC165).interfaceId;
    }

}