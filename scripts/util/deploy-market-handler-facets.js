const { getFacetAddCut } = require('./diamond-utils.js');
const hre = require("hardhat");
const ethers = hre.ethers;

/**
 * Cut the Market Handler facets
 *
 * Reused between deployment script and unit tests for consistency
 *
 * @param diamond
 * @param gasLimit - gasLimit for transactions
 * @returns {Promise<(*|*|*)[]>}
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
async function deployMarketHandlerFacets(diamond, gasLimit) {

    // Deploy the AuctionBuilderFacet contract
    const AuctionBuilderFacet = await ethers.getContractFactory("AuctionBuilderFacet");
    const auctionBuilderFacet = await AuctionBuilderFacet.deploy({gasLimit});
    await auctionBuilderFacet.deployed();

    // Deploy the AuctionRunnerFacet contract
    const AuctionRunnerFacet = await ethers.getContractFactory("AuctionRunnerFacet");
    const auctionRunnerFacet = await AuctionRunnerFacet.deploy({gasLimit});
    await auctionRunnerFacet.deployed();

    // Deploy the SaleBuilderFacet contract
    const SaleBuilderFacet = await ethers.getContractFactory("SaleBuilderFacet");
    const saleBuilderFacet = await SaleBuilderFacet.deploy({gasLimit});
    await saleBuilderFacet.deployed();

    // Deploy the SaleRunnerFacet contract
    const SaleRunnerFacet = await ethers.getContractFactory("SaleRunnerFacet");
    const saleRunnerFacet = await SaleRunnerFacet.deploy({gasLimit});
    await saleBuilderFacet.deployed();

    // Cast Diamond to DiamondCutFacet
    const cutFacet = await ethers.getContractAt('DiamondCutFacet', diamond.address);

    // All handler facets currently have no-arg initializers
    let initFunction = "initialize()";
    let initInterface = new ethers.utils.Interface([`function ${initFunction}`]);
    let callData = initInterface.encodeFunctionData("initialize");

    // Cut AuctionBuilder facet facet, initializing
    const auctionBuilderCut = getFacetAddCut(auctionBuilderFacet, [initFunction]);
    await cutFacet.diamondCut([auctionBuilderCut], auctionBuilderFacet.address, callData, {gasLimit});

    // Cut AuctionRunner facet facet, initializing
    const auctionRunnerCut = getFacetAddCut(auctionRunnerFacet, [initFunction]);
    await cutFacet.diamondCut([auctionRunnerCut], auctionRunnerFacet.address, callData, {gasLimit});

    // Cut SaleBuilder facet, initializing
    const saleBuilderCut = getFacetAddCut(saleBuilderFacet, [initFunction]);
    await cutFacet.diamondCut([saleBuilderCut], saleBuilderFacet.address, callData, {gasLimit});

    // Cut SaleRunner facet, initializing
    const saleRunnerCut = getFacetAddCut(saleRunnerFacet, [initFunction]);
    await cutFacet.diamondCut([saleRunnerCut], saleRunnerFacet.address, callData, {gasLimit});

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