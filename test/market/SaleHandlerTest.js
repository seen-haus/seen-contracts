const hre = require("hardhat");
const ethers = hre.ethers;
const { expect } = require("chai");
const { time } = require('@openzeppelin/test-helpers');
const Role = require("../../domain/Role");
const Market = require("../../domain/Market");
const Sale = require("../../domain/Sale");
const State = require("../../domain/State");
const Outcome = require("../../domain/Outcome");
const Audience = require("../../domain/Audience");
const Ticketer = require("../../domain/Ticketer");

describe("SaleHandler", function() {

    // Common vars
    let accounts, deployer, admin, creator, associate, seller, minter, buyer, escrowAgent;
    let AccessController, accessController;
    let MarketController, marketController;
    let SaleHandler, saleHandler;
    let LotsTicketer, lotsTicketer;
    let ItemsTicketer, itemsTicketer;
    let SeenHausNFT, seenHausNFT;
    let staking, multisig, vipStakerAmount, feePercentage, maxRoyaltyPercentage, outBidPercentage, defaultTicketerType;
    let market, tokenAddress, tokenId, tokenURI, sale, physicalTokenId, physicalConsignmentId, consignmentId, nextConsignment, block, blockNumber;
    let royaltyPercentage, supply, start, quantity, price, perTxCap, audience, escrowTicketer;
    let royaltyAmount, sellerAmount, feeAmount, multisigAmount, stakingAmount, grossSale, netAfterRoyalties;
    let sellerBalance, contractBalance, buyerBalance, ticketerBalance, newBalance, buyOutPrice, single;

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
        buyer = accounts[6];
        escrowAgent = accounts[7];

        staking = accounts[8];         // We just need addresses for these,
        multisig = accounts[9];       // not functional contracts

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

        // Deploy the SaleHandler contract
        SaleHandler = await ethers.getContractFactory("SaleHandler");
        saleHandler = await SaleHandler.deploy(
            accessController.address,
            marketController.address,
        );
        await saleHandler.deployed();

        // Deploy the ItemsTicketer contract
        ItemsTicketer = await ethers.getContractFactory('ItemsTicketer');
        itemsTicketer = await ItemsTicketer.deploy(
            accessController.address,
            marketController.address
        );
        await itemsTicketer.deployed();

        // Deploy the LotsTicketer contract
        LotsTicketer = await ethers.getContractFactory('LotsTicketer');
        lotsTicketer = await LotsTicketer.deploy(
            accessController.address,
            marketController.address
        );
        await lotsTicketer.deployed();

        // Escrow Ticketer and NFT addresses get set after deployment since
        // they require the MarketController's address in their constructors
        await marketController.setNft(seenHausNFT.address);
        await marketController.setLotsTicketer(lotsTicketer.address);
        await marketController.setItemsTicketer(itemsTicketer.address);

        // Grant SaleHandler contract the MARKET_HANDLER role
        await accessController.grantRole(Role.MARKET_HANDLER, saleHandler.address);

        // Deployer grants ADMIN role to admin address and renounces admin
        await accessController.connect(deployer).grantRole(Role.ADMIN, admin.address);
        await accessController.connect(deployer).renounceRole(Role.ADMIN, deployer.address);

    });

    context("Managing Sales", async function () {

        beforeEach( async function () {

            // Prepare for roled access to privileged methods
            // Grant seller both SELLER and MINTER to avoid the need for transferring minted token balance from seller to minter
            // This would be true of an artist who has been given the ability to mint and to create sales and sales
            await accessController.connect(admin).grantRole(Role.SELLER, seller.address);
            await accessController.connect(admin).grantRole(Role.MINTER, seller.address);

            // Escrow Agent needed to create sales of escrowed items
            await accessController.connect(admin).grantRole(Role.ESCROW_AGENT, escrowAgent.address);

            // Seller approves SaleHandler contract to transfer their tokens
            await seenHausNFT.connect(seller).setApprovalForAll(saleHandler.address, true);

            // Mint a balance of 50 of the token for sale
            supply = "50";
            tokenId = await seenHausNFT.getNextToken();
            tokenURI = "https://ipfs.io/ipfs/QmXBB6qm5vopwJ6ddxb1mEr1Pp87AHd3BUgVbsipCf9hWU";
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
            price = ethers.utils.parseUnits("1", "ether");
            quantity = supply;
            perTxCap = supply; // TODO: test lower buyout price by overriding this value at sale creation
            audience = Audience.OPEN;
            market = Market.PRIMARY;
            buyOutPrice = price.mul(ethers.BigNumber.from(quantity)).toString();
            single = "1";
        });

        context("Reading Sale Information", async function () {

            beforeEach(async function () {

                // Seller creates sale
                await saleHandler.connect(seller).createSale(
                    seller.address,
                    tokenAddress,
                    tokenId,
                    start,
                    quantity,
                    price,
                    perTxCap,
                    audience,
                    market
                );

            })

            it("getSale() should return a valid Sale struct", async function () {

                // Get next consignment
                const response = await saleHandler.getSale(consignmentId);

                // Convert to entity
                sale = new Sale(
                    response.consignmentId.toString(),
                    response.start.toString(),
                    response.quantity.toString(),
                    response.price.toString(),
                    response.perTxCap.toString(),
                    response.state,
                    response.outcome
                );

                // Test validity
                expect(
                    sale.isValid(),
                    "Sale not valid"
                ).is.true;

            });

        });

        context("Privileged Access", async function () {

            context("New Sales", async function () {

                it("createSale() should require caller has SELLER role", async function () {

                    // non-SELLER attempt
                    await expect(
                        saleHandler.connect(associate).createSale(
                            seller.address,
                            tokenAddress,
                            tokenId,
                            start,
                            quantity,
                            price,
                            perTxCap,
                            audience,
                            market
                        )
                    ).to.be.revertedWith("Access denied, caller doesn't have role");

                    // Get next consignment
                    nextConsignment = await marketController.getNextConsignment();

                    // Test
                    expect(
                        nextConsignment.eq(consignmentId),
                        "non-SELLER can create an sale"
                    ).is.true;

                    // SELLER attempt
                    await saleHandler.connect(seller).createSale(
                        seller.address,
                        tokenAddress,
                        tokenId,
                        start,
                        quantity,
                        price,
                        perTxCap,
                        audience,
                        market
                    );

                    // Get next consignment
                    nextConsignment = await marketController.getNextConsignment();

                    // Test
                    expect(
                        nextConsignment.gt(consignmentId),
                        "SELLER can't create an sale"
                    ).is.true;

                });

            });

            context("Existing Sales", async function () {

                beforeEach(async function() {

                    // SELLER creates sale
                    await saleHandler.connect(seller).createSale(
                        seller.address,
                        tokenAddress,
                        tokenId,
                        start,
                        quantity,
                        price,
                        perTxCap,
                        audience,
                        market
                    );

                });

                it("changeAudience() should require caller has ADMIN role", async function () {

                    // non-ADMIN attempt
                    await expect(
                        saleHandler.connect(associate).changeAudience(
                            consignmentId,
                            Audience.VIP_STAKER
                        )
                    ).to.be.revertedWith("Access denied, caller doesn't have role");

                    // ADMIN attempt
                    await expect (
                        saleHandler.connect(admin).changeAudience(
                            consignmentId,
                            Audience.VIP_STAKER
                        )
                    ).to.emit(saleHandler,"AudienceChanged");

                });

                it("close() should require caller has ADMIN role", async function () {

                   // Wait until sale starts and buy
                    await time.increaseTo(start);
                    await saleHandler.connect(buyer).buy(consignmentId, supply, {value: buyOutPrice});

                    // non-ADMIN attempt
                    await expect(
                        saleHandler.connect(associate).close(consignmentId)
                    ).to.be.revertedWith("Access denied, caller doesn't have role");

                    // ADMIN attempt
                    await expect (
                        saleHandler.connect(admin).close(consignmentId)
                    ).to.emit(saleHandler,"SaleEnded");

                });

                it("cancel() should require caller has ADMIN role", async function () {

                    // Wait until sale starts and buy
                    await time.increaseTo(start);
                    await saleHandler.connect(buyer).buy(consignmentId, single, {value: price});

                    // non-ADMIN attempt
                    await expect(
                        saleHandler.connect(associate).cancel(consignmentId)
                    ).to.be.revertedWith("Access denied, caller doesn't have role");

                    // ADMIN attempt
                    await expect (
                        saleHandler.connect(admin).cancel(consignmentId)
                    ).to.emit(saleHandler,"SaleEnded");

                });

            });

        });

        context("Change Events", async function () {

            context("New Sales", async function () {

                context("createSale()", async function () {

                    it("should trigger a ConsignmentRegistered event on MarketController", async function () {

                        // Create sale, test event
                        await expect(
                            saleHandler.connect(seller).createSale(
                                seller.address,
                                tokenAddress,
                                tokenId,
                                start,
                                quantity,
                                price,
                                perTxCap,
                                audience,
                                market
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

                    it("should emit a SalePending event", async function () {

                        // Make change, test event
                        await expect(
                            saleHandler.connect(seller).createSale(
                                seller.address,
                                tokenAddress,
                                tokenId,
                                start,
                                quantity,
                                price,
                                perTxCap,
                                audience,
                                market
                            )
                        ).to.emit(saleHandler, 'SalePending')
                            .withArgs([ // Sale
                                    consignmentId,
                                    start,
                                    quantity,
                                    price,
                                    perTxCap,
                                    ethers.BigNumber.from(State.PENDING),
                                    ethers.BigNumber.from(Outcome.PENDING)
                                ]
                            );
                    });

                });

            });

            context("Existing Sales", async function () {

                beforeEach(async function() {

                    // Lets use secondary market to trigger royalties
                    market = Market.SECONDARY;

                    // SELLER creates secondary market sale
                    await saleHandler.connect(seller).createSale(
                        seller.address,
                        tokenAddress,
                        tokenId,
                        start,
                        quantity,
                        price,
                        perTxCap,
                        audience,
                        market
                    );

                });

                context("changeAudience()", async function () {

                    it("should emit an AudienceChanged event", async function () {

                        // ADMIN attempt
                        await expect(
                            saleHandler.connect(admin).changeAudience(
                                consignmentId,
                                Audience.OPEN
                            )
                        ).to.emit(saleHandler, "AudienceChanged")
                            .withArgs(consignmentId, Audience.OPEN);

                    });

                });

                context("buy()", async function () {

                    beforeEach(async function () {

                        // Wait until sale starts and bid
                        await time.increaseTo(start);

                    });

                    it("should emit a Purchase event", async function () {

                        // Buy and test event
                        await expect(
                            await saleHandler.connect(buyer).buy(consignmentId, single, {value: price})
                        ).to.emit(saleHandler, "Purchase")
                            .withArgs(
                                consignmentId,
                                buyer.address,
                                single
                            );

                    });

                });

                context("close()", async function () {

                    beforeEach(async function () {

                        // Wait until sale starts and bid
                        await time.increaseTo(start);
                        await saleHandler.connect(buyer).buy(consignmentId, supply, {value: buyOutPrice});

                    });

                    it("should emit a SaleEnded event", async function () {

                        // Admin closes sale
                        await expect(
                            saleHandler.connect(admin).close(consignmentId)
                        ).to.emit(saleHandler, "SaleEnded")
                            .withArgs(
                                consignmentId,
                                Outcome.CLOSED
                            );

                    });

                    it("should trigger a SaleEnded event", async function () {

                        // Admin closes sale
                        await expect(
                            saleHandler.connect(admin).close(consignmentId)
                        ).to.emit(saleHandler, "SaleEnded")
                            .withArgs(
                                consignmentId,
                                Outcome.CLOSED
                            );

                    });

                    it("should trigger an PayoutDisbursed event", async function () {

                        // Admin closes sale
                        await expect(
                            saleHandler.connect(admin).close(consignmentId)
                        ).to.emit(saleHandler, "PayoutDisbursed");

                    });

                    it("should trigger an FeeDisbursed event", async function () {

                        // Admin closes sale
                        await expect(
                            saleHandler.connect(admin).close(consignmentId)
                        ).to.emit(saleHandler, "FeeDisbursed");

                    });

                    it("should trigger an RoyaltyDisbursed event for secondary market sales", async function () {

                        // Admin closes sale
                        await expect(
                            saleHandler.connect(admin).close(consignmentId)
                        ).to.emit(saleHandler, "RoyaltyDisbursed");

                    });

                });

                context("cancel()", async function () {

                    beforeEach(async function () {

                        // Wait until sale starts and bid
                        await time.increaseTo(start);
                        await saleHandler.connect(buyer).buy(consignmentId, single, {value: price});

                    });

                    it("should emit an SaleEnded event", async function () {

                        // Admin closes sale
                        await expect(
                            saleHandler.connect(admin).cancel(consignmentId)
                        ).to.emit(saleHandler, "SaleEnded")
                            .withArgs(
                                consignmentId,
                                Outcome.CANCELED
                            );

                    });

                });

            });

        });

        context("Funds Distribution", async function () {

            context("Primary Market", async function () {

                beforeEach(async function () {

                    // SELLER creates primary market sale
                    market = Market.PRIMARY;
                    await saleHandler.connect(seller).createSale(
                        seller.address,
                        tokenAddress,
                        tokenId,
                        start,
                        quantity,
                        price,
                        perTxCap,
                        audience,
                        market
                    );

                    // Wait until sale starts and bid
                    await time.increaseTo(start);
                    await saleHandler.connect(buyer).buy(consignmentId, supply, {value: buyOutPrice});

                    // Calculate the expected distribution of funds
                    grossSale = ethers.BigNumber.from(buyOutPrice);
                    feeAmount = grossSale.mul(feePercentage).div("10000");
                    multisigAmount = feeAmount.div("2");
                    stakingAmount = feeAmount.div("2");
                    sellerAmount = grossSale.sub(feeAmount);

                });

                it("multisig contract should be sent half the marketplace fee based on gross", async function () {

                    // Admin closes sale
                    await expect(
                        saleHandler.connect(admin).close(consignmentId)
                    ).to.emit(saleHandler, "FeeDisbursed")
                        .withArgs(consignmentId, multisig.address, multisigAmount);

                });

                it("staking contract should be sent half the marketplace fee based on gross", async function () {

                    // Admin closes sale
                    await expect(
                        saleHandler.connect(admin).close(consignmentId)
                    ).to.emit(saleHandler, "FeeDisbursed")
                        .withArgs(consignmentId, staking.address, stakingAmount);

                });

                it("seller should be sent remainder after marketplace fee", async function () {

                    // Admin closes sale
                    await expect(
                        saleHandler.connect(admin).close(consignmentId)
                    ).to.emit(saleHandler, "PayoutDisbursed")
                        .withArgs(consignmentId, seller.address, sellerAmount);

                });

            });

            context("Secondary Market", async function () {

                beforeEach(async function () {

                    // SELLER creates secondary market sale
                    market = Market.SECONDARY;
                    await saleHandler.connect(seller).createSale(
                        seller.address,
                        tokenAddress,
                        tokenId,
                        start,
                        quantity,
                        price,
                        perTxCap,
                        audience,
                        market
                    );

                    // Wait until sale starts and bid
                    await time.increaseTo(start);
                    await saleHandler.connect(buyer).buy(consignmentId, supply, {value: buyOutPrice});

                    // Calculate the expected distribution of funds
                    grossSale = ethers.BigNumber.from(buyOutPrice);
                    royaltyAmount = grossSale.mul(royaltyPercentage).div("10000");
                    netAfterRoyalties = grossSale.sub(royaltyAmount);
                    feeAmount = netAfterRoyalties.mul(feePercentage).div("10000");
                    multisigAmount = feeAmount.div("2");
                    stakingAmount = feeAmount.div("2");
                    sellerAmount = netAfterRoyalties.sub(feeAmount);

                });

                it("creator should receive royalty based on gross sale amount", async function () {

                    // Admin closes sale
                    await expect(
                        saleHandler.connect(admin).close(consignmentId)
                    ).to.emit(saleHandler, "RoyaltyDisbursed")
                        .withArgs(consignmentId, creator.address, royaltyAmount);

                });

                it("multisig contract should be sent half the marketplace fee based on net after royalty", async function () {

                    // Admin closes sale
                    await expect(
                        saleHandler.connect(admin).close(consignmentId)
                    ).to.emit(saleHandler, "FeeDisbursed")
                        .withArgs(consignmentId, multisig.address, multisigAmount);

                });

                it("staking contract should be sent half the marketplace fee based on net after royalty", async function () {

                    // Admin closes sale
                    await expect(
                        saleHandler.connect(admin).close(consignmentId)
                    ).to.emit(saleHandler, "FeeDisbursed")
                        .withArgs(consignmentId, staking.address, stakingAmount);

                });

                it("seller should be sent remainder after royalty and fee", async function () {

                    // Admin closes sale
                    await expect(
                        saleHandler.connect(admin).close(consignmentId)
                    ).to.emit(saleHandler, "PayoutDisbursed")
                        .withArgs(consignmentId, seller.address, sellerAmount);

                });

            });

        })

        context("Asset Transfers", async function () {

            context("New Sales", async function () {

                it("createSale() should transfer token to SaleHandler contract", async function () {

                    // Seller balance of token
                    sellerBalance = await seenHausNFT.balanceOf(seller.address, tokenId);

                    // SELLER creates sale
                    await saleHandler.connect(seller).createSale(
                        seller.address,
                        tokenAddress,
                        tokenId,
                        start,
                        quantity,
                        price,
                        perTxCap,
                        audience,
                        market
                    );

                    // Contract should now own the balance of the token
                    contractBalance = await seenHausNFT.balanceOf(seenHausNFT.address, tokenId);
                    expect(contractBalance.eq(sellerBalance));

                    // Seller balance after creating sale (balance is one item per sale)
                    newBalance = await seenHausNFT.balanceOf(seller.address, tokenId);
                    expect(sellerBalance.sub(supply).eq(newBalance));

                });

            });

            context("Existing Sales", async function () {

                beforeEach(async function() {

                    // SELLER creates sale for digital
                    await saleHandler.connect(seller).createSale(
                        seller.address,
                        tokenAddress,
                        tokenId,
                        start,
                        quantity,
                        price,
                        perTxCap,
                        audience,
                        market
                    );

                    // SELLER creates sale for physical
                    physicalConsignmentId = await marketController.getNextConsignment();
                    await saleHandler.connect(seller).createSale(
                        seller.address,
                        tokenAddress,
                        physicalTokenId,
                        start,
                        quantity,
                        price,
                        perTxCap,
                        audience,
                        market
                    );

                });

                context("close()", async function () {

                    beforeEach(async function () {

                        // Wait until sales start and bid
                        await time.increaseTo(start);
                        await saleHandler.connect(buyer).buy(consignmentId, supply, {value: buyOutPrice});
                        await saleHandler.connect(buyer).buy(physicalConsignmentId, supply, {value: buyOutPrice});

                    });

                    it("should transfer consigned balance of token to buyer if digital", async function () {

                        // Get contract balance of token
                        contractBalance = await seenHausNFT.balanceOf(seenHausNFT.address, tokenId);

                        // Admin closes sale
                        await saleHandler.connect(admin).close(consignmentId);

                        // Get contract's new balance of token
                        newBalance = await seenHausNFT.balanceOf(seenHausNFT.address, tokenId);
                        expect(contractBalance.sub(supply).eq(newBalance));

                        // Get buyer's new balance of token
                        buyerBalance = await seenHausNFT.balanceOf(buyer.address, tokenId);
                        expect(buyerBalance.eq(contractBalance));

                    });

                    it("should transfer consigned balance of token to escrow ticketer if physical", async function () {

                        // Get the escrow ticketer to use
                        escrowTicketer = await marketController.getEscrowTicketer(physicalConsignmentId);

                        // Get contract balance of token
                        contractBalance = await seenHausNFT.balanceOf(seenHausNFT.address, physicalTokenId);

                        // Admin closes sale
                        await saleHandler.connect(admin).close(physicalConsignmentId);

                        // Get contract's new balance of token
                        newBalance = await seenHausNFT.balanceOf(seenHausNFT.address, physicalTokenId);
                        expect(contractBalance.sub(supply).eq(newBalance));

                        // Get escrow ticketer's new balance of token
                        ticketerBalance = await seenHausNFT.balanceOf(escrowTicketer, physicalTokenId);
                        expect(buyerBalance.eq(contractBalance));

                    });

                    it("should transfer a escrow ticket to buyer if physical", async function () {

                        // Get the escrow ticketer to use
                        escrowTicketer = await marketController.getEscrowTicketer(physicalConsignmentId);

                        // Get contract balance of token
                        contractBalance = await seenHausNFT.balanceOf(seenHausNFT.address, physicalTokenId);

                        // Admin closes sale
                        await saleHandler.connect(admin).close(physicalConsignmentId);

                        // Get contract's new balance of escrow ticket
                        buyerBalance = await seenHausNFT.balanceOf(seenHausNFT.address, physicalTokenId);
                        expect(contractBalance.sub(supply).eq(newBalance));

                        // Get escrow ticketer's new balance of token
                        ticketerBalance = await seenHausNFT.balanceOf(escrowTicketer, physicalTokenId);
                        expect(buyerBalance.eq(contractBalance));

                    });

                });

                context("cancel()", async function () {

                    beforeEach(async function () {

                        // Wait until sale starts and bid
                        await time.increaseTo(start);
                        await saleHandler.connect(buyer).buy(consignmentId, single, {value: price});

                    });

                    it("should transfer consigned balance of token to seller if digital", async function () {

                        // Admin pulls sale with no bids
                        await saleHandler.connect(admin).cancel(consignmentId);

                        // Get contract's new balance of token
                        newBalance = await seenHausNFT.balanceOf(seenHausNFT.address, tokenId);
                        expect(contractBalance.sub(supply).eq(newBalance));

                        // Get seller's new balance of token
                        sellerBalance = await seenHausNFT.balanceOf(seller.address, tokenId);
                        expect(buyerBalance.eq(contractBalance));

                    });

                    it("should transfer consigned balance of token to seller if physical", async function () {

                        // Admin pulls sale with no bids
                        await saleHandler.connect(admin).cancel(physicalConsignmentId);

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