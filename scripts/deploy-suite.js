const environments = require('../environments');
const hre = require("hardhat");
const ethers = hre.ethers;
const network = hre.network.name;
const gasLimit = environments.gasLimit;

const Role = require("./domain/Role");
const Ticketer = require("./domain/Ticketer");
const { deployMarketDiamond } = require('./util/deploy-market-diamond.js');
const { deployMarketClients } = require('./util/deploy-market-clients.js');
const { deployMarketHandlerFacets } = require('./util/deploy-market-handler-facets.js');
const { deployMarketControllerFacets } = require('./util/deploy-market-controller-facets.js');
const { delay, deploymentComplete, verifyOnEtherscan } = require("./util/report-verify-deployments");

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

    console.log(`💎 Deploying AccessController, MarketDiamond, and Diamond utility facets...`);

    // Deploy the Diamond
    [marketDiamond, dlf, dcf, accessController, diamondArgs] = await deployMarketDiamond(gasLimit);
    deploymentComplete('AccessController', accessController.address, [], contracts);
    deploymentComplete('DiamondLoupeFacet', dlf.address, [], contracts);
    deploymentComplete('DiamondCutFacet', dcf.address, [], contracts);
    deploymentComplete('MarketDiamond', marketDiamond.address, diamondArgs, contracts);

    console.log(`\n💎 Deploying and initializing Marketplace facets...`);

    // Cut the MarketController facet into the Diamond
    const marketConfig = [
        config.staking,
        config.multisig,
        config.vipStakerAmount,
        config.feePercentage,
        config.maxRoyaltyPercentage,
        config.outBidPercentage,
        config.defaultTicketerType
    ];
    [marketConfigFacet, marketClerkFacet] = await deployMarketControllerFacets(marketDiamond, marketConfig, gasLimit);
    deploymentComplete('MarketConfigFacet', marketConfigFacet.address, [], contracts);
    deploymentComplete('MarketClerkFacet', marketClerkFacet.address, [], contracts);

    // Cast Diamond to the IMarketController interface for further interaction with it
    const marketController = await ethers.getContractAt('IMarketController', marketDiamond.address);

    // Cut the Market Handler facets into the Diamond
    [auctionBuilderFacet, auctionRunnerFacet, saleBuilderFacet, saleRunnerFacet] = await deployMarketHandlerFacets(marketDiamond, gasLimit);
    deploymentComplete('AuctionBuilderFacet', auctionBuilderFacet.address, [], contracts);
    deploymentComplete('AuctionRunnerFacet', auctionRunnerFacet.address, [], contracts);
    deploymentComplete('SaleBuilderFacet', saleBuilderFacet.address, [], contracts);
    deploymentComplete('SaleRunnerFacet', saleRunnerFacet.address, [], contracts);

    console.log(`\n⧉ Deploying Market Client implementation/proxy pairs...`);

    // Deploy the Market Client implementation/proxy pairs
    const marketClientArgs = [accessController.address, marketController.address];
    [impls, proxies, clients] = await deployMarketClients(marketClientArgs, gasLimit);
    [lotsTicketerImpl, itemsTicketerImpl, seenHausNFTImpl] = impls;
    [lotsTicketerProxy, itemsTicketerProxy, seenHausNFTProxy] = proxies;
    [lotsTicketer, itemsTicketer, seenHausNFT] = clients;

    // Gather the complete args that were used to create the proxies
    const itemsTicketerProxyArgs = [...marketClientArgs,itemsTicketerImpl.address];
    const lotsTicketerProxyArgs = [...marketClientArgs,lotsTicketerImpl.address];
    const seenHausNFTProxyArgs = [...marketClientArgs,seenHausNFTImpl.address];

    // Report and prepare for verification
    deploymentComplete("ItemsTicketer Logic", lotsTicketerImpl.address, [], contracts);
    deploymentComplete("LotsTicketer Logic", itemsTicketerImpl.address, [], contracts);
    deploymentComplete("SeenHausNFT Logic", seenHausNFTImpl.address, [], contracts);
    deploymentComplete("ItemsTicketer Proxy", lotsTicketerProxy.address, itemsTicketerProxyArgs, contracts);
    deploymentComplete("LotsTicketer Proxy", itemsTicketerProxy.address, lotsTicketerProxyArgs, contracts);
    deploymentComplete("SeenHausNFT Proxy", seenHausNFTProxy.address, seenHausNFTProxyArgs, contracts);

    console.log(`\n🌐️Configuring and granting roles...`);

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
