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
 * - Tracks which tokens have a physical part
 * - Logically capped token supplies; a token's supply cannot be increased after minting.
 * - Only ESCROW_AGENT-roled addresses can mint physical NFTs.
 * - Only MINTER-roled addresses can mint digital NFTs, e.g., Seen.Haus staff, whitelisted artists.
 */
contract SeenHausNFT is ISeenHausNFT, MarketClient, ERC1155, ERC165Storage {

    /// @dev token id => creator
    mapping (uint256 => address) public creators;

    /// @dev token id => true - only included if token id has a physical component
    mapping (uint256 => bool) public physicals;

    /// @dev token id => Token URI
    mapping (uint256 => string) public uris;

    // Next token number
    uint256 public nextToken;

    /**
     * @notice Constructor
     *
     * @param _accessController - the Seen.Haus AccessController
     * @param _marketController - the Seen.Haus MarketController
     */
    constructor(address _accessController, address _marketController)
    AccessClient(_accessController)
    MarketClient(_marketController)
    ERC1155("")
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
     * @notice Check if a given token id corresponds to a physical lot.
     *
     * @param _tokenId - the id of the token to check
     * @return physical - true if token id corresponds to a physical lot.
     */
    function isPhysical(uint256 _tokenId)
    public view override
    returns (bool physical) {
        physical = (physicals[_tokenId] == true);
    }

    /**
     * @notice Mint a given supply of a token, optionally flagging as physical.
     *
     * Token supply is sent to the caller.
     *
     * @param _supply - the supply of the token
     * @param _creator - the creator of the NFT (where the royalties will go)
     * @param _tokenURI - the URI of the token metadata
     * @param _physical - whether the NFT should be flagged as physical or not
     */
    function mint(uint256 _supply, address _creator, string memory _tokenURI, bool _physical)
    internal
    {

        // Get the next token id
        uint256 tokenId = nextToken++;

        // Record the creator of the token, the token URI
        creators[tokenId] = _creator;
        uris[tokenId] = _tokenURI;

        // Optionally flag it as physical
        if (_physical) physicals[tokenId] = true;

        // Mint the token, sending it to the caller
        _mint(msg.sender, tokenId, _supply, new bytes(0x0));

    }

    /**
     * @notice Mint a given supply of a token, marking it as physical.
     *
     * Entire supply must be minted at once.
     * More cannot be minted later for the same token id.
     * Can only be called by an address with the ESCROW_AGENT role.
     * Token supply is sent to the caller.
     *
     * @param _supply - the supply of the token
     * @param _creator - the creator of the NFT (where the royalties will go)
     * @param _tokenURI - the URI of the token metadata
     */
    function mintPhysical(uint256 _supply, address _creator, string memory _tokenURI)
    external override
    onlyRole(ESCROW_AGENT)
    {

        // Mint the token, flagging it as physical, sending to caller
        mint(_supply, _creator, _tokenURI, true);

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
     * @param _tokenURI - the URI of the token metadata
     */
    function mintDigital(uint256 _supply, address _creator, string memory _tokenURI)
    external override
    onlyRole(MINTER)
    {

        // Mint the token, sending to caller
        mint(_supply, _creator, _tokenURI, false);

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
     * TODO: Remove _data param & _royaltyPaymentData return if they get tossed from the 2981 draft - CLH
     */
    function royaltyInfo(uint256 _tokenId, uint256 _value, bytes calldata _data)
    external view override
    returns (address _receiver, uint256 _royaltyAmount, bytes memory _royaltyPaymentData)
    {
        _receiver = creators[_tokenId];
        _royaltyAmount = getPercentageOf(_value, marketController.getRoyaltyPercentage());
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

    /**
     * @notice Get the token URI
     *
     * This method is overrides the Open Zeppelin version, returning
     * a unique stored metadata URI for each token rather than a
     * replaceable baseURI template, since the latter is not compatible
     * with IPFS hashes.
     */
    function uri(uint256 _tokenId)
    public view override
    returns (string memory)
    {
        return uris[_tokenId];
    }

}