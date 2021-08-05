// eslint-disable-next-line no-unused-vars
/* eslint prefer-const: "off" */
const hre = require("hardhat");
const ethers = hre.ethers;
const { getFacetAddCut } = require('./diamond-utils.js')

/**
 * Cut the Market Controller facets
 *
 * @param diamond
 * @param config
 * @returns {Promise<(*|*|*)[]>}
 */
async function deployMarketControllerFacets(diamond, marketConfig) {

    // Deploy the MarketConfig Facet
    const MarketConfigFacet = await ethers.getContractFactory("MarketConfigFacet");
    const marketConfigFacet = await MarketConfigFacet.deploy();
    await marketConfigFacet.deployed();

    // sDeploy the MarketClerkFacet Facet
    const MarketClerkFacet = await ethers.getContractFactory("MarketClerkFacet");
    const marketClerkFacet = await MarketClerkFacet.deploy();
    await marketClerkFacet.deployed();

    // Cast Diamond to DiamondCutFacet
    const cutFacet = await ethers.getContractAt('DiamondCutFacet', diamond.address);

    // Cut MarketConfig facet, initializing
    let configInitFunction = "initialize(address payable _staking, address payable _multisig, uint256 _vipStakerAmount, uint16 _feePercentage, uint16 _maxRoyaltyPercentage, uint16 _outBidPercentage, uint8 _defaultTicketerType)";
    const configInterface = new ethers.utils.Interface([`function ${configInitFunction}`]);
    const configCallData = configInterface.encodeFunctionData("initialize", marketConfig);
    const marketConfigCut = getFacetAddCut(marketConfigFacet, [configInitFunction]);
    await cutFacet.diamondCut([marketConfigCut], marketConfigFacet.address, configCallData);

    // Cut MarketClerk facet, initializing
    let clerkInitFunction = "initialize()";
    const clerkInterface = new ethers.utils.Interface([`function ${clerkInitFunction}`]);
    const clerkCallData = clerkInterface.encodeFunctionData("initialize");
    const marketClerkCut = getFacetAddCut(marketClerkFacet, ['supportsInterface(bytes4)', clerkInitFunction]);
    await cutFacet.diamondCut([marketClerkCut], marketClerkFacet.address, clerkCallData);

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