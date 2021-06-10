const { expect } = require("chai");
const { expectRevert } = require('@openzeppelin/test-helpers');
const Role = require("../../domain/Role");
const Market = require("../../domain/Market");
const Consignment = require("../../domain/Consignment");

describe("SeenHausNFT", function() {

    // Common vars
    let accounts, deployer, admin, escrowAgent, associate, minter, creator, recipient, owner;
    let AccessController, accessController;
    let MarketController, marketController;
    let SeenHausNFT, seenHausNFT;
    let staking, multisig, vipStakerAmount, feePercentage, royaltyPercentage, maxRoyaltyPercentage, outBidPercentage;
    let counter, tokenURI, nextToken, supply, tokenCreator, salePrice, royaltyAmount, expectedRoyalty, percentage;
    let isPhysical, balance, amount, tokenId, uri;

    beforeEach( async function () {

        // Make accounts available
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        admin = accounts[1];
        escrowAgent = accounts[2];
        creator = accounts[3];
        associate = accounts[4];
        minter = accounts[5];
        escrowAgent = accounts[6]
        recipient = accounts[7];
        owner = accounts[8];

        staking = accounts[9];        // We just need addresses for these,
        multisig = accounts[10];      // not functional contracts

        // Market control values
        vipStakerAmount = "500";       // Amount of xSEEN to be l33t
        feePercentage = "1500";        // 15%   = 1500
        royaltyPercentage = "12500";   // 12.5% = 12500
        maxRoyaltyPercentage = "5000"; // 50%   = 5000
        outBidPercentage = "500";      // 5%    = 500

        // Deploy the AccessController contract
        AccessController = await ethers.getContractFactory("AccessController");
        accessController = await AccessController.deploy();
        await accessController.deployed();

        // Deploy the MarketController contract
        MarketController = await ethers.getContractFactory("MarketController");
        marketController = await MarketController.deploy(
            accessController.address,
            staking.address,
            multisig.address,
            vipStakerAmount,
            feePercentage,
            royaltyPercentage,
            maxRoyaltyPercentage,
            outBidPercentage
        );
        await marketController.deployed();

        // Deploy the SeenHausNFT contract
        SeenHausNFT = await ethers.getContractFactory("SeenHausNFT");
        seenHausNFT = await SeenHausNFT.deploy(
            accessController.address,
            marketController.address
        );
        await seenHausNFT.deployed();

        // NFT address gets set after deployment since it requires
        // the MarketController's address in its constructor
        await marketController.setNft(seenHausNFT.address);

    });

    context("Minting", async function () {

        beforeEach( async function () {

            // Prepare for roled access to privileged methods
            await accessController.connect(deployer).grantRole(Role.ESCROW_AGENT, escrowAgent.address);
            await accessController.connect(deployer).grantRole(Role.MINTER, minter.address);

            // Setup values
            nextToken = await seenHausNFT.getNextToken();
            tokenURI = "https://ipfs.io/ipfs/QmXBB6qm5vopwJ6ddxb1mEr1Pp87AHd3BUgVbsipCf9hWU";
            supply = "1";

        });

        context("Privileged Access", async function () {

            it("mintDigital() should require MINTER to mint a digital token", async function () {

                nextToken = await seenHausNFT.getNextToken();

                // non-MINTER attempt
                try {
                    await seenHausNFT.connect(associate).mintDigital(supply, creator.address, tokenURI);
                } catch (e) {}

                // Get counter
                counter = await seenHausNFT.getNextToken();

                // Test
                expect(
                    counter.eq(nextToken),
                    "non-MINTER can mint a digital token"
                ).is.true;

                // MINTER attempt
                try {
                    await seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI);
                } catch (e) {}

                // Get counter
                counter = await seenHausNFT.getNextToken();

                // Test
                expect(
                    counter.gt(nextToken),
                    "MINTER can't mint a digital token"
                ).is.true;

            });

            it("mintPhysical() should require ESCROW_AGENT to mint a physical token", async function () {

                nextToken = await seenHausNFT.getNextToken();

                // non-ESCROW_AGENT attempt
                try {
                    await seenHausNFT.connect(associate).mintPhysical(supply, creator.address, tokenURI);
                } catch (e) {}

                // Get counter
                counter = await seenHausNFT.getNextToken();

                // Test
                expect(
                    counter.eq(nextToken),
                    "non-ESCROW_AGENT can mint a physical token"
                ).is.true;

                // ESCROW_AGENT attempt
                try {
                    await seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI);
                } catch (e) {}

                // Get counter
                counter = await seenHausNFT.getNextToken();

                // Test
                expect(
                    counter.gt(nextToken),
                    "ESCROW_AGENT can't mint a digital token"
                ).is.true;

            });

        });

        context("Digital vs Physical NFTs", async function () {

            it("mintDigital() should not record a physical aspect for the token", async function () {

                // MINTER creates token for creator
                await seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI);

                // Get physical status
                isPhysical = await seenHausNFT.isPhysical(nextToken);

                // Test
                expect(
                    isPhysical,
                    "Physical aspect recorded for digital token"
                ).is.false;

            });

            it("mintPhysical() should record the physical aspect for the token", async function () {

                // ESCROW_AGENT creates token for creator
                await seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI);

                // Get physical status
                isPhysical = await seenHausNFT.isPhysical(nextToken);

                // Test
                expect(
                    isPhysical,
                    "Physical aspect not recorded"
                ).is.true;

            });

        });

        context("Token URIs", async function () {

            it("mintDigital() should record the URI for the token", async function () {

                // MINTER creates token for creator
                await seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI);

                // Get physical status
                uri = await seenHausNFT.uri(nextToken);

                // Test
                expect(
                    uri === tokenURI,
                    "URI not recorded for digital token"
                ).is.true;

            });

            it("mintPhysical() should record the physical aspect for the token", async function () {

                // ESCROW_AGENT creates token for creator
                await seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI);

                // Get physical status
                uri = await seenHausNFT.uri(nextToken);

                // Test
                expect(
                    uri === tokenURI,
                    "URI not recorded for physical token"
                ).is.true;

            });

        });

        context("Caller Receives Token Balance", async function () {

            it("mintDigital() should send token balance to MINTER-roled caller", async function () {

                // MINTER creates token for creator
                await seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI);

                // Get caller balance
                balance = await seenHausNFT.balanceOf(minter.address, nextToken);

                // Test
                expect(
                    balance.toString() === supply,
                    "Tokens not sent to caller"
                ).is.true;

            });

            it("mintPhysical() should send token balance to ESCROW_AGENT-roled caller", async function () {

                // ESCROW_AGENT creates token for creator
                await seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI);

                // Get caller balance
                balance = await seenHausNFT.balanceOf(escrowAgent.address, nextToken);

                // Test
                expect(
                    balance.toString() === supply,
                    "Tokens not sent to caller"
                ).is.true;

            });

        });

        context("Creator Tracking and Royalties", async function () {

            it("mintDigital() should record the creator address for the token", async function () {

                // MINTER creates token for creator
                await seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI);

                // Get token creator
                tokenCreator = await seenHausNFT.getCreator(nextToken);

                // Test
                expect(
                    tokenCreator === creator.address,
                    "Creator not properly recorded"
                ).is.true;

            });

            it("mintPhysical() should record the creator address for the token", async function () {

                // ESCROW_AGENT creates token for creator
                await seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI);

                // Get token creator
                tokenCreator = await seenHausNFT.getCreator(nextToken);

                // Test
                expect(
                    tokenCreator === creator.address,
                    "Creator not properly recorded"
                ).is.true;

            });

            it("royaltyInfo() should return creator address and correct royalty amount", async function () {

                // Set sale price
                salePrice = ethers.utils.parseUnits("1.5", "ether");

                // Determine expected royalty
                // N.B. Percentage values are stored as an unsigned int by multiplying the percentage by 100
                // e.g, 1.75% = 175, 100% = 10000
                // Thus, after multiplying royalty percentage by sale price, we must divide by 10000
                percentage = await marketController.getRoyaltyPercentage();
                expectedRoyalty = percentage.mul(salePrice).div(10000);

                // MINTER creates token for creator
                await seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI);

                // Get royalty info
                [recipient, royaltyAmount] = await seenHausNFT.royaltyInfo(nextToken, salePrice, 0);

                // Test
                expect(
                    recipient === creator.address,
                    "Wrong royalty recipient"
                ).is.true;

                expect(
                    royaltyAmount.toString() === expectedRoyalty.toString(),
                    "Incorrect royalty amount"
                ).is.true;

            });

        });

    });

    context("Owning", async function () {

        beforeEach( async function () {

            // Prepare for roled access to privileged methods
            await accessController.connect(deployer).grantRole(Role.MINTER, owner.address);

            // Setup values
            tokenId = await seenHausNFT.getNextToken();
            tokenURI = "https://ipfs.io/ipfs/QmXBB6qm5vopwJ6ddxb1mEr1Pp87AHd3BUgVbsipCf9hWU";
            supply = "100";
            amount = "50";

            // MINTER creates token
            await seenHausNFT.connect(owner).mintDigital(supply, creator.address, tokenURI);

        });

        it("Owner should be able to transfer part of their balance", async function() {

            // Owner transfers half of their token balance to recipient
            await seenHausNFT.connect(owner).safeTransferFrom(owner.address, recipient.address, tokenId, amount, []);

            // TEST
            expect(
                await seenHausNFT.balanceOf(owner.address, tokenId),
                "Balance of owner incorrect"
            ).to.eq(amount);

            expect(
                await seenHausNFT.balanceOf(recipient.address, tokenId),
                "Balance of recipient incorrect"
            ).to.eq(amount);

        });

        it("Owner should be able to set transfer approval to an operator", async function() {

            // Set approval for operator to manage sender's NFTs
            await seenHausNFT.connect(owner).setApprovalForAll(associate.address, true);

            // Test
            expect (
                await seenHausNFT.isApprovedForAll(owner.address, associate.address),
                "Operator was not approved"
                ).is.true;

        });

        it("Owner should be able to remove transfer approval from an operator", async function() {

            // Set approval for operator to manage sender's NFTs
            await seenHausNFT.connect(owner).setApprovalForAll(associate.address, true);

            // Remove approval for operator to manage sender's NFTs
            await seenHausNFT.connect(owner).setApprovalForAll(associate.address, false);

            // Test
            expect (
                await seenHausNFT.isApprovedForAll(owner.address, associate.address),
                "Operator approval not removed"
            ).is.false;

        });

    });

});