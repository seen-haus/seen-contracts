// eslint-disable-next-line no-unused-vars
/* eslint prefer-const: "off" */
const hre = require("hardhat");
const ethers = hre.ethers;
const { getFacetAddCut } = require('./diamond-utils.js')

/**
 * Cut the MarketController facet
 * @param diamond
 * @returns {Promise<(*|*|*)[]>}
 */
async function cutMarketControllerFacet (diamond, marketController, initArgs) {

    // Get the facet cut
    const marketControllerCut = getFacetAddCut(marketController, ['supportsInterface(bytes4)']);

    // Encode MarketController initialization call
    const initAbi = "function initialize(address _accessController, address payable _staking, address payable _multisig, uint256 _vipStakerAmount, uint16 _feePercentage, uint16 _maxRoyaltyPercentage, uint16 _outBidPercentage, uint8 _defaultTicketerType)";
    const mci = new ethers.utils.Interface([initAbi]);
    const callData = mci.encodeFunctionData("initialize", initArgs);

    // Cast Diamond to DiamondCutFacet
    const cutFacetViaDiamond = await ethers.getContractAt('DiamondCutFacet', diamond.address);

    // Cut MarketController facet, initializing
    await cutFacetViaDiamond.diamondCut([marketControllerCut], marketController.address, callData);

}

if (require.main === module) {
    cutMarketControllerFacet()
      .then(() => process.exit(0))
      .catch(error => {
        console.error(error)
        process.exit(1)
      })
}

exports.cutMarketControllerFacet = cutMarketControllerFacet;