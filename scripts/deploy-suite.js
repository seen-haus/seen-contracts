const environments = require('../environments');
const BigNumber = require('bignumber.js');
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
    const primaryFeePercentage = "500"; // 5%   = 500
    const secondaryFeePercentage = "250"; // 2.5%   = 250
    const maxRoyaltyPercentage = "1500"; // 25%   = 2500
    const outBidPercentage = "500"; // 5%   = 500
    const defaultTicketerType = Ticketer.ITEMS;  // default escrow ticketer type
    const allowExternalTokensOnSecondary = false;

    // Staking contract address
    const STAKING = {
        'mainnet': '0x1c436a02ea4c17522e656f730537d68f71fab92c',
        'rinkeby': '0xBFC6ab6E8C3C57e57d4D63Efb054E82b0bAFDE39',
        'goerli': '0xBFC6ab6E8C3C57e57d4D63Efb054E82b0bAFDE39',
        'hardhat': '0x0000000000000000000000000000000000000000'
    }

    // Multisig contract address
    const MULTISIG = {
        'mainnet': '0x4a25E18076DDcFd646ED14ABC07286c2A4c1256A',
        'rinkeby': '0x61a07a05aade27c162e07400b6c201A9E9627604',
        'goerli': '0xBFC6ab6E8C3C57e57d4D63Efb054E82b0bAFDE39',
        'hardhat': '0x0000000000000000000000000000000000000000'
    }

    return {
            staking: STAKING[network],
            multisig: MULTISIG[network],
            vipStakerAmount,
            primaryFeePercentage,
            secondaryFeePercentage,
            maxRoyaltyPercentage,
            outBidPercentage,
            defaultTicketerType,
            allowExternalTokensOnSecondary
        };
}

async function main() {

    const sleep = (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    const awaitAcceptableGas = async (maxAcceptableGasPrice, isFirstRun = true) => {
        let pendingBlock = await hre.network.provider.send("eth_getBlockByNumber", ["pending", false]);
        let baseFeePerGasInGwei = pendingBlock.baseFeePerGas
        let gasInEther = ethers.utils.formatUnits(baseFeePerGasInGwei, "gwei");
        let integerValue = Number(new BigNumber(gasInEther).integerValue(BigNumber.ROUND_CEIL));
        if(integerValue && integerValue <= maxAcceptableGasPrice) {
            console.log(`Gas price (${integerValue}) ${isFirstRun ? 'is' : 'has gone'} below maximum allowed gas price (${maxAcceptableGasPrice}), moving on with transactions...`);
            return true;
        } else {
            console.log(`Gas price (${integerValue}) higher than maximum allowed gas price (${maxAcceptableGasPrice}), waiting...`);
            await sleep(7000);
            await awaitAcceptableGas(maxAcceptableGasPrice, false);
        }
    }

    let tx;

    // Set target max gas price
    let maxAcceptableGasPrice = 35;

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
    [marketDiamond, dlf, dcf, accessController, diamondArgs] = await deployMarketDiamond(gasLimit, awaitAcceptableGas, maxAcceptableGasPrice);
    deploymentComplete('AccessController', accessController.address, [], contracts);
    deploymentComplete('DiamondLoupeFacet', dlf.address, [], contracts);
    deploymentComplete('DiamondCutFacet', dcf.address, [], contracts);
    deploymentComplete('MarketDiamond', marketDiamond.address, diamondArgs, contracts);

    console.log(`\n💎 Deploying and initializing Marketplace facets...`);

    // Temporarily grant UPGRADER role to deployer account
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await accessController.grantRole(Role.UPGRADER, deployer);
    await tx.wait();

    // Cut the MarketController facet into the Diamond
    const marketConfig = [
        config.staking,
        config.multisig,
        config.vipStakerAmount,
        config.primaryFeePercentage,
        config.secondaryFeePercentage,
        config.maxRoyaltyPercentage,
        config.outBidPercentage,
        config.defaultTicketerType
    ];
    const marketConfigAdditional = [
        config.allowExternalTokensOnSecondary,
    ];
    [marketConfigFacet, marketConfigAdditionalFacet, marketClerkFacet] = await deployMarketControllerFacets(marketDiamond, marketConfig, marketConfigAdditional, gasLimit, awaitAcceptableGas, maxAcceptableGasPrice);
    deploymentComplete('MarketConfigFacet', marketConfigFacet.address, [], contracts);
    deploymentComplete('MarketConfigAdditionalFacet', marketConfigAdditionalFacet.address, [], contracts);
    deploymentComplete('MarketClerkFacet', marketClerkFacet.address, [], contracts);

    // Cast Diamond to the IMarketController interface for further interaction with it
    const marketController = await ethers.getContractAt('IMarketController', marketDiamond.address);

    // Cut the Market Handler facets into the Diamond
    [auctionBuilderFacet, auctionRunnerFacet, auctionEnderFacet, saleBuilderFacet, saleRunnerFacet, saleEnderFacet, ethCreditRecoveryFacet] = await deployMarketHandlerFacets(marketDiamond, gasLimit, awaitAcceptableGas, maxAcceptableGasPrice);
    deploymentComplete('AuctionBuilderFacet', auctionBuilderFacet.address, [], contracts);
    deploymentComplete('AuctionRunnerFacet', auctionRunnerFacet.address, [], contracts);
    deploymentComplete('AuctionEnderFacet', auctionEnderFacet.address, [], contracts);
    deploymentComplete('SaleBuilderFacet', saleBuilderFacet.address, [], contracts);
    deploymentComplete('SaleRunnerFacet', saleRunnerFacet.address, [], contracts);
    deploymentComplete('SaleEnderFacet', saleEnderFacet.address, [], contracts);
    deploymentComplete('EthCreditRecoveryFacet', ethCreditRecoveryFacet.address, [], contracts);

    console.log(`\n⧉ Deploying Market Client implementation/proxy pairs...`);

    // Deploy the Market Client implementation/proxy pairs
    const marketClientArgs = [accessController.address, marketController.address];
    [impls, proxies, clients] = await deployMarketClients(marketClientArgs, gasLimit, awaitAcceptableGas, maxAcceptableGasPrice);
    [lotsTicketerImpl, itemsTicketerImpl, seenHausNFTImpl] = impls;
    [lotsTicketerProxy, itemsTicketerProxy, seenHausNFTProxy] = proxies;
    [lotsTicketer, itemsTicketer, seenHausNFT] = clients;

    // Gather the complete args that were used to create the proxies
    const itemsTicketerProxyArgs = [...marketClientArgs, itemsTicketerImpl.address];
    const lotsTicketerProxyArgs = [...marketClientArgs, lotsTicketerImpl.address];
    const seenHausNFTProxyArgs = [...marketClientArgs, seenHausNFTImpl.address];

    // Report and prepare for verification
    deploymentComplete("LotsTicketer Logic", lotsTicketerImpl.address, [], contracts);
    deploymentComplete("ItemsTicketer Logic", itemsTicketerImpl.address, [], contracts);
    deploymentComplete("SeenHausNFT Logic", seenHausNFTImpl.address, [], contracts);
    deploymentComplete("LotsTicketer Proxy", lotsTicketerProxy.address, lotsTicketerProxyArgs, contracts);
    deploymentComplete("ItemsTicketer Proxy", itemsTicketerProxy.address, itemsTicketerProxyArgs, contracts);
    deploymentComplete("SeenHausNFT Proxy", seenHausNFTProxy.address, seenHausNFTProxyArgs, contracts);

    console.log(`\n🌐️Configuring and granting roles...`);

    // Add Escrow Ticketer and NFT addresses to MarketController
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await marketController.setNft(seenHausNFT.address);
    await tx.wait();
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await marketController.setLotsTicketer(lotsTicketer.address);
    await tx.wait();
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await marketController.setItemsTicketer(itemsTicketer.address);
    await tx.wait();

    console.log(`✅ MarketController updated with remaining post-initialization config.`);

    // Grant ESCROW_AGENT / SELLER / MINTER role to deployer
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await accessController.grantRole(Role.ESCROW_AGENT, deployer);
    await tx.wait();
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await accessController.grantRole(Role.SELLER, deployer);
    await tx.wait();
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await accessController.grantRole(Role.MINTER, deployer);
    await tx.wait();

    console.log(`✅ Granted ESCROW_AGENT / SELLER / MINTER role to deployer address.`);

    // Grant ADMIN role to multisig
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await accessController.grantRole(Role.ADMIN, config.multisig);
    await tx.wait();

    console.log(`✅ Granted ADMIN role to multisig address.`);

    // Add roles to contracts and addresses that need it
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await accessController.grantRole(Role.MARKET_HANDLER, marketDiamond.address); // Market handlers live behind MarketDiamond now
    await tx.wait();
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await accessController.grantRole(Role.MARKET_HANDLER, itemsTicketer.address);
    await tx.wait();
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await accessController.grantRole(Role.MARKET_HANDLER, lotsTicketer.address);
    await tx.wait();
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await accessController.grantRole(Role.MARKET_HANDLER, seenHausNFT.address);
    await tx.wait();

    console.log(`✅ Granted roles to appropriate contract and addresses.`);

    console.log(`\n🌐️Revoking no-longer-needed deployer roles & shifting role admins...`);

    // Transfer admin rights for UPGRADER role to MULTISIG role
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await accessController.shiftRoleAdmin(Role.UPGRADER, Role.MULTISIG);
    await tx.wait();

    // Renounce temporarily granted UPGRADER role for deployer account
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await accessController.renounceRole(Role.UPGRADER, deployer);
    await tx.wait();

    // Grant MULTISIG role to multisig address
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await accessController.grantRole(Role.MULTISIG, config.multisig);
    await tx.wait();

    // Transfer admin rights for MULTISIG role to MULTISIG role
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await accessController.shiftRoleAdmin(Role.MULTISIG, Role.MULTISIG);
    await tx.wait();

    // Renounce temporarily granted MULTISIG role for deployer account
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await accessController.renounceRole(Role.MULTISIG, deployer);
    await tx.wait();

    // Transfer admin rights for MARKET_HANDLER role to multisig
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await accessController.shiftRoleAdmin(Role.MARKET_HANDLER, Role.MULTISIG);
    await tx.wait();

    console.log(`✅ Deployer address renounced MULTISIG & UPGRADER roles & shifted MULTISIG / UPGRADER / MARKET_HANDLER role admin to multisig.`);

    // Bail now if deploying locally
    if (hre.network.name === 'hardhat') process.exit();

    // Wait a minute after deployment completes and then verify contracts on etherscan
    console.log('⏲ Pause two minutes, allowing deployments to propagate to Etherscan backend...');
    await delay(120000).then(
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
