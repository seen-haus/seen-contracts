const hre = require("hardhat");
const ethers = hre.ethers;
const { expect } = require("chai");
const { time } = require('@openzeppelin/test-helpers');
const Role = require("../../scripts/domain/Role");
const Market = require("../../scripts/domain/Market");
const MarketHandler = require("../../scripts/domain/MarketHandler");
const Clock = require("../../scripts/domain/Clock");
const Auction = require("../../scripts/domain/Auction");
const State = require("../../scripts/domain/State");
const Outcome = require("../../scripts/domain/Outcome");
const Audience = require("../../scripts/domain/Audience");
const Ticketer = require("../../scripts/domain/Ticketer");
const Consignment = require("../../scripts/domain/Consignment");
const { InterfaceIds } = require('../../scripts/constants/supported-interfaces.js');
const { deployMarketDiamond } = require('../../scripts/util/deploy-market-diamond.js');
const { deployMarketControllerFacets } = require('../../scripts/util/deploy-market-controller-facets.js');
const { deployMarketHandlerFacets } = require('../../scripts/util/deploy-market-handler-facets.js');
const { deployMarketClients } = require("../../scripts/util/deploy-market-clients.js");

/**
 *  Test the AuctionHandler facets (AuctionBuilder, AuctionRunner)
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
describe("AuctionHandler", function() {

    // Common vars
    let accounts, deployer, admin, upgrader, creator, associate, seller, minter, bidder, rival, escrowAgent;
    let accessController;
    let marketController;
    let auctionHandler;
    let lotsTicketer, itemsTicketer, seenHausNFT;
    let Foreign721, foreign721;
    let Foreign1155, foreign1155;
    let SeenStaking, seenStaking;
    let multisig, vipStakerAmount, primaryFeePercentage, secondaryFeePercentage, maxRoyaltyPercentage, outBidPercentage, defaultTicketerType;
    let market, tokenAddress, tokenId, tokenURI, auction, physicalTokenId, physicalConsignmentId, secondaryMarketPhysicalTokenIdEscrowOwned, secondaryMarketPhysicalTokenIdNonEscrowOwned, consignmentId, nextConsignment, block, blockNumber;
    let royaltyPercentage, supply, start, duration, reserve, secondBidAmount, audience, clock, escrowTicketer;
    let royaltyAmount, sellerAmount, feeAmount, multisigAmount, stakingAmount, grossSale, netAfterRoyalties;
    let sellerBalance, contractBalance, buyerBalance, ticketerBalance, newBalance, badStartTime, signer, belowReserve, percentage, trollBid, outbid;

    const fifteenMinutes = "900"; // 900 seconds
    const fourteenMinutes = "840"; // 840 seconds
    const oneMinute = "60"; // 60 seconds

    beforeEach( async function () {

        // Get the current block info
        blockNumber = await ethers.provider.getBlockNumber();
        block = await ethers.provider.getBlock(blockNumber);

        // Make accounts available
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        admin = accounts[1];
        upgrader = accounts[2];
        creator = accounts[3]
        minter = accounts[4];
        associate = accounts[5];
        bidder = accounts[6];
        rival = accounts[7];
        escrowAgent = accounts[8];
        seller = accounts[9];

        multisig = accounts[10];         // We just need addresses for these, not functional contracts

        // Market control values
        vipStakerAmount = "500";              // Amount of xSEEN to be VIP
        primaryFeePercentage = "500";         // 5%    = 500
        secondaryFeePercentage = "250";       // 2.5%  = 250
        maxRoyaltyPercentage = "5000";        // 50%   = 5000
        outBidPercentage = "500";             // 5%    = 500
        defaultTicketerType = Ticketer.LOTS;  // default escrow ticketer type
        allowExternalTokensOnSecondary = false; // By default, don't allow external tokens to be sold via secondary market

        // Deploy the Foreign721 mock contract
        Foreign721 = await ethers.getContractFactory("Foreign721");
        foreign721 = await Foreign721.deploy();
        await foreign721.deployed();

        // Deploy the Foreign1155 mock contract
        Foreign1155 = await ethers.getContractFactory("Foreign1155");
        foreign1155 = await Foreign1155.deploy();
        await foreign1155.deployed();

        // Deploy the SeenStaking mock contract
        SeenStaking = await ethers.getContractFactory("SeenStaking");
        seenStaking = await SeenStaking.deploy();
        await seenStaking.deployed();

        // Deploy the Diamond
        [marketDiamond, diamondLoupe, diamondCut, accessController] = await deployMarketDiamond();

        // Prepare MarketController initialization arguments
        const marketConfig = [
            seenStaking.address,
            multisig.address,
            vipStakerAmount,
            primaryFeePercentage,
            secondaryFeePercentage,
            maxRoyaltyPercentage,
            outBidPercentage,
            defaultTicketerType,
        ];
        const marketConfigAdditional = [
            allowExternalTokensOnSecondary,
        ];

        // Temporarily grant UPGRADER role to deployer account
        await accessController.grantRole(Role.UPGRADER, deployer.address);

        // Cut the MarketController facet into the Diamond
        await deployMarketControllerFacets(marketDiamond, marketConfig, marketConfigAdditional);

        // Cast Diamond to MarketController
        marketController = await ethers.getContractAt('IMarketController', marketDiamond.address);

        // Cut the Market Handler facets into the Diamond
        [auctionBuilderFacet, auctionRunnerFacet, auctionEnderFacet, saleBuilderFacet, saleRunnerFacet, saleEnderFacet] = await deployMarketHandlerFacets(marketDiamond);

        // Cast Diamond to IAuctionHandler
        auctionHandler = await ethers.getContractAt('IAuctionHandler', marketDiamond.address);

        // Deploy the Market Client implementation/proxy pairs
        const marketClientArgs = [accessController.address, marketController.address];
        [impls, proxies, clients] = await deployMarketClients(marketClientArgs);
        [lotsTicketer, itemsTicketer, seenHausNFT] = clients;

        // NFT and escrow ticketer addresses get set after deployment since
        // they require the MarketController's address in their constructors
        await marketController.setNft(seenHausNFT.address);
        await marketController.setLotsTicketer(lotsTicketer.address);
        await marketController.setItemsTicketer(itemsTicketer.address);
        await marketController.setAllowExternalTokensOnSecondary(true);

        // Renounce temporarily granted UPGRADER role for deployer account
        await accessController.renounceRole(Role.UPGRADER, deployer.address);

        // Deployer grants ADMIN role to admin address and renounces admin
        await accessController.connect(deployer).grantRole(Role.ADMIN, admin.address);
        await accessController.connect(deployer).renounceRole(Role.ADMIN, deployer.address);

        // Grant MARKET_HANDLER to SeenHausNFT, AuctionHandler & LotsTicketer
        await accessController.connect(admin).grantRole(Role.MARKET_HANDLER, seenHausNFT.address);
        await accessController.connect(admin).grantRole(Role.MARKET_HANDLER, auctionHandler.address);
        await accessController.connect(admin).grantRole(Role.MARKET_HANDLER, lotsTicketer.address);

    });

    context("Interfaces", async function () {

        context("supportsInterface()", async function () {

            it("should indicate support for ERC-165 interface", async function () {

                // See https://eips.ethereum.org/EIPS/eip-165#how-a-contract-will-publish-the-interfaces-it-implements
                support = await marketController.supportsInterface(InterfaceIds.IERC165);

                // Test
                await expect(
                    support,
                    "ERC-165 interface not supported"
                ).is.true;

            });

            it("should indicate support for IAuctionHandler interface", async function () {

                // Current interfaceId for IAuctionHandler
                support = await marketController.supportsInterface(InterfaceIds.IAuctionHandler);

                // Test
                await expect(
                    support,
                    "IAuctionHandler interface not supported"
                ).is.true;

            });

            it("should indicate support for IAuctionBuilder interface", async function () {

                // Current interfaceId for IAuctionHandler
                support = await marketController.supportsInterface(InterfaceIds.IAuctionBuilder);

                // Test
                await expect(
                    support,
                    "IAuctionBuilder interface not supported"
                ).is.true;

            });

            it("should indicate support for IAuctionRunner interface", async function () {

                // Current interfaceId for IAuctionRunner
                support = await marketController.supportsInterface(InterfaceIds.IAuctionRunner);

                // Test
                await expect(
                    support,
                    "IAuctionRunner interface not supported"
                ).is.true;

            });

            it("should indicate support for IAuctionEnder interface", async function () {

                // Current interfaceId for IAuctionEnder
                support = await marketController.supportsInterface(InterfaceIds.IAuctionEnder);

                // Test
                await expect(
                    support,
                    "IAuctionEnder interface not supported"
                ).is.true;

            });

        });

    });

    context("Managing Auctions", async function () {

        beforeEach( async function () {

            // Prepare for roled access to privileged methods
            // Grant seller both SELLER and MINTER to avoid the need for transferring minted token balance from seller to minter
            // This would be true of an artist who has been given the ability to mint and to create sales and auctions
            await accessController.connect(admin).grantRole(Role.SELLER, seller.address);
            await accessController.connect(admin).grantRole(Role.MINTER, seller.address);

            // Escrow Agent needs to mint and market escrowed physical items
            await accessController.connect(admin).grantRole(Role.SELLER, escrowAgent.address);
            await accessController.connect(admin).grantRole(Role.ESCROW_AGENT, escrowAgent.address);

            // Seller approves AuctionHandler contract to transfer their tokens
            await seenHausNFT.connect(seller).setApprovalForAll(auctionHandler.address, true);
            await foreign721.connect(seller).setApprovalForAll(auctionHandler.address, true);
            await foreign1155.connect(seller).setApprovalForAll(auctionHandler.address, true);

            // Associate approves AuctionHandler contract to transfer their tokens
            await foreign721.connect(associate).setApprovalForAll(auctionHandler.address, true);
            await foreign1155.connect(associate).setApprovalForAll(auctionHandler.address, true);
            await seenHausNFT.connect(associate).setApprovalForAll(auctionHandler.address, true);

            // Mint a balance of one token for auctioning
            tokenURI = "ipfs://QmXBB6qm5vopwJ6ddxb1mEr1Pp87AHd3BUgVbsipCf9hWU";
            supply = "1";
            royaltyPercentage = maxRoyaltyPercentage;

            // Seller creates digital token on our contract
            consignmentId = await marketController.getNextConsignment();
            tokenId = await seenHausNFT.getNextToken();
            await seenHausNFT.connect(seller).mintDigital(supply, seller.address, tokenURI, royaltyPercentage);

            // Escrow agent creates physical token on our contract
            physicalConsignmentId = await marketController.getNextConsignment();
            physicalTokenId = await seenHausNFT.getNextToken();
            await seenHausNFT.connect(escrowAgent).mintPhysical(supply, seller.address, tokenURI, royaltyPercentage);

            // Create foreign token for secondary market sales
            await foreign721.connect(seller).mint(creator.address, tokenId, royaltyPercentage);

            // Create foreign multi-token for secondary market sales
            await foreign1155.connect(seller).mint(creator.address, tokenId, supply, royaltyPercentage);

            // Setup values
            tokenAddress = seenHausNFT.address;
            start = ethers.BigNumber.from(block.timestamp).add('900').toString(); // 15 minutes from latest block
            duration = ethers.BigNumber.from('86400'); // 24 hrs in seconds
            reserve = ethers.utils.parseUnits("1.5", "ether");
            audience = Audience.OPEN;
            clock = Clock.LIVE;

        });

        context("Privileged Access", async function () {

            context("New Auctions", async function () {

                context("createPrimaryAuction()", async function () {

                    it("should require caller has SELLER role", async function () {

                        // Get next consignment
                        nextConsignment = await marketController.getNextConsignment();

                        // non-SELLER attempt
                        await expect(
                            auctionHandler.connect(associate).createPrimaryAuction(
                                consignmentId,
                                start,
                                duration,
                                reserve,
                                audience,
                                clock
                            )
                        ).to.be.revertedWith("Access denied, caller doesn't have role");

                        // Test
                        expect(
                            (await marketController.getNextConsignment()).eq(nextConsignment),
                            "non-SELLER can create an auction"
                        ).is.true;

                        // SELLER attempt
                        await auctionHandler.connect(seller).createPrimaryAuction(
                            consignmentId,
                            start,
                            duration,
                            reserve,
                            audience,
                            clock
                        );

                        // Get next consignment
                        nextConsignment = await marketController.getNextConsignment();

                        // Test
                        expect(
                            nextConsignment.gt(consignmentId),
                            "SELLER can't create an auction"
                        ).is.true;

                    });

                    it("should require caller is the original asset consignor", async function () {

                        // Get next consignment
                        nextConsignment = await marketController.getNextConsignment();

                        // Grant SELLER role to address that is not consignor
                        await accessController.connect(admin).grantRole(Role.SELLER, associate.address);

                        // SELLER who is not original consignor attempts to create primary auction
                        await expect(
                            auctionHandler.connect(associate).createPrimaryAuction(
                                consignmentId,
                                start,
                                duration,
                                reserve,
                                audience,
                                clock
                            )
                        ).to.be.revertedWith("Caller is not consignor");

                        // Test
                        expect(
                            (await marketController.getNextConsignment()).eq(nextConsignment),
                            "SELLER who is not consignor can create a sale"
                        ).is.true;

                        // SELLER attempt
                        await auctionHandler.connect(seller).createPrimaryAuction(
                            consignmentId,
                            start,
                            duration,
                            reserve,
                            audience,
                            clock
                        );

                        // Get next consignment
                        nextConsignment = await marketController.getNextConsignment();

                        // Test
                        expect(
                            nextConsignment.gt(consignmentId),
                            "Original consignor can't create a sale"
                        ).is.true;

                    });
                });

                context("createSecondaryAuction()", async function () {

                    it("should fail if external tokens are not allowed to be listed on secondary", async function () {

                        // Creator transfers all their tokens to associate
                        await foreign1155.connect(creator).safeTransferFrom(creator.address, associate.address, tokenId, supply, []);

                        // Token is on a foreign contract
                        tokenAddress = foreign1155.address;

                        // Get next consignment
                        nextConsignment = await marketController.getNextConsignment();

                        await marketController.connect(admin).setAllowExternalTokensOnSecondary(false);

                        // non-SELLER attempt
                        await expect(
                            auctionHandler.connect(associate).createSecondaryAuction(
                                seller.address,
                                tokenAddress,
                                tokenId,
                                start,
                                duration,
                                reserve,
                                audience,
                                clock
                            )
                        ).to.be.revertedWith("Listing external tokens is not currently enabled");

                        // Test
                        expect(
                            (await marketController.getNextConsignment()).eq(nextConsignment),
                            "External token auction was created while external tokens were meant to be disabled"
                        ).is.true;

                        await marketController.connect(admin).setAllowExternalTokensOnSecondary(true);

                        // non-SELLER attempt
                        auctionHandler.connect(associate).createSecondaryAuction(
                            seller.address,
                            tokenAddress,
                            tokenId,
                            start,
                            duration,
                            reserve,
                            audience,
                            clock
                        );

                        // Get next consignment
                        nextConsignment = await marketController.getNextConsignment();

                        // Test
                        expect(
                            nextConsignment.gt(consignmentId),
                            "SELLER can't create an auction"
                        ).is.true;

                    });

                    it("should require caller has ESCROW_AGENT role if listing a physical NFT", async function () {

                        let bidderBalance = await seenHausNFT.balanceOf(bidder.address, physicalTokenId);
                        expect(bidderBalance.eq(0));
                        // Put physical token through an auction
                        await auctionHandler.connect(escrowAgent).createPrimaryAuction(
                            physicalConsignmentId,
                            start,
                            duration,
                            reserve,
                            audience,
                            clock
                        );
                        await time.increaseTo(start);
                        await auctionHandler.connect(bidder).bid(physicalConsignmentId, {value: reserve});
                        // Now fast-forward to end of auction...
                        await time.increaseTo(
                            ethers.BigNumber
                                .from(start)
                                .add(duration)
                                .add(
                                    "15" // 15s after end of auction
                                )
                                .toString()
                        );
                        let ticketId = await lotsTicketer.getNextTicket();
                        
                        // Bidder closes auction
                        await expect(
                            await auctionHandler.connect(bidder).closeAuction(physicalConsignmentId)
                        ).to.emit(auctionHandler, "AuctionEnded")
                            .withArgs(
                                physicalConsignmentId,
                                Outcome.CLOSED
                            );

                        bidderBalance = await seenHausNFT.balanceOf(bidder.address, physicalTokenId);
                        expect(bidderBalance.eq(0));

                        await expect(
                            lotsTicketer.connect(bidder).claim(ticketId)
                        ).to.emit(marketController, 'ConsignmentReleased')
                            .withArgs(
                                physicalConsignmentId,
                                supply,
                                bidder.address
                            );
                        bidderBalance = await seenHausNFT.balanceOf(bidder.address, physicalTokenId);
                        expect(bidderBalance.eq(1));

                        // non-ESCROW_AGENT attempt
                        await expect(
                            auctionHandler.connect(bidder).createSecondaryAuction(
                                seller.address,
                                seenHausNFT.address,
                                physicalTokenId,
                                start,
                                duration,
                                reserve,
                                audience,
                                clock
                            )
                        ).to.be.revertedWith("Physical NFT secondary listings require ESCROW_AGENT role");

                        // Transfer physical tokens to escrow agent
                        await seenHausNFT.connect(bidder).safeTransferFrom(
                            bidder.address,
                            escrowAgent.address,
                            physicalTokenId,
                            supply,
                            0x0
                        );

                        let escrowAgentBalance = await seenHausNFT.balanceOf(escrowAgent.address, physicalTokenId);
                        expect(escrowAgentBalance.eq(1));

                        // Get next consignment
                        let nextConsignmentBeforeEscrowAgentAttempt = await marketController.getNextConsignment();

                        await seenHausNFT.connect(escrowAgent).setApprovalForAll(auctionHandler.address, true);

                        let latestTime = await time.latest();

                        start = ethers.BigNumber.from(latestTime.toString()).add('900').toString(); // 15 minutes from latest block

                        await auctionHandler.connect(escrowAgent).createSecondaryAuction(
                            escrowAgent.address,
                            seenHausNFT.address,
                            physicalTokenId,
                            start,
                            duration,
                            reserve,
                            audience,
                            clock
                        )

                        let nextConsignmentAfterEscrowAgentAttempt = await marketController.getNextConsignment();

                        // Test
                        expect(
                            nextConsignmentAfterEscrowAgentAttempt.gt(nextConsignmentBeforeEscrowAgentAttempt),
                            "ESCROW_AGENT can't create an auction"
                        ).is.true;
                        
                    });

                });

            });

            context("Existing Auctions", async function () {

                beforeEach(async function() {

                    // SELLER creates auction
                    await auctionHandler.connect(seller).createPrimaryAuction(
                        consignmentId,
                        start,
                        duration,
                        reserve,
                        audience,
                        clock
                    );

                });

                it("changeAudience() should require caller has ADMIN role", async function () {

                    // non-ADMIN attempt
                    await expect(
                        auctionHandler.connect(associate).changeAuctionAudience(
                            consignmentId,
                            Audience.VIP_STAKER
                        )
                    ).to.be.revertedWith("Access denied, caller doesn't have role");

                    // ADMIN attempt
                    await expect (
                        auctionHandler.connect(admin).changeAuctionAudience(
                            consignmentId,
                            Audience.VIP_STAKER
                        )
                    ).to.emit(auctionHandler,"AudienceChanged");

                });

                it("cancelAuction() should require caller has ADMIN role or is Consignor - Testing ADMIN", async function () {

                    // Wait until auction starts and bid
                    await time.increaseTo(start);
                    await auctionHandler.connect(bidder).bid(consignmentId, {value: reserve});

                    // Fast-forward to half way through auction...
                    await time.increaseTo(
                        ethers.BigNumber
                            .from(start)
                            .add(
                                ethers.BigNumber.from(duration).div("2")
                            )
                            .toString()
                    );

                    // non-ADMIN attempt
                    await expect(
                        auctionHandler.connect(associate).cancelAuction(consignmentId)
                    ).to.be.revertedWith("Access denied, caller doesn't have role or is not consignor");

                    // ADMIN attempt
                    await expect (
                        auctionHandler.connect(admin).cancelAuction(consignmentId)
                    ).to.emit(auctionHandler,"AuctionEnded");

                });

                it("cancelAuction() should require caller has ADMIN role or is Consignor - Testing Consignor", async function () {

                    // Wait until auction starts and bid
                    await time.increaseTo(start);
                    await auctionHandler.connect(bidder).bid(consignmentId, {value: reserve});

                    // Fast-forward to half way through auction...
                    await time.increaseTo(
                        ethers.BigNumber
                            .from(start)
                            .add(
                                ethers.BigNumber.from(duration).div("2")
                            )
                            .toString()
                    );

                    // non-ADMIN attempt
                    await expect(
                        auctionHandler.connect(associate).cancelAuction(consignmentId)
                    ).to.be.revertedWith("Access denied, caller doesn't have role or is not consignor");

                    // ADMIN attempt
                    await expect (
                        auctionHandler.connect(seller).cancelAuction(consignmentId)
                    ).to.emit(auctionHandler,"AuctionEnded");

                });

            });

        });

        context("Change Events", async function () {

            context("New Auctions", async function () {

                context("createPrimaryAuction()", async function () {

                    it("should emit an AuctionPending event", async function () {

                        // Make change, test event
                        await expect(
                            auctionHandler.connect(seller).createPrimaryAuction(
                                consignmentId,
                                start,
                                duration,
                                reserve,
                                audience,
                                clock
                            )
                        ).to.emit(auctionHandler, 'AuctionPending')
                            .withArgs(
                                seller.address,  // consignor
                                seller.address,  // seller (same in this case)
                                [ // Auction
                                    ethers.constants.AddressZero,
                                    consignmentId,
                                    start,
                                    duration,
                                    reserve,
                                    ethers.BigNumber.from("0"),
                                    ethers.BigNumber.from(clock),
                                    ethers.BigNumber.from(State.PENDING),
                                    ethers.BigNumber.from(Outcome.PENDING)
                                ]
                            );
                    });

                });

                context("createSecondaryAuction()", async function () {

                    context("Foreign ERC-721", async function () {

                        beforeEach( async function () {

                            // Creator transfers all their tokens to seller
                            await foreign721.connect(creator).transferFrom(creator.address, seller.address, tokenId);

                            // Get the next consignment id
                            consignmentId = await marketController.getNextConsignment();

                            // Token is on a foreign contract
                            tokenAddress = foreign721.address;

                            // Give associate SELLER role
                            await accessController.connect(admin).grantRole(Role.SELLER, associate.address);

                        });

                        it("should emit an AuctionPending event", async function () {

                            // Seller sends tokens to associate address
                            await foreign721.connect(seller).transferFrom(seller.address, associate.address, tokenId);

                            // Make change, test event
                            await expect(
                                auctionHandler.connect(associate).createSecondaryAuction(
                                    seller.address,
                                    tokenAddress,
                                    tokenId,
                                    start,
                                    duration,
                                    reserve,
                                    audience,
                                    clock
                                )
                            ).to.emit(auctionHandler, 'AuctionPending')
                                .withArgs(
                                    associate.address,
                                    seller.address,
                                    [ // Auction
                                        ethers.constants.AddressZero,
                                        consignmentId,
                                        start,
                                        duration,
                                        reserve,
                                        ethers.BigNumber.from("0"),
                                        ethers.BigNumber.from(clock),
                                        ethers.BigNumber.from(State.PENDING),
                                        ethers.BigNumber.from(Outcome.PENDING)
                                    ]
                                );
                        });

                        it("should trigger a ConsignmentRegistered event on MarketController", async function () {

                            // Seller sends tokens to associate address
                            await foreign721.connect(seller).transferFrom(seller.address, associate.address, tokenId);

                            // Create auction, test event
                            await expect(
                                auctionHandler.connect(associate).createSecondaryAuction(
                                    seller.address,
                                    tokenAddress,
                                    tokenId,
                                    start,
                                    duration,
                                    reserve,
                                    audience,
                                    clock
                                )
                            ).emit(marketController, 'ConsignmentRegistered')
                                .withArgs(
                                    associate.address, // consignor
                                    seller.address,    // seller
                                    [ // Consignment
                                        Market.SECONDARY,
                                        MarketHandler.UNHANDLED,
                                        seller.address,
                                        tokenAddress,
                                        tokenId,
                                        supply,
                                        consignmentId,
                                        false,
                                        false,
                                        0,
                                        0,
                                        0
                                    ]
                                )
                        });

                        it("should trigger an ConsignmentMarketed event on MarketController", async function () {

                            // Seller sends tokens to associate address
                            await foreign721.connect(seller).transferFrom(seller.address, associate.address, tokenId);

                            // Make change, test event
                            await expect(
                                auctionHandler.connect(associate).createSecondaryAuction(
                                    seller.address,
                                    tokenAddress,
                                    tokenId,
                                    start,
                                    duration,
                                    reserve,
                                    audience,
                                    clock
                                )
                            ).to.emit(marketController, 'ConsignmentMarketed')
                                .withArgs(
                                    associate.address,
                                    seller.address,
                                    consignmentId
                                );
                        });

                    });

                    context("Foreign ERC-1155", async function () {

                        beforeEach( async function () {

                            // Creator transfers all their tokens to seller
                            await foreign1155.connect(creator).safeTransferFrom(creator.address, seller.address, tokenId, supply, []);

                            // Get the next consignment id
                            consignmentId = await marketController.getNextConsignment();

                            // Token is on a foreign contract
                            tokenAddress = foreign1155.address;

                            // Give associate SELLER role
                            await accessController.connect(admin).grantRole(Role.SELLER, associate.address);

                        });

                        it("should emit an AuctionPending event", async function () {

                            // Seller sends tokens to associate address
                            await foreign1155.connect(seller).safeTransferFrom(seller.address, associate.address, tokenId, supply, []);

                            // Give associate SELLER role
                            await accessController.connect(admin).grantRole(Role.SELLER, associate.address);

                            // Make change, test event
                            await expect(
                                auctionHandler.connect(associate).createSecondaryAuction(
                                    seller.address,
                                    tokenAddress,
                                    tokenId,
                                    start,
                                    duration,
                                    reserve,
                                    audience,
                                    clock
                                )
                            ).to.emit(auctionHandler, 'AuctionPending')
                                .withArgs(
                                    associate.address,
                                    seller.address,
                                    [ // Auction
                                        ethers.constants.AddressZero,
                                        consignmentId,
                                        start,
                                        duration,
                                        reserve,
                                        ethers.BigNumber.from("0"),
                                        ethers.BigNumber.from(clock),
                                        ethers.BigNumber.from(State.PENDING),
                                        ethers.BigNumber.from(Outcome.PENDING)
                                    ]
                                );
                        });

                        it("should trigger a ConsignmentRegistered event on MarketController", async function () {

                            // Seller sends tokens to associate address
                            await foreign1155.connect(seller).safeTransferFrom(seller.address, associate.address, tokenId, supply, []);

                            // Create auction, test event
                            await expect(
                                auctionHandler.connect(associate).createSecondaryAuction(
                                    seller.address,
                                    tokenAddress,
                                    tokenId,
                                    start,
                                    duration,
                                    reserve,
                                    audience,
                                    clock
                                )
                            ).emit(marketController, 'ConsignmentRegistered')
                                .withArgs(
                                    associate.address, // consignor
                                    seller.address,    // seller
                                    [ // Consignment
                                        Market.SECONDARY,
                                        MarketHandler.UNHANDLED,
                                        seller.address,
                                        tokenAddress,
                                        tokenId,
                                        supply,
                                        consignmentId,
                                        true,
                                        false,
                                        0,
                                        0,
                                        0
                                    ]
                                )
                        });

                        it("should trigger an ConsignmentMarketed event on MarketController", async function () {

                            // Seller sends tokens to associate address
                            await foreign1155.connect(seller).safeTransferFrom(seller.address, associate.address, tokenId, supply, []);

                            // Make change, test event
                            await expect(
                                auctionHandler.connect(associate).createSecondaryAuction(
                                    seller.address,
                                    tokenAddress,
                                    tokenId,
                                    start,
                                    duration,
                                    reserve,
                                    audience,
                                    clock
                                )
                            ).to.emit(marketController, 'ConsignmentMarketed')
                                .withArgs(
                                    associate.address,
                                    seller.address,
                                    consignmentId
                                );
                        });

                    });

                });

            });

            context("Existing Auctions", async function () {

                beforeEach(async function() {

                    // Creator transfers all their tokens to seller
                    await foreign1155.connect(creator).safeTransferFrom(creator.address, seller.address, tokenId, supply, []);

                    // Get the next consignment id
                    consignmentId = await marketController.getNextConsignment();

                    // Token is on a foreign contract
                    tokenAddress = foreign1155.address;

                    // Use triggered clock (i.e. reserve price auction)
                    clock = Clock.TRIGGERED;

                    // SELLER creates secondary market auction
                    await auctionHandler.connect(seller).createSecondaryAuction(
                        seller.address,
                        tokenAddress,
                        tokenId,
                        start,
                        duration,
                        reserve,
                        audience,
                        clock
                    );

                });

                context("changeAudience()", async function () {

                    it("should emit an AudienceChanged event", async function () {

                        // ADMIN attempt
                        await expect(
                            auctionHandler.connect(admin).changeAuctionAudience(
                                consignmentId,
                                Audience.OPEN
                            )
                        ).to.emit(auctionHandler, "AudienceChanged")
                            .withArgs(consignmentId, Audience.OPEN);

                    });

                });

                context("bid()", async function () {

                    beforeEach(async function () {

                        // Wait until auction starts and bid
                        await time.increaseTo(start);

                    });

                    it("should emit a BidAccepted event when bidding shortly after (minimum) start time of auction", async function () {

                        // First bidder meets reserve
                        await expect(
                            auctionHandler.connect(bidder).bid(consignmentId, {value: reserve})
                        ).to.emit(auctionHandler, "BidAccepted")
                            .withArgs(
                                consignmentId,
                                bidder.address,
                                reserve
                            );

                    });

                    it("should emit a BidAccepted event when bidding at a time beyond (start time + duration) of a TRIGGERED auction", async function () {

                        let startTimeBeyondDuration = ethers.BigNumber
                            .from(start)
                            .add(duration)
                            .add(fifteenMinutes) // Add some extra time just to make sure it is beyond start time + duration
                            .toString();

                        await time.increaseTo(startTimeBeyondDuration);

                        // First bidder meets reserve
                        await expect(
                            auctionHandler.connect(bidder).bid(consignmentId, {value: reserve})
                        ).to.emit(auctionHandler, "BidAccepted")
                            .withArgs(
                                consignmentId,
                                bidder.address,
                                reserve
                            );

                    });

                    it("should emit a BidReturned event when previous bidder is outbid", async function () {

                        // First bidder meets reserve
                        await auctionHandler.connect(bidder).bid(consignmentId, {value: reserve})

                        // Double previous bid
                        outbid = ethers.BigNumber.from(reserve).mul("2");

                        // First bidder meets reserve
                        await expect(
                            auctionHandler.connect(rival).bid(consignmentId, {value: outbid})
                        ).to.emit(auctionHandler, "BidReturned")
                            .withArgs(
                                consignmentId,
                                bidder.address,
                                reserve
                            );

                    });

                    it("should emit a AuctionStarted event on first bid", async function () {

                        // First bidder meets reserve
                        await expect(
                            auctionHandler.connect(bidder).bid(consignmentId, {value: reserve})
                        ).to.emit(auctionHandler, "AuctionStarted")
                            .withArgs(consignmentId);

                    });

                    it("should emit an AuctionExtended event when bid is placed in last 15 minutes", async function () {

                        // Initial bid meets reserve
                        await auctionHandler.connect(bidder).bid(consignmentId, {value: reserve})

                        let extendTime = ethers.BigNumber
                            .from(start)
                            .add(duration)          // end of auction
                            .sub(fourteenMinutes)    // back up 14 minutes
                            .toString();

                        // Now fast-forward to 15 minutes before end of auction
                        await time.increaseTo(extendTime);

                        // Double previous bid
                        outbid = ethers.BigNumber.from(reserve).mul("2");

                        // Bid placed 15 minutes before end of auction
                        await expect(
                            auctionHandler.connect(rival).bid(consignmentId, {value: outbid})
                        ).to.emit(auctionHandler, "AuctionExtended")
                            .withArgs(consignmentId);

                        // Check that the duration of the auction was actually extended
                        let auction = await auctionHandler.getAuction(consignmentId);
                        console.log({"auction['duration']": auction['duration'], 'ethers.BigNumber.from(duration).add(oneMinute)': ethers.BigNumber.from(duration).add(oneMinute)})
                        expect(
                            // Bids within last 15 minutes should set the countdown to 15 minutes
                            // Therefore, should add one minute to duration, since bid was placed with 14 minutes remaining
                            auction['duration'].eq(ethers.BigNumber.from(duration).add(oneMinute)),
                            "Incorrect duration"
                        ).is.true;


                    });

                });

                context("closeAuction()", async function () {

                    beforeEach(async function () {

                        // Wait until auction starts and bid
                        await time.increaseTo(start);
                        await auctionHandler.connect(bidder).bid(consignmentId, {value: reserve});

                        // Now fast-forward to end of auction...
                        await time.increaseTo(
                            ethers.BigNumber
                                .from(start)
                                .add(duration)
                                .add(
                                    "15" // 15s after end of auction
                                )
                                .toString()
                        );

                    });

                    it("should emit an AuctionEnded event", async function () {

                        // Bidder closes auction
                        await expect(
                            auctionHandler.connect(bidder).closeAuction(consignmentId)
                        ).to.emit(auctionHandler, "AuctionEnded")
                            .withArgs(
                                consignmentId,
                                Outcome.CLOSED
                            );

                    });

                    it("should emit a TokenHistoryTracker event", async function () {

                        // Bidder closes auction
                        await expect(
                            auctionHandler.connect(bidder).closeAuction(consignmentId)
                        ).to.emit(auctionHandler, "TokenHistoryTracker")
                            .withArgs(
                                tokenAddress,
                                tokenId,
                                bidder.address,
                                reserve,
                                supply,
                                consignmentId
                            );

                    });

                    it("should trigger an PayoutDisbursed event", async function () {

                        // Bidder closes auction
                        await expect(
                            auctionHandler.connect(bidder).closeAuction(consignmentId)
                        ).to.emit(auctionHandler, "PayoutDisbursed");

                    });

                    it("should trigger an FeeDisbursed event", async function () {

                        // Bidder closes auction
                        await expect(
                            auctionHandler.connect(bidder).closeAuction(consignmentId)
                        ).to.emit(auctionHandler, "FeeDisbursed");

                    });

                    it("should trigger an RoyaltyDisbursed event for secondary market auctions", async function () {

                        // Bidder closes auction
                        await expect(
                            auctionHandler.connect(bidder).closeAuction(consignmentId)
                        ).to.emit(auctionHandler, "RoyaltyDisbursed");

                    });

                });

                context("cancelAuction()", async function () {

                    beforeEach(async function () {

                        // Wait until auction starts and bid
                        await time.increaseTo(start);
                        await auctionHandler.connect(bidder).bid(consignmentId, {value: reserve});

                        // Fast-forward to half way through auction...
                        await time.increaseTo(
                            ethers.BigNumber
                                .from(start)
                                .add(
                                    ethers.BigNumber.from(duration).div("2")
                                )
                                .toString()
                        );

                    });

                    it("should emit an AuctionEnded event", async function () {

                        // Admin cancels auction
                        await expect(
                            auctionHandler.connect(admin).cancelAuction(consignmentId)
                        ).to.emit(auctionHandler, "AuctionEnded")
                            .withArgs(
                                consignmentId,
                                Outcome.CANCELED
                            );

                    });

                    it("should trigger a CanceledAuctionBidReturned event if a bid existed", async function () {

                        // Admin cancels auction
                        await expect(
                            auctionHandler.connect(admin).cancelAuction(consignmentId)
                        ).to.emit(auctionHandler, "CanceledAuctionBidReturned")
                            .withArgs(consignmentId, bidder.address, reserve);

                    });

                });

            });

        });

        context("Auction function consignment modifications", async function () {

            beforeEach(async function() {

                // Creator transfers all their tokens to seller
                await foreign1155.connect(creator).safeTransferFrom(creator.address, seller.address, tokenId, supply, []);

                // Get the next consignment id
                consignmentId = await marketController.getNextConsignment();

                // Token is on a foreign contract
                tokenAddress = foreign1155.address;

                // SELLER creates secondary market auction
                await auctionHandler.connect(seller).createSecondaryAuction(
                    seller.address,
                    tokenAddress,
                    tokenId,
                    start,
                    duration,
                    reserve,
                    audience,
                    clock
                );

            });

            context("bid()", async function () {

                beforeEach(async function () {

                    // Wait until auction starts and bid
                    await time.increaseTo(start);

                });

                it("should change consignment's pendingPayout from 0 to reserve value", async function () {

                    // Get the consignment before auction close
                    const responseBeforeBid = await marketController.getConsignment(consignmentId);

                    // Convert to entity
                    let consignmentBeforeBid = new Consignment(
                        responseBeforeBid.market,
                        responseBeforeBid.marketHandler,
                        responseBeforeBid.seller,
                        responseBeforeBid.tokenAddress,
                        responseBeforeBid.tokenId.toString(),
                        responseBeforeBid.supply.toString(),
                        responseBeforeBid.id.toString(),
                        responseBeforeBid.multiToken,
                        responseBeforeBid.released,
                        responseBeforeBid.releasedSupply.toString(),
                        responseBeforeBid.customFeePercentageBasisPoints.toString(),
                        responseBeforeBid.pendingPayout.toString()
                    );

                    await expect(consignmentBeforeBid.pendingPayout).to.equal("0")

                    // Wait until auction starts and bid
                    let latest = await time.latest();
                    console.log({'time.latest': latest.toString()})
                    await time.increaseTo(start);
                    await auctionHandler.connect(bidder).bid(consignmentId, {value: reserve});

                    // Get the consignment after bid
                    const responseAfterBid = await marketController.getConsignment(consignmentId);

                    // Convert to entity
                    let consignmentAfterBid = new Consignment(
                        responseAfterBid.market,
                        responseAfterBid.marketHandler,
                        responseAfterBid.seller,
                        responseAfterBid.tokenAddress,
                        responseAfterBid.tokenId.toString(),
                        responseAfterBid.supply.toString(),
                        responseAfterBid.id.toString(),
                        responseAfterBid.multiToken,
                        responseAfterBid.released,
                        responseAfterBid.releasedSupply.toString(),
                        responseAfterBid.customFeePercentageBasisPoints.toString(),
                        responseAfterBid.pendingPayout.toString()
                    );

                    await expect(consignmentAfterBid.pendingPayout).to.equal(reserve.toString());

                });
            });

            it("should change consignment's pendingPayout from reserve value to outbid value", async function () {

                // Wait until auction starts and bid
                await time.increaseTo(start);
                await auctionHandler.connect(bidder).bid(consignmentId, {value: reserve});

                // Get the consignment before auction close
                const responseBeforeOutbid = await marketController.getConsignment(consignmentId);

                // Convert to entity
                let consignmentBeforeOutbid = new Consignment(
                    responseBeforeOutbid.market,
                    responseBeforeOutbid.marketHandler,
                    responseBeforeOutbid.seller,
                    responseBeforeOutbid.tokenAddress,
                    responseBeforeOutbid.tokenId.toString(),
                    responseBeforeOutbid.supply.toString(),
                    responseBeforeOutbid.id.toString(),
                    responseBeforeOutbid.multiToken,
                    responseBeforeOutbid.released,
                    responseBeforeOutbid.releasedSupply.toString(),
                    responseBeforeOutbid.customFeePercentageBasisPoints.toString(),
                    responseBeforeOutbid.pendingPayout.toString()
                );

                await expect(consignmentBeforeOutbid.pendingPayout).to.equal(reserve.toString())

                // Double previous bid
                outbid = ethers.BigNumber.from(reserve).mul("2");
                await auctionHandler.connect(rival).bid(consignmentId, {value: outbid});

                // Get the consignment after auction close
                const responseAfterOutbid = await marketController.getConsignment(consignmentId);

                // Convert to entity
                let consignmentAfterClose = new Consignment(
                    responseAfterOutbid.market,
                    responseAfterOutbid.marketHandler,
                    responseAfterOutbid.seller,
                    responseAfterOutbid.tokenAddress,
                    responseAfterOutbid.tokenId.toString(),
                    responseAfterOutbid.supply.toString(),
                    responseAfterOutbid.id.toString(),
                    responseAfterOutbid.multiToken,
                    responseAfterOutbid.released,
                    responseAfterOutbid.releasedSupply.toString(),
                    responseAfterOutbid.customFeePercentageBasisPoints.toString(),
                    responseAfterOutbid.pendingPayout.toString()
                );

                await expect(consignmentAfterClose.pendingPayout).to.equal(outbid.toString());

            });

            context("closeAuction()", async function () {

                beforeEach(async function () {

                    // Wait until auction starts and bid
                    await time.increaseTo(start);
                    await auctionHandler.connect(bidder).bid(consignmentId, {value: reserve});

                    // Double previous bid
                    outbid = ethers.BigNumber.from(reserve).mul("2");
                    await auctionHandler.connect(rival).bid(consignmentId, {value: outbid});

                    // Now fast-forward to end of auction...
                    await time.increaseTo(
                        ethers.BigNumber
                            .from(start)
                            .add(duration)
                            .add(
                                "1" // 1s after end of auction
                            )
                            .toString()
                    );

                });

                it("should change consignment's releasedSupply from 0 to 1", async function () {

                    // Get the consignment before auction close
                    const responseBeforeClose = await marketController.getConsignment(consignmentId);

                    // Convert to entity
                    let consignmentBeforeClose = new Consignment(
                        responseBeforeClose.market,
                        responseBeforeClose.marketHandler,
                        responseBeforeClose.seller,
                        responseBeforeClose.tokenAddress,
                        responseBeforeClose.tokenId.toString(),
                        responseBeforeClose.supply.toString(),
                        responseBeforeClose.id.toString(),
                        responseBeforeClose.multiToken,
                        responseBeforeClose.released,
                        responseBeforeClose.releasedSupply.toString(),
                        responseBeforeClose.customFeePercentageBasisPoints.toString(),
                        responseBeforeClose.pendingPayout.toString()
                    );

                    await expect(
                        consignmentBeforeClose.releasedSupply === "0",
                        "consignmentBeforeClose releasedSupply is not valid"
                    ).is.true;

                    // Bidder closes auction
                    await expect(
                        auctionHandler.connect(bidder).closeAuction(consignmentId)
                    ).to.emit(auctionHandler, "AuctionEnded")
                        .withArgs(
                            consignmentId,
                            Outcome.CLOSED
                        );

                    // Get the consignment after auction close
                    const responseAfterClose = await marketController.getConsignment(consignmentId);

                    // Convert to entity
                    let consignmentAfterOutbid = new Consignment(
                        responseAfterClose.market,
                        responseAfterClose.marketHandler,
                        responseAfterClose.seller,
                        responseAfterClose.tokenAddress,
                        responseAfterClose.tokenId.toString(),
                        responseAfterClose.supply.toString(),
                        responseAfterClose.id.toString(),
                        responseAfterClose.multiToken,
                        responseAfterClose.released,
                        responseAfterClose.releasedSupply.toString(),
                        responseAfterClose.customFeePercentageBasisPoints.toString(),
                        responseAfterClose.pendingPayout.toString()
                    );

                    await expect(
                        consignmentAfterOutbid.releasedSupply === "1",
                        "consignmentAfterOutbid releasedSupply is not valid"
                    ).is.true;

                });

                it("should change consignment's pendingPayout from latest bid (3) to 0", async function () {

                    // Get the consignment before auction close
                    const responseBeforeClose = await marketController.getConsignment(consignmentId);

                    // Convert to entity
                    let consignmentBeforeClose = new Consignment(
                        responseBeforeClose.market,
                        responseBeforeClose.marketHandler,
                        responseBeforeClose.seller,
                        responseBeforeClose.tokenAddress,
                        responseBeforeClose.tokenId.toString(),
                        responseBeforeClose.supply.toString(),
                        responseBeforeClose.id.toString(),
                        responseBeforeClose.multiToken,
                        responseBeforeClose.released,
                        responseBeforeClose.releasedSupply.toString(),
                        responseBeforeClose.customFeePercentageBasisPoints.toString(),
                        responseBeforeClose.pendingPayout.toString()
                    );

                    await expect(consignmentBeforeClose.pendingPayout).to.equal(outbid.toString())

                    // Bidder closes auction
                    await expect(
                        auctionHandler.connect(bidder).closeAuction(consignmentId)
                    ).to.emit(auctionHandler, "AuctionEnded")
                        .withArgs(
                            consignmentId,
                            Outcome.CLOSED
                        );

                    // Get the consignment after auction close
                    const responseAfterClose = await marketController.getConsignment(consignmentId);

                    // Convert to entity
                    let consignmentAfterClose = new Consignment(
                        responseAfterClose.market,
                        responseAfterClose.marketHandler,
                        responseAfterClose.seller,
                        responseAfterClose.tokenAddress,
                        responseAfterClose.tokenId.toString(),
                        responseAfterClose.supply.toString(),
                        responseAfterClose.id.toString(),
                        responseAfterClose.multiToken,
                        responseAfterClose.released,
                        responseAfterClose.releasedSupply.toString(),
                        responseAfterClose.customFeePercentageBasisPoints.toString(),
                        responseAfterClose.pendingPayout.toString()
                    );

                    await expect(consignmentAfterClose.pendingPayout).to.equal("0");

                });

            });

        });

        context("Market Handler Assignment", async function () {

            context("Primary Market Auction", async function () {
                
                it("Assigns a marketHandler of Auction to a consignment immediately after createPrimaryAuction", async function () {
                    // Get the consignment id
                    consignmentId = await marketController.getNextConsignment();

                    // Mint new token on seenHausNFT contract
                    tokenId = await seenHausNFT.getNextToken();
                    await seenHausNFT.connect(seller).mintDigital(supply, seller.address, tokenURI, royaltyPercentage);

                    // Let's use the triggered clock this time
                    clock = Clock.TRIGGERED;

                    // Seller creates auction
                    await auctionHandler.connect(seller).createPrimaryAuction(
                        consignmentId,
                        start,
                        duration,
                        reserve,
                        audience,
                        clock
                    );
                    
                    // Get the consignment
                    const response = await marketController.getConsignment(consignmentId);

                    // Convert to entity
                    let consignment = new Consignment(
                        response.market,
                        response.marketHandler,
                        response.seller,
                        response.tokenAddress,
                        response.tokenId.toString(),
                        response.supply.toString(),
                        response.id.toString(),
                        response.multiToken,
                        response.released,
                        response.releasedSupply.toString(),
                        response.customFeePercentageBasisPoints.toString(),
                        response.pendingPayout.toString(),
                    );

                    // Consignment should have a market handler of MarketHandler.Auction
                    expect(consignment.marketHandler === MarketHandler.AUCTION).is.true;
                })

            })

            context("Secondary Market Auction", async function () {
                it("Assigns a marketHandler of Auction to a consignment immediately after createSecondaryAuction", async function () {
                    // Token is on a foreign contract
                    tokenAddress = foreign1155.address;

                    // Creator transfers all their tokens to seller
                    await foreign1155.connect(creator).safeTransferFrom(creator.address, seller.address, tokenId, supply, []);

                    // Get the consignment id
                    consignmentId = await marketController.getNextConsignment();

                    // Let's use the triggered clock this time
                    clock = Clock.TRIGGERED;

                    // Seller creates auction
                    await auctionHandler.connect(seller).createSecondaryAuction(
                        seller.address,
                        tokenAddress,
                        tokenId,
                        start,
                        duration,
                        reserve,
                        audience,
                        clock
                    );

                    // Get the consignment
                    const response = await marketController.getConsignment(consignmentId);

                    // Convert to entity
                    let consignment = new Consignment(
                        response.market,
                        response.marketHandler,
                        response.seller,
                        response.tokenAddress,
                        response.tokenId.toString(),
                        response.supply.toString(),
                        response.id.toString(),
                        response.multiToken,
                        response.released,
                        response.releasedSupply.toString(),
                        response.customFeePercentageBasisPoints.toString(),
                        response.pendingPayout.toString(),
                    );

                    // Consignment should have a market handler of MarketHandler.Auction
                    expect(consignment.marketHandler === MarketHandler.AUCTION).is.true;
                });
            })

        })

        context("Auction Behavior", async function () {

            beforeEach(async function () {

                // Token is on a foreign contract
                tokenAddress = foreign1155.address;

                // Creator transfers all their tokens to seller
                await foreign1155.connect(creator).safeTransferFrom(creator.address, seller.address, tokenId, supply, []);

                // Get the consignment id
                consignmentId = await marketController.getNextConsignment();

                // Let's use the triggered clock this time
                clock = Clock.TRIGGERED;

                // Seller creates auction
                await auctionHandler.connect(seller).createSecondaryAuction(
                    seller.address,
                    tokenAddress,
                    tokenId,
                    start,
                    duration,
                    reserve,
                    audience,
                    clock
                );

            })

            context("Existing Auctions", async function () {

                it("first bid should update the auction start time on Clock.TRIGGERED auctions", async function () {

                        // Fast-forward to half way through auction...
                        const newStart = ethers.BigNumber
                            .from(start)
                            .add(
                                ethers.BigNumber.from(duration).div("2")
                            )
                            .toString();
                        await time.increaseTo(newStart);

                        // Bid
                        await auctionHandler.connect(bidder).bid(consignmentId, {value: reserve});

                        // Get next consignment
                        const response = await auctionHandler.getAuction(consignmentId);

                        // Convert to entity
                        auction = new Auction(
                            response.buyer,
                            response.consignmentId.toString(),
                            response.start.toString(),
                            response.duration.toString(),
                            response.reserve.toString(),
                            response.bid.toString(),
                            response.clock,
                            response.state,
                            response.outcome
                        );

                        // Test validity
                        expect(
                            auction.isValid(),
                            "Auction not valid"
                        ).is.true;

                        expect(
                            auction.start === newStart,
                            "Auction start time not updated"
                        )

                    });

                it("should allow bid if audience is STAKER and bidder is a staker", async function () {

                    // Fast forward to auction start time
                    await time.increaseTo(start);

                    // Set the audience to STAKER
                    auctionHandler.connect(admin).changeAuctionAudience(
                        consignmentId,
                        Audience.STAKER
                    );

                    // Set non-zero staking amount for bidder
                    await seenStaking.setStakerBalance(bidder.address, "1");

                    // First bidder meets reserve
                    await expect(
                        auctionHandler.connect(bidder).bid(consignmentId, {value: reserve})
                    ).to.emit(auctionHandler, "BidAccepted");

                });

                it("should allow bid if audience is VIP_STAKER and bidder is not a VIP staker", async function () {

                    // Fast forward to auction start time
                    await time.increaseTo(start);

                    // Set the audience to VIP_STAKER
                    auctionHandler.connect(admin).changeAuctionAudience(
                        consignmentId,
                        Audience.VIP_STAKER
                    );

                    // Set VIP staking amount for bidder
                    await seenStaking.setStakerBalance(bidder.address, vipStakerAmount);

                    // First bidder meets reserve
                    await expect(
                        auctionHandler.connect(bidder).bid(consignmentId, {value: reserve})
                    ).to.emit(auctionHandler, "BidAccepted");

                });

            });

        });

        context("Revert Reasons", async function () {

            context("New Auctions", async function () {

                context("createPrimaryAuction()", async function () {

                    it("should revert if caller isn't the asset consignor", async function () {

                        // Grant SELLER role to associate, who did not mint the original token
                        await accessController.connect(admin).grantRole(Role.SELLER, associate.address);

                        // Associate attempts to create primary auction, expect revert
                        await expect(
                            auctionHandler.connect(associate).createPrimaryAuction(
                                consignmentId,
                                start,
                                duration,
                                reserve,
                                audience,
                                clock
                            )
                        ).to.be.revertedWith("Caller is not consignor");

                    });

                    it("should revert if consignment does not exist", async function () {

                        // A non-existent consignment
                        consignmentId = marketController.getNextConsignment();

                        // Create auction, expect revert
                        await expect(
                            auctionHandler.connect(seller).createPrimaryAuction(
                                consignmentId,
                                start,
                                duration,
                                reserve,
                                audience,
                                clock
                            )
                        ).to.be.revertedWith("Consignment does not exist");

                    });

                    it("should revert if start time is in the past", async function () {

                        // 15 minutes before latest block
                        badStartTime = ethers.BigNumber.from(block.timestamp).sub('900').toString();

                        // Create auction, expect revert
                        await expect(
                            auctionHandler.connect(seller).createPrimaryAuction(
                                consignmentId,
                                badStartTime,
                                duration,
                                reserve,
                                audience,
                                clock
                            )
                        ).to.be.revertedWith('Non-trigger clock type requires start time in future');

                    });

                });

                context("createSecondaryAuction()", async function () {

                    beforeEach(async function () {

                        // Creator transfers all their tokens to seller
                        await foreign1155.connect(creator).safeTransferFrom(creator.address, seller.address, tokenId, supply, []);

                        // Token is on a foreign contract
                        tokenAddress = foreign1155.address;

                    });

                    it("should revert if contract doesn't have approval to transfer seller's tokens", async function () {

                        // Revoke approval
                        await foreign1155.connect(seller).setApprovalForAll(auctionHandler.address, false);

                        // Create auction, expect revert
                        await expect(
                            auctionHandler.connect(seller).createSecondaryAuction(
                                seller.address,
                                tokenAddress,
                                tokenId,
                                start,
                                duration,
                                reserve,
                                audience,
                                clock
                            )
                        ).to.be.revertedWith("Not approved to transfer seller's tokens");

                    });

                    it("should revert if seller has no balance of given token", async function () {

                        // Seller transfers all their tokens to associate
                        await foreign1155.connect(seller).safeTransferFrom(seller.address, associate.address, tokenId, supply, []);

                        // Create auction, expect revert
                        await expect(
                            auctionHandler.connect(seller).createSecondaryAuction(
                                seller.address,
                                tokenAddress,
                                tokenId,
                                start,
                                duration,
                                reserve,
                                audience,
                                clock
                            )
                        ).to.be.revertedWith("Seller has zero balance of consigned token");

                    });

                    it("should revert if start time is in the past", async function () {

                        // 15 minutes before latest block
                        badStartTime = ethers.BigNumber.from(block.timestamp).sub('900').toString();

                        // Create sale, expect revert
                        await expect(
                            auctionHandler.connect(seller).createSecondaryAuction(
                                seller.address,
                                tokenAddress,
                                tokenId,
                                badStartTime,
                                duration,
                                reserve,
                                audience,
                                clock
                            )
                        ).to.be.revertedWith('Non-trigger clock type requires start time in future');

                    });

                });

            });

            context("Existing Auctions", async function () {

                beforeEach(async function() {

                    // Lets use secondary market to trigger royalties
                    market = Market.SECONDARY;

                    // SELLER creates secondary market auction
                    await auctionHandler.connect(seller).createPrimaryAuction(
                        consignmentId,
                        start,
                        duration,
                        reserve,
                        audience,
                        clock
                    );

                    // Lowball bid
                    belowReserve = reserve.div("2");

                });

                context("changeAudience()", async function () {

                    it("should revert if consignment doesn't exist", async function () {

                        // get next consignment id
                        consignmentId = await marketController.getNextConsignment();

                        // ADMIN attempts to set audience for nonexistent consignment
                        await expect(
                            auctionHandler.connect(admin).changeAuctionAudience(
                                consignmentId,
                                Audience.OPEN
                            )
                        ).to.be.revertedWith("Consignment does not exist");

                    });

                    it("should revert if auction doesn't exist", async function () {

                        // Seller creates digital token
                        consignmentId = await marketController.getNextConsignment();
                        tokenId = await seenHausNFT.getNextToken();
                        await seenHausNFT.connect(seller).mintDigital(supply, seller.address, tokenURI, royaltyPercentage);

                        // ADMIN attempts to set audience for nonexistent auction
                        await expect(
                            auctionHandler.connect(admin).changeAuctionAudience(
                                consignmentId,
                                Audience.OPEN
                            )
                        ).to.be.revertedWith("Auction does not exist");

                    });

                    it("should revert if auction already settled", async function () {

                        // Wait until auction starts and bid
                        await time.increaseTo(start);
                        await auctionHandler.connect(bidder).bid(consignmentId, {value: reserve});

                        // Now fast-forward to end of auction...
                        await time.increaseTo(
                            ethers.BigNumber
                                .from(start)
                                .add(duration)
                                .add(
                                    "1" // 1s after end of auction
                                )
                                .toString()
                        );

                        // Close the auction
                        auctionHandler.connect(bidder).closeAuction(consignmentId);

                        // ADMIN attempts to set audience for closed auction
                        await expect(
                            auctionHandler.connect(admin).changeAuctionAudience(
                                consignmentId,
                                Audience.VIP_STAKER
                            )
                        ).to.be.revertedWith("Auction has already been settled");

                    });

                });

                context("bid()", async function () {

                    it("should revert if consignment doesn't exist", async function () {

                        // get next consignment id
                        consignmentId = await marketController.getNextConsignment();

                        // ADMIN attempts to set audience for nonexistent auction
                        await expect(
                            auctionHandler.connect(bidder).bid(consignmentId, {value: reserve})
                        ).to.be.revertedWith("Consignment does not exist");

                    });

                    it("should revert if auction doesn't exist", async function () {

                        // Seller creates digital token
                        consignmentId = await marketController.getNextConsignment();
                        tokenId = await seenHausNFT.getNextToken();
                        await seenHausNFT.connect(seller).mintDigital(supply, seller.address, tokenURI, royaltyPercentage);

                        // ADMIN attempts to set audience for nonexistent auction
                        await expect(
                            auctionHandler.connect(bidder).bid(consignmentId, {value: reserve})
                        ).to.be.revertedWith("Auction does not exist");

                    });

                    it("should revert if bidder is a contract", async function () {

                        // Fast forward to auction start time
                        await time.increaseTo(start);

                        // Try to bid with a contract
                        signer = new ethers.VoidSigner(lotsTicketer.address, ethers.provider)
                        await expect(
                            auctionHandler.connect(signer).callStatic.bid(consignmentId, {value: reserve})
                        ).to.be.revertedWith("Contracts may not bid");

                    });

                    it("should revert if auction start time hasn't arrived", async function () {

                        // Try to bid before auction has started
                        await expect(
                            auctionHandler.connect(bidder).bid(consignmentId, {value: reserve})
                        ).to.be.revertedWith("Auction hasn't started");

                    });

                    it("should revert if bid is below reserve price", async function () {

                        // Fast forward to auction start time
                        await time.increaseTo(start);

                        // Try to bid below reserve
                        await expect(
                            auctionHandler.connect(bidder).bid(consignmentId, {value: belowReserve})
                        ).to.be.revertedWith("Bid below reserve price");

                    });

                    it("should revert if audience is STAKER and bidder is not a staker", async function () {

                        // Fast forward to auction start time
                        await time.increaseTo(start);

                        // Set the audience to STAKER
                        auctionHandler.connect(admin).changeAuctionAudience(
                            consignmentId,
                            Audience.STAKER
                        );

                        // Try to bid when not in audience
                        await expect(
                            auctionHandler.connect(bidder).bid(consignmentId, {value: reserve})
                        ).to.be.revertedWith("Buyer is not a staker");

                    });

                    it("should revert if audience is VIP_STAKER and bidder is not a VIP staker", async function () {

                        // Fast forward to auction start time
                        await time.increaseTo(start);

                        // Set the audience to VIP_STAKER
                        auctionHandler.connect(admin).changeAuctionAudience(
                            consignmentId,
                            Audience.VIP_STAKER
                        );

                        // Try to bid when not in audience
                        await expect(
                            auctionHandler.connect(bidder).bid(consignmentId, {value: reserve})
                        ).to.be.revertedWith("Buyer is not a VIP staker");

                    });

                    it("should revert if bid is below the outbid threshold", async function () {

                        // Fast forward to auction start time
                        await time.increaseTo(start);

                        // Get HALF the outbid percentage
                        percentage = ethers.BigNumber.from(outBidPercentage).div("2");
                        trollBid = reserve.add(reserve.mul(percentage).div(10000));

                        // Bid reserve
                        auctionHandler.connect(bidder).bid(consignmentId, {value: reserve});

                        // Try to troll
                        await expect(
                            auctionHandler.connect(associate).bid(consignmentId, {value: trollBid})
                        ).to.be.revertedWith("Bid too small");

                    });

                });

                context("closeAuction()", async function () {

                    beforeEach(async function () {

                        // Wait until auction starts and bid
                        await time.increaseTo(start);

                    });

                    it("should revert if consignment doesn't exist", async function () {

                        // get next consignment id
                        consignmentId = await marketController.getNextConsignment();

                        // ADMIN attempts to close nonexistent auction
                        await expect(
                            auctionHandler.connect(admin).closeAuction(consignmentId)
                        ).to.be.revertedWith("Consignment does not exist");

                    });

                    it("should revert if auction doesn't exist", async function () {

                        // Seller creates digital token
                        consignmentId = await marketController.getNextConsignment();
                        tokenId = await seenHausNFT.getNextToken();
                        await seenHausNFT.connect(seller).mintDigital(supply, seller.address, tokenURI, royaltyPercentage);

                        // ADMIN attempts close nonexistent auction
                        await expect(
                            auctionHandler.connect(bidder).closeAuction(consignmentId)
                        ).to.be.revertedWith("Auction does not exist");

                    });

                    it("should revert if end time not yet reached", async function () {

                        // ADMIN attempts close auction whose timer has not elapsed
                        await expect(
                            auctionHandler.connect(bidder).closeAuction(consignmentId)
                        ).to.be.revertedWith("Auction end time not yet reached");

                    });

                    it("should revert if end time reached and no bids have been made", async function () {

                        // Now fast-forward to end of auction...
                        await time.increaseTo(
                            ethers.BigNumber
                                .from(start)
                                .add(duration)
                                .add(
                                    "1" // 1s after end of auction
                                )
                                .toString()
                        );

                        // ADMIN attempts close auction whose timer has not elapsed
                        await expect(
                            auctionHandler.connect(bidder).closeAuction(consignmentId)
                        ).to.be.revertedWith("No bids have been placed");

                    });

                });

                context("cancelAuction()", async function () {

                    it("should revert if consignment doesn't exist", async function () {

                        // get next consignment id
                        consignmentId = await marketController.getNextConsignment();

                        // ADMIN attempts to set cancel nonexistent auction
                        await expect(
                            auctionHandler.connect(admin).cancelAuction(consignmentId)
                        ).to.be.revertedWith("Consignment does not exist");

                    });

                    it("should revert if auction doesn't exist", async function () {

                        // Seller creates digital token
                        consignmentId = await marketController.getNextConsignment();
                        tokenId = await seenHausNFT.getNextToken();
                        await seenHausNFT.connect(seller).mintDigital(supply, seller.address, tokenURI, royaltyPercentage);

                        // ADMIN attempts to set cancel nonexistent auction
                        await expect(
                            auctionHandler.connect(admin).cancelAuction(consignmentId)
                        ).to.be.revertedWith("Auction does not exist");

                    });

                    it("should revert if auction has already been settled", async function () {

                        // Fast-forward to half way through auction...
                        await time.increaseTo(
                            ethers.BigNumber
                                .from(start)
                                .add(
                                    ethers.BigNumber.from(duration).div("2")
                                )
                                .toString()
                        );

                        // Cancel the auction
                        auctionHandler.connect(admin).cancelAuction(consignmentId)

                        // ADMIN attempts to cancel auction that has already been settled
                        await expect(
                            auctionHandler.connect(admin).cancelAuction(consignmentId)
                        ).to.be.revertedWith("Auction has already been settled");

                    });

                });

            });

        });

        context("Funds Distribution", async function () {

            context("Primary Market", async function () {

                beforeEach(async function () {

                    // SELLER creates primary market auction
                    await auctionHandler.connect(seller).createPrimaryAuction(
                        consignmentId,
                        start,
                        duration,
                        reserve,
                        audience,
                        clock
                    );

                    // Wait until auction starts and bid
                    await time.increaseTo(start);
                    await auctionHandler.connect(bidder).bid(consignmentId, {value: reserve});

                    // Now fast-forward to end of auction...
                    await time.increaseTo(
                        ethers.BigNumber
                            .from(start)
                            .add(duration)
                            .add(
                                "1" // 1s after end of auction
                            )
                            .toString()
                    );

                    // Calculate the expected distribution of funds
                    grossSale = ethers.BigNumber.from(reserve);
                    feeAmount = grossSale.mul(primaryFeePercentage).div("10000");
                    multisigAmount = feeAmount.div("2");
                    stakingAmount = feeAmount.div("2");
                    sellerAmount = grossSale.sub(feeAmount);

                });

                it("multisig contract should be sent half the marketplace fee based on gross", async function () {

                    // Bidder closes auction
                    await expect(
                        auctionHandler.connect(bidder).closeAuction(consignmentId)
                    ).to.emit(auctionHandler, "FeeDisbursed")
                        .withArgs(consignmentId, multisig.address, multisigAmount);

                });

                it("staking contract should be sent half the marketplace fee based on gross", async function () {

                    // Bidder closes auction
                    await expect(
                        auctionHandler.connect(bidder).closeAuction(consignmentId)
                    ).to.emit(auctionHandler, "FeeDisbursed")
                        .withArgs(consignmentId, seenStaking.address, stakingAmount);

                });

                it("seller should be sent remainder after marketplace fee", async function () {

                    // Bidder closes auction
                    await expect(
                        auctionHandler.connect(bidder).closeAuction(consignmentId)
                    ).to.emit(auctionHandler, "PayoutDisbursed")
                        .withArgs(consignmentId, seller.address, sellerAmount);

                });

            });

            context("Secondary Market", async function () {

                beforeEach(async function () {

                    // Get the next consignment id
                    consignmentId = await marketController.getNextConsignment();

                    // Token is on a foreign contract
                    tokenAddress = foreign1155.address;

                    // Creator transfers all their tokens to seller
                    await foreign1155.connect(creator).safeTransferFrom(creator.address, seller.address, tokenId, supply, []);

                    // SELLER creates secondary market auction
                    await auctionHandler.connect(seller).createSecondaryAuction(
                        seller.address,
                        tokenAddress,
                        tokenId,
                        start,
                        duration,
                        reserve,
                        audience,
                        clock
                    );

                    // Wait until auction starts and bid
                    await time.increaseTo(start);
                    await auctionHandler.connect(bidder).bid(consignmentId, {value: reserve});

                    // Now fast-forward to end of auction...
                    await time.increaseTo(
                        ethers.BigNumber
                            .from(start)
                            .add(duration)
                            .add(
                                "1" // 1s after end of auction
                            )
                            .toString()
                    );

                    // Calculate the expected distribution of funds
                    grossSale = ethers.BigNumber.from(reserve);
                    royaltyAmount = grossSale.mul(royaltyPercentage).div("10000");
                    netAfterRoyalties = grossSale.sub(royaltyAmount);
                    feeAmount = netAfterRoyalties.mul(secondaryFeePercentage).div("10000");
                    multisigAmount = feeAmount.div("2");
                    stakingAmount = feeAmount.div("2");
                    sellerAmount = netAfterRoyalties.sub(feeAmount);

                });

                it("creator should receive royalty based on gross sale amount", async function () {

                    // Bidder closes auction
                    await expect(
                        auctionHandler.connect(bidder).closeAuction(consignmentId)
                    ).to.emit(auctionHandler, "RoyaltyDisbursed")
                        .withArgs(consignmentId, creator.address, royaltyAmount);

                });

                it("multisig contract should be sent half the marketplace fee based on net after royalty", async function () {

                    // Bidder closes auction
                    await expect(
                        auctionHandler.connect(bidder).closeAuction(consignmentId)
                    ).to.emit(auctionHandler, "FeeDisbursed")
                        .withArgs(consignmentId, multisig.address, multisigAmount);

                });

                it("staking contract should be sent half the marketplace fee based on net after royalty", async function () {

                    // Bidder closes auction
                    await expect(
                        auctionHandler.connect(bidder).closeAuction(consignmentId)
                    ).to.emit(auctionHandler, "FeeDisbursed")
                        .withArgs(consignmentId, seenStaking.address, stakingAmount);

                });

                it("seller should be sent remainder after royalty and fee", async function () {

                    // Bidder closes auction
                    await expect(
                        auctionHandler.connect(bidder).closeAuction(consignmentId)
                    ).to.emit(auctionHandler, "PayoutDisbursed")
                        .withArgs(consignmentId, seller.address, sellerAmount);

                });

            });

        });

        context("Asset Transfers", async function () {

            context("New Auctions", async function () {

                it("createPrimaryAuction() should transfer token to MarketController contract", async function () {

                    // Token is on a foreign contract
                    tokenAddress = foreign1155.address;

                    // Creator transfers all their tokens to seller
                    await foreign1155.connect(creator).safeTransferFrom(creator.address, seller.address, tokenId, supply, []);

                    // Seller balance of token
                    sellerBalance = await foreign1155.balanceOf(seller.address, tokenId);

                    // SELLER creates secondary market auction
                    await auctionHandler.connect(seller).createSecondaryAuction(
                        seller.address,
                        tokenAddress,
                        tokenId,
                        start,
                        duration,
                        reserve,
                        audience,
                        clock
                    );

                    // MarketController should now hold the seller's balance of the token
                    contractBalance = await foreign1155.balanceOf(marketController.address, tokenId);
                    expect(contractBalance.eq(sellerBalance));

                    // Seller balance after creating auction (balance is one item per auction)
                    newBalance = await foreign1155.balanceOf(seller.address, tokenId);
                    expect(sellerBalance.sub(supply).eq(newBalance));

                });

                it("createSecondaryAuction() should transfer token to MarketController contract", async function () {

                    // Token is on a foreign contract
                    tokenAddress = foreign1155.address;

                    // Creator transfers all their tokens to seller
                    await foreign1155.connect(creator).safeTransferFrom(creator.address, seller.address, tokenId, supply, []);

                    // Seller balance of token
                    sellerBalance = await foreign1155.balanceOf(seller.address, tokenId);

                    // SELLER creates secondary market auction
                    await auctionHandler.connect(seller).createSecondaryAuction(
                        seller.address,
                        tokenAddress,
                        tokenId,
                        start,
                        duration,
                        reserve,
                        audience,
                        clock
                    );

                    // MarketController should now own the balance of the token
                    contractBalance = await foreign1155.balanceOf(marketController.address, tokenId);
                    expect(contractBalance.eq(sellerBalance)).to.be.true;

                    // Seller balance after creating auction (balance is one item per auction)
                    newBalance = await foreign1155.balanceOf(seller.address, tokenId);
                    expect(sellerBalance.sub(supply).eq(newBalance)).to.be.true;

                });

            });

            context("Existing Auctions", async function () {

                beforeEach(async function() {

                    // SELLER creates auction for digital
                    await auctionHandler.connect(seller).createPrimaryAuction(
                        consignmentId,
                        start,
                        duration,
                        reserve,
                        audience,
                        clock
                    );

                    // ESCROW_AGENT creates auction for physical
                    await auctionHandler.connect(escrowAgent).createPrimaryAuction(
                        physicalConsignmentId,
                        start,
                        duration,
                        reserve,
                        audience,
                        clock
                    );

                });

                context("closeAuction()", async function () {

                    beforeEach(async function () {

                        // Wait until auctions start and bid
                        await time.increaseTo(start);
                        await auctionHandler.connect(bidder).bid(consignmentId, {value: reserve});
                        await auctionHandler.connect(bidder).bid(physicalConsignmentId, {value: reserve});

                        // Now fast-forward to end of auction...
                        await time.increaseTo(
                            ethers.BigNumber
                                .from(start)
                                .add(duration)
                                .add(
                                    "1" // 1s after end of auction
                                )
                                .toString()
                        );

                    });

                    it("should transfer consigned balance of token to buyer if digital", async function () {

                        // Get contract balance of token
                        contractBalance = await marketController.getUnreleasedSupply(tokenId);

                        // Bidder closes auction
                        await auctionHandler.connect(bidder).closeAuction(consignmentId);

                        // Get contract's new balance of token
                        newBalance = await marketController.getUnreleasedSupply(tokenId);
                        expect(contractBalance.sub(supply).eq(newBalance));

                        // Get buyer's new balance of token
                        buyerBalance = await seenHausNFT.balanceOf(bidder.address, tokenId);
                        expect(buyerBalance.eq(contractBalance));

                    });

                    it("should transfer consigned balance of token to escrow ticketer if physical", async function () {

                        // Get the escrow ticketer to use
                        escrowTicketer = await marketController.getEscrowTicketer(physicalConsignmentId);

                        // Get contract balance of token
                        contractBalance = await marketController.getUnreleasedSupply(physicalTokenId);

                        // Bidder closes auction
                        await auctionHandler.connect(bidder).closeAuction(physicalConsignmentId);

                        // Get contract's new balance of token
                        newBalance = await marketController.getUnreleasedSupply(physicalTokenId);
                        expect(contractBalance.sub(supply).eq(newBalance));

                        // Get escrow ticketer's new balance of token
                        ticketerBalance = await seenHausNFT.balanceOf(escrowTicketer, physicalTokenId);
                        expect(buyerBalance.eq(contractBalance));

                    });

                    it("should transfer an escrow ticket to buyer if physical", async function () {

                        // Get the escrow ticketer to use
                        escrowTicketer = await marketController.getEscrowTicketer(physicalConsignmentId);

                        // Get contract balance of token
                        contractBalance = await marketController.getUnreleasedSupply(physicalTokenId);

                        // Bidder closes auction
                        await auctionHandler.connect(bidder).closeAuction(physicalConsignmentId);

                        // Get contract's new balance of escrow ticket
                        buyerBalance = await marketController.getUnreleasedSupply(physicalTokenId);
                        expect(contractBalance.sub(supply).eq(newBalance));

                        // Get escrow ticketer's new balance of token
                        ticketerBalance = await seenHausNFT.balanceOf(escrowTicketer, physicalTokenId);
                        expect(buyerBalance.eq(contractBalance));

                    });

                });

                context("cancelAuction()", async function () {

                    beforeEach(async function () {

                        // Wait until auction starts and bid
                        await time.increaseTo(start);
                        await auctionHandler.connect(bidder).bid(consignmentId, {value: reserve});

                        // Fast-forward to half way through auction...
                        await time.increaseTo(
                            ethers.BigNumber
                                .from(start)
                                .add(
                                    ethers.BigNumber.from(duration).div("2")
                                )
                                .toString()
                        );

                    });

                    it("should transfer consigned balance of token to seller if digital", async function () {

                        // Admin pulls auction with no bids
                        await auctionHandler.connect(admin).cancelAuction(consignmentId);

                        // Get contract's new balance of token
                        newBalance = await marketController.getUnreleasedSupply(tokenId);
                        expect(contractBalance.sub(supply).eq(newBalance));

                        // Get seller's new balance of token
                        sellerBalance = await seenHausNFT.balanceOf(seller.address, tokenId);
                        expect(buyerBalance.eq(contractBalance));

                    });

                    it("should transfer consigned balance of token to seller if physical", async function () {

                        // Admin pulls auction with no bids
                        await auctionHandler.connect(admin).cancelAuction(physicalConsignmentId);

                        // Get contract's new balance of token
                        newBalance = await marketController.getUnreleasedSupply(physicalTokenId);
                        expect(contractBalance.sub(supply).eq(newBalance));

                        // Get seller's new balance of token
                        sellerBalance = await seenHausNFT.balanceOf(seller.address, physicalTokenId);
                        expect(buyerBalance.eq(contractBalance));

                    });

                });

            });

        });

        context("Reading Auction Information", async function () {

            beforeEach(async function () {

                // Token is on a foreign contract
                tokenAddress = foreign1155.address;

                // Creator transfers all their tokens to seller
                await foreign1155.connect(creator).safeTransferFrom(creator.address, seller.address, tokenId, supply, []);

                // Get the consignment id
                consignmentId = await marketController.getNextConsignment();

                // Seller creates auction
                await auctionHandler.connect(seller).createSecondaryAuction(
                    seller.address,
                    tokenAddress,
                    tokenId,
                    start,
                    duration,
                    reserve,
                    audience,
                    clock
                );

            })

            it("getAuction() should return a valid Auction struct", async function () {

                // Get next consignment
                const response = await auctionHandler.getAuction(consignmentId);

                // Convert to entity
                auction = new Auction(
                    response.buyer,
                    response.consignmentId.toString(),
                    response.start.toString(),
                    response.duration.toString(),
                    response.reserve.toString(),
                    response.bid.toString(),
                    response.clock,
                    response.state,
                    response.outcome
                );

                // Test validity
                expect(
                    auction.isValid(),
                    "Auction not valid"
                ).is.true;

            });

        });

    });

});