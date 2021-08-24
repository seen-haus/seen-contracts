const environments = require('../environments');
const hre = require("hardhat");
const ethers = hre.ethers;
const network = hre.network.name;
const gasLimit = environments.gasLimit;

const Role = require("./domain/Role");
const Ticketer = require("./domain/Ticketer");
const { deployMarketDiamond } = require('./util/deploy-market-diamond.js');
const { deployMarketControllerFacets } = require('./util/deploy-market-controller-facets.js');
const { deployMarketHandlerFacets } = require('./util/deploy-market-handler-facets.js');
const { deployMarketClients } = require('./util/deploy-market-clients.js');
const {delay, deploymentComplete, verifyOnEtherscan} = require("./util/report-verify-deployments");

/**
 * Deploy Seen.Haus contract suite
 *
 * N.B. Run with the appropriate npm script in package.json
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */

// TODO: DISCUSS TO GET INITIAL SETTINGS FOR ALL THESE PARAMS
function getConfig() {

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

    // Deployed contracts
    let contracts = [];

    // Output script header
    const divider = "-".repeat(80);
    console.log(`${divider}\nSeen Haus Contract Suite Deployer\n${divider}`);
    console.log(`⛓  Network: ${hre.network.name}\n📅 ${new Date()}`);

    // Get the market config
    const config = getConfig();

    // Get the accounts
    const accounts = await ethers.provider.listAccounts();
    const deployer = accounts[0];
    console.log("🔱 Deployer account: ", deployer ? deployer : "not found" && process.exit());
    console.log(divider);

    console.log(`💎 Deploying AccessController, MarketDiamond, and core facets...`);

    // Deploy the Diamond
    [marketDiamond, dlf, dcf, accessController, diamondArgs] = await deployMarketDiamond(gasLimit);

    // Report completion of Diamond and its core facets
    deploymentComplete('AccessController', accessController.address, [], contracts);
    deploymentComplete('DiamondLoupeFacet', dlf.address, [], contracts);
    deploymentComplete('DiamondCutFacet', dcf.address, [], contracts);
    deploymentComplete('MarketDiamond', marketDiamond.address, diamondArgs, contracts);

    console.log(`\n💎 Deploying and initializing Marketplace facets...`);

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

    // Cut the MarketController facet into the Diamond
    [marketConfigFacet, marketClerkFacet] = await deployMarketControllerFacets(marketDiamond, marketConfig, gasLimit);
    deploymentComplete('MarketConfigFacet', marketConfigFacet.address, [], contracts);
    deploymentComplete('MarketClerkFacet', marketClerkFacet.address, [], contracts);

    // Cut the Market Handler facets into the Diamond
    [auctionBuilderFacet, auctionRunnerFacet, saleBuilderFacet, saleRunnerFacet] = await deployMarketHandlerFacets(marketDiamond, gasLimit);
    deploymentComplete('AuctionBuilderFacet', auctionBuilderFacet.address, [], contracts);
    deploymentComplete('AuctionRunnerFacet', auctionRunnerFacet.address, [], contracts);
    deploymentComplete('SaleBuilderFacet', saleBuilderFacet.address, [], contracts);
    deploymentComplete('SaleRunnerFacet', saleRunnerFacet.address, [], contracts);

    console.log(`\n🎟 Deploying Market Clients...`);

    // Prepare MarketClient initialization arguments
    const marketClientArgs = [accessController.address, marketDiamond.address];
    [lotsTicketer, itemsTicketer, seenHausNFT] = await deployMarketClients(marketClientArgs, gasLimit);
/*
    // Deploy the chosen LotsTicketer IEscrowTicketer implementation
    const LotsTicketer = await ethers.getContractFactory("LotsTicketer");
    const lotsTicketer = await LotsTicketer.deploy(...marketClientArgs, {gasLimit});
    await lotsTicketer.deployed();
    deploymentComplete("LotsTicketer", lotsTicketer.address, marketClientArgs, contracts);

    // Deploy the chosen ItemsTicketer IEscrowTicketer implementation
    const ItemsTicketer = await ethers.getContractFactory("ItemsTicketer");
    const itemsTicketer = await ItemsTicketer.deploy(...marketClientArgs, {gasLimit});
    await itemsTicketer.deployed();
    deploymentComplete("ItemsTicketer", itemsTicketer.address, marketClientArgs, contracts);

    console.log(`\n🖼 Deploying Seen Haus NFT contract...`);

    // Deploy the SeenHausNFT contract
    const SeenHausNFT = await ethers.getContractFactory("SeenHausNFT");
    const seenHausNFT = await SeenHausNFT.deploy(...marketClientArgs, {gasLimit});
    await seenHausNFT.deployed();
*/
    deploymentComplete("ItemsTicketer", itemsTicketer.address, marketClientArgs, contracts);
    deploymentComplete("LotsTicketer", lotsTicketer.address, marketClientArgs, contracts);
    deploymentComplete('SeenHausNFT', seenHausNFT.address, marketClientArgs, contracts);

    console.log(`\n🌐️Configuring and granting roles...`);

    // Cast Diamond to the supported interfaces we need to interact with it
    const marketController = await ethers.getContractAt('IMarketController', marketDiamond.address);

    // Add Escrow Ticketer and NFT addresses to MarketController
    await marketController.setNft(seenHausNFT.address);
    await marketController.setLotsTicketer(lotsTicketer.address);
    await marketController.setItemsTicketer(itemsTicketer.address);
    console.log(`✅ MarketController updated with remaining post-initialization config.`);

    // Add roles to contracts and addresses that need it
    await accessController.grantRole(Role.MARKET_HANDLER, marketDiamond.address); // Market handlers live behind MarketDiamond now
    await accessController.grantRole(Role.MARKET_HANDLER, itemsTicketer.address);
    await accessController.grantRole(Role.MARKET_HANDLER, lotsTicketer.address);
    await accessController.grantRole(Role.MARKET_HANDLER, seenHausNFT.address);
    console.log(`✅ Granted roles to appropriate contract and addresses.`);

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

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
