const { expect } = require("chai");
const EscrowTicket = require("../../domain/EscrowTicket");
const Market = require("../../domain/Market");

describe("EscrowTicket", function() {

    // Shared args
    let accounts, escrowTicket;
    let tokenId, amount;

    before( async function () {

        // Make accounts available
        accounts = await ethers.getSigners();

    });

    context("Constructor", async function () {

        beforeEach( async function () {

            // Required constructor params
            tokenId = "100";
            amount = ethers.utils.parseUnits("1.5", "ether").toString();

        });

        it("Should allow creation of valid, fully populated EscrowTicket instance", async function () {

            const escrowTicket = new EscrowTicket(tokenId, amount);
            expect(escrowTicket.tokenIdIsValid()).is.true;
            expect(escrowTicket.amountIsValid()).is.true;
            expect(escrowTicket.isValid()).is.true;

        });

    });

    context("Field validations", async function () {

        beforeEach( async function () {

            // Set params to a fully valid EscrowTicket
            tokenId = "100";
            amount = ethers.utils.parseUnits("1.5", "ether").toString();

            // Create a valid escrowTicket, then set fields in tests directly
            escrowTicket = new EscrowTicket(tokenId, amount);
            expect(escrowTicket.isValid()).is.true;
        });

        it("Always present, tokenId must be the string representation of a BigNumber", async function() {

            // Invalid field value
            escrowTicket.tokenId = 12;
            expect(escrowTicket.tokenIdIsValid()).is.false;
            expect(escrowTicket.isValid()).is.false;

            // Invalid field value
            escrowTicket.tokenId = "zedzdeadbaby";
            expect(escrowTicket.tokenIdIsValid()).is.false;
            expect(escrowTicket.isValid()).is.false;

            // Valid field value
            escrowTicket.tokenId = "0";
            expect(escrowTicket.tokenIdIsValid()).is.true;
            expect(escrowTicket.isValid()).is.true;

            // Valid field value
            escrowTicket.tokenId = "126";
            expect(escrowTicket.tokenIdIsValid()).is.true;
            expect(escrowTicket.isValid()).is.true;

        });

        it("Always present, amount must be the string representation of a positive BigNumber", async function() {

            // Invalid field value
            escrowTicket.amount = 12;
            expect(escrowTicket.amountIsValid()).is.false;
            expect(escrowTicket.isValid()).is.false;

            // Invalid field value
            escrowTicket.amount = "zedzdeadbaby";
            expect(escrowTicket.amountIsValid()).is.false;
            expect(escrowTicket.isValid()).is.false;

            // Invalid field values
            escrowTicket.amount = "0";
            expect(escrowTicket.amountIsValid()).is.false;
            expect(escrowTicket.isValid()).is.false;

            // Valid field value
            escrowTicket.amount = "126";
            expect(escrowTicket.amountIsValid()).is.true;
            expect(escrowTicket.isValid()).is.true;

        });

    })

    context("Utility functions", async function () {

        beforeEach( async function () {

            // Set params to a fully valid EscrowTicket
            tokenId = "100";
            amount = ethers.utils.parseUnits("1.5", "ether").toString();

            // Create a valid EscrowTicket instance, then operate on its methods in the tests
            escrowTicket = new EscrowTicket(tokenId, amount);
            expect(escrowTicket.isValid()).is.true;

        })

        it("EscrowTicket.fromObject() should return a EscrowTicket instance with the same values as the given plain object", async function() {

            // Get plain object
            const object = {
                tokenId, amount
            }

            // Promote to instance
            const promoted = EscrowTicket.fromObject(object);

            // Is a EscrowTicket instance
            expect(promoted instanceof EscrowTicket).is.true;

            // Key values all match
            for (const [key, value] of Object.entries(escrowTicket)) {
                expect(JSON.stringify(promoted[key]) === JSON.stringify(value)).is.true;
            }

        });

        it("instance.toString() should return a JSON string representation of the EscrowTicket instance", async function() {

            const dehydrated = escrowTicket.toString();
            const rehydrated = JSON.parse(dehydrated);

            for (const [key, value] of Object.entries(escrowTicket)) {
                expect(JSON.stringify(rehydrated[key]) === JSON.stringify(value)).is.true;
            }

        });

        it("instance.clone() should return another EscrowTicket instance with the same property values", async function() {

            // Get plain object
            const clone = escrowTicket.clone();

            // Is an EscrowTicket instance
            expect(clone instanceof EscrowTicket).is.true;

            // Key values all match
            for (const [key, value] of Object.entries(escrowTicket)) {
                expect(JSON.stringify(clone[key]) === JSON.stringify(value)).is.true;
            }

        });

        it("instance.toObject() should return a plain object representation of the EscrowTicket instance", async function() {

            // Get plain object
            const object = escrowTicket.toObject();

            // Not an EscrowTicket instance
            expect(object instanceof EscrowTicket).is.false;

            // Key values all match
            for (const [key, value] of Object.entries(escrowTicket)) {
                expect(JSON.stringify(object[key]) === JSON.stringify(value)).is.true;
            }

        });

    })

});