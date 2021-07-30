// eslint-disable-next-line no-unused-vars
/* eslint prefer-const: "off" */
const hre = require("hardhat");
const ethers = hre.ethers;
const { getFacetAddCut } = require('./diamond-utils.js')

/**
 * Cut the MarketController facets
 *
 * @param diamond
 * @param marketConfig
 * @param marketClerk
 * @param initArgs
 * @returns {Promise<(*|*|*)[]>}
 */
async function deployMarketControllerFacets(diamond, initArgs) {

    // Deploy the MarketConfig Facet
    MarketConfigFacet = await ethers.getContractFactory("MarketConfigFacet");
    const marketConfigFacet = await MarketConfigFacet.deploy();

    // Deploy the MarketClerkFacet Facet
    MarketClerkFacet = await ethers.getContractFactory("MarketClerkFacet");
    const marketClerkFacet = await MarketClerkFacet.deploy();

    // Cast Diamond to DiamondCutFacet
    const cutFacet = await ethers.getContractAt('DiamondCutFacet', diamond.address);

    // Cut MarketConfig facet, initializing
    let configInitAbi = "initialize(address _accessController, address payable _staking, address payable _multisig, uint256 _vipStakerAmount, uint16 _feePercentage, uint16 _maxRoyaltyPercentage, uint16 _outBidPercentage, uint8 _defaultTicketerType)";
    const configInterface = new ethers.utils.Interface([`function ${configInitAbi}`]);
    const configCallData = configInterface.encodeFunctionData("initialize", initArgs);
    const marketConfigCut = getFacetAddCut(marketConfigFacet);
    await cutFacet.diamondCut([marketConfigCut], marketConfigFacet.address, configCallData);

    // Cut MarketClerk facet, initializing
    let clerkInitAbi = "initialize()";
    const clerkInterface = new ethers.utils.Interface([`function ${clerkInitAbi}`]);
    const clerkCallData = clerkInterface.encodeFunctionData("initialize");
    const marketClerkCut = getFacetAddCut(marketClerkFacet, ['supportsInterface(bytes4)']);
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