const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');
const ethers = require("ethers");
const eip55 = require("eip55");
const State = require("./State");
const Outcome = require("./Outcome");

/**
 * Domain Entity: Sale
 *
 * See: {SeenTypes.Sale}
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
class Sale {

    constructor (consignmentId, start, price, perTxCap, state, outcome) {
        this.consignmentId = consignmentId;
        this.start = start;
        this.price = price;
        this.perTxCap = perTxCap;
        this.state = state;
        this.outcome = outcome;
    }

    /**
     * Get a new Sale instance from a database representation
     * @param o
     * @returns {Sale}
     */
    static fromObject(o) {
        const {consignmentId, start, price, perTxCap, state, outcome} = o;
        return new Sale(consignmentId, start, price, perTxCap, state, outcome);
    }

    /**
     * Get a database representation of this Sale instance
     * @returns {object}
     */
    toObject() {
        return JSON.parse(this.toString());
    }

    /**
     * Get a string representation of this Sale instance
     * @returns {string}
     */
    toString() {
        return JSON.stringify(this);
    }

    /**
     * Clone this Sale
     * @returns {Sale}
     */
    clone () {
        return Sale.fromObject(this.toObject());
    }

    /**
     * Is this Sale instance's consignmentId field valid?
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
     * Is this Sale instance's start field valid?
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
     * Is this Sale instance's price field valid?
     * Must be a string that converts to a valid, positive BigNumber
     * @returns {boolean}
     */
    priceIsValid() {
        let {price} = this;
        let valid = false;
        try {
            valid = (
                typeof price === "string" &&
                ethers.BigNumber.from(price).gt("0")
            )
        } catch(e){}
        return valid;
    }

    /**
     * Is this Sale instance's perTxCap field valid?
     * Must be a string that converts to a valid, positive BigNumber
     * @returns {boolean}
     */
    perTxCapIsValid() {
        let {perTxCap} = this;
        let valid = false;
        try {
            valid = (
                perTxCap === undefined ||
                perTxCap === null ||
                (
                    typeof perTxCap === "string" &&
                    ethers.BigNumber.from(perTxCap).gt("0")
                )
            )
        } catch(e){}
        return valid;
    }

    /**
     * Is this Sale instance's state field valid?
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
     * Is this Sale instance's outcome field valid?
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
     * Is this Sale instance valid?
     * @returns {boolean}
     */
    isValid() {
        return (
            this.consignmentIdIsValid() &&
            this.startIsValid() &&
            this.priceIsValid() &&
            this.perTxCapIsValid() &&
            this.stateIsValid() &&
            this.outcomeIsValid()
        );
    };

}

// Export
if (NODE) {
    module.exports = Sale;
} else {
    window.Sale = Sale;
}