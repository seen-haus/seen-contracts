const { expect } = require("chai");
const Role = require("../../domain/Role");

/**
 *  Test the AccessController contract
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
describe("AccessController", function() {

    // Shared args
    let accounts, deployer, admin, seller, minter, escrowAgent, marketHandler, associate;
    let AccessController, accessController, roleAdmin;

    beforeEach( async function () {

        // Make accounts available
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        admin = accounts[1];
        seller = accounts[2];
        minter = accounts[3];
        escrowAgent = accounts[4];
        marketHandler = accounts[5];
        associate = accounts[6];

        // Deploy the contract
        AccessController = await ethers.getContractFactory("AccessController");
        accessController = await AccessController.deploy();
        await accessController.deployed();

    });

    context("Deployer is limited to initial ADMIN role", async function () {

        it("Deployer should have ADMIN role", async function () {

            // Check role
            expect(
                await accessController.hasRole(Role.ADMIN, deployer.address),
                "Deployer doesn't have ADMIN role"
            ).is.true;

        });

        it("Deployer should not have SELLER role", async function () {

            // Check role
            expect(
                await accessController.hasRole(Role.SELLER, deployer.address),
                "Deployer has SELLER role"
            ).is.false;

        });

        it("Deployer should not have MINTER role", async function () {

            // Check role
            expect(
                await accessController.hasRole(Role.MINTER, deployer.address),
                "Deployer has MINTER role"
            ).is.false;

        });

        it("Deployer should not have ESCROW_AGENT role", async function () {

            // Check role
            expect(
                await accessController.hasRole(Role.ESCROW_AGENT, deployer.address),
                "Deployer has ESCROW_AGENT role"
            ).is.false;

        });

        it("Deployer should not have MARKET_HANDLER role", async function () {

            // Check role
            expect(
                await accessController.hasRole(Role.MARKET_HANDLER, deployer.address),
                "Deployer has MARKET_HANDLER role"
            ).is.false;

        });

    });

    context("ADMIN role is role admin for all other roles", async function () {

        it("ADMIN role should be ADMIN role admin", async function () {

            // Get ADMIN role admin
            roleAdmin = await accessController.getRoleAdmin(Role.ADMIN);

            // Test
            expect(
                roleAdmin === Role.ADMIN,
                "ADMIN role isn't ADMIN role admin"
            ).is.true;

        });

        it("ADMIN role should be SELLER role admin", async function () {

            // Get SELLER role admin
            roleAdmin = await accessController.getRoleAdmin(Role.SELLER);

            // Test
            expect(
                roleAdmin === Role.ADMIN,
                "ADMIN role isn't SELLER role admin"
            ).is.true;

        });

        it("ADMIN role should be MINTER role admin", async function () {

            // Get MINTER role admin
            roleAdmin = await accessController.getRoleAdmin(Role.MINTER);

            // Test
            expect(
                roleAdmin === Role.ADMIN,
                "ADMIN role isn't MINTER role admin"
            ).is.true;

        });

        it("ADMIN role should be ESCROW_AGENT role admin", async function () {

            // Get ESCROW_AGENT role admin
            roleAdmin = await accessController.getRoleAdmin(Role.ESCROW_AGENT);

            // Test
            expect(
                roleAdmin === Role.ADMIN,
                "ADMIN role isn't ESCROW_AGENT role admin"
            ).is.true;

        });

        it("ADMIN role should be MARKET_HANDLER role admin", async function () {

            // Get MARKET_HANDLER role admin
            roleAdmin = await accessController.getRoleAdmin(Role.MARKET_HANDLER);

            // Test
            expect(
                roleAdmin === Role.ADMIN,
                "ADMIN role isn't MARKET_HANDLER role admin"
            ).is.true;

        });

    });

    context("Any ADMIN can grant all other roles", async function () {

        beforeEach( async function () {

            // Deployer grants ADMIN to another admin address
            await accessController.grantRole(Role.ADMIN, admin.address);
            expect(await accessController.hasRole(Role.ADMIN, admin.address)).is.true;

        });

        it("ADMIN role should be able to grant ADMIN role", async function () {

            // Grant Role
            try {
                await accessController.connect(admin).grantRole(Role.ADMIN, associate.address);
            } catch(e) {}

            // Test
            expect(
                await accessController.hasRole(Role.ADMIN, associate.address),
                "ADMIN role can't grant ADMIN role"
            ).is.true;

        });

        it("ADMIN role should be able to grant SELLER role", async function () {

            // Grant Role
            try {
                await accessController.connect(admin).grantRole(Role.SELLER, seller.address);
            } catch(e) {}

            // Test
            expect(
                await accessController.hasRole(Role.SELLER, seller.address),
                "ADMIN role can't grant SELLER role"
            ).is.true;

        });

        it("ADMIN role should be able to grant MINTER role", async function () {

            // Grant Role
            try {
                await accessController.connect(admin).grantRole(Role.MINTER, minter.address);
            } catch(e) {}

            // Test
            expect(
                await accessController.hasRole(Role.MINTER, minter.address),
                "ADMIN role can't grant MINTER role"
            ).is.true;

        });

        it("ADMIN role should be able to grant ESCROW_AGENT role", async function () {

            // Grant Role
            try {
                await accessController.connect(admin).grantRole(Role.ESCROW_AGENT, escrowAgent.address);
            } catch(e) {}

            // Test
            expect(
                await accessController.hasRole(Role.ESCROW_AGENT, escrowAgent.address),
                "ADMIN role can't grant ESCROW_AGENT role"
            ).is.true;

        });

        it("ADMIN role should be able to grant MARKET_HANDLER role", async function () {

            // Grant Role
            try {
                await accessController.connect(admin).grantRole(Role.MARKET_HANDLER, marketHandler.address);
            } catch(e) {}

            // Test
            expect(
                await accessController.hasRole(Role.MARKET_HANDLER, marketHandler.address),
                "ADMIN role can't grant MARKET_HANDLER role"
            ).is.true;

        });

    });

    context("Any ADMIN can revoke all other roles", async function () {

        beforeEach( async function () {

            // Deployer grants roles to other addresses
            await accessController.connect(deployer).grantRole(Role.ADMIN, admin.address);
            await accessController.connect(deployer).grantRole(Role.SELLER, seller.address);
            await accessController.connect(deployer).grantRole(Role.MINTER, minter.address);
            await accessController.connect(deployer).grantRole(Role.ESCROW_AGENT, escrowAgent.address);
            await accessController.connect(deployer).grantRole(Role.MARKET_HANDLER, marketHandler.address);

        });

        it("ADMIN role should be able to revoke ADMIN role", async function () {

            // Revoke Role
            try {
                await accessController.connect(admin).revokeRole(Role.ADMIN, deployer.address);
            } catch(e) {}

            // Test
            expect(
                await accessController.hasRole(Role.ADMIN, deployer.address),
                "ADMIN role can't revoke ADMIN role"
            ).is.false;

        });

        it("ADMIN role should be able to revoke SELLER role", async function () {

            // Revoke Role
            try {
                await accessController.connect(admin).revokeRole(Role.SELLER, seller.address);
            } catch(e) {}

            // Test
            expect(
                await accessController.hasRole(Role.SELLER, seller.address),
                "ADMIN role can't revoke SELLER role"
            ).is.false;

        });

        it("ADMIN role should be able to revoke MINTER role", async function () {

            // Revoke Role
            try {
                await accessController.connect(admin).revokeRole(Role.MINTER, minter.address);
            } catch(e) {}

            // Test
            expect(
                await accessController.hasRole(Role.MINTER, minter.address),
                "ADMIN role can't revoke MINTER role"
            ).is.false;

        });

        it("ADMIN role should be able to revoke ESCROW_AGENT role", async function () {

            // Revoke Role
            try {
                await accessController.connect(admin).revokeRole(Role.ESCROW_AGENT, escrowAgent.address);
            } catch(e) {}

            // Test
            expect(
                await accessController.hasRole(Role.ESCROW_AGENT, escrowAgent.address),
                "ADMIN role can't revoke ESCROW_AGENT role"
            ).is.false;

        });

        it("ADMIN role should be able to revoke MARKET_HANDLER role", async function () {

            // Revoke Role
            try {
                await accessController.connect(admin).revokeRole(Role.MARKET_HANDLER, marketHandler.address);
            } catch(e) {}

            // Test
            expect(
                await accessController.hasRole(Role.MARKET_HANDLER, marketHandler.address),
                "ADMIN role can't revoke MARKET_HANDLER role"
            ).is.false;

        });

    });

    context("Any roled address can renounce its roles", async function () {

        beforeEach( async function () {

            // Deployer grants roles to other addresses
            await accessController.connect(deployer).grantRole(Role.ADMIN, admin.address);
            await accessController.connect(deployer).grantRole(Role.SELLER, seller.address);
            await accessController.connect(deployer).grantRole(Role.MINTER, minter.address);
            await accessController.connect(deployer).grantRole(Role.ESCROW_AGENT, escrowAgent.address);
            await accessController.connect(deployer).grantRole(Role.MARKET_HANDLER, marketHandler.address);

        });

        it("ADMIN role should be able to renounce ADMIN role", async function () {

            // Renounce Role
            try {
                await accessController.connect(admin).renounceRole(Role.ADMIN, admin.address);
            } catch(e) {}

            // Test
            expect(
                await accessController.hasRole(Role.ADMIN, admin.address),
                "ADMIN role can't renounce ADMIN role"
            ).is.false;

        });

        it("SELLER role should be able to renounce SELLER role", async function () {

            // Renounce Role
            try {
                await accessController.connect(seller).renounceRole(Role.SELLER, seller.address);
            } catch(e) {}

            // Test
            expect(
                await accessController.hasRole(Role.SELLER, seller.address),
                "SELLER role can't renounce SELLER role"
            ).is.false;

        });

        it("MINTER role should be able to renounce MINTER role", async function () {

            // Renounce Role
            try {
                await accessController.connect(minter).renounceRole(Role.MINTER, minter.address);
            } catch(e) {}

            // Test
            expect(
                await accessController.hasRole(Role.MINTER, minter.address),
                "MINTER role can't renounce MINTER role"
            ).is.false;

        });

        it("ESCROW_AGENT role should be able to renounce ESCROW_AGENT role", async function () {

            // Renounce Role
            try{
                await accessController.connect(escrowAgent).renounceRole(Role.ESCROW_AGENT, escrowAgent.address);
            } catch(e) {}

            // Test
            expect(
                await accessController.hasRole(Role.ESCROW_AGENT, escrowAgent.address),
                "ESCROW_AGENT role can't renounce ESCROW_AGENT role"
            ).is.false;

        });

        it("MARKET_HANDLER role should be able to renounce MARKET_HANDLER role", async function () {

            // Renounce Role
            try {
                await accessController.connect(marketHandler).renounceRole(Role.MARKET_HANDLER, marketHandler.address);
            } catch(e) {}

            // Test
            expect(
                await accessController.hasRole(Role.MARKET_HANDLER, marketHandler.address),
                "MARKET_HANDLER role can't renounce MARKET_HANDLER role"
            ).is.false;

        });

    });

    context("Any address can have multiple roles", async function () {

        beforeEach( async function () {

            // Deployer grants ADMIN to another address
            await accessController.connect(deployer).grantRole(Role.ADMIN, admin.address);

        });

        it("ADMIN role should be able to grant multiple roles to same address", async function () {

            // Grant all roles to associate
            try {
                await accessController.connect(admin).grantRole(Role.ADMIN, associate.address);
                await accessController.connect(admin).grantRole(Role.SELLER, associate.address);
                await accessController.connect(admin).grantRole(Role.MINTER, associate.address);
                await accessController.connect(admin).grantRole(Role.ESCROW_AGENT, associate.address);
                await accessController.connect(admin).grantRole(Role.MARKET_HANDLER, associate.address);
            } catch(e) {}

            // Check roles all apply for associate
            expect(await accessController.hasRole(Role.ADMIN, associate.address)).is.true;
            expect(await accessController.hasRole(Role.SELLER, associate.address)).is.true;
            expect(await accessController.hasRole(Role.MINTER, associate.address)).is.true;
            expect(await accessController.hasRole(Role.ESCROW_AGENT, associate.address)).is.true;
            expect(await accessController.hasRole(Role. MARKET_HANDLER, associate.address)).is.true;

        });

    });

});