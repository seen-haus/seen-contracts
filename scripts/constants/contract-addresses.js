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
        AccessController: "0xB0cd73348CF67DdD43e1340Fb3a09a00909EE560",
        DiamondLoupeFacet: "0x13568ac49B8f98d1384Dfad89aBFEeB029D30F43",
        DiamondCutFacet: "0x2C88d1aF5fAf07eb02516F1ddd5C3eC32d55acaA",
        MarketDiamond: "0x39912e225928aAeb5909F1116587C078ae4A89b4",
        MarketConfigFacet: "0xdB429eA3a32DDB6323024E486ab632fdE328a7A0",
        MarketClerkFacet: "0xA5dda9bF9B1E3c29376856E19B31Ad58D04111BE",
        AuctionBuilderFacet: "0x59B3D925C76D4009b02b2a50C90f3795AEA55c1d",
        AuctionRunnerFacet: "0x5caF6505daDBD718B69B40bcF9e86C14ACe615db",
        SaleBuilderFacet: "0x258E28802a7FF5E003859BFb0821b6A553C8338F",
        SaleRunnerFacet: "0xfad07B25984fCa9053868457889FB05501af77f4",
        LotsTicketer: "0xa893fb894C1E740F17E8f5C15D9017F3A0b18595",
        ItemsTicketer: "0xbeD52408b07c60c590749029c00db0c6A34d43A7",
        SeenHausNFT: "0xdB6b202685D46a0d65256bAa7e662DbD91A92B87",
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
        SaleBuilderFacet: "",
        SaleRunnerFacet: "",
        LotsTicketer: "",
        ItemsTicketer: "",
        SeenHausNFT: "",
    },

};