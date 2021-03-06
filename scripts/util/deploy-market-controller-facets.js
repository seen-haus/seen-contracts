const { getFacetAddCut } = require('./diamond-utils.js')
const hre = require("hardhat");
const ethers = hre.ethers;

/**
 * Cut the Market Controller facets
 *
 * Reused between deployment script and unit tests for consistency
 *
 * @param diamond
 * @param marketConfig
 * @param gasLimit - gasLimit for transactions
 * @returns {Promise<(*|*|*)[]>}
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
async function deployMarketControllerFacets(diamond, marketConfig, marketConfigAdditional, gasLimit, awaitAcceptableGas, maxAcceptableGasPrice) {

    let tx;

    // Deploy the MarketConfig Facet
    const MarketConfigFacet = await ethers.getContractFactory("MarketConfigFacet");
    await awaitAcceptableGas(maxAcceptableGasPrice);
    const marketConfigFacet = await MarketConfigFacet.deploy({gasLimit});
    await marketConfigFacet.deployed();

    // Deploy the MarketConfigAdditional Facet (needed due to contract size of MarketConfig)
    const MarketConfigAdditionalFacet = await ethers.getContractFactory("MarketConfigAdditionalFacet");
    await awaitAcceptableGas(maxAcceptableGasPrice);
    const marketConfigAdditionalFacet = await MarketConfigAdditionalFacet.deploy({gasLimit});
    await marketConfigAdditionalFacet.deployed();

    // Deploy the MarketClerkFacet Facet
    const MarketClerkFacet = await ethers.getContractFactory("MarketClerkFacet");
    await awaitAcceptableGas(maxAcceptableGasPrice);
    const marketClerkFacet = await MarketClerkFacet.deploy({gasLimit});
    await marketClerkFacet.deployed();

    // Cast Diamond to DiamondCutFacet
    const cutFacet = await ethers.getContractAt('DiamondCutFacet', diamond.address);

    // Cut MarketConfig facet, initializing
    let configInitFunction = "initialize(address payable _staking, address payable _multisig, uint256 _vipStakerAmount, uint16 _primaryFeePercentage, uint16 _secondaryFeePercentage, uint16 _maxRoyaltyPercentage, uint16 _outBidPercentage, uint8 _defaultTicketerType)";
    const configInterface = new ethers.utils.Interface([`function ${configInitFunction}`]);
    const configCallData = configInterface.encodeFunctionData("initialize", marketConfig);
    const marketConfigCut = getFacetAddCut(marketConfigFacet, [configInitFunction]);
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await cutFacet.diamondCut([marketConfigCut], marketConfigFacet.address, configCallData, {gasLimit});
    await tx.wait();

    // Cut MarketConfigAdditional facet, initializing
    let configAdditionalInitFunction = "initialize(bool _allowExternalTokensOnSecondary)";
    const configAdditionalInterface = new ethers.utils.Interface([`function ${configAdditionalInitFunction}`]);
    const configAdditionalCallData = configAdditionalInterface.encodeFunctionData("initialize", marketConfigAdditional);
    const marketConfigAdditionalCut = getFacetAddCut(marketConfigAdditionalFacet, [configAdditionalInitFunction]);
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await cutFacet.diamondCut([marketConfigAdditionalCut], marketConfigAdditionalFacet.address, configAdditionalCallData, {gasLimit});
    await tx.wait();

    // Cut MarketClerk facet, initializing
    let clerkInitFunction = "initialize()";
    const clerkInterface = new ethers.utils.Interface([`function ${clerkInitFunction}`]);
    const clerkCallData = clerkInterface.encodeFunctionData("initialize");
    const marketClerkCut = getFacetAddCut(marketClerkFacet, ['supportsInterface(bytes4)', clerkInitFunction]);
    await awaitAcceptableGas(maxAcceptableGasPrice);
    tx = await cutFacet.diamondCut([marketClerkCut], marketClerkFacet.address, clerkCallData, {gasLimit});
    await tx.wait();

    return [marketConfigFacet, marketConfigAdditionalFacet, marketClerkFacet];
}

if (require.main === module) {
    deployMarketControllerFacets()
      .then(() => process.exit(0))
      .catch(error => {
        console.error(error)
        process.exit(1)
      })
}

exports.deployMarketControllerFacets = deployMarketControllerFacets;