/**
 * Addresses of the contracts in the Seen.Haus contract suite, grouped by network
 *
 * N.B. Be sure to update this after any redeployment.
 * Scripts rely on these addresses to be up to date.
 *
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
exports.ContractAddresses = {
    
    "rinkeby": {
        AccessController: "0x412dA1252525120CF19B856501e9CDB28584BF9d",
        DiamondLoupeFacet: "0x41c651dDaEc1A534349548DdddfA8E68A2CDf902",
        DiamondCutFacet: "0x5F86a9b4ee2Ae4E393b5c029a3C8dc8DC7dD3032",
        MarketDiamond: "0x32207f46334e41A7745416D4287984b6f9Fe24b2",
        MarketConfigFacet: "0x5d7E22581622b00f20942fe232CAE8e26E9535ac",
        MarketClerkFacet: "0x1E22056199b504a0bDdB5C544F24EFc2C34D1E06",
        AuctionBuilderFacet: "0x1Fb600E58E86717b581a2204233dd98828fd8eB8",
        AuctionRunnerFacet: "0xA0110cE13Be91B72B94DD545585dB32F5fB18bf9",
        AuctionEnderFacet: "0x5f8af74033d731efE1c34ff55eA44496265856ac",
        SaleBuilderFacet: "0xb7494CBE070a39e2D21FfB99b7981CCFCdcFBe14",
        SaleRunnerFacet: "0xA36E19b3D79d3d230f31772edb03024f98B8bCf4",
        SaleEnderFacet: "0xb2349d191c5eF87679dBeB03aE0bb60f43B3166C",
        EthCreditRecoveryFacet: "",
        LotsTicketer: "0xf69D136867445f4dd8640AAe2b10D4d5Ad6ebFc6",
        ItemsTicketer: "0xfa96C834734fE6422547d075cF162F95cf000d00",
        SeenHausNFT: "0x1Ae79bc51137D54689d8eA640ED2f5F0A334aC79",
    },

    "mainnet": {
        AccessController: "",
        DiamondLoupeFacet: "",
        DiamondCutFacet: "",
        MarketDiamond: "",
        MarketConfigFacet: "",
        MarketClerkFacet: "",
        AuctionBuilderFacet: "",
        AuctionRunnerFacet: "",
        AuctionEnderFacet: "",
        SaleBuilderFacet: "",
        SaleRunnerFacet: "",
        SaleEnderFacet: "",
        EthCreditRecoveryFacet: "",
        LotsTicketer: "",
        ItemsTicketer: "",
        SeenHausNFT: "",
    },

};