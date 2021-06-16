const hre = require("hardhat");
const ethers = hre.ethers;
const { expect } = require("chai");
const { time } = require('@openzeppelin/test-helpers');
const Role = require("../../domain/Role");
const Market = require("../../domain/Market");
const Clock = require("../../domain/Clock");
const Auction = require("../../domain/Auction");
const State = require("../../domain/State");
const Outcome = require("../../domain/Outcome");
const Audience = require("../../domain/Audience");
const Consignment = require("../../domain/Consignment");

describe("HandleAuction", function() {

    // Common vars
    let accounts, deployer, admin, creator, associate, seller, minter, bidder;
    let AccessController, accessController;
    let MarketController, marketController;
    let HandleAuction, handleAuction;
    let EscrowTicketer, escrowTicketer;
    let SeenHausNFT, seenHausNFT;
    let staking, multisig, vipStakerAmount, feePercentage, maxRoyaltyPercentage, outBidPercentage;
    let market, tokenAddress, tokenId, tokenURI, auction, consignmentId, nextConsignment, consignment,  block, blockNumber;
    let royaltyPercentage, supply, start, duration, reserve, audience, clock;

    const zeroAddress = ethers.BigNumber.from('0x0000000000000000000000000000000000000000');

    beforeEach( async function () {

        // Get the current block info
        blockNumber = await ethers.provider.getBlockNumber();
        block = await ethers.provider.getBlock(blockNumber);

        // Make accounts available
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        admin = accounts[1];
        seller = accounts[2];
        creator = accounts[3]
        minter = accounts[4];
        associate = accounts[5];
        bidder = accounts[6];

        staking = accounts[6];        // We just need addresses for these,
        multisig = accounts[7];       // not functional contracts

        // Market control values
        vipStakerAmount = "500";       // Amount of xSEEN
        feePercentage = "1500";        // 15%   = 1500
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
            maxRoyaltyPercentage,
            outBidPercentage
        );
        await marketController.deployed();

        // Deploy the SeenHausNFT contract
        SeenHausNFT = await ethers.getContractFactory("SeenHausNFT");
        seenHausNFT = await SeenHausNFT.deploy(
            accessController.address,
            marketController.address,
        );
        await seenHausNFT.deployed();

        // Deploy the HandleAuction contract
        HandleAuction = await ethers.getContractFactory("HandleAuction");
        handleAuction = await HandleAuction.deploy(
            accessController.address,
            marketController.address,
        );
        await handleAuction.deployed();

        // Deploy an IEscrowTicketer implementation
        EscrowTicketer = await ethers.getContractFactory('TicketAsLot');
        escrowTicketer = await EscrowTicketer.deploy(
            accessController.address,
            marketController.address
        );
        await escrowTicketer.deployed();

        // Escrow Ticketer and NFT addresses get set after deployment since
        // they require the MarketController's address in their constructors
        await marketController.setEscrowTicketer(escrowTicketer.address);
        await marketController.setNft(seenHausNFT.address);

        // Grant HandleAuction contract the MARKET_HANDLER role
        await accessController.grantRole(Role.MARKET_HANDLER, handleAuction.address);

        // Deployer grants ADMIN role to admin address and renounces admin
        await accessController.connect(deployer).grantRole(Role.ADMIN, admin.address);
        await accessController.connect(deployer).renounceRole(Role.ADMIN, deployer.address);

    });

    context("Managing Auctions", async function () {

        beforeEach( async function () {

            // Prepare for roled access to privileged methods
            // Grant seller both SELLER and MINTER to avoid the need for transferring minted token balance from seller to minter
            // This would be true of an artist who has been given the ability to mint and to create sales and auctions
            await accessController.connect(admin).grantRole(Role.SELLER, seller.address);
            await accessController.connect(admin).grantRole(Role.MINTER, seller.address);

            // Seller approves HandleAuction contract to transfer their tokens
            await seenHausNFT.connect(seller).setApprovalForAll(handleAuction.address, true);

            // Mint an NFT for auctioning
            tokenId = await seenHausNFT.getNextToken();
            tokenURI = "https://ipfs.io/ipfs/QmXBB6qm5vopwJ6ddxb1mEr1Pp87AHd3BUgVbsipCf9hWU";
            supply = "1";
            royaltyPercentage = maxRoyaltyPercentage;

            // Seller creates token
            await seenHausNFT.connect(seller).mintDigital(supply, creator.address, tokenURI, royaltyPercentage);

            // Setup values
            consignmentId = await marketController.getNextConsignment();
            tokenAddress = seenHausNFT.address;
            start = ethers.BigNumber.from(block.timestamp).add('900000').toString(); // 15 minutes from latest block
            duration = ethers.BigNumber.from('86400000'); // 24 hrs
            reserve = ethers.utils.parseUnits("1.5", "ether");
            audience = Audience.OPEN;
            market = Market.PRIMARY;
            clock = Clock.TRIGGERED;

        });

        context("Privileged Access", async function () {

            it("createAuction() should require caller has SELLER role", async function () {

                // non-SELLER attempt
                await expect(
                    handleAuction.connect(associate).createAuction(
                        seller.address,
                        tokenAddress,
                        tokenId,
                        start,
                        duration,
                        reserve,
                        audience,
                        market,
                        clock
                    )
                ).to.be.revertedWith("Access denied, caller doesn't have role");

                // Get next consignment
                nextConsignment = await marketController.getNextConsignment();

                // Test
                expect(
                    nextConsignment.eq(consignmentId),
                    "non-SELLER can create an auction"
                ).is.true;

                // SELLER attempt
                await handleAuction.connect(seller).createAuction(
                    seller.address,
                    tokenAddress,
                    tokenId,
                    start,
                    duration,
                    reserve,
                    audience,
                    market,
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

            it("changeAudience() should require caller has ADMIN role", async function () {

                // SELLER creates auction
                await handleAuction.connect(seller).createAuction(
                    seller.address,
                    tokenAddress,
                    tokenId,
                    start,
                    duration,
                    reserve,
                    audience,
                    market,
                    clock
                );

                // non-ADMIN attempt
                await expect(
                    handleAuction.connect(associate).changeAudience(
                        consignmentId,
                        Audience.VIP_STAKER
                    )
                ).to.be.revertedWith("Access denied, caller doesn't have role");

                // ADMIN attempt
                await expect (
                    handleAuction.connect(admin).changeAudience(
                        consignmentId,
                        Audience.VIP_STAKER
                    )
                ).to.emit(handleAuction,"AudienceChanged");

            });

            it("close() should require caller has ADMIN role", async function () {

                // SELLER creates auction
                await handleAuction.connect(seller).createAuction(
                    seller.address,
                    tokenAddress,
                    tokenId,
                    start,
                    duration,
                    reserve,
                    audience,
                    market,
                    clock
                );

                // Wait until auction starts and bid
                await time.increaseTo(start);
                await handleAuction.connect(bidder).bid(consignmentId, {value: reserve});

                // Now fast-forward to end of auction...
                await time.increaseTo(
                    ethers.BigNumber
                        .from(start)
                        .add(
                            ethers.BigNumber.from(duration)
                        )
                        .add(
                            "1000" // 1s after end of auction
                        )
                        .toString()
                );

                // non-ADMIN attempt
                await expect(
                    handleAuction.connect(associate).close(consignmentId)
                ).to.be.revertedWith("Access denied, caller doesn't have role");

                // ADMIN attempt
                await expect (
                    handleAuction.connect(admin).close(consignmentId)
                ).to.emit(handleAuction,"AuctionEnded");

            });

            // TODO complete ADMIN calls

        });

        context("Change Events", async function () {

            context("createAuction()", async function () {

                it("should trigger a ConsignmentRegistered event on MarketController", async function () {

                    // Create auction, test event
                    await expect(
                        handleAuction.connect(seller).createAuction(
                            seller.address,
                            tokenAddress,
                            tokenId,
                            start,
                            duration,
                            reserve,
                            audience,
                            market,
                            clock
                        )
                    ).emit(marketController, 'ConsignmentRegistered')
                        .withArgs(
                            [ // Consignment
                                market,
                                seller.address,
                                tokenAddress,
                                tokenId,
                                consignmentId
                            ]
                        )

                });

                it("should emit an AuctionPending event", async function () {

                    // Make change, test event
                    await expect(
                        handleAuction.connect(seller).createAuction(
                            seller.address,
                            tokenAddress,
                            tokenId,
                            start,
                            duration,
                            reserve,
                            audience,
                            market,
                            clock
                        )
                    ).to.emit(handleAuction, 'AuctionPending')
                        .withArgs([ // Auction
                                zeroAddress,
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

            context("changeAudience()", async function () {

                it("should emit an AudienceChanged event", async function () {

                    // SELLER creates auction
                    await handleAuction.connect(seller).createAuction(
                        seller.address,
                        tokenAddress,
                        tokenId,
                        start,
                        duration,
                        reserve,
                        audience,
                        market,
                        clock
                    );

                    // ADMIN attempt
                    await expect (
                        handleAuction.connect(admin).changeAudience(
                            consignmentId,
                            Audience.OPEN
                        )
                    ).to.emit(handleAuction,"AudienceChanged")
                        .withArgs(consignmentId, Audience.OPEN);

                });

            });

            context("close()", async function () {

                beforeEach(async function() {
                    // SELLER creates auction
                    await handleAuction.connect(seller).createAuction(
                        seller.address,
                        tokenAddress,
                        tokenId,
                        start,
                        duration,
                        reserve,
                        audience,
                        market,
                        clock
                    );

                    // Wait until auction starts and bid
                    await time.increaseTo(start);
                    await handleAuction.connect(bidder).bid(consignmentId, {value: reserve});

                    // Now fast-forward to end of auction...
                    await time.increaseTo(
                        ethers.BigNumber
                            .from(start)
                            .add(
                                ethers.BigNumber.from(duration)
                            )
                            .add(
                                "1000" // 1s after end of auction
                            )
                            .toString()
                    );

                });

                it("should emit an AuctionEnded event", async function () {

                    // Admin closes auction
                    await expect (
                        handleAuction.connect(admin).close(consignmentId)
                    ).to.emit(handleAuction,"AuctionEnded")
                        .withArgs(
                            consignmentId,
                            Outcome.CLOSED
                        );

                });

                it("should trigger an AuctionEnded event", async function () {

                    // Admin closes auction
                    await expect (
                        handleAuction.connect(admin).close(consignmentId)
                    ).to.emit(handleAuction,"AuctionEnded")
                        .withArgs(
                            consignmentId,
                            Outcome.CLOSED
                        );

                });

            });


            // TODO complete all emitted / triggered events

        });

        context("Reading Auction Information", async function () {

            beforeEach(async function () {

                // Seller creates auction
                await handleAuction.connect(seller).createAuction(
                    seller.address,
                    tokenAddress,
                    tokenId,
                    start,
                    duration,
                    reserve,
                    audience,
                    market,
                    clock
                );

            })

            it("getAuction() should return a valid Auction struct", async function () {

                // Get next consignment
                const response = await handleAuction.getAuction(consignmentId);

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