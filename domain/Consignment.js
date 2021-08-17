const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');
const ethers = require("ethers");
const Market = require("./Market");
const eip55 = require("eip55");

/**
 * Domain Entity: Consignment
 *
 * See: {SeenTypes.Consignment}
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
class Consignment {

    constructor (market, seller, tokenAddress, tokenId, supply, id, multiToken, marketed, released) {
        this.market = market;
        this.seller = seller;
        this.tokenAddress = tokenAddress;
        this.tokenId = tokenId;
        this.supply = supply;
        this.id = id;
        this.multiToken = multiToken;
        this.marketed = marketed;
        this.released = released;
    }

    /**
     * Get a new Consignment instance from a database representation
     * @param o
     * @returns {Consignment}
     */
    static fromObject(o) {
        const {market, seller, tokenAddress, tokenId, supply, id, multiToken, marketed, released} = o;
        return new Consignment(market, seller, tokenAddress, tokenId, supply, id, multiToken, marketed, released);
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
     * Is this Consignment instance's tokenAddress field valid?
     * Must be a eip55 compliant Ethereum address
     * @returns {boolean}
     */
    tokenAddressIsValid() {
        let valid = false;
        let {tokenAddress} = this;
        try {
            valid = (
                eip55.verify(tokenAddress)
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
     * Is this Consignment instance's supply field valid?
     * Must be a string that converts to a valid, positive BigNumber
     * @returns {boolean}
     */
    supplyIsValid() {
        let {supply} = this;
        let valid = false;
        try {
            valid = (
                typeof supply === "string" &&
                ethers.BigNumber.from(supply).gt("0")
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
     * Is this Consignment instance's multiToken field valid?
     * @returns {boolean}
     */
    multiTokenIsValid() {
        let valid = false;
        let {multiToken} = this;
        try {
            valid = (
                typeof multiToken === "boolean"
            );
        } catch (e) {}
        return valid;
    }

    /**
     * Is this Consignment instance's marketed field valid?
     * @returns {boolean}
     */
    marketedIsValid() {
        let valid = false;
        let {marketed} = this;
        try {
            valid = (
                typeof marketed === "boolean"
            );
        } catch (e) {}
        return valid;
    }

    /**
     * Is this Consignment instance's released field valid?
     * @returns {boolean}
     */
    releasedIsValid() {
        let valid = false;
        let {released} = this;
        try {
            valid = (
                typeof released === "boolean"
            );
        } catch (e) {}
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
            this.supplyIsValid() &&
            this.idIsValid() &&
            this.multiTokenIsValid() &&
            this.marketedIsValid() &&
            this.releasedIsValid()
        );
    };

}

// Export
if (NODE) {
    module.exports = Consignment;
} else {
    window.Consignment = Consignment;
}