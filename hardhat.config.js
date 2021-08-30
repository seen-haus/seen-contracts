const environments = require('./environments');
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-web3");
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
      gas: environments.gasLimit
    },
    rinkeby: {
      url: environments.rinkeby.txNode,
      accounts: {mnemonic: environments.rinkeby.mnemonic},
      gas: environments.gasLimit
    },
    mainnet: {
      url: environments.mainnet.txNode,
      accounts: {mnemonic: environments.mainnet.mnemonic},
      gas: environments.gasLimit
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
  }
};