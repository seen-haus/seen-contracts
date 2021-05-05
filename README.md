# Seen Haus Contracts
## Status
WIP: In preparation for V2 contracts that support royalties and secondary markets, 
converting [old contracts](https://github.com/seen-haus/auction-house) to:
  * Use OpenZeppelin npm contracts
  * Build/test/deploy with Hardhat
  * Deploy to mainnet, rinkeby, and local hardhat network
  * Expand unit tests

# Developer Setup
## Prerequisites
### Install Node (also installs NPM)
 * [Get Node](https://nodejs.org/en/download/)

### Install required Node modules
All NPM resources are project-local. No global installs required. 

```
cd path/to/seen-contracts
npm install
```

### Configure Environment
Create a file called `environments.js` with 
- The following info for each Ethereum network environment.
  * `forkNode`: the url endpoint for forking the ethereum network
  * `forkBlock`: the block to fork the network ethereum from
  * `txNode`: the endpoint for sending ethereum transactions
  * `mnemonic`: a valid ethereum HD wallet seed phrase

- The following info for interacting with Etherscan and Coinmarketcap:
  * `etherscan.apiKey`: your etherscan API key
  * `coinmarketcap.apiKey`: your coinmarketcap API key

```javascript
module.exports = {
    "etherscan": {
        "apiKey": "<YOUR_ETHERSCAN_API_KEY>"
    },

  "coinmarketcap": {
    "apiKey": "<YOUR_COINMARKETCAP_API_KEY>"
  },

  "rinkeby": {
        "forkNode": "https://eth-rinkeby.alchemyapi.io/v2/<YOUR_ALCHEMY_API_KEY>",
        "forkBlock": 7507432,
        "txNode": "https://rinkeby.infura.io/v3/<YOUR_INFURA_API_KEY>",
        "mnemonic": "<YOUR_UNIQUE_TWELVE_WORD_WALLET_SEED_PHRASE>"
    }

};
```

# Development Tasks
## NPM Scripts
### Build the contracts
This creates the build artifacts for deployment or testing

```npm run build```

### Test the contracts
This builds the contracts and runs the unit tests.

```npm run test```

### Deploy to Hardhat network
This deploys the built contracts to local network (mainly to test deployment script)

```npm run deploy:local```


### Deploy to Rinkeby
This deploys the built contracts to Rinkeby

```npm run deploy:rinkeby```

### Deploy to Mainnet
This deploys the built contracts to Mainnet

```npm run deploy:mainnet```
