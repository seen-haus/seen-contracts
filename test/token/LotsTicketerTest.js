const hre = require("hardhat");
const ethers = hre.ethers;
const { expect } = require("chai");
const Role = require("../../domain/Role");
const EscrowTicket = require("../../domain/EscrowTicket");
const Ticketer = require("../../domain/Ticketer");
const { InterfaceIds } = require('../../scripts/util/diamond-utils.js')
const { deployDiamond } = require('../../scripts/util/deploy-diamond.js');
const { deployMarketControllerFacets } = require('../../scripts/util/deploy-market-controller-facets.js');

describe("LotsTicketer", function() {

    // Common vars
    let accounts, deployer, admin, escrowAgent, associate, creator, marketHandler, buyer;
    let AccessController, accessController;
    let MarketController, marketController;
    let SeenHausNFT, seenHausNFT;
    let LotsTicketer, lotsTicketer;
    let staking, multisig, vipStakerAmount, feePercentage, maxRoyaltyPercentage, outBidPercentage, defaultTicketerType;
    let ticket, ticketId, tokenId, tokenURI, counter, supply, balance, royaltyPercentage, owner, consignmentId, support;
    let ticketURI, ticketURIBase = "https://seen.haus/ticket/metadata/";

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

        // Deploy the Diamond
        [diamond, diamondLoupe, diamondCut, accessController] = await deployDiamond();

        // Prepare MarketController initialization arguments
        const initArgs = [
            accessController.address,
            staking.address,
            multisig.address,
            vipStakerAmount,
            feePercentage,
            maxRoyaltyPercentage,
            outBidPercentage,
            defaultTicketerType
        ];

        // Cut the MarketController facet into the Diamond
        await deployMarketControllerFacets(diamond, initArgs);

        // Cast Diamond to MarketController
        marketController = await ethers.getContractAt('IMarketController', diamond.address);

        // Deploy the SeenHausNFT contract
        SeenHausNFT = await ethers.getContractFactory("SeenHausNFT");
        seenHausNFT = await SeenHausNFT.deploy(
            accessController.address,
            marketController.address
        );
        await seenHausNFT.deployed();

        // Deploy the LotsTicketer contract
        LotsTicketer = await ethers.getContractFactory("LotsTicketer");
        lotsTicketer = await LotsTicketer.deploy(
            accessController.address,
            marketController.address
        );
        await lotsTicketer.deployed();

        // NFT address gets set after deployment since it requires
        // the MarketController's address in its constructor
        await marketController.setNft(seenHausNFT.address);

        // Deployer grants ADMIN role to admin address and renounces admin
        await accessController.connect(deployer).grantRole(Role.ADMIN, admin.address);
        await accessController.connect(deployer).renounceRole(Role.ADMIN, deployer.address);

        // Grant MARKET_HANDLER to SeenHausNFT and LotsTicketer
        await accessController.connect(admin).grantRole(Role.MARKET_HANDLER, seenHausNFT.address);
        await accessController.connect(admin).grantRole(Role.MARKET_HANDLER, lotsTicketer.address);

    });

    context("Ticketing", async function () {

        beforeEach( async function () {

            // Prepare for roled access to privileged methods
            await accessController.connect(admin).grantRole(Role.MARKET_HANDLER, marketHandler.address);
            await accessController.connect(admin).grantRole(Role.ESCROW_AGENT, escrowAgent.address);

            // Setup values
            consignmentId = await marketController.getNextConsignment();
            ticketId = await lotsTicketer.getNextTicket();
            tokenId = await seenHausNFT.getNextToken();
            tokenURI = "ipfs://QmXBB6qm5vopwJ6ddxb1mEr1Pp87AHd3BUgVbsipCf9hWU";
            supply = "50";
            royaltyPercentage = maxRoyaltyPercentage;

            // ESCROW_AGENT mints physical
            await seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI, royaltyPercentage);

        });

        context("Privileged Access", async function () {

            it("issueTicket() should require MARKET_HANDLER role", async function () {

                // non-MARKET_HANDLER attempt
                await expect(
                    lotsTicketer.connect(associate).issueTicket(consignmentId, supply, buyer.address)
                ).to.be.revertedWith("Access denied, caller doesn't have role");

                // Get counter
                counter = await lotsTicketer.getNextTicket();

                // Test
                expect(
                    counter.eq(ticketId),
                    "non-MARKET_HANDLER can issue a ticket"
                ).is.true;

                // MARKET_HANDLER attempt
                await lotsTicketer.connect(marketHandler).issueTicket(consignmentId, supply, buyer.address);

                // Get counter
                counter = await lotsTicketer.getNextTicket();

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
                ticketId = await lotsTicketer.getNextTicket();
                await lotsTicketer.connect(marketHandler).issueTicket(consignmentId, supply, buyer.address);

            });

            it("claim() should trigger a ConsignmentReleased event on MarketController", async function () {

                // Make change, test event
                await expect(
                    lotsTicketer.connect(buyer).claim(ticketId)
                ).to.emit(marketController, 'ConsignmentReleased')
                    .withArgs(
                        consignmentId,
                        supply,
                        buyer.address
                    );

            });

        });

        context("Issuing Tickets", async function () {

            it("should transfer escrow ticket to buyer", async function () {
                
                // MARKET_HANDLER issues ticket
                await lotsTicketer.connect(marketHandler).issueTicket(consignmentId, supply, buyer.address);

                // Get owner of ticket
                owner = await lotsTicketer.ownerOf(tokenId);

                // Test
                expect(
                    owner === buyer.address,
                    "LotsTicketer didn't transfer full supply of ticket to buyer"
                ).is.true;

            });

            context("Revert Reasons", async function () {

                it("should revert if consignment doesn't exist", async function () {

                    // A non-existent consignment
                    consignmentId = marketController.getNextConsignment();

                    // MARKET_HANDLER attempts to issue ticket with invalid consignment id
                    await expect(
                        lotsTicketer.connect(marketHandler).issueTicket(consignmentId, "0", buyer.address)
                    ).revertedWith("Consignment does not exist")

                });

                it("should revert if token amount is zero", async function () {

                    // MARKET_HANDLER attempts to issues ticket without transferring tokens first
                    await expect(
                        lotsTicketer.connect(marketHandler).issueTicket(consignmentId, "0", buyer.address)
                    ).revertedWith("Token amount cannot be zero.")

                });

            });

        });

        context("Transferring Tickets", async function () {

            beforeEach(async function () {

                // MARKET_HANDLER issues ticket
                ticketId = await lotsTicketer.getNextTicket();
                await lotsTicketer.connect(marketHandler).issueTicket(consignmentId, supply, buyer.address);

            });

            it("should allow buyer to transfer their indivisible ticket to another address", async function () {

                // Buyer transfers their ticket to associate
                await lotsTicketer.connect(buyer).transferFrom(
                    buyer.address,
                    associate.address,
                    ticketId
                );

                // Get owner of ticket
                owner = await lotsTicketer.ownerOf(ticketId);

                // Test
                expect(
                    owner === associate.address,
                    "LotsTicketer didn't transfer ticket to associate"
                ).is.true;

            });

        });

        context("Claiming Tickets", async function () {

            beforeEach(async function () {

                // MARKET_HANDLER issues ticket
                ticketId = await lotsTicketer.getNextTicket();
                await lotsTicketer.connect(marketHandler).issueTicket(consignmentId, supply, buyer.address);

            });

            it("should transfer buyer's balance of the ticketed token to buyer", async function () {

                // MARKET_HANDLER issues ticket
                await lotsTicketer.connect(buyer).claim(ticketId);

                // Get buyer's balance of proof-of-ownership NFT
                balance = await seenHausNFT.balanceOf(buyer.address, tokenId);

                // Test
                expect(
                    balance.eq(supply),
                    "LotsTicketer didn't transfer balance of ticketed token to buyer"
                ).is.true;

            });

            context("Revert Reasons", async function () {

                it("caller is not holder of the ticket", async function () {

                    // buyer claims their ticket balance
                    await expect(
                        lotsTicketer.connect(associate).claim(ticketId)
                    ).revertedWith("Caller not ticket holder");

                });

            });

        });

        context("Reading Ticket Info", async function () {

            beforeEach(async function () {

                // MARKET_HANDLER issues ticket
                ticketId = await lotsTicketer.getNextTicket();
                await lotsTicketer.connect(marketHandler).issueTicket(consignmentId, supply, buyer.address);

            });

            context("getTicket()", async function () {

                it("should return a valid EscrowTicket struct", async function () {

                    // Get ticket
                    const response = await lotsTicketer.getTicket(ticketId);

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
                        ticketId = lotsTicketer.getNextTicket();

                        // buyer claims their ticket balance
                        await expect(
                            lotsTicketer.getTicket(ticketId)
                        ).revertedWith("Ticket does not exist");

                    });

                });

            });

            context("getTicketURI()", async function () {

                it("should return the appropriate dynamic URI for the ticket", async function () {

                    // Get ticket URI
                    ticketURI = await lotsTicketer.getTicketURI(ticketId);

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
                    ticketURI = await lotsTicketer.getTicketURI(ticketId);

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
                support = await lotsTicketer.supportsInterface("0x01ffc9a7");

                // Test
                await expect(
                    support,
                    "ERC-165 interface not supported"
                ).is.true;

            });

            it("should indicate support for ERC-721 interface", async function () {

                // See https://eips.ethereum.org/EIPS/eip-721#specification
                support = await lotsTicketer.supportsInterface("0x80ac58cd");

                // Test
                await expect(
                    support,
                    "ERC-721 interface not supported"
                ).is.true;

            });

            it("should indicate support for IEscrowTicketer interface", async function () {

                // Current interfaceId for IEscrowTicketer
                support = await lotsTicketer.supportsInterface("0x84200a73");

                // Test
                await expect(
                    support,
                    "IEscrowTicketer interface not supported"
                ).is.true;

            });

        });

    });

});