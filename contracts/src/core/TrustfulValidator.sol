// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ITrustfulValidator } from "../interfaces/ITrustfulValidator.sol";
import { TrustfulPausable } from "../base/TrustfulPausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TrustfulValidator
 * @notice Issues and revokes ERC-8004 validations based on trust conditions
 * @dev Acts as a validator in the ERC-8004 Validation Registry request/response pattern.
 *
 * v2.0 — ERC-8004 Validation Registry integration:
 *
 * Flow:
 * 1. Agent owner calls validationRequest(TrustfulValidator, agentId, ...) on the
 *    ERC-8004 Validation Registry.
 * 2. Off-chain keeper detects the ValidationRequest event and calls respondToRequest(requestHash).
 * 3. TrustfulValidator checks trust conditions and calls validationResponse() on the
 *    Validation Registry with score 100 (pass) or 0 (fail) plus a namespaced tag.
 * 4. When conditions change (collateral, claims, terms), keeper calls reevaluate(agentId)
 *    to submit an updated response.
 *
 * Validation Conditions:
 * 1. Collateral >= minimumCollateral
 * 2. Active terms registered (not invalidated)
 * 3. Agent ownership valid (exists in Identity Registry)
 * 4. Council is active (optional, when CouncilRegistry set)
 */
contract TrustfulValidator is ITrustfulValidator, TrustfulPausable, ReentrancyGuard {
    // =========================================================================
    // State
    // =========================================================================

    /// @notice Validation records per agent
    mapping(uint256 => ValidationRecord) private _validations;

    /// @notice Active request hash per agent (agentId -> requestHash)
    /// @dev Used for reevaluation: when conditions change, look up the requestHash to submit updated response
    mapping(uint256 => bytes32) private _activeRequestHash;

    /// @notice The ERC-8004 Identity Registry (agent ownership)
    IERC8004Registry private immutable _REGISTRY;

    /// @notice The ERC-8004 Validation Registry (request/response)
    IValidationRegistry public validationRegistry;

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
    // ERC-8004 Tag Constants (bytes32)
    // =========================================================================

    bytes32 public constant TAG_VALID = keccak256("trustful.v1.valid");
    bytes32 public constant TAG_REVOKED_COLLATERAL = keccak256("trustful.v1.revoked.collateral_below_min");
    bytes32 public constant TAG_REVOKED_TERMS = keccak256("trustful.v1.revoked.terms_inactive");
    bytes32 public constant TAG_REVOKED_OWNER = keccak256("trustful.v1.revoked.owner_changed");
    bytes32 public constant TAG_REVOKED_COUNCIL = keccak256("trustful.v1.revoked.council_inactive");
    bytes32 public constant TAG_REVOKED_MANUAL = keccak256("trustful.v1.revoked.manual");

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
     * @param identityRegistry_ The ERC-8004 Identity Registry address (agent ownership)
     * @param governance_ The governance multisig address
     * @param baseUri_ The base URI for validation responses
     */
    constructor(
        address identityRegistry_,
        address governance_,
        string memory baseUri_
    ) TrustfulPausable(governance_) {
        if (identityRegistry_ == address(0)) revert ZeroAddress();
        _REGISTRY = IERC8004Registry(identityRegistry_);
        validationBaseUri = baseUri_;
        minimumCollateral = DEFAULT_MIN_COLLATERAL;
    }

    // =========================================================================
    // Admin Functions
    // =========================================================================

    /**
     * @notice Set the ERC-8004 Validation Registry address
     * @param registry_ The Validation Registry address
     */
    function setValidationRegistry(address registry_) external onlyGovernance {
        if (registry_ == address(0)) revert ZeroAddress();
        validationRegistry = IValidationRegistry(registry_);
    }

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
    function respondToRequest(bytes32 requestHash) external nonReentrant {
        _requireConfigured();

        // 1. Read request details from Validation Registry
        (address validatorAddress, uint256 agentId,,,,) =
            validationRegistry.getValidationStatus(requestHash);

        // 2. Verify this request is for us
        if (validatorAddress != address(this)) revert NotAuthorized(msg.sender);

        // 3. Verify agent exists
        if (!_agentExists(agentId)) revert AgentNotFound(agentId);

        // 4. Check trust conditions
        ValidationConditions memory conditions = _checkConditions(agentId);
        bool passed = _allConditionsMet(conditions);

        // 5. Store internal mapping for future reevaluation
        _activeRequestHash[agentId] = requestHash;

        // 6. Update internal validation record
        ValidationRecord storage record = _validations[agentId];
        record.requestHash = requestHash;
        record.nonce += 1;
        if (passed) {
            record.issuedAt = block.timestamp;
            record.revokedAt = 0;
            record.revocationReason = RevocationReason.None;
        } else {
            record.revokedAt = block.timestamp;
            record.revocationReason = _determineRevocationReason(conditions);
        }

        // 7. Submit response to ERC-8004 Validation Registry
        uint8 score = passed ? 100 : 0;
        string memory responseUri = getResponseUri(agentId);
        bytes32 responseHash = keccak256(abi.encode(agentId, score, block.timestamp));
        bytes32 tag = passed ? TAG_VALID : _conditionsToTag(conditions);

        validationRegistry.validationResponse(requestHash, score, responseUri, responseHash, tag);

        // 8. Emit internal events
        if (passed) {
            emit ValidationIssued(agentId, requestHash, record.nonce, responseUri);
        }
        emit ValidationConditionsChanged(agentId, conditions);
    }

    /// @inheritdoc ITrustfulValidator
    function reevaluate(uint256 agentId) external nonReentrant {
        bytes32 requestHash = _activeRequestHash[agentId];

        // No active validation request for this agent — nothing to update
        if (requestHash == bytes32(0)) return;

        // Must have Validation Registry configured
        if (address(validationRegistry) == address(0)) return;

        // Check current conditions
        ValidationConditions memory conditions = _checkConditions(agentId);
        bool passed = _allConditionsMet(conditions);

        // Update internal record
        ValidationRecord storage record = _validations[agentId];
        bool wasValid = _isCurrentlyValid(record);

        if (passed && !wasValid) {
            // Conditions now met — restore validation
            record.issuedAt = block.timestamp;
            record.revokedAt = 0;
            record.revocationReason = RevocationReason.None;
            emit ValidationIssued(agentId, requestHash, record.nonce, getResponseUri(agentId));
        } else if (!passed && wasValid) {
            // Conditions no longer met — revoke
            RevocationReason reason = _determineRevocationReason(conditions);
            _revoke(agentId, record, reason);
        }

        // Submit updated response to ERC-8004 Validation Registry
        uint8 score = passed ? 100 : 0;
        string memory responseUri = getResponseUri(agentId);
        bytes32 responseHash = keccak256(abi.encode(agentId, score, block.timestamp));
        bytes32 tag = passed ? TAG_VALID : _conditionsToTag(conditions);

        validationRegistry.validationResponse(requestHash, score, responseUri, responseHash, tag);

        emit ValidationConditionsChanged(agentId, conditions);
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

        // Submit revocation to Validation Registry
        bytes32 requestHash = _activeRequestHash[agentId];
        if (requestHash != bytes32(0) && address(validationRegistry) != address(0)) {
            string memory responseUri = getResponseUri(agentId);
            bytes32 responseHash = keccak256(abi.encode(agentId, uint8(0), block.timestamp));

            validationRegistry.validationResponse(
                requestHash, 0, responseUri, responseHash, TAG_REVOKED_MANUAL
            );
        }
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
    function getActiveRequestHash(uint256 agentId) external view returns (bytes32) {
        return _activeRequestHash[agentId];
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
     * @notice Get the ERC-8004 Identity Registry address
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
     * @notice Map RevocationReason enum to ERC-8004 tag
     * @param reason The revocation reason
     * @return tag The bytes32 tag for the Validation Registry
     */
    function _reasonToTag(RevocationReason reason) internal pure returns (bytes32) {
        if (reason == RevocationReason.CollateralBelowMinimum) return TAG_REVOKED_COLLATERAL;
        if (reason == RevocationReason.TermsNotRegistered) return TAG_REVOKED_TERMS;
        if (reason == RevocationReason.TermsInvalidated) return TAG_REVOKED_TERMS;
        if (reason == RevocationReason.OwnershipChanged) return TAG_REVOKED_OWNER;
        if (reason == RevocationReason.ManualRevocation) return TAG_REVOKED_MANUAL;
        if (reason == RevocationReason.EmergencyPause) return TAG_REVOKED_MANUAL;
        return TAG_VALID; // fallback (should not happen for revocations)
    }

    /**
     * @notice Derive tag from failed conditions (when no explicit RevocationReason exists yet)
     * @dev Checks conditions in priority order — first failing condition determines the tag
     * @param conditions The validation conditions
     * @return tag The bytes32 tag
     */
    function _conditionsToTag(ValidationConditions memory conditions) internal view returns (bytes32) {
        if (!conditions.hasMinimumCollateral) return TAG_REVOKED_COLLATERAL;
        if (!conditions.hasActiveTerms) return TAG_REVOKED_TERMS;
        if (!conditions.isOwnerValid) return TAG_REVOKED_OWNER;
        if (enforceCouncilValidation && !conditions.councilIsActive) return TAG_REVOKED_COUNCIL;
        return TAG_VALID;
    }

    /**
     * @notice Determine revocation reason from failed conditions
     * @param conditions The validation conditions
     * @return reason The revocation reason
     */
    function _determineRevocationReason(ValidationConditions memory conditions)
        internal
        view
        returns (RevocationReason)
    {
        if (!conditions.hasMinimumCollateral) return RevocationReason.CollateralBelowMinimum;
        if (!conditions.hasActiveTerms) return RevocationReason.TermsInvalidated;
        if (!conditions.isOwnerValid) return RevocationReason.OwnershipChanged;
        if (enforceCouncilValidation && !conditions.councilIsActive) return RevocationReason.TermsInvalidated;
        return RevocationReason.None;
    }

    /**
     * @notice Require configuration is complete
     */
    function _requireConfigured() internal view {
        if (
            address(collateralVault) == address(0) || address(termsRegistry) == address(0)
                || address(validationRegistry) == address(0)
        ) {
            revert InvalidConfiguration();
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
            // Safe: value % 10 is always 0-9, so 48 + (0-9) = 48-57, fits in uint8
            // forge-lint: disable-next-line(unsafe-typecast)
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

interface IValidationRegistry {
    /// @notice Submit a validation response
    /// @param requestHash The request hash from the original validationRequest
    /// @param response Score 0-100 (100 = pass, 0 = fail/revoked)
    /// @param responseURI URI to off-chain evidence/audit
    /// @param responseHash Hash of the response data
    /// @param tag Custom categorization tag (bytes32)
    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseHash,
        bytes32 tag
    ) external;

    /// @notice Get validation status for a request
    /// @param requestHash The request hash
    /// @return validatorAddress The validator that should respond
    /// @return agentId The agent being validated
    /// @return response The current response score
    /// @return responseHash The response data hash
    /// @return tag The categorization tag
    /// @return lastUpdate Timestamp of last update
    function getValidationStatus(bytes32 requestHash)
        external
        view
        returns (
            address validatorAddress,
            uint256 agentId,
            uint8 response,
            bytes32 responseHash,
            bytes32 tag,
            uint256 lastUpdate
        );
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
