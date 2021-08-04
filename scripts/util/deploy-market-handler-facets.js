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

    // Deploy the AuctionBuilderFacet contract
    const AuctionBuilderFacet = await ethers.getContractFactory("AuctionBuilderFacet");
    const auctionBuilderFacet = await AuctionBuilderFacet.deploy();
    await auctionBuilderFacet.deployed();

    // Deploy the AuctionRunnerFacet contract
    const AuctionRunnerFacet = await ethers.getContractFactory("AuctionRunnerFacet");
    const auctionRunnerFacet = await AuctionRunnerFacet.deploy();
    await auctionRunnerFacet.deployed();

    // Deploy the SaleBuilderFacet contract
    const SaleBuilderFacet = await ethers.getContractFactory("SaleBuilderFacet");
    const saleBuilderFacet = await SaleBuilderFacet.deploy();
    await saleBuilderFacet.deployed();

    // Deploy the SaleRunnerFacet contract
    const SaleRunnerFacet = await ethers.getContractFactory("SaleRunnerFacet");
    const saleRunnerFacet = await SaleRunnerFacet.deploy();
    await saleBuilderFacet.deployed();

    // Cast Diamond to DiamondCutFacet
    const cutFacet = await ethers.getContractAt('DiamondCutFacet', diamond.address);

    // All handler facets currently have no-arg initializers
    let initFunction = "initialize()";
    let initInterface = new ethers.utils.Interface([`function ${initFunction}`]);
    let callData = initInterface.encodeFunctionData("initialize");

    // Cut AuctionBuilder facet facet, initializing
    const auctionBuilderCut = getFacetAddCut(auctionBuilderFacet, [initFunction]);
    await cutFacet.diamondCut([auctionBuilderCut], auctionBuilderFacet.address, callData);

    // Cut AuctionRunner facet facet, initializing
    const auctionRunnerCut = getFacetAddCut(auctionRunnerFacet, [initFunction]);
    await cutFacet.diamondCut([auctionRunnerCut], auctionRunnerFacet.address, callData);

    // Cut SaleBuilder facet, initializing
    const saleBuilderCut = getFacetAddCut(saleBuilderFacet, [initFunction]);
    await cutFacet.diamondCut([saleBuilderCut], saleBuilderFacet.address, callData);

    // Cut SaleRunner facet, initializing
    const saleRunnerCut = getFacetAddCut(saleRunnerFacet, [initFunction]);
    await cutFacet.diamondCut([saleRunnerCut], saleRunnerFacet.address, callData);

    return [auctionBuilderFacet, auctionRunnerFacet, saleBuilderFacet, saleRunnerFacet];

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