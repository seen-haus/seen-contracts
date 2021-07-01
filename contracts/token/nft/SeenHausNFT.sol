// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.5;

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

    /// @dev token id => Token struct
    mapping (uint256 => Token) public tokens;

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
        _registerInterface(type(ISeenHausNFT).interfaceId);
        _registerInterface(type(IERC165).interfaceId);
        _registerInterface(type(IERC1155).interfaceId);
        _registerInterface(type(IERC1155MetadataURI).interfaceId);
    }

    /**
     * @notice The nextToken getter
     * @dev does not increment counter
     */
    function getNextToken()
    external view override
    returns (uint256)
    {
        return nextToken;
    }

    /**
     * @notice Get the info about a given token.
     *
     * @param _tokenId - the id of the token to check
     * @return tokenInfo - the info about the token. See: {SeenTypes.Token}
     */
    function getTokenInfo(uint256 _tokenId)
    external view override
    returns (Token memory tokenInfo)
    {
        return tokens[_tokenId];
    }

    /**
     * @notice Check if a given token id corresponds to a physical lot.
     *
     * @param _tokenId - the id of the token to check
     */
    function isPhysical(uint256 _tokenId)
    public view override
    returns (bool) {
        Token memory token = tokens[_tokenId];
        return token.isPhysical;
    }

    /**
     * @notice Mint a given supply of a token, optionally flagging as physical.
     *
     * Token supply is sent to the caller.
     *
     * @param _supply - the supply of the token
     * @param _creator - the creator of the NFT (where the royalties will go)
     * @param _tokenURI - the URI of the token metadata
     * @param _royaltyPercentage - the percentage of royalty expected on secondary market sales
     * @param _isPhysical - whether the NFT should be flagged as physical or not
     */
    function mint(uint256 _supply, address payable _creator, string memory _tokenURI, uint16 _royaltyPercentage, bool _isPhysical)
    internal
    {

        // Make sure royalty percentage is acceptable
        require(_royaltyPercentage <= marketController.getMaxRoyaltyPercentage(), "Royalty percentage exceeds marketplace maximum");

        // Get the next token id
        uint256 tokenId = nextToken++;

        // Store the token info
        Token storage token = tokens[tokenId];
        token.uri = _tokenURI;
        token.supply = _supply;
        token.creator = _creator;
        token.isPhysical = _isPhysical;
        token.royaltyPercentage = _royaltyPercentage;

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
     * @param _royaltyPercentage - the percentage of royalty expected on secondary market sales
     *
     * N.B. Represent percentage value as an unsigned int by multiplying the percentage by 100:
     * e.g, 1.75% = 175, 100% = 10000
     */
    function mintPhysical(uint256 _supply, address payable _creator, string memory _tokenURI, uint16 _royaltyPercentage)
    external override
    onlyRole(ESCROW_AGENT)
    {

        // Mint the token, flagging it as physical, sending to caller
        mint(_supply, _creator, _tokenURI, _royaltyPercentage, true);

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
     * @param _royaltyPercentage - the percentage of royalty expected on secondary market sales
     *
     * N.B. Represent percentage value as an unsigned int by multiplying the percentage by 100:
     * e.g, 1.75% = 175, 100% = 10000
     */
    function mintDigital(uint256 _supply, address payable _creator, string memory _tokenURI, uint16 _royaltyPercentage)
    external override
    onlyRole(MINTER)
    {

        // Mint the token, sending to caller
        mint(_supply, _creator, _tokenURI, _royaltyPercentage, false);

    }

    /**
     * @notice Get royalty info for a token
     *
     * For a given token id and sale price, how much should be sent to whom as royalty
     *
     * @param _tokenId - the NFT asset queried for royalty information
     * @param _value - the sale price of the NFT asset specified by _tokenId
     *
     * @return _receiver - address of who should be sent the royalty payment
     * @return _royaltyAmount - the royalty payment amount for _value sale price
     */
    function royaltyInfo(uint256 _tokenId, uint256 _value)
    external view override
    returns (address _receiver, uint256 _royaltyAmount)
    {
        Token storage token = tokens[_tokenId];
        _receiver = token.creator;
        _royaltyAmount = getPercentageOf(_value, token.royaltyPercentage);
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
    public view override(IERC165, ERC1155, ERC165Storage)
    returns (bool)
    {
        return (
            ERC1155.supportsInterface(interfaceId) ||
            ERC165Storage.supportsInterface(interfaceId)
        );
    }

    /**
     * @notice Get the token URI
     *
     * This method is overrides the Open Zeppelin version, returning
     * a unique stored metadata URI for each token rather than a
     * replaceable baseURI template, since the latter is not compatible
     * with IPFS hashes.
     *
     * @param _tokenId - id of the token to get the URI for
     */
    function uri(uint256 _tokenId)
    public view override
    returns (string memory)
    {
        Token storage token = tokens[_tokenId];
        return token.uri;
    }

}