const { expect } = require("chai");
const Sale = require("../../domain/Sale");
const State = require("../../domain/State");
const Outcome = require("../../domain/Outcome");

describe("Sale", function() {

    // Suite-wide scope
    let accounts, sale;
    let buyers, consignmentId, start, quantity, price, perTxCap, state, outcome;

    before( async function () {

        // Make accounts available
        accounts = await ethers.getSigners();

    });

    context("Constructor", async function () {

        beforeEach( async function () {

            // Minimum required constructor params
            consignmentId = "1";
            price = ethers.utils.parseUnits("1.5", "ether").toString();
            start = ethers.BigNumber.from(Date.now()).toString();
            quantity = "50";
            perTxCap = "1";
            state = State.ENDED;
            outcome = Outcome.CLOSED;
            
        });

        it("Should allow creation of valid, minimal Sale instance", async function () {

            // Buyers and perTxCap are not required, but validated if present
            buyers = null;
            perTxCap = null;

            sale = new Sale(buyers, consignmentId, start, quantity, price, perTxCap, state, outcome);
            expect(sale.buyersIsValid()).is.true;
            expect(sale.consignmentIdIsValid()).is.true;
            expect(sale.startIsValid()).is.true;
            expect(sale.quantityIsValid()).is.true;
            expect(sale.priceIsValid()).is.true;
            expect(sale.perTxCapIsValid()).is.true;
            expect(sale.stateIsValid()).is.true;
            expect(sale.outcomeIsValid()).is.true;
            expect(sale.isValid()).is.true;

        });

        it("Should allow creation of valid, fully populated Sale instance", async function () {

            // Buyers and perTxCap are not required, but validated if present
            buyers = ["0x7777788200B672A42421017F65EDE4Fc759564C8","0x495f947276749ce646f68ac9c248420045cb7b5e"];
            perTxCap = "1";

            sale = new Sale(buyers, consignmentId, start, quantity, price, perTxCap, state, outcome);
            expect(sale.buyersIsValid()).is.true;
            expect(sale.consignmentIdIsValid()).is.true;
            expect(sale.startIsValid()).is.true;
            expect(sale.quantityIsValid()).is.true;
            expect(sale.priceIsValid()).is.true;
            expect(sale.perTxCapIsValid()).is.true;
            expect(sale.stateIsValid()).is.true;
            expect(sale.outcomeIsValid()).is.true;
            expect(sale.isValid()).is.true;

        });

    });

    context("Field validations", async function () {

        beforeEach( async function () {

            // Set params to a fully valid Sale
            buyers = ["0x7777788200B672A42421017F65EDE4Fc759564C8","0x495f947276749ce646f68ac9c248420045cb7b5e"];
            consignmentId = "1";
            price = ethers.utils.parseUnits("1.5", "ether").toString();
            start = ethers.BigNumber.from(Date.now()).toString();
            quantity = "50";
            perTxCap = "1";
            state = State.ENDED;
            outcome = Outcome.CLOSED;

            // Create a valid sale, then set fields in tests directly
            sale = new Sale(buyers, consignmentId, start, quantity, price, perTxCap, state, outcome);
            expect(sale.isValid()).is.true;
        })

        it("If present, buyers must be an array strings that represent EIP-55 compliant addresses", async function() {

            // Invalid field value
            sale.buyers = ["tothamoonalice",9];
            expect(sale.buyersIsValid()).is.false;
            expect(sale.isValid()).is.false;

            // Valid field value
            sale.buyers = ["0x7777788200B672A42421017F65EDE4Fc759564C8","0x495f947276749ce646f68ac9c248420045cb7b5e"];
            expect(sale.buyersIsValid()).is.true;
            expect(sale.isValid()).is.true;

        });

        it("Always present, consignmentId must be the string representation of a BigNumber", async function() {

            // Invalid field value
            sale.consignmentId = 12;
            expect(sale.consignmentIdIsValid()).is.false;
            expect(sale.isValid()).is.false;

            // Invalid field value
            sale.consignmentId = "zedzdeadbaby";
            expect(sale.consignmentIdIsValid()).is.false;
            expect(sale.isValid()).is.false;

            // Valid field value
            sale.consignmentId = "0";
            expect(sale.consignmentIdIsValid()).is.true;
            expect(sale.isValid()).is.true;

            // Valid field value
            sale.consignmentId = "126";
            expect(sale.consignmentIdIsValid()).is.true;
            expect(sale.isValid()).is.true;

        });

        it("Always present, start must be the string representation of a positive BigNumber", async function() {

            // Invalid field value
            sale.start = 0;
            expect(sale.startIsValid()).is.false;
            expect(sale.isValid()).is.false;

            // Invalid field value
            sale.start = "0";
            expect(sale.startIsValid()).is.false;
            expect(sale.isValid()).is.false;

            // Invalid field value
            sale.start = "zedzdeadbaby";
            expect(sale.startIsValid()).is.false;
            expect(sale.isValid()).is.false;

            // Valid field value
            sale.start = Date.now().toString();
            expect(sale.startIsValid()).is.true;
            expect(sale.isValid()).is.true;

        });

        it("Always present, quantity must be the string representation of a positive BigNumber", async function() {

            // Invalid field value
            sale.quantity = 20;
            expect(sale.quantityIsValid()).is.false;
            expect(sale.isValid()).is.false;

            // Invalid field value
            sale.quantity = "0";
            expect(sale.quantityIsValid()).is.false;
            expect(sale.isValid()).is.false;

            // Invalid field value
            sale.quantity = "zedzdeadbaby";
            expect(sale.quantityIsValid()).is.false;
            expect(sale.isValid()).is.false;

            // Valid field value
            sale.quantity = "1";
            expect(sale.quantityIsValid()).is.true;
            expect(sale.isValid()).is.true;

            // Valid field value
            sale.quantity = "500";
            expect(sale.quantityIsValid()).is.true;
            expect(sale.isValid()).is.true;

        });

        it("Always present, price must be the string representation of a positive BigNumber", async function() {

            // Invalid field value
            sale.price = 20;
            expect(sale.priceIsValid()).is.false;
            expect(sale.isValid()).is.false;

            // Invalid field value
            sale.price = "0";
            expect(sale.priceIsValid()).is.false;
            expect(sale.isValid()).is.false;

            // Invalid field value
            sale.price = "zedzdeadbaby";
            expect(sale.priceIsValid()).is.false;
            expect(sale.isValid()).is.false;

            // Valid field value
            sale.price = "1";
            expect(sale.priceIsValid()).is.true;
            expect(sale.isValid()).is.true;

            // Valid field value
            sale.price = ethers.utils.parseUnits("2.3", "ether").toString();
            expect(sale.priceIsValid()).is.true;
            expect(sale.isValid()).is.true;

        });

        it("If present, perTxCap must be the string representation of a positive BigNumber", async function() {

            // Invalid field value
            sale.perTxCap = 20;
            expect(sale.perTxCapIsValid()).is.false;
            expect(sale.isValid()).is.false;

            // Invalid field value
            sale.perTxCap = "0";
            expect(sale.perTxCapIsValid()).is.false;
            expect(sale.isValid()).is.false;

            // Invalid field value
            sale.perTxCap = "zedzdeadbaby";
            expect(sale.perTxCapIsValid()).is.false;
            expect(sale.isValid()).is.false;

            // Valid field value
            sale.perTxCap = "1";
            expect(sale.perTxCapIsValid()).is.true;
            expect(sale.isValid()).is.true;

            // Valid field value
            sale.perTxCap = null;
            expect(sale.perTxCapIsValid()).is.true;
            expect(sale.isValid()).is.true;

        });

        it("Always present, state must be equal to a State enum value", async function() {

            // Invalid field value
            sale.state = 20;
            expect(sale.stateIsValid()).is.false;
            expect(sale.isValid()).is.false;

            // Invalid field value
            sale.state = "zedzdeadbaby";
            expect(sale.stateIsValid()).is.false;
            expect(sale.isValid()).is.false;

            // Valid field value
            sale.state = State.RUNNING;
            expect(sale.stateIsValid()).is.true;
            expect(sale.isValid()).is.true;

            // Valid field value
            sale.state = 1;
            expect(sale.stateIsValid()).is.true;
            expect(sale.isValid()).is.true;


        });

        it("Always present, outcome must be equal to a Outcome enum value", async function() {

            // Invalid field value
            sale.outcome = 20;
            expect(sale.outcomeIsValid()).is.false;
            expect(sale.isValid()).is.false;

            // Invalid field value
            sale.outcome = "zedzdeadbaby";
            expect(sale.outcomeIsValid()).is.false;
            expect(sale.isValid()).is.false;

            // Valid field value
            sale.outcome = Outcome.PULLED;
            expect(sale.outcomeIsValid()).is.true;
            expect(sale.isValid()).is.true;

            // Valid field value
            sale.outcome = 2;
            expect(sale.outcomeIsValid()).is.true;
            expect(sale.isValid()).is.true;

        });

    })

    context("Utility functions", async function () {

        beforeEach( async function () {

            // Set params to a fully valid Sale
            buyers = ["0x7777788200B672A42421017F65EDE4Fc759564C8","0x495f947276749ce646f68ac9c248420045cb7b5e"];
            consignmentId = "1";
            price = ethers.utils.parseUnits("1.5", "ether").toString();
            start = ethers.BigNumber.from(Date.now()).toString();
            quantity = "50";
            perTxCap = "1";
            state = State.ENDED;
            outcome = Outcome.CLOSED;

            // Create a valid Sale instance, then operate on its methods in the tests
            sale = new Sale(buyers, consignmentId, start, quantity, price, perTxCap, state, outcome);
            expect(sale.isValid()).is.true;
        })

        it("Sale.fromObject() should return a Sale instance with the same values as the given plain object", async function() {

            // Get plain object
            const object = {
                buyers, consignmentId, start, quantity, price, perTxCap, state, outcome
            }

            // Promote to instance
            const promoted = Sale.fromObject(object);

            // Is a Consignment instance
            expect(promoted instanceof Sale).is.true;

            // Key values all match
            for (const [key, value] of Object.entries(sale)) {
                expect(JSON.stringify(promoted[key]) === JSON.stringify(value)).is.true;
            }

        });

        it("instance.toString() should return a JSON string representation of the Sale instance", async function() {

            const dehydrated = sale.toString();
            const rehydrated = JSON.parse(dehydrated);

            for (const [key, value] of Object.entries(sale)) {
                expect(JSON.stringify(rehydrated[key]) === JSON.stringify(value)).is.true;
            }

        });

        it("instance.clone() should return another Sale instance with the same property values", async function() {

            // Get plain object
            const clone = sale.clone();

            // Is an Sale instance
            expect(clone instanceof Sale).is.true;

            // Key values all match
            for (const [key, value] of Object.entries(sale)) {
                expect(JSON.stringify(clone[key]) === JSON.stringify(value)).is.true;
            }

        });

        it("instance.toObject() should return a plain object representation of the Sale instance", async function() {

            // Get plain object
            const object = sale.toObject();

            // Not an Sale instance
            expect(object instanceof Sale).is.false;

            // Key values all match
            for (const [key, value] of Object.entries(sale)) {
                expect(JSON.stringify(object[key]) === JSON.stringify(value)).is.true;
            }

        });

    })

});