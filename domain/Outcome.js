const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');

/**
 * Domain Enum: Outcome
 *
 * See: {SeenTypes.Outcome}
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
class Outcome {}

Outcome.PENDING = 0;
Outcome.CLOSED = 1;
Outcome.CANCELED = 2;

Outcome.Outcomes = [Outcome.PENDING, Outcome.CLOSED, Outcome.CANCELED];

// Export
if (NODE) {
    module.exports = Outcome;
} else {
    window.Outcome = Outcome;
}