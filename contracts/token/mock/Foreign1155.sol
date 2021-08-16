// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "../../interfaces/IERC2981.sol";

/**
 * @title Foreign1155
 *
 * @notice Mock ERC-(1155/2981) NFT for Unit Testing
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
contract Foreign1155 is IERC2981, ERC1155 {

    mapping(uint256 => address) public creators;
    mapping(uint256 => uint256) public royaltyPercentage;

    constructor() ERC1155(""){}

    /**
     * Mint a Sample NFT
     * @param _creator - the address that will own the token and get royalties
     * @param _tokenId - the token ID to mint an amount of
     * @param _amount - the amount of tokens to mint
     * @param _royaltyPercentage - the percentage of royalty expected on secondary market sales
     */
    function mint(address _creator, uint256 _tokenId, uint256 _amount, uint256 _royaltyPercentage) public {
        creators[_tokenId] = _creator;
        royaltyPercentage[_tokenId] = _royaltyPercentage;
        _mint(_creator, _tokenId, _amount, "");
    }

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
    pure
    override(IERC165, ERC1155)
    returns (bool)
    {
        return (
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IERC1155).interfaceId ||
            interfaceId == type(IERC2981).interfaceId
        );
    }

}