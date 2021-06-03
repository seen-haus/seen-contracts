/**
 * Domain Enum: State
 * @author Cliff Hall <cliff@futurescale.com>
 */
const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');
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