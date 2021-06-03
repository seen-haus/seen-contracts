/**
 * Domain Entity: EscrowTicket
 * @author Cliff Hall <cliff@futurescale.com>
 */
const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');
const Market = require("./Market");
const eip55 = require("eip55");

class EscrowTicket {

    constructor (tokenId, amount) {
        this.tokenId = tokenId;
        this.amount = amount;
    }

    /**
     * Get a new EscrowTicket instance from a database representation
     * @param o
     * @returns {EscrowTicket}
     */
    static fromObject(o) {
        const {tokenId, amount} = o;
        return new EscrowTicket(tokenId, amount);
    }

    /**
     * Get a database representation of this EscrowTicket instance
     * @returns {object}
     */
    toObject() {
        return JSON.parse(JSON.stringify(this));
    }

    /**
     * Get a string representation of this EscrowTicket instance
     * @returns {string}
     */
    toString() {
        const {market, seller, token, tokenId, id} = this;
        return [
            market, seller, token, tokenId, id
        ].join(', ');
    }

    /**
     * Is this EscrowTicket instance's tokenId field valid?
     * Must be a number
     * @returns {boolean}
     */
    tokenIdIsValid() {
        let {tokenId} = this;
        return typeof tokenId === "number";
    }

    /**
     * Is this EscrowTicket instance's amount field valid?
     * Must be a positive number
     * @returns {boolean}
     */
    amountIsValid() {
        let {amount} = this;
        return typeof amount === "number" && amount > 0;
    }

    /**
     * Is this EscrowTicket instance valid?
     * @returns {boolean}
     */
    isValid() {
        return (
            this.tokenIdIsValid() &&
            this.amountIsValid()
        );
    };

    /**
     * Clone this EscrowTicket
     * @returns {EscrowTicket}
     */
    clone () {
       return EscrowTicket.fromObject(this.toObject());
    }

}

// Export
if (NODE) {
    module.exports = EscrowTicket;
} else {
    window.EscrowTicket = EscrowTicket;
}