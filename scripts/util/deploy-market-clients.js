const hre = require("hardhat");
const { deployMarketClientImpls } = require("./deploy-market-client-impls.js");
const { deployMarketClientProxies } = require("./deploy-market-client-proxies.js");
const { castMarketClientProxies } = require("./cast-market-client-proxies.js");

/**
 * Deploy the Market Client Implementation/Proxy pairs
 *
 * Market clients are the contracts in the system that communicate with
 * the MarketController as clients of the MarketDiamond rather than acting
 * as facets of the MarketDiamond. They include SeenHausNFT, ItemsTicketer,
 * and LotsTicketer.
 *
 *  N.B. Intended for use with tests,
 *
 * @param marketClientArgs
 * @param gasLimit - gasLimit for transactions
 * @returns {Promise<(*|*|*)[]>}
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
async function deployMarketClients(marketClientArgs, gasLimit, awaitAcceptableGas, maxAcceptableGasPrice) {

    // Deploy Market Client implementation contracts
    const marketClientImpls = await deployMarketClientImpls(gasLimit, awaitAcceptableGas, maxAcceptableGasPrice);

    // Deploy Market Client proxy contracts
    const marketClientProxies = await deployMarketClientProxies(marketClientImpls, marketClientArgs, gasLimit, awaitAcceptableGas, maxAcceptableGasPrice);

    // Cast the proxies to their implementation interfaces
    const marketClients = await castMarketClientProxies(marketClientProxies, gasLimit, awaitAcceptableGas, maxAcceptableGasPrice);

    return [marketClientImpls, marketClientProxies, marketClients];

}

if (require.main === module) {
    deployMarketClients()
      .then(() => process.exit(0))
      .catch(error => {
        console.error(error)
        process.exit(1)
      })
}

exports.deployMarketClients = deployMarketClients;