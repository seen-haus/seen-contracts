/**
 * Domain Enum: Role
 * @author Cliff Hall <cliff@futurescale.com>
 */
const ethers = require('ethers');
const NODE = (typeof module !== 'undefined' && typeof module.exports !== 'undefined');

class Role {}
function getRoleBytes(role) {
    let utils = ethers.utils;
    return utils.keccak256(utils.toUtf8Bytes(role));
}

Role.ADMIN = getRoleBytes("ADMIN");                   // Deployer and any other admins as needed
Role.SELLER = getRoleBytes("SELLER");                 // Whitelisted sellers amd Seen.Haus reps
Role.MINTER = getRoleBytes("MINTER");                 // Whitelisted artists and Seen.Haus reps
Role.ESCROW_AGENT = getRoleBytes("ESCROW_AGENT");     // Seen.Haus Physical Item Escrow Agent
Role.MARKET_HANDLER = getRoleBytes("MARKET_HANDLER"); // Market Handler contracts

Role.Roles = [
    Role.ADMIN,
    Role.SELLER,
    Role.MINTER,
    Role.ESCROW_AGENT,
    Role.MARKET_HANDLER
];

// Export
if (NODE) {
    module.exports = Role;
} else {
    window.Role = Role;
}