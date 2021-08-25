// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "../interfaces/IERC2981.sol";

/**
 * @title Foreign721
 *
 * @notice Mock ERC-(721/2981) NFT for Unit Testing
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
contract Foreign721 is IERC2981, ERC721Upgradeable {

    string public constant TOKEN_NAME = "Foreign721";
    string public constant TOKEN_SYMBOL = "721Test";

    mapping(uint256 => address) public creators;
    mapping(uint256 => uint256) public royaltyPercentage;

    /**
     * @notice Get royalty info for a token
     *
     * For a given token id and sale price, how much should be sent to whom as royalty
     *
     * @param _tokenId - the NFT asset queried for royalty information
     * @param _salePrice - the sale price of the NFT asset specified by _tokenId
     *
     * @return _receiver - address of who should be sent the royalty payment
     * @return _royaltyAmount - the royalty payment amount for _value sale price
     */
    function royaltyInfo(uint256 _tokenId, uint256 _salePrice)
    external view override
    returns (address _receiver, uint256 _royaltyAmount)
    {
        address creator = creators[_tokenId];
        uint256 percentage = royaltyPercentage[_tokenId];
        _receiver = creator;
        _royaltyAmount = _salePrice * percentage / 10000;
    }

    /**
     * Mint a Sample NFT
     * @param _creator - the address that will own the token and get royalties
     * @param _tokenId - the token ID to mint
     * @param _royaltyPercentage - the percentage of royalty expected on secondary market sales
     */
    function mint(address _creator, uint256 _tokenId, uint256 _royaltyPercentage) public {
        creators[_tokenId] = _creator;
        royaltyPercentage[_tokenId] = _royaltyPercentage;
        _mint(_creator, _tokenId);
    }

}