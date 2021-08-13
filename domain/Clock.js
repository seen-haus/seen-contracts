const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');

/**
 * Domain Enum: Clock
 *
 * See: {SeenTypes.Clock}
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
class Clock {}

Clock.LIVE = 0;
Clock.TRIGGERED = 1;

Clock.Clocks = [Clock.LIVE, Clock.TRIGGERED];

// Export
if (NODE) {
    module.exports = Clock;
} else {
    window.Clock = Clock;
}