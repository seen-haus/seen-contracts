/**
 * Domain Entity: Sale
 * @author Cliff Hall <cliff@futurescale.com>
 */
const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');
const eip55 = require("eip55");
const State = require("./State");
const Outcome = require("./Outcome");

class Sale {

    constructor (buyers, consignmentId, start, quantity, price, perTxCap, state, outcome) {
        this.buyers = buyers;
        this.consignmentId = consignmentId;
        this.start = start;
        this.quantity = quantity;
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
        const {buyers, consignmentId, start, quantity, price, perTxCap, state, outcome} = o;
        return new Sale(buyers, consignmentId, start, quantity, price, perTxCap, state, outcome);
    }

    /**
     * Get a database representation of this Sale instance
     * @returns {object}
     */
    toObject() {
        return JSON.parse(JSON.stringify(this));
    }

    /**
     * Get a string representation of this Sale instance
     * @returns {string}
     */
    toString() {
        const {buyers, consignmentId, start, quantity, price, perTxCap, state, outcome} = this;
        return [
            buyers, consignmentId, start, quantity, price, perTxCap, state, outcome
        ].join(', ');
    }

    /**
     * Is this Sale instance's buyers field valid?
     * If present, must be an array of eip55 compliant Ethereum addresses
     * @returns {boolean}
     */
    buyersIsValid() {
        let valid = false;
        let {buyers} = this;
        try {
            valid = (
                buyers === undefined || buyers === null ||
                Array.isArray(buyers) &&
                buyers.length &&
                buyers.reduce((valid, buyer) => valid === valid && eip55.verify(buyer), true)
            )
        } catch (e) {}
        return valid;
    }

    /**
     * Is this Sale instance's consignmentId field valid?
     * Must be a number
     * @returns {boolean}
     */
    consignmentIdIsValid() {
        let {consignmentId} = this;
        return typeof consignmentId === "number";
    }

    /**
     * Is this Sale instance's start field valid?
     * Must be a positive number
     * @returns {boolean}
     */
    startIsValid() {
        let {start} = this;
        return typeof start === "number" && start > 0;
    }

    /**
     * Is this Sale instance's quantity field valid?
     * Must be a positive number
     * @returns {boolean}
     */
    quantityIsValid() {
        let {quantity} = this;
        return typeof quantity === "number" && quantity > 0;
    }

    /**
     * Is this Sale instance's price field valid?
     * Must be a positive number
     * @returns {boolean}
     */
    priceValid() {
        let {price} = this;
        return typeof price === "number" && price > 0;
    }

    /**
     * Is this Sale instance's perTxCap field valid?
     * If present, must be a positive number
     * @returns {boolean}
     */
    perTxCapIsValid() {
        let {perTxCap} = this;
        let valid = (
            perTxCap === undefined ||
            perTxCap === null ||
            (typeof perTxCap === "number" && perTxCap > 0)
        );
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
            this.buyersIsValid() &&
            this.consignmentIdIsValid() &&
            this.startIsValid() &&
            this.quantityIsValid() &&
            this.priceValid() &&
            this.perTxCapIsValid() &&
            this.stateIsValid() &&
            this.outcomeIsValid()
        );
    };

    /**
     * Clone this Sale
     * @returns {Sale}
     */
    clone () {
       return Sale.fromObject(this.toObject());
    }

}

// Export
if (NODE) {
    module.exports = Sale;
} else {
    window.Sale = Sale;
}