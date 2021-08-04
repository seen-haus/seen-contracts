const hre = require("hardhat");
const ethers = hre.ethers;
const { expect } = require("chai");
const Role = require("../../domain/Role");
const Market = require("../../domain/Market");
const Consignment = require("../../domain/Consignment");
const Ticketer = require("../../domain/Ticketer");
const { deployDiamond } = require('../../scripts/util/deploy-diamond.js');
const { deployMarketControllerFacets } = require('../../scripts/util/deploy-market-controller-facets.js');

describe("MarketController", function() {

    // Common vars
    let accounts, deployer, admin, marketHandler, associate, seller, escrowAgent, minter;
    let AccessController, accessController;
    let MarketConfig, marketConfig, MarketClerk, marketClerk, marketController;
    let SeenHausNFT, seenHausNFT;
    let staking, multisig, vipStakerAmount, feePercentage, maxRoyaltyPercentage, outBidPercentage, defaultTicketerType;
    let lotsTicketer, itemsTicketer, tokenURI, royaltyPercentage;
    let address, amount, percentage, counter, market, token, tokenId, id, consignment, nextConsignment, escrowTicketer, escrowTicketerType;
    let replacementAmount, replacementPercentage, supply, support, interfaces;
    let replacementAddress = "0x2d36143CC2E0E74E007E7600F341dC9D37D81C07";
    let tooLittle, tooMuch, revertReason;

    beforeEach( async function () {

        // Make accounts available
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        admin = accounts[1];
        seller = accounts[2];
        associate = accounts[3];
        escrowAgent = accounts[4];
        minter = accounts[5]

        staking = accounts[6];        // We just need addresses for these,
        multisig = accounts[7];       // not functional contracts
        lotsTicketer = accounts[8];   // .
        itemsTicketer = accounts[9];  // .
        marketHandler = accounts[10]; // .

        // Market control values
        vipStakerAmount = "500";              // Amount of xSEEN to be VIP
        feePercentage = "1500";               // 15%   = 1500
        maxRoyaltyPercentage = "5000";        // 50%   = 5000
        outBidPercentage = "500";             // 5%    = 500
        defaultTicketerType = Ticketer.LOTS;  // default escrow ticketer type

        // Deploy the Diamond
        [diamond, diamondLoupe, diamondCut, accessController] = await deployDiamond();

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
        await deployMarketControllerFacets(diamond, marketConfig);

        // Cast Diamond to MarketController
        marketController = await ethers.getContractAt('IMarketController', diamond.address);

        // Deploy the SeenHausNFT contract
        SeenHausNFT = await ethers.getContractFactory("SeenHausNFT");
        seenHausNFT = await SeenHausNFT.deploy(
            accessController.address,
            diamond.address
        );
        await seenHausNFT.deployed();

        // NFT and escrow ticketer addresses get set after deployment since
        // they require the MarketController's address in their constructors
        await marketController.setNft(seenHausNFT.address);
        await marketController.setLotsTicketer(lotsTicketer.address);
        await marketController.setItemsTicketer(itemsTicketer.address);

        // Deployer grants ADMIN role to admin address and renounces admin
        await accessController.connect(deployer).grantRole(Role.ADMIN, admin.address);
        await accessController.connect(deployer).renounceRole(Role.ADMIN, deployer.address);

        // Grant MARKET_HANDLER to SeenHausNFT
        await accessController.connect(admin).grantRole(Role.MARKET_HANDLER, seenHausNFT.address);

    });

    context("Reading Market Configuration", async function () {

        it("getStaking() should return the xSEEN staking contract's address", async function () {

            // Get address
            address = await marketController.getStaking();

            // Test
            expect(
                address === staking.address,
                "getStaking doesn't return expected address"
            ).is.true;

        });

        it("getMultisig() should return the Seen.Haus multisig contract's address", async function () {

            // Get address
            address = await marketController.getMultisig();

            // Test
            expect(
                address === multisig.address,
                "getMultisig doesn't return expected address"
            ).is.true;

        });

        it("getNft() should return the Seen.Haus NFT contract's address", async function () {

            // Get address
            address = await marketController.getNft();

            // Test
            expect(
                address === seenHausNFT.address,
                "getNft doesn't return expected address"
            ).is.true;

        });

        it("getLotsTicketer() should return the lots-based Escrow Ticketer implementation's address", async function () {

            // Get address
            address = await marketController.getLotsTicketer();

            // Test
            expect(
                address === lotsTicketer.address,
                "getLotsTicketer doesn't return expected address"
            ).is.true;

        });

        it("getItemsTicketer() should return the items-based Escrow Ticketer implementation's address", async function () {

            // Get address
            address = await marketController.getItemsTicketer();

            // Test
            expect(
                address === itemsTicketer.address,
                "getItemsTicketer doesn't return expected address"
            ).is.true;

        });

        it("getVipStakerAmount() should return the amount of xSEEN required to be considered VIP staker", async function () {

            // Get amount
            amount = await marketController.getVipStakerAmount();

            // Test
            expect(
                amount.toString() === vipStakerAmount,
                "getVipStakerAmount doesn't return expected amount"
            ).is.true;

        });

        it("getFeePercentage() should return the % of post-royalty net that will be taken as the marketplace fee", async function () {

            // Get percentage
            percentage = await marketController.getFeePercentage();

            // Test
            expect(
                percentage.toString() === feePercentage,
                "getFeePercentage doesn't return expected amount"
            ).is.true;

        });

        it("getMaxRoyaltyPercentage() should return the maximum % of non-Seen.Haus sale gross that will be paid to those creators", async function () {

            // Get percentage
            percentage = await marketController.getMaxRoyaltyPercentage();

            // Test
            expect(
                percentage.toString() === maxRoyaltyPercentage,
                "getMaxRoyaltyPercentage doesn't return expected amount"
            ).is.true;

        });

        it("getOutBidPercentage() should return the minimum % a Seen.Haus auction bid must be above the previous bid to prevail", async function () {

            // Get percentage
            percentage = await marketController.getOutBidPercentage();

            // Test
            expect(
                percentage.toString() === outBidPercentage,
                "getOutBidPercentage doesn't return expected amount"
            ).is.true;

        });

        it("getDefaultTicketerType() should return the ticketer type that will be used if a consignment hasn't had one specified", async function () {

            // Get percentage
            escrowTicketerType = await marketController.getDefaultTicketerType();

            // Test
            expect(
                escrowTicketerType === defaultTicketerType,
                "getDefaultTicketerType doesn't return expected type"
            ).is.true;

        });

    });

    context("Writing Market Configuration", async function () {

        beforeEach( async function () {

            // Prepare for roled access to privileged methods
            await accessController.connect(admin).grantRole(Role.ADMIN, admin.address);

            // Unique replacement values
            replacementAmount = "250";
            replacementPercentage = "3000";

        });

        context("Privileged Access", async function () {

            xit("setAccessController() should require ADMIN to set the accessController address", async function () {

                // N.B. There is no separate test suite for AccessClient.sol, which is an abstract contract.
                //      Functionality not covered elsewhere will be tested here in the MarketController test suite.

                // non-ADMIN attempt
                await expect(
                    marketController.connect(associate).setAccessController(replacementAddress)
                ).to.be.revertedWith("Access denied, caller doesn't have role");

                // Get address
                address = await marketController.getAccessController();

                // Test
                expect(
                    address !== replacementAddress,
                    "non-ADMIN can set accessController address"
                ).is.true;

                // ADMIN attempt
                await marketController.connect(admin).setAccessController(replacementAddress);

                // Get address
                address = await marketController.getAccessController();

                // Test
                expect(
                    address === replacementAddress,
                    "ADMIN can't set accessController address"
                ).is.true;

            });

            it("setStaking() should require ADMIN to set the staking address", async function () {

                // non-ADMIN attempt
                await expect(
                    marketController.connect(associate).setStaking(replacementAddress)
                ).to.be.revertedWith("Access denied, caller doesn't have role");

                // Get address
                address = await marketController.getStaking();

                // Test
                expect(
                    address !== replacementAddress,
                    "non-ADMIN can set staking address"
                ).is.true;

                // ADMIN attempt
                await marketController.connect(admin).setStaking(replacementAddress)

                // Get address
                address = await marketController.getStaking();

                // Test
                expect(
                    address === replacementAddress,
                    "ADMIN can't set staking address"
                ).is.true;

            });

            it("setMultisig() should require ADMIN to set the multisig address", async function () {

                // non-ADMIN attempt
                await expect(
                    marketController.connect(associate).setMultisig(replacementAddress)
                ).to.be.revertedWith("Access denied, caller doesn't have role");

                // Get address
                address = await marketController.getMultisig();

                // Test
                expect(
                    address !== replacementAddress,
                    "non-ADMIN can set multisig address"
                ).is.true;

                // ADMIN attempt
                await marketController.connect(admin).setMultisig(replacementAddress)

                // Get address
                address = await marketController.getMultisig();

                // Test
                expect(
                    address === replacementAddress,
                    "ADMIN can't set multisig address"
                ).is.true;

            });

            it("setNft() should require ADMIN to set the seenHausNFT address", async function () {

                // non-ADMIN attempt
                await expect(
                    marketController.connect(associate).setNft(replacementAddress)
                ).to.be.revertedWith("Access denied, caller doesn't have role");

                // Get address
                address = await marketController.getNft();

                // Test
                expect(
                    address !== replacementAddress,
                    "non-ADMIN can set seenHausNFT address"
                ).is.true;

                // ADMIN attempt
                await marketController.connect(admin).setNft(replacementAddress)

                // Get address
                address = await marketController.getNft();

                // Test
                expect(
                    address === replacementAddress,
                    "ADMIN can't set seenHausNFT address"
                ).is.true;

            });

            it("setLotsTicketer() should require ADMIN to set the lots-based escrow ticketer address", async function () {

                // non-ADMIN attempt
                await expect(
                    marketController.connect(associate).setLotsTicketer(replacementAddress)
                ).to.be.revertedWith("Access denied, caller doesn't have role");

                // Get address
                address = await marketController.getLotsTicketer();

                // Test
                expect(
                    address !== replacementAddress,
                    "non-ADMIN can set lots ticketer address"
                ).is.true;

                // ADMIN attempt
                await marketController.connect(admin).setLotsTicketer(replacementAddress)

                // Get address
                address = await marketController.getLotsTicketer();

                // Test
                expect(
                    address === replacementAddress,
                    "ADMIN can't set lots ticketer address"
                ).is.true;

            });

            it("setItemsTicketer() should require ADMIN to set the items-based escrow ticketer address", async function () {

                // non-ADMIN attempt
                await expect(
                    marketController.connect(associate).setItemsTicketer(replacementAddress)
                ).to.be.revertedWith("Access denied, caller doesn't have role");

                // Get address
                address = await marketController.getItemsTicketer();

                // Test
                expect(
                    address !== replacementAddress,
                    "non-ADMIN can set items ticketer address"
                ).is.true;

                // ADMIN attempt
                await marketController.connect(admin).setItemsTicketer(replacementAddress)

                // Get address
                address = await marketController.getItemsTicketer();

                // Test
                expect(
                    address === replacementAddress,
                    "ADMIN can't set items ticketer address"
                ).is.true;

            });

            it("setVipStakerAmount() should require ADMIN to set the VIP staker amount", async function () {

                // non-ADMIN attempt
                await expect(
                    marketController.connect(associate).setVipStakerAmount(replacementAmount)
                ).to.be.revertedWith("Access denied, caller doesn't have role");

                // Get amount
                amount = await marketController.getVipStakerAmount();

                // Test
                expect(
                    amount !== replacementAmount,
                    "non-ADMIN can set VIP staker amount"
                ).is.true;

                // ADMIN attempt
                await marketController.connect(admin).setVipStakerAmount(replacementAmount);

                // Get amount
                amount = await marketController.getVipStakerAmount();

                // Test
                expect(
                    amount.toString() === replacementAmount,
                    "ADMIN can't set VIP staker amount"
                ).is.true;

            });

            it("setFeePercentage() should require ADMIN to set the fee percentage", async function () {

                // non-ADMIN attempt
                await expect(
                    marketController.connect(associate).setFeePercentage(replacementPercentage)
                ).to.be.revertedWith("Access denied, caller doesn't have role");

                // Get percentage
                percentage = await marketController.getFeePercentage();

                // Test
                expect(
                    percentage !== replacementPercentage,
                    "non-ADMIN can set fee percentage"
                ).is.true;

                // ADMIN attempt
                await marketController.connect(admin).setFeePercentage(replacementPercentage);

                // Get percentage
                percentage = await marketController.getFeePercentage();

                // Test
                expect(
                    percentage.toString() === replacementPercentage,
                    "ADMIN can't set fee percentage"
                ).is.true;

            });

            it("setMaxRoyaltyPercentage() should require ADMIN to set the max royalty percentage to pay other marketplaces", async function () {

                // non-ADMIN attempt
                await expect(
                    marketController.connect(associate).setMaxRoyaltyPercentage(replacementPercentage)
                ).to.be.revertedWith("Access denied, caller doesn't have role");

                // Get percentage
                percentage = await marketController.getMaxRoyaltyPercentage();

                // Test
                expect(
                    percentage !== replacementPercentage,
                    "non-ADMIN can set max royalty percentage"
                ).is.true;

                // ADMIN attempt
                await marketController.connect(admin).setMaxRoyaltyPercentage(replacementPercentage);

                // Get percentage
                percentage = await marketController.getMaxRoyaltyPercentage();

                // Test
                expect(
                    percentage.toString() === replacementPercentage,
                    "ADMIN can't set max royalty percentage"
                ).is.true;

            });

            it("setOutBidPercentage() should require ADMIN to set the outbid percentage", async function () {

                // non-ADMIN attempt
                await expect(
                    marketController.connect(associate).setOutBidPercentage(replacementPercentage)
                ).to.be.revertedWith("Access denied, caller doesn't have role");

                // Get percentage
                percentage = await marketController.getOutBidPercentage();

                // Test
                expect(
                    percentage !== replacementPercentage,
                    "non-ADMIN can set outbid percentage"
                ).is.true;

                // ADMIN attempt
                await marketController.connect(admin).setOutBidPercentage(replacementPercentage);

                // Get percentage
                percentage = await marketController.getOutBidPercentage();

                // Test
                expect(
                    percentage.toString() === replacementPercentage,
                    "ADMIN can't set outbid percentage"
                ).is.true;

            });

            it("setDefaultTicketerType() should require ADMIN to set the default escrow ticketer type", async function () {

                // non-ADMIN attempt
                await expect(
                    marketController.connect(associate).setDefaultTicketerType(Ticketer.ITEMS)
                ).to.be.revertedWith("Access denied, caller doesn't have role");

                // Get type
                escrowTicketerType = await marketController.getDefaultTicketerType();

                // Test
                expect(
                    escrowTicketerType !== Ticketer.ITEMS,
                    "non-ADMIN can set default escrow ticket type"
                ).is.true;

                // ADMIN attempt
                await marketController.connect(admin).setDefaultTicketerType(Ticketer.ITEMS)

                // Get percentage
                escrowTicketerType = await marketController.getDefaultTicketerType();

                // Test
                expect(
                    escrowTicketerType === Ticketer.ITEMS,
                    "ADMIN can't set default escrow ticket type"
                ).is.true;

            });

        });

        context("Change Events", async function () {

            it("setStaking() should emit a StakingAddressChanged event", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setStaking(replacementAddress)
                ).to.emit(marketController, 'StakingAddressChanged')
                    .withArgs(replacementAddress);
            });

            it("setMultisig() should emit a MultisigAddressChanged event", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setMultisig(replacementAddress)
                ).to.emit(marketController, 'MultisigAddressChanged')
                    .withArgs(replacementAddress);
            });

            it("setNft() should emit a NFTAddressChanged event", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setNft(replacementAddress)
                ).to.emit(marketController, 'NFTAddressChanged')
                    .withArgs(replacementAddress);
            });

            it("setLotsTicketer() should emit a EscrowTicketerAddressChanged event", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setLotsTicketer(replacementAddress)
                ).to.emit(marketController, 'EscrowTicketerAddressChanged')
                    .withArgs(replacementAddress, Ticketer.LOTS);
            });

            it("setItemsTicketer() should emit a EscrowTicketerAddressChanged event", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setItemsTicketer(replacementAddress)
                ).to.emit(marketController, 'EscrowTicketerAddressChanged')
                    .withArgs(replacementAddress, Ticketer.ITEMS);
            });

            it("setVipStakerAmount() should emit a VipStakerAmountChanged event", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setVipStakerAmount(replacementAmount)
                ).to.emit(marketController, 'VipStakerAmountChanged')
                    .withArgs(replacementAmount);
            });

            it("setFeePercentage() should emit a FeePercentageChanged event", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setFeePercentage(replacementPercentage)
                ).to.emit(marketController, 'FeePercentageChanged')
                    .withArgs(Number(replacementPercentage));
            });

            it("setMaxRoyaltyPercentage() should emit a MaxRoyaltyPercentageChanged event", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setMaxRoyaltyPercentage(replacementPercentage)
                ).to.emit(marketController, 'MaxRoyaltyPercentageChanged')
                    .withArgs(Number(replacementPercentage));
            });

            it("setOutBidPercentage() should emit a OutBidPercentageChanged event", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setOutBidPercentage(replacementPercentage)
                ).to.emit(marketController, 'OutBidPercentageChanged')
                    .withArgs(Number(replacementPercentage));
            });

            it("setDefaultTicketerType() should emit a DefaultTicketerTypeChanged event", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setDefaultTicketerType(Ticketer.ITEMS)
                ).to.emit(marketController, 'DefaultTicketerTypeChanged')
                    .withArgs(Ticketer.ITEMS);
            });

        });

        context("Revert Reasons", async function () {

            beforeEach( async function () {

                // Invalid percentages
                tooLittle = "0";
                tooMuch = "50000";
                revertReason = "Percentage representation must be between 1 and 10000";
            });

            it("setFeePercentage() should revert if percentage is zero", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setFeePercentage(tooLittle)
                ).to.be.revertedWith(revertReason);
            });

            it("setFeePercentage() should revert if percentage is more than 100", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setFeePercentage(tooMuch)
                ).to.be.revertedWith(revertReason);
            });

            it("setMaxRoyaltyPercentage() should revert if percentage is zero", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setMaxRoyaltyPercentage(tooLittle)
                ).to.be.revertedWith(revertReason);
            });

            it("setMaxRoyaltyPercentage() should revert if percentage is more than 100", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setMaxRoyaltyPercentage(tooMuch)
                ).to.be.revertedWith(revertReason);
            });

            it("setOutBidPercentage() should revert if percentage is zero", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setOutBidPercentage(tooLittle)
                ).to.be.revertedWith(revertReason);
            });

            it("setOutBidPercentage() should revert if percentage is more than 100", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setOutBidPercentage(tooMuch)
                ).to.be.revertedWith(revertReason);
            });

            it("setDefaultTicketerType() should revert if ticketer type is Default", async function () {

                revertReason = "Invalid ticketer type.";
                // Make change, test event
                await expect(
                    marketController.connect(admin).setDefaultTicketerType(Ticketer.DEFAULT)
                ).to.be.revertedWith(revertReason);
            });

            it("setDefaultTicketerType() should revert if ticketer type is already set as default", async function () {

                revertReason = "Type is already default.";

                // Make change, test event
                await expect(
                    marketController.connect(admin).setDefaultTicketerType(Ticketer.LOTS)
                ).to.be.revertedWith(revertReason);
            });

        });

    });

    context("Managing Consignments", async function () {

        beforeEach( async function () {

            // Prepare for roled access to privileged MarketController methods
            await accessController.connect(admin).grantRole(Role.MARKET_HANDLER, marketHandler.address);
            await accessController.connect(admin).grantRole(Role.ESCROW_AGENT, escrowAgent.address);
            await accessController.connect(admin).grantRole(Role.MINTER, minter.address);

            // Setup values
            market = Market.PRIMARY;
            tokenId = await seenHausNFT.getNextToken();
            supply = "1";
            tokenURI = "ipfs://QmXBB6qm5vopwJ6ddxb1mEr1Pp87AHd3BUgVbsipCf9hWU";
            royaltyPercentage = maxRoyaltyPercentage;
            token = seenHausNFT;

            // Mint token to be consigned
            await seenHausNFT.connect(minter).mintDigital(supply, minter.address, tokenURI, royaltyPercentage);
        });

        context("Privileged Access", async function () {

            it("registerConsignment() should require MARKET_HANDLER role", async function () {

                nextConsignment = await marketController.getNextConsignment();

                // non-MARKET_HANDLER attempt
                await expect(
                    marketController.connect(associate).registerConsignment(market, associate.address, seller.address, token.address, tokenId, supply)
                ).to.be.revertedWith("Access denied, caller doesn't have role");


                // Get counter
                counter = await marketController.getNextConsignment();

                // Test
                expect(
                    counter.eq(nextConsignment),
                    "non-MARKET_HANDLER can register a consignment"
                ).is.true;

                // MARKET_HANDLER attempt
                await marketController.connect(marketHandler).registerConsignment(market, seller.address, seller.address, token.address, tokenId, supply);

                // Get counter
                counter = await marketController.getNextConsignment();

                // Test
                expect(
                    counter.gt(nextConsignment),
                    "MARKET_HANDLER can't register a consignment"
                ).is.true;

            });

            it("setConsignmentTicketer() should require ESCROW_AGENT to set the escrow ticketer type for a consignment", async function () {

                // Get the next consignment id
                nextConsignment = await marketController.getNextConsignment();

                // Register a consignment
                await marketController.connect(marketHandler).registerConsignment(market, seller.address, seller.address, token.address, tokenId, supply)

                // non-ADMIN attempt
                await expect(
                    marketController.connect(associate).setConsignmentTicketer(nextConsignment, Ticketer.ITEMS)
                ).to.be.revertedWith("Access denied, caller doesn't have role");

                // ESCROW_AGENT attempt
                await marketController.connect(escrowAgent).setConsignmentTicketer(nextConsignment, Ticketer.ITEMS)

                // Get ticketer
                escrowTicketer = await marketController.getEscrowTicketer(nextConsignment);

                // Test
                expect(
                    escrowTicketer === itemsTicketer.address,
                    "ESCROW_AGENT can't set escrow ticket type for consignment"
                ).is.true;

            });

        });

        context("Change Events", async function () {

            it("registerConsignment() should emit a ConsignmentRegistered event", async function () {

                // Get the expected consignment id
                nextConsignment = await marketController.getNextConsignment();

                // Make change, test event
                await expect(
                    marketController.connect(marketHandler).registerConsignment(market, associate.address, seller.address, token.address, tokenId, supply)
                ).to.emit(marketController, 'ConsignmentRegistered')
                    .withArgs(
                        associate.address,
                        seller.address,
                        [
                            market,
                            seller.address,
                            token.address,
                            tokenId,
                            supply,
                            nextConsignment
                        ]
                    );

            });

            it("setConsignmentTicketer() should emit a ConsignmentTicketerChanged event", async function () {

                // Get the next consignment id
                nextConsignment = await marketController.getNextConsignment();

                // Register a consignment
                await marketController.connect(marketHandler).registerConsignment(market, seller.address, seller.address, token.address, tokenId, supply)

                // ESCROW_AGENT sets consignment's ticketer type
                await expect(
                    marketController.connect(escrowAgent).setConsignmentTicketer(nextConsignment, Ticketer.ITEMS)
                ).to.emit(marketController, 'ConsignmentTicketerChanged')
                    .withArgs(nextConsignment, Ticketer.ITEMS);
            });

        });

        context("Revert Reasons", async function () {

            it("setConsignmentTicketer() should revert if consignment doesn't exist", async function () {

                // Get the next consignment id
                nextConsignment = await marketController.getNextConsignment();

                // ESCROW_AGENT sets ticketer type for consignment not yet created
                await expect(
                    marketController.connect(escrowAgent).setConsignmentTicketer(nextConsignment, Ticketer.ITEMS)
                ).to.be.revertedWith("Consignment does not exist");
            });

        });

        context("Reading Consignments", async function () {

            context("getConsignment()", async function() {

                it("should revert if consignment doesn't exist", async function () {

                    // A non-existent consignment
                    nextConsignment = await marketController.getNextConsignment();

                    // Attempt to get non-existent consignment
                    await expect(
                        marketController.getConsignment(nextConsignment)
                    ).to.be.revertedWith("Consignment does not exist");

                });

                it("should return a valid consignment", async function () {

                    // Get the expected consignment id
                    nextConsignment = await marketController.getNextConsignment();
                    id = nextConsignment.toString();

                    // Register consignment
                    await marketController.connect(marketHandler).registerConsignment(market, seller.address, seller.address, token.address, tokenId, supply);

                    // Get the consignment
                    const response = await marketController.getConsignment(nextConsignment);

                    // Convert to entity
                    consignment = new Consignment(
                        response.market,
                        response.seller,
                        response.tokenAddress,
                        response.tokenId.toString(),
                        response.supply.toString(),
                        response.id.toString(),
                        response.marketed
                    );

                    // Test validity
                    expect(
                        consignment.isValid(),
                        "Consignment not valid"
                    ).is.true;

                    // Test expected values
                    expect(consignment.market === market).is.true;
                    expect(consignment.seller === seller.address).is.true;
                    expect(consignment.tokenAddress === token.address).is.true;
                    expect(consignment.tokenId === tokenId.toString()).is.true;
                    expect(consignment.supply === supply.toString()).is.true;
                    expect(consignment.id === id).is.true;
                    expect(consignment.marketed).is.false;
                });

            });

            context("getEscrowTicketer()", async function() {

                it("should revert if consignment doesn't exist", async function () {

                    // A non-existent consignment
                    nextConsignment = await marketController.getNextConsignment();

                    // Attempt to get escrow ticketer for non-existent consignment
                    await expect(
                        marketController.getEscrowTicketer(nextConsignment)
                    ).to.be.revertedWith("Consignment does not exist");

                });

                it("should return the default escrow ticketer if not set for given consignment", async function () {

                    // Get the expected consignment id
                    nextConsignment = await marketController.getNextConsignment();

                    // Register consignment
                    await marketController.connect(marketHandler).registerConsignment(market, seller.address, seller.address, token.address, tokenId, supply);

                    // Get the ticketer for this consignment
                    escrowTicketer = await marketController.getEscrowTicketer(nextConsignment);

                    // Test
                    expect(
                        escrowTicketer === lotsTicketer.address,
                        "getConsignmentTicketer returned the wrong ticketer"
                    ).is.true;

                });

                it("should return the specified escrow ticketer for given consignment if set", async function () {

                    // Get the expected consignment id
                    nextConsignment = await marketController.getNextConsignment();

                    // Register consignment
                    await marketController.connect(marketHandler).registerConsignment(market, seller.address, seller.address, token.address, tokenId, supply);

                    // Specify an escrow ticketer for a the consignment
                    await marketController.connect(escrowAgent).setConsignmentTicketer(nextConsignment, Ticketer.ITEMS)

                    // Get the ticketer for this consignment
                    escrowTicketer = await marketController.getEscrowTicketer(nextConsignment);

                    // Test
                    expect(
                        escrowTicketer === itemsTicketer.address,
                        "getConsignmentTicketer returned the wrong ticketer"
                    ).is.true;

                });

            });

            context("getSupply()", async function() {

                it("should revert if consignment doesn't exist", async function () {

                    // A non-existent consignment
                    nextConsignment = await marketController.getNextConsignment();

                    // Attempt to get supply for non-existent consignment
                    await expect(
                        marketController.getSupply(nextConsignment)
                    ).to.be.revertedWith("Consignment does not exist");

                });

            });

            context("isConsignor()", async function() {

                it("should revert if consignment doesn't exist", async function () {

                    // A non-existent consignment
                    nextConsignment = await marketController.getNextConsignment();

                    // Attempt to get supply for non-existent consignment
                    await expect(
                        marketController.isConsignor(nextConsignment, seller.address)
                    ).to.be.revertedWith("Consignment does not exist");

                });

            });

        });

    });

    context("Interfaces", async function () {

        context("supportsInterface()", async function () {

            it("should indicate support for ERC-165 interface", async function () {

                // See https://eips.ethereum.org/EIPS/eip-165#how-a-contract-will-publish-the-interfaces-it-implements
                support = await marketController.supportsInterface("0x01ffc9a7");

                // Test
                await expect(
                    support,
                    "ERC-165 interface not supported"
                ).is.true;

            });

            xit("should indicate support for IMarketController interface", async function () {

                // Current interfaceId for IMarketController
                support = await marketController.supportsInterface("0xe5f2f941");

                // Test
                await expect(
                    support,
                    "IMarketController interface not supported"
                ).is.true;

            });

        });

    });

});