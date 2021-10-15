const hre = require("hardhat");
const ethers = hre.ethers;
const { nftOwner } = require('../constants/role-assignments');

/**
 * Deploy the Market Client Proxy contracts
 *
 * Market clients are the contracts in the system that communicate with
 * the MarketController as clients of the MarketDiamond rather than acting
 * as facets of the MarketDiamond. They include SeenHausNFT, ItemsTicketer,
 * and LotsTicketer.
 *
 * This script accepts the addresses of the implementation contracts
 * and deploys a MarketClientProxy for each one.
 *
 * Reused between deployment script and unit tests for consistency
 *
 * @param marketClients
 * @param marketClientArgs
 * @param gasLimit - gasLimit for transactions
 * @returns {Promise<(*|*|*)[]>}
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
async function deployMarketClientProxies(marketClients, marketClientArgs, gasLimit) {

    // Destructure the market client implementations
    [lotsTicketerImpl, itemsTicketerImpl, seenHausNFTImpl] = marketClients;

    // Deploy the LotsTicketer Proxy
    const LotsTicketerProxy = await ethers.getContractFactory("MarketClientProxy");
    const lotsTicketerProxy = await LotsTicketerProxy.deploy(...marketClientArgs, lotsTicketerImpl.address, {gasLimit});
    await lotsTicketerProxy.deployed();

    const LotsTicketerImpl = await ethers.getContractFactory("LotsTicketer");
    const lotsTicketerImplAttached = await LotsTicketerImpl.attach(lotsTicketerProxy.address);
    await lotsTicketerImplAttached.initialize();

    // Deploy the ItemsTicketer proxy
    const ItemsTicketerProxy = await ethers.getContractFactory("MarketClientProxy");
    const itemsTicketerProxy = await ItemsTicketerProxy.deploy(...marketClientArgs, itemsTicketerImpl.address, {gasLimit});
    await itemsTicketerProxy.deployed();

    const ItemsTicketerImpl = await ethers.getContractFactory("ItemsTicketer");
    const ItemsTicketerImplAttached = await ItemsTicketerImpl.attach(itemsTicketerProxy.address);
    await ItemsTicketerImplAttached.initialize();

    // Deploy the SeenHausNFT proxy
    const SeenHausNFTProxy = await ethers.getContractFactory("MarketClientProxy");
    const seenHausNFTProxy = await SeenHausNFTProxy.deploy(...marketClientArgs, seenHausNFTImpl.address, {gasLimit});
    await seenHausNFTProxy.deployed();

    const SeenHausNFTImpl = await ethers.getContractFactory("SeenHausNFT");
    const SeenHausNFTImplAttached = await SeenHausNFTImpl.attach(seenHausNFTProxy.address);
    await SeenHausNFTImplAttached.initialize(nftOwner);

    return [lotsTicketerProxy, itemsTicketerProxy, seenHausNFTProxy];

}

if (require.main === module) {
    deployMarketClientProxies()
      .then(() => process.exit(0))
      .catch(error => {
        console.error(error)
        process.exit(1)
      })
}

exports.deployMarketClientProxies = deployMarketClientProxies;