// eslint-disable-next-line no-unused-vars
/* eslint prefer-const: "off" */
const hre = require("hardhat");
const ethers = hre.ethers;
const { getFacetAddCut } = require('./diamond-utils.js')

/**
 * Deploy the Diamond
 * @param accessController - the
 * @param interfaces
 * @returns {Promise<(*|*|*)[]>}
 */
async function deployDiamond (accessController, interfaces) {

  // Diamond Loupe Facet
  const DiamondLoupeFacet = await ethers.getContractFactory("DiamondLoupeFacet");
  const dlf = await DiamondLoupeFacet.deploy();
  await dlf.deployed();
  //console.log('DiamondLoupeFacet deployed:', dlf.address)

  // Diamond Cut Facet
  const DiamondCutFacet = await ethers.getContractFactory("DiamondCutFacet");
  const dcf = await DiamondCutFacet.deploy();
  await dcf.deployed();
  //console.log('DiamondCutFacet deployed:', dcf.address)

  // Arguments for Diamond constructor
  const diamondArgs = [
    accessController.address,
    [getFacetAddCut(dlf), getFacetAddCut(dcf)],
    interfaces];

  // Deploy Diamond
  const Diamond = await ethers.getContractFactory('Diamond');
  const diamond = await Diamond.deploy(...diamondArgs);
  await diamond.deployed()
  //console.log('Diamond deployed:', diamond.address)

  return [diamond, dlf, dcf, diamondArgs];

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