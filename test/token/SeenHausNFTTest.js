const hre = require("hardhat");
const ethers = hre.ethers;
const { expect } = require("chai");
const Role = require("../../domain/Role");
const Token = require("../../domain/Token");
const Ticketer = require("../../domain/Ticketer");

describe("SeenHausNFT", function() {

    // Common vars
    let accounts, deployer, admin, escrowAgent, associate, minter, creator, recipient, owner;
    let AccessController, accessController;
    let MarketController, marketController;
    let SeenHausNFT, seenHausNFT;
    let staking, multisig, vipStakerAmount, feePercentage, maxRoyaltyPercentage, outBidPercentage, defaultTicketerType;
    let counter, tokenURI, nextToken, supply, salePrice, royaltyAmount, expectedRoyalty, percentage, royaltyPercentage;
    let token, isPhysical, balance, amount, tokenId, uri, invalidRoyaltyPercentage;

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
        vipStakerAmount = "500";              // Amount of xSEEN to be l33t
        feePercentage = "1500";               // 15%   = 1500
        maxRoyaltyPercentage = "1500";        // 15%   = 1500
        outBidPercentage = "500";             // 5%    = 500
        defaultTicketerType = Ticketer.LOTS;  // default escrow ticketer type

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
            maxRoyaltyPercentage,
            outBidPercentage,
            defaultTicketerType
        );
        await marketController.deployed();

        // Deploy the SeenHausNFT contract
        SeenHausNFT = await ethers.getContractFactory("SeenHausNFT");
        seenHausNFT = await SeenHausNFT.deploy(
            accessController.address,
            marketController.address
        );
        await seenHausNFT.deployed();

        // Grant MARKET_HANDLER to SeenHausNFT
        await accessController.connect(deployer).grantRole(Role.MARKET_HANDLER, seenHausNFT.address);

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
            royaltyPercentage = maxRoyaltyPercentage;

        });

        context("Privileged Access", async function () {

            it("mintDigital() should require MINTER to mint a digital token", async function () {

                // non-MINTER attempt
                await expect(
                    seenHausNFT.connect(associate).mintDigital(supply, creator.address, tokenURI, royaltyPercentage)
                ).to.be.revertedWith("Access denied, caller doesn't have role");

                // Get counter
                counter = await seenHausNFT.getNextToken();

                // Test
                expect(
                    counter.eq(nextToken),
                    "non-MINTER can mint a digital token"
                ).is.true;

                // MINTER attempt
                await seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI, royaltyPercentage);

                // Get counter
                counter = await seenHausNFT.getNextToken();

                // Test
                expect(
                    counter.gt(nextToken),
                    "MINTER can't mint a digital token"
                ).is.true;

            });

            it("mintPhysical() should require ESCROW_AGENT to mint a physical token", async function () {

                // non-ESCROW_AGENT attempt
                await expect(
                    seenHausNFT.connect(associate).mintPhysical(supply, creator.address, tokenURI, royaltyPercentage)
                ).to.be.revertedWith("Access denied, caller doesn't have role");

                // Get counter
                counter = await seenHausNFT.getNextToken();

                // Test
                expect(
                    counter.eq(nextToken),
                    "non-ESCROW_AGENT can mint a physical token"
                ).is.true;

                // ESCROW_AGENT attempt
                await seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI, royaltyPercentage);

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
                await seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI, royaltyPercentage);

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
                await seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI, royaltyPercentage);

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
                await seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI, royaltyPercentage);

                // Get token URI
                uri = await seenHausNFT.uri(nextToken);

                // Test
                expect(
                    uri === tokenURI,
                    "URI not recorded for digital token"
                ).is.true;

            });

            it("mintPhysical() should record the URI for the token", async function () {

                // ESCROW_AGENT creates token for creator
                await seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI, royaltyPercentage);

                // Get physical status
                uri = await seenHausNFT.uri(nextToken);

                // Test
                expect(
                    uri === tokenURI,
                    "URI not recorded for physical token"
                ).is.true;

            });

        });

        context("MarketController Receives Token Balance", async function () {

            it("mintDigital() should send token balance to MarketController", async function () {

                // MINTER creates token for creator
                await seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI, royaltyPercentage);

                // Get MarketController balance
                balance = await seenHausNFT.balanceOf(marketController.address, nextToken);

                // Test
                expect(
                    balance.toString() === supply,
                    "Tokens not sent to marketplace"
                ).is.true;

            });

            it("mintPhysical() should send token balance to MarketController", async function () {

                // ESCROW_AGENT creates token for creator
                await seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI, royaltyPercentage);

                // Get MarketController balance
                balance = await seenHausNFT.balanceOf(marketController.address, nextToken);

                // Test
                expect(
                    balance.toString() === supply,
                    "Tokens not sent to marketplace"
                ).is.true;

            });

        });

        context("Creator Tracking and Royalties", async function () {

            it("mintDigital() should record the token creator, royalty percentage, supply, and URI", async function () {

                // MINTER creates token for creator
                await seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI, royaltyPercentage);

                // Get token info
                const response = await seenHausNFT.getTokenInfo(nextToken);

                // Convert to entity
                token = new Token(
                    response.creator,
                    response.royaltyPercentage.toString(),
                    response.isPhysical,
                    response.supply.toString(),
                    response.uri
                );

                // Test validity
                expect(
                    token.isValid(),
                    "Token not valid"
                ).is.true;

                // Test expected values
                expect(token.creator === creator.address).is.true;
                expect(token.royaltyPercentage === royaltyPercentage).is.true;
                expect(token.isPhysical === false).is.true;
                expect(token.supply === supply).is.true;
                expect(token.uri === tokenURI).is.true;

            });

            it("mintPhysical() should record the creator address for the token", async function () {

                // ESCROW_AGENT creates token for creator
                await seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI, royaltyPercentage);

                // Get token info
                const response = await seenHausNFT.getTokenInfo(nextToken);

                // Convert to entity
                token = new Token(
                    response.creator,
                    response.royaltyPercentage.toString(),
                    response.isPhysical,
                    response.supply.toString(),
                    response.uri
                );

                // Test validity
                expect(
                    token.isValid(),
                    "Token not valid"
                ).is.true;

                // Test expected values
                expect(token.creator === creator.address).is.true;
                expect(token.royaltyPercentage === royaltyPercentage).is.true;
                expect(token.isPhysical === true).is.true;
                expect(token.supply === supply).is.true;
                expect(token.uri === tokenURI).is.true;

            });

            it("royaltyInfo() should return creator address and correct royalty amount", async function () {

                // Set sale price
                salePrice = ethers.utils.parseUnits("1.5", "ether");

                // Determine expected royalty
                // N.B. Percentage values are stored as an unsigned int by multiplying the percentage by 100
                // e.g, 1.75% = 175, 100% = 10000
                // Thus, after multiplying royalty percentage by sale price, we must divide by 10000
                percentage = ethers.BigNumber.from(royaltyPercentage);
                expectedRoyalty = percentage.mul(salePrice).div(10000);

                // MINTER creates token for creator
                await seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI, royaltyPercentage);

                // Get royalty info
                [recipient, royaltyAmount] = await seenHausNFT.royaltyInfo(nextToken, salePrice);

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

        context("Revert Reasons", async function () {

            beforeEach( async function () {

                invalidRoyaltyPercentage = ethers.BigNumber.from(maxRoyaltyPercentage).mul("2");

            });

            it("mintDigital() should revert if royalty percentage exceeds maximum", async function () {

                // MINTER attempts to mint with royalty invalid royalty percentage
                await expect(
                    seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI, invalidRoyaltyPercentage)
                ).to.be.revertedWith("Royalty percentage exceeds marketplace maximum")


            });

            it("mintPhysical() should revert if royalty percentage exceeds maximum", async function () {

                // MINTER attempts to mint with royalty invalid royalty percentage
                await expect(
                    seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI, invalidRoyaltyPercentage)
                ).to.be.revertedWith("Royalty percentage exceeds marketplace maximum")

            });

        });

    });

});