pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "../royalty/IERC2981.sol";

interface ISeenHausNFT is IERC2981, IERC1155 {

    /**
     * Check if a given token id corresponds to a tangible lot.
     *
     * @param _tokenId - the id of the token to check
     * @return tangible - true if the item corresponds to a tangible lot
     */
    function isTangible(uint256 _tokenId) external returns (bool tangible);

}