const ethers = require('ethers');
const keccak256 = ethers.utils.keccak256;
const toUtf8Bytes = ethers.utils.toUtf8Bytes;
const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');

/**
 * Domain Enum: Role
 *
 * See: {SeenTypes.Role}
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
class Role {}

Role.Names = [
    "ADMIN",           // Deployer and any other admins as needed
    "SELLER",          // Approved sellers amd Seen.Haus reps
    "MINTER",          // Approved artists and Seen.Haus reps for digital minting
    "ESCROW_AGENT",    // Approved escrow agent for physical minting
    "MARKET_HANDLER"   // Market Handler contracts;
]

Role.Names.forEach( roleName => {
    const hash     = keccak256(toUtf8Bytes(roleName));
    Role[roleName] = hash;
    Role[hash]     = roleName;

})

// Export
if (NODE) {
    module.exports = Role;
} else {
    window.Role = Role;
}