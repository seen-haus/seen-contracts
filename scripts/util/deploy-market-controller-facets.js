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
async function deployMarketControllerFacets(diamond, marketConfig, gasLimit) {

    // Deploy the MarketConfig Facet
    const MarketConfigFacet = await ethers.getContractFactory("MarketConfigFacet");
    const marketConfigFacet = await MarketConfigFacet.deploy({gasLimit});
    await marketConfigFacet.deployed();

    // sDeploy the MarketClerkFacet Facet
    const MarketClerkFacet = await ethers.getContractFactory("MarketClerkFacet");
    const marketClerkFacet = await MarketClerkFacet.deploy({gasLimit});
    await marketClerkFacet.deployed();

    // Cast Diamond to DiamondCutFacet
    const cutFacet = await ethers.getContractAt('DiamondCutFacet', diamond.address);

    // Cut MarketConfig facet, initializing
    let configInitFunction = "initialize(address payable _staking, address payable _multisig, uint256 _vipStakerAmount, uint16 _primaryFeePercentage, uint16 _secondaryFeePercentage, uint16 _maxRoyaltyPercentage, uint16 _outBidPercentage, uint8 _defaultTicketerType)";
    const configInterface = new ethers.utils.Interface([`function ${configInitFunction}`]);
    const configCallData = configInterface.encodeFunctionData("initialize", marketConfig);
    const marketConfigCut = getFacetAddCut(marketConfigFacet, [configInitFunction]);
    await cutFacet.diamondCut([marketConfigCut], marketConfigFacet.address, configCallData, {gasLimit});

    // Cut MarketClerk facet, initializing
    let clerkInitFunction = "initialize()";
    const clerkInterface = new ethers.utils.Interface([`function ${clerkInitFunction}`]);
    const clerkCallData = clerkInterface.encodeFunctionData("initialize");
    const marketClerkCut = getFacetAddCut(marketClerkFacet, ['supportsInterface(bytes4)', clerkInitFunction]);
    await cutFacet.diamondCut([marketClerkCut], marketClerkFacet.address, clerkCallData, {gasLimit});

    return [marketConfigFacet, marketClerkFacet];
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