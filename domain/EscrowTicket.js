/**
 * Domain Entity: EscrowTicket
 * @author Cliff Hall <cliff@futurescale.com>
 */
const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');
const ethers = require("ethers");

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
        return JSON.parse(this.toString());
    }

    /**
     * Get a string representation of this EscrowTicket instance
     * @returns {string}
     */
    toString() {
        return JSON.stringify(this);
    }

    /**
     * Clone this EscrowTicket
     * @returns {EscrowTicket}
     */
    clone () {
        return EscrowTicket.fromObject(this.toObject());
    }

    /**
     * Is this EscrowTicket instance's tokenId field valid?
     * Must be a string that converts to a BigNumber greater than or equal to zero
     * @returns {boolean}
     */
    tokenIdIsValid() {
        let {tokenId} = this;
        let valid = false;
        try {
            valid = (
                typeof tokenId === "string" &&
                ethers.BigNumber.from(tokenId).gte("0")
            )
        } catch(e){}
        return valid;
    }

    /**
     * Is this EscrowTicket instance's amount field valid?
     * Must be a string that converts to a positive BigNumber
     * @returns {boolean}
     */
    amountIsValid() {
        let {amount} = this;
        let valid = false;
        try {
            valid = (
                typeof amount === "string" &&
                ethers.BigNumber.from(amount).gt("0")
            )
        } catch(e){}
        return valid;
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

}

// Export
if (NODE) {
    module.exports = EscrowTicket;
} else {
    window.EscrowTicket = EscrowTicket;
}