const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');

/**
 * Domain Enum: Market
 *
 * See: {SeenTypes.Market}
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
class Market {}

Market.PRIMARY = 0;
Market.SECONDARY = 1;

Market.Markets = [Market.PRIMARY, Market.SECONDARY];

// Export
if (NODE) {
    module.exports = Market;
} else {
    window.Market = Market;
}