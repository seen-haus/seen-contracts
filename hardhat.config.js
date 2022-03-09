const environments = require('./environments');
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-web3");
require("hardhat-contract-sizer");
require("hardhat-gas-reporter");
require("solidity-coverage");

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      /*
      forking: {
        url: environments.rinkeby.forkNode,
        blockNumber: environments.rinkeby.forkBlock
      }
      */
    },
    rinkeby: {
      url: environments.rinkeby.txNode,
      accounts:[`${environments.rinkeby.privateKey}`],
      gas: environments.gasLimit
    },
    goerli: {
      url: environments.goerli.txNode,
      accounts:[`${environments.goerli.privateKey}`],
      gas: environments.gasLimit,
      gasPrice: 40000000000
    },
    mainnet: {
      url: environments.mainnet.txNode,
      accounts: [`${environments.mainnet.privateKey}`],
      gas: environments.gasLimit,
      gasPrice: 35000000000,
      timeout: 240000,
    }
  },
  etherscan: {
    apiKey: environments.etherscan.apiKey
  },
  solidity: {
    version: "0.8.2",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
        details: {
          yul: true
        }
      }
    }
  },
  gasReporter: {
    currency: 'USD',
    enabled: true,
    gasPrice: 300,
    coinmarketcap: environments.coinmarketcap.apiKey,
    showTimeSpent: true,
    showMethodSig: true
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  }
};