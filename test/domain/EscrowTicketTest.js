const { expect } = require("chai");
const EscrowTicket = require("../../domain/EscrowTicket");

/**
 *  Test the EscrowTicket domain object
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
describe("EscrowTicket", function() {

    // Suite-wide scope
    let accounts, escrowTicket;
    let id, consignmentId, amount, itemURI;

    before( async function () {

        // Make accounts available
        accounts = await ethers.getSigners();

    });

    context("Constructor", async function () {

        beforeEach( async function () {

            // Required constructor params
            id = "0";
            consignmentId = "100";
            amount = ethers.utils.parseUnits("1.5", "ether").toString();
            itemURI = "ipfs://QmXBB6qm5vopwJ6ddxb1mEr1Pp87AHd3BUgVbsipCf9hWU";

        });

        it("Should allow creation of valid, fully populated EscrowTicket instance", async function () {

            escrowTicket = new EscrowTicket(id, consignmentId, amount, itemURI);
            expect(escrowTicket.idIsValid()).is.true;
            expect(escrowTicket.consignmentIdIsValid()).is.true;
            expect(escrowTicket.amountIsValid()).is.true;
            expect(escrowTicket.itemUriIsValid()).is.true;
            expect(escrowTicket.isValid()).is.true;

        });

    });

    context("Field validations", async function () {

        beforeEach( async function () {

            // Set params to a fully valid EscrowTicket
            consignmentId = "100";
            amount = ethers.utils.parseUnits("1.5", "ether").toString();

            // Create a valid escrowTicket, then set fields in tests directly
            escrowTicket = new EscrowTicket(id, consignmentId, amount, itemURI);
            expect(escrowTicket.isValid()).is.true;
        });

        it("Always present, id must be the string representation of a BigNumber", async function() {

            // Invalid field value
            escrowTicket.id = 12;
            expect(escrowTicket.idIsValid()).is.false;
            expect(escrowTicket.isValid()).is.false;

            // Invalid field value
            escrowTicket.id = "zedzdeadbaby";
            expect(escrowTicket.idIsValid()).is.false;
            expect(escrowTicket.isValid()).is.false;

            // Valid field value
            escrowTicket.id = "0";
            expect(escrowTicket.idIsValid()).is.true;
            expect(escrowTicket.isValid()).is.true;

            // Valid field value
            escrowTicket.id = "126";
            expect(escrowTicket.idIsValid()).is.true;
            expect(escrowTicket.isValid()).is.true;

        });

        it("Always present, consignmentId must be the string representation of a BigNumber", async function() {

            // Invalid field value
            escrowTicket.consignmentId = 12;
            expect(escrowTicket.consignmentIdIsValid()).is.false;
            expect(escrowTicket.isValid()).is.false;

            // Invalid field value
            escrowTicket.consignmentId = "zedzdeadbaby";
            expect(escrowTicket.consignmentIdIsValid()).is.false;
            expect(escrowTicket.isValid()).is.false;

            // Valid field value
            escrowTicket.consignmentId = "0";
            expect(escrowTicket.consignmentIdIsValid()).is.true;
            expect(escrowTicket.isValid()).is.true;

            // Valid field value
            escrowTicket.consignmentId = "126";
            expect(escrowTicket.consignmentIdIsValid()).is.true;
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

        it("Always present, itemURI must be a non-empty string", async function() {

            // Invalid field value
            escrowTicket.itemURI = 12;
            expect(escrowTicket.itemUriIsValid()).is.false;
            expect(escrowTicket.isValid()).is.false;

            // Valid field value
            escrowTicket.itemURI = "zedzdeadbaby";
            expect(escrowTicket.itemUriIsValid()).is.true;
            expect(escrowTicket.isValid()).is.true;

            // Valid field value
            escrowTicket.itemURI = "https://ipfs.io/ipfs/QmXBB6qm5vopwJ6ddxb1mEr1Pp87AHd3BUgVbsipCf9hWU";
            expect(escrowTicket.itemUriIsValid()).is.true;
            expect(escrowTicket.isValid()).is.true;

        });

    })

    context("Utility functions", async function () {

        beforeEach( async function () {

            // Set params to a fully valid EscrowTicket
            consignmentId = "100";
            amount = ethers.utils.parseUnits("1.5", "ether").toString();

            // Create a valid EscrowTicket instance, then operate on its methods in the tests
            escrowTicket = new EscrowTicket(id, consignmentId, amount, itemURI);
            expect(escrowTicket.isValid()).is.true;

        })

        it("EscrowTicket.fromObject() should return a EscrowTicket instance with the same values as the given plain object", async function() {

            // Get plain object
            const object = {
                id, consignmentId, amount, itemURI
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