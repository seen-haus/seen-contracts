const hre = require("hardhat");
const ethers = hre.ethers;

/**
 * Deploy the Market Client Implementation contracts
 *
 * Market clients are the contracts in the system that communicate with
 * the MarketController as clients of the MarketDiamond rather than acting
 * as facets of the MarketDiamond. They include SeenHausNFT, ItemsTicketer,
 * and LotsTicketer.
 *
 * Reused between deployment script and unit tests for consistency
 *
 * @param gasLimit - gasLimit for transactions
 * @returns {Promise<(*|*|*)[]>}
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
async function deployMarketClientImpls(gasLimit) {

    // Deploy the LotsTicketer IEscrowTicketer implementation
    const LotsTicketer = await ethers.getContractFactory("LotsTicketer");
    const lotsTicketer = await LotsTicketer.deploy({gasLimit});
    await lotsTicketer.deployed();

    // Deploy the ItemsTicketer IEscrowTicketer implementation
    const ItemsTicketer = await ethers.getContractFactory("ItemsTicketer");
    const itemsTicketer = await ItemsTicketer.deploy({gasLimit});
    await itemsTicketer.deployed();

    // Deploy the SeenHausNFT contract
    const SeenHausNFT = await ethers.getContractFactory("SeenHausNFT");
    const seenHausNFT = await SeenHausNFT.deploy({gasLimit});
    await seenHausNFT.deployed();

    return [lotsTicketer, itemsTicketer, seenHausNFT];

}

if (require.main === module) {
    deployMarketClientImpls()
      .then(() => process.exit(0))
      .catch(error => {
        console.error(error)
        process.exit(1)
      })
}

exports.deployMarketClientImpls = deployMarketClientImpls;