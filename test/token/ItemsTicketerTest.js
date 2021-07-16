const hre = require("hardhat");
const ethers = hre.ethers;
const { expect } = require("chai");
const Role = require("../../domain/Role");
const EscrowTicket = require("../../domain/EscrowTicket");
const Ticketer = require("../../domain/Ticketer");

describe("ItemsTicketer", function() {

    // Common vars
    let accounts, deployer, admin, escrowAgent, associate, creator, marketHandler, buyer;
    let AccessController, accessController;
    let MarketController, marketController;
    let SeenHausNFT, seenHausNFT;
    let ItemsTicketer, itemsTicketer;
    let staking, multisig, vipStakerAmount, feePercentage, maxRoyaltyPercentage, outBidPercentage, defaultTicketerType;
    let ticketId, tokenId, tokenURI, counter, supply, half, balance, royaltyPercentage, consignmentId, support;
    let ticketURI, ticketURIBase = "https://seen.haus/ticket/metadata/";

    beforeEach( async function () {

        // Make accounts available
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        admin = accounts[1];
        escrowAgent = accounts[2];
        creator = accounts[3];
        associate = accounts[4];
        buyer = accounts[5];

        staking = accounts[6];        // We just need addresses for these,
        multisig = accounts[7];       // not functional contracts
        marketHandler = accounts[8];  // .

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

        // Deploy the ItemsTicketer contract
        ItemsTicketer = await ethers.getContractFactory("ItemsTicketer");
        itemsTicketer = await ItemsTicketer.deploy(
            accessController.address,
            marketController.address
        );
        await itemsTicketer.deployed();

        // NFT address gets set after deployment since it requires
        // the MarketController's address in its constructor
        await marketController.setNft(seenHausNFT.address);

        // Deployer grants ADMIN role to admin address and renounces admin
        await accessController.connect(deployer).grantRole(Role.ADMIN, admin.address);
        await accessController.connect(deployer).renounceRole(Role.ADMIN, deployer.address);

        // Grant MARKET_HANDLER to SeenHausNFT and ItemsTicketer
        await accessController.connect(admin).grantRole(Role.MARKET_HANDLER, seenHausNFT.address);
        await accessController.connect(admin).grantRole(Role.MARKET_HANDLER, itemsTicketer.address);

    });

    context("Ticketing", async function () {

        beforeEach( async function () {

            // Prepare for roled access to privileged methods
            await accessController.connect(admin).grantRole(Role.MARKET_HANDLER, marketHandler.address);
            await accessController.connect(admin).grantRole(Role.ESCROW_AGENT, escrowAgent.address);

            // Setup values
            consignmentId = await marketController.getNextConsignment();
            ticketId = await itemsTicketer.getNextTicket();
            tokenId = await seenHausNFT.getNextToken();
            tokenURI = "ipfs://QmXBB6qm5vopwJ6ddxb1mEr1Pp87AHd3BUgVbsipCf9hWU";
            supply = "50";
            half = "25";
            royaltyPercentage = maxRoyaltyPercentage;

            // ESCROW_AGENT mints physical
            await seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI, royaltyPercentage);

        });

        context("Privileged Access", async function () {

            it("issueTicket() should require MARKET_HANDLER role", async function () {

                // non-MARKET_HANDLER attempt
                await expect(
                    itemsTicketer.connect(associate).issueTicket(consignmentId, supply, buyer.address)
                ).to.be.revertedWith("Access denied, caller doesn't have role");

                // Get counter
                counter = await itemsTicketer.getNextTicket();

                // Test
                expect(
                    counter.eq(ticketId),
                    "non-MARKET_HANDLER can issue a ticket"
                ).is.true;

                // MARKET_HANDLER attempt
                await itemsTicketer.connect(marketHandler).issueTicket(consignmentId, supply, buyer.address);

                // Get counter
                counter = await itemsTicketer.getNextTicket();

                // Test
                expect(
                    counter.gt(ticketId),
                    "MARKET_HANDLER can't issue a ticket"
                ).is.true;

            });

        });

        context("Change Events", async function () {

            beforeEach(async function () {

                // MARKET_HANDLER issues ticket
                ticketId = await itemsTicketer.getNextTicket();
                await itemsTicketer.connect(marketHandler).issueTicket(consignmentId, supply, buyer.address);

            });

            it("claim() should trigger a ConsignmentReleased event on MarketController", async function () {

                // Make change, test event
                await expect(
                    itemsTicketer.connect(buyer).claim(ticketId)
                ).to.emit(marketController, 'ConsignmentReleased')
                    .withArgs(
                        consignmentId,
                        supply,
                        buyer.address
                    );

            });

        });

        context("Issuing Tickets", async function () {

            it("should transfer full supply of escrow ticket to buyer", async function () {

                // MARKET_HANDLER issues ticket
                await itemsTicketer.connect(marketHandler).issueTicket(consignmentId, supply, buyer.address);

                // Get buyer's balance of ticket items
                balance = await itemsTicketer.balanceOf(buyer.address, tokenId);

                // Test
                expect(
                    balance.eq(supply),
                    "ItemsTicketer didn't transfer full supply of ticket to buyer"
                ).is.true;

            });

            context("Revert Reasons", async function () {

                it("consignment doesn't exist", async function () {

                    // A non-existent consignment
                    consignmentId = marketController.getNextConsignment();

                    // MARKET_HANDLER attempts to issue ticket with invalid consignment id
                    await expect(
                        itemsTicketer.connect(marketHandler).issueTicket(consignmentId, "0", buyer.address)
                    ).revertedWith("Consignment does not exist")

                });

                it("token amount is zero", async function () {

                    // MARKET_HANDLER attempts to issues ticket without transferring tokens first
                    await expect(
                        itemsTicketer.connect(marketHandler).issueTicket(consignmentId, "0", buyer.address)
                    ).revertedWith("Token amount cannot be zero.")

                });

            });

        });

        context("Transferring Tickets", async function () {

            beforeEach(async function () {

                // MARKET_HANDLER issues ticket
                ticketId = await itemsTicketer.getNextTicket();
                await itemsTicketer.connect(marketHandler).issueTicket(consignmentId, supply, buyer.address);

            });

            it("should allow buyer to transfer their whole balance to another address", async function () {

                // Buyer transfers their entire balance to associate
                await itemsTicketer.connect(buyer).safeTransferFrom(
                    buyer.address,
                    associate.address,
                    ticketId,
                    supply,
                    []
                );

                // Get buyer's balance of ticket
                balance = await itemsTicketer.balanceOf(buyer.address, ticketId);

                // Test
                expect(
                    balance.eq("0"),
                    "ItemsTicketer didn't transfer balance of ticket to associate"
                ).is.true;

                // Get associate's balance of ticket
                balance = await itemsTicketer.balanceOf(associate.address, ticketId);

                // Test
                expect(
                    balance.eq(supply),
                    "ItemsTicketer didn't transfer balance of ticket to associate"
                ).is.true;
            });

            it("should allow buyer to transfer part of their balance to another address", async function () {

                // Buyer transfers half their balance to associate
                await itemsTicketer.connect(buyer).safeTransferFrom(
                    buyer.address,
                    associate.address,
                    ticketId,
                    half,
                    []
                );

                // Get buyer's balance of ticket
                balance = await itemsTicketer.balanceOf(buyer.address, ticketId);

                // Test
                expect(
                    balance.eq(half),
                    "ItemsTicketer didn't transfer balance of ticket to associate"
                ).is.true;

                // Get associate's balance of ticket
                balance = await itemsTicketer.balanceOf(associate.address, ticketId);

                // Test
                expect(
                    balance.eq(half),
                    "ItemsTicketer didn't transfer balance of ticket to associate"
                ).is.true;
            });

        });

        context("Claiming Tickets", async function () {

            beforeEach(async function () {

                // MARKET_HANDLER issues ticket
                ticketId = await itemsTicketer.getNextTicket();
                await itemsTicketer.connect(marketHandler).issueTicket(consignmentId, supply, buyer.address);

            });

            it("should transfer buyer's balance of the ticketed token to buyer", async function () {

                // MARKET_HANDLER issues ticket
                await itemsTicketer.connect(buyer).claim(ticketId);

                // Get buyer's balance of proof-of-ownership NFT
                balance = await seenHausNFT.balanceOf(buyer.address, tokenId);

                // Test
                expect(
                    balance.eq(supply),
                    "ItemsTicketer didn't transfer balance of ticketed token to buyer"
                ).is.true;

            });

            it("should allow multiple ticket holders to claim their share of the ticketed token", async function () {

                // Buyer transfers half their balance to associate
                await itemsTicketer.connect(buyer).safeTransferFrom(
                    buyer.address,
                    associate.address,
                    ticketId,
                    half,
                    []
                );

                // Buyer claims their balance
                await itemsTicketer.connect(buyer).claim(ticketId);

                // Get buyer's balance of proof-of-ownership NFT
                balance = await seenHausNFT.balanceOf(buyer.address, tokenId);

                // Test
                expect(
                    balance.eq(half),
                    "ItemsTicketer didn't transfer balance of ticketed token to buyer"
                ).is.true;

                // Associate claims their balance
                await itemsTicketer.connect(associate).claim(ticketId);

                // Get buyer's balance of proof-of-ownership NFT
                balance = await seenHausNFT.balanceOf(associate.address, tokenId);

                // Test
                expect(
                    balance.eq(half),
                    "ItemsTicketer didn't transfer balance of ticketed token to associate"
                ).is.true;

            });

            context("Revert Reasons", async function () {

                it("caller never held a balance of the ticket's supply", async function () {

                    // buyer claims their ticket balance
                    await expect(
                        itemsTicketer.connect(associate).claim(ticketId)
                    ).revertedWith("Caller has no balance for this ticket");

                });

                it("caller held a balance of the ticket's supply but has claimed", async function () {

                    // buyer claims their ticket balance
                    await itemsTicketer.connect(buyer).claim(ticketId);

                    // buyer claims their ticket balance
                    await expect(
                        itemsTicketer.connect(buyer).claim(ticketId)
                    ).revertedWith("Caller has no balance for this ticket");

                });

            });

        });

        context("Reading Ticket Information", async function () {

            beforeEach(async function () {

                // MARKET_HANDLER issues ticket
                ticketId = await itemsTicketer.getNextTicket();
                await itemsTicketer.connect(marketHandler).issueTicket(consignmentId, supply, buyer.address);

            });

            context("getTicket()", async function () {

                it("should return a valid EscrowTicket struct", async function () {

                    // Get ticket
                    const response = await itemsTicketer.getTicket(ticketId);

                    // Convert to entity
                    ticket = new EscrowTicket(
                        response.id.toString(),
                        response.consignmentId.toString(),
                        response.amount.toString(),
                        response.itemURI
                    );

                    // Test validity
                    expect(
                        ticket.isValid(),
                        "EscrowTicket not valid"
                    ).is.true;

                });

                context("Revert Reasons", async function () {

                    it("ticket does not exist", async function () {

                        // A non-existent ticket id
                        ticketId = itemsTicketer.getNextTicket();

                        // buyer claims their ticket balance
                        await expect(
                            itemsTicketer.getTicket(ticketId)
                        ).revertedWith("Ticket does not exist");

                    });

                });

            });

            context("getTicketURI()", async function () {

                it("should return the appropriate dynamic URI for the ticket", async function () {

                    // Get ticket URI
                    ticketURI = await itemsTicketer.getTicketURI(ticketId);

                    // Test validity
                    expect(
                        ticketURI === `${ticketURIBase}${ticketId}`,
                        "TicketURI not correct"
                    ).is.true;

                });

                it("should work even if the ticket id is the max uint256 value", async function () {

                    // Largest possible token id
                    ticketId = ethers.constants.MaxUint256;

                    // Get ticket URI
                    ticketURI = await itemsTicketer.getTicketURI(ticketId);

                    // Test validity
                    expect(
                        ticketURI === `${ticketURIBase}${ticketId}`,
                        "TicketURI not correct"
                    ).is.true;

                });

            });

        });

    });

    context("Interfaces", async function () {

        context("supportsInterface()", async function () {

            it("should indicate support for ERC-165 interface", async function () {

                // See https://eips.ethereum.org/EIPS/eip-165#how-a-contract-will-publish-the-interfaces-it-implements
                support = await itemsTicketer.supportsInterface("0x01ffc9a7");

                // Test
                await expect(
                    support,
                    "ERC-165 interface not supported"
                ).is.true;

            });

            it("should indicate support for ERC-1155 interface", async function () {

                // See https://eips.ethereum.org/EIPS/eip-1155#specification
                support = await itemsTicketer.supportsInterface("0xd9b67a26");

                // Test
                await expect(
                    support,
                    "ERC-1155 interface not supported"
                ).is.true;

            });

            it("should indicate support for IEscrowTicketer interface", async function () {

                // Current interfaceId for IEscrowTicketer
                support = await itemsTicketer.supportsInterface("0x84200a73");

                // Test
                await expect(
                    support,
                    "IEscrowTicketer interface not supported"
                ).is.true;

            });

        });

    });

});