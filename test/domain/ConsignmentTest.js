const { expect } = require("chai");
const Consignment = require("../../scripts/domain/Consignment");
const Market = require("../../scripts/domain/Market");
const MarketHandler = require("../../scripts/domain/MarketHandler");

/**
 *  Test the Consignment domain object
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
describe("Consignment", function() {

    // Suite-wide scope
    let accounts, consignment;
    let market, seller, tokenAddress, tokenId, supply, id, multiToken, released;

    before( async function () {

        // Make accounts available
        accounts = await ethers.getSigners();

        // Required constructor params
        market = Market.PRIMARY;
        marketHandler = MarketHandler.UNHANDLED;
        seller = accounts[0].address;
        tokenAddress = "0x7777788200B672A42421017F65EDE4Fc759564C8";
        tokenId = "100";
        supply = "50";
        id = "1";
        multiToken = true;
        released = false;
        releasedSupply = "0";
        customFeePercentageBasisPoints = "0";
        pendingPayout = "100";
    });

    context("Constructor", async function () {

        it("Should allow creation of valid, fully populated Consignment instance", async function () {

            consignment = new Consignment(market, marketHandler, seller, tokenAddress, tokenId, supply, id,  multiToken, released, releasedSupply, customFeePercentageBasisPoints, pendingPayout);
            expect(consignment.marketIsValid()).is.true;
            expect(consignment.marketHandlerIsValid()).is.true;
            expect(consignment.sellerIsValid()).is.true;
            expect(consignment.tokenAddressIsValid()).is.true;
            expect(consignment.tokenIdIsValid()).is.true;
            expect(consignment.idIsValid()).is.true;
            expect(consignment.multiTokenIsValid()).is.true;
            expect(consignment.releasedSupplyIsValid()).is.true;
            expect(consignment.customFeePercentageBasisPointsIsValid()).is.true;
            expect(consignment.pendingPayoutIsValid()).is.true;
            expect(consignment.isValid()).is.true;

        });

    });

    context("Field validations", async function () {

        beforeEach( async function () {

            // Create a valid consignment, then set fields in tests directly
            consignment = new Consignment(market, marketHandler, seller, tokenAddress, tokenId, supply, id,  multiToken, released, releasedSupply, customFeePercentageBasisPoints, pendingPayout);
        });

        it("Always present, market must be equal to a Market enum value", async function() {

            // Invalid field value
            consignment.market = 12;
            expect(consignment.marketIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Invalid field value
            consignment.market = "zedzdeadbaby";
            expect(consignment.marketIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Valid field value
            consignment.market = Market.SECONDARY;
            expect(consignment.marketIsValid()).is.true;
            expect(consignment.isValid()).is.true;

            // Valid field value
            consignment.market = 0;
            expect(consignment.marketIsValid()).is.true;
            expect(consignment.isValid()).is.true;

        });

        it("Always present, market handler must be equal to a MarketHandler enum value", async function() {

            // Invalid field value
            consignment.marketHandler = 12;
            expect(consignment.marketHandlerIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Invalid field value
            consignment.marketHandler = "zedzdeadbaby";
            expect(consignment.marketHandlerIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Valid field value
            consignment.marketHandler = MarketHandler.UNHANDLED;
            expect(consignment.marketHandlerIsValid()).is.true;
            expect(consignment.isValid()).is.true;

            // Valid field value
            consignment.marketHandler = 0;
            expect(consignment.marketHandlerIsValid()).is.true;
            expect(consignment.isValid()).is.true;

        });

        it("Always present, seller  must be a string representation of an EIP-55 compliant address", async function() {

            // Invalid field value
            consignment.seller = "0xASFADF";
            expect(consignment.sellerIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Invalid field value
            consignment.seller = "zedzdeadbaby";
            expect(consignment.sellerIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Valid field value
            consignment.seller = accounts[0].address;
            expect(consignment.sellerIsValid()).is.true;
            expect(consignment.isValid()).is.true;

            // Valid field value
            consignment.seller = "0x7777788200B672A42421017F65EDE4Fc759564C8";
            expect(consignment.sellerIsValid()).is.true;
            expect(consignment.isValid()).is.true;

        });

        it("Always present, tokenAddress  must be a string representation of an EIP-55 compliant address", async function() {

            // Invalid field value
            consignment.tokenAddress = "0xASFADF";
            expect(consignment.tokenAddressIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Invalid field value
            consignment.tokenAddress = "zedzdeadbaby";
            expect(consignment.tokenAddressIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Valid field value
            consignment.tokenAddress = "0x7777788200B672A42421017F65EDE4Fc759564C8";
            expect(consignment.tokenAddressIsValid()).is.true;
            expect(consignment.isValid()).is.true;

        });

        it("Always present, tokenId must be the string representation of a BigNumber", async function() {

            // Invalid field value
            consignment.tokenId = 12;
            expect(consignment.tokenIdIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Invalid field value
            consignment.tokenId = "zedzdeadbaby";
            expect(consignment.tokenIdIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Valid field value
            consignment.tokenId = "0";
            expect(consignment.tokenIdIsValid()).is.true;
            expect(consignment.isValid()).is.true;

            // Valid field value
            consignment.tokenId = "126";
            expect(consignment.tokenIdIsValid()).is.true;
            expect(consignment.isValid()).is.true;

        });

        it("Always present, supply must be the string representation of a positive BigNumber", async function() {

            // Invalid field value
            consignment.supply = 20;
            expect(consignment.supplyIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Invalid field value
            consignment.supply = "0";
            expect(consignment.supplyIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Invalid field value
            consignment.supply = "zedzdeadbaby";
            expect(consignment.supplyIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Valid field value
            consignment.supply = "1";
            expect(consignment.supplyIsValid()).is.true;
            expect(consignment.isValid()).is.true;

            // Valid field value
            consignment.supply = "500";
            expect(consignment.supplyIsValid()).is.true;
            expect(consignment.isValid()).is.true;

        });

        it("Always present, id must be the string representation of a BigNumber", async function() {

            // Invalid field value
            consignment.id = 12;
            expect(consignment.idIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Invalid field value
            consignment.id = "zedzdeadbaby";
            expect(consignment.idIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Valid field value
            consignment.id = "0";
            expect(consignment.idIsValid()).is.true;
            expect(consignment.isValid()).is.true;

            // Valid field value
            consignment.id = "126";
            expect(consignment.idIsValid()).is.true;
            expect(consignment.isValid()).is.true;

        });

        it("Always present, multiToken must be a boolean", async function() {

            // Invalid field value
            consignment.multiToken = 12;
            expect(consignment.multiTokenIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Invalid field value
            consignment.multiToken = "zedzdeadbaby";
            expect(consignment.multiTokenIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Valid field value
            consignment.multiToken = false;
            expect(consignment.multiTokenIsValid()).is.true;
            expect(consignment.isValid()).is.true;

        });

        it("Always present, released must be a boolean", async function() {

            // Invalid field value
            consignment.released = 12;
            expect(consignment.releasedIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Invalid field value
            consignment.released = "zedzdeadbaby";
            expect(consignment.releasedIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Valid field value
            consignment.released = false;
            expect(consignment.releasedIsValid()).is.true;
            expect(consignment.isValid()).is.true;

        });

        it("Always present, releasedSupply must be the string representation of a BigNumber", async function() {

            // Invalid field value
            consignment.releasedSupply = 20;
            expect(consignment.releasedSupplyIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Invalid field value
            consignment.releasedSupply = "zedzdeadbaby";
            expect(consignment.releasedSupplyIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Valid field value
            consignment.releasedSupply = "0";
            expect(consignment.releasedSupplyIsValid()).is.true;
            expect(consignment.isValid()).is.true;

            // Valid field value
            consignment.releasedSupply = "500";
            expect(consignment.releasedSupplyIsValid()).is.true;
            expect(consignment.isValid()).is.true;

        });

        it("Always present, customFeePercentageBasisPoints must be the string representation of a BigNumber between 0 - 10000", async function() {

            // Invalid field value
            consignment.customFeePercentageBasisPoints = 20;
            expect(consignment.customFeePercentageBasisPointsIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Invalid field value
            consignment.customFeePercentageBasisPoints = "zedzdeadbaby";
            expect(consignment.customFeePercentageBasisPointsIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Invalid field value
            consignment.customFeePercentageBasisPoints = "10001";
            expect(consignment.customFeePercentageBasisPointsIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Valid field value
            consignment.customFeePercentageBasisPoints = "0";
            expect(consignment.customFeePercentageBasisPointsIsValid()).is.true;
            expect(consignment.isValid()).is.true;

            // Valid field value
            consignment.customFeePercentageBasisPoints = "10000";
            expect(consignment.customFeePercentageBasisPointsIsValid()).is.true;
            expect(consignment.isValid()).is.true;

            // Valid field value
            consignment.customFeePercentageBasisPoints = "5000";
            expect(consignment.customFeePercentageBasisPointsIsValid()).is.true;
            expect(consignment.isValid()).is.true;

        });

        it("Always present, pendingPayout must be the string representation of a BigNumber", async function() {

            // Invalid field value
            consignment.pendingPayout = 20;
            expect(consignment.pendingPayoutIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Invalid field value
            consignment.pendingPayout = "zedzdeadbaby";
            expect(consignment.pendingPayoutIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Valid field value
            consignment.pendingPayout = "0";
            expect(consignment.pendingPayoutIsValid()).is.true;
            expect(consignment.isValid()).is.true;

            // Valid field value
            consignment.pendingPayout = "100";
            expect(consignment.pendingPayoutIsValid()).is.true;
            expect(consignment.isValid()).is.true;

        });

    })

    context("Utility functions", async function () {

        beforeEach( async function () {

            // Create a valid Consignment instance, then operate on its methods in the tests
            consignment = new Consignment(market, marketHandler, seller, tokenAddress, tokenId, supply, id,  multiToken, released, releasedSupply, customFeePercentageBasisPoints, pendingPayout);

        })

        it("Consignment.fromObject() should return a Consignment instance with the same values as the given plain object", async function() {

            // Get plain object
            const object = {
                market, marketHandler, seller, tokenAddress: tokenAddress, tokenId, supply, id,  multiToken, released, releasedSupply, customFeePercentageBasisPoints, pendingPayout
            }

            // Promote to instance
            const promoted = Consignment.fromObject(object);

            // Is a Consignment instance
            expect(promoted instanceof Consignment).is.true;

            // Key values all match
            for (const [key, value] of Object.entries(consignment)) {
                expect(JSON.stringify(promoted[key]) === JSON.stringify(value)).is.true;
            }

        });

        it("instance.toString() should return a JSON string representation of the Consignment instance", async function() {

            const dehydrated = consignment.toString();
            const rehydrated = JSON.parse(dehydrated);

            for (const [key, value] of Object.entries(consignment)) {
                expect(JSON.stringify(rehydrated[key]) === JSON.stringify(value)).is.true;
            }

        });

        it("instance.clone() should return another Consignment instance with the same property values", async function() {

            // Get plain object
            const clone = consignment.clone();

            // Is an Consignment instance
            expect(clone instanceof Consignment).is.true;

            // Key values all match
            for (const [key, value] of Object.entries(consignment)) {
                expect(JSON.stringify(clone[key]) === JSON.stringify(value)).is.true;
            }

        });

        it("instance.toObject() should return a plain object representation of the Consignment instance", async function() {

            // Get plain object
            const object = consignment.toObject();

            // Not an Consignment instance
            expect(object instanceof Consignment).is.false;

            // Key values all match
            for (const [key, value] of Object.entries(consignment)) {
                expect(JSON.stringify(object[key]) === JSON.stringify(value)).is.true;
            }

        });

    })

});