/**
 * Seen.Haus contract suite deployment script
 * @author Cliff Hall <cliff@futurescale.com>
 */
const Role = require("../domain/Role");
const hre = require("hardhat");
const Ticketer = require("../domain/Ticketer");
const { getSelectors, InterfaceIds, FacetCutAction } = require('./libraries/diamond-utils.js')

const ethers = hre.ethers;
let contract, contracts = [];
const divider = "-".repeat(80);

function getConfig() {

    // Get the network we're deploying to
    const network = hre.network.name;

    // TODO: DISCUSS TO GET INITIAL SETTINGS FOR ALL THESE PARAMS
    // Market configuration params
    const vipStakerAmount = "500";
    const feePercentage = "20";
    const maxRoyaltyPercentage = "50";
    const outBidPercentage = "5";
    const defaultTicketerType = Ticketer.ITEMS;  // default escrow ticketer type

    // Staking contract address
    const STAKING = {
        'mainnet': '0x38747baf050d3c22315a761585868dba16abfd89',
        'rinkeby': '0x0000000000000000000000000000000000000000',
        'hardhat': '0x0000000000000000000000000000000000000000'
    }

    // Multisig contract address
    const MULTISIG = {
        'mainnet': '0x4a25E18076DDcFd646ED14ABC07286c2A4c1256A',
        'rinkeby': '0x0000000000000000000000000000000000000000',
        'hardhat': '0x0000000000000000000000000000000000000000'
    }

    return {
            staking: STAKING[network],
            multisig: MULTISIG[network],
            vipStakerAmount,
            feePercentage,
            maxRoyaltyPercentage,
            outBidPercentage,
            defaultTicketerType
        };
}

async function main() {

    // Compile everything (in case run by node)
    await hre.run('compile');

    console.log(`\n${divider}\nNetwork: ${hre.network.name}\nDeploying. ${new Date()}\n${divider}\n`);

    // Get the market config
    const config = getConfig();

    // Get the accounts
    const accounts = await ethers.provider.listAccounts();
    const deployer = accounts[0];
    console.log("🔱 Deployer account: ", deployer ? deployer : "not found" && process.exit());

    // Deploy the AccessController contract
    const AccessController = await ethers.getContractFactory("AccessController");
    const accessController = await AccessController.deploy();
    await accessController.deployed();
    deploymentComplete('AccessController', accessController.address, []);

    // Diamond Loupe Facet
    const DiamondLoupeFacet = await ethers.getContractFactory("DiamondLoupeFacet");
    const dlf = await DiamondLoupeFacet.deploy();
    await dlf.deployed();
    const diamondLoupeSelectors = getSelectors(dlf);
    const diamondLoupeCut = [dlf.address, FacetCutAction.Add, diamondLoupeSelectors];
    deploymentComplete('DiamondLoupeFacet', dlf.address, []);

    // Diamond Cut Facet
    const DiamondCutFacet = await ethers.getContractFactory("DiamondCutFacet");
    const dcf = await DiamondCutFacet.deploy();
    await dcf.deployed();
    const diamondCutSelectors = getSelectors(dcf);
    const diamondCutCut = [dcf.address, FacetCutAction.Add, diamondCutSelectors];
    deploymentComplete('DiamondCutFacet', dcf.address, []);

    // Deploy the MarketController Facet
    const MarketController = await ethers.getContractFactory("MarketController");
    const mcf = await MarketController.deploy();
    const marketControllerSelectors = getSelectors(mcf).remove(['supportsInterface(bytes4)']);
    const marketControllerCut = [mcf.address, FacetCutAction.Add, marketControllerSelectors];
    deploymentComplete('MarketController', mcf.address, []);

    // Deploy Diamond
    const Diamond = await ethers.getContractFactory('Diamond');
    const diamond = await Diamond.deploy(
        accessController.address,
        [diamondLoupeCut, diamondCutCut],
        [
            InterfaceIds.DiamondLoupe,
            InterfaceIds.DiamondCut,
            InterfaceIds.ERC165,
            InterfaceIds.IMarketController
        ]
    )
    await diamond.deployed();
    deploymentComplete('Diamond', diamond.address, []);

    // Encode MarketController initialization call
    const initAbi = "function initialize(address _accessController, address payable _staking, address payable _multisig, uint256 _vipStakerAmount, uint16 _feePercentage, uint16 _maxRoyaltyPercentage, uint16 _outBidPercentage, uint8 _defaultTicketerType)";
    const mci = new ethers.utils.Interface([initAbi]);
    const callData = mci.encodeFunctionData(
        "initialize",
        [
            accessController.address,
            config.staking,
            config.multisig,
            config.vipStakerAmount,
            config.feePercentage,
            config.maxRoyaltyPercentage,
            config.outBidPercentage,
            config.defaultTicketerType
        ]
    );

    // Cast Diamond to DiamondCutFacet
    const cutFacetViaDiamond = await ethers.getContractAt('DiamondCutFacet', diamond.address);

    // Cut MarketController facet, initializing
    await cutFacetViaDiamond.diamondCut([marketControllerCut], mcf.address, callData);

    // Deploy the chosen LotsTicketer IEscrowTicketer implementation
    const LotsTicketer = await ethers.getContractFactory("LotsTicketer");
    const lotsTicketer = await LotsTicketer.deploy(
        accessController.address,
        diamond.address
    );
    await lotsTicketer.deployed();
    deploymentComplete("LotsTicketer", lotsTicketer.address, [
        accessController.address,
        diamond.address
    ]);

    // Deploy the chosen ItemsTicketer IEscrowTicketer implementation
    const ItemsTicketer = await ethers.getContractFactory("ItemsTicketer");
    const itemsTicketer = await ItemsTicketer.deploy(
        accessController.address,
        diamond.address
    );
    await itemsTicketer.deployed();
    deploymentComplete("ItemsTicketer", itemsTicketer.address, [
        accessController.address,
        diamond.address
    ]);

    // Deploy the SeenHausNFT contract
    const SeenHausNFT = await ethers.getContractFactory("SeenHausNFT");
    const seenHausNFT = await SeenHausNFT.deploy(
        accessController.address,
        diamond.address,
    );
    await seenHausNFT.deployed();
    deploymentComplete('SeenHausNFT', seenHausNFT.address, [
        accessController.address,
        diamond.address
    ]);

    // Deploy the AuctionHandler contract
    const AuctionHandler = await ethers.getContractFactory("AuctionHandler");
    const auctionHandler = await AuctionHandler.deploy(
        accessController.address,
        diamond.address,
    );
    await auctionHandler.deployed();
    deploymentComplete('AuctionHandler', auctionHandler.address, [
        accessController.address,
        diamond.address
    ]);

    // Deploy the SaleHandler contract
    const SaleHandler = await ethers.getContractFactory("SaleHandler");
    const saleHandler = await SaleHandler.deploy(
        accessController.address,
        diamond.address,
    );
    await saleHandler.deployed();
    deploymentComplete('SaleHandler', saleHandler.address, [
        accessController.address,
        diamond.address
    ]);

    // Cast Diamond to MarketController
    const marketControllertViaDiamond = await ethers.getContractAt('MarketController', diamond.address);

    // Add Escrow Ticketer and NFT addresses to MarketController
    await marketControllertViaDiamond.setNft(seenHausNFT.address);
    await marketControllertViaDiamond.setLotsTicketer(lotsTicketer.address);
    await marketControllertViaDiamond.setItemsTicketer(itemsTicketer.address);
    console.log(`✅ MarketController updated with escrow ticketer and NFT addresses.`);

    // Add MARKET_HANDLER role to contracts that need it
    await accessController.grantRole(Role.MARKET_HANDLER, auctionHandler.address);
    await accessController.grantRole(Role.MARKET_HANDLER, saleHandler.address);
    await accessController.grantRole(Role.MARKET_HANDLER, itemsTicketer.address);
    await accessController.grantRole(Role.MARKET_HANDLER, lotsTicketer.address);
    await accessController.grantRole(Role.MARKET_HANDLER, seenHausNFT.address);
    console.log(`✅ Granted MARKET_HANDLER role to AuctionHandler, SaleHandler, ItemsTicketer, LotsTicketer, & SeenHausNFT.`);

    // Bail now if deploying locally
    if (hre.network.name === 'hardhat') process.exit();

    // Wait a minute after deployment completes and then verify contracts on etherscan
    console.log('⏲ Pause one minute, allowing deployments to propagate to Etherscan backend...');
    await delay(60000).then(
        async () => {
            console.log('🔍 Verifying contracts on Etherscan...');
            while(contracts.length) {
                contract = contracts.shift()
                await verifyOnEtherscan(contract);
            }
        }
    );

    console.log("\n");
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function deploymentComplete(name, address, args) {
    contracts.push({name, address, args});
    console.log(`✅ ${name} deployed to: ${address}`);
}

async function verifyOnEtherscan(contract) {
    console.log(`\n📋 Verifying ${contract.name}`);
    try {
        await hre.run("verify:verify", {
            address: contract.address,
            constructorArguments: contract.args,
        })
    } catch (e) {
        console.log(`❌ Failed to verify ${contract.name} on etherscan. ${e.message}`);
    }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
