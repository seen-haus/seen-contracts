const hre = require("hardhat");
const ethers = hre.ethers;

const { nftOwner } = require('../constants/role-assignments');

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
async function deployMarketClientImpls(gasLimit, awaitAcceptableGas, maxAcceptableGasPrice) {

    let tx;

    // Deploy the LotsTicketer IEscrowTicketer implementation
    const LotsTicketer = await ethers.getContractFactory("LotsTicketer");
    await awaitAcceptableGas(maxAcceptableGasPrice);
    const lotsTicketer = await LotsTicketer.deploy({gasLimit});
    await lotsTicketer.deployed();
    tx = await lotsTicketer.initialize();
    await tx.wait();

    // Deploy the ItemsTicketer IEscrowTicketer implementation
    const ItemsTicketer = await ethers.getContractFactory("ItemsTicketer");
    await awaitAcceptableGas(maxAcceptableGasPrice);
    const itemsTicketer = await ItemsTicketer.deploy({gasLimit});
    await itemsTicketer.deployed();
    tx = await itemsTicketer.initialize();
    await tx.wait();

    // Deploy the SeenHausNFT contract
    const SeenHausNFT = await ethers.getContractFactory("SeenHausNFT");
    await awaitAcceptableGas(maxAcceptableGasPrice);
    const seenHausNFT = await SeenHausNFT.deploy({gasLimit});
    await seenHausNFT.deployed();
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await seenHausNFT.initialize(nftOwner);
    await tx.wait();

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