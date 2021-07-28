const { assert } = require('chai');
const hre = require("hardhat");
const ethers = hre.ethers;

const { getSelectors, InterfaceIds, FacetCutAction, removeSelectors } = require('../../scripts/util/diamond-utils.js')
const { deployDiamond } = require('../../scripts/util/deploy-diamond.js');
const Facet = require("../../domain/Facet");

describe('Diamond', async function () {

  // Common constants
  const gasLimit = 1600000;

  // Common vars
  let diamond, diamondLoupe, diamondCut;
  let loupeFacetViaDiamond, cutFacetViaDiamond;
  let Test1Facet, test1Facet, test1ViaDiamond, Test2Facet, test2Facet, test2ViaDiamond;
  let tx, receipt, addresses, address, selectors, interfaces, facets, facet, facetCuts, result, keepers;

  beforeEach(async function () {

    // Deploy the AccessController
    const AccessController = await ethers.getContractFactory("AccessController");
    const accessController = await AccessController.deploy();
    await accessController.deployed();

    // Interfaces that will be supported at the Diamond address
    interfaces = [
      InterfaceIds.DiamondLoupe,
      InterfaceIds.DiamondCut,
      InterfaceIds.ERC165
    ];

    // Deploy the Diamond
    [diamond, diamondLoupe, diamondCut] = await deployDiamond(accessController, interfaces);

    // Cast Diamond to DiamondLoupeFacet
    loupeFacetViaDiamond = await ethers.getContractAt('DiamondLoupeFacet', diamond.address);

    // Cast Diamond to DiamondCutFacet
    cutFacetViaDiamond = await ethers.getContractAt('DiamondCutFacet', diamond.address);

    // Get the facet addresses
    addresses = Object.assign([], await loupeFacetViaDiamond.facetAddresses());

  });

  context("DiamondLoupeFacet", async function () {

    context("facets()", async () => {

      beforeEach(async function () {

        // Get facets
        facets = await loupeFacetViaDiamond.facets();

      });

      it('should return the correct number of objects', async () => {

        // Make sure the count is correct
        assert.equal(facets.length, 2);

      });

      it('should return valid Facet objects', async () => {

        // Wrap Facet entity around results and validate
        facets.forEach(result => {
          assert.isTrue(Facet.fromObject(result).isValid());
        })

      });

      it('should return expected facet data', async () => {

        // Get all the function selectors for all the interfaces
        interfaces = [getSelectors(loupeFacetViaDiamond), getSelectors(cutFacetViaDiamond)];

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
            address = await loupeFacetViaDiamond.facetAddress(selector);
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

        // DiamondLoupeFacet was first cut
        assert.equal(addresses[0], diamondLoupe.address);

        // DiamondCutFacet was second cut
        assert.equal(addresses[1], diamondCut.address);

      });

    });

    context("facetFunctionSelectors() ", async () => {

      it('should return the correct function selectors for the DiamondCutFacet', async () => {

        // Test cutFacetViaDiamond selectors
        selectors = getSelectors(cutFacetViaDiamond);
        result = await loupeFacetViaDiamond.facetFunctionSelectors(diamondCut.address);
        assert.sameMembers(result, selectors);

      });

      it('should return the correct function selectors for the DiamondLoupeFacet', async () => {

        // Test DiamondLoupeFacet selectors
        selectors = getSelectors(loupeFacetViaDiamond);
        result = await loupeFacetViaDiamond.facetFunctionSelectors(diamondLoupe.address);
        assert.sameMembers(result, selectors);

      });

    });

    context("facetAddress() ", async () => {

      it('should return the correct facet addresses for all deployed selectors', async () => {

        // Get all the function selectors for all the interfaces
        interfaces = [getSelectors(loupeFacetViaDiamond), getSelectors(cutFacetViaDiamond)];

        // Iterate the interfaces
        interfaces.forEach((facet, index) => {

          // Iterate the selectors
          facet.forEach(async selector => {

            // Make sure the correct facet address is returned for the given selector
            address = await loupeFacetViaDiamond.facetAddress(selector);
            assert.equal(
                addresses[index],
                address
            );

          });

        });

      });

    });

  });

  // TODO: Add tests of diamondCut where the newly cut facet's address and a function call with arguments are passed
  // Need to be certain that intializer functions are properly executed and demonstrate how to encode the calls
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

      // Cast Diamond to Test1Facet
      test1ViaDiamond = await ethers.getContractAt('Test1Facet', diamond.address);

      // Cast Diamond to Test2Facet
      test2ViaDiamond = await ethers.getContractAt('Test2Facet', diamond.address);

    });

    context("diamondCut()", async function () {

      it('should add functions from Test1Facet', async () => {

        // Get the Test1Facet function selectors from the abi
        selectors = getSelectors(test1Facet);

        // Define the facet cut
        facetCuts = [{
          facetAddress: test1Facet.address,
          action: FacetCutAction.Add,
          functionSelectors: selectors
        }];

        // Send the DiamondCut transaction
        tx = await cutFacetViaDiamond.diamondCut(facetCuts, ethers.constants.AddressZero, '0x', { gasLimit });

        // Wait for transaction to confirm
        receipt = await tx.wait();

        // Be certain transaction was successful
        assert.equal(receipt.status, 1,`Diamond upgrade failed: ${tx.hash}`)

        // Make sure function selectors for the facet are correct
        result = await loupeFacetViaDiamond.facetFunctionSelectors(test1Facet.address);
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
        tx = await cutFacetViaDiamond.diamondCut(facetCuts, ethers.constants.AddressZero, '0x', { gasLimit });

        // Wait for transaction to confirm
        receipt = await tx.wait();

        // Be certain transaction was successful
        assert.equal(receipt.status, 1,`Diamond upgrade failed: ${tx.hash}`)

        // Make sure function selectors for the facet are correct
        result = await loupeFacetViaDiamond.facetFunctionSelectors(test2Facet.address);
        assert.sameMembers(result, selectors);

      });

      it('should allow functions from different facets to be added in one transaction ', async () => {

        // Get even numbered selectors from Test1Facet + odd from Test2Facet
        selectors = [
            getSelectors(test1ViaDiamond).filter((s,i) => i % 2),
            getSelectors(test2ViaDiamond).filter((s,i) => !(i % 2)),
        ];

        // Define facet cuts
        facetCuts = [
          {
            facetAddress: test1Facet.address,
            action: FacetCutAction.Add,
            functionSelectors: selectors[0]
          },
          {
            facetAddress: test2Facet.address,
            action: FacetCutAction.Add,
            functionSelectors: selectors[1]
          }
        ];

        // Send the DiamondCut transaction
        tx = await cutFacetViaDiamond.diamondCut(facetCuts, ethers.constants.AddressZero, '0x', { gasLimit })

        // Be certain transaction was successful
        assert.equal(receipt.status, 1,`Diamond upgrade failed: ${tx.hash}`);

        // Ensure the currently installed test selectors are what we added
        result = [
            await loupeFacetViaDiamond.facetFunctionSelectors(test1Facet.address),
            await loupeFacetViaDiamond.facetFunctionSelectors(test2Facet.address)
        ];
        assert.sameMembers(result.flat(), selectors.flat());

      });

      context("With Test1Facet and Test2Facet added", async function () {

        beforeEach(async function () {

          // Define the facet cuts
          facetCuts = [
            {
              facetAddress: test1Facet.address,
              action: FacetCutAction.Add,
              functionSelectors: getSelectors(test1Facet)
            },
            {
              facetAddress: test2Facet.address,
              action: FacetCutAction.Add,
              functionSelectors: getSelectors(test2Facet)
            }
          ];

          // Send the DiamondCut transaction
          tx = await cutFacetViaDiamond.diamondCut(facetCuts, ethers.constants.AddressZero, '0x', { gasLimit });

          // Wait for transaction to confirm
          receipt = await tx.wait();

          // Be certain transaction was successful
          assert.equal(receipt.status, 1,`Diamond upgrade failed: ${tx.hash}`)

        });

        it('should properly proxy functions located on Test1Facet', async () => {

          assert.isFalse(await test1ViaDiamond.test1Func1());
          assert.isFalse(await test1ViaDiamond.test1Func2());
          assert.isFalse(await test1ViaDiamond.test1Func3());
          assert.isFalse(await test1ViaDiamond.test1Func4());
          assert.isFalse(await test1ViaDiamond.test1Func5());
          assert.isTrue(await test1ViaDiamond.test1Func6());
          assert.isTrue(await test1ViaDiamond.test1Func7());
          assert.isTrue(await test1ViaDiamond.test1Func8());
          assert.isTrue(await test1ViaDiamond.test1Func9());
          assert.isTrue(await test1ViaDiamond.test1Func10());
          assert.isFalse(await test1ViaDiamond.test1Func11());
          assert.isFalse(await test1ViaDiamond.test1Func12());
          assert.isFalse(await test1ViaDiamond.test1Func13());
          assert.isFalse(await test1ViaDiamond.test1Func14());
          assert.isFalse(await test1ViaDiamond.test1Func15());
          assert.isTrue(await test1ViaDiamond.test1Func16());
          assert.isTrue(await test1ViaDiamond.test1Func17());
          assert.isTrue(await test1ViaDiamond.test1Func18());
          assert.isTrue(await test1ViaDiamond.test1Func19());
          assert.isTrue(await test1ViaDiamond.test1Func20());

        });

        it('should properly proxy functions located on Test2Facet', async () => {

          assert.equal(await test2ViaDiamond.test2Func1(), "Seen");
          assert.equal(await test2ViaDiamond.test2Func2(), "Seen");
          assert.equal(await test2ViaDiamond.test2Func3(), "Seen");
          assert.equal(await test2ViaDiamond.test2Func4(), "Seen");
          assert.equal(await test2ViaDiamond.test2Func5(), "Seen");
          assert.equal(await test2ViaDiamond.test2Func6(), "Haus");
          assert.equal(await test2ViaDiamond.test2Func7(), "Haus");
          assert.equal(await test2ViaDiamond.test2Func8(), "Haus");
          assert.equal(await test2ViaDiamond.test2Func9(), "Haus");
          assert.equal(await test2ViaDiamond.test2Func10(), "Haus");
          assert.equal(await test2ViaDiamond.test2Func11(), "Seen");
          assert.equal(await test2ViaDiamond.test2Func12(), "Seen");
          assert.equal(await test2ViaDiamond.test2Func13(), "Seen");
          assert.equal(await test2ViaDiamond.test2Func14(), "Seen");
          assert.equal(await test2ViaDiamond.test2Func15(), "Seen");
          assert.equal(await test2ViaDiamond.test2Func16(), "Haus");
          assert.equal(await test2ViaDiamond.test2Func17(), "Haus");
          assert.equal(await test2ViaDiamond.test2Func18(), "Haus");
          assert.equal(await test2ViaDiamond.test2Func19(), "Haus");
          assert.equal(await test2ViaDiamond.test2Func20(), "Haus");

        });

        it('should allow removal of arbitrary functions from Test1Facet', async () => {

          // Get selectors to remove
          keepers = ['test1Func2()', 'test1Func11()', 'test1Func12()'];
          selectors = getSelectors(test1Facet).remove(keepers);

          // Define the facet cuts
          facetCuts = [{
            facetAddress: ethers.constants.AddressZero,
            action: FacetCutAction.Remove,
            functionSelectors: selectors
          }];

          // Send the DiamondCut transaction
          tx = await cutFacetViaDiamond.diamondCut(facetCuts, ethers.constants.AddressZero, '0x', { gasLimit });

          // Wait for transaction to confirm
          receipt = await tx.wait();

          // Be certain transaction was successful
          assert.equal(receipt.status, 1,`Diamond upgrade failed: ${tx.hash}`);

          // Verify that the function selectors were removed
          result = await loupeFacetViaDiamond.facetFunctionSelectors(test1Facet.address);
          assert.sameMembers(result, getSelectors(test1Facet).get(keepers));

        });

        it('should allow removal of arbitrary functions from Test2Facet', async () => {

          // Get selectors to be removed
          keepers = ['test2Func1()', 'test2Func5()', 'test2Func6()', 'test2Func19()', 'test2Func20()'];
          selectors = getSelectors(test2Facet).remove(keepers);

          // Define the facet cuts
          facetCuts = [{
            facetAddress: ethers.constants.AddressZero,
            action: FacetCutAction.Remove,
            functionSelectors: selectors
          }];

          // Send the DiamondCut transaction
          tx = await cutFacetViaDiamond.diamondCut(facetCuts, ethers.constants.AddressZero, '0x', { gasLimit });

          // Wait for transaction to confirm
          receipt = await tx.wait();

          // Be certain transaction was successful
          assert.equal(receipt.status, 1,`Diamond upgrade failed: ${tx.hash}`);

          // Verify that the function selectors were removed
          result = await loupeFacetViaDiamond.facetFunctionSelectors(test2Facet.address);
          assert.sameMembers(result, getSelectors(test2Facet).get(keepers));

        });

        it("should remove facets when all their functions are removed", async () => {

          // Get all deployed facets
          facets = await loupeFacetViaDiamond.facets();
          assert.equal(facets.length, 4); // loupe, cut, test1, test2

          // Group the selectors from each facet
          selectors = [];
          for (let i = 0; i < facets.length; i++) {
            selectors.push(...facets[i].functionSelectors);
          }

          // Keep only the facets function on the DiamondLoupeFacet
          keepers = ['facets()'];
          selectors = removeSelectors(selectors, keepers);

          // Define the facet cuts
          facetCuts = [{
            facetAddress: ethers.constants.AddressZero,
            action: FacetCutAction.Remove,
            functionSelectors: selectors
          }];

          // Send the DiamondCut transaction
          tx = await cutFacetViaDiamond.diamondCut(facetCuts, ethers.constants.AddressZero, '0x', { gasLimit });

          // Wait for transaction to confirm
          receipt = await tx.wait();

          // Be certain transaction was successful
          assert.equal(receipt.status, 1,`Diamond upgrade failed: ${tx.hash}`);

          // Get the updated facet list
          facets = await loupeFacetViaDiamond.facets();

          // Wrap Facet entity around each result and validate
          facets.forEach(result => {
            assert.isTrue(Facet.fromObject(result).isValid());
          });

          // Check that only one facet remains
          assert.equal(facets.length, 1); // loupe

          // Check that the remaining facet address is correct
          assert.equal(
              facets[0].facetAddress,
              diamondLoupe.address,
              "Incorrect facet address"
          );

        });

      });

    });

  });

})
