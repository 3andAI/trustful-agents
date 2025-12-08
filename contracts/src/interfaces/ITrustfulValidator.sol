// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ITrustfulValidator
 * @notice Issues and revokes ERC-8004 validations based on trust conditions
 * @dev Acts as a validator in the ERC-8004 Validation Registry pattern
 */
interface ITrustfulValidator {
    // =========================================================================
    // Enums
    // =========================================================================

    enum ValidationStatus {
        NotValidated,       // No validation issued
        Valid,              // Currently validated
        Revoked,            // Was validated, now revoked
        ConditionsNotMet    // Conditions not met for validation
    }

    enum RevocationReason {
        None,
        CollateralBelowMinimum,
        TermsNotRegistered,
        MaxPayoutZero,
        OwnershipChanged,
        ManualRevocation,
        EmergencyPause
    }

    // =========================================================================
    // Structs
    // =========================================================================

    struct ValidationRecord {
        bytes32 requestHash;          // ERC-8004 request hash
        uint256 issuedAt;             // Timestamp when validation was issued
        uint256 revokedAt;            // Timestamp when revoked (0 if valid)
        uint256 nonce;                // Incremented on each re-validation
        RevocationReason revocationReason;
    }

    struct ValidationConditions {
        bool hasMinimumCollateral;    // Collateral >= minimum threshold
        bool hasTermsRegistered;      // T&C has been registered
        bool hasValidMaxPayout;       // maxPayoutPerClaim > 0
        bool isOwnerValid;            // ERC-8004 ownership is valid
    }

    // =========================================================================
    // Events
    // =========================================================================

    event ValidationIssued(
        uint256 indexed agentId,
        bytes32 indexed requestHash,
        uint256 nonce,
        string responseUri
    );

    event ValidationRevoked(
        uint256 indexed agentId,
        bytes32 indexed requestHash,
        RevocationReason reason
    );

    event ValidationConditionsChanged(uint256 indexed agentId, ValidationConditions conditions);

    // =========================================================================
    // Core Functions
    // =========================================================================

    /**
     * @notice Request validation for an agent
     * @param agentId The ERC-8004 token ID
     * @return requestHash The ERC-8004 request hash
     * @dev Only agent owner can call
     * @dev Reverts if conditions not met
     */
    function requestValidation(uint256 agentId) external returns (bytes32 requestHash);

    /**
     * @notice Revoke validation manually
     * @param agentId The ERC-8004 token ID
     * @dev Only agent owner or governance can call
     */
    function revokeValidation(uint256 agentId) external;

    /**
     * @notice Check and update validation status based on current conditions
     * @param agentId The ERC-8004 token ID
     * @dev Can be called by anyone
     * @dev Will revoke if conditions no longer met
     */
    function checkValidation(uint256 agentId) external;

    // =========================================================================
    // View Functions
    // =========================================================================

    /**
     * @notice Check if an agent is currently validated
     * @param agentId The ERC-8004 token ID
     * @return isValid True if validation is currently valid
     */
    function isValidated(uint256 agentId) external view returns (bool isValid);

    /**
     * @notice Get detailed validation status
     * @param agentId The ERC-8004 token ID
     * @return status The validation status enum
     */
    function getValidationStatus(uint256 agentId) external view returns (ValidationStatus status);

    /**
     * @notice Get full validation record
     * @param agentId The ERC-8004 token ID
     * @return record The ValidationRecord struct
     */
    function getValidationRecord(uint256 agentId)
        external
        view
        returns (ValidationRecord memory record);

    /**
     * @notice Check current validation conditions
     * @param agentId The ERC-8004 token ID
     * @return conditions The ValidationConditions struct
     */
    function checkConditions(uint256 agentId)
        external
        view
        returns (ValidationConditions memory conditions);

    /**
     * @notice Get the response URI for an agent's validation
     * @param agentId The ERC-8004 token ID
     * @return uri The deterministic response URI
     */
    function getResponseUri(uint256 agentId) external view returns (string memory uri);

    /**
     * @notice Compute the ERC-8004 request hash
     * @param agentId The ERC-8004 token ID
     * @param nonce The validation nonce
     * @return requestHash The computed request hash
     */
    function computeRequestHash(uint256 agentId, uint256 nonce)
        external
        view
        returns (bytes32 requestHash);

    /**
     * @notice Get trust info for A2A Agent Card extension
     * @param agentId The ERC-8004 token ID
     * @return collateralAmount Current collateral balance
     * @return maxPayoutPerClaim Max payout from active terms
     * @return councilId Council handling disputes
     * @return isValid Current validation status
     */
    function getTrustInfo(uint256 agentId)
        external
        view
        returns (
            uint256 collateralAmount,
            uint256 maxPayoutPerClaim,
            bytes32 councilId,
            bool isValid
        );

    // =========================================================================
    // Configuration
    // =========================================================================

    /**
     * @notice Get minimum collateral required for validation
     * @return minCollateral The minimum amount in USDC
     */
    function minimumCollateral() external view returns (uint256 minCollateral);

    /**
     * @notice Get the base URI for validation responses
     * @return baseUri The base URI string
     */
    function validationBaseUri() external view returns (string memory baseUri);
}
