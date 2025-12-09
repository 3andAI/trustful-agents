// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IRulingExecutor
 * @notice Executes claim rulings and distributes deposits to voting council members
 * @dev Coordinates between ClaimsManager and CollateralVault
 * 
 * v1.2 MAJOR CHANGES - Deposit Distribution:
 * - Claimant deposits are ALWAYS distributed to voting council members
 * - This applies regardless of outcome (approved, rejected, cancelled)
 * - ONLY EXCEPTION: If claim expires with ZERO votes, deposit returns to claimant
 * - This eliminates council bias (no incentive to approve or reject)
 * - Only members who actually voted receive a share of the deposit
 * 
 * Distribution Matrix:
 * | Outcome              | Deposit Goes To          | Collateral Action      |
 * |----------------------|--------------------------|------------------------|
 * | Approved             | Voting council members   | Transferred to claimant|
 * | Rejected             | Voting council members   | Unlocked (no transfer) |
 * | Cancelled            | Voting council members   | Unlocked (no transfer) |
 * | Expired (with votes) | Voting council members   | Unlocked (no transfer) |
 * | Expired (no votes)   | Returned to claimant     | Unlocked (no transfer) |
 */
interface IRulingExecutor {
    // =========================================================================
    // Structs
    // =========================================================================

    struct ExecutionResult {
        uint256 claimId;
        uint256 agentId;
        address claimant;
        
        // Compensation (only for approved claims)
        uint256 approvedAmount;
        uint256 effectivePayout;        // After caps (min of approved, locked, maxPayout)
        uint256 councilFee;
        uint256 claimantReceives;
        
        // Deposit distribution [v1.2]
        uint256 depositAmount;
        uint256 voterCount;
        uint256 depositPerVoter;
        
        uint256 executedAt;
    }

    struct DepositDistribution {
        address[] recipients;           // Voting council members
        uint256 amountPerRecipient;
        uint256 remainder;              // Dust goes to first recipient
        uint256 totalDistributed;
    }

    // =========================================================================
    // Events
    // =========================================================================

    event ClaimExecuted(
        uint256 indexed claimId,
        uint256 indexed agentId,
        address indexed claimant,
        uint256 compensationAmount,
        uint256 councilFee
    );

    event DepositDistributed(
        uint256 indexed claimId,
        uint256 voterCount,
        uint256 totalAmount,
        uint256 amountPerVoter
    );

    event DepositReturned(
        uint256 indexed claimId,
        address indexed claimant,
        uint256 amount,
        string reason
    );

    event CollateralUnlocked(
        uint256 indexed claimId,
        uint256 indexed agentId,
        uint256 amount
    );

    event PartialExecution(
        uint256 indexed claimId,
        uint256 requestedAmount,
        uint256 actualAmount,
        string reason
    );

    // =========================================================================
    // Errors
    // =========================================================================

    error ClaimNotFound(uint256 claimId);
    error ClaimNotFinalized(uint256 claimId);
    error ClaimAlreadyExecuted(uint256 claimId);
    error NoVotersToDistribute(uint256 claimId);
    error InsufficientCollateral(uint256 claimId, uint256 required, uint256 available);

    // =========================================================================
    // Core Functions
    // =========================================================================

    /**
     * @notice Execute an approved claim
     * @param claimId The claim ID to execute
     * @dev Can be called by anyone after claim is approved
     * @dev Transfers compensation from CollateralVault to claimant
     * @dev Distributes claimant deposit to voting council members
     * @dev Deducts council fee from compensation
     */
    function executeApprovedClaim(uint256 claimId) external;

    /**
     * @notice Execute a rejected claim
     * @param claimId The claim ID
     * @dev Can be called by anyone after claim is rejected
     * @dev Unlocks collateral (no transfer)
     * @dev Distributes claimant deposit to voting council members
     */
    function executeRejectedClaim(uint256 claimId) external;

    /**
     * @notice Execute a cancelled claim
     * @param claimId The claim ID
     * @dev Can be called by anyone after claim is cancelled
     * @dev Unlocks collateral (no transfer)
     * @dev Distributes claimant deposit to voting council members
     * [v1.2] Updated: deposit forfeited to voters, not returned
     */
    function executeCancelledClaim(uint256 claimId) external;

    /**
     * @notice Execute an expired claim
     * @param claimId The claim ID
     * @dev Can be called by anyone after claim has expired
     * @dev If no votes were cast: returns deposit to claimant
     * @dev If votes were cast: distributes deposit to voting members
     * @dev Always unlocks collateral (no transfer)
     * [v1.2] New function with special no-votes handling
     */
    function executeExpiredClaim(uint256 claimId) external;

    /**
     * @notice Execute any finalized claim (auto-detects type)
     * @param claimId The claim ID
     * @dev Convenience function that routes to appropriate handler
     * @dev Can be called by anyone after claim is finalized
     */
    function executeClaim(uint256 claimId) external;

    /**
     * @notice Execute multiple claims in batch
     * @param claimIds Array of claim IDs
     * @dev Continues on individual failures
     * @dev Emits events for each successful execution
     */
    function batchExecute(uint256[] calldata claimIds) external;

    // =========================================================================
    // View Functions
    // =========================================================================

    /**
     * @notice Check if a claim can be executed
     * @param claimId The claim ID
     * @return canExec True if ready for execution
     * @return reason Reason if cannot execute
     */
    function canExecute(uint256 claimId)
        external
        view
        returns (bool canExec, string memory reason);

    /**
     * @notice Preview execution outcome for an approved claim
     * @param claimId The claim ID
     * @return result The ExecutionResult struct with projected values
     */
    function previewExecution(uint256 claimId)
        external
        view
        returns (ExecutionResult memory result);

    /**
     * @notice Preview deposit distribution for a claim
     * @param claimId The claim ID
     * @return distribution The DepositDistribution struct
     * [v1.2] New function
     */
    function previewDepositDistribution(uint256 claimId)
        external
        view
        returns (DepositDistribution memory distribution);

    /**
     * @notice Calculate effective payout considering all caps
     * @param claimId The claim ID
     * @return effectivePayout The actual amount that will be paid
     * @return cappedBy What limited the payout ("approved", "locked", "maxPayout", "none")
     */
    function calculateEffectivePayout(uint256 claimId)
        external
        view
        returns (uint256 effectivePayout, string memory cappedBy);

    /**
     * @notice Get claims ready for execution
     * @return claimIds Array of executable claim IDs
     */
    function getExecutableClaims() external view returns (uint256[] memory claimIds);

    /**
     * @notice Get claims ready for execution by council
     * @param councilId The council identifier
     * @return claimIds Array of executable claim IDs for this council
     */
    function getExecutableClaimsByCouncil(bytes32 councilId) 
        external 
        view 
        returns (uint256[] memory claimIds);

    /**
     * @notice Check if a claim's deposit will be returned (expired with no votes)
     * @param claimId The claim ID
     * @return willReturn True if deposit will be returned to claimant
     * [v1.2] New function
     */
    function willDepositBeReturned(uint256 claimId) 
        external 
        view 
        returns (bool willReturn);
}
