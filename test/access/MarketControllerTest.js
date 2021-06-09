const { expect } = require("chai");
const { expectRevert } = require('@openzeppelin/test-helpers');
const Role = require("../../domain/Role");
const Market = require("../../domain/Market");
const Consignment = require("../../domain/Consignment");

describe("MarketController", function() {

    // Common vars
    let accounts, deployer, admin, marketHandler, associate, seller;
    let AccessController, accessController;
    let MarketController, marketController;
    let staking, multisig, vipStakerAmount, feePercentage, royaltyPercentage, maxRoyaltyPercentage, outBidPercentage;
    let escrowTicketer, nft;
    let address, amount, percentage, counter, market, token, tokenId, id, consignment, nextConsignment;
    let replacement, replacementAmount, replacementPercentage;

    beforeEach( async function () {

        // Make accounts available
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        admin = accounts[1];
        marketHandler = accounts[2];

        staking = accounts[3];        // We just need addresses for these,
        multisig = accounts[4];       // not functional contracts
        nft = accounts[5];            // .
        escrowTicketer = accounts[6]; // .
        replacement = accounts[7];    // .
        associate = accounts[8];      // .
        seller = accounts[9];         // .
        token = accounts[10];         // .

        // Market control values
        vipStakerAmount = "500";       // Amount of xSEEN
        feePercentage = "1500";        // 15%   = 1500
        royaltyPercentage = "12500";   // 12.5% = 12500
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
            royaltyPercentage,
            maxRoyaltyPercentage,
            outBidPercentage
        );
        await marketController.deployed();

        // Escrow Ticketer and NFT addresses get set after deployment since
        // they require the MarketController's address in their constructors
        await marketController.setEscrowTicketer(escrowTicketer.address);
        await marketController.setNft(nft.address);

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
                address === nft.address,
                "getNft doesn't return expected address"
            ).is.true;

        });

        it("getEscrowTicketer() should return the chosen Escrow Ticketer implementation's address", async function () {

            // Get address
            address = await marketController.getEscrowTicketer();

            // Test
            expect(
                address === escrowTicketer.address,
                "getEscrowTicketer doesn't return expected address"
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

        it("getRoyaltyPercentage() should return the % of secondary sale gross that will be royalty for Seen.Haus creators", async function () {

            // Get percentage
            percentage = await marketController.getRoyaltyPercentage();

            // Test
            expect(
                percentage.toString() === royaltyPercentage,
                "getRoyaltyPercentage doesn't return expected amount"
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

    });

    context("Writing Market Configuration", async function () {

        beforeEach( async function () {

            // Prepare for roled access to privileged MarketController methods
            await accessController.connect(deployer).grantRole(Role.ADMIN, admin.address);

            // Unique replacement values
            replacementAmount = "250";
            replacementPercentage = "3000";

        });

        context("Privileged Access", async function () {

            it("setStaking() should require ADMIN to set the staking address", async function () {

                // non-ADMIN attempt
                try {
                    await marketController.connect(associate).setStaking(replacement.address)
                } catch (e) {}

                // Get address
                address = await marketController.getStaking();

                // Test
                expect(
                    address !== replacement.address,
                    "non-ADMIN can set staking address"
                ).is.true;

                // ADMIN attempt
                try {
                    await marketController.connect(admin).setStaking(replacement.address)
                } catch (e) {}

                // Get address
                address = await marketController.getStaking();

                // Test
                expect(
                    address === replacement.address,
                    "ADMIN can't set staking address"
                ).is.true;

            });

            it("setMultisig() should require ADMIN to set the multisig address", async function () {

                // non-ADMIN attempt
                try {
                    await marketController.connect(associate).setMultisig(replacement.address)
                } catch (e) {}

                // Get address
                address = await marketController.getMultisig();

                // Test
                expect(
                    address !== replacement.address,
                    "non-ADMIN can set multisig address"
                ).is.true;

                // ADMIN attempt
                try {
                    await marketController.connect(admin).setMultisig(replacement.address)
                } catch (e) {}

                // Get address
                address = await marketController.getMultisig();

                // Test
                expect(
                    address === replacement.address,
                    "ADMIN can't set multisig address"
                ).is.true;

            });

            it("setNft() should require ADMIN to set the nft address", async function () {

                // non-ADMIN attempt
                try {
                    await marketController.connect(associate).setNft(replacement.address)
                } catch (e) {}

                // Get address
                address = await marketController.getNft();

                // Test
                expect(
                    address !== replacement.address,
                    "non-ADMIN can set nft address"
                ).is.true;

                // ADMIN attempt
                try {
                    await marketController.connect(admin).setNft(replacement.address)
                } catch (e) {}

                // Get address
                address = await marketController.getNft();

                // Test
                expect(
                    address === replacement.address,
                    "ADMIN can't set nft address"
                ).is.true;

            });

            it("setEscrowTicketer() should require ADMIN to set the IEscrowTicketer address", async function () {

                // non-ADMIN attempt
                try {
                    await marketController.connect(associate).setEscrowTicketer(replacement.address)
                } catch (e) {}

                // Get address
                address = await marketController.getEscrowTicketer();

                // Test
                expect(
                    address !== replacement.address,
                    "non-ADMIN can set escrow ticketer address"
                ).is.true;

                // ADMIN attempt
                try {
                    await marketController.connect(admin).setEscrowTicketer(replacement.address)
                } catch (e) {}

                // Get address
                address = await marketController.getEscrowTicketer();

                // Test
                expect(
                    address === replacement.address,
                    "ADMIN can't set escrow ticketer address"
                ).is.true;

            });

            it("setVipStakerAmount() should require ADMIN to set the VIP staker amount", async function () {

                // non-ADMIN attempt
                try {
                    await marketController.connect(associate).setVipStakerAmount(replacementAmount);
                } catch (e) {}

                // Get amount
                amount = await marketController.getVipStakerAmount();

                // Test
                expect(
                    amount !== replacementAmount,
                    "non-ADMIN can set VIP staker amount"
                ).is.true;

                // ADMIN attempt
                try {
                    await marketController.connect(admin).setVipStakerAmount(replacementAmount);
                } catch (e) {}

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
                try {
                    await marketController.connect(associate).setFeePercentage(replacementPercentage);
                } catch (e) {}

                // Get percentage
                percentage = await marketController.getFeePercentage();

                // Test
                expect(
                    percentage !== replacementPercentage,
                    "non-ADMIN can set fee percentage"
                ).is.true;

                // ADMIN attempt
                try {
                    await marketController.connect(admin).setFeePercentage(replacementPercentage);
                } catch (e) {}

                // Get percentage
                percentage = await marketController.getFeePercentage();

                // Test
                expect(
                    percentage.toString() === replacementPercentage,
                    "ADMIN can't set fee percentage"
                ).is.true;

            });

            it("setRoyaltyPercentage() should require ADMIN to set the royalty percentage", async function () {

                // non-ADMIN attempt
                try {
                    await marketController.connect(associate).setRoyaltyPercentage(replacementPercentage);
                } catch (e) {}

                // Get percentage
                percentage = await marketController.getRoyaltyPercentage();

                // Test
                expect(
                    percentage !== replacementPercentage,
                    "non-ADMIN can set royalty percentage"
                ).is.true;

                // ADMIN attempt
                try {
                    await marketController.connect(admin).setRoyaltyPercentage(replacementPercentage);
                } catch (e) {}

                // Get percentage
                percentage = await marketController.getRoyaltyPercentage();

                // Test
                expect(
                    percentage.toString() === replacementPercentage,
                    "ADMIN can't set royalty percentage"
                ).is.true;

            });

            it("setMaxRoyaltyPercentage() should require ADMIN to set the max royalty percentage to pay other marketplaces", async function () {

                // non-ADMIN attempt
                try {
                    await marketController.connect(associate).setMaxRoyaltyPercentage(replacementPercentage);
                } catch (e) {}

                // Get percentage
                percentage = await marketController.getMaxRoyaltyPercentage();

                // Test
                expect(
                    percentage !== replacementPercentage,
                    "non-ADMIN can set max royalty percentage"
                ).is.true;

                // ADMIN attempt
                try {
                    await marketController.connect(admin).setMaxRoyaltyPercentage(replacementPercentage);
                } catch (e) {}

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
                try {
                    await marketController.connect(associate).setOutBidPercentage(replacementPercentage);
                } catch (e) {}

                // Get percentage
                percentage = await marketController.getOutBidPercentage();

                // Test
                expect(
                    percentage !== replacementPercentage,
                    "non-ADMIN can set outbid percentage"
                ).is.true;

                // ADMIN attempt
                try {
                    await marketController.connect(admin).setOutBidPercentage(replacementPercentage);
                } catch (e) {}

                // Get percentage
                percentage = await marketController.getOutBidPercentage();

                // Test
                expect(
                    percentage.toString() === replacementPercentage,
                    "ADMIN can't set outbid percentage"
                ).is.true;

            });

        });

        context("Change Events", async function () {

            it("setStaking() should emit a StakingAddressChanged event", async function () {

                // Make change, test event
                await expect(marketController.connect(admin).setStaking(replacement.address))
                    .to
                    .emit(marketController, 'StakingAddressChanged')
                    .withArgs(replacement.address);
            });

            it("setMultisig() should emit a MultisigAddressChanged event", async function () {

                // Make change, test event
                await expect(marketController.connect(admin).setMultisig(replacement.address))
                    .to
                    .emit(marketController, 'MultisigAddressChanged')
                    .withArgs(replacement.address);
            });

            it("setNft() should emit a NFTAddressChanged event", async function () {

                // Make change, test event
                await expect(marketController.connect(admin).setNft(replacement.address))
                    .to
                    .emit(marketController, 'NFTAddressChanged')
                    .withArgs(replacement.address);
            });

            it("setEscrowTicketer() should emit a EscrowTicketerAddressChanged event", async function () {

                // Make change, test event
                await expect(marketController.connect(admin).setEscrowTicketer(replacement.address))
                    .to
                    .emit(marketController, 'EscrowTicketerAddressChanged')
                    .withArgs(replacement.address);
            });

            it("setVipStakerAmount() should emit a VipStakerAmountChanged event", async function () {

                // Make change, test event
                await expect(marketController.connect(admin).setVipStakerAmount(replacementAmount))
                    .to
                    .emit(marketController, 'VipStakerAmountChanged')
                    .withArgs(replacementAmount);
            });

            it("setFeePercentage() should emit a FeePercentageChanged event", async function () {

                // Make change, test event
                await expect(marketController.connect(admin).setFeePercentage(replacementPercentage))
                    .to
                    .emit(marketController, 'FeePercentageChanged')
                    .withArgs(replacementPercentage);
            });

            it("setRoyaltyPercentage() should emit a RoyaltyPercentageChanged event", async function () {

                // Make change, test event
                await expect(marketController.connect(admin).setRoyaltyPercentage(replacementPercentage))
                    .to
                    .emit(marketController, 'RoyaltyPercentageChanged')
                    .withArgs(replacementPercentage);
            });

            it("setMaxRoyaltyPercentage() should emit a RoyaltyPercentageChanged event", async function () {

                // Make change, test event
                await expect(marketController.connect(admin).setMaxRoyaltyPercentage(replacementPercentage))
                    .to
                    .emit(marketController, 'MaxRoyaltyPercentageChanged')
                    .withArgs(replacementPercentage);
            });

            it("setOutBidPercentage() should emit a OutBidPercentageChanged event", async function () {

                // Make change, test event
                await expect(marketController.connect(admin).setOutBidPercentage(replacementPercentage))
                    .to
                    .emit(marketController, 'OutBidPercentageChanged')
                    .withArgs(replacementPercentage);
            });

        });

    });

    context("Consignment Registration", async function () {

        beforeEach( async function () {

            // Prepare for roled access to privileged MarketController methods
            await accessController.connect(deployer).grantRole(Role.MARKET_HANDLER, marketHandler.address);

            // Setup values
            market = Market.PRIMARY;
            tokenId = "13";

        });

        context("Privileged Access", async function () {

            it("registerConsignment() should require ADMIN to register a consignment", async function () {

                nextConsignment = await marketController.getNextConsignment();

                // non-MARKET_HANDLER attempt
                try {
                    await marketController.connect(associate).registerConsignment(market, seller.address, token.address, tokenId);
                } catch (e) {}

                // Get counter
                counter = await marketController.getNextConsignment();

                // Test
                expect(
                    counter.eq(nextConsignment),
                    "non-MARKET_HANDLER can register a consignment"
                ).is.true;

                // MARKET_HANDLER attempt
                try {
                    await marketController.connect(marketHandler).registerConsignment(market, seller.address, token.address, tokenId);
                } catch (e) {}

                // Get counter
                counter = await marketController.getNextConsignment();

                // Test
                expect(
                    counter.gt(nextConsignment),
                    "MARKET_HANDLER can't register a consignment"
                ).is.true;

            });

        });

        context("Change Events", async function () {

            it("registerConsignment() should emit a ConsignmentRegistered event", async function () {

                // Get the expected consignment id
                nextConsignment = await marketController.getNextConsignment();

                // Make change, test event
                await expect(
                    marketController.connect(marketHandler).registerConsignment(market, seller.address, token.address, tokenId)
                ).to
                    .emit(marketController, 'ConsignmentRegistered')
                    .withArgs(
                        [market, seller.address, token.address, tokenId, nextConsignment]
                    );

            });

        });

        context("Reading Consignments", async function () {

            it("getConsignment() should return a valid consignment", async function () {

                // Get the expected consignment id
                nextConsignment = await marketController.getNextConsignment();
                id = nextConsignment.toString();

                // Register consignment
                await marketController.connect(marketHandler).registerConsignment(market, seller.address, token.address, tokenId);

                // Get the consignment
                const response = await marketController.getConsignment(nextConsignment);

                // Convert to entity
                consignment = new Consignment(
                    response.market,
                    response.seller,
                    response.token,
                    response.tokenId.toString(),
                    response.id.toString()
                );

                // Test validity
                expect(
                    consignment.isValid(),
                    "Consignment not valid"
                ).is.true;

                // Test expected values
                expect(consignment.market === market).is.true;
                expect(consignment.seller === seller.address).is.true;
                expect(consignment.token === token.address).is.true;
                expect(consignment.tokenId === tokenId).is.true;
                expect(consignment.id === id).is.true;

            });

        });

    });

});