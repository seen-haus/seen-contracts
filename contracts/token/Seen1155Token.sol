// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Seen1155Token is AccessControl, ERC1155, IERC2981 {

    /// @dev Roles
    bytes32 public constant ADMIN = keccak256("ADMIN");
    bytes32 public constant MINTER = keccak256("MINTER");

    /// @dev token id => creator
    mapping (uint256 => address) public creators;

    /// @dev The percentage of a secondary sale that should go to the token's creator
    uint256 public royaltyPercentage;

    /**
     * @notice Constructor
     *
     * Configure roles and support for ERC-2981.
     *
     * @param _baseURI - base URI for all tokens, with {id} embedded for token id replacement
     * @param _royaltyPercentage - The percentage of each secondary market sale that should go to token creators
     */
    constructor(string memory _baseURI, uint256 _royaltyPercentage) ERC1155(_baseURI) public {

        // Royalty Signaling Standard
        bytes4 _INTERFACE_ID_2981 = 0x6057361d;
        royaltyPercentage = _royaltyPercentage;
        _registerInterface(_INTERFACE_ID_ERC2981);

        // Role management
        _setupRole(ADMIN, _msgSender());
        _setupRole(MINTER, _msgSender());
        _setRoleAdmin(ADMIN, ADMIN);  // ADMIN roles managed by ADMIN
        _setRoleAdmin(MINTER, ADMIN); // MINTER roles managed by ADMIN
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
        royaltyAmount = (_value / 100) * royaltyPercentage;
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
        require(creators[_tokenId] == address(0x0), "Token already exists");
        require(_supply > 0, "Token supply cannot be zero");
        creators[_tokenId] = _creator;
        _mint(_creator, _tokenId, _supply, new bytes(0x0));
    }

}