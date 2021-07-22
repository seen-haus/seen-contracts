// eslint-disable-next-line no-unused-vars
/* global ethers hre */
/* eslint prefer-const: "off" */

const { getSelectors, InterfaceIds, FacetCutAction } = require('./libraries/diamond-utils.js')

async function deployDiamond () {

  // Deploy the AccessController
  const AccessController = await ethers.getContractFactory("AccessController");
  const accessController = await AccessController.deploy();
  await accessController.deployed();
  //console.log('AccessController deployed:', accessController.address)

  // Diamond Loupe Facet
  const DiamondLoupeFacet = await ethers.getContractFactory("DiamondLoupeFacet");
  const dlf = await DiamondLoupeFacet.deploy();
  await dlf.deployed();
  const diamondLoupeSelectors = getSelectors(dlf);
  const diamondLoupeCut = [dlf.address, FacetCutAction.Add, diamondLoupeSelectors];
  //console.log('DiamondLoupeFacet deployed:', dlf.address)

  // Diamond Cut Facet
  const DiamondCutFacet = await ethers.getContractFactory("DiamondCutFacet");
  const dcf = await DiamondCutFacet.deploy();
  await dcf.deployed();
  const diamondCutSelectors = getSelectors(dcf);
  const diamondCutCut = [dcf.address, FacetCutAction.Add, diamondCutSelectors];
  //console.log('DiamondCutFacet deployed:', dcf.address)

  // Deploy Diamond
  const Diamond = await ethers.getContractFactory('Diamond')
  const diamond = await Diamond.deploy(
      accessController.address,
      [diamondLoupeCut, diamondCutCut],
      [InterfaceIds.DiamondLoupe, InterfaceIds.DiamondCut, InterfaceIds.ERC165]
  )
  await diamond.deployed()
  //console.log('Diamond deployed:', diamond.address)

/* Diagnostic Display

  // Verify supported interfaces with Diamond Proxy's onboard ERC-165 implementation
  let supports165 = await diamond.supportsInterface(InterfaceIds.ERC165);
  console.log(`Supports IERC165 ${supports165}`);

  let supportsDiamondLoupe = await diamond.supportsInterface(InterfaceIds.DiamondLoupe);
  console.log(`Supports IDiamondLoupe ${supportsDiamondLoupe}`);

  let supportsDiamondCut = await diamond.supportsInterface(InterfaceIds.DiamondCut);
  console.log(`Supports IDiamondCut ${supportsDiamondCut}`);

  // Get the Diamond proxy,cast to DiamondLoupeFacet's abi so hardhat knows the functions are available
  const cast = await ethers.getContractAt('DiamondLoupeFacet', diamond.address);

  // Verify facet addresses
  let addresses = await cast.facetAddresses();
  console.log(addresses);

*/

  return [diamond.address, dlf.address, dcf.address];

}

/*
main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });

*/

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
  deployDiamond()
      .then(() => process.exit(0))
      .catch(error => {
        console.error(error)
        process.exit(1)
      })
}

exports.deployDiamond = deployDiamond