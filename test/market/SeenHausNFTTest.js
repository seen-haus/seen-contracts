const hre = require("hardhat");
const ethers = hre.ethers;
const { expect } = require("chai");
const Role = require("../../scripts/domain/Role");
const Token = require("../../scripts/domain/Token");
const Market = require("../../scripts/domain/Market");
const MarketHandler = require("../../scripts/domain/MarketHandler");
const Ticketer = require("../../scripts/domain/Ticketer");
const Consignment = require("../../scripts/domain/Consignment");
const { InterfaceIds } = require('../../scripts/constants/supported-interfaces.js');
const { deployMarketDiamond } = require('../../scripts/util/deploy-market-diamond.js');
const { deployMarketClients } = require("../../scripts/util/deploy-market-clients.js");
const { deployMarketControllerFacets } = require('../../scripts/util/deploy-market-controller-facets.js');

/**
 *  Test the SeenHausNFT contract
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
describe("SeenHausNFT", function() {

    // Common vars
    let accounts, deployer, admin, upgrader, escrowAgent, associate, minter, creator, recipient, owner;
    let accessController, marketController;
    let seenHausNFT, seenHausNFTProxy;
    let staking, multisig, vipStakerAmount, feePercentage, maxRoyaltyPercentage, outBidPercentage, defaultTicketerType;
    let counter, tokenURI, tokenId, supply, salePrice, royaltyAmount, expectedRoyalty, percentage, royaltyPercentage;
    let token, isPhysical, balance, uri, invalidRoyaltyPercentage, address, support, consignmentId;
    let replacementAddress = "0x2d36143CC2E0E74E007E7600F341dC9D37D81C07";

    beforeEach( async function () {

        // Make accounts available
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        admin = accounts[1];
        upgrader = accounts[2];
        escrowAgent = accounts[3];
        creator = accounts[4];
        associate = accounts[5];
        minter = accounts[6];
        escrowAgent = accounts[7]
        recipient = accounts[8];
        owner = accounts[9];

        staking = accounts[10];        // We just need addresses for these,
        multisig = accounts[11];      // not functional contracts

        // Market control values
        vipStakerAmount = "500";              // Amount of xSEEN to be l33t
        feePercentage = "1500";               // 15%   = 1500
        maxRoyaltyPercentage = "1500";        // 15%   = 1500
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

        // Temporarily grant UPGRADER role to deployer account
        await accessController.grantRole(Role.UPGRADER, deployer.address);

        // Cut the MarketController facet into the Diamond
        await deployMarketControllerFacets(marketDiamond, marketConfig);

        // Cast Diamond to MarketController
        marketController = await ethers.getContractAt('IMarketController', marketDiamond.address);

        // Deploy the Market Client implementation/proxy pairs
        const marketClientArgs = [accessController.address, marketController.address];
        [impls, proxies, clients] = await deployMarketClients(marketClientArgs);
        [lotsTicketer, itemsTicketer, seenHausNFT] = clients;

        // Cast SeenHausNFT's proxy to IMarketClientProxy
        seenHausNFTProxy = await ethers.getContractAt('IMarketClientProxy', seenHausNFT.address);

        // NFT address gets set after deployment since it requires
        // the MarketController's address in its constructor
        await marketController.setNft(seenHausNFT.address);

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
                support = await seenHausNFT.supportsInterface(InterfaceIds.IERC165);

                // Test
                await expect(
                    support,
                    "ERC-165 interface not supported"
                ).is.true;

            });

            it("should indicate support for ERC-1155 interface", async function () {

                // See https://eips.ethereum.org/EIPS/eip-1155#specification
                support = await seenHausNFT.supportsInterface(InterfaceIds.IERC1155);

                // Test
                await expect(
                    support,
                    "ERC-1155 interface not supported"
                ).is.true;

            });

            it("should indicate support for ERC-2981 interface", async function () {

                // See https://eips.ethereum.org/EIPS/eip-2981#specification
                support = await seenHausNFT.supportsInterface(InterfaceIds.IERC2981);

                // Test
                await expect(
                    support,
                    "ERC-2981 interface not supported"
                ).is.true;

            });

            it("should indicate support for ISeenHausNFT interface", async function () {

                // Current ISeenHausNFT interfaceId
                support = await seenHausNFT.supportsInterface(InterfaceIds.ISeenHausNFT);

                // Test
                await expect(
                    support,
                    "ISeenHausNFT interface not supported"
                ).is.true;

            });

        });

    });

    context("Minting", async function () {

        beforeEach( async function () {

            // Prepare for roled access to privileged methods
            await accessController.connect(admin).grantRole(Role.ESCROW_AGENT, escrowAgent.address);
            await accessController.connect(admin).grantRole(Role.MINTER, minter.address);

            // Setup values
            tokenId = await seenHausNFT.getNextToken();
            tokenURI = "ipfs://QmXBB6qm5vopwJ6ddxb1mEr1Pp87AHd3BUgVbsipCf9hWU";
            supply = "1";
            royaltyPercentage = maxRoyaltyPercentage;

        });

        context("Privileged Access", async function () {

            context("Proxy", async function () {

                // N.B. MarketClientProxy provides storage and accessors for the AccessController and MarketController
                // used by the implementation contract. This is because all the market client contracts need these
                // references, but adding the storage and accessors to them pushes their size toward the upper limit.

                it("setImplementation() should require UPGRADER to set the implementation address", async function () {

                    // non-UPGRADER attempt
                    await expect(
                        seenHausNFTProxy.connect(associate).setImplementation(replacementAddress)
                    ).to.be.revertedWith("Access denied, caller doesn't have role");

                    // Get address
                    address = await seenHausNFTProxy.getImplementation();

                    // Test
                    expect(
                        address !== replacementAddress,
                        "non-UPGRADER can set implementation address"
                    ).is.true;

                    // UPGRADER attempt
                    await seenHausNFTProxy.connect(upgrader).setImplementation(replacementAddress);

                    // Get address
                    address = await seenHausNFTProxy.getImplementation();

                    // Test
                    expect(
                        address === replacementAddress,
                        "UPGRADER can't set implementation address"
                    ).is.true;

                });

                it("setAccessController() should require UPGRADER to set the accessController address", async function () {

                    // non-UPGRADER attempt
                    await expect(
                        seenHausNFTProxy.connect(associate).setAccessController(replacementAddress)
                    ).to.be.revertedWith("Access denied, caller doesn't have role");

                    // Get address
                    address = await seenHausNFTProxy.getAccessController();

                    // Test
                    expect(
                        address !== replacementAddress,
                        "non-UPGRADER can set accessController address"
                    ).is.true;

                    // UPGRADER attempt
                    await seenHausNFTProxy.connect(upgrader).setAccessController(replacementAddress);

                    // Get address
                    address = await seenHausNFTProxy.getAccessController();

                    // Test
                    expect(
                        address === replacementAddress,
                        "UPGRADER can't set accessController address"
                    ).is.true;

                });

                it("setMarketController() should require UPGRADER to set the marketController address", async function () {

                    // non-UPGRADER attempt
                    await expect(
                        seenHausNFTProxy.connect(associate).setMarketController(replacementAddress)
                    ).to.be.revertedWith("Access denied, caller doesn't have role");

                    // Get address
                    address = await seenHausNFTProxy.getMarketController();

                    // Test
                    expect(
                        address !== replacementAddress,
                        "non-UPGRADER can set marketController address"
                    ).is.true;

                    // ADMIN attempt
                    await seenHausNFTProxy.connect(upgrader).setMarketController(replacementAddress);

                    // Get address
                    address = await seenHausNFTProxy.getMarketController();

                    // Test
                    expect(
                        address === replacementAddress,
                        "UPGRADER can't set marketController address"
                    ).is.true;

                });

            });

            context("Logic", async function () {

                it("mintDigital() should require MINTER to mint a digital token", async function () {

                    // non-MINTER attempt
                    await expect(
                        seenHausNFT.connect(associate).mintDigital(supply, creator.address, tokenURI, royaltyPercentage)
                    ).to.be.revertedWith("Access denied, caller doesn't have role");

                    // Get counter
                    counter = await seenHausNFT.getNextToken();

                    // Test
                    expect(
                        counter.eq(tokenId),
                        "non-MINTER can mint a digital token"
                    ).is.true;

                    // MINTER attempt
                    await seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI, royaltyPercentage);

                    // Get counter
                    counter = await seenHausNFT.getNextToken();

                    // Test
                    expect(
                        counter.gt(tokenId),
                        "MINTER can't mint a digital token"
                    ).is.true;

                });

                it("mintPhysical() should require ESCROW_AGENT to mint a physical token", async function () {

                    // non-ESCROW_AGENT attempt
                    await expect(
                        seenHausNFT.connect(associate).mintPhysical(supply, creator.address, tokenURI, royaltyPercentage)
                    ).to.be.revertedWith("Access denied, caller doesn't have role");

                    // Get counter
                    counter = await seenHausNFT.getNextToken();

                    // Test
                    expect(
                        counter.eq(tokenId),
                        "non-ESCROW_AGENT can mint a physical token"
                    ).is.true;

                    // ESCROW_AGENT attempt
                    await seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI, royaltyPercentage);

                    // Get counter
                    counter = await seenHausNFT.getNextToken();

                    // Test
                    expect(
                        counter.gt(tokenId),
                        "ESCROW_AGENT can't mint a digital token"
                    ).is.true;

                });

            });

        });

        context("Change Events", async function () {

            context("mintDigital()", async function () {

                it("should emit a TransferSingle event", async function () {

                    // Get next token id
                    tokenId = await seenHausNFT.getNextToken();

                    // Mint a digital NFT
                    await expect(
                        seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI, royaltyPercentage)
                    ).to.emit(seenHausNFT, 'TransferSingle')
                        .withArgs(
                            minter.address,
                            ethers.constants.AddressZero,
                            marketController.address,
                            tokenId,
                            supply
                        );

                    // Get counter
                    counter = await seenHausNFT.getNextToken();

                    // Test
                    expect(
                        counter.gt(tokenId),
                        "MINTER can't mint a digital token"
                    ).is.true;

                });

                it("should trigger a ConsignmentRegistered event on MarketController", async function () {

                    // Get the next consignment id
                    consignmentId = await marketController.getNextConsignment();

                    // Get next token id
                    tokenId = await seenHausNFT.getNextToken();

                    // Mint a digital NFT
                    await expect(
                        seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI, royaltyPercentage)
                    ).emit(marketController, 'ConsignmentRegistered')
                        .withArgs(
                            minter.address,     // consignor
                            creator.address,    // seller
                            [ // Consignment
                                Market.PRIMARY,
                                MarketHandler.UNHANDLED,
                                creator.address,
                                seenHausNFT.address,
                                tokenId,
                                supply,
                                consignmentId
                            ]
                        )

                    // Get counter
                    counter = await seenHausNFT.getNextToken();

                    // Test
                    expect(
                        counter.gt(tokenId),
                        "MINTER can't mint a digital token"
                    ).is.true;

                });

            });

            context("mintPhysical()", async function () {

                it("should emit a TransferSingle event", async function () {

                    // Get next token id
                    tokenId = await seenHausNFT.getNextToken();

                    // Mint a digital NFT
                    await expect(
                        seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI, royaltyPercentage)
                    ).to.emit(seenHausNFT, 'TransferSingle')
                        .withArgs(
                            escrowAgent.address,
                            ethers.constants.AddressZero,
                            marketController.address,
                            tokenId,
                            supply
                        );

                    // Get counter
                    counter = await seenHausNFT.getNextToken();

                    // Test
                    expect(
                        counter.gt(tokenId),
                        "MINTER can't mint a digital token"
                    ).is.true;

                });

                it("should trigger a ConsignmentRegistered event on MarketController", async function () {

                    // Get the next consignment id
                    consignmentId = await marketController.getNextConsignment();

                    // Get next token id
                    tokenId = await seenHausNFT.getNextToken();

                    // Mint a digital NFT
                    await expect(
                        seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI, royaltyPercentage)
                    ).emit(marketController, 'ConsignmentRegistered')
                        .withArgs(
                            escrowAgent.address,     // consignor
                            creator.address,    // seller
                            [ // Consignment
                                Market.PRIMARY,
                                MarketHandler.UNHANDLED,
                                creator.address,
                                seenHausNFT.address,
                                tokenId,
                                supply,
                                consignmentId
                            ]
                        )

                    // Get counter
                    counter = await seenHausNFT.getNextToken();

                    // Test
                    expect(
                        counter.gt(tokenId),
                        "MINTER can't mint a digital token"
                    ).is.true;

                });

            });

        });

        context("Market Handler Assignment", async function () {

            it("Assigns a marketHandler of Unhandled to a consignment immediately after mintDigital", async function () {

                // Get the next consignment id
                consignmentId = await marketController.getNextConsignment();

                // Get next token id
                tokenId = await seenHausNFT.getNextToken();

                // Mint a digital NFT
                await expect(
                    seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI, royaltyPercentage)
                ).emit(marketController, 'ConsignmentRegistered')
                    .withArgs(
                        minter.address,     // consignor
                        creator.address,    // seller
                        [ // Consignment
                            Market.PRIMARY,
                            MarketHandler.UNHANDLED,
                            creator.address,
                            seenHausNFT.address,
                            tokenId,
                            supply,
                            consignmentId
                        ]
                    )

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
                    response.released
                );

                // Consignment should have a market handler of MarketHandler.Unhandled
                expect(consignment.marketHandler === MarketHandler.UNHANDLED).is.true;

            });

            it("Assigns a marketHandler of Unhandled to a consignment immediately after mintPhysical", async function () {

                // Get the next consignment id
                consignmentId = await marketController.getNextConsignment();

                // Get next token id
                tokenId = await seenHausNFT.getNextToken();

                // Mint a physical NFT
                await expect(
                    seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI, royaltyPercentage)
                ).emit(marketController, 'ConsignmentRegistered')
                    .withArgs(
                        escrowAgent.address,     // consignor
                        creator.address,    // seller
                        [ // Consignment
                            Market.PRIMARY,
                            MarketHandler.UNHANDLED,
                            creator.address,
                            seenHausNFT.address,
                            tokenId,
                            supply,
                            consignmentId
                        ]
                    )

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
                    response.released
                );

                // Consignment should have a market handler of MarketHandler.Unhandled
                expect(consignment.marketHandler === MarketHandler.UNHANDLED).is.true;

            });

        });

        context("Digital vs Physical NFTs", async function () {

            it("mintDigital() should not record a physical aspect for the token", async function () {

                // MINTER creates token for creator
                await seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI, royaltyPercentage);

                // Get physical status
                isPhysical = await seenHausNFT.isPhysical(tokenId);

                // Test
                expect(
                    isPhysical,
                    "Physical aspect recorded for digital token"
                ).is.false;

            });

            it("mintPhysical() should record the physical aspect for the token", async function () {

                // ESCROW_AGENT creates token for creator
                await seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI, royaltyPercentage);

                // Get physical status
                isPhysical = await seenHausNFT.isPhysical(tokenId);

                // Test
                expect(
                    isPhysical,
                    "Physical aspect not recorded"
                ).is.true;

            });

        });

        context("Token URIs", async function () {

            it("mintDigital() should record the URI for the token", async function () {

                // MINTER creates token for creator
                await seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI, royaltyPercentage);

                // Get token URI
                uri = await seenHausNFT.uri(tokenId);

                // Test
                expect(
                    uri === tokenURI,
                    "URI not recorded for digital token"
                ).is.true;

            });

            it("mintPhysical() should record the URI for the token", async function () {

                // ESCROW_AGENT creates token for creator
                await seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI, royaltyPercentage);

                // Get physical status
                uri = await seenHausNFT.uri(tokenId);

                // Test
                expect(
                    uri === tokenURI,
                    "URI not recorded for physical token"
                ).is.true;

            });

        });

        context("MarketController Receives Token Balance", async function () {

            it("mintDigital() should send token balance to MarketController", async function () {

                // MINTER creates token for creator
                await seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI, royaltyPercentage);

                // Get MarketController balance
                balance = await seenHausNFT.balanceOf(marketController.address, tokenId);

                // Test
                expect(
                    balance.toString() === supply,
                    "Tokens not sent to marketplace"
                ).is.true;

            });

            it("mintPhysical() should send token balance to MarketController", async function () {

                // ESCROW_AGENT creates token for creator
                await seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI, royaltyPercentage);

                // Get MarketController balance
                balance = await seenHausNFT.balanceOf(marketController.address, tokenId);

                // Test
                expect(
                    balance.toString() === supply,
                    "Tokens not sent to marketplace"
                ).is.true;

            });

        });

        context("Creator Tracking and Royalties", async function () {

            it("mintDigital() should record the token creator, royalty percentage, supply, and URI", async function () {

                // MINTER creates token for creator
                await seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI, royaltyPercentage);

                // Get token info
                const response = await seenHausNFT.getTokenInfo(tokenId);

                // Convert to entity
                token = new Token(
                    response.creator,
                    response.royaltyPercentage.toString(),
                    response.isPhysical,
                    response.id.toString(),
                    response.supply.toString(),
                    response.uri
                );

                // Test validity
                expect(
                    token.isValid(),
                    "Token not valid"
                ).is.true;

                // Test expected values
                expect(token.creator === creator.address).is.true;
                expect(token.royaltyPercentage === royaltyPercentage).is.true;
                expect(token.isPhysical === false).is.true;
                expect(token.id === tokenId.toString()).is.true;
                expect(token.supply === supply).is.true;
                expect(token.uri === tokenURI).is.true;

            });

            it("mintPhysical() should record the creator address for the token", async function () {

                // ESCROW_AGENT creates token for creator
                await seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI, royaltyPercentage);

                // Get token info
                const response = await seenHausNFT.getTokenInfo(tokenId);

                // Convert to entity
                token = new Token(
                    response.creator,
                    response.royaltyPercentage.toString(),
                    response.isPhysical,
                    response.id.toString(),
                    response.supply.toString(),
                    response.uri
                );

                // Test validity
                expect(
                    token.isValid(),
                    "Token not valid"
                ).is.true;

                // Test expected values
                expect(token.creator === creator.address).is.true;
                expect(token.royaltyPercentage === royaltyPercentage).is.true;
                expect(token.isPhysical === true).is.true;
                expect(token.id === tokenId.toString()).is.true;
                expect(token.supply === supply).is.true;
                expect(token.uri === tokenURI).is.true;

            });

            it("royaltyInfo() should return creator address and correct royalty amount", async function () {

                // Set sale price
                salePrice = ethers.utils.parseUnits("1.5", "ether");

                // Determine expected royalty
                // N.B. Percentage values are stored as an unsigned int by multiplying the percentage by 100
                // e.g, 1.75% = 175, 100% = 10000
                // Thus, after multiplying royalty percentage by sale price, we must divide by 10000
                percentage = ethers.BigNumber.from(royaltyPercentage);
                expectedRoyalty = percentage.mul(salePrice).div(10000);

                // MINTER creates token for creator
                await seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI, royaltyPercentage);

                // Get royalty info
                [recipient, royaltyAmount] = await seenHausNFT.royaltyInfo(tokenId, salePrice);

                // Test
                expect(
                    recipient === creator.address,
                    "Wrong royalty recipient"
                ).is.true;

                expect(
                    royaltyAmount.toString() === expectedRoyalty.toString(),
                    "Incorrect royalty amount"
                ).is.true;

            });

        });

        context("Revert Reasons", async function () {

            beforeEach( async function () {

                invalidRoyaltyPercentage = ethers.BigNumber.from(maxRoyaltyPercentage).mul("2");

            });

            it("mintDigital() should revert if royalty percentage exceeds maximum", async function () {

                // MINTER attempts to mint with royalty invalid royalty percentage
                await expect(
                    seenHausNFT.connect(minter).mintDigital(supply, creator.address, tokenURI, invalidRoyaltyPercentage)
                ).to.be.revertedWith("Royalty percentage exceeds marketplace maximum")


            });

            it("mintPhysical() should revert if royalty percentage exceeds maximum", async function () {

                // MINTER attempts to mint with royalty invalid royalty percentage
                await expect(
                    seenHausNFT.connect(escrowAgent).mintPhysical(supply, creator.address, tokenURI, invalidRoyaltyPercentage)
                ).to.be.revertedWith("Royalty percentage exceeds marketplace maximum")

            });

        });

    });

});