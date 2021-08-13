const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');
const ethers = require("ethers");
const eip55 = require("eip55");

/**
 * Domain Entity: Token
 *
 * See: {SeenTypes.Token}
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
class Token {

    constructor (creator, royaltyPercentage, isPhysical, id, supply, uri) {
        this.creator = creator;
        this.royaltyPercentage = royaltyPercentage;
        this.isPhysical = isPhysical;
        this.id = id;
        this.supply = supply;
        this.uri = uri;
    }

    /**
     * Get a new Token instance from a database representation
     * @param o
     * @returns {Token}
     */
    static fromObject(o) {
        const {creator, royaltyPercentage, isPhysical, id, supply, uri} = o;
        return new Token(creator, royaltyPercentage, isPhysical, id, supply, uri);
    }

    /**
     * Get a database representation of this Token instance
     * @returns {object}
     */
    toObject() {
        return JSON.parse(this.toString());
    }

    /**
     * Get a string representation of this Token instance
     * @returns {string}
     */
    toString() {
        return JSON.stringify(this);
    }

    /**
     * Clone this Token
     * @returns {Token}
     */
    clone () {
        return Token.fromObject(this.toObject());
    }

    /**
     * Is this Token instance's creator field valid?
     * Must be a eip55 compliant Ethereum address
     * @returns {boolean}
     */
    creatorIsValid() {
        let valid = false;
        let {creator} = this;
        try {
            valid = (
                eip55.verify(eip55.encode(creator))
            );
        } catch (e) {}
        return valid;
    }

    /**
     * Is this Token instance's royaltyPercentage field valid?
     * Must be a string that converts to a positive BigNumber
     * Must represent between 1% and 100%
     *
     * N.B. Represent percentage value as an unsigned int by multiplying the percentage by 100:
     * e.g, 1.75% = 175, 100% = 10000
     *
     * @returns {boolean}
     */
    royaltyPercentageIsValid() {
        let {royaltyPercentage} = this;
        let valid = false;
        try {
            valid = (
                typeof royaltyPercentage === "string" &&
                ethers.BigNumber.from(royaltyPercentage).gt("0") &&
                ethers.BigNumber.from(royaltyPercentage).lte("10000")
            )
        } catch(e){}
        return valid;
    }

    /**
     * Is this Token instance's isPhysical field valid?
     * Must be a boolean
     * @returns {boolean}
     */
    isPhysicalIsValid() {
        let valid = false;
        let {isPhysical} = this;
        try {
            valid = (
                typeof isPhysical === "boolean"
            );
        } catch (e) {}
        return valid;
    }

    /**
     * Is this Token instance's id field valid?
     * Must be a string that converts to a BigNumber
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
     * Is this Token instance's supply field valid?
     * Must be a string that converts to a positive BigNumber
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
     * Is this Token instance's uri field valid?
     * Must be a populated string
     * @returns {boolean}
     */
    uriIsValid() {
        let {uri} = this;
        let valid = false;
        try {
            valid = (
                uri !== "" &&
                uri !== undefined &&
                typeof uri === "string"
            )
        } catch(e){}
        return valid;
    }

    /**
     * Is this Token instance valid?
     * @returns {boolean}
     */
    isValid() {
        return (
            this.creatorIsValid() &&
            this.royaltyPercentageIsValid() &&
            this.isPhysicalIsValid() &&
            this.idIsValid() &&
            this.supplyIsValid() &&
            this.uriIsValid()
        );
    };

}

// Export
if (NODE) {
    module.exports = Token;
} else {
    window.Token = Token;
}