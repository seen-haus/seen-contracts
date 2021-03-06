const hre = require("hardhat");
const ethers = hre.ethers;
const { expect } = require("chai");
const { time } = require('@openzeppelin/test-helpers');

const Role = require("../../scripts/domain/Role");
const Sale = require("../../scripts/domain/Sale");
const State = require("../../scripts/domain/State");
const Market = require("../../scripts/domain/Market");
const MarketHandler = require("../../scripts/domain/MarketHandler");
const Outcome = require("../../scripts/domain/Outcome");
const Audience = require("../../scripts/domain/Audience");
const Ticketer = require("../../scripts/domain/Ticketer");
const Consignment = require("../../scripts/domain/Consignment");
const { InterfaceIds } = require('../../scripts/constants/supported-interfaces.js');
const { deployMarketDiamond } = require('../../scripts/util/deploy-market-diamond.js');
const { deployMarketClients } = require("../../scripts/util/deploy-market-clients.js");
const { deployMarketHandlerFacets } = require('../../scripts/util/deploy-market-handler-facets.js');
const { deployMarketControllerFacets } = require('../../scripts/util/deploy-market-controller-facets.js');

/**
 *  Test the SaleHandler facets (SaleBuilder, SaleRunner)
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
describe("SaleHandler", function() {

    // Common vars
    let accounts, deployer, admin, upgrader, creator, associate, seller, minter, buyer, escrowAgent;
    let accessController, marketController, saleHandler;
    let lotsTicketer, itemsTicketer, seenHausNFT;
    let Foreign721, foreign721;
    let Foreign1155, foreign1155;
    let SeenStaking, seenStaking;
    let multisig, vipStakerAmount, primaryFeePercentage, secondaryFeePercentage, maxRoyaltyPercentage, outBidPercentage, defaultTicketerType;
    let market, tokenAddress, tokenId, tokenURI, sale, physicalTokenId, physicalConsignmentId, consignmentId, nextConsignment, block, blockNumber;
    let royaltyPercentage, supply, start, quantity, price, perTxCap, audience, escrowTicketer;
    let royaltyAmount, sellerAmount, feeAmount, multisigAmount, stakingAmount, grossSale, netAfterRoyalties, consignment;
    let royaltyAmountWithCustomFee, sellerAmountWithCustomFee, feeAmountWithCustomFee, multisigAmountWithCustomFee, stakingAmountWithCustomFee, grossSaleWithCustomFee;
    let sellerBalance, contractBalance, buyerBalance, ticketerBalance, newBalance, buyOutPrice, single, badStartTime, halfSupply, signer;

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
        buyer = accounts[6];
        escrowAgent = accounts[7];
        seller = accounts[8];

        multisig = accounts[9];               // We just need addresses for these, not functional contracts

        // Market control values
        vipStakerAmount = "500";                // Amount of xSEEN to be VIP
        customFeePercentageBasisPoints = "2000" // 20%   = 2000
        primaryFeePercentage = "500";           // 5%    = 500
        secondaryFeePercentage = "250";         // 2.5%  = 250
        maxRoyaltyPercentage = "5000";          // 50%   = 5000
        outBidPercentage = "500";               // 5%    = 500
        defaultTicketerType = Ticketer.LOTS;    // default escrow ticketer type
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
        saleHandler = await ethers.getContractAt('ISaleHandler', marketDiamond.address);

        // Deploy the Market Client implementation/proxy pairs
        const marketClientArgs = [accessController.address, marketController.address];
        [impls, proxies, clients] = await deployMarketClients(marketClientArgs);
        [lotsTicketer, itemsTicketer, seenHausNFT] = clients;

        // Escrow Ticketer and NFT addresses get set after deployment since
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

        // Grant UPGRADER role to upgrader account
        await accessController.connect(admin).grantRole(Role.UPGRADER, upgrader.address);

        // Grant MARKET_HANDLER to SeenHausNFT and SaleHandler
        await accessController.connect(admin).grantRole(Role.MARKET_HANDLER, seenHausNFT.address);
        await accessController.connect(admin).grantRole(Role.MARKET_HANDLER, saleHandler.address);
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

            it("should indicate support for ISaleHandler interface", async function () {

                // Current interfaceId for ISaleHandler
                support = await marketController.supportsInterface(InterfaceIds.ISaleHandler);

                // Test
                await expect(
                    support,
                    "ISaleHandler interface not supported"
                ).is.true;

            });

            it("should indicate support for ISaleBuilder interface", async function () {

                // Current interfaceId for ISaleBuilder
                support = await marketController.supportsInterface(InterfaceIds.ISaleBuilder);

                // Test
                await expect(
                    support,
                    "ISaleBuilder interface not supported"
                ).is.true;

            });

            it("should indicate support for ISaleRunner interface", async function () {

                // Current interfaceId for ISaleRunner
                support = await marketController.supportsInterface(InterfaceIds.ISaleRunner);

                // Test
                await expect(
                    support,
                    "ISaleRunner interface not supported"
                ).is.true;

            });

            it("should indicate support for ISaleEnder interface", async function () {

                // Current interfaceId for ISaleEnder
                support = await marketController.supportsInterface(InterfaceIds.ISaleEnder);

                // Test
                await expect(
                    support,
                    "ISaleEnder interface not supported"
                ).is.true;

            });

        });

    });

    context("Managing Sales", async function () {

        beforeEach( async function () {

            // Prepare for roled access to privileged methods
            // Grant seller both SELLER and MINTER to avoid the need for transferring minted token balance from seller to minter
            // This would be true of an artist who has been given the ability to mint and to create sales and sales
            await accessController.connect(admin).grantRole(Role.SELLER, seller.address);
            await accessController.connect(admin).grantRole(Role.MINTER, seller.address);

            // Escrow Agent needs to mint and market escrowed physical items
            await accessController.connect(admin).grantRole(Role.SELLER, escrowAgent.address);
            await accessController.connect(admin).grantRole(Role.ESCROW_AGENT, escrowAgent.address);

            // Seller approves SaleHandler contract to transfer their tokens
            await foreign721.connect(seller).setApprovalForAll(saleHandler.address, true);
            await foreign1155.connect(seller).setApprovalForAll(saleHandler.address, true);
            await seenHausNFT.connect(seller).setApprovalForAll(saleHandler.address, true);

            // Associate approves SaleHandler contract to transfer their tokens
            await foreign721.connect(associate).setApprovalForAll(saleHandler.address, true);
            await foreign1155.connect(associate).setApprovalForAll(saleHandler.address, true);
            await seenHausNFT.connect(associate).setApprovalForAll(saleHandler.address, true);

            // Mint a balance of 50 of the token for sale
            tokenURI = "ipfs://QmXBB6qm5vopwJ6ddxb1mEr1Pp87AHd3BUgVbsipCf9hWU";
            supply = "50";
            royaltyPercentage = maxRoyaltyPercentage;

            // Seller creates digital token
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
            price = ethers.utils.parseUnits("1", "ether");
            quantity = supply;
            perTxCap = supply;
            audience = Audience.OPEN;
            buyOutPrice = price.mul(ethers.BigNumber.from(quantity)).toString();
            single = "1";

        });

        context("Privileged Access", async function () {

            context("New Sales", async function () {

                context("createPrimarySale()", async function () {

                    it("should require caller has SELLER role", async function () {

                        // Get next consignment
                        nextConsignment = await marketController.getNextConsignment();

                        // non-SELLER attempt
                        await expect(
                            saleHandler.connect(associate).createPrimarySale(
                                consignmentId,
                                start,
                                price,
                                perTxCap,
                                audience
                            )
                        ).to.be.revertedWith("Caller doesn't have role");

                        // Test
                        expect(
                            (await marketController.getNextConsignment()).eq(nextConsignment),
                            "non-SELLER can create an sale"
                        ).is.true;

                        // SELLER attempt
                        await saleHandler.connect(seller).createPrimarySale(
                            consignmentId,
                            start,
                            price,
                            perTxCap,
                            audience
                        );

                        // Get next consignment
                        nextConsignment = await marketController.getNextConsignment();

                        // Test
                        expect(
                            nextConsignment.gt(consignmentId),
                            "SELLER can't create an sale"
                        ).is.true;

                    });

                    it("should require caller is the original asset consignor", async function () {

                        // Creator transfers all their tokens to seller
                        await foreign1155.connect(creator).safeTransferFrom(creator.address, seller.address, tokenId, supply, []);

                        // Token is on a foreign contract
                        tokenAddress = foreign1155.address;

                        // Get next consignment
                        nextConsignment = await marketController.getNextConsignment();

                        // Grant SELLER role to address that is not consignor
                        await accessController.connect(admin).grantRole(Role.SELLER, associate.address);

                        // SELLER who is not original consignor attempts to create primary sale
                        await expect(
                            saleHandler.connect(associate).createPrimarySale(
                                consignmentId,
                                start,
                                price,
                                perTxCap,
                                audience
                            )
                        ).to.be.revertedWith("Caller is not consignor");

                        // Test
                        expect(
                            (await marketController.getNextConsignment()).eq(nextConsignment),
                            "SELLER who is not consignor can create a sale"
                        ).is.true;

                        // SELLER attempt
                        await saleHandler.connect(seller).createPrimarySale(
                            consignmentId,
                            start,
                            price,
                            perTxCap,
                            audience
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

                context("createSecondarySale()", async function () {

                    it("should fail if external tokens are not allowed to be listed on secondary", async function () {

                        // Get the next consignment id
                        consignmentId = await marketController.getNextConsignment();

                        // Creator transfers all their tokens to seller
                        await foreign721.connect(creator).transferFrom(creator.address, seller.address, tokenId);

                        await marketController.connect(admin).setAllowExternalTokensOnSecondary(false);

                        // Seller sends tokens to associate address
                        await foreign721.connect(seller).transferFrom(seller.address, associate.address, tokenId);

                        await expect(
                            saleHandler.connect(associate).createSecondarySale(
                                seller.address,
                                foreign721.address,
                                tokenId,
                                start,
                                "1",
                                price,
                                perTxCap,
                                audience
                            )
                        ).to.be.revertedWith("Listing external tokens is not currently enabled");

                        await marketController.connect(admin).setAllowExternalTokensOnSecondary(true);

                        // Make change, test event
                        await expect(
                            saleHandler.connect(associate).createSecondarySale(
                                seller.address,
                                foreign721.address,
                                tokenId,
                                start,
                                "1",
                                price,
                                perTxCap,
                                audience
                            )
                        ).to.emit(saleHandler, 'SalePending')
                            .withArgs(
                                associate.address, // consignor
                                seller.address,    // seller
                                [ // Sale
                                    consignmentId,
                                    start,
                                    price,
                                    perTxCap,
                                    ethers.BigNumber.from(State.PENDING),
                                    ethers.BigNumber.from(Outcome.PENDING)
                                ]
                            );



                    });

                    it("should require caller has ESCROW_AGENT role if listing a physical NFT", async function () {

                        let buyerBalance = await seenHausNFT.balanceOf(buyer.address, physicalTokenId);
                        expect(buyerBalance.eq(0));

                        await saleHandler.connect(escrowAgent).createPrimarySale(
                            physicalConsignmentId,
                            start,
                            price,
                            perTxCap,
                            audience
                        );

                        await time.increaseTo(start);

                        let ticketId = await lotsTicketer.getNextTicket();

                        await expect(
                            await saleHandler.connect(buyer).buy(physicalConsignmentId, perTxCap, {value: ethers.BigNumber.from(price).mul(ethers.BigNumber.from(perTxCap)).toString()})
                        ).to.emit(saleHandler, "Purchase")

                        buyerBalance = await seenHausNFT.balanceOf(buyer.address, physicalTokenId);
                        expect(buyerBalance.eq(0));

                        // Buyer closes sale
                        await expect(
                            await saleHandler.connect(buyer).closeSale(physicalConsignmentId)
                        ).to.emit(saleHandler, "SaleEnded")
                            .withArgs(
                                physicalConsignmentId,
                                Outcome.CLOSED
                            );
                        
                        await expect(
                            lotsTicketer.connect(buyer).claim(ticketId)
                        ).to.emit(marketController, 'ConsignmentReleased')
                            .withArgs(
                                physicalConsignmentId,
                                supply,
                                buyer.address
                            );
                        buyerBalance = await seenHausNFT.balanceOf(buyer.address, physicalTokenId);
                        expect(buyerBalance.eq(perTxCap));

                        // non-ESCROW_AGENT attempt
                        await expect(
                            saleHandler.connect(buyer).createSecondarySale(
                                escrowAgent.address,
                                tokenAddress,
                                physicalTokenId,
                                start,
                                supply,
                                price,
                                perTxCap,
                                audience
                            )
                        ).to.be.revertedWith("Physical NFT secondary listings require ESCROW_AGENT role");

                        // Transfer physical tokens to escrow agent
                        await seenHausNFT.connect(buyer).safeTransferFrom(
                            buyer.address,
                            escrowAgent.address,
                            physicalTokenId,
                            supply,
                            0x0
                        );

                        let escrowAgentBalance = await seenHausNFT.balanceOf(escrowAgent.address, physicalTokenId);
                        expect(escrowAgentBalance.eq(supply));

                        await seenHausNFT.connect(escrowAgent).setApprovalForAll(saleHandler.address, true);

                        let latestTime = await time.latest();
                        start = ethers.BigNumber.from(latestTime.toString()).add('900').toString(); // 15 minutes from latest block

                        // ESCROW_AGENT attempt
                        await expect(
                            saleHandler.connect(escrowAgent).createSecondarySale(
                                escrowAgent.address,
                                tokenAddress,
                                physicalTokenId,
                                start,
                                supply,
                                price,
                                perTxCap,
                                audience
                            )
                        ).to.emit(saleHandler, 'SalePending')
                    });

                });

            });

            context("Existing Sales", async function () {

                beforeEach(async function() {

                    // SELLER creates sale
                    await saleHandler.connect(seller).createPrimarySale(
                        consignmentId,
                        start,
                        price,
                        perTxCap,
                        audience
                    );

                });

                it("changeAudience() should require caller has ADMIN role", async function () {

                    // non-ADMIN attempt
                    await expect(
                        saleHandler.connect(associate).changeSaleAudience(
                            consignmentId,
                            Audience.VIP_STAKER
                        )
                    ).to.be.revertedWith("Caller doesn't have role");

                    // ADMIN attempt
                    await expect (
                        saleHandler.connect(admin).changeSaleAudience(
                            consignmentId,
                            Audience.VIP_STAKER
                        )
                    ).to.emit(saleHandler,"AudienceChanged");

                });

                it("cancelSale() should require caller has ADMIN role or is Consigner - Testing ADMIN", async function () {

                    // Wait until sale starts and buy
                    await time.increaseTo(start);
                    await saleHandler.connect(buyer).buy(consignmentId, single, {value: price});

                    // non-ADMIN attempt
                    await expect(
                        saleHandler.connect(associate).cancelSale(consignmentId)
                    ).to.be.revertedWith("Caller doesn't have role or is not consignor");

                    // ADMIN attempt
                    await expect (
                        saleHandler.connect(admin).cancelSale(consignmentId)
                    ).to.emit(saleHandler,"SaleEnded");

                });

                it("cancelSale() should require caller has ADMIN role or is Consigner - Testing Consignor", async function () {

                    // Wait until sale starts and buy
                    await time.increaseTo(start);
                    await saleHandler.connect(buyer).buy(consignmentId, single, {value: price});

                    // non-ADMIN attempt
                    await expect(
                        saleHandler.connect(associate).cancelSale(consignmentId)
                    ).to.be.revertedWith("Caller doesn't have role or is not consignor");

                    // ADMIN attempt
                    await expect (
                        saleHandler.connect(seller).cancelSale(consignmentId)
                    ).to.emit(saleHandler,"SaleEnded");

                });

            });

        });

        context("Change Events", async function () {

            context("New Sales", async function () {

                context("createPrimarySale()", async function () {

                    it("should emit a SalePending event", async function () {

                        // Give associate SELLER role
                        await accessController.connect(admin).grantRole(Role.SELLER, associate.address);

                        // Make change, test event
                        await expect(
                            saleHandler.connect(seller).createPrimarySale(
                                consignmentId,
                                start,
                                price,
                                perTxCap,
                                audience
                            )
                        ).to.emit(saleHandler, 'SalePending')
                            .withArgs(
                                seller.address, // consignor
                                seller.address,    // seller
                                [ // Sale
                                    consignmentId,
                                    start,
                                    price,
                                    perTxCap,
                                    ethers.BigNumber.from(State.PENDING),
                                    ethers.BigNumber.from(Outcome.PENDING)
                                ]
                            );
                    });

                });

                context("createSecondarySale()", async function () {

                    context("Foreign ERC-721", async function () {

                        beforeEach(async function () {

                            // Creator transfers all their tokens to seller
                            await foreign721.connect(creator).transferFrom(creator.address, seller.address, tokenId);

                            // Seller transfers all their tokens to associate
                            await foreign721.connect(seller).transferFrom(seller.address, associate.address, tokenId);

                            // Get the next consignment id
                            consignmentId = await marketController.getNextConsignment();

                            // Token is on a foreign contract
                            tokenAddress = foreign721.address;

                            // Give associate SELLER role
                            await accessController.connect(admin).grantRole(Role.SELLER, associate.address);

                            // Supply of one for 721
                            supply = "1";

                        });

                        it("should emit a SalePending event", async function () {

                            // Make change, test event
                            await expect(
                                saleHandler.connect(associate).createSecondarySale(
                                    seller.address,
                                    tokenAddress,
                                    tokenId,
                                    start,
                                    supply,
                                    price,
                                    perTxCap,
                                    audience
                                )
                            ).to.emit(saleHandler, 'SalePending')
                                .withArgs(
                                    associate.address, // consignor
                                    seller.address,    // seller
                                    [ // Sale
                                        consignmentId,
                                        start,
                                        price,
                                        perTxCap,
                                        ethers.BigNumber.from(State.PENDING),
                                        ethers.BigNumber.from(Outcome.PENDING)
                                    ]
                                );
                        });

                        it("should trigger a ConsignmentRegistered event on MarketController", async function () {

                            // Create sale, test event
                            await expect(
                                saleHandler.connect(associate).createSecondarySale(
                                    seller.address,
                                    tokenAddress,
                                    tokenId,
                                    start,
                                    supply,
                                    price,
                                    perTxCap,
                                    audience
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

                        it("should trigger a ConsignmentMarketed event on MarketController", async function () {

                            // Create sale, test event
                            await expect(
                                saleHandler.connect(associate).createSecondarySale(
                                    seller.address,
                                    tokenAddress,
                                    tokenId,
                                    start,
                                    supply,
                                    price,
                                    perTxCap,
                                    audience
                                )
                            ).emit(marketController, 'ConsignmentMarketed')
                                .withArgs(
                                    associate.address,
                                    seller.address,
                                    consignmentId
                                )

                        });

                    });

                    context("Foreign ERC-1155", async function () {

                        beforeEach(async function () {

                            // Creator transfers all their tokens to seller
                            await foreign1155.connect(creator).safeTransferFrom(creator.address, seller.address, tokenId, supply, []);

                            // Creator transfers all their tokens to seller
                            await foreign1155.connect(seller).safeTransferFrom(seller.address, associate.address, tokenId, supply, []);

                            // Get the next consignment id
                            consignmentId = await marketController.getNextConsignment();

                            // Token is on a foreign contract
                            tokenAddress = foreign1155.address;

                            // Give associate SELLER role
                            await accessController.connect(admin).grantRole(Role.SELLER, associate.address);

                        });

                        it("should emit a SalePending event", async function () {

                            // Make change, test event
                            await expect(
                                saleHandler.connect(associate).createSecondarySale(
                                    seller.address,
                                    tokenAddress,
                                    tokenId,
                                    start,
                                    supply,
                                    price,
                                    perTxCap,
                                    audience
                                )
                            ).to.emit(saleHandler, 'SalePending')
                                .withArgs(
                                    associate.address, // consignor
                                    seller.address,    // seller
                                    [ // Sale
                                        consignmentId,
                                        start,
                                        price,
                                        perTxCap,
                                        ethers.BigNumber.from(State.PENDING),
                                        ethers.BigNumber.from(Outcome.PENDING)
                                    ]
                                );
                        });

                        it("should trigger a ConsignmentRegistered event on MarketController", async function () {

                            // Create sale, test event
                            await expect(
                                saleHandler.connect(associate).createSecondarySale(
                                    seller.address,
                                    tokenAddress,
                                    tokenId,
                                    start,
                                    supply,
                                    price,
                                    perTxCap,
                                    audience
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

                        it("should trigger a ConsignmentMarketed event on MarketController", async function () {

                            // Create sale, test event
                            await expect(
                                saleHandler.connect(associate).createSecondarySale(
                                    seller.address,
                                    tokenAddress,
                                    tokenId,
                                    start,
                                    supply,
                                    price,
                                    perTxCap,
                                    audience
                                )
                            ).emit(marketController, 'ConsignmentMarketed')
                                .withArgs(
                                    associate.address,
                                    seller.address,
                                    consignmentId
                                )

                        });

                    });

                });

            });

            context("Existing Sales", async function () {

                beforeEach(async function() {

                    // Creator transfers all their tokens to seller
                    await foreign1155.connect(creator).safeTransferFrom(creator.address, seller.address, tokenId, supply, []);

                    // Get the next consignment id
                    consignmentId = await marketController.getNextConsignment();

                    // Token is on a foreign contract
                    tokenAddress = foreign1155.address;

                    // SELLER creates secondary market sale
                    await saleHandler.connect(seller).createSecondarySale(
                        seller.address,
                        tokenAddress,
                        tokenId,
                        start,
                        quantity,
                        price,
                        perTxCap,
                        audience
                    );

                });

                context("changeAudience()", async function () {

                    it("should emit an AudienceChanged event", async function () {

                        // ADMIN attempt
                        await expect(
                            saleHandler.connect(admin).changeSaleAudience(
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
                                single,
                                price
                            );

                    });

                    it("should emit a TokenHistoryTracker event", async function () {

                        // Buy and test event
                        await expect(
                            await saleHandler.connect(buyer).buy(consignmentId, single, {value: price})
                        ).to.emit(saleHandler, "TokenHistoryTracker")
                            .withArgs(
                                tokenAddress,
                                tokenId,
                                buyer.address,
                                price,
                                single,
                                consignmentId,
                            );

                    });

                });

                context("closeSale()", async function () {

                    beforeEach(async function () {

                        // Wait until sale starts and bid
                        await time.increaseTo(start);
                        await saleHandler.connect(buyer).buy(consignmentId, supply, {value: buyOutPrice});

                    });

                    it("should emit a SaleEnded event", async function () {

                        // Seller closes sale
                        await expect(
                            saleHandler.connect(seller).closeSale(consignmentId)
                        ).to.emit(saleHandler, "SaleEnded")
                            .withArgs(
                                consignmentId,
                                Outcome.CLOSED
                            );

                    });

                    it("should trigger an PayoutDisbursed event", async function () {

                        // Seller closes sale
                        await expect(
                            saleHandler.connect(seller).closeSale(consignmentId)
                        ).to.emit(saleHandler, "PayoutDisbursed");

                    });

                    it("should trigger an FeeDisbursed event", async function () {

                        // Seller closes sale
                        await expect(
                            saleHandler.connect(seller).closeSale(consignmentId)
                        ).to.emit(saleHandler, "FeeDisbursed");

                    });

                    it("should trigger an RoyaltyDisbursed event for secondary market sales", async function () {

                        // Seller closes sale
                        await expect(
                            saleHandler.connect(seller).closeSale(consignmentId)
                        ).to.emit(saleHandler, "RoyaltyDisbursed");

                    });

                });

                context("cancelSale()", async function () {

                    beforeEach(async function () {

                        // Wait until sale starts and bid
                        await time.increaseTo(start);
                        await saleHandler.connect(buyer).buy(consignmentId, single, {value: price});

                    });

                    it("should emit a SaleEnded event", async function () {

                        // Seller closes sale
                        await expect(
                            saleHandler.connect(admin).cancelSale(consignmentId)
                        ).to.emit(saleHandler, "SaleEnded")
                            .withArgs(
                                consignmentId,
                                Outcome.CANCELED
                            );

                    });

                });

            });

        });

        context("Market Handler Assignment", async function () {

            context("Primary Market Sale", async function () {

                it("Assigns a marketHandler of Sale to a consignment immediately after createPrimarySale", async function () {
                    // Get the consignment id
                    consignmentId = await marketController.getNextConsignment();

                    // Mint new token on seenHausNFT contract
                    tokenId = await seenHausNFT.getNextToken();
                    await seenHausNFT.connect(seller).mintDigital(supply, seller.address, tokenURI, royaltyPercentage);

                    // Seller creates sale
                    await saleHandler.connect(seller).createPrimarySale(
                        consignmentId,
                        start,
                        price,
                        perTxCap,
                        audience
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

                    // Consignment should have a market handler of MarketHandler.Sale
                    expect(consignment.marketHandler === MarketHandler.SALE).is.true;
                })

            })

            context("Secondary Market Sale", async function () {
                it("Assigns a marketHandler of Sale to a consignment immediately after createSecondarySale", async function () {
                    // Token is on a foreign contract
                    tokenAddress = foreign1155.address;

                    // Creator transfers all their tokens to seller
                    await foreign1155.connect(creator).safeTransferFrom(creator.address, seller.address, tokenId, supply, []);

                    // Get the consignment id
                    consignmentId = await marketController.getNextConsignment();

                    // Seller creates auction
                    await saleHandler.connect(seller).createSecondarySale(
                        seller.address,
                        tokenAddress,
                        tokenId,
                        start,
                        quantity,
                        price,
                        perTxCap,
                        audience
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
                    expect(consignment.marketHandler === MarketHandler.SALE).is.true;
                });
            })

        })

        context("Sale Behavior", async function () {

            beforeEach(async function() {

                // Creator transfers all their tokens to seller
                await foreign1155.connect(creator).safeTransferFrom(creator.address, seller.address, tokenId, supply, []);

                // Get the next consignment id
                consignmentId = await marketController.getNextConsignment();

                // Token is on a foreign contract
                tokenAddress = foreign1155.address;

                // SELLER creates secondary market sale
                await saleHandler.connect(seller).createSecondarySale(
                    seller.address,
                    tokenAddress,
                    tokenId,
                    start,
                    quantity,
                    price,
                    perTxCap,
                    audience
                );

                // Fast forward to auction start time
                await time.increaseTo(start);

            });

            context("Existing Sales", async function () {

                it("should allow buy if audience is STAKER and buyer is a staker", async function () {

                    // Set the audience to STAKER
                    saleHandler.connect(admin).changeSaleAudience(
                        consignmentId,
                        Audience.STAKER
                    );

                    // Set non-zero staking amount for buyer
                    await seenStaking.setStakerBalance(buyer.address, "1");

                    // Try to buy
                    await expect(
                        saleHandler.connect(buyer).buy(consignmentId, single, {value: price})
                    ).to.emit(saleHandler, "Purchase");

                });

                it("should allow buy if audience is VIP_STAKER and buyer is not a VIP staker", async function () {

                    // Set the audience to STAKER
                    saleHandler.connect(admin).changeSaleAudience(
                        consignmentId,
                        Audience.STAKER
                    );

                    // Set non-zero staking amount for buyer
                    await seenStaking.setStakerBalance(buyer.address, vipStakerAmount);

                    // Try to buy
                    await expect(
                        saleHandler.connect(buyer).buy(consignmentId, single, {value: price})
                    ).to.emit(saleHandler, "Purchase");

                });

            });

        });

        context("Revert Reasons", async function () {

            context("New Sales", async function () {

                context("createPrimarySale()", async function () {

                    it("should revert if Consignment has already been marketed", async function () {

                        // Create a sale
                        await saleHandler.connect(seller).createPrimarySale(
                                consignmentId,
                                start,
                                price,
                                perTxCap,
                                audience
                            );

                        // Try to create another sale with same consignment
                        await expect(
                            saleHandler.connect(seller).createPrimarySale(
                                consignmentId,
                                start,
                                price,
                                perTxCap,
                                audience
                            )
                        ).to.be.revertedWith("Consignment has already been marketed");

                    });

                    it("should revert if caller isn't the asset consignor", async function () {

                        // Grant SELLER role to associate, who did not mint the original token
                        await accessController.connect(admin).grantRole(Role.SELLER, associate.address);

                        // Associate attempts to create primary auction, expect revert
                        await expect(
                            saleHandler.connect(associate).createPrimarySale(
                                consignmentId,
                                start,
                                price,
                                perTxCap,
                                audience
                            )
                        ).to.be.revertedWith("Caller is not consignor");

                    });

                    it("should revert if consignment does not exist", async function () {

                        // A non-existent consignment
                        consignmentId = marketController.getNextConsignment();

                        // Create auction, expect revert
                        await expect(
                            saleHandler.connect(seller).createPrimarySale(
                                consignmentId,
                                start,
                                price,
                                perTxCap,
                                audience
                            )
                        ).to.be.revertedWith("Consignment does not exist");

                    });

                });

                context("createSecondarySale()", async function () {

                    beforeEach(async function () {

                        // Creator transfers all their tokens to seller
                        await foreign1155.connect(creator).safeTransferFrom(creator.address, seller.address, tokenId, supply, []);

                        // Token is on a foreign contract
                        tokenAddress = foreign1155.address;

                    });

                    it("should revert if contract doesn't have approval to transfer seller's tokens", async function () {

                        // Seller un-approves AuctionHandler contract to transfer their tokens
                        await foreign1155.connect(seller).setApprovalForAll(saleHandler.address, false);

                        // Create sale, expect revert
                        await expect(
                            saleHandler.connect(seller).createSecondarySale(
                                seller.address,
                                tokenAddress,
                                tokenId,
                                start,
                                quantity,
                                price,
                                perTxCap,
                                audience
                            )
                        ).to.be.revertedWith("Not approved to transfer seller's tokens");

                    });

                    it("should revert if seller has insufficient balance of given token", async function () {

                        halfSupply = ethers.BigNumber.from(supply).div("2");

                        // Seller transfers half their tokens to associate
                        await foreign1155.connect(seller).safeTransferFrom(seller.address, associate.address, tokenId, halfSupply, []);

                        // Create sale, expect revert
                        await expect(
                            saleHandler.connect(seller).createSecondarySale(
                                seller.address,
                                tokenAddress,
                                tokenId,
                                start,
                                quantity,
                                price,
                                perTxCap,
                                audience
                            )
                        ).to.be.revertedWith("Seller has insufficient balance of token");

                    });

                });

            });

            context("Existing Sales", async function () {

                beforeEach(async function() {

                    // Lets use secondary market to trigger royalties
                    market = Market.SECONDARY;

                    // Set a lower perTxCap
                    perTxCap = "5";

                    // SELLER creates secondary market sale
                    await saleHandler.connect(seller).createPrimarySale(
                        consignmentId,
                        start,
                        price,
                        perTxCap,
                        audience
                    );

                });

                context("changeAudience()", async function () {

                    it("should revert if consignment does not exist", async function () {

                        // get next consignment id
                        consignmentId = await marketController.getNextConsignment();

                        // ADMIN attempts to set audience for nonexistent consignment
                        await expect(
                            saleHandler.connect(admin).changeSaleAudience(
                                consignmentId,
                                Audience.OPEN
                            )
                        ).to.be.revertedWith("Consignment does not exist");

                    });

                    it("should revert if sale doesn't exist", async function () {

                        // Seller creates digital token
                        consignmentId = await marketController.getNextConsignment();
                        tokenId = await seenHausNFT.getNextToken();
                        await seenHausNFT.connect(seller).mintDigital(supply, seller.address, tokenURI, royaltyPercentage);

                        // ADMIN attempts to set audience for nonexistent sale
                        await expect(
                            saleHandler.connect(admin).changeSaleAudience(
                                consignmentId,
                                Audience.OPEN
                            )
                        ).to.be.revertedWith("already settled or non-existent");

                    });

                    it("should revert if sale already settled", async function () {

                        // Wait until sale starts and bid
                        await time.increaseTo(start);

                        // Cancel the sale
                        saleHandler.connect(admin).cancelSale(consignmentId);

                        // ADMIN attempts to set audience for already settled sale
                        await expect(
                            saleHandler.connect(admin).changeSaleAudience(
                                consignmentId,
                                Audience.VIP_STAKER
                            )
                        ).to.be.revertedWith("already settled or non-existent");

                    });

                });

                context("buy()", async function () {

                    beforeEach(async function () {

                        // Wait until sale starts and bid
                        await time.increaseTo(start);

                    });

                    it("should revert if consignment does not exist", async function () {

                        // get next consignment id
                        consignmentId = await marketController.getNextConsignment();

                        // ADMIN attempts to set audience for nonexistent sale of consignment
                        await expect(
                            saleHandler.connect(buyer).buy(consignmentId, single, {value: price})
                        ).to.be.revertedWith("Consignment does not exist");

                    });

                    it("should revert if sale doesn't exist", async function () {

                        // Seller creates digital token
                        consignmentId = await marketController.getNextConsignment();
                        tokenId = await seenHausNFT.getNextToken();
                        await seenHausNFT.connect(seller).mintDigital(supply, seller.address, tokenURI, royaltyPercentage);

                        // ADMIN attempts to set cancel when sale doesn't exist
                        await expect(
                            saleHandler.connect(buyer).buy(consignmentId, single, {value: price})
                        ).to.be.revertedWith("Sale hasn't started or non-existent");

                    });

                    it("should revert if audience is STAKER and buyer is not a staker", async function () {

                        // Set the audience to STAKER
                        saleHandler.connect(admin).changeSaleAudience(
                            consignmentId,
                            Audience.STAKER
                        );

                        // Try to buy
                        await expect(
                            saleHandler.connect(buyer).buy(consignmentId, single, {value: price})
                        ).to.be.revertedWith("");

                    });

                    it("should revert if audience is VIP_STAKER and buyer is not a VIP staker", async function () {

                        // Set the audience to VIP_STAKER
                        saleHandler.connect(admin).changeSaleAudience(
                            consignmentId,
                            Audience.VIP_STAKER
                        );

                        // Try to buy
                        await expect(
                            saleHandler.connect(buyer).buy(consignmentId, single, {value: price})
                        ).to.be.revertedWith("");

                    });

                    it("should revert if quantity is greater than per tx cap", async function () {

                        let total = ethers.BigNumber.from(supply).mul(price);

                        // Try to buy entire supply when per tx cap is lower
                        await expect(
                            saleHandler.connect(buyer).buy(consignmentId, supply, {value: total})
                        ).to.be.revertedWith("Per tx limit exceeded");

                    });

                    it("should revert if Value doesn't cover price", async function () {

                        // Try to buy two and pay for one
                        await expect(
                            saleHandler.connect(buyer).buy(consignmentId, "2", {value: price})
                        ).to.be.revertedWith("Value doesn't cover price");

                    });

                });

                context("closeSale()", async function () {

                    beforeEach(async function () {

                        // Move to sale start time
                        await time.increaseTo(start);

                    });

                    it("should revert if consignment does not exist", async function () {

                        // get next consignment id
                        consignmentId = await marketController.getNextConsignment();

                        // ADMIN attempts to close a nonexistent consignment
                        await expect(
                            saleHandler.connect(seller).closeSale(consignmentId)
                        ).to.be.revertedWith("Consignment does not exist");

                    });

                    it("should revert if sale doesn't exist", async function () {

                        // Seller creates digital token
                        consignmentId = await marketController.getNextConsignment();
                        tokenId = await seenHausNFT.getNextToken();
                        await seenHausNFT.connect(seller).mintDigital(supply, seller.address, tokenURI, royaltyPercentage);

                        // ADMIN attempts to set cancel when sale doesn't exist
                        await expect(
                            saleHandler.connect(admin).closeSale(consignmentId)
                        ).to.be.revertedWith("Sale does not exist");

                    });

                    it("should revert if sale is already settled", async function () {

                        // Cancel the sale
                        await saleHandler.connect(admin).cancelSale(consignmentId);

                        // ADMIN attempts to close a sale that has been settled
                        await expect(
                            saleHandler.connect(seller).closeSale(consignmentId)
                        ).to.be.revertedWith("Sale isn't currently running");

                    });

                    it("should revert if no purchases have been made", async function () {

                        // ADMIN attempts to close a sale that hasn't even started
                        await expect(
                            saleHandler.connect(seller).closeSale(consignmentId)
                        ).to.be.revertedWith("Sale isn't currently running");

                    });

                });

                context("cancelSale()", async function () {

                    beforeEach(async function () {

                        // Wait until sale starts and bid
                        await time.increaseTo(start);

                    });

                    it("should revert if consignment doesn't exist", async function () {

                        // get next consignment id
                        consignmentId = await marketController.getNextConsignment();

                        // ADMIN attempts to set audience for nonexistent consignment
                        await expect(
                            saleHandler.connect(admin).cancelSale(consignmentId)
                        ).to.be.revertedWith("Consignment does not exist");

                    });

                    it("should revert if sale doesn't exist", async function () {

                        // Seller creates digital token
                        consignmentId = await marketController.getNextConsignment();
                        tokenId = await seenHausNFT.getNextToken();
                        await seenHausNFT.connect(seller).mintDigital(supply, seller.address, tokenURI, royaltyPercentage);

                        // ADMIN attempts to set cancel when sale doesn't exist
                        await expect(
                            saleHandler.connect(admin).cancelSale(consignmentId)
                        ).to.be.revertedWith("Sale does not exist");

                    });

                    it("should revert if sale is already settled", async function () {

                        // Cancel the sale
                        await saleHandler.connect(admin).cancelSale(consignmentId);

                        // ADMIN attempts to cancel a sale that has been settled
                        await expect(
                            saleHandler.connect(admin).cancelSale(consignmentId)
                        ).to.be.revertedWith("Sale has already been settled");

                    });

                });

            });

        });

        context("Funds Distribution", async function () {

            context("Primary Market With Default Fee", async function () {

                beforeEach(async function () {

                    // SELLER creates primary market sale
                    market = Market.PRIMARY;
                    await saleHandler.connect(seller).createPrimarySale(
                        consignmentId,
                        start,
                        price,
                        perTxCap,
                        audience
                    );

                    // Wait until sale starts and bid
                    await time.increaseTo(start);
                    await saleHandler.connect(buyer).buy(consignmentId, supply, {value: buyOutPrice});

                    // Calculate the expected distribution of funds
                    grossSale = ethers.BigNumber.from(buyOutPrice);
                    feeAmount = grossSale.mul(primaryFeePercentage).div("10000");
                    multisigAmount = feeAmount.div("2");
                    stakingAmount = feeAmount.div("2");
                    sellerAmount = grossSale.sub(feeAmount);

                });

                it("multisig contract should be sent half the marketplace fee based on gross", async function () {

                    // Seller closes sale
                    await expect(
                        saleHandler.connect(seller).closeSale(consignmentId)
                    ).to.emit(saleHandler, "FeeDisbursed")
                        .withArgs(consignmentId, multisig.address, multisigAmount);

                });

                it("staking contract should be sent half the marketplace fee based on gross", async function () {

                    // Seller closes sale
                    await expect(
                        saleHandler.connect(seller).closeSale(consignmentId)
                    ).to.emit(saleHandler, "FeeDisbursed")
                        .withArgs(consignmentId, seenStaking.address, stakingAmount);

                });

                it("seller should be sent remainder after marketplace fee", async function () {

                    // Seller closes sale
                    await expect(
                        saleHandler.connect(seller).closeSale(consignmentId)
                    ).to.emit(saleHandler, "PayoutDisbursed")
                        .withArgs(consignmentId, seller.address, sellerAmount);

                });

            });

            context("Primary Market With Custom Fee", async function () {

                beforeEach(async function () {

                    // Seller creates digital token
                    consignmentId = await marketController.getNextConsignment();
                    await seenHausNFT.connect(seller).mintDigital(supply, seller.address, tokenURI, royaltyPercentage);

                    // SELLER creates primary market sale
                    market = Market.PRIMARY;
                    await saleHandler.connect(seller).createPrimarySale(
                        consignmentId,
                        start,
                        price,
                        perTxCap,
                        audience
                    );

                    // Set custom fee on consignment
                    await marketController.connect(admin).setConsignmentCustomFee(
                        consignmentId,
                        customFeePercentageBasisPoints
                    );

                    // Wait until sale starts and bid
                    await time.increaseTo(start);
                    await saleHandler.connect(buyer).buy(consignmentId, supply, {value: buyOutPrice});

                    // Calculate the expected distribution of funds
                    grossSaleWithCustomFee = ethers.BigNumber.from(buyOutPrice);
                    feeAmountWithCustomFee = grossSaleWithCustomFee.mul(customFeePercentageBasisPoints).div("10000");
                    multisigAmountWithCustomFee = feeAmountWithCustomFee.div("2");
                    stakingAmountWithCustomFee = feeAmountWithCustomFee.div("2");
                    sellerAmountWithCustomFee = grossSaleWithCustomFee.sub(feeAmountWithCustomFee);

                });

                it("multisig contract should be sent half the marketplace fee based on gross", async function () {

                    // Seller closes sale
                    await expect(
                        saleHandler.connect(seller).closeSale(consignmentId)
                    ).to.emit(saleHandler, "FeeDisbursed")
                        .withArgs(consignmentId, multisig.address, multisigAmountWithCustomFee);

                });

                it("staking contract should be sent half the marketplace fee based on gross", async function () {

                    // Seller closes sale
                    await expect(
                        saleHandler.connect(seller).closeSale(consignmentId)
                    ).to.emit(saleHandler, "FeeDisbursed")
                        .withArgs(consignmentId, seenStaking.address, stakingAmountWithCustomFee);

                });

                it("seller should be sent remainder after marketplace fee", async function () {

                    // Seller closes sale
                    await expect(
                        saleHandler.connect(seller).closeSale(consignmentId)
                    ).to.emit(saleHandler, "PayoutDisbursed")
                        .withArgs(consignmentId, seller.address, sellerAmountWithCustomFee);

                });

            });

            context("Secondary Market", async function () {

                context("Foreign ERC-721", async function () {

                    beforeEach(async function () {

                        // Creator transfers all their tokens to seller
                        await foreign721.connect(creator).transferFrom(creator.address, seller.address, tokenId);

                        // Get the next consignment id
                        consignmentId = await marketController.getNextConsignment();

                        // Token is on a foreign contract
                        tokenAddress = foreign721.address;

                        // Supply of one for 721
                        supply = "1";

                        // SELLER creates secondary market sale
                        saleHandler.connect(seller).createSecondarySale(
                            seller.address,
                            tokenAddress,
                            tokenId,
                            start,
                            supply,
                            price,
                            perTxCap,
                            audience
                        )

                        // Wait until sale starts and bid
                        await time.increaseTo(start);
                        await saleHandler.connect(buyer).buy(consignmentId, supply, {value: price});

                        // Calculate the expected distribution of funds
                        grossSale = ethers.BigNumber.from(price);
                        royaltyAmount = grossSale.mul(royaltyPercentage).div("10000");
                        netAfterRoyalties = grossSale.sub(royaltyAmount);
                        feeAmount = grossSale.mul(secondaryFeePercentage).div("10000");
                        stakingAmount = feeAmount.div("2");
                        multisigAmount = feeAmount.sub(stakingAmount);
                        sellerAmount = grossSale.sub(feeAmount).sub(royaltyAmount);

                    });

                    it("creator should receive royalty based on gross sale amount", async function () {

                        // Seller closes sale
                        await expect(
                            saleHandler.connect(seller).closeSale(consignmentId)
                        ).to.emit(saleHandler, "RoyaltyDisbursed")
                            .withArgs(consignmentId, creator.address, royaltyAmount);

                    });

                    it("multisig contract should be sent half the marketplace fee based on net after royalty", async function () {

                        // Seller closes sale
                        await expect(
                            saleHandler.connect(seller).closeSale(consignmentId)
                        ).to.emit(saleHandler, "FeeDisbursed")
                            .withArgs(consignmentId, multisig.address, multisigAmount);

                    });

                    it("staking contract should be sent half the marketplace fee based on net after royalty", async function () {

                        // Seller closes sale
                        await expect(
                            saleHandler.connect(seller).closeSale(consignmentId)
                        ).to.emit(saleHandler, "FeeDisbursed")
                            .withArgs(consignmentId, seenStaking.address, stakingAmount);

                    });

                    it("seller should be sent remainder after royalty and fee", async function () {

                        // Seller closes sale
                        await expect(
                            saleHandler.connect(seller).closeSale(consignmentId)
                        ).to.emit(saleHandler, "PayoutDisbursed")
                            .withArgs(consignmentId, seller.address, sellerAmount);

                    });

                });

                context("Foreign ERC-1155", async function () {

                    beforeEach(async function () {

                        // Get the next consignment id
                        consignmentId = await marketController.getNextConsignment();

                        // Token is on a foreign contract
                        tokenAddress = foreign1155.address;

                        // Creator transfers all their tokens to seller
                        await foreign1155.connect(creator).safeTransferFrom(creator.address, seller.address, tokenId, supply, []);

                        // SELLER creates secondary market sale
                        saleHandler.connect(seller).createSecondarySale(
                            seller.address,
                            tokenAddress,
                            tokenId,
                            start,
                            quantity,
                            price,
                            perTxCap,
                            audience
                        )

                        // Wait until sale starts and bid
                        await time.increaseTo(start);
                        await saleHandler.connect(buyer).buy(consignmentId, supply, {value: buyOutPrice});

                        // Calculate the expected distribution of funds
                        grossSale = ethers.BigNumber.from(buyOutPrice);
                        royaltyAmount = grossSale.mul(royaltyPercentage).div("10000");
                        netAfterRoyalties = grossSale.sub(royaltyAmount);
                        feeAmount = grossSale.mul(secondaryFeePercentage).div("10000");
                        multisigAmount = feeAmount.div("2");
                        stakingAmount = feeAmount.sub(multisigAmount);
                        sellerAmount = grossSale.sub(feeAmount).sub(royaltyAmount);

                    });

                    it("creator should receive royalty based on gross sale amount", async function () {

                        // Seller closes sale
                        await expect(
                            saleHandler.connect(seller).closeSale(consignmentId)
                        ).to.emit(saleHandler, "RoyaltyDisbursed")
                            .withArgs(consignmentId, creator.address, royaltyAmount);

                    });

                    it("multisig contract should be sent half the marketplace fee based on net after royalty", async function () {

                        // Seller closes sale
                        await expect(
                            saleHandler.connect(seller).closeSale(consignmentId)
                        ).to.emit(saleHandler, "FeeDisbursed")
                            .withArgs(consignmentId, multisig.address, multisigAmount);

                    });

                    it("staking contract should be sent half the marketplace fee based on net after royalty", async function () {

                        // Seller closes sale
                        await expect(
                            saleHandler.connect(seller).closeSale(consignmentId)
                        ).to.emit(saleHandler, "FeeDisbursed")
                            .withArgs(consignmentId, seenStaking.address, stakingAmount);

                    });

                    it("seller should be sent remainder after royalty and fee", async function () {

                        // Seller closes sale
                        await expect(
                            saleHandler.connect(seller).closeSale(consignmentId)
                        ).to.emit(saleHandler, "PayoutDisbursed")
                            .withArgs(consignmentId, seller.address, sellerAmount);

                    });

                });

            });

        });

        context("Asset Transfers", async function () {

            context("New Sales", async function () {

                it("createSale() should transfer token to SaleHandler contract", async function () {

                    // Seller balance of token
                    sellerBalance = await seenHausNFT.balanceOf(seller.address, tokenId);

                    // SELLER creates sale
                    await saleHandler.connect(seller).createPrimarySale(
                        consignmentId,
                        start,
                        price,
                        perTxCap,
                        audience
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
                    await saleHandler.connect(seller).createPrimarySale(
                        consignmentId,
                        start,
                        price,
                        perTxCap,
                        audience
                    );

                    // ESCROW_AGENT creates sale for physical
                    await saleHandler.connect(escrowAgent).createPrimarySale(
                        physicalConsignmentId,
                        start,
                        price,
                        perTxCap,
                        audience
                    );

                });

                context("closeSale()", async function () {

                    beforeEach(async function () {

                        // Wait until sales start and bid
                        await time.increaseTo(start);
                        await saleHandler.connect(buyer).buy(consignmentId, supply, {value: buyOutPrice});
                        await saleHandler.connect(buyer).buy(physicalConsignmentId, supply, {value: buyOutPrice});

                    });

                    it("should transfer consigned balance of token to buyer if digital", async function () {

                        // Get contract balance of token
                        contractBalance = await marketController.getUnreleasedSupply(tokenId);

                        // Seller closes sale
                        await saleHandler.connect(seller).closeSale(consignmentId);

                        // Get contract's new balance of token
                        newBalance = await marketController.getUnreleasedSupply(tokenId);
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

                        // Seller closes sale
                        await saleHandler.connect(seller).closeSale(physicalConsignmentId);

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

                        // Seller closes sale
                        await saleHandler.connect(seller).closeSale(physicalConsignmentId);

                        // Get contract's new balance of escrow ticket
                        buyerBalance = await seenHausNFT.balanceOf(seenHausNFT.address, physicalTokenId);
                        expect(contractBalance.sub(supply).eq(newBalance));

                        // Get escrow ticketer's new balance of token
                        ticketerBalance = await seenHausNFT.balanceOf(escrowTicketer, physicalTokenId);
                        expect(buyerBalance.eq(contractBalance));

                    });

                });

                context("cancelSale()", async function () {

                    beforeEach(async function () {

                        // Wait until sale starts and bid
                        await time.increaseTo(start);
                        await saleHandler.connect(buyer).buy(consignmentId, single, {value: price});

                    });

                    it("should transfer consigned balance of token to seller if digital", async function () {

                        // Admin pulls sale with no bids
                        await saleHandler.connect(admin).cancelSale(consignmentId);

                        // Get contract's new balance of token
                        newBalance = await marketController.getUnreleasedSupply(tokenId);
                        expect(contractBalance.sub(supply).eq(newBalance));

                        // Get seller's new balance of token
                        sellerBalance = await seenHausNFT.balanceOf(seller.address, tokenId);
                        expect(buyerBalance.eq(contractBalance));

                    });

                    it("should transfer consigned balance of token to seller if physical", async function () {

                        // Admin pulls sale with no bids
                        await saleHandler.connect(admin).cancelSale(physicalConsignmentId);

                        // Get contract's new balance of token
                        newBalance = await marketController.getUnreleasedSupply(physicalTokenId);
                        expect(contractBalance.sub(supply).eq(newBalance));

                        // Get seller's new balance of token
                        sellerBalance = await marketController.getUnreleasedSupply(physicalTokenId);
                        expect(buyerBalance.eq(contractBalance));

                    });

                });

            });

        });

        context("Reading Sale Information", async function () {

            beforeEach(async function () {

                // SELLER creates sale for digital
                await saleHandler.connect(seller).createPrimarySale(
                    consignmentId,
                    start,
                    price,
                    perTxCap,
                    audience
                );
            })

            it("getSale() should return a valid Sale struct", async function () {

                // Get next consignment
                const response = await saleHandler.getSale(consignmentId);

                // Convert to entity
                sale = new Sale(
                    response.consignmentId.toString(),
                    response.start.toString(),
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

            it("supply() should return the remaining supply of a consignment on sale", async function () {

                // Get the supply from the MarketController
                let result = await marketController.getUnreleasedSupply(consignmentId);

                // Test result
                expect(
                    result.eq(supply),
                    "Supply incorrect"
                ).is.true;

                // Move to sale start time
                await time.increaseTo(start);

                // Buy one
                await saleHandler.connect(buyer).buy(consignmentId, single, {value: price})

                // Check supply again
                result = await marketController.getUnreleasedSupply(consignmentId);

                // Test result
                expect(
                    result.eq(ethers.BigNumber.from(supply).sub(single)),
                    "Supply incorrect"
                ).is.true;

            });

        });

    });

});