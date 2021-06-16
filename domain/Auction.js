/**
 * Domain Entity: Auction
 * @author Cliff Hall <cliff@futurescale.com>
 */
const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');
const ethers = require("ethers");
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
        return JSON.parse(this.toString());
    }

    /**
     * Get a string representation of this Auction instance
     * @returns {string}
     */
    toString() {
        return JSON.stringify(this);
    }

    /**
     * Clone this Auction
     * @returns {Auction}
     */
    clone () {
        return Auction.fromObject(this.toObject());
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
                eip55.verify(buyer) ||
                eip55.verify(eip55.encode(buyer))
            );
        } catch (e) {}
        return valid;
    }

    /**
     * Is this Auction instance's consignmentId field valid?
     * Must be a string that converts to a BigNumber greater than or equal to zero
     * @returns {boolean}
     */
    consignmentIdIsValid() {
        let {consignmentId} = this;
        let valid = false;
        try {
            valid = (
                typeof consignmentId === "string" &&
                ethers.BigNumber.from(consignmentId).gte("0")
            )
        } catch(e){}
        return valid;
    }

    /**
     * Is this Auction instance's start field valid?
     * Must be a string that converts to a valid, positive BigNumber
     * @returns {boolean}
     */
    startIsValid() {
        let {start} = this;
        let valid = false;
        try {
            valid = (
                typeof start === "string" &&
                ethers.BigNumber.from(start).gt("0")
            )
        } catch(e){}
        return valid;
    }

    /**
     * Is this Auction instance's duration field valid?
     * Must be a string that converts to a valid, positive BigNumber
     * @returns {boolean}
     */
    durationIsValid() {
        let {duration} = this;
        let valid = false;
        try {
            valid = (
                typeof duration === "string" &&
                ethers.BigNumber.from(duration).gt("0")
            )
        } catch(e){}
        return valid;
    }

    /**
     * Is this Auction instance's reserve field valid?
     * Must be a string that converts to a valid, positive BigNumber
     * @returns {boolean}
     */
    reserveIsValid() {
        let {reserve} = this;
        let valid = false;
        try {
            valid = (
                typeof reserve === "string" &&
                ethers.BigNumber.from(reserve).gt("0")
            )
        } catch(e){}
        return valid;
    }

    /**
     * Is this Auction instance's bid field valid?
     * If present, must be a string that converts to a valid BigNumber
     * @returns {boolean}
     */
    bidIsValid() {
        let {bid} = this;
        let valid = false;
        try {
            valid = (
                bid === undefined ||
                bid === null ||
                (
                    typeof bid === "string" &&
                    ethers.BigNumber.from(bid).gte("0")
                )
            )
        } catch(e){}
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

}

// Export
if (NODE) {
    module.exports = Auction;
} else {
    window.Auction = Auction;
}