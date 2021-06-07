const { expect } = require("chai");
const Consignment = require("../../domain/Consignment");
const Market = require("../../domain/Market");

describe("Consignment", function() {

    // Shared args
    let accounts, consignment;
    let market, seller, token, tokenId, id;

    before( async function () {

        // Make accounts available
        accounts = await ethers.getSigners();

    });

    context("Constructor", async function () {

        beforeEach( async function () {

            // Required constructor params
            market = Market.PRIMARY;
            seller = accounts[0].address;
            token = "0x7777788200B672A42421017F65EDE4Fc759564C8";
            tokenId = "100";
            id = "1";
            
        });

        it("Should allow creation of valid, fully populated Consignment instance", async function () {

            const consignment = new Consignment(market, seller, token, tokenId, id);
            expect(consignment.marketIsValid()).is.true;
            expect(consignment.sellerIsValid()).is.true;
            expect(consignment.tokenIsValid()).is.true;
            expect(consignment.tokenIdIsValid()).is.true;
            expect(consignment.idIsValid()).is.true;
            expect(consignment.isValid()).is.true;

        });

    });

    context("Field validations", async function () {

        beforeEach( async function () {

            // Set params to a fully valid Consignment
            market = Market.PRIMARY;
            seller = accounts[0].address;
            token = "0x7777788200B672A42421017F65EDE4Fc759564C8";
            tokenId = "100";
            id = "1";

            // Create a valid consignment, then set fields in tests directly
            consignment = new Consignment(market, seller, token, tokenId, id);
            expect(consignment.isValid()).is.true;
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

        it("Always present, token  must be a string representation of an EIP-55 compliant address", async function() {

            // Invalid field value
            consignment.token = "0xASFADF";
            expect(consignment.tokenIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Invalid field value
            consignment.token = "zedzdeadbaby";
            expect(consignment.tokenIsValid()).is.false;
            expect(consignment.isValid()).is.false;

            // Valid field value
            consignment.token = "0x7777788200B672A42421017F65EDE4Fc759564C8";
            expect(consignment.tokenIsValid()).is.true;
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

    })

    context("Utility functions", async function () {

        beforeEach( async function () {

            // Set params to a fully valid Consignment
            market = Market.PRIMARY;
            seller = accounts[0].address;
            token = "0x7777788200B672A42421017F65EDE4Fc759564C8";
            tokenId = "100";
            id = "1";

            // Create a valid Consignment instance, then operate on its methods in the tests
            consignment = new Consignment(market, seller, token, tokenId, id);
            expect(consignment.isValid()).is.true;

        })

        it("Consignment.fromObject() should return a Consignment instance with the same values as the given plain object", async function() {

            // Get plain object
            const object = {
                market, seller, token, tokenId, id
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