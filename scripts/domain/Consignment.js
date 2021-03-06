const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');
const ethers = require("ethers");
const Market = require("./Market");
const MarketHandler = require("./MarketHandler");
const eip55 = require("eip55");

/**
 * Domain Entity: Consignment
 *
 * See: {SeenTypes.Consignment}
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
class Consignment {

    constructor (market, marketHandler, seller, tokenAddress, tokenId, supply, id, multiToken, released, releasedSupply, customFeePercentageBasisPoints, pendingPayout) {
        this.market = market;
        this.marketHandler = marketHandler;
        this.seller = seller;
        this.tokenAddress = tokenAddress;
        this.tokenId = tokenId;
        this.supply = supply;
        this.id = id;
        this.multiToken = multiToken;
        this.released = released;
        this.releasedSupply = releasedSupply;
        this.customFeePercentageBasisPoints = customFeePercentageBasisPoints;
        this.pendingPayout = pendingPayout;
    }

    /**
     * Get a new Consignment instance from a database representation
     * @param o
     * @returns {Consignment}
     */
    static fromObject(o) {
        const {market, marketHandler, seller, tokenAddress, tokenId, supply, id, multiToken, released, releasedSupply, customFeePercentageBasisPoints, pendingPayout} = o;
        return new Consignment(market, marketHandler, seller, tokenAddress, tokenId, supply, id, multiToken, released, releasedSupply, customFeePercentageBasisPoints, pendingPayout);
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
     * Is this Consignment instance's marketHandler field valid?
     * @returns {boolean}
     */
     marketHandlerIsValid() {
        let valid = false;
        let {marketHandler} = this;
        try {
            valid = (
                MarketHandler.MarketHandlers.includes(marketHandler)
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
     * Is this Consignment instance's releasedSupply field valid?
     * Must be a string that converts to a valid BigNumber
     * @returns {boolean}
     */
    releasedSupplyIsValid() {
        let { releasedSupply } = this;
        let valid = false;
        try {
            valid = (
                typeof releasedSupply === "string" &&
                ethers.BigNumber.from(releasedSupply).gte("0")
            )
        } catch(e){}
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
    customFeePercentageBasisPointsIsValid() {
        let { customFeePercentageBasisPoints } = this;
        let valid = false;
        try {
            valid = (
                typeof customFeePercentageBasisPoints === "string" &&
                ethers.BigNumber.from(customFeePercentageBasisPoints).gte("0") &&
                ethers.BigNumber.from(customFeePercentageBasisPoints).lte("10000")
            )
        } catch(e){}
        return valid;
    }

    /**
     * Is this Consignment instance's pendingPayout field valid?
     * Must be a string that converts to a valid BigNumber
     * @returns {boolean}
     */
    pendingPayoutIsValid() {
        let { pendingPayout } = this;
        let valid = false;
        try {
            valid = (
                typeof pendingPayout === "string" &&
                ethers.BigNumber.from(pendingPayout).gte("0")
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
            this.marketHandlerIsValid() &&
            this.sellerIsValid() &&
            this.tokenAddressIsValid() &&
            this.tokenIdIsValid() &&
            this.supplyIsValid() &&
            this.idIsValid() &&
            this.multiTokenIsValid() &&
            this.releasedIsValid() &&
            this.releasedSupplyIsValid() &&
            this.customFeePercentageBasisPointsIsValid() &&
            this.pendingPayoutIsValid()
        );
    };

}

// Export
if (NODE) {
    module.exports = Consignment;
} else {
    window.Consignment = Consignment;
}