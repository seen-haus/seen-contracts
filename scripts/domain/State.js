const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');

/**
 * Domain Enum: State
 *
 * See: {SeenTypes.State}
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
class State {}

State.PENDING = 0;
State.RUNNING = 1;
State.ENDED = 2;

State.States = [State.PENDING, State.RUNNING, State.ENDED];

// Export
if (NODE) {
    module.exports = State;
} else {
    window.State = State;
}