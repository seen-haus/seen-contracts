// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";

import "../interfaces/IAuctionBuilder.sol";
import "../interfaces/IAuctionHandler.sol";
import "../interfaces/IAuctionRunner.sol";
import "../interfaces/IDiamondCut.sol";
import "../interfaces/IDiamondLoupe.sol";
import "../interfaces/IERC2981.sol";
import "../interfaces/IEscrowTicketer.sol";
import "../interfaces/IMarketClerk.sol";
import "../interfaces/IMarketClientProxy.sol";
import "../interfaces/IMarketConfig.sol";
import "../interfaces/IMarketController.sol";
import "../interfaces/IMarketHandler.sol";
import "../interfaces/ISaleBuilder.sol";
import "../interfaces/ISaleHandler.sol";
import "../interfaces/ISaleRunner.sol";
import "../interfaces/ISeenHausNFT.sol";

/**
 * @title Interface Info
 *
 * @notice Allows us to read/verify the interface ids supported by the Seen.Haus contract suite.
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
contract InterfaceInfo {

    function getIAuctionBuilder()
    public pure
    returns(bytes4 id) {
        id = type(IAuctionBuilder).interfaceId;
    }

    function getIAuctionHandler()
    public pure
    returns(bytes4 id) {
        id = type(IAuctionBuilder).interfaceId ^ type(IAuctionRunner).interfaceId;
    }

    function getIAuctionRunner()
    public pure
    returns(bytes4 id) {
        id = type(IAuctionRunner).interfaceId;
    }

    function getIDiamondCut()
    public pure
    returns(bytes4 id) {
        id = type(IDiamondCut).interfaceId;
    }

    function getIDiamondLoupe()
    public pure
    returns(bytes4 id) {
        id = type(IDiamondLoupe).interfaceId;
    }

    function getIEscrowTicketer()
    public pure
    returns(bytes4 id) {
        id = type(IEscrowTicketer).interfaceId;
    }

    function getIMarketClientProxy()
    public pure
    returns(bytes4 id) {
        id = type(IMarketClientProxy).interfaceId;
    }

    function getIMarketClerk()
    public pure
    returns(bytes4 id) {
        id = type(IMarketClerk).interfaceId;
    }

    function getIMarketConfig()
    public pure
    returns(bytes4 id) {
        id = type(IMarketConfig).interfaceId;
    }

    function getIMarketController()
    public pure
    returns(bytes4 id) {
        id = type(IMarketConfig).interfaceId ^ type(IMarketClerk).interfaceId;
    }

    function getISaleBuilder()
    public pure
    returns(bytes4 id) {
        id = type(ISaleBuilder).interfaceId;
    }

    function getISaleHandler()
    public pure
    returns(bytes4 id) {
        id = type(ISaleBuilder).interfaceId ^ type(ISaleRunner).interfaceId;
    }

    function getISaleRunner()
    public pure
    returns(bytes4 id) {
        id = type(ISaleRunner).interfaceId;
    }

    function getISeenHausNFT()
    public pure
    returns(bytes4 id) {
        id = type(ISeenHausNFT).interfaceId;
    }

    function getIERC1155Receiver()
    public pure
    returns(bytes4 id) {
        id = type(IERC1155ReceiverUpgradeable).interfaceId;
    }

    function getIERC721Receiver()
    public pure
    returns(bytes4 id) {
        id = type(IERC721ReceiverUpgradeable).interfaceId;
    }

    function getIERC2981()
    public pure
    returns(bytes4 id) {
        id = type(IERC2981).interfaceId;
    }

}