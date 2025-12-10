// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { TermsRegistry } from "../src/core/TermsRegistry.sol";
import { ITermsRegistry } from "../src/interfaces/ITermsRegistry.sol";
import { TrustfulPausable } from "../src/base/TrustfulPausable.sol";
import { ERC8004RegistryMock } from "./mocks/ERC8004RegistryMock.sol";
import { CouncilRegistryMock } from "./mocks/CouncilRegistryMock.sol";

/**
 * @title TermsRegistryTest
 * @notice Comprehensive tests for TermsRegistry contract
 */
contract TermsRegistryTest is Test {
    // =========================================================================
    // Test Setup
    // =========================================================================

    TermsRegistry public registry;
    ERC8004RegistryMock public agentRegistry;
    CouncilRegistryMock public councilRegistry;

    address public governance = makeAddr("governance");
    address public validator = makeAddr("validator");
    address public provider = makeAddr("provider");
    address public otherUser = makeAddr("otherUser");

    uint256 public constant AGENT_ID = 1;
    uint256 public constant AGENT_ID_2 = 2;
    bytes32 public constant COUNCIL_ID = keccak256("default-council");
    bytes32 public constant COUNCIL_ID_2 = keccak256("second-council");

    bytes32 public constant CONTENT_HASH = keccak256("terms-v1-content");
    string public constant CONTENT_URI = "ipfs://QmTermsV1";
    bytes32 public constant CONTENT_HASH_V2 = keccak256("terms-v2-content");
    string public constant CONTENT_URI_V2 = "ipfs://QmTermsV2";

    function setUp() public {
        // Deploy mocks
        agentRegistry = new ERC8004RegistryMock();
        councilRegistry = new CouncilRegistryMock();

        // Deploy registry
        registry = new TermsRegistry(address(agentRegistry), governance);

        // Setup validator
        vm.prank(governance);
        registry.setTrustfulValidator(validator);

        // Register agents
        agentRegistry.mint(provider, AGENT_ID);
        agentRegistry.mint(provider, AGENT_ID_2);

        // Setup council
        councilRegistry.setCouncilActive(COUNCIL_ID, true);
        councilRegistry.setCouncilActive(COUNCIL_ID_2, true);
    }

    // =========================================================================
    // Constructor Tests
    // =========================================================================

    function test_Constructor_SetsCorrectValues() public view {
        assertEq(registry.agentRegistry(), address(agentRegistry));
        assertEq(registry.governance(), governance);
    }

    function test_Constructor_RevertsOnZeroRegistry() public {
        vm.expectRevert(TrustfulPausable.ZeroAddress.selector);
        new TermsRegistry(address(0), governance);
    }

    // =========================================================================
    // Register Terms Tests
    // =========================================================================

    function test_RegisterTerms_Success() public {
        vm.prank(provider);
        uint256 version = registry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        assertEq(version, 1);

        (ITermsRegistry.TermsVersion memory terms, uint256 activeVersion) =
            registry.getActiveTerms(AGENT_ID);

        assertEq(activeVersion, 1);
        assertEq(terms.contentHash, CONTENT_HASH);
        assertEq(terms.contentUri, CONTENT_URI);
        assertEq(terms.councilId, COUNCIL_ID);
        assertTrue(terms.active);
        assertEq(terms.registeredAt, block.timestamp);
    }

    function test_RegisterTerms_EmitsEvents() public {
        vm.expectEmit(true, true, false, true);
        emit ITermsRegistry.TermsRegistered(AGENT_ID, 1, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        vm.expectEmit(true, true, false, false);
        emit ITermsRegistry.TermsActivated(AGENT_ID, 1);

        vm.prank(provider);
        registry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);
    }

    function test_RegisterTerms_RevertsIfNotOwner() public {
        vm.prank(otherUser);
        vm.expectRevert(
            abi.encodeWithSelector(ITermsRegistry.NotAgentOwner.selector, AGENT_ID, otherUser)
        );
        registry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);
    }

    function test_RegisterTerms_RevertsOnZeroHash() public {
        vm.prank(provider);
        vm.expectRevert(ITermsRegistry.InvalidContentHash.selector);
        registry.registerTerms(AGENT_ID, bytes32(0), CONTENT_URI, COUNCIL_ID);
    }

    function test_RegisterTerms_RevertsOnEmptyUri() public {
        vm.prank(provider);
        vm.expectRevert(ITermsRegistry.InvalidContentUri.selector);
        registry.registerTerms(AGENT_ID, CONTENT_HASH, "", COUNCIL_ID);
    }

    function test_RegisterTerms_ValidatesCouncilWhenEnforced() public {
        // Enable council validation
        vm.prank(governance);
        registry.setCouncilRegistry(address(councilRegistry));
        vm.prank(governance);
        registry.setEnforceCouncilValidation(true);

        bytes32 inactiveCouncil = keccak256("inactive-council");

        vm.prank(provider);
        vm.expectRevert(
            abi.encodeWithSelector(ITermsRegistry.CouncilNotActive.selector, inactiveCouncil)
        );
        registry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, inactiveCouncil);
    }

    // =========================================================================
    // Update Terms Tests
    // =========================================================================

    function test_UpdateTerms_Success() public {
        // First registration
        vm.prank(provider);
        registry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        // Update
        vm.prank(provider);
        uint256 newVersion = registry.updateTerms(
            AGENT_ID,
            CONTENT_HASH_V2,
            CONTENT_URI_V2,
            COUNCIL_ID_2
        );

        assertEq(newVersion, 2);

        (ITermsRegistry.TermsVersion memory terms, uint256 activeVersion) =
            registry.getActiveTerms(AGENT_ID);

        assertEq(activeVersion, 2);
        assertEq(terms.contentHash, CONTENT_HASH_V2);
        assertEq(terms.contentUri, CONTENT_URI_V2);
        assertEq(terms.councilId, COUNCIL_ID_2);
        assertTrue(terms.active);
    }

    function test_UpdateTerms_DeactivatesPreviousVersion() public {
        vm.prank(provider);
        registry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        vm.prank(provider);
        registry.updateTerms(AGENT_ID, CONTENT_HASH_V2, CONTENT_URI_V2, COUNCIL_ID);

        // Check previous version is deactivated
        ITermsRegistry.TermsVersion memory v1 = registry.getTermsVersion(AGENT_ID, 1);
        assertFalse(v1.active);

        // Check new version is active
        ITermsRegistry.TermsVersion memory v2 = registry.getTermsVersion(AGENT_ID, 2);
        assertTrue(v2.active);
    }

    function test_UpdateTerms_EmitsDeactivatedEvent() public {
        vm.prank(provider);
        registry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        vm.expectEmit(true, true, false, false);
        emit ITermsRegistry.TermsDeactivated(AGENT_ID, 1);

        vm.prank(provider);
        registry.updateTerms(AGENT_ID, CONTENT_HASH_V2, CONTENT_URI_V2, COUNCIL_ID);
    }

    function test_UpdateTerms_PreservesHistory() public {
        vm.prank(provider);
        registry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        vm.prank(provider);
        registry.updateTerms(AGENT_ID, CONTENT_HASH_V2, CONTENT_URI_V2, COUNCIL_ID_2);

        ITermsRegistry.TermsConfig memory config = registry.getTermsConfig(AGENT_ID);
        assertEq(config.versionCount, 2);

        // Both versions are accessible
        ITermsRegistry.TermsVersion memory v1 = registry.getTermsVersion(AGENT_ID, 1);
        ITermsRegistry.TermsVersion memory v2 = registry.getTermsVersion(AGENT_ID, 2);

        assertEq(v1.contentHash, CONTENT_HASH);
        assertEq(v2.contentHash, CONTENT_HASH_V2);
    }

    function test_UpdateTerms_CanUpdateWithoutPriorTerms() public {
        // updateTerms should work even if no prior terms exist
        vm.prank(provider);
        uint256 version = registry.updateTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        assertEq(version, 1);
    }

    // =========================================================================
    // Invalidate Terms Tests
    // =========================================================================

    function test_InvalidateTerms_ByValidator() public {
        vm.prank(provider);
        registry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        vm.prank(validator);
        registry.invalidateTerms(AGENT_ID, "Ownership changed");

        assertFalse(registry.hasActiveTerms(AGENT_ID));
        assertTrue(registry.hasTerms(AGENT_ID)); // History preserved
    }

    function test_InvalidateTerms_ByGovernance() public {
        vm.prank(provider);
        registry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        vm.prank(governance);
        registry.invalidateTerms(AGENT_ID, "Manual invalidation");

        assertFalse(registry.hasActiveTerms(AGENT_ID));
    }

    function test_InvalidateTerms_EmitsEvents() public {
        vm.prank(provider);
        registry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        vm.expectEmit(true, true, false, false);
        emit ITermsRegistry.TermsDeactivated(AGENT_ID, 1);

        vm.expectEmit(true, false, false, true);
        emit ITermsRegistry.TermsInvalidated(AGENT_ID, "Test reason");

        vm.prank(validator);
        registry.invalidateTerms(AGENT_ID, "Test reason");
    }

    function test_InvalidateTerms_RevertsIfNotAuthorized() public {
        vm.prank(provider);
        registry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        vm.prank(otherUser);
        vm.expectRevert(abi.encodeWithSelector(TermsRegistry.NotAuthorized.selector, otherUser));
        registry.invalidateTerms(AGENT_ID, "Unauthorized");
    }

    function test_InvalidateTerms_RevertsIfNoActiveTerms() public {
        vm.prank(validator);
        vm.expectRevert(abi.encodeWithSelector(ITermsRegistry.NoActiveTerms.selector, AGENT_ID));
        registry.invalidateTerms(AGENT_ID, "No terms");
    }

    function test_InvalidateTerms_CanReregisterAfterInvalidation() public {
        vm.prank(provider);
        registry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        vm.prank(validator);
        registry.invalidateTerms(AGENT_ID, "Ownership changed");

        // Can register new terms
        vm.prank(provider);
        uint256 newVersion = registry.registerTerms(
            AGENT_ID,
            CONTENT_HASH_V2,
            CONTENT_URI_V2,
            COUNCIL_ID
        );

        assertEq(newVersion, 2);
        assertTrue(registry.hasActiveTerms(AGENT_ID));
    }

    // =========================================================================
    // View Function Tests
    // =========================================================================

    function test_GetActiveTerms_RevertsIfNoActive() public {
        vm.expectRevert(abi.encodeWithSelector(ITermsRegistry.NoActiveTerms.selector, AGENT_ID));
        registry.getActiveTerms(AGENT_ID);
    }

    function test_GetTermsVersion_RevertsOnInvalidVersion() public {
        vm.expectRevert(
            abi.encodeWithSelector(ITermsRegistry.VersionNotFound.selector, AGENT_ID, 0)
        );
        registry.getTermsVersion(AGENT_ID, 0);

        vm.expectRevert(
            abi.encodeWithSelector(ITermsRegistry.VersionNotFound.selector, AGENT_ID, 1)
        );
        registry.getTermsVersion(AGENT_ID, 1);
    }

    function test_GetActiveTermsHash() public {
        vm.prank(provider);
        registry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        assertEq(registry.getActiveTermsHash(AGENT_ID), CONTENT_HASH);
    }

    function test_GetCouncilForAgent() public {
        // No terms - returns zero
        assertEq(registry.getCouncilForAgent(AGENT_ID), bytes32(0));

        vm.prank(provider);
        registry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        assertEq(registry.getCouncilForAgent(AGENT_ID), COUNCIL_ID);
    }

    function test_GetTermsHistory() public {
        vm.startPrank(provider);
        registry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);
        registry.updateTerms(AGENT_ID, CONTENT_HASH_V2, CONTENT_URI_V2, COUNCIL_ID_2);
        vm.stopPrank();

        ITermsRegistry.TermsVersion[] memory history = registry.getTermsHistory(AGENT_ID);

        assertEq(history.length, 2);
        assertEq(history[0].contentHash, CONTENT_HASH);
        assertEq(history[1].contentHash, CONTENT_HASH_V2);
    }

    function test_HasTerms() public {
        assertFalse(registry.hasTerms(AGENT_ID));

        vm.prank(provider);
        registry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        assertTrue(registry.hasTerms(AGENT_ID));
    }

    function test_HasActiveTerms() public {
        assertFalse(registry.hasActiveTerms(AGENT_ID));

        vm.prank(provider);
        registry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);
        assertTrue(registry.hasActiveTerms(AGENT_ID));

        vm.prank(validator);
        registry.invalidateTerms(AGENT_ID, "test");
        assertFalse(registry.hasActiveTerms(AGENT_ID));
    }

    function test_VerifyTermsHash() public {
        vm.prank(provider);
        registry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        assertTrue(registry.verifyTermsHash(AGENT_ID, 1, CONTENT_HASH));
        assertFalse(registry.verifyTermsHash(AGENT_ID, 1, CONTENT_HASH_V2));
        assertFalse(registry.verifyTermsHash(AGENT_ID, 0, CONTENT_HASH)); // Invalid version
        assertFalse(registry.verifyTermsHash(AGENT_ID, 2, CONTENT_HASH)); // Non-existent version
    }

    // =========================================================================
    // Admin Tests
    // =========================================================================

    function test_SetCouncilRegistry() public {
        vm.prank(governance);
        registry.setCouncilRegistry(address(councilRegistry));

        assertEq(registry.councilRegistry(), address(councilRegistry));
    }

    function test_SetTrustfulValidator() public {
        address newValidator = makeAddr("newValidator");

        vm.prank(governance);
        registry.setTrustfulValidator(newValidator);

        assertEq(registry.trustfulValidator(), newValidator);
    }

    function test_SetTrustfulValidator_RevertsOnZero() public {
        vm.prank(governance);
        vm.expectRevert(TrustfulPausable.ZeroAddress.selector);
        registry.setTrustfulValidator(address(0));
    }

    function test_SetEnforceCouncilValidation() public {
        assertFalse(registry.enforceCouncilValidation());

        vm.prank(governance);
        registry.setEnforceCouncilValidation(true);

        assertTrue(registry.enforceCouncilValidation());
    }

    // =========================================================================
    // Fuzz Tests
    // =========================================================================

    function testFuzz_RegisterTerms(bytes32 contentHash, bytes32 councilId) public {
        vm.assume(contentHash != bytes32(0));

        vm.prank(provider);
        uint256 version = registry.registerTerms(AGENT_ID, contentHash, CONTENT_URI, councilId);

        assertEq(version, 1);
        assertEq(registry.getActiveTermsHash(AGENT_ID), contentHash);
    }

    function testFuzz_MultipleVersions(uint8 numVersions) public {
        vm.assume(numVersions > 0 && numVersions <= 20);

        vm.startPrank(provider);
        for (uint256 i = 0; i < numVersions; i++) {
            bytes32 hash = keccak256(abi.encode("version", i));
            string memory uri = string(abi.encodePacked("ipfs://Qm", i));
            registry.registerTerms(AGENT_ID, hash, uri, COUNCIL_ID);
        }
        vm.stopPrank();

        ITermsRegistry.TermsConfig memory config = registry.getTermsConfig(AGENT_ID);
        assertEq(config.versionCount, numVersions);
        assertEq(config.activeVersion, numVersions);
    }

    // =========================================================================
    // Integration Tests
    // =========================================================================

    function test_FullLifecycle() public {
        // 1. Provider registers initial terms
        vm.prank(provider);
        registry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        assertTrue(registry.hasActiveTerms(AGENT_ID));
        assertEq(registry.getCouncilForAgent(AGENT_ID), COUNCIL_ID);

        // 2. Provider updates terms
        vm.prank(provider);
        registry.updateTerms(AGENT_ID, CONTENT_HASH_V2, CONTENT_URI_V2, COUNCIL_ID_2);

        assertEq(registry.getCouncilForAgent(AGENT_ID), COUNCIL_ID_2);

        // 3. Validator invalidates (e.g., ownership transfer)
        vm.prank(validator);
        registry.invalidateTerms(AGENT_ID, "Ownership transferred");

        assertFalse(registry.hasActiveTerms(AGENT_ID));

        // 4. New owner registers fresh terms
        vm.prank(provider);
        registry.registerTerms(AGENT_ID, keccak256("v3"), "ipfs://v3", COUNCIL_ID);

        assertTrue(registry.hasActiveTerms(AGENT_ID));

        // 5. History is preserved
        ITermsRegistry.TermsVersion[] memory history = registry.getTermsHistory(AGENT_ID);
        assertEq(history.length, 3);
    }

    function test_MultipleAgents() public {
        vm.startPrank(provider);
        registry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);
        registry.registerTerms(AGENT_ID_2, CONTENT_HASH_V2, CONTENT_URI_V2, COUNCIL_ID_2);
        vm.stopPrank();

        // Each agent has independent terms
        assertEq(registry.getActiveTermsHash(AGENT_ID), CONTENT_HASH);
        assertEq(registry.getActiveTermsHash(AGENT_ID_2), CONTENT_HASH_V2);
        assertEq(registry.getCouncilForAgent(AGENT_ID), COUNCIL_ID);
        assertEq(registry.getCouncilForAgent(AGENT_ID_2), COUNCIL_ID_2);
    }
}
