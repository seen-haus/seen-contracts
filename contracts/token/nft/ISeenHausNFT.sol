// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.5;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "../royalty/IERC2981.sol";
import "../../domain/SeenTypes.sol";

/**
 * @title ISeenHausNFT
 * @author Cliff Hall
 * @notice This is the interface for the Seen.House ERC-1155 NFT contract.
 */
interface ISeenHausNFT is IERC2981, IERC1155 {

    /**
     * @notice The nextToken getter
     * @dev does not increment counter
     */
    function getNextToken() external view returns (uint256 nextToken);

    /**
     * @notice Get the info about a given token.
     *
     * @param _tokenId - the id of the token to check
     * @return tokenInfo - the info about the token. See: {SeenTypes.Token}
     */
    function getTokenInfo(uint256 _tokenId) external view returns (SeenTypes.Token memory tokenInfo);

    /**
     * @notice Check if a given token id corresponds to a physical lot.
     *
     * @param _tokenId - the id of the token to check
     * @return physical - true if the item corresponds to a physical lot
     */
    function isPhysical(uint256 _tokenId) external returns (bool);

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
    function mintPhysical(uint256 _supply, address payable _creator, string memory _tokenURI, uint16 _royaltyPercentage) external;

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
    function mintDigital(uint256 _supply, address payable _creator, string memory _tokenURI, uint16 _royaltyPercentage) external;

}