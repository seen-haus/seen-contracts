const hre = require("hardhat");
const ethers = hre.ethers;
const { expect } = require("chai");
const Role = require("../../domain/Role");
const Ticketer = require("../../domain/Ticketer");

describe("TicketAsItems", function() {

    // Common vars
    let accounts, deployer, admin, escrowAgent, associate, creator, marketHandler, buyer;
    let AccessController, accessController;
    let MarketController, marketController;
    let SeenHausNFT, seenHausNFT;
    let TicketAsItems, ticketAsItems;
    let staking, multisig, vipStakerAmount, feePercentage, maxRoyaltyPercentage, outBidPercentage, defaultTicketerType;
    let ticketId, tokenId, tokenURI, counter, supply, half, balance, royaltyPercentage;

    beforeEach( async function () {

        // Make accounts available
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        admin = accounts[1];
        escrowAgent = accounts[2];
        creator = accounts[3];
        associate = accounts[4];
        escrowAgent = accounts[5]
        buyer = accounts[6];

        staking = accounts[7];        // We just need addresses for these,
        multisig = accounts[8];       // not functional contracts
        marketHandler = accounts[9];

        // Market control values
        vipStakerAmount = "500";              // Amount of xSEEN to be VIP
        feePercentage = "1500";               // 15%   = 1500
        maxRoyaltyPercentage = "5000";        // 50%   = 5000
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

        // NFT address gets set after deployment since it requires
        // the MarketController's address in its constructor
        await marketController.setNft(seenHausNFT.address);

        // Deploy the TicketAsItems contract
        TicketAsItems = await ethers.getContractFactory("TicketAsItems");
        ticketAsItems = await TicketAsItems.deploy(
            accessController.address,
            marketController.address
        );
        await ticketAsItems.deployed();

    });

    context("Ticketing", async function () {

        beforeEach( async function () {

            // Prepare for roled access to privileged methods
            await accessController.connect(deployer).grantRole(Role.MARKET_HANDLER, marketHandler.address);
            await accessController.connect(deployer).grantRole(Role.ESCROW_AGENT, escrowAgent.address);

            // Setup values
            tokenId = await seenHausNFT.getNextToken();
            tokenURI = "https://ipfs.io/ipfs/QmXBB6qm5vopwJ6ddxb1mEr1Pp87AHd3BUgVbsipCf9hWU";
            supply = "50";
            half = "25";
            royaltyPercentage = maxRoyaltyPercentage;

            // ESCROW_AGENT mints physical
            await seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI, royaltyPercentage);

        });

        context("Privileged Access", async function () {

            beforeEach(async function () {

                // ESCROW_AGENT transfers tokens to ticketer
                // N.B. in reality they would go from escrow agent to market handler to ticketer
                await seenHausNFT.connect(escrowAgent).safeTransferFrom(
                    escrowAgent.address,
                    ticketAsItems.address,
                    tokenId,
                    supply,
                    []
                );

            });

            it("issueTicket() should require MARKET_HANDLER role", async function () {

                // non-MARKET_HANDLER attempt
                await expect(
                    ticketAsItems.connect(associate).issueTicket(tokenId, supply, buyer.address)
                ).to.be.revertedWith("Access denied, caller doesn't have role");

                // Get counter
                counter = await ticketAsItems.getNextTicket();

                // Test
                expect(
                    counter.eq(tokenId),
                    "non-MARKET_HANDLER can issue a ticket"
                ).is.true;

                // MARKET_HANDLER attempt
                await ticketAsItems.connect(marketHandler).issueTicket(tokenId, supply, buyer.address);

                // Get counter
                counter = await ticketAsItems.getNextTicket();

                // Test
                expect(
                    counter.gt(tokenId),
                    "MARKET_HANDLER can't issue a ticket"
                ).is.true;

            });

        });

        context("Issuing Tickets", async function () {

            it("should transfer full supply of escrow ticket to buyer", async function () {

                // ESCROW_AGENT transfers tokens to ticketer
                // N.B. in reality they would go from escrow agent to market handler to ticketer
                await seenHausNFT.connect(escrowAgent).safeTransferFrom(
                    escrowAgent.address,
                    ticketAsItems.address,
                    tokenId,
                    supply,
                    []
                );

                // MARKET_HANDLER issues ticket
                await ticketAsItems.connect(marketHandler).issueTicket(tokenId, supply, buyer.address);

                // Get buyer's balance of ticket items
                balance = await ticketAsItems.balanceOf(buyer.address, tokenId);

                // Test
                expect(
                    balance.eq(supply),
                    "TicketAsItems didn't transfer full supply of ticket to buyer"
                ).is.true;

            });

            context("should revert if", async function () {

                it("token amount is zero", async function () {

                    // MARKET_HANDLER attempts to issues ticket without transferring tokens first
                    await expect(
                        ticketAsItems.connect(marketHandler).issueTicket(tokenId, "0", buyer.address)
                    ).revertedWith("Token amount cannot be zero.")

                });

                it("token amount hasn't been transferred to this contract", async function () {

                    // MARKET_HANDLER attempts to issues ticket without transferring tokens first
                    await expect(
                        ticketAsItems.connect(marketHandler).issueTicket(tokenId, supply, buyer.address)
                    ).revertedWith("Must transfer token amount to ticketer first.")


                });

            });

        });

        context("Transferring Tickets", async function () {

            beforeEach(async function () {

                // ESCROW_AGENT transfers tokens to ticketer
                // N.B. in reality they would go from escrow agent to market handler to ticketer
                await seenHausNFT.connect(escrowAgent).safeTransferFrom(
                    escrowAgent.address,
                    ticketAsItems.address,
                    tokenId,
                    supply,
                    []
                );

                // MARKET_HANDLER issues ticket
                ticketId = await ticketAsItems.getNextTicket();
                await ticketAsItems.connect(marketHandler).issueTicket(tokenId, supply, buyer.address);

            });

            it("should allow buyer to transfer their whole balance to another address", async function () {

                // Buyer transfers their entire balance to associate
                await ticketAsItems.connect(buyer).safeTransferFrom(
                    buyer.address,
                    associate.address,
                    tokenId,
                    supply,
                    []
                );

                // Get buyer's balance of ticket
                balance = await ticketAsItems.balanceOf(buyer.address, ticketId);

                // Test
                expect(
                    balance.eq("0"),
                    "TicketAsItems didn't transfer balance of ticket to associate"
                ).is.true;

                // Get associate's balance of ticket
                balance = await ticketAsItems.balanceOf(associate.address, ticketId);

                // Test
                expect(
                    balance.eq(supply),
                    "TicketAsItems didn't transfer balance of ticket to associate"
                ).is.true;
            });

            it("should allow buyer to transfer part of their balance to another address", async function () {

                // Buyer transfers half their balance to associate
                await ticketAsItems.connect(buyer).safeTransferFrom(
                    buyer.address,
                    associate.address,
                    tokenId,
                    half,
                    []
                );

                // Get buyer's balance of ticket
                balance = await ticketAsItems.balanceOf(buyer.address, ticketId);

                // Test
                expect(
                    balance.eq(half),
                    "TicketAsItems didn't transfer balance of ticket to associate"
                ).is.true;

                // Get associate's balance of ticket
                balance = await ticketAsItems.balanceOf(associate.address, ticketId);

                // Test
                expect(
                    balance.eq(half),
                    "TicketAsItems didn't transfer balance of ticket to associate"
                ).is.true;
            });

        });

        context("Claiming Tickets", async function () {

            beforeEach(async function () {

                // ESCROW_AGENT transfers tokens to ticketer
                // N.B. in reality they would go from escrow agent to market handler to ticketer
                await seenHausNFT.connect(escrowAgent).safeTransferFrom(
                    escrowAgent.address,
                    ticketAsItems.address,
                    tokenId,
                    supply,
                    []
                );

                // MARKET_HANDLER issues ticket
                ticketId = await ticketAsItems.getNextTicket();
                await ticketAsItems.connect(marketHandler).issueTicket(tokenId, supply, buyer.address);

            });

            it("should transfer buyer's balance of the ticketed token to buyer", async function () {

                // MARKET_HANDLER issues ticket
                await ticketAsItems.connect(buyer).claim(ticketId);

                // Get buyer's balance of proof-of-ownership NFT
                balance = await seenHausNFT.balanceOf(buyer.address, tokenId);

                // Test
                expect(
                    balance.eq(supply),
                    "TicketAsItems didn't transfer balance of ticketed token to buyer"
                ).is.true;

            });

            it("should allow multiple ticket holders to claim their share of the ticketed token", async function () {

                // Buyer transfers half their balance to associate
                await ticketAsItems.connect(buyer).safeTransferFrom(
                    buyer.address,
                    associate.address,
                    tokenId,
                    half,
                    []
                );

                // Buyer claims their balance
                await ticketAsItems.connect(buyer).claim(ticketId);

                // Get buyer's balance of proof-of-ownership NFT
                balance = await seenHausNFT.balanceOf(buyer.address, tokenId);

                // Test
                expect(
                    balance.eq(half),
                    "TicketAsItems didn't transfer balance of ticketed token to buyer"
                ).is.true;

                // Associate claims their balance
                await ticketAsItems.connect(associate).claim(ticketId);

                // Get buyer's balance of proof-of-ownership NFT
                balance = await seenHausNFT.balanceOf(associate.address, tokenId);

                // Test
                expect(
                    balance.eq(half),
                    "TicketAsItems didn't transfer balance of ticketed token to associate"
                ).is.true;

            });

            context("should revert if", async function () {

                it("caller never held a balance of the ticket's supply", async function () {

                    // buyer claims their ticket balance
                    await expect(
                        ticketAsItems.connect(associate).claim(ticketId)
                    ).revertedWith("Caller has no balance for this ticket");

                });

                it("caller held a balance of the ticket's supply but has claimed", async function () {

                    // buyer claims their ticket balance
                    await ticketAsItems.connect(buyer).claim(ticketId);

                    // buyer claims their ticket balance
                    await expect(
                        ticketAsItems.connect(buyer).claim(ticketId)
                    ).revertedWith("Caller has no balance for this ticket");

                });

            });

        });

    });

});