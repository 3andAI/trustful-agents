// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IClaimsManager
 * @notice Manages the full lifecycle of claims: filing, evidence, voting, resolution
 * @dev Implements claim deposits, payment binding, and partial locking (v1.1)
 */
interface IClaimsManager {
    // =========================================================================
    // Enums
    // =========================================================================

    enum ClaimStatus {
        Filed,              // Claim submitted, evidence period active
        EvidenceClosed,     // Evidence period ended, voting open
        VotingClosed,       // Voting period ended, awaiting execution
        Approved,           // Claim approved by council
        Rejected,           // Claim rejected by council
        Executed,           // Compensation paid out
        Cancelled           // Cancelled by claimant (before voting)
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
        bytes32 evidenceHash;         // Hash of evidence document
        string evidenceUri;           // URI to evidence
        bytes32 paymentReceiptHash;   // x402 payment receipt hash (v1.1)
        bytes32 termsHashAtClaimTime; // T&C hash when claim filed (v1.1)
        uint256 termsVersionAtClaimTime; // T&C version when filed
        address providerAtClaimTime;  // Agent owner when claim filed
        bytes32 councilId;            // Council handling this claim
        uint256 claimantDeposit;      // Deposit staked by claimant (v1.1)
        uint256 lockedCollateral;     // Collateral locked for this claim (v1.1)
        ClaimStatus status;
        uint256 filedAt;              // Timestamp when filed
        uint256 evidenceDeadline;     // When evidence period ends
        uint256 votingDeadline;       // When voting period ends
    }

    struct VoteRecord {
        address voter;
        Vote vote;
        uint256 approvedAmount;       // Amount voter thinks should be approved
        string reasoning;             // Optional reasoning (hash or short text)
        uint256 votedAt;
    }

    struct ClaimStats {
        uint256 totalClaims;
        uint256 approvedClaims;
        uint256 rejectedClaims;
        uint256 pendingClaims;
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

    event EvidenceSubmitted(
        uint256 indexed claimId,
        bytes32 evidenceHash,
        string evidenceUri,
        bool isCounterEvidence
    );

    event VoteCast(
        uint256 indexed claimId,
        address indexed voter,
        Vote vote,
        uint256 approvedAmount
    );

    event ClaimApproved(uint256 indexed claimId, uint256 approvedAmount);
    event ClaimRejected(uint256 indexed claimId);
    event ClaimCancelled(uint256 indexed claimId, uint256 depositReturned);
    event ClaimExecuted(uint256 indexed claimId, uint256 amountPaid);
    event DepositForfeited(uint256 indexed claimId, uint256 amount, bytes32 councilId);
    event DepositReturned(uint256 indexed claimId, uint256 amount, address claimant);

    // =========================================================================
    // Core Functions
    // =========================================================================

    /**
     * @notice File a new claim against an agent
     * @param agentId The ERC-8004 token ID
     * @param claimedAmount The compensation amount requested (USDC)
     * @param evidenceHash Hash of evidence document
     * @param evidenceUri URI to evidence document
     * @param paymentReceiptHash x402 payment receipt hash proving paid service
     * @return claimId The new claim ID
     * @dev Requires prior USDC approval for deposit
     * @dev Council is derived from agent's active T&C
     */
    function fileClaim(
        uint256 agentId,
        uint256 claimedAmount,
        bytes32 evidenceHash,
        string calldata evidenceUri,
        bytes32 paymentReceiptHash
    ) external returns (uint256 claimId);

    /**
     * @notice Submit additional evidence for a claim
     * @param claimId The claim ID
     * @param evidenceHash Hash of additional evidence
     * @param evidenceUri URI to additional evidence
     * @dev Only claimant can call, only during evidence period
     */
    function submitAdditionalEvidence(
        uint256 claimId,
        bytes32 evidenceHash,
        string calldata evidenceUri
    ) external;

    /**
     * @notice Submit counter-evidence (for provider)
     * @param claimId The claim ID
     * @param evidenceHash Hash of counter-evidence
     * @param evidenceUri URI to counter-evidence
     * @dev Only agent owner can call, only during evidence period
     */
    function submitCounterEvidence(
        uint256 claimId,
        bytes32 evidenceHash,
        string calldata evidenceUri
    ) external;

    /**
     * @notice Cast vote on a claim
     * @param claimId The claim ID
     * @param vote The vote (Approve/Reject/Abstain)
     * @param approvedAmount Amount to approve (ignored if rejecting)
     * @param reasoning Optional reasoning (can be hash or short text)
     * @dev Only active council members can call
     * @dev Only during voting period
     */
    function castVote(
        uint256 claimId,
        Vote vote,
        uint256 approvedAmount,
        string calldata reasoning
    ) external;

    /**
     * @notice Close voting and determine outcome
     * @param claimId The claim ID
     * @dev Can be called by anyone after voting deadline
     * @dev Sets status to Approved or Rejected
     */
    function closeVoting(uint256 claimId) external;

    /**
     * @notice Cancel a claim and reclaim deposit
     * @param claimId The claim ID
     * @dev Only claimant can call
     * @dev Only before voting starts
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
     * @return hasVoted True if already voted
     */
    function hasVoted(uint256 claimId, address voter) external view returns (bool hasVoted);

    /**
     * @notice Get claim statistics for an agent
     * @param agentId The ERC-8004 token ID
     * @return stats The ClaimStats struct
     */
    function getClaimStats(uint256 agentId) external view returns (ClaimStats memory stats);

    /**
     * @notice Calculate required deposit for a claim
     * @param agentId The ERC-8004 token ID
     * @param claimedAmount The amount to be claimed
     * @return deposit The required deposit amount
     * @dev Uses council's claimDepositPercentage from agent's active T&C
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
}
