// eslint-disable-next-line no-unused-vars
/* eslint prefer-const: "off" */
const hre = require("hardhat");
const ethers = hre.ethers;
const { getFacetAddCut, InterfaceIds } = require('./diamond-utils.js')

/**
 * Deploy the Diamond
 * @param accessController - the AccessController
 * @returns {Promise<(*|*|*)[]>}
 */
async function deployDiamond () {

  // Core interfaces that will be supported at the Diamond address
  const interfaces = [
    InterfaceIds.DiamondLoupe,
    InterfaceIds.DiamondCut,
    InterfaceIds.ERC165
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

  // Deploy Diamond
  const Diamond = await ethers.getContractFactory('Diamond');
  const diamond = await Diamond.deploy(...diamondArgs);
  await diamond.deployed()

  return [diamond, dlf, dcf, accessController, diamondArgs];

}

if (require.main === module) {
  deployDiamond()
      .then(() => process.exit(0))
      .catch(error => {
        console.error(error)
        process.exit(1)
      })
}

exports.deployDiamond = deployDiamond