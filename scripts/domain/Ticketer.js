const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');

/**
 * Domain Enum: Ticketer
 *
 * See: {SeenTypes.Ticketer}
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
class Ticketer {}

Ticketer.DEFAULT = 0;
Ticketer.LOTS = 1;
Ticketer.ITEMS = 2;

Ticketer.Ticketers = [Ticketer.DEFAULT, Ticketer.LOTS, Ticketer.ITEMS];

// Export
if (NODE) {
    module.exports = Ticketer;
} else {
    window.Ticketer = Ticketer;
}