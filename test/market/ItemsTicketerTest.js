const hre = require("hardhat");
const ethers = hre.ethers;
const { expect } = require("chai");
const Role = require("../../scripts/domain/Role");
const EscrowTicket = require("../../scripts/domain/EscrowTicket");
const Ticketer = require("../../scripts/domain/Ticketer");
const { InterfaceIds } = require('../../scripts/constants/supported-interfaces.js');
const { deployMarketDiamond } = require('../../scripts/util/deploy-market-diamond.js');
const { deployMarketControllerFacets } = require('../../scripts/util/deploy-market-controller-facets.js');
const { deployMarketClients } = require("../../scripts/util/deploy-market-clients.js");

/**
 *  Test the ItemsTicketer contract
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
describe("ItemsTicketer", function() {

    // Common vars
    let accounts, deployer, admin, escrowAgent, associate, creator, marketHandler, buyer;
    let accessController, marketController;
    let seenHausNFT, itemsTicketer;
    let staking, multisig, vipStakerAmount, feePercentage, maxRoyaltyPercentage, outBidPercentage, defaultTicketerType;
    let ticketId, tokenId, tokenURI, counter, supply, half, balance, royaltyPercentage, consignmentId, support;
    let ticketURI, ticketURIBase = "https://seen.haus/ticket/metadata/items-ticketer/";
    let replacementAddress = "0x2d36143CC2E0E74E007E7600F341dC9D37D81C07";

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

        // Deploy the Diamond
        [marketDiamond, diamondLoupe, diamondCut, accessController] = await deployMarketDiamond();

        // Prepare MarketController initialization arguments
        const marketConfig = [
            staking.address,
            multisig.address,
            vipStakerAmount,
            feePercentage,
            maxRoyaltyPercentage,
            outBidPercentage,
            defaultTicketerType
        ];

        // Cut the MarketController facet into the Diamond
        await deployMarketControllerFacets(marketDiamond, marketConfig);

        // Cast Diamond to MarketController
        marketController = await ethers.getContractAt('IMarketController', marketDiamond.address);

        // Deploy the Market Client implementation/proxy pairs
        const marketClientArgs = [accessController.address, marketController.address];
        [impls, proxies, clients] = await deployMarketClients(marketClientArgs);
        [lotsTicketer, itemsTicketer, seenHausNFT] = clients;

        // Cast LotsTicketer's proxy to IMarketClientProxy
        itemsTicketerProxy = await ethers.getContractAt('IMarketClientProxy', seenHausNFT.address);
        
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

    context("Interfaces", async function () {

        context("supportsInterface()", async function () {

            it("should indicate support for ERC-165 interface", async function () {

                // See https://eips.ethereum.org/EIPS/eip-165#how-a-contract-will-publish-the-interfaces-it-implements
                support = await itemsTicketer.supportsInterface(InterfaceIds.IERC165);

                // Test
                await expect(
                    support,
                    "ERC-165 interface not supported"
                ).is.true;

            });

            it("should indicate support for IERC1155 interface", async function () {

                // Current interfaceId for IERC1155
                support = await itemsTicketer.supportsInterface(InterfaceIds.IERC1155);

                // Test
                await expect(
                    support,
                    "IAuctionHandler interface not supported"
                ).is.true;

            });

            it("should indicate support for IEscrowTicketer interface", async function () {

                // Current interfaceId for IEscrowTicketer
                support = await itemsTicketer.supportsInterface(InterfaceIds.IEscrowTicketer);

                // Test
                await expect(
                    support,
                    "IEscrowTicketer interface not supported"
                ).is.true;

            });

        });

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

            context("Proxy", async function () {

                // N.B. MarketClientProxy provides storage and accessors for the AccessController and MarketController
                // used by the implementation contract. This is because all the market client contracts need these
                // references, but adding the storage and accessors to them pushes their size toward the upper limit.

                it("setImplementation() should require ADMIN to set the implementation address", async function () {

                    // non-ADMIN attempt
                    await expect(
                        itemsTicketerProxy.connect(associate).setImplementation(replacementAddress)
                    ).to.be.revertedWith("Access denied, caller doesn't have role");

                    // Get address
                    address = await itemsTicketerProxy.getImplementation();

                    // Test
                    expect(
                        address !== replacementAddress,
                        "non-ADMIN can set implementation address"
                    ).is.true;

                    // ADMIN attempt
                    await itemsTicketerProxy.connect(admin).setImplementation(replacementAddress);

                    // Get address
                    address = await itemsTicketerProxy.getImplementation();

                    // Test
                    expect(
                        address === replacementAddress,
                        "ADMIN can't set implementation address"
                    ).is.true;

                });

                it("setAccessController() should require ADMIN to set the accessController address", async function () {

                    // non-ADMIN attempt
                    await expect(
                        itemsTicketerProxy.connect(associate).setAccessController(replacementAddress)
                    ).to.be.revertedWith("Access denied, caller doesn't have role");

                    // Get address
                    address = await itemsTicketerProxy.getAccessController();

                    // Test
                    expect(
                        address !== replacementAddress,
                        "non-ADMIN can set accessController address"
                    ).is.true;

                    // ADMIN attempt
                    await itemsTicketerProxy.connect(admin).setAccessController(replacementAddress);

                    // Get address
                    address = await itemsTicketerProxy.getAccessController();

                    // Test
                    expect(
                        address === replacementAddress,
                        "ADMIN can't set accessController address"
                    ).is.true;

                });

                it("setMarketController() should require ADMIN to set the marketController address", async function () {

                    // N.B. There is no separate test suite for MarketClientBase.sol, which is an abstract contract.
                    //      Functionality not covered elsewhere will be tested here in the SeenHausNFT test suite.

                    // non-ADMIN attempt
                    await expect(
                        itemsTicketerProxy.connect(associate).setMarketController(replacementAddress)
                    ).to.be.revertedWith("Access denied, caller doesn't have role");

                    // Get address
                    address = await itemsTicketerProxy.getMarketController();

                    // Test
                    expect(
                        address !== replacementAddress,
                        "non-ADMIN can set marketController address"
                    ).is.true;

                    // ADMIN attempt
                    await itemsTicketerProxy.connect(admin).setMarketController(replacementAddress);

                    // Get address
                    address = await itemsTicketerProxy.getMarketController();

                    // Test
                    expect(
                        address === replacementAddress,
                        "ADMIN can't set marketController address"
                    ).is.true;

                });

            });

            context("Logic", async function () {

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

});