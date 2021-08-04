// eslint-disable-next-line no-unused-vars
/* eslint prefer-const: "off" */
const hre = require("hardhat");
const ethers = hre.ethers;
const { getFacetAddCut } = require('./diamond-utils.js');

/**
 * Cut the Market Handler facets
 *
 * @param diamond
 * @param config
 * @returns {Promise<(*|*|*)[]>}
 */
async function deployMarketHandlerFacets(diamond) {

    // Deploy the AuctionHandlerFacet contract
    AuctionHandlerFacet = await ethers.getContractFactory("AuctionHandlerFacet");
    const auctionHandlerFacet = await AuctionHandlerFacet.deploy();
    await auctionHandlerFacet.deployed();

    // Deploy the SaleHandlerFacet contract
    SaleHandlerFacet = await ethers.getContractFactory("SaleHandlerFacet");
    const saleHandlerFacet = await SaleHandlerFacet.deploy();
    await saleHandlerFacet.deployed();

    // Cast Diamond to DiamondCutFacet
    const cutFacet = await ethers.getContractAt('DiamondCutFacet', diamond.address);

    // All handler facets currently have no-arg initializers
    let initFunction = "initialize()";
    let initInterface = new ethers.utils.Interface([`function ${initFunction}`]);
    let callData = initInterface.encodeFunctionData("initialize");

    // Cut AuctionHandler facet, initializing
    const auctionHandlerCut = getFacetAddCut(auctionHandlerFacet, [initFunction]);
    await cutFacet.diamondCut([auctionHandlerCut], auctionHandlerFacet.address, callData);

    // Cut SaleHandler facet, initializing
    const saleHandlerCut = getFacetAddCut(saleHandlerFacet, [initFunction]);
    await cutFacet.diamondCut([saleHandlerCut], saleHandlerFacet.address, callData);

    return [auctionHandlerFacet, saleHandlerFacet];
}

if (require.main === module) {
    deployMarketHandlerFacets()
      .then(() => process.exit(0))
      .catch(error => {
        console.error(error)
        process.exit(1)
      })
}

exports.deployMarketHandlerFacets = deployMarketHandlerFacets;