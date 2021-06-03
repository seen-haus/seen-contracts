/**
 * Domain Enum: Market
 * @author Cliff Hall <cliff@futurescale.com>
 */
const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');
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