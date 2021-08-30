const { assert, expect} = require('chai');
const hre = require("hardhat");
const ethers = hre.ethers;

const Role = require("../../scripts/domain/Role");
const Facet = require("../../scripts/domain/Facet");
const { deployMarketDiamond } = require('../../scripts/util/deploy-market-diamond.js');
const { getSelectors, FacetCutAction, removeSelectors } = require('../../scripts/util/diamond-utils.js')

/**
 * Test the Market Diamond contract and its core facets
 *
 * @notice Based on Nick Mudge's gas-optimized diamond-2 reference,
 * with modifications to support role-based access and management of
 * supported interfaces.
 *
 * These tests have been refactored to remove dependency upon the
 * actions of previous tests, and to use contexts to group tests to
 * to make them easier to reason about and spot gaps in coverage.
 *
 * They also include new tests for initializer functions and storage
 * slots.
 *
 * @author Nick Mudge <nick@perfectabstractions.com> (https://twitter.com/mudgen)
 * @author Cliff Hall <cliff@futurescale.com> (https://twitter.com/seaofarrows)
 */
describe('MarketDiamond', async function () {

  // Common constants
  const gasLimit = 1600000;

  // Common vars
  let accounts, deployer, admin, upgrader, rando;
  let marketDiamond, diamondLoupe, diamondCut;
  let loupeFacetViaDiamond, cutFacetViaDiamond;
  let Test1Facet, test1Facet, test1ViaDiamond;
  let Test2Facet, test2Facet, test2ViaDiamond;
  let Test3Facet, test3Facet, test3ViaDiamond;
  let Test2FacetUpgrade, test2FacetUpgrade;
  let tx, receipt, addresses, address, selectors;
  let interfaces, facets, facetCuts, result;
  let initFunction, initInterface, initCallData;
  let keepers;

  beforeEach(async function () {

    // Make accounts available
    accounts = await ethers.getSigners();
    deployer = accounts[0];
    admin = accounts[1];
    upgrader = accounts[2];
    rando = accounts[3];

    // Deploy the Diamond
    [marketDiamond, diamondLoupe, diamondCut, accessController] = await deployMarketDiamond();

    // Cast Diamond to DiamondLoupeFacet
    loupeFacetViaDiamond = await ethers.getContractAt('DiamondLoupeFacet', marketDiamond.address);

    // Cast Diamond to DiamondCutFacet
    cutFacetViaDiamond = await ethers.getContractAt('DiamondCutFacet', marketDiamond.address);

    // Get the facet addresses
    addresses = Object.assign([], await loupeFacetViaDiamond.facetAddresses());

    // Deployer grants ADMIN role to admin address and renounces admin
    await accessController.connect(deployer).grantRole(Role.ADMIN, admin.address);
    await accessController.connect(deployer).renounceRole(Role.ADMIN, deployer.address);

    // Grant UPGRADER role to upgrader account
    await accessController.connect(admin).grantRole(Role.UPGRADER, upgrader.address);

  });

  // Introspection tests
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

  // Modification tests
  context("DiamondCutFacet", async function () {

    beforeEach(async function () {

      // Deploy Test1Facet
      Test1Facet = await ethers.getContractFactory('Test1Facet');
      test1Facet = await Test1Facet.deploy();
      await test1Facet.deployed();

      // Deploy Test2Facet
      Test2Facet = await ethers.getContractFactory('Test2Facet');
      test2Facet = await Test2Facet.deploy();
      await test2Facet.deployed();

      // Deploy Test3Facet
      Test3Facet = await ethers.getContractFactory('Test3Facet');
      test3Facet = await Test3Facet.deploy();
      await test3Facet.deployed();

      // N.B. The facets are not yet connected to the diamond in any way,
      // but following handles prepare us for accessing the diamond via
      // the ABI of these facets, once their functions have been added.

      // Cast Diamond to Test1Facet
      test1ViaDiamond = await ethers.getContractAt('Test1Facet', marketDiamond.address);

      // Cast Diamond to Test2Facet
      test2ViaDiamond = await ethers.getContractAt('Test2Facet', marketDiamond.address);

      // Cast Diamond to Test3Facet
      test3ViaDiamond = await ethers.getContractAt('Test3Facet', marketDiamond.address);

    });

    context("diamondCut()", async function () {

      context("Privileged Access", async function () {

          it("should require UPGRADER to perform cut actions", async function () {

            // Get the Test1Facet function selectors from the abi
            selectors = getSelectors(test1Facet);

            // Define the facet cut
            facetCuts = [{
              facetAddress: test1Facet.address,
              action: FacetCutAction.Add,
              functionSelectors: selectors
            }];

            // non-UPGRADER attempt
            await expect(
                cutFacetViaDiamond.connect(admin).diamondCut(facetCuts, ethers.constants.AddressZero, '0x', { gasLimit })
            ).to.be.revertedWith("Caller must have UPGRADER role");

            // UPGRADER attempt
            tx = await cutFacetViaDiamond.connect(upgrader).diamondCut(facetCuts, ethers.constants.AddressZero, '0x', { gasLimit })

            // Wait for transaction to confirm
            receipt = await tx.wait();

            // Be certain transaction was successful
            assert.equal(receipt.status, 1,`UPGRADER not able to upgrader MarketDiamond`)

          });

      });

      context("FacetCutAction.Add", async function () {

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
          tx = await cutFacetViaDiamond.connect(upgrader).diamondCut(facetCuts, ethers.constants.AddressZero, '0x', { gasLimit });

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
          tx = await cutFacetViaDiamond.connect(upgrader).diamondCut(facetCuts, ethers.constants.AddressZero, '0x', { gasLimit });

          // Wait for transaction to confirm
          receipt = await tx.wait();

          // Be certain transaction was successful
          assert.equal(receipt.status, 1,`Diamond upgrade failed: ${tx.hash}`)

          // Make sure function selectors for the facet are correct
          result = await loupeFacetViaDiamond.facetFunctionSelectors(test2Facet.address);
          assert.sameMembers(result, selectors);

        });

        it('should allow functions from different facets to be added in one transaction', async () => {

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
          tx = await cutFacetViaDiamond.connect(upgrader).diamondCut(facetCuts, ethers.constants.AddressZero, '0x', { gasLimit })

          // Be certain transaction was successful
          assert.equal(receipt.status, 1,`Diamond upgrade failed: ${tx.hash}`);

          // Ensure the currently installed test selectors are what we added
          result = [
            await loupeFacetViaDiamond.facetFunctionSelectors(test1Facet.address),
            await loupeFacetViaDiamond.facetFunctionSelectors(test2Facet.address)
          ];
          assert.sameMembers(result.flat(), selectors.flat());

        });

        context("Initializer", async function () {

          beforeEach(async function () {

            // Encode the initialization call
            initFunction = "initialize(address _testAddress)";
            initInterface = new ethers.utils.Interface([`function ${initFunction}`]);
            initCallData = initInterface.encodeFunctionData("initialize", [deployer.address]);

            // Get the Test3Facet function selectors from the abi, removing the initializer
            selectors = getSelectors(test3Facet).remove([initFunction]);

            // Create facet cut payload
            facetCuts = [
              {
                facetAddress: test3Facet.address,
                action: FacetCutAction.Add,
                functionSelectors: selectors
              }
            ];

            // Execute the Diamond cut
            tx = await cutFacetViaDiamond.connect(upgrader).diamondCut(facetCuts, test3Facet.address, initCallData, {gasLimit});

            // Wait for transaction to confirm
            receipt = await tx.wait();

            // Be certain transaction was successful
            assert.equal(receipt.status, 1, `Diamond upgrade failed: ${tx.hash}`);

          });

          it('should call an initializer function if supplied', async () => {

            // Make sure function selectors for the facet are correct
            result = await loupeFacetViaDiamond.facetFunctionSelectors(test3Facet.address);
            assert.sameMembers(result, selectors);

          });

          it('should store initializer state in diamond storage slot when modifier runs', async () => {

            // Make sure initializer state got stored when modifier ran
            result = await test3ViaDiamond.isInitialized();
            assert.equal(result, true, "Initializer state not stored");

          });

          it('should store initializer argument in diamond storage slot when method runs', async () => {

            // Make sure argument passed to initializer got stored when method ran
            result = await test3ViaDiamond.getTestAddress();
            assert.equal(result, deployer.address, "Initializer argument not stored");

          });

        });

      });

      context("FacetCutAction.Remove", async function () {

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
          tx = await cutFacetViaDiamond.connect(upgrader).diamondCut(facetCuts, ethers.constants.AddressZero, '0x', { gasLimit });

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
          tx = await cutFacetViaDiamond.connect(upgrader).diamondCut(facetCuts, ethers.constants.AddressZero, '0x', { gasLimit });

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
          tx = await cutFacetViaDiamond.connect(upgrader).diamondCut(facetCuts, ethers.constants.AddressZero, '0x', { gasLimit });

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
          tx = await cutFacetViaDiamond.connect(upgrader).diamondCut(facetCuts, ethers.constants.AddressZero, '0x', { gasLimit });

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

      context("FacetCutAction.Replace", async function () {

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
          tx = await cutFacetViaDiamond.connect(upgrader).diamondCut(facetCuts, ethers.constants.AddressZero, '0x', { gasLimit });

          // Wait for transaction to confirm
          receipt = await tx.wait();

          // Be certain transaction was successful
          assert.equal(receipt.status, 1,`Diamond upgrade failed: ${tx.hash}`)

        });

        it('should replace a function on Test2Facet', async () => {

          // Verify current return value of function to be replaced
          assert.equal(await test2ViaDiamond.test2Func13(), "Seen");

          // Deploy Test2FacetUpgrade
          Test2FacetUpgrade = await ethers.getContractFactory('Test2FacetUpgrade');
          test2FacetUpgrade = await Test2FacetUpgrade.deploy();
          await test2FacetUpgrade.deployed();

          // Define the facet cut
          facetCuts = [
            {
              facetAddress: test2FacetUpgrade.address,
              action: FacetCutAction.Replace,
              functionSelectors: getSelectors(test2FacetUpgrade)
            }
          ];

          // Send the DiamondCut transaction
          tx = await cutFacetViaDiamond.connect(upgrader).diamondCut(facetCuts, ethers.constants.AddressZero, '0x', { gasLimit });

          // Wait for transaction to confirm
          receipt = await tx.wait();

          // Be certain transaction was successful
          assert.equal(receipt.status, 1,`Diamond upgrade failed: ${tx.hash}`)

          // Verify new return value of function that was replaced
          assert.equal(await test2ViaDiamond.test2Func13(), "json");

        });

      });

    });

  });

})
