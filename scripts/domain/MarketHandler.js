const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');

/**
 * Domain Enum: MarketHandler
 *
 * See: {SeenTypes.MarketHandler}
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
class MarketHandler {}

MarketHandler.UNHANDLED = 0;
MarketHandler.AUCTION = 1;
MarketHandler.SALE = 2;

MarketHandler.MarketHandlers = [MarketHandler.UNHANDLED, MarketHandler.AUCTION, MarketHandler.SALE];

// Export
if (NODE) {
    module.exports = MarketHandler;
} else {
    window.MarketHandler = MarketHandler;
}