/**
 * Seen.Haus contract suite deployment script
 * @author Cliff Hall <cliff@futurescale.com>
 */
const Role = require("../domain/Role");
const hre = require("hardhat");
const Ticketer = require("../domain/Ticketer");
const { deployDiamond } = require('./util/deploy-diamond.js');
const { deployMarketControllerFacets } = require('./util/deploy-market-controller-facets.js');
const { deployMarketHandlerFacets } = require('./util/deploy-market-handler-facets.js');

const ethers = hre.ethers;
let contract, contracts = [];
const divider = "-".repeat(80);

// TODO: DISCUSS TO GET INITIAL SETTINGS FOR ALL THESE PARAMS
function getConfig() {

    // Get the network we're deploying to
    const network = hre.network.name;

    // Market configuration params
    const vipStakerAmount = "500";
    const feePercentage = "20";
    const maxRoyaltyPercentage = "50";
    const outBidPercentage = "5";
    const defaultTicketerType = Ticketer.ITEMS;  // default escrow ticketer type

    // Staking contract address
    const STAKING = {
        'mainnet': '0x38747baf050d3c22315a761585868dba16abfd89',
        'rinkeby': '0x0000000000000000000000000000000000000000',
        'hardhat': '0x0000000000000000000000000000000000000000'
    }

    // Multisig contract address
    const MULTISIG = {
        'mainnet': '0x4a25E18076DDcFd646ED14ABC07286c2A4c1256A',
        'rinkeby': '0x0000000000000000000000000000000000000000',
        'hardhat': '0x0000000000000000000000000000000000000000'
    }

    return {
            staking: STAKING[network],
            multisig: MULTISIG[network],
            vipStakerAmount,
            feePercentage,
            maxRoyaltyPercentage,
            outBidPercentage,
            defaultTicketerType
        };
}

async function main() {

    // Compile everything (in case run by node)
    await hre.run('compile');

    console.log(`${divider}\nSeen Haus Contract Suite Deployer\n${divider}`);
    console.log(`⛓  Network: ${hre.network.name}\n📅 ${new Date()}`);

    // Get the market config
    const config = getConfig();

    // Get the accounts
    const accounts = await ethers.provider.listAccounts();
    const deployer = accounts[0];
    console.log("🔱 Deployer account: ", deployer ? deployer : "not found" && process.exit());
    console.log(divider);

    console.log(`💎 Deploying Diamond and Jeweler's Facets...`);

    // Deploy the Diamond
    [diamond, dlf, dcf, accessController, diamondArgs] = await deployDiamond();

    // Report completion of Diamond and its core facets
    deploymentComplete('AccessController', accessController.address, []);
    deploymentComplete('DiamondLoupeFacet', dlf.address, []);
    deploymentComplete('DiamondCutFacet', dcf.address, []);
    deploymentComplete('Diamond', diamond.address, diamondArgs);

    // Prepare MarketController initialization arguments
    const marketConfig = [
        config.staking,
        config.multisig,
        config.vipStakerAmount,
        config.feePercentage,
        config.maxRoyaltyPercentage,
        config.outBidPercentage,
        config.defaultTicketerType
    ];

    console.log(`\n💎 Deploying Marketplace Facets...`);

    // Cut the MarketController facet into the Diamond
    [marketConfigFacet, marketClerkFacet] = await deployMarketControllerFacets(diamond, marketConfig);
    deploymentComplete('MarketConfigFacet', marketConfigFacet.address, []);
    deploymentComplete('MarketClerkFacet', marketClerkFacet.address, []);

    // Cut the Market Handler facets into the Diamond
    [auctionBuilderFacet, auctionRunnerFacet, saleBuilderFacet, saleRunnerFacet] = await deployMarketHandlerFacets(diamond);
    deploymentComplete('AuctionBuilderFacet', auctionBuilderFacet.address, []);
    deploymentComplete('AuctionRunnerFacet', auctionRunnerFacet.address, []);
    deploymentComplete('SaleBuilderFacet', saleBuilderFacet.address, []);
    deploymentComplete('SaleRunnerFacet', saleRunnerFacet.address, []);

    console.log(`\n🎟 Deploying Ticketer contracts...`);

    // Deploy the chosen LotsTicketer IEscrowTicketer implementation
    const LotsTicketer = await ethers.getContractFactory("LotsTicketer");
    const lotsTicketer = await LotsTicketer.deploy(
        accessController.address,
        diamond.address
    );
    await lotsTicketer.deployed();
    deploymentComplete("LotsTicketer", lotsTicketer.address, [
        accessController.address,
        diamond.address
    ]);

    // Deploy the chosen ItemsTicketer IEscrowTicketer implementation
    const ItemsTicketer = await ethers.getContractFactory("ItemsTicketer");
    const itemsTicketer = await ItemsTicketer.deploy(
        accessController.address,
        diamond.address
    );
    await itemsTicketer.deployed();
    deploymentComplete("ItemsTicketer", itemsTicketer.address, [
        accessController.address,
        diamond.address
    ]);

    console.log(`\n🖼 Deploying Seen Haus NFT contract...`);

    // Deploy the SeenHausNFT contract
    const SeenHausNFT = await ethers.getContractFactory("SeenHausNFT");
    const seenHausNFT = await SeenHausNFT.deploy(
        accessController.address,
        diamond.address,
    );
    await seenHausNFT.deployed();
    deploymentComplete('SeenHausNFT', seenHausNFT.address, [
        accessController.address,
        diamond.address
    ]);

    console.log(`\n🌐️Configuring and granting roles...`);

    // Cast Diamond to the supported interfaces we need to interact with it
    const marketController = await ethers.getContractAt('IMarketController', diamond.address);

    // Add Escrow Ticketer and NFT addresses to MarketController
    await marketController.setNft(seenHausNFT.address);
    await marketController.setLotsTicketer(lotsTicketer.address);
    await marketController.setItemsTicketer(itemsTicketer.address);
    console.log(`✅ MarketController updated with NFT and Escrow Ticketer addresses.`);

    // Add MARKET_HANDLER role to contracts that need it
    await accessController.grantRole(Role.MARKET_HANDLER, diamond.address); // Market handlers live behind diamond now
    await accessController.grantRole(Role.MARKET_HANDLER, itemsTicketer.address);
    await accessController.grantRole(Role.MARKET_HANDLER, lotsTicketer.address);
    await accessController.grantRole(Role.MARKET_HANDLER, seenHausNFT.address);
    console.log(`✅ Granted MARKET_HANDLER role to appropriate contracts.`);

    // Bail now if deploying locally
    if (hre.network.name === 'hardhat') process.exit();

    // Wait a minute after deployment completes and then verify contracts on etherscan
    console.log('⏲ Pause one minute, allowing deployments to propagate to Etherscan backend...');
    await delay(60000).then(
        async () => {
            console.log('🔍 Verifying contracts on Etherscan...');
            while(contracts.length) {
                contract = contracts.shift()
                await verifyOnEtherscan(contract);
            }
        }
    );

    console.log("\n");
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function deploymentComplete(name, address, args) {
    contracts.push({name, address, args});
    console.log(`✅ ${name} deployed to: ${address}`);
}

async function verifyOnEtherscan(contract) {
    console.log(`\n📋 Verifying ${contract.name}`);
    try {
        await hre.run("verify:verify", {
            address: contract.address,
            constructorArguments: contract.args,
        })
    } catch (e) {
        console.log(`❌ Failed to verify ${contract.name} on etherscan. ${e.message}`);
    }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
