const hre = require("hardhat");
const ethers = hre.ethers;
const { expect } = require("chai");
const Role = require("../../domain/Role");
const Market = require("../../domain/Market");
const Consignment = require("../../domain/Consignment");
const Ticketer = require("../../domain/Ticketer");

describe("MarketController", function() {

    // Common vars
    let accounts, deployer, admin, marketHandler, associate, seller, escrowAgent;
    let AccessController, accessController;
    let MarketController, marketController;
    let staking, multisig, vipStakerAmount, feePercentage, maxRoyaltyPercentage, outBidPercentage, defaultTicketerType;
    let lotsTicketer, itemsTicketer, nft;
    let address, amount, percentage, counter, market, token, tokenId, id, consignment, nextConsignment, escrowTicketer, escrowTicketerType;
    let replacementAmount, replacementPercentage;
    let replacementAddress = "0x2d36143CC2E0E74E007E7600F341dC9D37D81C07";
    let tooLittle,tooMuch, revertReason;

    beforeEach( async function () {

        // Make accounts available
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        admin = accounts[1];
        seller = accounts[2];
        associate = accounts[3];
        escrowAgent = accounts[4];

        staking = accounts[5];        // We just need addresses for these,
        multisig = accounts[6];       // not functional contracts
        nft = accounts[7];            // .
        token = accounts[8];          // .
        lotsTicketer = accounts[9];   // .
        itemsTicketer = accounts[10]; // .
        marketHandler = accounts[11]; // .

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

        // Escrow Ticketer and NFT addresses get set after deployment since
        // they require the MarketController's address in their constructors
        await marketController.setNft(nft.address);
        await marketController.setLotsTicketer(lotsTicketer.address);
        await marketController.setItemsTicketer(itemsTicketer.address);

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
            await accessController.connect(deployer).grantRole(Role.ADMIN, admin.address);

            // Unique replacement values
            replacementAmount = "250";
            replacementPercentage = "3000";

        });

        context("Privileged Access", async function () {

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

            it("setNft() should require ADMIN to set the nft address", async function () {

                // non-ADMIN attempt
                await expect(
                    marketController.connect(associate).setNft(replacementAddress)
                ).to.be.revertedWith("Access denied, caller doesn't have role");

                // Get address
                address = await marketController.getNft();

                // Test
                expect(
                    address !== replacementAddress,
                    "non-ADMIN can set nft address"
                ).is.true;

                // ADMIN attempt
                await marketController.connect(admin).setNft(replacementAddress)

                // Get address
                address = await marketController.getNft();

                // Test
                expect(
                    address === replacementAddress,
                    "ADMIN can't set nft address"
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
            await accessController.connect(deployer).grantRole(Role.MARKET_HANDLER, marketHandler.address);
            await accessController.connect(deployer).grantRole(Role.ESCROW_AGENT, escrowAgent.address);

            // Setup values
            market = Market.PRIMARY;
            tokenId = "13";

        });

        context("Privileged Access", async function () {

            it("registerConsignment() should require MARKET_HANDLER role", async function () {

                nextConsignment = await marketController.getNextConsignment();

                // non-MARKET_HANDLER attempt
                await expect(
                    marketController.connect(associate).registerConsignment(market, seller.address, token.address, tokenId)
                ).to.be.revertedWith("Access denied, caller doesn't have role");


                // Get counter
                counter = await marketController.getNextConsignment();

                // Test
                expect(
                    counter.eq(nextConsignment),
                    "non-MARKET_HANDLER can register a consignment"
                ).is.true;

                // MARKET_HANDLER attempt
                await marketController.connect(marketHandler).registerConsignment(market, seller.address, token.address, tokenId);

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
                await marketController.connect(marketHandler).registerConsignment(market, seller.address, token.address, tokenId)

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
                    marketController.connect(marketHandler).registerConsignment(market, seller.address, token.address, tokenId)
                ).to.emit(marketController, 'ConsignmentRegistered')
                    .withArgs(
                        [market, seller.address, token.address, tokenId, nextConsignment]
                    );

            });

            it("setConsignmentTicketer() should emit a ConsignmentTicketerChanged event", async function () {

                // Get the next consignment id
                nextConsignment = await marketController.getNextConsignment();

                // Register a consignment
                await marketController.connect(marketHandler).registerConsignment(market, seller.address, token.address, tokenId)

                // ESCROW_AGENT sets consignment's ticketer type
                await expect(
                    marketController.connect(escrowAgent).setConsignmentTicketer(nextConsignment, Ticketer.ITEMS)
                ).to.emit(marketController, 'ConsignmentTicketerChanged')
                    .withArgs(nextConsignment, Ticketer.ITEMS);
            });

        });

        context("Revert Reasons", async function () {

            it("setConsignmentTicketer() should revert if consignment id is invalid", async function () {

                revertReason = "Invalid consignment id.";

                // Get the next consignment id
                nextConsignment = await marketController.getNextConsignment();

                // ESCROW_AGENT sets ticketer type for consignment not yet created
                await expect(
                    marketController.connect(escrowAgent).setConsignmentTicketer(nextConsignment, Ticketer.ITEMS)
                ).to.be.revertedWith(revertReason);
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
                    response.tokenAddress,
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
                expect(consignment.tokenAddress === token.address).is.true;
                expect(consignment.tokenId === tokenId).is.true;
                expect(consignment.id === id).is.true;

            });

            it("getEscrowTicketer() should return the default escrow ticketer if not set for given consignment", async function () {

                // Get the expected consignment id
                nextConsignment = await marketController.getNextConsignment();

                // Register consignment
                await marketController.connect(marketHandler).registerConsignment(market, seller.address, token.address, tokenId);

                // Get the ticketer for this consignment
                escrowTicketer = await marketController.getEscrowTicketer(nextConsignment);

                // Test
                expect(
                    escrowTicketer === lotsTicketer.address,
                    "getConsignmentTicketer returned the wrong ticketer"
                ).is.true;

            });

            it("getEscrowTicketer() should return the specified escrow ticketer for given consignment if set", async function () {

                // Get the expected consignment id
                nextConsignment = await marketController.getNextConsignment();

                // Register consignment
                await marketController.connect(marketHandler).registerConsignment(market, seller.address, token.address, tokenId);

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

    });

});