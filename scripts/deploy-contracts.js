const hre = require("hardhat");
const ethers = hre.ethers;

let contract, contracts = [];
const divider = "-".repeat(80);

function getDependencies() {

    const WETH = {
        'mainnet': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        'rinkeby': '0xc778417e063141139fce010982780140aa0cd5ab'
    }
    const SUSHI = {
        'mainnet': '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
        'rinkeby': '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f'
    };
    const SEEN = {
        'mainnet': '0xCa3FE04C7Ee111F0bbb02C328c699226aCf9Fd33',
        'rinkeby': '0x1046cff2f3e24fd3ea2c229f4463fb93d8d2cb63'
    }

    const network = hre.network.name;

    return (network != 'hardhat')
        ? {
            weth: WETH[network],
            sushi: SUSHI[network],
            seen: SEEN[network],
          }
        : undefined;

}

// TODO: Rework with new contracts

async function main() {

    // Compile everything (in case run by node)
    await hre.run('compile');

    console.log(`\n${divider}\nNetwork: ${hre.network.name}\nDeploying. ${new Date()}\n${divider}\n`);

    const deps = getDependencies(); // already deployed contract dependencies

    const accounts = await ethers.provider.listAccounts();
    const deployer = accounts[0];
    console.log("🔱 Deployer account: ", deployer ? deployer : "not found" && process.exit() );

    // Deploy contracts
    const SeenHaus = await ethers.getContractFactory("SeenHaus");
    const seenHaus = await SeenHaus.deploy();
    await seenHaus.deployed();
    if (deps) await seenHaus.setCollaborators(deps.weth, deps.sushi, deps.seen);
    deploymentComplete('SeenHaus', seenHaus.address, [] );

    const AuctionERC721 = await ethers.getContractFactory("ERC721AuctionHouse");
    const auctionERC721 = await AuctionERC721.deploy();
    await auctionERC721.deployed();
    deploymentComplete('ERC721AuctionHouse', auctionERC721.address, [] );

    const AuctionERC1155 = await ethers.getContractFactory("ERC1155AuctionHouse");
    const auctionERC1155 = await AuctionERC1155.deploy();
    await auctionERC1155.deployed();
    deploymentComplete('ERC1155AuctionHouse', auctionERC1155.address, [] );

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
