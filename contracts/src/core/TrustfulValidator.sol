// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ITrustfulValidator } from "../interfaces/ITrustfulValidator.sol";
import { TrustfulPausable } from "../base/TrustfulPausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TrustfulValidator
 * @notice Issues and revokes ERC-8004 validations based on trust conditions
 * @dev Acts as a validator in the ERC-8004 Validation Registry pattern
 *
 * Key Design Decisions:
 * - Reactive validation: conditions checked on request and via checkValidation
 * - Anyone can trigger checkValidation to revoke non-compliant agents
 * - Minimum collateral threshold configurable by governance
 * - Request hash follows ERC-8004 spec: keccak256(abi.encode(agentId, nonce, validatorAddress))
 * - Response URI is deterministic: baseUri/agentId
 *
 * Validation Conditions:
 * 1. Collateral >= minimumCollateral
 * 2. Active terms registered (not invalidated)
 * 3. Agent ownership valid (exists in registry)
 * 4. Council is active (optional, when CouncilRegistry set)
 */
contract TrustfulValidator is ITrustfulValidator, TrustfulPausable, ReentrancyGuard {
    // =========================================================================
    // State
    // =========================================================================

    /// @notice Validation records per agent
    mapping(uint256 => ValidationRecord) private _validations;

    /// @notice The ERC-8004 agent registry
    IERC8004Registry private immutable _REGISTRY;

    /// @notice The CollateralVault contract
    ICollateralVault public collateralVault;

    /// @notice The TermsRegistry contract
    ITermsRegistry public termsRegistry;

    /// @notice The CouncilRegistry contract (optional)
    ICouncilRegistry public councilRegistry;

    /// @notice Minimum collateral required for validation
    uint256 public minimumCollateral;

    /// @notice Base URI for validation responses
    string public validationBaseUri;

    /// @notice Whether to enforce council validation
    bool public enforceCouncilValidation;

    // =========================================================================
    // Constants
    // =========================================================================

    /// @notice Default minimum collateral (100 USDC)
    uint256 public constant DEFAULT_MIN_COLLATERAL = 100e6;

    // =========================================================================
    // Errors
    // =========================================================================

    error NotAgentOwner(uint256 agentId, address caller);
    error AgentNotFound(uint256 agentId);
    error ConditionsNotMet(uint256 agentId, ValidationConditions conditions);
    error NotValidated(uint256 agentId);
    error AlreadyValidated(uint256 agentId);
    error NotAuthorized(address caller);
    error InvalidConfiguration();

    // =========================================================================
    // Constructor
    // =========================================================================

    /**
     * @notice Initialize the TrustfulValidator
     * @param registry_ The ERC-8004 agent registry address
     * @param governance_ The governance multisig address
     * @param baseUri_ The base URI for validation responses
     */
    constructor(
        address registry_,
        address governance_,
        string memory baseUri_
    ) TrustfulPausable(governance_) {
        if (registry_ == address(0)) revert ZeroAddress();
        _REGISTRY = IERC8004Registry(registry_);
        validationBaseUri = baseUri_;
        minimumCollateral = DEFAULT_MIN_COLLATERAL;
    }

    // =========================================================================
    // Admin Functions
    // =========================================================================

    /**
     * @notice Set the CollateralVault address
     * @param vault_ The CollateralVault address
     */
    function setCollateralVault(address vault_) external onlyGovernance {
        if (vault_ == address(0)) revert ZeroAddress();
        collateralVault = ICollateralVault(vault_);
    }

    /**
     * @notice Set the TermsRegistry address
     * @param registry_ The TermsRegistry address
     */
    function setTermsRegistry(address registry_) external onlyGovernance {
        if (registry_ == address(0)) revert ZeroAddress();
        termsRegistry = ITermsRegistry(registry_);
    }

    /**
     * @notice Set the CouncilRegistry address
     * @param registry_ The CouncilRegistry address
     */
    function setCouncilRegistry(address registry_) external onlyGovernance {
        councilRegistry = ICouncilRegistry(registry_);
    }

    /**
     * @notice Set the minimum collateral required
     * @param amount_ The minimum amount in USDC
     */
    function setMinimumCollateral(uint256 amount_) external onlyGovernance {
        minimumCollateral = amount_;
    }

    /**
     * @notice Set the validation base URI
     * @param baseUri_ The new base URI
     */
    function setValidationBaseUri(string calldata baseUri_) external onlyGovernance {
        validationBaseUri = baseUri_;
    }

    /**
     * @notice Enable/disable council validation enforcement
     * @param enforce_ Whether to enforce
     */
    function setEnforceCouncilValidation(bool enforce_) external onlyGovernance {
        enforceCouncilValidation = enforce_;
    }

    // =========================================================================
    // Core Functions
    // =========================================================================

    /// @inheritdoc ITrustfulValidator
    function requestValidation(uint256 agentId) external nonReentrant returns (bytes32 requestHash) {
        _requireAgentOwner(agentId);
        _requireConfigured();

        ValidationRecord storage record = _validations[agentId];

        // Check if already validated
        if (_isCurrentlyValid(record)) {
            revert AlreadyValidated(agentId);
        }

        // Check conditions
        ValidationConditions memory conditions = _checkConditions(agentId);
        if (!_allConditionsMet(conditions)) {
            revert ConditionsNotMet(agentId, conditions);
        }

        // Issue validation
        record.nonce += 1;
        record.issuedAt = block.timestamp;
        record.revokedAt = 0;
        record.revocationReason = RevocationReason.None;
        record.requestHash = computeRequestHash(agentId, record.nonce);

        string memory responseUri = getResponseUri(agentId);

        emit ValidationIssued(agentId, record.requestHash, record.nonce, responseUri);
        emit ValidationConditionsChanged(agentId, conditions);

        return record.requestHash;
    }

    /// @inheritdoc ITrustfulValidator
    function revokeValidation(uint256 agentId) external nonReentrant {
        // Only owner or governance can manually revoke
        address owner = _getAgentOwner(agentId);
        if (msg.sender != owner && msg.sender != governance) {
            revert NotAuthorized(msg.sender);
        }

        ValidationRecord storage record = _validations[agentId];
        if (!_isCurrentlyValid(record)) {
            revert NotValidated(agentId);
        }

        _revoke(agentId, record, RevocationReason.ManualRevocation);
    }

    /// @inheritdoc ITrustfulValidator
    function checkValidation(uint256 agentId) external nonReentrant {
        ValidationRecord storage record = _validations[agentId];

        // Only check if currently validated
        if (!_isCurrentlyValid(record)) {
            return;
        }

        // Check conditions
        ValidationConditions memory conditions = _checkConditions(agentId);

        // Revoke if any condition fails
        if (!conditions.hasMinimumCollateral) {
            _revoke(agentId, record, RevocationReason.CollateralBelowMinimum);
        } else if (!conditions.hasActiveTerms) {
            _revoke(agentId, record, RevocationReason.TermsInvalidated);
        } else if (!conditions.isOwnerValid) {
            _revoke(agentId, record, RevocationReason.OwnershipChanged);
        } else if (enforceCouncilValidation && !conditions.councilIsActive) {
            _revoke(agentId, record, RevocationReason.TermsInvalidated);
        }

        emit ValidationConditionsChanged(agentId, conditions);
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /// @inheritdoc ITrustfulValidator
    function isValidated(uint256 agentId) external view returns (bool) {
        return _isCurrentlyValid(_validations[agentId]);
    }

    /// @inheritdoc ITrustfulValidator
    function getValidationStatus(uint256 agentId) external view returns (ValidationStatus) {
        ValidationRecord storage record = _validations[agentId];

        if (record.issuedAt == 0) {
            return ValidationStatus.NotValidated;
        }

        if (_isCurrentlyValid(record)) {
            return ValidationStatus.Valid;
        }

        if (record.revokedAt > 0) {
            return ValidationStatus.Revoked;
        }

        return ValidationStatus.ConditionsNotMet;
    }

    /// @inheritdoc ITrustfulValidator
    function getValidationRecord(uint256 agentId)
        external
        view
        returns (ValidationRecord memory)
    {
        return _validations[agentId];
    }

    /// @inheritdoc ITrustfulValidator
    function checkConditions(uint256 agentId)
        external
        view
        returns (ValidationConditions memory)
    {
        return _checkConditions(agentId);
    }

    /// @inheritdoc ITrustfulValidator
    function getResponseUri(uint256 agentId) public view returns (string memory) {
        return string(abi.encodePacked(validationBaseUri, _toString(agentId)));
    }

    /// @inheritdoc ITrustfulValidator
    function computeRequestHash(uint256 agentId, uint256 nonce)
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(agentId, nonce, address(this)));
    }

    /// @inheritdoc ITrustfulValidator
    function getTrustInfo(uint256 agentId) external view returns (TrustInfo memory info) {
        // Get collateral info
        if (address(collateralVault) != address(0)) {
            ICollateralVault.CollateralAccount memory account = collateralVault.getAccount(agentId);
            info.collateralAmount = account.balance;
            info.withdrawalPending = account.withdrawalInitiatedAt > 0;
        }

        // Get terms info
        if (address(termsRegistry) != address(0) && termsRegistry.hasActiveTerms(agentId)) {
            (ITermsRegistry.TermsVersion memory terms,) = termsRegistry.getActiveTerms(agentId);
            info.termsHash = terms.contentHash;
            info.termsUri = terms.contentUri;
            info.councilId = terms.councilId;
        }

        // Get validation status
        info.isValid = _isCurrentlyValid(_validations[agentId]);
    }

    /**
     * @notice Get the ERC-8004 registry address
     * @return registry The registry address
     */
    function agentRegistry() external view returns (address) {
        return address(_REGISTRY);
    }

    // =========================================================================
    // Internal Functions
    // =========================================================================

    /**
     * @notice Check all validation conditions
     * @param agentId The agent ID
     * @return conditions The conditions struct
     */
    function _checkConditions(uint256 agentId)
        internal
        view
        returns (ValidationConditions memory conditions)
    {
        // Check collateral
        if (address(collateralVault) != address(0)) {
            uint256 available = collateralVault.getAvailableBalance(agentId);
            conditions.hasMinimumCollateral = available >= minimumCollateral;
        }

        // Check terms
        if (address(termsRegistry) != address(0)) {
            conditions.hasActiveTerms = termsRegistry.hasActiveTerms(agentId);
        }

        // Check ownership
        conditions.isOwnerValid = _agentExists(agentId);

        // Check council (optional)
        if (enforceCouncilValidation && address(councilRegistry) != address(0)) {
            if (address(termsRegistry) != address(0) && termsRegistry.hasActiveTerms(agentId)) {
                bytes32 councilId = termsRegistry.getCouncilForAgent(agentId);
                conditions.councilIsActive = councilRegistry.isCouncilActive(councilId);
            }
        } else {
            conditions.councilIsActive = true; // Skip check if not enforced
        }
    }

    /**
     * @notice Check if all conditions are met
     * @param conditions The conditions to check
     * @return met True if all met
     */
    function _allConditionsMet(ValidationConditions memory conditions)
        internal
        view
        returns (bool)
    {
        if (!conditions.hasMinimumCollateral) return false;
        if (!conditions.hasActiveTerms) return false;
        if (!conditions.isOwnerValid) return false;
        if (enforceCouncilValidation && !conditions.councilIsActive) return false;
        return true;
    }

    /**
     * @notice Check if a validation is currently valid
     * @param record The validation record
     * @return valid True if valid
     */
    function _isCurrentlyValid(ValidationRecord storage record) internal view returns (bool) {
        return record.issuedAt > 0 && record.revokedAt == 0;
    }

    /**
     * @notice Revoke a validation
     * @param agentId The agent ID
     * @param record The validation record
     * @param reason The revocation reason
     */
    function _revoke(
        uint256 agentId,
        ValidationRecord storage record,
        RevocationReason reason
    ) internal {
        record.revokedAt = block.timestamp;
        record.revocationReason = reason;

        emit ValidationRevoked(agentId, record.requestHash, reason);
    }

    /**
     * @notice Require configuration is complete
     */
    function _requireConfigured() internal view {
        if (address(collateralVault) == address(0) || address(termsRegistry) == address(0)) {
            revert InvalidConfiguration();
        }
    }

    /**
     * @notice Require caller is agent owner
     * @param agentId The agent ID
     */
    function _requireAgentOwner(uint256 agentId) internal view {
        address owner = _getAgentOwner(agentId);
        if (msg.sender != owner) {
            revert NotAgentOwner(agentId, msg.sender);
        }
    }

    /**
     * @notice Get agent owner
     * @param agentId The agent ID
     * @return owner The owner address
     */
    function _getAgentOwner(uint256 agentId) internal view returns (address) {
        return _REGISTRY.ownerOf(agentId);
    }

    /**
     * @notice Check if agent exists
     * @param agentId The agent ID
     * @return exists True if exists
     */
    function _agentExists(uint256 agentId) internal view returns (bool) {
        try _REGISTRY.ownerOf(agentId) returns (address owner) {
            return owner != address(0);
        } catch {
            return false;
        }
    }

    /**
     * @notice Convert uint to string
     * @param value The value to convert
     * @return str The string representation
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}

// =========================================================================
// External Interfaces
// =========================================================================

interface IERC8004Registry {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface ICollateralVault {
    struct CollateralAccount {
        uint256 balance;
        uint256 lockedAmount;
        uint256 withdrawalInitiatedAt;
        uint256 withdrawalAmount;
    }
    function getAccount(uint256 agentId) external view returns (CollateralAccount memory);
    function getAvailableBalance(uint256 agentId) external view returns (uint256);
}

interface ITermsRegistry {
    struct TermsVersion {
        bytes32 contentHash;
        string contentUri;
        bytes32 councilId;
        uint256 registeredAt;
        bool active;
    }
    function hasActiveTerms(uint256 agentId) external view returns (bool);
    function getActiveTerms(uint256 agentId) external view returns (TermsVersion memory, uint256);
    function getCouncilForAgent(uint256 agentId) external view returns (bytes32);
}

interface ICouncilRegistry {
    function isCouncilActive(bytes32 councilId) external view returns (bool);
}
