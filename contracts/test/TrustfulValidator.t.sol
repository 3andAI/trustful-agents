// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { TrustfulValidator } from "../src/core/TrustfulValidator.sol";
import { CollateralVault } from "../src/core/CollateralVault.sol";
import { TermsRegistry } from "../src/core/TermsRegistry.sol";
import { ITrustfulValidator } from "../src/interfaces/ITrustfulValidator.sol";
import { TrustfulPausable } from "../src/base/TrustfulPausable.sol";
import { ERC20Mock } from "./mocks/ERC20Mock.sol";
import { ERC8004RegistryMock } from "./mocks/ERC8004RegistryMock.sol";
import { CouncilRegistryMock } from "./mocks/CouncilRegistryMock.sol";
import { MockValidationRegistry } from "./mocks/MockValidationRegistry.sol";

/**
 * @title TrustfulValidatorTest
 * @notice Comprehensive tests for TrustfulValidator v2.0 (ERC-8004 Validation Registry integration)
 */
contract TrustfulValidatorTest is Test {
    // =========================================================================
    // Test Setup
    // =========================================================================

    TrustfulValidator public validator;
    CollateralVault public vault;
    TermsRegistry public termsRegistry;
    MockValidationRegistry public validationRegistry;
    ERC20Mock public usdc;
    ERC8004RegistryMock public agentRegistry;
    CouncilRegistryMock public councilRegistry;

    address public governance = makeAddr("governance");
    address public provider = makeAddr("provider");
    address public otherUser = makeAddr("otherUser");
    address public keeper = makeAddr("keeper");

    uint256 public constant AGENT_ID = 1;
    uint256 public constant AGENT_ID_2 = 2;
    uint256 public constant MIN_COLLATERAL = 100e6; // 100 USDC
    uint256 public constant DEPOSIT_AMOUNT = 1000e6; // 1000 USDC
    uint256 public constant GRACE_PERIOD = 7 days;

    bytes32 public constant COUNCIL_ID = keccak256("default-council");
    bytes32 public constant CONTENT_HASH = keccak256("terms-content");
    string public constant CONTENT_URI = "ipfs://QmTerms";
    string public constant BASE_URI = "https://trustful.ai/validation/";

    function setUp() public {
        // Deploy mocks
        usdc = new ERC20Mock("USD Coin", "USDC", 6);
        agentRegistry = new ERC8004RegistryMock();
        councilRegistry = new CouncilRegistryMock();
        validationRegistry = new MockValidationRegistry();

        // Deploy core contracts
        vault = new CollateralVault(
            address(usdc),
            address(agentRegistry),
            governance,
            GRACE_PERIOD
        );

        termsRegistry = new TermsRegistry(address(agentRegistry), governance);

        validator = new TrustfulValidator(
            address(agentRegistry),
            governance,
            BASE_URI
        );

        // Configure contracts
        vm.startPrank(governance);
        validator.setCollateralVault(address(vault));
        validator.setTermsRegistry(address(termsRegistry));
        validator.setValidationRegistry(address(validationRegistry));
        termsRegistry.setTrustfulValidator(address(validator));
        vm.stopPrank();

        // Register agents
        agentRegistry.mint(provider, AGENT_ID);
        agentRegistry.mint(provider, AGENT_ID_2);

        // Setup council
        councilRegistry.setCouncilActive(COUNCIL_ID, true);

        // Fund provider
        usdc.mint(provider, 100_000e6);
        vm.prank(provider);
        usdc.approve(address(vault), type(uint256).max);
    }

    // =========================================================================
    // Constructor Tests
    // =========================================================================

    function test_Constructor_SetsCorrectValues() public view {
        assertEq(validator.agentRegistry(), address(agentRegistry));
        assertEq(validator.governance(), governance);
        assertEq(validator.validationBaseUri(), BASE_URI);
        assertEq(validator.minimumCollateral(), MIN_COLLATERAL);
    }

    function test_Constructor_RevertsOnZeroRegistry() public {
        vm.expectRevert(TrustfulPausable.ZeroAddress.selector);
        new TrustfulValidator(address(0), governance, BASE_URI);
    }

    // =========================================================================
    // respondToRequest Tests
    // =========================================================================

    function test_RespondToRequest_Success() public {
        _setupValidAgent(AGENT_ID);
        bytes32 requestHash = _simulateRequest(AGENT_ID);

        vm.prank(keeper);
        validator.respondToRequest(requestHash);

        assertTrue(validator.isValidated(AGENT_ID));
        assertEq(validator.getActiveRequestHash(AGENT_ID), requestHash);

        ITrustfulValidator.ValidationRecord memory record = validator.getValidationRecord(AGENT_ID);
        assertEq(record.nonce, 1);
        assertEq(record.issuedAt, block.timestamp);
        assertEq(record.revokedAt, 0);
        assertEq(record.requestHash, requestHash);
        assertEq(uint256(record.revocationReason), uint256(ITrustfulValidator.RevocationReason.None));

        // Verify response was submitted to Validation Registry
        assertEq(validationRegistry.lastResponseScore(), 100);
        assertEq(validationRegistry.lastResponseTag(), validator.TAG_VALID());
    }

    function test_RespondToRequest_EmitsEvent() public {
        _setupValidAgent(AGENT_ID);
        bytes32 requestHash = _simulateRequest(AGENT_ID);
        string memory expectedUri = validator.getResponseUri(AGENT_ID);

        vm.expectEmit(true, true, false, true);
        emit ITrustfulValidator.ValidationIssued(AGENT_ID, requestHash, 1, expectedUri);

        vm.prank(keeper);
        validator.respondToRequest(requestHash);
    }

    function test_RespondToRequest_ConditionsNotMet() public {
        // Register terms but no collateral
        vm.prank(provider);
        termsRegistry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        bytes32 requestHash = _simulateRequest(AGENT_ID);

        vm.prank(keeper);
        validator.respondToRequest(requestHash);

        // Should NOT be valid internally
        assertFalse(validator.isValidated(AGENT_ID));

        // But should have submitted score=0 to Validation Registry
        assertEq(validationRegistry.lastResponseScore(), 0);
        assertEq(validationRegistry.lastResponseTag(), validator.TAG_REVOKED_COLLATERAL());
    }

    function test_RespondToRequest_WrongValidator() public {
        _setupValidAgent(AGENT_ID);
        bytes32 requestHash = keccak256("wrong-request");

        // Simulate request pointing to a different validator
        validationRegistry.simulateRequest(requestHash, address(0xBEEF), AGENT_ID);

        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(TrustfulValidator.NotAuthorized.selector, keeper));
        validator.respondToRequest(requestHash);
    }

    function test_RespondToRequest_AgentNotFound() public {
        uint256 nonExistentAgent = 999;
        bytes32 requestHash = keccak256("nonexistent");
        validationRegistry.simulateRequest(requestHash, address(validator), nonExistentAgent);

        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(TrustfulValidator.AgentNotFound.selector, nonExistentAgent));
        validator.respondToRequest(requestHash);
    }

    function test_RespondToRequest_StoresActiveRequestHash() public {
        _setupValidAgent(AGENT_ID);
        bytes32 requestHash = _simulateRequest(AGENT_ID);

        assertEq(validator.getActiveRequestHash(AGENT_ID), bytes32(0));

        vm.prank(keeper);
        validator.respondToRequest(requestHash);

        assertEq(validator.getActiveRequestHash(AGENT_ID), requestHash);
    }

    function test_RespondToRequest_Permissionless() public {
        _setupValidAgent(AGENT_ID);
        bytes32 requestHash = _simulateRequest(AGENT_ID);

        // Anyone can call — not just keeper or owner
        vm.prank(otherUser);
        validator.respondToRequest(requestHash);

        assertTrue(validator.isValidated(AGENT_ID));
    }

    function test_RespondToRequest_RevertsIfNotConfigured() public {
        TrustfulValidator freshValidator = new TrustfulValidator(
            address(agentRegistry),
            governance,
            BASE_URI
        );

        _setupValidAgent(AGENT_ID);
        bytes32 requestHash = keccak256("unconfigured");
        validationRegistry.simulateRequest(requestHash, address(freshValidator), AGENT_ID);

        vm.prank(keeper);
        vm.expectRevert(TrustfulValidator.InvalidConfiguration.selector);
        freshValidator.respondToRequest(requestHash);
    }

    function test_RespondToRequest_NoCollateral_SubmitsZeroScore() public {
        // Only register terms, no collateral
        vm.prank(provider);
        termsRegistry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        bytes32 requestHash = _simulateRequest(AGENT_ID);

        vm.prank(keeper);
        validator.respondToRequest(requestHash);

        assertFalse(validator.isValidated(AGENT_ID));
        assertEq(validationRegistry.lastResponseScore(), 0);
        assertEq(validationRegistry.lastResponseTag(), validator.TAG_REVOKED_COLLATERAL());

        // Record should reflect conditions not met
        ITrustfulValidator.ValidationRecord memory record = validator.getValidationRecord(AGENT_ID);
        assertGt(record.revokedAt, 0);
        assertEq(
            uint256(record.revocationReason),
            uint256(ITrustfulValidator.RevocationReason.CollateralBelowMinimum)
        );
    }

    function test_RespondToRequest_NoTerms_SubmitsZeroScore() public {
        // Only deposit collateral, no terms
        vm.prank(provider);
        vault.deposit(AGENT_ID, DEPOSIT_AMOUNT);

        bytes32 requestHash = _simulateRequest(AGENT_ID);

        vm.prank(keeper);
        validator.respondToRequest(requestHash);

        assertFalse(validator.isValidated(AGENT_ID));
        assertEq(validationRegistry.lastResponseScore(), 0);
        assertEq(validationRegistry.lastResponseTag(), validator.TAG_REVOKED_TERMS());
    }

    // =========================================================================
    // reevaluate Tests
    // =========================================================================

    function test_Reevaluate_NoActiveRequest_IsNoOp() public {
        // No validation request exists for this agent
        uint256 gasBefore = gasleft();
        validator.reevaluate(AGENT_ID);
        uint256 gasUsed = gasBefore - gasleft();

        // Should be a cheap no-op (just reads the mapping)
        assertFalse(validator.isValidated(AGENT_ID));
        assertLt(gasUsed, 50_000);
    }

    function test_Reevaluate_CollateralDropped_RevokesValidation() public {
        _setupAndValidateAgent(AGENT_ID);
        assertTrue(validator.isValidated(AGENT_ID));

        // Withdraw most collateral
        vm.startPrank(provider);
        vault.initiateWithdrawal(AGENT_ID, DEPOSIT_AMOUNT - MIN_COLLATERAL + 1);
        vm.warp(block.timestamp + GRACE_PERIOD);
        vault.executeWithdrawal(AGENT_ID);
        vm.stopPrank();

        // Anyone triggers reevaluation
        validator.reevaluate(AGENT_ID);

        assertFalse(validator.isValidated(AGENT_ID));

        ITrustfulValidator.ValidationRecord memory record = validator.getValidationRecord(AGENT_ID);
        assertEq(
            uint256(record.revocationReason),
            uint256(ITrustfulValidator.RevocationReason.CollateralBelowMinimum)
        );

        // Verify score=0 submitted to Validation Registry
        assertEq(validationRegistry.lastResponseScore(), 0);
        assertEq(validationRegistry.lastResponseTag(), validator.TAG_REVOKED_COLLATERAL());
    }

    function test_Reevaluate_CollateralRestored_RestoresValidation() public {
        _setupAndValidateAgent(AGENT_ID);

        // Drop collateral below minimum
        vm.startPrank(provider);
        vault.initiateWithdrawal(AGENT_ID, DEPOSIT_AMOUNT - MIN_COLLATERAL + 1);
        vm.warp(block.timestamp + GRACE_PERIOD);
        vault.executeWithdrawal(AGENT_ID);
        vm.stopPrank();

        validator.reevaluate(AGENT_ID);
        assertFalse(validator.isValidated(AGENT_ID));

        // Deposit more collateral
        vm.prank(provider);
        vault.deposit(AGENT_ID, DEPOSIT_AMOUNT);

        // Reevaluate — should restore
        validator.reevaluate(AGENT_ID);
        assertTrue(validator.isValidated(AGENT_ID));

        // Verify score=100 submitted to Validation Registry
        assertEq(validationRegistry.lastResponseScore(), 100);
        assertEq(validationRegistry.lastResponseTag(), validator.TAG_VALID());
    }

    function test_Reevaluate_TermsInvalidated_Revokes() public {
        _setupAndValidateAgent(AGENT_ID);

        // Invalidate terms
        vm.prank(governance);
        termsRegistry.invalidateTerms(AGENT_ID, "Test invalidation");

        validator.reevaluate(AGENT_ID);

        assertFalse(validator.isValidated(AGENT_ID));

        ITrustfulValidator.ValidationRecord memory record = validator.getValidationRecord(AGENT_ID);
        assertEq(
            uint256(record.revocationReason),
            uint256(ITrustfulValidator.RevocationReason.TermsInvalidated)
        );
        assertEq(validationRegistry.lastResponseTag(), validator.TAG_REVOKED_TERMS());
    }

    function test_Reevaluate_NoChangeWhenStillValid() public {
        _setupAndValidateAgent(AGENT_ID);

        uint256 countBefore = validationRegistry.responseCount();

        // Conditions unchanged — reevaluate should still submit an update
        validator.reevaluate(AGENT_ID);

        assertTrue(validator.isValidated(AGENT_ID));
        // Response is still submitted (updated score to registry)
        assertEq(validationRegistry.responseCount(), countBefore + 1);
    }

    function test_Reevaluate_NoChangeWhenStillInvalid() public {
        // Set up with only terms (no collateral) and respond
        vm.prank(provider);
        termsRegistry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        bytes32 requestHash = _simulateRequest(AGENT_ID);
        vm.prank(keeper);
        validator.respondToRequest(requestHash);

        assertFalse(validator.isValidated(AGENT_ID));
        uint256 countBefore = validationRegistry.responseCount();

        // Still no collateral — reevaluate
        validator.reevaluate(AGENT_ID);

        assertFalse(validator.isValidated(AGENT_ID));
        // Response is still submitted (confirming status to registry)
        assertEq(validationRegistry.responseCount(), countBefore + 1);
    }

    function test_Reevaluate_CanBeCalledByAnyone() public {
        _setupAndValidateAgent(AGENT_ID);

        // Invalidate terms
        vm.prank(governance);
        termsRegistry.invalidateTerms(AGENT_ID, "Test");

        // Random user triggers reevaluation
        vm.prank(otherUser);
        validator.reevaluate(AGENT_ID);

        assertFalse(validator.isValidated(AGENT_ID));
    }

    // =========================================================================
    // Revoke Validation Tests
    // =========================================================================

    function test_RevokeValidation_ByOwner() public {
        _setupAndValidateAgent(AGENT_ID);

        vm.prank(provider);
        validator.revokeValidation(AGENT_ID);

        assertFalse(validator.isValidated(AGENT_ID));

        ITrustfulValidator.ValidationRecord memory record = validator.getValidationRecord(AGENT_ID);
        assertEq(record.revokedAt, block.timestamp);
        assertEq(
            uint256(record.revocationReason),
            uint256(ITrustfulValidator.RevocationReason.ManualRevocation)
        );
    }

    function test_RevokeValidation_ByGovernance() public {
        _setupAndValidateAgent(AGENT_ID);

        vm.prank(governance);
        validator.revokeValidation(AGENT_ID);

        assertFalse(validator.isValidated(AGENT_ID));
    }

    function test_RevokeValidation_SubmitsZeroToRegistry() public {
        _setupAndValidateAgent(AGENT_ID);

        vm.prank(provider);
        validator.revokeValidation(AGENT_ID);

        assertEq(validationRegistry.lastResponseScore(), 0);
        assertEq(validationRegistry.lastResponseTag(), validator.TAG_REVOKED_MANUAL());
    }

    function test_RevokeValidation_EmitsEvent() public {
        _setupAndValidateAgent(AGENT_ID);

        bytes32 requestHash = validator.getValidationRecord(AGENT_ID).requestHash;

        vm.expectEmit(true, true, false, true);
        emit ITrustfulValidator.ValidationRevoked(
            AGENT_ID,
            requestHash,
            ITrustfulValidator.RevocationReason.ManualRevocation
        );

        vm.prank(provider);
        validator.revokeValidation(AGENT_ID);
    }

    function test_RevokeValidation_RevertsIfNotAuthorized() public {
        _setupAndValidateAgent(AGENT_ID);

        vm.prank(otherUser);
        vm.expectRevert(
            abi.encodeWithSelector(TrustfulValidator.NotAuthorized.selector, otherUser)
        );
        validator.revokeValidation(AGENT_ID);
    }

    function test_RevokeValidation_RevertsIfNotValidated() public {
        _setupValidAgent(AGENT_ID);

        vm.prank(provider);
        vm.expectRevert(
            abi.encodeWithSelector(TrustfulValidator.NotValidated.selector, AGENT_ID)
        );
        validator.revokeValidation(AGENT_ID);
    }

    // =========================================================================
    // Re-validation Tests (revoke then respond to new request)
    // =========================================================================

    function test_Revalidation_AfterRevocation() public {
        _setupAndValidateAgent(AGENT_ID);

        // Revoke
        vm.prank(provider);
        validator.revokeValidation(AGENT_ID);

        // New request + response
        bytes32 newRequestHash = keccak256("new-request");
        validationRegistry.simulateRequest(newRequestHash, address(validator), AGENT_ID);

        vm.prank(keeper);
        validator.respondToRequest(newRequestHash);

        assertTrue(validator.isValidated(AGENT_ID));

        ITrustfulValidator.ValidationRecord memory record = validator.getValidationRecord(AGENT_ID);
        assertEq(record.nonce, 2);
        assertEq(record.requestHash, newRequestHash);
        assertEq(record.revokedAt, 0);
    }

    function test_Revalidation_IncrementsNonce() public {
        _setupAndValidateAgent(AGENT_ID);

        for (uint256 i = 1; i <= 3; i++) {
            vm.prank(provider);
            validator.revokeValidation(AGENT_ID);

            bytes32 newHash = keccak256(abi.encode("request", i));
            validationRegistry.simulateRequest(newHash, address(validator), AGENT_ID);

            vm.prank(keeper);
            validator.respondToRequest(newHash);

            assertEq(validator.getValidationRecord(AGENT_ID).nonce, i + 1);
        }
    }

    // =========================================================================
    // View Function Tests
    // =========================================================================

    function test_GetValidationStatus() public {
        assertEq(
            uint256(validator.getValidationStatus(AGENT_ID)),
            uint256(ITrustfulValidator.ValidationStatus.NotValidated)
        );

        _setupAndValidateAgent(AGENT_ID);

        assertEq(
            uint256(validator.getValidationStatus(AGENT_ID)),
            uint256(ITrustfulValidator.ValidationStatus.Valid)
        );

        vm.prank(provider);
        validator.revokeValidation(AGENT_ID);

        assertEq(
            uint256(validator.getValidationStatus(AGENT_ID)),
            uint256(ITrustfulValidator.ValidationStatus.Revoked)
        );
    }

    function test_CheckConditions() public {
        ITrustfulValidator.ValidationConditions memory conditions;

        // No setup - all false except council (not enforced)
        conditions = validator.checkConditions(AGENT_ID);
        assertFalse(conditions.hasMinimumCollateral);
        assertFalse(conditions.hasActiveTerms);
        assertTrue(conditions.isOwnerValid);
        assertTrue(conditions.councilIsActive); // Not enforced by default

        // Add collateral
        vm.prank(provider);
        vault.deposit(AGENT_ID, DEPOSIT_AMOUNT);

        conditions = validator.checkConditions(AGENT_ID);
        assertTrue(conditions.hasMinimumCollateral);
        assertFalse(conditions.hasActiveTerms);

        // Add terms
        vm.prank(provider);
        termsRegistry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        conditions = validator.checkConditions(AGENT_ID);
        assertTrue(conditions.hasMinimumCollateral);
        assertTrue(conditions.hasActiveTerms);
        assertTrue(conditions.isOwnerValid);
    }

    function test_GetResponseUri() public view {
        string memory uri = validator.getResponseUri(AGENT_ID);
        assertEq(uri, string(abi.encodePacked(BASE_URI, "1")));

        string memory uri2 = validator.getResponseUri(123);
        assertEq(uri2, string(abi.encodePacked(BASE_URI, "123")));
    }

    function test_GetActiveRequestHash() public {
        // Initially zero
        assertEq(validator.getActiveRequestHash(AGENT_ID), bytes32(0));

        // After responding to a request
        _setupAndValidateAgent(AGENT_ID);

        bytes32 requestHash = validator.getActiveRequestHash(AGENT_ID);
        assertTrue(requestHash != bytes32(0));
    }

    function test_GetTrustInfo() public {
        _setupAndValidateAgent(AGENT_ID);

        ITrustfulValidator.TrustInfo memory info = validator.getTrustInfo(AGENT_ID);

        assertEq(info.collateralAmount, DEPOSIT_AMOUNT);
        assertEq(info.termsHash, CONTENT_HASH);
        assertEq(info.termsUri, CONTENT_URI);
        assertEq(info.councilId, COUNCIL_ID);
        assertTrue(info.isValid);
        assertFalse(info.withdrawalPending);
    }

    function test_GetTrustInfo_WithPendingWithdrawal() public {
        _setupAndValidateAgent(AGENT_ID);

        vm.prank(provider);
        vault.initiateWithdrawal(AGENT_ID, 100e6);

        ITrustfulValidator.TrustInfo memory info = validator.getTrustInfo(AGENT_ID);
        assertTrue(info.withdrawalPending);
    }

    // =========================================================================
    // Admin Tests
    // =========================================================================

    function test_SetValidationRegistry() public {
        address newRegistry = makeAddr("newRegistry");

        vm.prank(governance);
        validator.setValidationRegistry(newRegistry);

        assertEq(address(validator.validationRegistry()), newRegistry);
    }

    function test_SetValidationRegistry_RevertsOnZero() public {
        vm.prank(governance);
        vm.expectRevert(TrustfulPausable.ZeroAddress.selector);
        validator.setValidationRegistry(address(0));
    }

    function test_SetMinimumCollateral() public {
        uint256 newMin = 500e6;

        vm.prank(governance);
        validator.setMinimumCollateral(newMin);

        assertEq(validator.minimumCollateral(), newMin);
    }

    function test_SetValidationBaseUri() public {
        string memory newUri = "https://new.uri/";

        vm.prank(governance);
        validator.setValidationBaseUri(newUri);

        assertEq(validator.validationBaseUri(), newUri);
    }

    function test_SetCouncilRegistry() public {
        vm.prank(governance);
        validator.setCouncilRegistry(address(councilRegistry));

        assertEq(address(validator.councilRegistry()), address(councilRegistry));
    }

    function test_SetEnforceCouncilValidation() public {
        vm.prank(governance);
        validator.setEnforceCouncilValidation(true);

        assertTrue(validator.enforceCouncilValidation());
    }

    // =========================================================================
    // Council Validation Tests
    // =========================================================================

    function test_CouncilValidation_WhenEnforced() public {
        // Enable council validation
        vm.startPrank(governance);
        validator.setCouncilRegistry(address(councilRegistry));
        validator.setEnforceCouncilValidation(true);
        vm.stopPrank();

        _setupValidAgent(AGENT_ID);

        // Should succeed - council is active
        bytes32 requestHash = _simulateRequest(AGENT_ID);
        vm.prank(keeper);
        validator.respondToRequest(requestHash);
        assertTrue(validator.isValidated(AGENT_ID));

        // Deactivate council
        councilRegistry.setCouncilActive(COUNCIL_ID, false);

        // Reevaluate should revoke
        validator.reevaluate(AGENT_ID);
        assertFalse(validator.isValidated(AGENT_ID));
    }

    // =========================================================================
    // Tag Constants Tests
    // =========================================================================

    function test_TagConstants_AreDeterministic() public view {
        assertEq(validator.TAG_VALID(), keccak256("trustful.v1.valid"));
        assertEq(validator.TAG_REVOKED_COLLATERAL(), keccak256("trustful.v1.revoked.collateral_below_min"));
        assertEq(validator.TAG_REVOKED_TERMS(), keccak256("trustful.v1.revoked.terms_inactive"));
        assertEq(validator.TAG_REVOKED_OWNER(), keccak256("trustful.v1.revoked.owner_changed"));
        assertEq(validator.TAG_REVOKED_COUNCIL(), keccak256("trustful.v1.revoked.council_inactive"));
        assertEq(validator.TAG_REVOKED_MANUAL(), keccak256("trustful.v1.revoked.manual"));
    }

    // =========================================================================
    // Integration Tests
    // =========================================================================

    function test_FullLifecycle() public {
        // 1. Provider deposits collateral
        vm.prank(provider);
        vault.deposit(AGENT_ID, DEPOSIT_AMOUNT);

        // 2. Provider registers terms
        vm.prank(provider);
        termsRegistry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        // 3. Agent owner requests validation on ERC-8004 Validation Registry (simulated)
        bytes32 requestHash = _simulateRequest(AGENT_ID);

        // 4. Keeper responds
        vm.prank(keeper);
        validator.respondToRequest(requestHash);
        assertTrue(validator.isValidated(AGENT_ID));
        assertEq(validationRegistry.lastResponseScore(), 100);

        // 5. Client checks trust info
        ITrustfulValidator.TrustInfo memory info = validator.getTrustInfo(AGENT_ID);
        assertTrue(info.isValid);
        assertEq(info.collateralAmount, DEPOSIT_AMOUNT);

        // 6. Provider initiates withdrawal (client sees risk signal)
        vm.prank(provider);
        vault.initiateWithdrawal(AGENT_ID, DEPOSIT_AMOUNT - MIN_COLLATERAL + 1);
        info = validator.getTrustInfo(AGENT_ID);
        assertTrue(info.withdrawalPending);

        // 7. After grace period, withdrawal reduces collateral below minimum
        vm.warp(block.timestamp + GRACE_PERIOD);
        vm.prank(provider);
        vault.executeWithdrawal(AGENT_ID);

        // 8. Keeper triggers reevaluation
        validator.reevaluate(AGENT_ID);
        assertFalse(validator.isValidated(AGENT_ID));
        assertEq(validationRegistry.lastResponseScore(), 0);

        // 9. Provider deposits more
        vm.prank(provider);
        vault.deposit(AGENT_ID, DEPOSIT_AMOUNT);

        // 10. Keeper triggers reevaluation — validation restored
        validator.reevaluate(AGENT_ID);
        assertTrue(validator.isValidated(AGENT_ID));
        assertEq(validationRegistry.lastResponseScore(), 100);

        // Nonce unchanged (reevaluate doesn't increment nonce)
        assertEq(validator.getValidationRecord(AGENT_ID).nonce, 1);
    }

    function test_MultipleAgents() public {
        _setupAndValidateAgent(AGENT_ID);
        _setupAndValidateAgent(AGENT_ID_2);

        assertTrue(validator.isValidated(AGENT_ID));
        assertTrue(validator.isValidated(AGENT_ID_2));

        // Revoke one doesn't affect other
        vm.prank(provider);
        validator.revokeValidation(AGENT_ID);

        assertFalse(validator.isValidated(AGENT_ID));
        assertTrue(validator.isValidated(AGENT_ID_2));
    }

    // =========================================================================
    // Fuzz Tests
    // =========================================================================

    function testFuzz_MinimumCollateralThreshold(uint256 depositAmount) public {
        depositAmount = bound(depositAmount, 1, 100_000e6);

        vm.prank(provider);
        vault.deposit(AGENT_ID, depositAmount);

        vm.prank(provider);
        termsRegistry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        ITrustfulValidator.ValidationConditions memory conditions = validator.checkConditions(AGENT_ID);

        if (depositAmount >= MIN_COLLATERAL) {
            assertTrue(conditions.hasMinimumCollateral);
        } else {
            assertFalse(conditions.hasMinimumCollateral);
        }
    }

    // =========================================================================
    // Helper Functions
    // =========================================================================

    /// @notice Set up an agent with collateral and terms (ready for validation)
    function _setupValidAgent(uint256 agentId) internal {
        vm.prank(provider);
        vault.deposit(agentId, DEPOSIT_AMOUNT);

        vm.prank(provider);
        termsRegistry.registerTerms(agentId, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);
    }

    /// @notice Set up an agent and validate it through the full request/response flow
    function _setupAndValidateAgent(uint256 agentId) internal {
        _setupValidAgent(agentId);

        bytes32 requestHash = _simulateRequest(agentId);

        vm.prank(keeper);
        validator.respondToRequest(requestHash);
    }

    /// @notice Simulate a validation request on the mock Validation Registry
    function _simulateRequest(uint256 agentId) internal returns (bytes32 requestHash) {
        requestHash = keccak256(abi.encode("request", agentId, block.timestamp));
        validationRegistry.simulateRequest(requestHash, address(validator), agentId);
    }
}
