const { getFacetAddCut } = require('./diamond-utils.js')
const { InterfaceIds } = require('./supported-interfaces.js')
const hre = require("hardhat");
const ethers = hre.ethers;

/**
 * Deploy the MarketDiamond
 *
 * Reused between deployment script and unit tests for consistency
 *
 * @param accessController - the AccessController
 * @returns {Promise<(*|*|*)[]>}
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
async function deployMarketDiamond () {

  // Core interfaces that will be supported at the Diamond address
  const interfaces = [
    InterfaceIds.IDiamondLoupe,
    InterfaceIds.IDiamondCut,
    InterfaceIds.IERC165
  ];

  // Deploy the AccessController contract
  const AccessController = await ethers.getContractFactory("AccessController");
  const accessController = await AccessController.deploy();
  await accessController.deployed();

  // Diamond Loupe Facet
  const DiamondLoupeFacet = await ethers.getContractFactory("DiamondLoupeFacet");
  const dlf = await DiamondLoupeFacet.deploy();
  await dlf.deployed();

  // Diamond Cut Facet
  const DiamondCutFacet = await ethers.getContractFactory("DiamondCutFacet");
  const dcf = await DiamondCutFacet.deploy();
  await dcf.deployed();

  // Arguments for Diamond constructor
  const diamondArgs = [
    accessController.address,
    [getFacetAddCut(dlf), getFacetAddCut(dcf)],
    interfaces];

  // Deploy Market Diamond
  const MarketDiamond = await ethers.getContractFactory('MarketDiamond');
  const marketDiamond = await MarketDiamond.deploy(...diamondArgs);
  await marketDiamond.deployed()

  return [marketDiamond, dlf, dcf, accessController, diamondArgs];

}

if (require.main === module) {
  deployMarketDiamond()
      .then(() => process.exit(0))
      .catch(error => {
        console.error(error)
        process.exit(1)
      })
}

exports.deployMarketDiamond = deployMarketDiamond