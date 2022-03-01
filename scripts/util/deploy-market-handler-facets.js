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
async function deployMarketHandlerFacets(diamond, gasLimit, awaitAcceptableGas, maxAcceptableGasPrice) {

    // Deploy the EthCreditRecoveryFacet contract
    const EthCreditRecoveryFacet = await ethers.getContractFactory("EthCreditRecoveryFacet");
    await awaitAcceptableGas(maxAcceptableGasPrice);
    const ethCreditRecoveryFacet = await EthCreditRecoveryFacet.deploy({gasLimit});
    await ethCreditRecoveryFacet.deployed();

    // Deploy the AuctionBuilderFacet contract
    const AuctionBuilderFacet = await ethers.getContractFactory("AuctionBuilderFacet");
    await awaitAcceptableGas(maxAcceptableGasPrice);
    const auctionBuilderFacet = await AuctionBuilderFacet.deploy({gasLimit});
    await auctionBuilderFacet.deployed();

    // Deploy the AuctionRunnerFacet contract
    const AuctionRunnerFacet = await ethers.getContractFactory("AuctionRunnerFacet");
    await awaitAcceptableGas(maxAcceptableGasPrice);
    const auctionRunnerFacet = await AuctionRunnerFacet.deploy({gasLimit});
    await auctionRunnerFacet.deployed();

    // Deploy the AuctionEnderFacet contract
    const AuctionEnderFacet = await ethers.getContractFactory("AuctionEnderFacet");
    await awaitAcceptableGas(maxAcceptableGasPrice);
    const auctionEnderFacet = await AuctionEnderFacet.deploy({gasLimit});
    await auctionEnderFacet.deployed();

    // Deploy the SaleBuilderFacet contract
    const SaleBuilderFacet = await ethers.getContractFactory("SaleBuilderFacet");
    await awaitAcceptableGas(maxAcceptableGasPrice);
    const saleBuilderFacet = await SaleBuilderFacet.deploy({gasLimit});
    await saleBuilderFacet.deployed();

    // Deploy the SaleRunnerFacet contract
    const SaleRunnerFacet = await ethers.getContractFactory("SaleRunnerFacet");
    await awaitAcceptableGas(maxAcceptableGasPrice);
    const saleRunnerFacet = await SaleRunnerFacet.deploy({gasLimit});
    await saleBuilderFacet.deployed();

    // Deploy the SaleRunnerFacet contract
    const SaleEnderFacet = await ethers.getContractFactory("SaleEnderFacet");
    await awaitAcceptableGas(maxAcceptableGasPrice);
    const saleEnderFacet = await SaleEnderFacet.deploy({gasLimit});
    await saleEnderFacet.deployed();

    // Cast Diamond to DiamondCutFacet
    const cutFacet = await ethers.getContractAt('DiamondCutFacet', diamond.address);

    // All handler facets currently have no-arg initializers
    let initFunction = "initialize()";
    let initInterface = new ethers.utils.Interface([`function ${initFunction}`]);
    let callData = initInterface.encodeFunctionData("initialize");

    // Cut EthCreditRecovery facet, initializing
    const ethCreditRecoveryCut = getFacetAddCut(ethCreditRecoveryFacet, [initFunction]);
    await awaitAcceptableGas(maxAcceptableGasPrice);
    await cutFacet.diamondCut([ethCreditRecoveryCut], ethCreditRecoveryFacet.address, callData, {gasLimit});

    // Cut AuctionBuilder facet facet, initializing
    const auctionBuilderCut = getFacetAddCut(auctionBuilderFacet, [initFunction]);
    await awaitAcceptableGas(maxAcceptableGasPrice);
    await cutFacet.diamondCut([auctionBuilderCut], auctionBuilderFacet.address, callData, {gasLimit});

    // Cut AuctionRunner facet facet, initializing
    const auctionRunnerCut = getFacetAddCut(auctionRunnerFacet, [initFunction]);
    await awaitAcceptableGas(maxAcceptableGasPrice);
    await cutFacet.diamondCut([auctionRunnerCut], auctionRunnerFacet.address, callData, {gasLimit});

    // Cut AuctionEnder facet facet, initializing
    const auctionEnderCut = getFacetAddCut(auctionEnderFacet, [initFunction]);
    await awaitAcceptableGas(maxAcceptableGasPrice);
    await cutFacet.diamondCut([auctionEnderCut], auctionEnderFacet.address, callData, {gasLimit});

    // Cut SaleBuilder facet, initializing
    const saleBuilderCut = getFacetAddCut(saleBuilderFacet, [initFunction]);
    await awaitAcceptableGas(maxAcceptableGasPrice);
    await cutFacet.diamondCut([saleBuilderCut], saleBuilderFacet.address, callData, {gasLimit});

    // Cut SaleRunner facet, initializing
    const saleRunnerCut = getFacetAddCut(saleRunnerFacet, [initFunction]);
    await awaitAcceptableGas(maxAcceptableGasPrice);
    await cutFacet.diamondCut([saleRunnerCut], saleRunnerFacet.address, callData, {gasLimit});

    // Cut SaleEnder facet, initializing
    const saleEnderCut = getFacetAddCut(saleEnderFacet, [initFunction]);
    await awaitAcceptableGas(maxAcceptableGasPrice);
    await cutFacet.diamondCut([saleEnderCut], saleEnderFacet.address, callData, {gasLimit});

    return [auctionBuilderFacet, auctionRunnerFacet, auctionEnderFacet, saleBuilderFacet, saleRunnerFacet, saleEnderFacet, ethCreditRecoveryFacet];

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