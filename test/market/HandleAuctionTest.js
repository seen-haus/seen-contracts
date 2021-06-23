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
const Ticketer = require("../../domain/Ticketer");

describe("HandleAuction", function() {

    // Common vars
    let accounts, deployer, admin, creator, associate, seller, minter, bidder, rival, escrowAgent;
    let AccessController, accessController;
    let MarketController, marketController;
    let HandleAuction, handleAuction;
    let TicketAsLot, ticketAsLot;
    let TicketAsItems, ticketAsItems;
    let SeenHausNFT, seenHausNFT;
    let staking, multisig, vipStakerAmount, feePercentage, maxRoyaltyPercentage, outBidPercentage, defaultTicketerType;
    let market, tokenAddress, tokenId, tokenURI, auction, physicalTokenId, physicalConsignmentId, consignmentId, nextConsignment, block, blockNumber, outbid;
    let royaltyPercentage, supply, start, duration, reserve, audience, clock, escrowTicketer;
    let royaltyAmount, sellerAmount, feeAmount, multisigAmount, stakingAmount, grossSale, netAfterRoyalties;
    let sellerBalance, contractBalance, buyerBalance, ticketerBalance, newBalance;

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
        rival = accounts[7];
        escrowAgent = accounts[8];

        staking = accounts[9];         // We just need addresses for these,
        multisig = accounts[10];       // not functional contracts

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

        // Deploy the TicketAsItems contract
        TicketAsItems = await ethers.getContractFactory('TicketAsItems');
        ticketAsItems = await TicketAsItems.deploy(
            accessController.address,
            marketController.address
        );
        await ticketAsItems.deployed();

        // Deploy the TicketAsLot contract
        TicketAsLot = await ethers.getContractFactory('TicketAsLot');
        ticketAsLot = await TicketAsLot.deploy(
            accessController.address,
            marketController.address
        );
        await ticketAsLot.deployed();

        // Escrow Ticketer and NFT addresses get set after deployment since
        // they require the MarketController's address in their constructors
        await marketController.setNft(seenHausNFT.address);
        await marketController.setLotsTicketer(ticketAsLot.address);
        await marketController.setItemsTicketer(ticketAsItems.address);

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

            // Escrow Agent needed to create auctions of escrowed items
            await accessController.connect(admin).grantRole(Role.ESCROW_AGENT, escrowAgent.address);

            // Seller approves HandleAuction contract to transfer their tokens
            await seenHausNFT.connect(seller).setApprovalForAll(handleAuction.address, true);

            // Mint a balance of one token for auctioning
            tokenId = await seenHausNFT.getNextToken();
            tokenURI = "https://ipfs.io/ipfs/QmXBB6qm5vopwJ6ddxb1mEr1Pp87AHd3BUgVbsipCf9hWU";
            supply = "1";
            royaltyPercentage = maxRoyaltyPercentage;

            // Seller creates digital token
            await seenHausNFT.connect(seller).mintDigital(supply, creator.address, tokenURI, royaltyPercentage);

            // Physical token id
            physicalTokenId = await seenHausNFT.getNextToken();

            // Escrow agent creates physical token to seller
            await seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI, royaltyPercentage);

            // Escrow agent transfers token balance to seller
            await seenHausNFT.connect(escrowAgent).safeTransferFrom(escrowAgent.address, seller.address, physicalTokenId, supply, []);

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

        context("Privileged Access", async function () {

            context("New Auctions", async function () {

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

            });

            context("Existing Auctions", async function () {

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

                });

                it("changeAudience() should require caller has ADMIN role", async function () {

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

                it("pull() should require caller has ADMIN role", async function () {

                    // Fast-forward to end of auction, no bids...
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
                        handleAuction.connect(associate).pull(consignmentId)
                    ).to.be.revertedWith("Access denied, caller doesn't have role");

                    // ADMIN attempt
                    await expect (
                        handleAuction.connect(admin).pull(consignmentId)
                    ).to.emit(handleAuction,"AuctionEnded");

                });

                it("cancel() should require caller has ADMIN role", async function () {

                    // Wait until auction starts and bid
                    await time.increaseTo(start);
                    await handleAuction.connect(bidder).bid(consignmentId, {value: reserve});

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
                        handleAuction.connect(associate).cancel(consignmentId)
                    ).to.be.revertedWith("Access denied, caller doesn't have role");

                    // ADMIN attempt
                    await expect (
                        handleAuction.connect(admin).cancel(consignmentId)
                    ).to.emit(handleAuction,"AuctionEnded");

                });

            });

        });

        context("Change Events", async function () {

            context("New Auctions", async function () {

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

            });

            context("Existing Auctions", async function () {

                beforeEach(async function() {

                    // Lets use secondary market to trigger royalties
                    market = Market.SECONDARY;

                    // SELLER creates secondary market auction
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

                });

                context("changeAudience()", async function () {

                    it("should emit an AudienceChanged event", async function () {

                        // ADMIN attempt
                        await expect(
                            handleAuction.connect(admin).changeAudience(
                                consignmentId,
                                Audience.OPEN
                            )
                        ).to.emit(handleAuction, "AudienceChanged")
                            .withArgs(consignmentId, Audience.OPEN);

                    });

                });

                context("bid()", async function () {

                    beforeEach(async function () {

                        // Wait until auction starts and bid
                        await time.increaseTo(start);

                    });

                    it("should emit a BidAccepted event", async function () {

                        // First bidder meets reserve
                        await expect(
                            await handleAuction.connect(bidder).bid(consignmentId, {value: reserve})
                        ).to.emit(handleAuction, "BidAccepted")
                            .withArgs(
                                consignmentId,
                                bidder.address,
                                reserve
                            );

                    });

                    it("should emit a BidReturned event when previous bidder is outbid", async function () {

                        // First bidder meets reserve
                        await handleAuction.connect(bidder).bid(consignmentId, {value: reserve})

                        // Double previous bid
                        outbid = ethers.BigNumber.from(reserve).mul("2");

                        // First bidder meets reserve
                        await expect(
                            await handleAuction.connect(rival).bid(consignmentId, {value: outbid})
                        ).to.emit(handleAuction, "BidReturned")
                            .withArgs(
                                consignmentId,
                                bidder.address,
                                reserve
                            );

                    });

                });

                context("close()", async function () {

                    beforeEach(async function () {

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
                        await expect(
                            handleAuction.connect(admin).close(consignmentId)
                        ).to.emit(handleAuction, "AuctionEnded")
                            .withArgs(
                                consignmentId,
                                Outcome.CLOSED
                            );

                    });

                    it("should trigger an AuctionEnded event", async function () {

                        // Admin closes auction
                        await expect(
                            handleAuction.connect(admin).close(consignmentId)
                        ).to.emit(handleAuction, "AuctionEnded")
                            .withArgs(
                                consignmentId,
                                Outcome.CLOSED
                            );

                    });

                    it("should trigger an PayoutDisbursed event", async function () {

                        // Admin closes auction
                        await expect(
                            handleAuction.connect(admin).close(consignmentId)
                        ).to.emit(handleAuction, "PayoutDisbursed");

                    });

                    it("should trigger an FeeDisbursed event", async function () {

                        // Admin closes auction
                        await expect(
                            handleAuction.connect(admin).close(consignmentId)
                        ).to.emit(handleAuction, "FeeDisbursed");

                    });

                    it("should trigger an RoyaltyDisbursed event for secondary market auctions", async function () {

                        // Admin closes auction
                        await expect(
                            handleAuction.connect(admin).close(consignmentId)
                        ).to.emit(handleAuction, "RoyaltyDisbursed");

                    });

                });

                context("pull()", async function () {

                    beforeEach(async function () {

                        // Fast-forward to end of auction, no bids...
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

                        // Admin pulls auction with no bids
                        await expect(
                            handleAuction.connect(admin).pull(consignmentId)
                        ).to.emit(handleAuction, "AuctionEnded")
                            .withArgs(
                                consignmentId,
                                Outcome.PULLED
                            );

                    });

                });

                context("cancel()", async function () {

                    beforeEach(async function () {

                        // Wait until auction starts and bid
                        await time.increaseTo(start);
                        await handleAuction.connect(bidder).bid(consignmentId, {value: reserve});

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

                        // Admin closes auction
                        await expect(
                            handleAuction.connect(admin).cancel(consignmentId)
                        ).to.emit(handleAuction, "AuctionEnded")
                            .withArgs(
                                consignmentId,
                                Outcome.CANCELED
                            );

                    });

                    it("should trigger an BidReturned event if a bid existed", async function () {

                        // Admin closes auction
                        await expect(
                            handleAuction.connect(admin).cancel(consignmentId)
                        ).to.emit(handleAuction, "BidReturned")
                            .withArgs(consignmentId, bidder.address, reserve);

                    });

                });

            });

        });

        context("Funds Distribution", async function () {

            context("Primary Market", async function () {

                beforeEach(async function () {

                    // SELLER creates primary market auction
                    market = Market.PRIMARY;
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

                    // Calculate the expected distribution of funds
                    grossSale = ethers.BigNumber.from(reserve);
                    feeAmount = grossSale.mul(feePercentage).div("10000");
                    multisigAmount = feeAmount.div("2");
                    stakingAmount = feeAmount.div("2");
                    sellerAmount = grossSale.sub(feeAmount);

                });

                it("multisig contract should be sent half the marketplace fee based on gross", async function () {

                    // Admin closes auction
                    await expect(
                        handleAuction.connect(admin).close(consignmentId)
                    ).to.emit(handleAuction, "FeeDisbursed")
                        .withArgs(consignmentId, multisig.address, multisigAmount);

                });

                it("staking contract should be sent half the marketplace fee based on gross", async function () {

                    // Admin closes auction
                    await expect(
                        handleAuction.connect(admin).close(consignmentId)
                    ).to.emit(handleAuction, "FeeDisbursed")
                        .withArgs(consignmentId, staking.address, stakingAmount);

                });

                it("seller should be sent remainder after marketplace fee", async function () {

                    // Admin closes auction
                    await expect(
                        handleAuction.connect(admin).close(consignmentId)
                    ).to.emit(handleAuction, "PayoutDisbursed")
                        .withArgs(consignmentId, seller.address, sellerAmount);

                });

            });

            context("Secondary Market", async function () {

                beforeEach(async function () {

                    // SELLER creates secondary market auction
                    market = Market.SECONDARY;
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

                    // Calculate the expected distribution of funds
                    grossSale = ethers.BigNumber.from(reserve);
                    royaltyAmount = grossSale.mul(royaltyPercentage).div("10000");
                    netAfterRoyalties = grossSale.sub(royaltyAmount);
                    feeAmount = netAfterRoyalties.mul(feePercentage).div("10000");
                    multisigAmount = feeAmount.div("2");
                    stakingAmount = feeAmount.div("2");
                    sellerAmount = netAfterRoyalties.sub(feeAmount);

                });

                it("creator should receive royalty based on gross sale amount", async function () {

                    // Admin closes auction
                    await expect(
                        handleAuction.connect(admin).close(consignmentId)
                    ).to.emit(handleAuction, "RoyaltyDisbursed")
                        .withArgs(consignmentId, creator.address, royaltyAmount);

                });

                it("multisig contract should be sent half the marketplace fee based on net after royalty", async function () {

                    // Admin closes auction
                    await expect(
                        handleAuction.connect(admin).close(consignmentId)
                    ).to.emit(handleAuction, "FeeDisbursed")
                        .withArgs(consignmentId, multisig.address, multisigAmount);

                });

                it("staking contract should be sent half the marketplace fee based on net after royalty", async function () {

                    // Admin closes auction
                    await expect(
                        handleAuction.connect(admin).close(consignmentId)
                    ).to.emit(handleAuction, "FeeDisbursed")
                        .withArgs(consignmentId, staking.address, stakingAmount);

                });

                it("seller should be sent remainder after royalty and fee", async function () {

                    // Admin closes auction
                    await expect(
                        handleAuction.connect(admin).close(consignmentId)
                    ).to.emit(handleAuction, "PayoutDisbursed")
                        .withArgs(consignmentId, seller.address, sellerAmount);

                });

            });

        })

        context("Asset Transfers", async function () {

            context("New Auctions", async function () {

                it("createAuction() should transfer token to HandleAuction contract", async function () {

                    // Seller balance of token
                    sellerBalance = await seenHausNFT.balanceOf(seller.address, tokenId);

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

                    // Contract should now own the balance of the token
                    contractBalance = await seenHausNFT.balanceOf(seenHausNFT.address, tokenId);
                    expect(contractBalance.eq(sellerBalance));

                    // Seller balance after creating auction (balance is one item per auction)
                    newBalance = await seenHausNFT.balanceOf(seller.address, tokenId);
                    expect(sellerBalance.sub(supply).eq(newBalance));

                });

            });

            context("Existing Auctions", async function () {

                beforeEach(async function() {

                    // SELLER creates auction for digital
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

                    // SELLER creates auction for physical
                    physicalConsignmentId = await marketController.getNextConsignment();
                    await handleAuction.connect(seller).createAuction(
                        seller.address,
                        tokenAddress,
                        physicalTokenId,
                        start,
                        duration,
                        reserve,
                        audience,
                        market,
                        clock
                    );

                });

                context("close()", async function () {

                    beforeEach(async function () {

                        // Wait until auctions start and bid
                        await time.increaseTo(start);
                        await handleAuction.connect(bidder).bid(consignmentId, {value: reserve});
                        await handleAuction.connect(bidder).bid(physicalConsignmentId, {value: reserve});

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

                    it("should transfer consigned balance of token to buyer if digital", async function () {

                        // Get contract balance of token
                        contractBalance = await seenHausNFT.balanceOf(seenHausNFT.address, tokenId);

                        // Admin closes auction
                        await handleAuction.connect(admin).close(consignmentId);

                        // Get contract's new balance of token
                        newBalance = await seenHausNFT.balanceOf(seenHausNFT.address, tokenId);
                        expect(contractBalance.sub(supply).eq(newBalance));

                        // Get buyer's new balance of token
                        buyerBalance = await seenHausNFT.balanceOf(bidder.address, tokenId);
                        expect(buyerBalance.eq(contractBalance));

                    });

                    it("should transfer consigned balance of token to escrow ticketer if physical", async function () {

                        // Get the escrow ticketer to use
                        escrowTicketer = await marketController.getEscrowTicketer(physicalConsignmentId);

                        // Get contract balance of token
                        contractBalance = await seenHausNFT.balanceOf(seenHausNFT.address, physicalTokenId);

                        // Admin closes auction
                        await handleAuction.connect(admin).close(physicalConsignmentId);

                        // Get contract's new balance of token
                        newBalance = await seenHausNFT.balanceOf(seenHausNFT.address, physicalTokenId);
                        expect(contractBalance.sub(supply).eq(newBalance));

                        // Get escrow ticketer's new balance of token
                        ticketerBalance = await seenHausNFT.balanceOf(escrowTicketer, physicalTokenId);
                        expect(buyerBalance.eq(contractBalance));

                    });

                    it("should transfer an escrow ticket to buyer if physical", async function () {

                        // Get the escrow ticketer to use
                        escrowTicketer = await marketController.getEscrowTicketer(physicalConsignmentId);

                        // Get contract balance of token
                        contractBalance = await seenHausNFT.balanceOf(seenHausNFT.address, physicalTokenId);

                        // Admin closes auction
                        await handleAuction.connect(admin).close(physicalConsignmentId);

                        // Get contract's new balance of escrow ticket
                        buyerBalance = await seenHausNFT.balanceOf(seenHausNFT.address, physicalTokenId);
                        expect(contractBalance.sub(supply).eq(newBalance));

                        // Get escrow ticketer's new balance of token
                        ticketerBalance = await seenHausNFT.balanceOf(escrowTicketer, physicalTokenId);
                        expect(buyerBalance.eq(contractBalance));

                    });

                });

                context("pull()", async function () {

                    beforeEach(async function () {

                        // Fast-forward to end of auction, no bids...
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

                    it("should transfer consigned balance of token to seller if digital", async function () {

                        // Admin pulls auction with no bids
                        await handleAuction.connect(admin).pull(consignmentId);

                        // Get contract's new balance of token
                        newBalance = await seenHausNFT.balanceOf(seenHausNFT.address, tokenId);
                        expect(contractBalance.sub(supply).eq(newBalance));

                        // Get seller's new balance of token
                        sellerBalance = await seenHausNFT.balanceOf(seller.address, tokenId);
                        expect(buyerBalance.eq(contractBalance));

                    });

                    it("should transfer consigned balance of token to seller if physical", async function () {

                        // Admin pulls auction with no bids
                        await handleAuction.connect(admin).pull(physicalConsignmentId);

                        // Get contract's new balance of token
                        newBalance = await seenHausNFT.balanceOf(seenHausNFT.address, physicalTokenId);
                        expect(contractBalance.sub(supply).eq(newBalance));

                        // Get seller's new balance of token
                        sellerBalance = await seenHausNFT.balanceOf(seller.address, physicalTokenId);
                        expect(buyerBalance.eq(contractBalance));

                    });

                });

                context("cancel()", async function () {

                    beforeEach(async function () {

                        // Wait until auction starts and bid
                        await time.increaseTo(start);
                        await handleAuction.connect(bidder).bid(consignmentId, {value: reserve});

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
                        await handleAuction.connect(admin).cancel(consignmentId);

                        // Get contract's new balance of token
                        newBalance = await seenHausNFT.balanceOf(seenHausNFT.address, tokenId);
                        expect(contractBalance.sub(supply).eq(newBalance));

                        // Get seller's new balance of token
                        sellerBalance = await seenHausNFT.balanceOf(seller.address, tokenId);
                        expect(buyerBalance.eq(contractBalance));

                    });

                    it("should transfer consigned balance of token to seller if physical", async function () {

                        // Admin pulls auction with no bids
                        await handleAuction.connect(admin).cancel(physicalConsignmentId);

                        // Get contract's new balance of token
                        newBalance = await seenHausNFT.balanceOf(seenHausNFT.address, physicalTokenId);
                        expect(contractBalance.sub(supply).eq(newBalance));

                        // Get seller's new balance of token
                        sellerBalance = await seenHausNFT.balanceOf(seller.address, physicalTokenId);
                        expect(buyerBalance.eq(contractBalance));

                    });

                });

            });

        })

    });

});