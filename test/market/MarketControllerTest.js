const hre = require("hardhat");
const ethers = hre.ethers;
const { expect } = require("chai");
const Role = require("../../scripts/domain/Role");
const Market = require("../../scripts/domain/Market");
const MarketHandler = require("../../scripts/domain/MarketHandler");
const Consignment = require("../../scripts/domain/Consignment");
const Ticketer = require("../../scripts/domain/Ticketer");
const { InterfaceIds } = require('../../scripts/constants/supported-interfaces.js');
const { deployMarketDiamond } = require('../../scripts/util/deploy-market-diamond.js');
const { deployMarketClients } = require("../../scripts/util/deploy-market-clients.js");
const { deployMarketControllerFacets } = require('../../scripts/util/deploy-market-controller-facets.js');

/**
 *  Test the MarketController facets (MarketClerk, MarketConfig)
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
describe("IMarketController", function() {

    // Common vars
    let accounts, deployer, admin, upgrader, marketHandler, associate, seller, escrowAgent, minter;
    let accessController, marketController, marketDiamond;
    let Foreign721, foreign721;
    let Foreign1155, foreign1155;
    let seenHausNFT;
    let staking, multisig, vipStakerAmount, primaryFeePercentage, secondaryFeePercentage, maxRoyaltyPercentage, outBidPercentage, defaultTicketerType;
    let lotsTicketer, itemsTicketer, tokenURI, royaltyPercentage;
    let address, amount, percentage, counter, market, marketHandlerEnumValue, token, tokenId, id, consignment, nextConsignment, escrowTicketer, escrowTicketerType;
    let replacementAmount, replacementPercentage, supply, support, owner, balance, releasedSupply, customFeePercentageBasisPoints, pendingPayout;
    let replacementAddress = "0x2d36143CC2E0E74E007E7600F341dC9D37D81C07";
    let tooLittle, tooMuch, revertReason, result;

    beforeEach( async function () {

        // Make accounts available
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        admin = accounts[1];
        upgrader = accounts[2];
        associate = accounts[3];
        escrowAgent = accounts[4];
        minter = accounts[5]
        seller = accounts[6];

        staking = accounts[7];        // We just need addresses for these,
        multisig = accounts[8];       // not functional contracts
        marketHandler = accounts[9];  // .

        // Market control values
        vipStakerAmount = "500";                 // Amount of xSEEN to be VIP
        primaryFeePercentage = "500";            // 5%    = 500
        secondaryFeePercentage = "250";          // 2.5%  = 250
        customFeePercentageBasisPoints = "3000"; // 30% = 3000
        maxRoyaltyPercentage = "5000";           // 50%   = 5000
        outBidPercentage = "500";                // 5%    = 500
        defaultTicketerType = Ticketer.LOTS;     // default escrow ticketer type
        allowExternalTokensOnSecondary = false; // By default, don't allow external tokens to be sold via secondary market

        // Deploy the Foreign721 mock contract
        Foreign721 = await ethers.getContractFactory("Foreign721");
        foreign721 = await Foreign721.deploy();
        await foreign721.deployed();

        // Deploy the Foreign1155 mock contract
        Foreign1155 = await ethers.getContractFactory("Foreign1155");
        foreign1155 = await Foreign1155.deploy();
        await foreign1155.deployed();

        // Deploy the Diamond
        [marketDiamond, diamondLoupe, diamondCut, accessController] = await deployMarketDiamond();

        // Prepare MarketController initialization arguments
        const marketConfig = [
            staking.address,
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

        // Deploy the Market Client implementation/proxy pairs
        const marketClientArgs = [accessController.address, marketController.address];
        [impls, proxies, clients] = await deployMarketClients(marketClientArgs);
        [lotsTicketer, itemsTicketer, seenHausNFT] = clients;

        // NFT and escrow ticketer addresses get set after deployment since
        // they require the MarketController's address in their constructors
        await marketController.setNft(seenHausNFT.address);
        await marketController.setLotsTicketer(lotsTicketer.address);
        await marketController.setItemsTicketer(itemsTicketer.address);

        // Renounce temporarily granted UPGRADER role for deployer account
        await accessController.renounceRole(Role.UPGRADER, deployer.address);

        // Deployer grants ADMIN role to admin address and renounces admin
        await accessController.connect(deployer).grantRole(Role.ADMIN, admin.address);
        await accessController.connect(deployer).renounceRole(Role.ADMIN, deployer.address);

        // Grant UPGRADER role to upgrader account
        await accessController.connect(admin).grantRole(Role.UPGRADER, upgrader.address);

        // Grant MARKET_HANDLER to SeenHausNFT
        await accessController.connect(admin).grantRole(Role.MARKET_HANDLER, seenHausNFT.address);

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

            it("should indicate support for IERC1155Receiver interface", async function () {

                // Current interfaceId for IERC1155Receiver
                support = await marketController.supportsInterface(InterfaceIds.IERC1155Receiver);

                // Test
                await expect(
                    support,
                    "IERC1155Receiver interface not supported"
                ).is.true;

            });

            it("should indicate support for IERC721Receiver interface", async function () {

                // Current interfaceId for IERC721Receiver
                support = await marketController.supportsInterface(InterfaceIds.IERC721Receiver);

                // Test
                await expect(
                    support,
                    "IERC721Receiver interface not supported"
                ).is.true;

            });

            it("should indicate support for IMarketController interface", async function () {

                // Current interfaceId for IMarketController
                support = await marketController.supportsInterface(InterfaceIds.IMarketController);

                // Test
                await expect(
                    support,
                    "IMarketController interface not supported"
                ).is.true;

            });

            it("should indicate support for IMarketConfig interface", async function () {

                // Current interfaceId for IMarketConfig
                support = await marketController.supportsInterface(InterfaceIds.IMarketConfig);

                // Test
                await expect(
                    support,
                    "IMarketConfig interface not supported"
                ).is.true;

            });

            it("should indicate support for IMarketClerk interface", async function () {

                // Current interfaceId for IMarketClerk
                support = await marketController.supportsInterface(InterfaceIds.IMarketClerk);

                // Test
                await expect(
                    support,
                    "IMarketClerk interface not supported"
                ).is.true;

            });

        });

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

        it("getFeePercentage(Market.PRIMARY) should return the % of net that will be taken as the marketplace fee", async function () {

            // Get percentage
            percentage = await marketController.getFeePercentage(Market.PRIMARY);

            // Test
            expect(
                percentage.toString() === primaryFeePercentage,
                "getFeePercentage doesn't return expected amount"
            ).is.true;

        });

        it("getFeePercentage(Market.SECONDARY) should return the % of post-royalty net that will be taken as the marketplace fee", async function () {

            // Get percentage
            percentage = await marketController.getFeePercentage(Market.SECONDARY);

            // Test
            expect(
                percentage.toString() === secondaryFeePercentage,
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

            it("setStaking() should require ADMIN to set the staking address", async function () {

                // non-ADMIN attempt
                await expect(
                    marketController.connect(associate).setStaking(replacementAddress)
                ).to.be.revertedWith("Caller doesn't have role");

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
                ).to.be.revertedWith("Caller doesn't have role");

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
                ).to.be.revertedWith("Caller doesn't have role");

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
                ).to.be.revertedWith("Caller doesn't have role");

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
                ).to.be.revertedWith("Caller doesn't have role");

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
                ).to.be.revertedWith("Caller doesn't have role");

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

            it("setPrimaryFeePercentage() should require ADMIN to set the fee percentage", async function () {

                // non-ADMIN attempt
                await expect(
                    marketController.connect(associate).setPrimaryFeePercentage(replacementPercentage)
                ).to.be.revertedWith("Caller doesn't have role");

                // Get percentage
                percentage = await marketController.getFeePercentage(Market.PRIMARY);

                // Test
                expect(
                    percentage !== replacementPercentage,
                    "non-ADMIN can set fee percentage"
                ).is.true;

                // ADMIN attempt
                await marketController.connect(admin).setPrimaryFeePercentage(replacementPercentage);

                // Get percentage
                percentage = await marketController.getFeePercentage(Market.PRIMARY);

                // Test
                expect(
                    percentage.toString() === replacementPercentage,
                    "ADMIN can't set fee percentage"
                ).is.true;

            });

            it("setSecondaryFeePercentage() should require ADMIN to set the fee percentage", async function () {

                // non-ADMIN attempt
                await expect(
                    marketController.connect(associate).setSecondaryFeePercentage(replacementPercentage)
                ).to.be.revertedWith("Caller doesn't have role");

                // Get percentage
                percentage = await marketController.getFeePercentage(Market.SECONDARY);

                // Test
                expect(
                    percentage !== replacementPercentage,
                    "non-ADMIN can set fee percentage"
                ).is.true;

                // ADMIN attempt
                await marketController.connect(admin).setSecondaryFeePercentage(replacementPercentage);

                // Get percentage
                percentage = await marketController.getFeePercentage(Market.SECONDARY);

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
                ).to.be.revertedWith("Caller doesn't have role");

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
                ).to.be.revertedWith("Caller doesn't have role");

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
                ).to.be.revertedWith("Caller doesn't have role");

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

            it("setPrimaryFeePercentage() should emit a PrimaryFeePercentageChanged event", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setPrimaryFeePercentage(replacementPercentage)
                ).to.emit(marketController, 'PrimaryFeePercentageChanged')
                    .withArgs(Number(replacementPercentage));
            });

            it("setSecondaryFeePercentage() should emit a SecondaryFeePercentageChanged event", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setSecondaryFeePercentage(replacementPercentage)
                ).to.emit(marketController, 'SecondaryFeePercentageChanged')
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

            it("setPrimaryFeePercentage() should revert if percentage is zero", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setPrimaryFeePercentage(tooLittle)
                ).to.be.revertedWith(revertReason);
            });

            it("setSecondaryFeePercentage() should revert if percentage is zero", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setSecondaryFeePercentage(tooLittle)
                ).to.be.revertedWith(revertReason);
            });

            it("setPrimaryFeePercentage() should revert if percentage is more than 100", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setPrimaryFeePercentage(tooMuch)
                ).to.be.revertedWith(revertReason);
            });

            it("setSecondaryFeePercentage() should revert if percentage is more than 100", async function () {

                // Make change, test event
                await expect(
                    marketController.connect(admin).setSecondaryFeePercentage(tooMuch)
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
            marketHandlerEnumValue = MarketHandler.UNHANDLED;
            tokenId = await seenHausNFT.getNextToken();
            supply = "1";
            releasedSupply = "0"
            pendingPayout = "0"
            tokenURI = "ipfs://QmXBB6qm5vopwJ6ddxb1mEr1Pp87AHd3BUgVbsipCf9hWU";
            royaltyPercentage = maxRoyaltyPercentage;
            token = seenHausNFT;

            // Mint SeenHaus 1155 token to be consigned
            await seenHausNFT.connect(minter).mintDigital(supply, minter.address, tokenURI, royaltyPercentage);

        });

        context("Privileged Access", async function () {

            it("registerConsignment() should require MARKET_HANDLER role", async function () {

                nextConsignment = await marketController.getNextConsignment();

                // non-MARKET_HANDLER attempt
                await expect(
                    marketController.connect(associate).registerConsignment(market, associate.address, seller.address, token.address, tokenId, supply)
                ).to.be.revertedWith("Caller doesn't have role");


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

            it("setConsignmentCustomFee() should require ADMIN to set the escrow ticketer type for a consignment", async function () {

                // Get the next consignment id
                nextConsignment = await marketController.getNextConsignment();

                // Register a consignment
                await marketController.connect(marketHandler).registerConsignment(market, seller.address, seller.address, token.address, tokenId, supply)

                // non-ADMIN attempt
                await expect(
                    marketController.connect(associate).setConsignmentCustomFee(nextConsignment, customFeePercentageBasisPoints)
                ).to.be.revertedWith("Caller doesn't have role");

                // ESCROW_AGENT attempt
                await marketController.connect(admin).setConsignmentCustomFee(nextConsignment, customFeePercentageBasisPoints)

                // Get consignment
                const response = await marketController.getConsignment(nextConsignment);

                // Convert to entity
                consignment = new Consignment(
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

                // Test
                expect(consignment.customFeePercentageBasisPoints).to.equal(customFeePercentageBasisPoints.toString());

            });

            it("setConsignmentTicketer() should require ESCROW_AGENT to set the escrow ticketer type for a consignment", async function () {

                // Get the next consignment id
                nextConsignment = await marketController.getNextConsignment();

                // Register a consignment
                await marketController.connect(marketHandler).registerConsignment(market, seller.address, seller.address, token.address, tokenId, supply)

                // non-ADMIN attempt
                await expect(
                    marketController.connect(associate).setConsignmentTicketer(nextConsignment, Ticketer.ITEMS)
                ).to.be.revertedWith("Caller doesn't have role");

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
                            marketHandlerEnumValue,
                            seller.address,
                            token.address,
                            tokenId,
                            supply,
                            nextConsignment,
                            true,
                            false,
                            0,
                            0,
                            0
                        ]
                    );

            });

            it("marketConsignment() should emit a ConsignmentMarketed event", async function () {

                // Get the expected consignment id
                nextConsignment = await marketController.getNextConsignment();

                // Make change, test event
                await marketController.connect(marketHandler).registerConsignment(market, associate.address, seller.address, token.address, tokenId, supply);

                // Make change, test event
                await expect(
                    marketController.connect(marketHandler).marketConsignment(nextConsignment, MarketHandler.SALE)
                ).to.emit(marketController, 'ConsignmentMarketed')
                    .withArgs(
                        associate.address,
                        seller.address,
                        nextConsignment
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

            it("releaseConsignment() should emit a ConsignmentReleased event", async function () {

                // Get the expected consignment id
                nextConsignment = await marketController.getNextConsignment();

                // Consign the item
                marketController.connect(marketHandler).registerConsignment(market, associate.address, seller.address, token.address, tokenId, supply)

                // Make change, test event
                await expect(
                    marketController.connect(marketHandler).releaseConsignment(nextConsignment, supply, associate.address)
                ).to.emit(marketController, 'ConsignmentReleased')
                    .withArgs(
                        nextConsignment,
                        supply,
                        associate.address
                    );

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

            it("marketConsignment() should revert if it is passed the Unhandled MarketHandler", async function () {

                // Get the expected consignment id
                nextConsignment = await marketController.getNextConsignment();

                // Make change, test event
                await marketController.connect(marketHandler).registerConsignment(market, associate.address, seller.address, token.address, tokenId, supply);

                // Make change, test event
                await expect(
                    marketController.connect(marketHandler).marketConsignment(nextConsignment, MarketHandler.UNHANDLED)
                ).to.be.revertedWith("requires valid handler");
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

                    // Test validity
                    expect(
                        consignment.isValid(),
                        "Consignment not valid"
                    ).is.true;

                    // Test expected values
                    expect(consignment.market === market).is.true;
                    expect(consignment.marketHandler === marketHandlerEnumValue).is.true;
                    expect(consignment.seller === seller.address).is.true;
                    expect(consignment.tokenAddress === token.address).is.true;
                    expect(consignment.tokenId === tokenId.toString()).is.true;
                    expect(consignment.supply === supply.toString()).is.true;
                    expect(consignment.id === id).is.true;
                    expect(consignment.multiToken).is.true;
                    expect(consignment.released).is.false;
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

            context("getUnreleasedSupply()", async function() {

                it("should revert if consignment doesn't exist", async function () {

                    // A non-existent consignment
                    nextConsignment = await marketController.getNextConsignment();

                    // Attempt to get supply for non-existent consignment
                    await expect(
                        marketController.getUnreleasedSupply(nextConsignment)
                    ).to.be.revertedWith("Consignment does not exist");

                });

            });

            context("getConsignor()", async function() {

                it("should revert if consignment doesn't exist", async function () {

                    // A non-existent consignment
                    nextConsignment = await marketController.getNextConsignment();

                    // Attempt to get supply for non-existent consignment
                    await expect(
                        marketController.getConsignor(nextConsignment)
                    ).to.be.revertedWith("Consignment does not exist");

                });

            });

        });

        context("Foreign NFTs", async function () {

            beforeEach( async function () {

                // Get the expected consignment id
                nextConsignment = await marketController.getNextConsignment();

            });

            context("Foreign ERC-721", async function () {

                beforeEach( async function () {

                    // Token setup
                    token = foreign721;
                    tokenId = ethers.BigNumber.from("12");
                    supply = 1;

                    // Mint Foreign 721 token to be consigned
                    await foreign721.mint(minter.address, tokenId, maxRoyaltyPercentage);

                    // Transfer token balance to MarketController
                    // N.B. Using transferFrom instead of safeTransferFrom because of an
                    // apparent ethers issue handling overloaded methods
                    // (which safeTransferFrom is on ERC-721).
                    // https://github.com/ethers-io/ethers.js/issues/407
                    await foreign721.connect(minter).transferFrom(
                        minter.address,
                        marketController.address,
                        tokenId
                    );

                });

                context("registerConsignment()", async function () {

                    it("should emit a ConsignmentRegistered event", async function () {

                        // Make change, test event
                        await expect(
                            marketController.connect(marketHandler).registerConsignment(market, associate.address, seller.address, token.address, tokenId, supply)
                        ).to.emit(marketController, 'ConsignmentRegistered')
                            .withArgs(
                                associate.address,
                                seller.address,
                                [
                                    market,
                                    marketHandlerEnumValue,
                                    seller.address,
                                    token.address,
                                    tokenId,
                                    supply,
                                    nextConsignment,
                                    false,
                                    false,
                                    0,
                                    0,
                                    0
                                ]
                            );

                    });

                    it("subsequent getUnreleasedSupply() should return correct amount", async function () {

                        // Register consignment
                        await marketController.connect(marketHandler).registerConsignment(market, associate.address, seller.address, token.address, tokenId, supply);

                        // Get supply
                        result = await marketController.getUnreleasedSupply(nextConsignment)

                        // Get supply
                        await expect(result).to.equal(supply);

                    });

                });

                context("releaseConsignment()", async function () {

                    beforeEach( async function () {

                        // Consign the item
                        await marketController.connect(marketHandler).registerConsignment(market, associate.address, seller.address, token.address, tokenId, supply)

                    });

                    it("should emit a ConsignmentReleased event", async function () {

                        // Make change, test event
                        await expect(
                            marketController.connect(marketHandler).releaseConsignment(nextConsignment, supply, associate.address)
                        ).to.emit(marketController, 'ConsignmentReleased')
                            .withArgs(
                                nextConsignment,
                                supply,
                                associate.address
                            );

                    });

                    it("asset should be transferred to new owner", async function () {

                        // Release the consignment
                        await marketController.connect(marketHandler).releaseConsignment(nextConsignment, supply, associate.address)

                        // Get the owner of the given token
                        owner = await foreign721.ownerOf(tokenId);

                        // Make sure associate received the asset
                        expect(owner).to.equal(associate.address);

                    });

                    it("subsequent getUnreleasedSupply() should return correct amount", async function () {

                        // Release the consignment
                        await marketController.connect(marketHandler).releaseConsignment(nextConsignment, supply, associate.address)

                        // Get supply
                        result = await marketController.getUnreleasedSupply(nextConsignment)

                        // Get supply
                        await expect(result).to.equal("0");

                    });

                });

            });

            context("Foreign ERC-1155", async function () {

                beforeEach( async function () {

                    // Token setup
                    token = foreign1155;
                    tokenId = 12;
                    supply = 10;

                    // Mint Foreign 1155 token to be consigned
                    await foreign1155.mint(minter.address, tokenId, supply, maxRoyaltyPercentage);

                    // Transfer token balance to MarketController
                    await foreign1155.connect(minter).safeTransferFrom(
                        minter.address,
                        marketController.address,
                        tokenId,
                        supply,
                        []
                    );

                });

                context("registerConsignment()", async function () {

                    it("should emit a ConsignmentRegistered event", async function () {

                    // Make change, test event
                    await expect(
                        marketController.connect(marketHandler).registerConsignment(market, associate.address, seller.address, token.address, tokenId, supply)
                    ).to.emit(marketController, 'ConsignmentRegistered')
                        .withArgs(
                            associate.address,
                            seller.address,
                            [
                                market,
                                marketHandlerEnumValue,
                                seller.address,
                                token.address,
                                tokenId,
                                supply,
                                nextConsignment,
                                true,
                                false,
                                0,
                                0,
                                0
                            ]
                        );

                });

                    it("subsequent getUnreleasedSupply() should return correct amount", async function () {

                        // Register consignment
                        await marketController.connect(marketHandler).registerConsignment(market, associate.address, seller.address, token.address, tokenId, supply)

                        // Get supply
                        result = await marketController.getUnreleasedSupply(nextConsignment)

                        // Get supply
                        await expect(result).to.equal(supply);

                    });

                });

                context("releaseConsignment()", async function () {

                    beforeEach( async function () {

                        // Consign the item
                        marketController.connect(marketHandler).registerConsignment(market, associate.address, seller.address, token.address, tokenId, supply)

                    });

                    it("should emit a ConsignmentReleased event", async function () {

                        // Make change, test event
                        await expect(
                            marketController.connect(marketHandler).releaseConsignment(nextConsignment, supply, associate.address)
                        ).to.emit(marketController, 'ConsignmentReleased')
                            .withArgs(
                                nextConsignment,
                                supply,
                                associate.address
                            );

                    });

                    it("asset should be transferred to new owner", async function () {

                        // Release the consignment
                        await marketController.connect(marketHandler).releaseConsignment(nextConsignment, supply, associate.address)

                        // Get the associate's balance of the given token
                        balance = await foreign1155.balanceOf(associate.address, tokenId);

                        // Make sure associate received the asset
                        expect(balance).to.equal(supply);

                    });

                    it("subsequent getUnreleasedSupply() should return correct amount", async function () {

                        // Release the consignment
                        await marketController.connect(marketHandler).releaseConsignment(nextConsignment, supply, associate.address);

                        // Get supply
                        result = await marketController.getUnreleasedSupply(nextConsignment)

                        // Get supply
                        await expect(result).to.equal("0");

                    });

                });
            });

        });

    });

});