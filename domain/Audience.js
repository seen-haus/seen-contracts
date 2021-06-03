/**
 * Domain Enum: Audience
 * @author Cliff Hall <cliff@futurescale.com>
 */
const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');
class Audience {}

Audience.OPEN = 0;
Audience.STAKER = 1;
Audience.VIP_STAKER = 2;

Audience.Audiences = [Audience.OPEN, Audience.STAKER, Audience.VIP_STAKER];

// Export
if (NODE) {
    module.exports = Audience;
} else {
    window.Audience = Audience;
}