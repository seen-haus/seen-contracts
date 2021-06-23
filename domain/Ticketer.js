/**
 * Domain Enum: Ticketer
 * @author Cliff Hall <cliff@futurescale.com>
 */
const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');
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