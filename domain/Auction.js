/**
 * Domain Entity: Auction
 * @author Cliff Hall <cliff@futurescale.com>
 */
const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');
const eip55 = require("eip55");
const Clock = require("./Clock");
const State = require("./State");
const Outcome = require("./Outcome");

class Auction {

    constructor (buyer, consignmentId, start, duration, reserve, bid, clock, state, outcome) {
        this.buyer = buyer;
        this.consignmentId = consignmentId;
        this.start = start;
        this.duration = duration;
        this.reserve = reserve;
        this.bid = bid;
        this.clock = clock;
        this.state = state;
        this.outcome = outcome;
    }

    /**
     * Get a new Auction instance from a database representation
     * @param o
     * @returns {Auction}
     */
    static fromObject(o) {
        const {buyer, consignmentId, start, duration, reserve, bid, clock, state, outcome} = o;
        return new Auction(buyer, consignmentId, start, duration, reserve, bid, clock, state, outcome);
    }

    /**
     * Get a database representation of this Auction instance
     * @returns {object}
     */
    toObject() {
        return JSON.parse(JSON.stringify(this));
    }

    /**
     * Get a string representation of this Auction instance
     * @returns {string}
     */
    toString() {
        const {buyer, consignmentId, start, duration, reserve, bid, clock, state, outcome} = this;
        return [
            buyer, consignmentId, start, duration, reserve, bid, clock, state, outcome
        ].join(', ');
    }

    /**
     * Is this Auction instance's buyer field valid?
     * If present, must be a eip55 compliant Ethereum address
     * @returns {boolean}
     */
    buyerIsValid() {
        let valid = false;
        let {buyer} = this;
        try {
            valid = (
                buyer === undefined ||
                buyer === null ||
                eip55.verify(buyer)
            );
        } catch (e) {}
        return valid;
    }

    /**
     * Is this Auction instance's consignmentId field valid?
     * Must be a number
     * @returns {boolean}
     */
    consignmentIdIsValid() {
        let {consignmentId} = this;
        return typeof consignmentId === "number";
    }

    /**
     * Is this Auction instance's start field valid?
     * Must be a positive number
     * @returns {boolean}
     */
    startIsValid() {
        let {start} = this;
        return typeof start === "number" && start > 0;
    }

    /**
     * Is this Auction instance's duration field valid?
     * Must be a number
     * @returns {boolean}
     */
    durationIsValid() {
        let {duration} = this;
        return typeof duration === "number";
    }

    /**
     * Is this Auction instance's reserve field valid?
     * Must be a number
     * @returns {boolean}
     */
    reserveIsValid() {
        let {reserve} = this;
        return typeof reserve === "number";
    }

    /**
     * Is this Auction instance's bid field valid?
     * If present, must be a positive number
     * @returns {boolean}
     */
    bidIsValid() {
        let {bid} = this;
        let valid = (
            bid === undefined ||
            bid === null ||
            (typeof bid === "number" && bid > 0)
        );
        return valid;
    }

    /**
     * Is this Auction instance's clock field valid?
     * @returns {boolean}
     */
    clockIsValid() {
        let valid = false;
        let {clock} = this;
        try {
            valid = (
                Clock.Clocks.includes(clock)
            );
        } catch (e) {}
        return valid;
    }

    /**
     * Is this Auction instance's state field valid?
     * @returns {boolean}
     */
    stateIsValid() {
        let valid = false;
        let {state} = this;
        try {
            valid = (
                State.States.includes(state)
            );
        } catch (e) {}
        return valid;
    }

    /**
     * Is this Auction instance's outcome field valid?
     * @returns {boolean}
     */
    outcomeIsValid() {
        let valid = false;
        let {outcome} = this;
        try {
            valid = (
                Outcome.Outcomes.includes(outcome)
            );
        } catch (e) {}
        return valid;
    }

    /**
     * Is this Auction instance valid?
     * @returns {boolean}
     */
    isValid() {
        return (
            this.buyerIsValid() &&
            this.consignmentIdIsValid() &&
            this.startIsValid() &&
            this.durationIsValid() &&
            this.reserveIsValid() &&
            this.bidIsValid() &&
            this.clockIsValid() &&
            this.stateIsValid() &&
            this.outcomeIsValid()
        );
    };

    /**
     * Clone this Auction
     * @returns {Auction}
     */
    clone () {
       return Auction.fromObject(this.toObject());
    }

}

// Export
if (NODE) {
    module.exports = Auction;
} else {
    window.Auction = Auction;
}