/**
 * Domain Entity: Consignment
 * @author Cliff Hall <cliff@futurescale.com>
 */
const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');
const Market = require("./Market");
const eip55 = require("eip55");

class Consignment {

    constructor (market, seller, token, tokenId, id) {
        this.market = market;
        this.seller = seller;
        this.token = token;
        this.tokenId = tokenId;
        this.id = id;
    }

    /**
     * Get a new Consignment instance from a database representation
     * @param o
     * @returns {Consignment}
     */
    static fromObject(o) {
        const {market, seller, token, tokenId, id} = o;
        return new Consignment(market, seller, token, tokenId, id);
    }

    /**
     * Get a database representation of this Consignment instance
     * @returns {object}
     */
    toObject() {
        return JSON.parse(JSON.stringify(this));
    }

    /**
     * Get a string representation of this Consignment instance
     * @returns {string}
     */
    toString() {
        const {market, seller, token, tokenId, id} = this;
        return [
            market, seller, token, tokenId, id
        ].join(', ');
    }

    /**
     * Is this Consignment instance's market field valid?
     * @returns {boolean}
     */
    marketIsValid() {
        let valid = false;
        let {market} = this;
        try {
            valid = (
                Market.Markets.includes(market)
            );
        } catch (e) {}
        return valid;
    }

    /**
     * Is this Consignment instance's seller field valid?
     * Must be a eip55 compliant Ethereum address
     * @returns {boolean}
     */
    sellerIsValid() {
        let valid = false;
        let {seller} = this;
        try {
            valid = (
                eip55.verify(seller)
            );
        } catch (e) {}
        return valid;
    }

    /**
     * Is this Consignment instance's token field valid?
     * Must be a eip55 compliant Ethereum address
     * @returns {boolean}
     */
    tokenIsValid() {
        let valid = false;
        let {token} = this;
        try {
            valid = (
                eip55.verify(token)
            );
        } catch (e) {}
        return valid;
    }

    /**
     * Is this Consignment instance's tokenId field valid?
     * Must be a number
     * @returns {boolean}
     */
    tokenIdIsValid() {
        let {tokenId} = this;
        return typeof tokenId === "number";
    }

    /**
     * Is this Consignment instance's id field valid?
     * Must be a number
     * @returns {boolean}
     */
    idIsValid() {
        let {id} = this;
        return typeof id === "number";
    }

    /**
     * Is this Consignment instance valid?
     * @returns {boolean}
     */
    isValid() {
        return (
            this.marketIsValid() &&
            this.sellerIsValid() &&
            this.tokenIsValid() &&
            this.tokenIdIsValid() &&
            this.idIsValid()
        );
    };

    /**
     * Clone this Consignment
     * @returns {Consignment}
     */
    clone () {
       return Consignment.fromObject(this.toObject());
    }

}

// Export
if (NODE) {
    module.exports = Consignment;
} else {
    window.Consignment = Consignment;
}