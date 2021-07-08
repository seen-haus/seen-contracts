/**
 * Domain Entity: EscrowTicket
 * @author Cliff Hall <cliff@futurescale.com>
 */
const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');
const ethers = require("ethers");

class EscrowTicket {

    constructor (id, consignmentId, amount, itemURI) {
        this.id = id;
        this.consignmentId = consignmentId;
        this.amount = amount;
        this.itemURI = itemURI;
    }

    /**
     * Get a new EscrowTicket instance from a database representation
     * @param o
     * @returns {EscrowTicket}
     */
    static fromObject(o) {
        const {id, consignmentId, amount, itemURI} = o;
        return new EscrowTicket(id, consignmentId, amount, itemURI);
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
     * Is this EscrowTicket instance's id field valid?
     * Must be a string that converts to a BigNumber greater than or equal to zero
     * @returns {boolean}
     */
    idIsValid() {
        let {id} = this;
        let valid = false;
        try {
            valid = (
                typeof id === "string" &&
                ethers.BigNumber.from(id).gte("0")
            )
        } catch(e){}
        return valid;
    }

    /**
     * Is this EscrowTicket instance's consignmentId field valid?
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
     * Is this EscrowTicket instance's itemURI field valid?
     * Must be a populated string
     * @returns {boolean}
     */
    itemUriIsValid() {
        let {itemURI} = this;
        let valid = false;
        try {
            valid = (
                itemURI !== "" &&
                itemURI !== undefined &&
                typeof itemURI === "string"
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
            this.idIsValid() &&
            this.consignmentIdIsValid() &&
            this.amountIsValid() &&
            this.itemUriIsValid()
        );
    };

}

// Export
if (NODE) {
    module.exports = EscrowTicket;
} else {
    window.EscrowTicket = EscrowTicket;
}