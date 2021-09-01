const { assert } = require("chai");
const { InterfaceIds } = require('../../scripts/constants/supported-interfaces.js');

/**
 *  Test the InterfaceInfo contract
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
describe("InterfaceInfo", function() {

    // Shared args
    let InterfaceInfo, interfaceInfo;

    beforeEach( async function () {

        // Deploy the contract
        InterfaceInfo = await ethers.getContractFactory("InterfaceInfo");
        interfaceInfo = await InterfaceInfo.deploy();
        await interfaceInfo.deployed();

    });

    context("Interface Ids", async function () {

        it("getIAuctionBuilder() should return expected id", async function () {

            const expected = InterfaceIds.IAuctionBuilder;
            const actual = await interfaceInfo.getIAuctionBuilder();
            assert.equal(actual, expected);

        });

        it("getIAuctionHandler() should return expected id", async function () {

            const expected = InterfaceIds.IAuctionHandler;
            const actual = await interfaceInfo.getIAuctionHandler();
            assert.equal(actual, expected);

        });

        it("getIAuctionRunner() should return expected id", async function () {

            const expected = InterfaceIds.IAuctionRunner;
            const actual = await interfaceInfo.getIAuctionRunner();
            assert.equal(actual, expected);

        });

        it("getIDiamondCut() should return expected id", async function () {

            const expected = InterfaceIds.IDiamondCut;
            const actual = await interfaceInfo.getIDiamondCut();
            assert.equal(actual, expected);

        });

        it("getIDiamondLoupe() should return expected id", async function () {

            const expected = InterfaceIds.IDiamondLoupe;
            const actual = await interfaceInfo.getIDiamondLoupe();
            assert.equal(actual, expected);

        });

        it("getIEscrowTicketer() should return expected id", async function () {

            const expected = InterfaceIds.IEscrowTicketer;
            const actual = await interfaceInfo.getIEscrowTicketer();
            assert.equal(actual, expected);

        });

        it("getIMarketClientProxy() should return expected id", async function () {

            const expected = InterfaceIds.IMarketClientProxy;
            const actual = await interfaceInfo.getIMarketClientProxy();
            assert.equal(actual, expected);

        });

        it("getIMarketClerk() should return expected id", async function () {

            const expected = InterfaceIds.IMarketClerk;
            const actual = await interfaceInfo.getIMarketClerk();
            assert.equal(actual, expected);

        });

        it("getIMarketConfig() should return expected id", async function () {

            const expected = InterfaceIds.IMarketConfig;
            const actual = await interfaceInfo.getIMarketConfig();
            assert.equal(actual, expected);

        });

        it("getIMarketController() should return expected id", async function () {

            const expected = InterfaceIds.IMarketController;
            const actual = await interfaceInfo.getIMarketController();
            assert.equal(actual, expected);

        });

        it("getISaleBuilder() should return expected id", async function () {

            const expected = InterfaceIds.ISaleBuilder;
            const actual = await interfaceInfo.getISaleBuilder();
            assert.equal(actual, expected);

        });

        it("getISaleHandler() should return expected id", async function () {

            const expected = InterfaceIds.ISaleHandler;
            const actual = await interfaceInfo.getISaleHandler();
            assert.equal(actual, expected);

        });

        it("getISaleRunner() should return expected id", async function () {

            const expected = InterfaceIds.ISaleRunner;
            const actual = await interfaceInfo.getISaleRunner();
            assert.equal(actual, expected);

        });

        it("getISeenHausNFT() should return expected id", async function () {

            const expected = InterfaceIds.ISeenHausNFT;
            const actual = await interfaceInfo.getISeenHausNFT();
            assert.equal(actual, expected);

        });

        it("getIERC1155Receiver() should return expected id", async function () {

            const expected = InterfaceIds.IERC1155Receiver;
            const actual = await interfaceInfo.getIERC1155Receiver();
            assert.equal(actual, expected);

        });

        it("getIERC721Receiver() should return expected id", async function () {

            const expected = InterfaceIds.IERC721Receiver;
            const actual = await interfaceInfo.getIERC721Receiver();
            assert.equal(actual, expected);

        });

        it("getIERC72981() should return expected id", async function () {

            const expected = InterfaceIds.IERC2981;
            const actual = await interfaceInfo.getIERC2981();
            assert.equal(actual, expected);

        });

    });

});