/* global describe it before ethers */

const {
  getSelectors,
  InterfaceIds,
  FacetCutAction,
  removeSelectors,
  findAddressPositionInFacets
} = require('../../scripts/libraries/diamond-utils.js')

const { deployDiamond } = require('../../scripts/deploy-diamond.js');
const { assert } = require('chai');

describe('Diamond', async function () {

  // Common constants
  const gasLimit = 1600000;

  // Common vars
  let diamondAddress, diamondCutAddress, diamondLoupeAddress;
  let diamondCutFacet, diamondLoupeFacet;
  let Test1Facet, test1Facet, Test2Facet, test2Facet;
  let tx, receipt, addresses, address, selectors, interfaces, facets, facetCuts, result;

  beforeEach(async function () {

    // Deploy the Diamond
    [diamondAddress, diamondCutAddress, diamondLoupeAddress] = await deployDiamond();

    // Cast Diamond to DiamondCutFacet
    diamondCutFacet = await ethers.getContractAt('DiamondCutFacet', diamondAddress);

    // Cast Diamond to DiamondCutFacet
    diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', diamondAddress);

  });

  context("DiamondLoupeFacet", async function () {

    beforeEach(async function () {

      // Get the facet addresses
      addresses = Object.assign([], await diamondLoupeFacet.facetAddresses());

    });

    context("facets()", async () => {

      beforeEach(async function () {

        // TODO - add a Facet domain object and verify that the returned facets are valid

        // Get facets
        facets = await diamondLoupeFacet.facets();

      });

      it('should return the correct number of facets', async () => {

        // Make sure the count is correct
        assert.equal(facets.length, 2);

      });

      it('should return correct facet information', async () => {

        // Get all the function selectors for all the interfaces
        interfaces = [getSelectors(diamondCutFacet), getSelectors(diamondLoupeFacet)];

        // Iterate the interfaces
        interfaces.forEach((facet, index) => {

          // Check that the facet address is correct
          assert.equal(
              addresses[index],
              facets[index].facetAddress,
              "Incorrect facet address"
          );

          // Iterate the function selectors
          facet.forEach(async selector => {

            // Check that the correct facet address is returned for the given selector
            address = await diamondLoupeFacet.facetAddress(selector);
            assert.equal(
                addresses[index],
                address
            );

          });

        });

      });

    });

    context("facetAddresses()", async () => {

      it('should return two facet addresses', async () => {

        // Make sure the count is correct
        assert.equal(addresses.length, 2);

      });

      it('facet addresses should be correct and in order', async () => {

        // DiamondCutFacet was first cut
        assert.equal(addresses[0], diamondCutAddress);

        // DiamondLoupeFacet was second cut
        assert.equal(addresses[1], diamondLoupeAddress);

      });

    });

    context("facetFunctionSelectors() ", async () => {

      it('should return the correct function selectors for the DiamondCutFacet', async () => {

        // Test DiamondCutFacet selectors
        let selectors = getSelectors(diamondCutFacet);
        result = await diamondLoupeFacet.facetFunctionSelectors(diamondCutAddress);
        assert.sameMembers(result, selectors);

      });

      it('should return the correct function selectors for the DiamondLoupeFacet', async () => {

        // Test DiamondLoupeFacet selectors
        selectors = getSelectors(diamondLoupeFacet);
        result = await diamondLoupeFacet.facetFunctionSelectors(diamondLoupeAddress);
        assert.sameMembers(result, selectors);

      });

    });

    context("facetAddress() ", async () => {

      it('should return the correct facet addresses for deployed selectors', async () => {

        // Get all the function selectors for all the interfaces
        interfaces = [getSelectors(diamondCutFacet), getSelectors(diamondLoupeFacet)];

        // Iterate the interfaces
        interfaces.forEach((facet, index) => {

          // Iterate the selectors
          facet.forEach(async selector => {

            // Make sure the correct facet address is returned for the given selector
            address = await diamondLoupeFacet.facetAddress(selector);
            assert.equal(
                addresses[index],
                address
            );

          });

        });

      });

    });

  });

  context("DiamondCutFacet", async function () {

    beforeEach(async function () {

      // Deploy Test1Facet and add its address to the list
      Test1Facet = await ethers.getContractFactory('Test1Facet');
      test1Facet = await Test1Facet.deploy();
      await test1Facet.deployed();
      addresses.push(test1Facet.address);

      // Deploy Test2Facet and add its address to the list
      Test2Facet = await ethers.getContractFactory('Test2Facet');
      test2Facet = await Test2Facet.deploy();
      await test2Facet.deployed();
      addresses.push(test2Facet.address);

    });

    context("diamondCut()", async function () {

      it('should add functions from Test1Facet', async () => {

        // Get the Test1Facet function selectors from the abi
        selectors = getSelectors(test1Facet).remove(['supportsInterface(bytes4)'])

        // Define the facet cut
        facetCuts = [{
          facetAddress: test1Facet.address,
          action: FacetCutAction.Add,
          functionSelectors: selectors
        }];

        // Send the DiamondCut transaction
        tx = await diamondCutFacet.diamondCut(facetCuts, ethers.constants.AddressZero, '0x', { gasLimit });

        // Wait for transacion to confirm
        receipt = await tx.wait();

        // Be certain transaction was successful
        assert.equal(receipt.status, 1,`Diamond upgrade failed: ${tx.hash}`)

        // Make sure function selectors for the facet are correct
        result = await diamondLoupeFacet.facetFunctionSelectors(test1Facet.address);
        assert.sameMembers(result, selectors);

      });

      it('should add functions from Test2Facet', async () => {

        // Get the Test1Facet function selectors from the abi
        selectors = getSelectors(test2Facet);

        // Define the facet cut
        facetCuts = [{
          facetAddress: test2Facet.address,
          action: FacetCutAction.Add,
          functionSelectors: selectors
        }];

        // Send the DiamondCut transaction
        tx = await diamondCutFacet.diamondCut(facetCuts, ethers.constants.AddressZero, '0x', { gasLimit });

        // Wait for transacion to confirm
        receipt = await tx.wait();

        // Be certain transaction was successful
        assert.equal(receipt.status, 1,`Diamond upgrade failed: ${tx.hash}`)

        // Make sure function selectors for the facet are correct
        result = await diamondLoupeFacet.facetFunctionSelectors(test2Facet.address);
        assert.sameMembers(result, selectors);

      });

      context("With Test1Facet and Test2Facet added", async function () {

        beforeEach(async function () {

          // Define the facet cut
          facetCuts = [
            {
              facetAddress: test1Facet.address,
              action: FacetCutAction.Add,
              functionSelectors: getSelectors(test1Facet).remove([InterfaceIds.ERC165])
            },
            {
              facetAddress: test2Facet.address,
              action: FacetCutAction.Add,
              functionSelectors: getSelectors(test2Facet)
            }
          ];

          // Send the DiamondCut transaction
          tx = await diamondCutFacet.diamondCut(facetCuts, ethers.constants.AddressZero, '0x', { gasLimit });

          // Wait for transacion to confirm
          receipt = await tx.wait();

          // Be certain transaction was successful
          assert.equal(receipt.status, 1,`Diamond upgrade failed: ${tx.hash}`)

        });

        it('should test function call', async () => {
          const test1Facet = await ethers.getContractAt('Test1Facet', diamondAddress)
          await test1Facet.test1Func10();
        })

        xit('should replace supportsInterface function', async () => {
          const Test1Facet = await ethers.getContractFactory('Test1Facet')
          const selectors = getSelectors(Test1Facet).get(['supportsInterface(bytes4)'])
          const testFacetAddress = addresses[3]
          tx = await diamondCutFacet.diamondCut(
              [{
                facetAddress: testFacetAddress,
                action: FacetCutAction.Replace,
                functionSelectors: selectors
              }],
              ethers.constants.AddressZero, '0x', { gasLimit })
          receipt = await tx.wait()
          if (!receipt.status) {
            throw Error(`Diamond upgrade failed: ${tx.hash}`)
          }
          result = await diamondLoupeFacet.facetFunctionSelectors(testFacetAddress)
          assert.sameMembers(result, getSelectors(Test1Facet))
        })

        xit('should remove some test2 functions', async () => {
          const test2Facet = await ethers.getContractAt('Test2Facet', diamondAddress)
          const functionsToKeep = ['test2Func1()', 'test2Func5()', 'test2Func6()', 'test2Func19()', 'test2Func20()']
          const selectors = getSelectors(test2Facet).remove(functionsToKeep)
          tx = await diamondCutFacet.diamondCut(
              [{
                facetAddress: ethers.constants.AddressZero,
                action: FacetCutAction.Remove,
                functionSelectors: selectors
              }],
              ethers.constants.AddressZero, '0x', { gasLimit })
          receipt = await tx.wait()
          if (!receipt.status) {
            throw Error(`Diamond upgrade failed: ${tx.hash}`)
          }
          result = await diamondLoupeFacet.facetFunctionSelectors(addresses[4])
          assert.sameMembers(result, getSelectors(test2Facet).get(functionsToKeep))
        })

        xit('should remove some test1 functions', async () => {
          const test1Facet = await ethers.getContractAt('Test1Facet', diamondAddress)
          const functionsToKeep = ['test1Func2()', 'test1Func11()', 'test1Func12()']
          const selectors = getSelectors(test1Facet).remove(functionsToKeep)
          tx = await diamondCutFacet.diamondCut(
              [{
                facetAddress: ethers.constants.AddressZero,
                action: FacetCutAction.Remove,
                functionSelectors: selectors
              }],
              ethers.constants.AddressZero, '0x', { gasLimit })
          receipt = await tx.wait()
          if (!receipt.status) {
            throw Error(`Diamond upgrade failed: ${tx.hash}`)
          }
          result = await diamondLoupeFacet.facetFunctionSelectors(addresses[3])
          assert.sameMembers(result, getSelectors(test1Facet).get(functionsToKeep))
        })

        xit("remove all functions and facets except 'diamondCut' and 'facets'", async () => {
          let selectors = []
          let facets = await diamondLoupeFacet.facets()
          for (let i = 0; i < facets.length; i++) {
            selectors.push(...facets[i].functionSelectors)
          }
          selectors = removeSelectors(selectors, ['facets()', 'diamondCut(tuple(address,uint8,bytes4[])[],address,bytes)'])
          tx = await diamondCutFacet.diamondCut(
              [{
                facetAddress: ethers.constants.AddressZero,
                action: FacetCutAction.Remove,
                functionSelectors: selectors
              }],
              ethers.constants.AddressZero, '0x', { gasLimit })
          receipt = await tx.wait()
          if (!receipt.status) {
            throw Error(`Diamond upgrade failed: ${tx.hash}`)
          }
          facets = await diamondLoupeFacet.facets()
          assert.equal(facets.length, 2)
          assert.equal(facets[0][0], addresses[0])
          assert.sameMembers(facets[0][1], ['0x1f931c1c'])
          assert.equal(facets[1][0], addresses[1])
          assert.sameMembers(facets[1][1], ['0x7a0ed627'])
        })

        xit('add most functions and facets', async () => {
          const diamondLoupeFacetSelectors = getSelectors(diamondLoupeFacet).remove(['supportsInterface(bytes4)'])
          const Test1Facet = await ethers.getContractFactory('Test1Facet')
          const Test2Facet = await ethers.getContractFactory('Test2Facet')
          // Any number of functions from any number of facets can be added/replaced/removed in a
          // single transaction
          const cut = [
            {
              facetAddress: addresses[1],
              action: FacetCutAction.Add,
              functionSelectors: diamondLoupeFacetSelectors.remove(['facets()'])
            },
            {
              facetAddress: addresses[2],
              action: FacetCutAction.Add,
              functionSelectors: getSelectors(ownershipFacet)
            },
            {
              facetAddress: addresses[3],
              action: FacetCutAction.Add,
              functionSelectors: getSelectors(Test1Facet)
            },
            {
              facetAddress: addresses[4],
              action: FacetCutAction.Add,
              functionSelectors: getSelectors(Test2Facet)
            }
          ]
          tx = await diamondCutFacet.diamondCut(cut, ethers.constants.AddressZero, '0x', { gasLimit })
          receipt = await tx.wait()
          if (!receipt.status) {
            throw Error(`Diamond upgrade failed: ${tx.hash}`)
          }
          const facets = await diamondLoupeFacet.facets()
          const facetAddresses = await diamondLoupeFacet.facetAddresses()
          assert.equal(facetAddresses.length, 5)
          assert.equal(facets.length, 5)
          assert.sameMembers(facetAddresses, addresses)
          assert.equal(facets[0][0], facetAddresses[0], 'first facet')
          assert.equal(facets[1][0], facetAddresses[1], 'second facet')
          assert.equal(facets[2][0], facetAddresses[2], 'third facet')
          assert.equal(facets[3][0], facetAddresses[3], 'fourth facet')
          assert.equal(facets[4][0], facetAddresses[4], 'fifth facet')
          assert.sameMembers(facets[findAddressPositionInFacets(addresses[0], facets)][1], getSelectors(diamondCutFacet))
          assert.sameMembers(facets[findAddressPositionInFacets(addresses[1], facets)][1], diamondLoupeFacetSelectors)
          assert.sameMembers(facets[findAddressPositionInFacets(addresses[2], facets)][1], getSelectors(ownershipFacet))
          assert.sameMembers(facets[findAddressPositionInFacets(addresses[3], facets)][1], getSelectors(Test1Facet))
          assert.sameMembers(facets[findAddressPositionInFacets(addresses[4], facets)][1], getSelectors(Test2Facet))
        });

      });

    });

  });

})
