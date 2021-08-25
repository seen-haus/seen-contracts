const hre = require("hardhat");
const ethers = hre.ethers;

/**
 * Cast the Market Client proxy contracts to their implementation interfaces
 *
 * Market clients are the contracts in the system that communicate with
 * the MarketController as clients of the MarketDiamond rather than acting
 * as facets of the MarketDiamond. They include SeenHausNFT, ItemsTicketer,
 * and LotsTicketer.
 *
 * This script accepts the addresses of the proxy contracts and returns
 * an array of contract abstractions with the implementation abi
 *
 * @param marketClientProxies
 * @param gasLimit - gasLimit for transactions
 * @returns {Promise<(*|*|*)[]>}
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
async function castMarketClientProxies(marketClientProxies, gasLimit) {

    // Destructure the market client proxies
    [lotsTicketerProxy, itemsTicketerProxy, seenHausNFTProxy] = marketClientProxies;

    // Cast the Proxies to the appropriate interfaces for further interaction
    const lotsTicketer = await ethers.getContractAt('LotsTicketer', lotsTicketerProxy.address);
    const itemsTicketer = await ethers.getContractAt('ItemsTicketer', itemsTicketerProxy.address);
    const seenHausNFT = await ethers.getContractAt('SeenHausNFT', seenHausNFTProxy.address);

    return [lotsTicketer, itemsTicketer, seenHausNFT];

}

if (require.main === module) {
    castMarketClientProxies()
      .then(() => process.exit(0))
      .catch(error => {
        console.error(error)
        process.exit(1)
      })
}

exports.castMarketClientProxies = castMarketClientProxies;