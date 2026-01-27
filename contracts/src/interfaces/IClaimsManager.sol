// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IClaimsManager
 * @notice Manages the full lifecycle of claims: filing, voting, resolution
 * @dev Implements claim deposits, payment binding, and partial locking
 * 
 * v1.3 Changes (Audit Fixes):
 * - Removed on-chain evidence storage (moved to off-chain system)
 * - Added vote amount validation (approvedAmount <= claimedAmount)
 * - Added safe math for median calculation
 * - Added underflow protection for stats tracking
 * - Added MAX_CLAIM_AMOUNT validation
 * - Fixed markExecuted to be one-shot
 * - Fixed deposit transfer functions with CEI pattern
 * 
 * v1.2 Changes:
 * - Added `Expired` status for claims that pass deadline with/without votes
 * - Added `changeVote()` for council members to modify votes during voting period
 * - Added `getVotersForClaim()` to support deposit distribution to voters only
 * - Vote changes overwrite previous vote (only final vote counts for median calculation)
 * - Updated cancelClaim: deposit is forfeited to council, NOT returned to claimant
 * - Added VoteChanged event
 */
interface IClaimsManager {
    // =========================================================================
    // Enums
    // =========================================================================

    enum ClaimStatus {
        Filed,              // Claim submitted, evidence period active
        EvidenceClosed,     // Evidence period ended, voting open
        VotingClosed,       // Voting period ended, awaiting finalization
        Approved,           // Claim approved by council
        Rejected,           // Claim rejected by council
        Executed,           // Compensation paid out
        Cancelled,          // Cancelled by claimant (deposit forfeited)
        Expired             // [v1.2] Deadline passed (special handling if no votes)
    }

    enum Vote {
        None,               // No vote cast
        Approve,            // Vote to approve compensation
        Reject,             // Vote to reject claim
        Abstain             // Abstain from voting
    }

    // =========================================================================
    // Structs
    // =========================================================================

    struct Claim {
        uint256 claimId;
        uint256 agentId;              // ERC-8004 token ID
        address claimant;             // Address filing the claim
        uint256 claimedAmount;        // Amount requested (USDC)
        uint256 approvedAmount;       // Amount approved by council (may differ)
        bytes32 paymentReceiptHash;   // x402 payment receipt hash
        bytes32 termsHashAtClaimTime; // T&C hash when claim filed
        uint256 termsVersionAtClaimTime; // T&C version when filed
        address providerAtClaimTime;  // Agent owner when claim filed
        bytes32 councilId;            // Council handling this claim
        uint256 claimantDeposit;      // Deposit staked by claimant
        uint256 lockedCollateral;     // Collateral locked for this claim
        ClaimStatus status;
        uint256 filedAt;              // Timestamp when filed
        uint256 evidenceDeadline;     // When evidence period ends (voting starts after)
        uint256 votingDeadline;       // When voting period ends
        bool hadVotes;                // [v1.2] True if at least one vote was cast
    }

    struct VoteRecord {
        address voter;
        Vote vote;
        uint256 approvedAmount;       // Amount voter thinks should be approved
        string reasoning;             // Optional reasoning (hash or short text)
        uint256 votedAt;
        uint256 lastChangedAt;        // [v1.2] Timestamp of last vote change (0 if never changed)
    }

    struct ClaimStats {
        uint256 totalClaims;
        uint256 approvedClaims;
        uint256 rejectedClaims;
        uint256 pendingClaims;
        uint256 expiredClaims;        // [v1.2] Added
        uint256 totalPaidOut;
    }

    struct VotingProgress {
        uint256 approveVotes;
        uint256 rejectVotes;
        uint256 abstainVotes;
        uint256 totalVotes;
        uint256 requiredQuorum;
        uint256 deadline;
        bool quorumReached;
    }

    // =========================================================================
    // Events
    // =========================================================================

    event ClaimFiled(
        uint256 indexed claimId,
        uint256 indexed agentId,
        address indexed claimant,
        uint256 claimedAmount,
        uint256 claimantDeposit,
        bytes32 councilId
    );

    event VoteCast(
        uint256 indexed claimId,
        address indexed voter,
        Vote vote,
        uint256 approvedAmount
    );

    event VoteChanged(
        uint256 indexed claimId,
        address indexed voter,
        Vote oldVote,
        Vote newVote,
        uint256 oldApprovedAmount,
        uint256 newApprovedAmount
    );

    event ClaimApproved(uint256 indexed claimId, uint256 approvedAmount);
    event ClaimRejected(uint256 indexed claimId);
    event ClaimCancelled(uint256 indexed claimId, uint256 depositForfeited);
    event ClaimExpired(uint256 indexed claimId, bool hadVotes);
    event ClaimExecuted(uint256 indexed claimId, uint256 amountPaid);

    // =========================================================================
    // Errors
    // =========================================================================

    error ClaimNotFound(uint256 claimId);
    error NotClaimant(uint256 claimId, address caller);
    error NotCouncilMember(bytes32 councilId, address caller);
    error InvalidClaimStatus(uint256 claimId, ClaimStatus current, ClaimStatus required);
    error EvidencePeriodEnded(uint256 claimId);
    error VotingPeriodEnded(uint256 claimId);
    error VotingPeriodNotStarted(uint256 claimId);
    error VotingPeriodNotEnded(uint256 claimId);
    error AlreadyVoted(uint256 claimId, address voter);
    error NotYetVoted(uint256 claimId, address voter);
    error CannotCancelAfterVotingStarts(uint256 claimId);

    // =========================================================================
    // Core Functions
    // =========================================================================

    /**
     * @notice File a new claim against an agent
     * @param agentId The ERC-8004 token ID
     * @param claimedAmount The compensation amount requested (USDC)
     * @param paymentReceiptHash x402 payment receipt hash proving paid service
     * @return claimId The new claim ID
     * @dev Requires prior USDC approval for deposit
     * @dev Council is derived from agent's active T&C (or governance override)
     * @dev Evidence is handled off-chain; evidenceDeadline controls voting start
     */
    function fileClaim(
        uint256 agentId,
        uint256 claimedAmount,
        bytes32 paymentReceiptHash
    ) external returns (uint256 claimId);

    /**
     * @notice Cast vote on a claim
     * @param claimId The claim ID
     * @param vote The vote (Approve/Reject/Abstain)
     * @param approvedAmount Amount to approve (ignored if rejecting)
     * @param reasoning Optional reasoning (can be hash or short text)
     * @dev Only active council members can call
     * @dev Only during voting period
     * @dev Reverts if already voted (use changeVote instead)
     */
    function castVote(
        uint256 claimId,
        Vote vote,
        uint256 approvedAmount,
        string calldata reasoning
    ) external;

    /**
     * @notice Change an existing vote during voting period
     * @param claimId The claim ID
     * @param newVote The new vote (Approve/Reject/Abstain)
     * @param newApprovedAmount New amount to approve (ignored if rejecting)
     * @param newReasoning New reasoning
     * @dev Only for council members who have already voted
     * @dev Only during voting period
     * @dev Overwrites previous vote entirely (only final vote counts)
     * [v1.2] New function
     */
    function changeVote(
        uint256 claimId,
        Vote newVote,
        uint256 newApprovedAmount,
        string calldata newReasoning
    ) external;

    /**
     * @notice Finalize a claim after voting period ends
     * @param claimId The claim ID
     * @dev Can be called by anyone after voting deadline
     * @dev Sets status to Approved, Rejected, or Expired based on votes
     * @dev If expired with no votes, deposit is returned to claimant
     * @dev If expired with votes OR approved/rejected, deposit goes to voters
     */
    function finalizeClaim(uint256 claimId) external;

    /**
     * @notice Cancel a claim before voting starts
     * @param claimId The claim ID
     * @dev Only claimant can call
     * @dev Only before voting period starts (during evidence period)
     * @dev Deposit is FORFEITED to voting council members, NOT returned
     * [v1.2] Updated: deposit forfeited, not returned
     */
    function cancelClaim(uint256 claimId) external;

    // =========================================================================
    // View Functions
    // =========================================================================

    /**
     * @notice Get claim details
     * @param claimId The claim ID
     * @return claim The Claim struct
     */
    function getClaim(uint256 claimId) external view returns (Claim memory claim);

    /**
     * @notice Get all claims for an agent
     * @param agentId The ERC-8004 token ID
     * @return claimIds Array of claim IDs
     */
    function getClaimsByAgent(uint256 agentId) external view returns (uint256[] memory claimIds);

    /**
     * @notice Get all claims for a council
     * @param councilId The council identifier
     * @return claimIds Array of claim IDs
     */
    function getClaimsByCouncil(bytes32 councilId) external view returns (uint256[] memory claimIds);

    /**
     * @notice Get pending claims for a council (for council member dashboard)
     * @param councilId The council identifier
     * @return claimIds Array of pending claim IDs
     */
    function getPendingClaimsByCouncil(bytes32 councilId)
        external
        view
        returns (uint256[] memory claimIds);

    /**
     * @notice Get claims filed by an address
     * @param claimant The claimant address
     * @return claimIds Array of claim IDs
     */
    function getClaimsByClaimant(address claimant)
        external
        view
        returns (uint256[] memory claimIds);

    /**
     * @notice Get voting progress for a claim
     * @param claimId The claim ID
     * @return progress The VotingProgress struct
     */
    function getVotingProgress(uint256 claimId)
        external
        view
        returns (VotingProgress memory progress);

    /**
     * @notice Get all votes for a claim
     * @param claimId The claim ID
     * @return votes Array of VoteRecord structs
     */
    function getVotes(uint256 claimId) external view returns (VoteRecord[] memory votes);

    /**
     * @notice Get addresses of all council members who voted on a claim
     * @param claimId The claim ID
     * @return voters Array of voter addresses
     * @dev Used for deposit distribution - only voters receive share
     * [v1.2] New function
     */
    function getVotersForClaim(uint256 claimId) 
        external 
        view 
        returns (address[] memory voters);

    /**
     * @notice Get a specific voter's vote
     * @param claimId The claim ID
     * @param voter The voter address
     * @return record The VoteRecord
     */
    function getVote(uint256 claimId, address voter)
        external
        view
        returns (VoteRecord memory record);

    /**
     * @notice Check if a council member has voted on a claim
     * @param claimId The claim ID
     * @param voter The voter address
     * @return voted True if already voted
     */
    function hasVoted(uint256 claimId, address voter) external view returns (bool voted);

    /**
     * @notice Get claim statistics for an agent
     * @param agentId The ERC-8004 token ID
     * @return stats The ClaimStats struct
     */
    function getClaimStats(uint256 agentId) external view returns (ClaimStats memory stats);

    /**
     * @notice Get count of pending (unresolved) claims for an agent
     * @param agentId The ERC-8004 token ID
     * @return count Number of pending claims
     * @dev Used by CouncilRegistry to check if agent can be reassigned
     * [v1.2] New function
     */
    function getPendingClaimCount(uint256 agentId) external view returns (uint256 count);

    /**
     * @notice Calculate required deposit for a claim
     * @param agentId The ERC-8004 token ID
     * @param claimedAmount The amount to be claimed
     * @return deposit The required deposit amount
     * @dev Uses council's claimDepositPercentage from agent's assigned council
     */
    function calculateRequiredDeposit(uint256 agentId, uint256 claimedAmount)
        external
        view
        returns (uint256 deposit);

    /**
     * @notice Get the next claim ID
     * @return nextId The next claim ID that will be assigned
     */
    function nextClaimId() external view returns (uint256 nextId);

    /**
     * @notice Calculate the median approved amount from approval votes
     * @param claimId The claim ID
     * @return medianAmount The median of approved amounts
     * @dev Only considers Approve votes, ignores Reject and Abstain
     */
    function calculateMedianApprovedAmount(uint256 claimId) 
        external 
        view 
        returns (uint256 medianAmount);
}
