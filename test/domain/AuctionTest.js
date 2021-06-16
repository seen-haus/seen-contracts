const { expect } = require("chai");
const Auction = require("../../domain/Auction");
const Clock = require("../../domain/Clock");
const State = require("../../domain/State");
const Outcome = require("../../domain/Outcome");

describe("Auction", function() {

    // Suite-wide scope
    let accounts, auction;
    let buyer, consignmentId, start, duration, reserve, bid, clock, state, outcome;

    before( async function () {

        // Make accounts available
        accounts = await ethers.getSigners();

    });

    context("Constructor", async function () {

        beforeEach( async function () {

            // Minimum required constructor params
            consignmentId = "1";
            reserve = ethers.utils.parseUnits("1.5", "ether").toString();
            start = ethers.BigNumber.from(Date.now()).toString();
            duration = '86400000'; // 24 hrs
            clock = Clock.TRIGGERED;
            state = State.ENDED;
            outcome = Outcome.CLOSED;

        });

        it("Should allow creation of valid, minimal Auction instance", async function () {

            // Buyer and bid are not required, but validated if present
            buyer = null;
            bid = null;

            auction = new Auction(buyer, consignmentId, start, duration, reserve, bid, clock, state, outcome);

            expect(auction.buyerIsValid()).is.true;
            expect(auction.consignmentIdIsValid()).is.true;
            expect(auction.startIsValid()).is.true;
            expect(auction.durationIsValid()).is.true;
            expect(auction.reserveIsValid()).is.true;
            expect(auction.bidIsValid()).is.true;
            expect(auction.clockIsValid()).is.true;
            expect(auction.stateIsValid()).is.true;
            expect(auction.outcomeIsValid()).is.true;
            expect(auction.isValid()).is.true;

        });

        it("Should allow creation of valid, fully populated Auction instance", async function () {

            // Buyer and bid are not required, but validated if present
            buyer = accounts[0].address;
            bid = ethers.utils.parseUnits("1.75", "ether").toString();

            auction = new Auction(buyer, consignmentId, start, duration, reserve, bid, clock, state, outcome);

            expect(auction.buyerIsValid()).is.true;
            expect(auction.consignmentIdIsValid()).is.true;
            expect(auction.startIsValid()).is.true;
            expect(auction.durationIsValid()).is.true;
            expect(auction.reserveIsValid()).is.true;
            expect(auction.bidIsValid()).is.true;
            expect(auction.clockIsValid()).is.true;
            expect(auction.stateIsValid()).is.true;
            expect(auction.outcomeIsValid()).is.true;
            expect(auction.isValid()).is.true;

        });

    });

    context("Field validations", async function () {

        beforeEach( async function () {

            // Set params to a fully valid Auction
            buyer = accounts[0].address;
            bid = ethers.utils.parseUnits("1.75", "ether").toString();
            consignmentId = "1";
            reserve = ethers.utils.parseUnits("1.5", "ether").toString();
            start = ethers.BigNumber.from(Date.now()).toString();
            duration = '86400000'; // 24 hrs
            clock = Clock.TRIGGERED;
            state = State.ENDED;
            outcome = Outcome.CLOSED;

            // Create a valid Auction instance, then operate on its methods in the tests
            auction = new Auction(buyer, consignmentId, start, duration, reserve, bid, clock, state, outcome);
            expect(auction.isValid()).is.true;
        })

        it("If present, buyer must be a string representation of an EIP-55 compliant address", async function() {

            // Invalid field value
            auction.buyer = "0xASFADF";
            expect(auction.buyerIsValid()).is.false;
            expect(auction.isValid()).is.false;

            // Valid field value
            auction.buyer = accounts[0].address;
            expect(auction.buyerIsValid()).is.true;
            expect(auction.isValid()).is.true;

            // Valid field value
            auction.buyer = accounts[0].address.toLowerCase();
            expect(auction.buyerIsValid()).is.true;
            expect(auction.isValid()).is.true;


        });

        it("Always present, consignmentId must be the string representation of a BigNumber", async function() {

            // Invalid field value
            auction.consignmentId = 12;
            expect(auction.consignmentIdIsValid()).is.false;
            expect(auction.isValid()).is.false;

            // Invalid field value
            auction.consignmentId = "zedzdeadbaby";
            expect(auction.consignmentIdIsValid()).is.false;
            expect(auction.isValid()).is.false;

            // Valid field value
            auction.consignmentId = "0";
            expect(auction.consignmentIdIsValid()).is.true;
            expect(auction.isValid()).is.true;

            // Valid field value
            auction.consignmentId = "126";
            expect(auction.consignmentIdIsValid()).is.true;
            expect(auction.isValid()).is.true;

        });

        it("Always present, start must be the string representation of a positive BigNumber", async function() {

            // Invalid field value
            auction.start = 0;
            expect(auction.startIsValid()).is.false;
            expect(auction.isValid()).is.false;

            // Invalid field value
            auction.start = "0";
            expect(auction.startIsValid()).is.false;
            expect(auction.isValid()).is.false;

            // Invalid field value
            auction.start = "zedzdeadbaby";
            expect(auction.startIsValid()).is.false;
            expect(auction.isValid()).is.false;

            // Valid field value
            auction.start = Date.now().toString();
            expect(auction.startIsValid()).is.true;
            expect(auction.isValid()).is.true;

        });

        it("Always present, duration must be the string representation of a positive BigNumber", async function() {

            // Invalid field value
            auction.duration = 20;
            expect(auction.durationIsValid()).is.false;
            expect(auction.isValid()).is.false;

            // Invalid field value
            auction.duration = "0";
            expect(auction.durationIsValid()).is.false;
            expect(auction.isValid()).is.false;

            // Invalid field value
            auction.duration = "zedzdeadbaby";
            expect(auction.durationIsValid()).is.false;
            expect(auction.isValid()).is.false;

            // Valid field value
            auction.duration = "1";
            expect(auction.durationIsValid()).is.true;
            expect(auction.isValid()).is.true;

        });

        it("Always present, reserve must be the string representation of a positive BigNumber", async function() {

            // Invalid field value
            auction.reserve = 20;
            expect(auction.reserveIsValid()).is.false;
            expect(auction.isValid()).is.false;

            // Invalid field value
            auction.reserve = "0";
            expect(auction.reserveIsValid()).is.false;
            expect(auction.isValid()).is.false;

            // Invalid field value
            auction.reserve = "zedzdeadbaby";
            expect(auction.reserveIsValid()).is.false;
            expect(auction.isValid()).is.false;

            // Valid field value
            auction.reserve = "1";
            expect(auction.reserveIsValid()).is.true;
            expect(auction.isValid()).is.true;

            // Valid field value
            auction.reserve = ethers.utils.parseUnits("1.75", "ether").toString();
            expect(auction.reserveIsValid()).is.true;
            expect(auction.isValid()).is.true;

        });

        it("If present, bid must be the string representation of a positive BigNumber", async function() {

            // Invalid field value
            auction.bid = 20;
            expect(auction.bidIsValid()).is.false;
            expect(auction.isValid()).is.false;

            // Invalid field value
            auction.bid = "zedzdeadbaby";
            expect(auction.bidIsValid()).is.false;
            expect(auction.isValid()).is.false;

            // Valid field value
            auction.bid = "0";
            expect(auction.bidIsValid()).is.true;
            expect(auction.isValid()).is.true;

            // Valid field value
            auction.bid = "1";
            expect(auction.bidIsValid()).is.true;
            expect(auction.isValid()).is.true;

            // Valid field value
            auction.bid = ethers.utils.parseUnits("1.75", "ether").toString();
            expect(auction.bidIsValid()).is.true;
            expect(auction.isValid()).is.true;

        });

        it("Always present, clock must be equal to a Clock enum value", async function() {

            // Invalid field value
            auction.clock = 20;
            expect(auction.clockIsValid()).is.false;
            expect(auction.isValid()).is.false;

            // Invalid field value
            auction.clock = Date.now();
            expect(auction.clockIsValid()).is.false;
            expect(auction.isValid()).is.false;

            // Invalid field value
            auction.clock = "zedzdeadbaby";
            expect(auction.clockIsValid()).is.false;
            expect(auction.isValid()).is.false;

            // Valid field value
            auction.clock = Clock.TRIGGERED;
            expect(auction.clockIsValid()).is.true;
            expect(auction.isValid()).is.true;

            // Valid field value
            auction.clock = 0;
            expect(auction.clockIsValid()).is.true;
            expect(auction.isValid()).is.true;

        });

        it("Always present, state must be equal to a State enum value", async function() {

            // Invalid field value
            auction.state = 20;
            expect(auction.stateIsValid()).is.false;
            expect(auction.isValid()).is.false;

            // Invalid field value
            auction.state = "zedzdeadbaby";
            expect(auction.stateIsValid()).is.false;
            expect(auction.isValid()).is.false;

            // Valid field value
            auction.state = State.RUNNING;
            expect(auction.stateIsValid()).is.true;
            expect(auction.isValid()).is.true;

            // Valid field value
            auction.state = 1;
            expect(auction.stateIsValid()).is.true;
            expect(auction.isValid()).is.true;


        });

        it("Always present, outcome must be equal to a Outcome enum value", async function() {

            // Invalid field value
            auction.outcome = 20;
            expect(auction.outcomeIsValid()).is.false;
            expect(auction.isValid()).is.false;

            // Invalid field value
            auction.outcome = "zedzdeadbaby";
            expect(auction.outcomeIsValid()).is.false;
            expect(auction.isValid()).is.false;

            // Valid field value
            auction.outcome = Outcome.PULLED;
            expect(auction.outcomeIsValid()).is.true;
            expect(auction.isValid()).is.true;

            // Valid field value
            auction.outcome = 2;
            expect(auction.outcomeIsValid()).is.true;
            expect(auction.isValid()).is.true;

        });

    })

    context("Utility functions", async function () {

        beforeEach( async function () {

            // Set params to a fully valid Auction
            buyer = accounts[0].address;
            bid = ethers.utils.parseUnits("1.75", "ether").toString();
            consignmentId = "1";
            reserve = ethers.utils.parseUnits("1.5", "ether").toString();
            start = ethers.BigNumber.from(Date.now()).toString();
            duration = '86400000'; // 24 hrs
            clock = Clock.TRIGGERED;
            state = State.ENDED;
            outcome = Outcome.CLOSED;

            // Create a valid auction, then set fields in tests directly
            auction = new Auction(buyer, consignmentId, start, duration, reserve, bid, clock, state, outcome);
            expect(auction.isValid()).is.true;
        })

        it("Auction.fromObject() should return a Auction instance with the same values as the given plain object", async function() {

            // Get plain object
            const object = {
                buyer, consignmentId, start, duration, reserve, bid, clock, state, outcome
            }

            // Promote to instance
            const promoted = Auction.fromObject(object);

            // Is a Consignment instance
            expect(promoted instanceof Auction).is.true;

            // Key values all match
            for (const [key, value] of Object.entries(auction)) {
                expect(JSON.stringify(promoted[key]) === JSON.stringify(value)).is.true;
            }

        });

        it("instance.toString() should return a JSON string representation of the Auction instance", async function() {

            const dehydrated = auction.toString();
            const rehydrated = JSON.parse(dehydrated);

            for (const [key, value] of Object.entries(auction)) {
                expect(JSON.stringify(rehydrated[key]) === JSON.stringify(value)).is.true;
            }

        });

        it("instance.clone() should return another Auction instance with the same property values", async function() {

            // Get plain object
            const clone = auction.clone();

            // Is an Auction instance
            expect(clone instanceof Auction).is.true;

            // Key values all match
            for (const [key, value] of Object.entries(auction)) {
                expect(JSON.stringify(clone[key]) === JSON.stringify(value)).is.true;
            }

        });

        it("instance.toObject() should return a plain object representation of the Auction instance", async function() {

            // Get plain object
            const object = auction.toObject();

            // Not an Auction instance
            expect(object instanceof Auction).is.false;

            // Key values all match
            for (const [key, value] of Object.entries(auction)) {
                expect(JSON.stringify(object[key]) === JSON.stringify(value)).is.true;
            }

        });

    })

});