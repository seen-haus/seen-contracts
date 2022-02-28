const {ContractAddresses} = require('./contract-addresses');
const Role = require("../domain/Role");

/**
 * Role assignments for access control in the Seen.Haus contract suite
 *
 * Process:
 *  1.  Edit scripts/constants/role-assignments.js
 *  1a. Add new address / role assignments following existing config
 *  1b. Remove an existing role assignment, delete role from addresses' role array
 *  1b. If removing all roles from a previously roled-address,
 *      - remove roles from addresses' role array but not address configuration.
 *      = the script will only act on addresses listed in RoleAssignments
 *  2. Run the appropriate npm script in package.json to manage roles for a given network
 *  3. Save changes to the repo as a record of who has what roles
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
exports.RoleAssignments = {

    "rinkeby": {

        "SEEN's minter / escrow agent / seller address": // For mint+market of physical NFTs
            {
                address: "0x15884D7a5567725E0306A90262ee120aD8452d58",
                roles: [Role.ESCROW_AGENT, Role.SELLER, Role.MINTER]
            },

        "Test1 admin address": // For admin tasks
            {
                address: "0xDE7e3ec4442Ba87247797BEA433985449EDEA893",
                roles: [Role.ADMIN]
            },

        "Test1 mint / escrow agent / seller address": // For mint+market of physical NFTs
            {
                address: "0x06d95AD7d2F4c868f96203c55Fb0ec7A4ce17026",
                roles: [Role.ESCROW_AGENT, Role.SELLER, Role.MINTER]
            },

        "Test2 mint / escrow agent / seller address": // For mint+market of physical NFTs
            {
                address: "0x30651410055c12613c68D60bFf220F6D78DF7Acb",
                roles: [Role.ESCROW_AGENT, Role.SELLER, Role.MINTER]
            },

        "Test3 mint / escrow agent / seller address": // For mint+market of physical NFTs
            {
                address: "0xc5504278f3c965F41fd84b9dE266604764Cb0f79",
                roles: [Role.ESCROW_AGENT, Role.SELLER, Role.MINTER]
            },

        "Test4 mint / escrow agent / seller address": // For mint+market of physical NFTs
            {
                address: "0xe4572141a6A56CA13529426896423D17cc13fD69",
                roles: [Role.ESCROW_AGENT, Role.SELLER, Role.MINTER]
            },

        // MARKET_HANDLER roles can now only be changed by the multisig

        // "MarketDiamond contract": // For Market Handler facets
        //     {
        //         address: ContractAddresses.rinkeby.MarketDiamond,
        //         roles: [Role.MARKET_HANDLER]
        //     },

        // "ItemsTicketer contract":
        //     {
        //         address: ContractAddresses.rinkeby.ItemsTicketer,
        //         roles: [Role.MARKET_HANDLER]
        //     },

        // "LotsTicketer contract":
        //     {
        //         address: ContractAddresses.rinkeby.LotsTicketer,
        //         roles: [Role.MARKET_HANDLER]
        //     },

        // "SeenHausNFT contract":
        //     {
        //         address: ContractAddresses.rinkeby.SeenHausNFT,
        //         roles: [Role.MARKET_HANDLER]
        //     },

    },

    "mainnet": {

        // Deployer address already has ADMIN role
        // "SEEN's admin address": // For admin tasks
        //     {
        //         address: "",
        //         roles: [Role.ADMIN]
        //     },

        "SEEN's minter / escrow agent / seller address": // For mint+market of physical NFTs
            {
                address: "0x15884D7a5567725E0306A90262ee120aD8452d58",
                roles: [Role.ESCROW_AGENT, Role.SELLER, Role.MINTER]
            },

        // MARKET_HANDLER roles can now only be changed by the multisig

        // "MarketDiamond contract": // For Market Handler facets
        //     {
        //         address: ContractAddresses.mainnet.MarketDiamond,
        //         roles: [Role.MARKET_HANDLER]
        //     },

        // "ItemsTicketer contract":
        //     {
        //         address: ContractAddresses.mainnet.ItemsTicketer,
        //         roles: [Role.MARKET_HANDLER]
        //     },

        // "LotsTicketer contract":
        //     {
        //         address: ContractAddresses.mainnet.LotsTicketer,
        //         roles: [Role.MARKET_HANDLER]
        //     },

        // "SeenHausNFT contract":
        //     {
        //         address: ContractAddresses.mainnet.SeenHausNFT,
        //         roles: [Role.MARKET_HANDLER]
        //     }
    }

};

exports.nftOwner = '0x15884D7a5567725E0306A90262ee120aD8452d58';