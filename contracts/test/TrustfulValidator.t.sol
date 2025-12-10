// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { TrustfulValidator } from "../src/core/TrustfulValidator.sol";
import { CollateralVault } from "../src/core/CollateralVault.sol";
import { TermsRegistry } from "../src/core/TermsRegistry.sol";
import { ITrustfulValidator } from "../src/interfaces/ITrustfulValidator.sol";
import { ICollateralVault } from "../src/interfaces/ICollateralVault.sol";
import { ITermsRegistry } from "../src/interfaces/ITermsRegistry.sol";
import { TrustfulPausable } from "../src/base/TrustfulPausable.sol";
import { ERC20Mock } from "./mocks/ERC20Mock.sol";
import { ERC8004RegistryMock } from "./mocks/ERC8004RegistryMock.sol";
import { CouncilRegistryMock } from "./mocks/CouncilRegistryMock.sol";

/**
 * @title TrustfulValidatorTest
 * @notice Comprehensive tests for TrustfulValidator contract
 */
contract TrustfulValidatorTest is Test {
    // =========================================================================
    // Test Setup
    // =========================================================================

    TrustfulValidator public validator;
    CollateralVault public vault;
    TermsRegistry public termsRegistry;
    ERC20Mock public usdc;
    ERC8004RegistryMock public agentRegistry;
    CouncilRegistryMock public councilRegistry;

    address public governance = makeAddr("governance");
    address public provider = makeAddr("provider");
    address public otherUser = makeAddr("otherUser");

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
    // Request Validation Tests
    // =========================================================================

    function test_RequestValidation_Success() public {
        _setupValidAgent(AGENT_ID);

        vm.prank(provider);
        bytes32 requestHash = validator.requestValidation(AGENT_ID);

        assertTrue(validator.isValidated(AGENT_ID));
        assertEq(requestHash, validator.computeRequestHash(AGENT_ID, 1));

        ITrustfulValidator.ValidationRecord memory record = validator.getValidationRecord(AGENT_ID);
        assertEq(record.nonce, 1);
        assertEq(record.issuedAt, block.timestamp);
        assertEq(record.revokedAt, 0);
        assertEq(uint256(record.revocationReason), uint256(ITrustfulValidator.RevocationReason.None));
    }

    function test_RequestValidation_EmitsEvent() public {
        _setupValidAgent(AGENT_ID);

        bytes32 expectedHash = validator.computeRequestHash(AGENT_ID, 1);
        string memory expectedUri = validator.getResponseUri(AGENT_ID);

        vm.expectEmit(true, true, false, true);
        emit ITrustfulValidator.ValidationIssued(AGENT_ID, expectedHash, 1, expectedUri);

        vm.prank(provider);
        validator.requestValidation(AGENT_ID);
    }

    function test_RequestValidation_RevertsIfNotOwner() public {
        _setupValidAgent(AGENT_ID);

        vm.prank(otherUser);
        vm.expectRevert(
            abi.encodeWithSelector(TrustfulValidator.NotAgentOwner.selector, AGENT_ID, otherUser)
        );
        validator.requestValidation(AGENT_ID);
    }

    function test_RequestValidation_RevertsIfAlreadyValidated() public {
        _setupValidAgent(AGENT_ID);

        vm.prank(provider);
        validator.requestValidation(AGENT_ID);

        vm.prank(provider);
        vm.expectRevert(
            abi.encodeWithSelector(TrustfulValidator.AlreadyValidated.selector, AGENT_ID)
        );
        validator.requestValidation(AGENT_ID);
    }

    function test_RequestValidation_RevertsIfNoCollateral() public {
        // Register terms but no collateral
        vm.prank(provider);
        termsRegistry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        vm.prank(provider);
        vm.expectRevert(); // ConditionsNotMet
        validator.requestValidation(AGENT_ID);
    }

    function test_RequestValidation_RevertsIfNoTerms() public {
        // Deposit collateral but no terms
        vm.prank(provider);
        vault.deposit(AGENT_ID, DEPOSIT_AMOUNT);

        vm.prank(provider);
        vm.expectRevert(); // ConditionsNotMet
        validator.requestValidation(AGENT_ID);
    }

    function test_RequestValidation_RevertsIfCollateralBelowMinimum() public {
        vm.prank(provider);
        vault.deposit(AGENT_ID, MIN_COLLATERAL - 1);

        vm.prank(provider);
        termsRegistry.registerTerms(AGENT_ID, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);

        vm.prank(provider);
        vm.expectRevert(); // ConditionsNotMet
        validator.requestValidation(AGENT_ID);
    }

    function test_RequestValidation_RevertsIfNotConfigured() public {
        // Deploy fresh validator without configuration
        TrustfulValidator freshValidator = new TrustfulValidator(
            address(agentRegistry),
            governance,
            BASE_URI
        );

        _setupValidAgent(AGENT_ID);

        vm.prank(provider);
        vm.expectRevert(TrustfulValidator.InvalidConfiguration.selector);
        freshValidator.requestValidation(AGENT_ID);
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
    // Check Validation Tests
    // =========================================================================

    function test_CheckValidation_RevokesOnLowCollateral() public {
        _setupAndValidateAgent(AGENT_ID);

        // Withdraw most collateral
        vm.startPrank(provider);
        vault.initiateWithdrawal(AGENT_ID, DEPOSIT_AMOUNT - MIN_COLLATERAL + 1);
        vm.warp(block.timestamp + GRACE_PERIOD);
        vault.executeWithdrawal(AGENT_ID);
        vm.stopPrank();

        // Anyone can trigger check
        validator.checkValidation(AGENT_ID);

        assertFalse(validator.isValidated(AGENT_ID));

        ITrustfulValidator.ValidationRecord memory record = validator.getValidationRecord(AGENT_ID);
        assertEq(
            uint256(record.revocationReason),
            uint256(ITrustfulValidator.RevocationReason.CollateralBelowMinimum)
        );
    }

    function test_CheckValidation_RevokesOnInvalidatedTerms() public {
        _setupAndValidateAgent(AGENT_ID);

        // Invalidate terms
        vm.prank(governance);
        termsRegistry.invalidateTerms(AGENT_ID, "Test invalidation");

        validator.checkValidation(AGENT_ID);

        assertFalse(validator.isValidated(AGENT_ID));

        ITrustfulValidator.ValidationRecord memory record = validator.getValidationRecord(AGENT_ID);
        assertEq(
            uint256(record.revocationReason),
            uint256(ITrustfulValidator.RevocationReason.TermsInvalidated)
        );
    }

    function test_CheckValidation_NoOpIfNotValidated() public {
        _setupValidAgent(AGENT_ID);

        // Should not revert, just no-op
        validator.checkValidation(AGENT_ID);

        assertFalse(validator.isValidated(AGENT_ID));
    }

    function test_CheckValidation_NoOpIfConditionsMet() public {
        _setupAndValidateAgent(AGENT_ID);

        validator.checkValidation(AGENT_ID);

        assertTrue(validator.isValidated(AGENT_ID));
    }

    function test_CheckValidation_CanBeCalledByAnyone() public {
        _setupAndValidateAgent(AGENT_ID);

        // Invalidate terms
        vm.prank(governance);
        termsRegistry.invalidateTerms(AGENT_ID, "Test");

        // Random user triggers check
        vm.prank(otherUser);
        validator.checkValidation(AGENT_ID);

        assertFalse(validator.isValidated(AGENT_ID));
    }

    // =========================================================================
    // Re-validation Tests
    // =========================================================================

    function test_Revalidation_AfterRevocation() public {
        _setupAndValidateAgent(AGENT_ID);

        // Revoke
        vm.prank(provider);
        validator.revokeValidation(AGENT_ID);

        // Re-validate
        vm.prank(provider);
        bytes32 newHash = validator.requestValidation(AGENT_ID);

        assertTrue(validator.isValidated(AGENT_ID));

        ITrustfulValidator.ValidationRecord memory record = validator.getValidationRecord(AGENT_ID);
        assertEq(record.nonce, 2);
        assertEq(record.requestHash, newHash);
        assertEq(record.revokedAt, 0);
    }

    function test_Revalidation_IncrementsNonce() public {
        _setupAndValidateAgent(AGENT_ID);

        // Revoke and revalidate multiple times
        for (uint256 i = 1; i <= 3; i++) {
            vm.prank(provider);
            validator.revokeValidation(AGENT_ID);

            vm.prank(provider);
            validator.requestValidation(AGENT_ID);

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

    function test_ComputeRequestHash() public view {
        bytes32 hash1 = validator.computeRequestHash(AGENT_ID, 1);
        bytes32 hash2 = validator.computeRequestHash(AGENT_ID, 2);
        bytes32 hash3 = validator.computeRequestHash(AGENT_ID_2, 1);

        // Different nonces = different hashes
        assertTrue(hash1 != hash2);
        // Different agents = different hashes
        assertTrue(hash1 != hash3);

        // Verify hash computation
        bytes32 expected = keccak256(abi.encode(AGENT_ID, 1, address(validator)));
        assertEq(hash1, expected);
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
        vm.prank(provider);
        validator.requestValidation(AGENT_ID);
        assertTrue(validator.isValidated(AGENT_ID));

        // Deactivate council
        councilRegistry.setCouncilActive(COUNCIL_ID, false);

        // Check should revoke
        validator.checkValidation(AGENT_ID);
        assertFalse(validator.isValidated(AGENT_ID));
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

        // 3. Provider requests validation
        vm.prank(provider);
        bytes32 requestHash = validator.requestValidation(AGENT_ID);
        assertTrue(validator.isValidated(AGENT_ID));

        // 4. Client checks trust info
        ITrustfulValidator.TrustInfo memory info = validator.getTrustInfo(AGENT_ID);
        assertTrue(info.isValid);
        assertEq(info.collateralAmount, DEPOSIT_AMOUNT);

        // 5. Provider initiates withdrawal (client sees risk signal)
        vm.prank(provider);
        vault.initiateWithdrawal(AGENT_ID, DEPOSIT_AMOUNT - MIN_COLLATERAL);
        info = validator.getTrustInfo(AGENT_ID);
        assertTrue(info.withdrawalPending);

        // 6. After grace period, withdrawal reduces collateral below minimum
        vm.warp(block.timestamp + GRACE_PERIOD);
        vm.prank(provider);
        vault.executeWithdrawal(AGENT_ID);

        // 7. Anyone triggers validation check
        validator.checkValidation(AGENT_ID);
        assertFalse(validator.isValidated(AGENT_ID));

        // 8. Provider deposits more and revalidates
        vm.prank(provider);
        vault.deposit(AGENT_ID, DEPOSIT_AMOUNT);

        vm.prank(provider);
        validator.requestValidation(AGENT_ID);
        assertTrue(validator.isValidated(AGENT_ID));

        // Nonce incremented
        assertEq(validator.getValidationRecord(AGENT_ID).nonce, 2);
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

    function _setupValidAgent(uint256 agentId) internal {
        vm.prank(provider);
        vault.deposit(agentId, DEPOSIT_AMOUNT);

        vm.prank(provider);
        termsRegistry.registerTerms(agentId, CONTENT_HASH, CONTENT_URI, COUNCIL_ID);
    }

    function _setupAndValidateAgent(uint256 agentId) internal {
        _setupValidAgent(agentId);

        vm.prank(provider);
        validator.requestValidation(agentId);
    }
}
