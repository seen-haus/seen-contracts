/**
 * Domain Entity: Consignment
 * @author Cliff Hall <cliff@futurescale.com>
 */
const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');
const ethers = require("ethers");
const Market = require("./Market");
const eip55 = require("eip55");

class Consignment {

    constructor (market, seller, tokenAddress, tokenId, id) {
        this.market = market;
        this.seller = seller;
        this.token = tokenAddress;
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
        return JSON.parse(this.toString());
    }

    /**
     * Get a string representation of this Consignment instance
     * @returns {string}
     */
    toString() {
        return JSON.stringify(this);
    }

    /**
     * Clone this Consignment
     * @returns {Consignment}
     */
    clone () {
        return Consignment.fromObject(this.toObject());
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
                eip55.verify(eip55.encode(seller))
            );
        } catch (e) {}
        return valid;
    }

    /**
     * Is this Consignment instance's token field valid?
     * Must be a eip55 compliant Ethereum address
     * @returns {boolean}
     */
    tokenAddressIsValid() {
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
     * Is this Consignment instance's id field valid?
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
     * Is this Consignment instance valid?
     * @returns {boolean}
     */
    isValid() {
        return (
            this.marketIsValid() &&
            this.sellerIsValid() &&
            this.tokenAddressIsValid() &&
            this.tokenIdIsValid() &&
            this.idIsValid()
        );
    };

}

// Export
if (NODE) {
    module.exports = Consignment;
} else {
    window.Consignment = Consignment;
}