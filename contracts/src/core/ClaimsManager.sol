// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IClaimsManager } from "../interfaces/IClaimsManager.sol";
import { ITrustfulPausable } from "../interfaces/ITrustfulPausable.sol";
import { TrustfulPausable } from "../base/TrustfulPausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ClaimsManager
 * @notice Manages the full lifecycle of claims: filing, voting, resolution
 * @dev Implements claim deposits, payment binding, and collateral locking
 *
 * v1.3 Changes (Audit Fixes):
 * - Removed on-chain evidence storage (moved to off-chain system)
 * - Added vote amount validation (approvedAmount <= claimedAmount)
 * - Added safe math for median calculation (prevents overflow DoS)
 * - Added underflow protection for stats tracking
 * - Added MAX_CLAIM_AMOUNT validation
 * - Fixed markExecuted to be one-shot
 * - Fixed deposit transfer functions with CEI pattern
 * - Added pause modifiers to voting and finalization
 * - Added council active member check when filing claims
 * - Changed sorting algorithm to insertion sort for cleaner auditing
 *
 * Key Design:
 * - Claimant must deposit USDC (percentage of claim amount)
 * - Deposit always goes to voting council members (regardless of outcome)
 * - Evidence period handled off-chain; on-chain period controls voting start
 * - Voting period for council members to vote
 * - Median approved amount used for partial awards
 * - No cap on concurrent claims per agent
 */
contract ClaimsManager is IClaimsManager, TrustfulPausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =========================================================================
    // State
    // =========================================================================

    /// @notice All claims
    mapping(uint256 => Claim) private _claims;

    /// @notice Votes per claim: claimId => voter => VoteRecord
    mapping(uint256 => mapping(address => VoteRecord)) private _votes;

    /// @notice Voters list per claim: claimId => voter addresses
    mapping(uint256 => address[]) private _voterList;

    /// @notice Claims by agent: agentId => claimIds
    mapping(uint256 => uint256[]) private _claimsByAgent;

    /// @notice Claims by council: councilId => claimIds
    mapping(bytes32 => uint256[]) private _claimsByCouncil;

    /// @notice Claims by claimant: claimant => claimIds
    mapping(address => uint256[]) private _claimsByClaimant;

    /// @notice Stats per agent
    mapping(uint256 => ClaimStats) private _agentStats;

    /// @notice Next claim ID
    uint256 private _nextClaimId = 1;

    /// @notice USDC token
    IERC20 private immutable _USDC;

    /// @notice CollateralVault contract
    ICollateralVault public collateralVault;

    /// @notice TermsRegistry contract
    ITermsRegistry public termsRegistry;

    /// @notice CouncilRegistry contract
    ICouncilRegistry public councilRegistry;

    /// @notice RulingExecutor contract
    address public rulingExecutor;

    /// @notice ERC-8004 registry
    IERC8004Registry private immutable _REGISTRY;

    // =========================================================================
    // Constants
    // =========================================================================

    uint256 public constant MIN_CLAIM_AMOUNT = 1e6; // 1 USDC minimum
    uint256 public constant MAX_CLAIM_AMOUNT = 1_000_000_000e6; // 1 billion USDC maximum

    // =========================================================================
    // Errors
    // =========================================================================

    error InsufficientClaimAmount(uint256 provided, uint256 minimum);
    error ExcessiveClaimAmount(uint256 provided, uint256 maximum);
    error AgentNotValidated(uint256 agentId);
    error NoActiveTerms(uint256 agentId);
    error InsufficientDeposit(uint256 provided, uint256 required);
    error NotAgentOwner(uint256 agentId, address caller);
    error InvalidConfiguration();
    error ApprovedAmountExceedsClaimed(uint256 approvedAmount, uint256 claimedAmount);
    error CouncilHasNoActiveMembers(bytes32 councilId);
    error ClaimAlreadyExecuted(uint256 claimId);

    // =========================================================================
    // Events (for configuration changes)
    // =========================================================================

    event CollateralVaultUpdated(address indexed oldVault, address indexed newVault);
    event TermsRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event CouncilRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event RulingExecutorUpdated(address indexed oldExecutor, address indexed newExecutor);

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor(
        address usdc_,
        address registry_,
        address governance_
    ) TrustfulPausable(governance_) {
        if (usdc_ == address(0) || registry_ == address(0)) revert ZeroAddress();
        _USDC = IERC20(usdc_);
        _REGISTRY = IERC8004Registry(registry_);
    }

    // =========================================================================
    // Admin Configuration
    // =========================================================================

    function setCollateralVault(address vault_) external onlyGovernance {
        if (vault_ == address(0)) revert ZeroAddress();
        address oldVault = address(collateralVault);
        collateralVault = ICollateralVault(vault_);
        emit CollateralVaultUpdated(oldVault, vault_);
    }

    function setTermsRegistry(address registry_) external onlyGovernance {
        if (registry_ == address(0)) revert ZeroAddress();
        address oldRegistry = address(termsRegistry);
        termsRegistry = ITermsRegistry(registry_);
        emit TermsRegistryUpdated(oldRegistry, registry_);
    }

    function setCouncilRegistry(address registry_) external onlyGovernance {
        if (registry_ == address(0)) revert ZeroAddress();
        address oldRegistry = address(councilRegistry);
        councilRegistry = ICouncilRegistry(registry_);
        emit CouncilRegistryUpdated(oldRegistry, registry_);
    }

    function setRulingExecutor(address executor_) external onlyGovernance {
        if (executor_ == address(0)) revert ZeroAddress();
        address oldExecutor = rulingExecutor;
        rulingExecutor = executor_;
        emit RulingExecutorUpdated(oldExecutor, executor_);
    }

    // =========================================================================
    // Core Functions
    // =========================================================================

    /// @inheritdoc IClaimsManager
    function fileClaim(
        uint256 agentId,
        uint256 claimedAmount,
        bytes32 paymentReceiptHash
    ) external nonReentrant whenNotPaused(ITrustfulPausable.PauseScope.Claims) returns (uint256 claimId) {
        _requireConfigured();

        // Validate claim amount
        if (claimedAmount < MIN_CLAIM_AMOUNT) {
            revert InsufficientClaimAmount(claimedAmount, MIN_CLAIM_AMOUNT);
        }
        if (claimedAmount > MAX_CLAIM_AMOUNT) {
            revert ExcessiveClaimAmount(claimedAmount, MAX_CLAIM_AMOUNT);
        }

        // Get agent's active terms
        if (!termsRegistry.hasActiveTerms(agentId)) {
            revert NoActiveTerms(agentId);
        }

        (ITermsRegistry.TermsVersion memory terms, uint256 termsVersion) = 
            termsRegistry.getActiveTerms(agentId);

        // Get council (check for override first)
        bytes32 councilId = councilRegistry.getAgentCouncil(agentId);
        if (councilId == bytes32(0)) {
            councilId = terms.councilId;
        }

        // Validate council is active
        (bool exists, bool active) = councilRegistry.councilStatus(councilId);
        if (!exists || !active) {
            revert ICouncilRegistry.CouncilNotActive(councilId);
        }

        // [v1.3] Validate council has active members
        uint256 activeMemberCount = councilRegistry.getActiveMemberCount(councilId);
        if (activeMemberCount == 0) {
            revert CouncilHasNoActiveMembers(councilId);
        }

        // Calculate and transfer deposit
        uint256 requiredDeposit = councilRegistry.calculateRequiredDeposit(councilId, claimedAmount);
        _USDC.safeTransferFrom(msg.sender, address(this), requiredDeposit);

        // Get council timing
        ICouncilRegistry.Council memory council = councilRegistry.getCouncil(councilId);

        // Create claim ID first (needed for lock)
        claimId = _nextClaimId++;

        // Lock collateral
        uint256 lockedAmount = collateralVault.lock(agentId, claimId, claimedAmount);

        _claims[claimId] = Claim({
            claimId: claimId,
            agentId: agentId,
            claimant: msg.sender,
            claimedAmount: claimedAmount,
            approvedAmount: 0,
            paymentReceiptHash: paymentReceiptHash,
            termsHashAtClaimTime: terms.contentHash,
            termsVersionAtClaimTime: termsVersion,
            providerAtClaimTime: _REGISTRY.ownerOf(agentId),
            councilId: councilId,
            claimantDeposit: requiredDeposit,
            lockedCollateral: lockedAmount,
            status: ClaimStatus.Filed,
            filedAt: block.timestamp,
            evidenceDeadline: block.timestamp + council.evidencePeriod,
            votingDeadline: block.timestamp + council.evidencePeriod + council.votingPeriod,
            hadVotes: false
        });

        // Track
        _claimsByAgent[agentId].push(claimId);
        _claimsByCouncil[councilId].push(claimId);
        _claimsByClaimant[msg.sender].push(claimId);

        // Update stats
        _agentStats[agentId].totalClaims++;
        _agentStats[agentId].pendingClaims++;

        // Notify council registry
        councilRegistry.incrementPendingClaims(councilId);

        emit ClaimFiled(claimId, agentId, msg.sender, claimedAmount, requiredDeposit, councilId);
    }

    /// @inheritdoc IClaimsManager
    function castVote(
        uint256 claimId,
        Vote vote,
        uint256 approvedAmount,
        string calldata reasoning
    ) external whenNotPaused(ITrustfulPausable.PauseScope.Voting) {
        Claim storage claim = _claims[claimId];
        if (claim.claimId == 0) revert ClaimNotFound(claimId);

        // Check timing
        if (block.timestamp <= claim.evidenceDeadline) {
            revert VotingPeriodNotStarted(claimId);
        }
        if (block.timestamp > claim.votingDeadline) {
            revert VotingPeriodEnded(claimId);
        }

        // Check council membership
        if (!councilRegistry.isActiveMember(claim.councilId, msg.sender)) {
            revert NotCouncilMember(claim.councilId, msg.sender);
        }

        // Check not already voted
        if (_votes[claimId][msg.sender].votedAt != 0) {
            revert AlreadyVoted(claimId, msg.sender);
        }

        // [v1.3] Validate approved amount if approving
        uint256 validatedAmount = 0;
        if (vote == Vote.Approve) {
            if (approvedAmount > claim.claimedAmount) {
                revert ApprovedAmountExceedsClaimed(approvedAmount, claim.claimedAmount);
            }
            validatedAmount = approvedAmount;
        }

        // Update claim status if first time in voting period
        if (claim.status == ClaimStatus.Filed) {
            claim.status = ClaimStatus.EvidenceClosed;
        }

        // Record vote
        _votes[claimId][msg.sender] = VoteRecord({
            voter: msg.sender,
            vote: vote,
            approvedAmount: validatedAmount,
            reasoning: reasoning,
            votedAt: block.timestamp,
            lastChangedAt: 0
        });

        _voterList[claimId].push(msg.sender);
        claim.hadVotes = true;

        // Update member stats
        councilRegistry.incrementMemberVotes(claim.councilId, msg.sender);

        emit VoteCast(claimId, msg.sender, vote, validatedAmount);
    }

    /// @inheritdoc IClaimsManager
    function changeVote(
        uint256 claimId,
        Vote newVote,
        uint256 newApprovedAmount,
        string calldata newReasoning
    ) external whenNotPaused(ITrustfulPausable.PauseScope.Voting) {
        Claim storage claim = _claims[claimId];
        if (claim.claimId == 0) revert ClaimNotFound(claimId);

        // Check timing
        if (block.timestamp > claim.votingDeadline) {
            revert VotingPeriodEnded(claimId);
        }

        // Check has voted
        VoteRecord storage record = _votes[claimId][msg.sender];
        if (record.votedAt == 0) {
            revert NotYetVoted(claimId, msg.sender);
        }

        // [v1.3] Validate approved amount if approving
        uint256 validatedAmount = 0;
        if (newVote == Vote.Approve) {
            if (newApprovedAmount > claim.claimedAmount) {
                revert ApprovedAmountExceedsClaimed(newApprovedAmount, claim.claimedAmount);
            }
            validatedAmount = newApprovedAmount;
        }

        // Store old values for event
        Vote oldVote = record.vote;
        uint256 oldApprovedAmount = record.approvedAmount;

        // Update vote
        record.vote = newVote;
        record.approvedAmount = validatedAmount;
        record.reasoning = newReasoning;
        record.lastChangedAt = block.timestamp;

        emit VoteChanged(claimId, msg.sender, oldVote, newVote, oldApprovedAmount, validatedAmount);
    }

    /// @inheritdoc IClaimsManager
    function finalizeClaim(uint256 claimId) external nonReentrant whenNotPaused(ITrustfulPausable.PauseScope.Executions) {
        Claim storage claim = _claims[claimId];
        if (claim.claimId == 0) revert ClaimNotFound(claimId);

        // Must be past voting deadline
        if (block.timestamp <= claim.votingDeadline) {
            revert VotingPeriodNotEnded(claimId);
        }

        // Must be in valid status
        if (claim.status != ClaimStatus.Filed && claim.status != ClaimStatus.EvidenceClosed) {
            revert InvalidClaimStatus(claimId, claim.status, ClaimStatus.EvidenceClosed);
        }

        // Count votes
        VotingProgress memory progress = _getVotingProgress(claimId);

        // Check quorum
        uint256 requiredQuorum = councilRegistry.calculateQuorum(claim.councilId);

        if (progress.totalVotes < requiredQuorum) {
            // Expired - not enough votes
            claim.status = ClaimStatus.Expired;
            _updateStatsOnResolution(claim.agentId, ClaimStatus.Expired);
            emit ClaimExpired(claimId, claim.hadVotes);
        } else if (progress.approveVotes > progress.rejectVotes) {
            // Approved
            claim.status = ClaimStatus.Approved;
            claim.approvedAmount = calculateMedianApprovedAmount(claimId);
            _updateStatsOnResolution(claim.agentId, ClaimStatus.Approved);
            emit ClaimApproved(claimId, claim.approvedAmount);
        } else {
            // Rejected (tie goes to reject)
            claim.status = ClaimStatus.Rejected;
            _updateStatsOnResolution(claim.agentId, ClaimStatus.Rejected);
            emit ClaimRejected(claimId);
        }

        // Notify council registry
        councilRegistry.decrementPendingClaims(claim.councilId);
    }

    /// @inheritdoc IClaimsManager
    function cancelClaim(uint256 claimId) external nonReentrant whenNotPaused(ITrustfulPausable.PauseScope.Claims) {
        Claim storage claim = _claims[claimId];
        if (claim.claimId == 0) revert ClaimNotFound(claimId);
        if (msg.sender != claim.claimant) revert NotClaimant(claimId, msg.sender);

        // Can only cancel before voting starts
        if (block.timestamp > claim.evidenceDeadline) {
            revert CannotCancelAfterVotingStarts(claimId);
        }

        claim.status = ClaimStatus.Cancelled;

        // Unlock collateral
        collateralVault.unlock(claim.agentId, claimId, claim.lockedCollateral);

        // Update stats
        _updateStatsOnResolution(claim.agentId, ClaimStatus.Cancelled);

        // Notify council registry
        councilRegistry.decrementPendingClaims(claim.councilId);

        // Note: Deposit is NOT returned here - it's forfeited to council members
        // RulingExecutor handles distribution

        emit ClaimCancelled(claimId, claim.claimantDeposit);
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /// @inheritdoc IClaimsManager
    function getClaim(uint256 claimId) external view returns (Claim memory) {
        return _claims[claimId];
    }

    /// @inheritdoc IClaimsManager
    function getClaimsByAgent(uint256 agentId) external view returns (uint256[] memory) {
        return _claimsByAgent[agentId];
    }

    /// @inheritdoc IClaimsManager
    function getClaimsByCouncil(bytes32 councilId) external view returns (uint256[] memory) {
        return _claimsByCouncil[councilId];
    }

    /// @inheritdoc IClaimsManager
    function getPendingClaimsByCouncil(bytes32 councilId)
        external
        view
        returns (uint256[] memory)
    {
        uint256[] storage allClaims = _claimsByCouncil[councilId];
        
        // Count pending
        uint256 count = 0;
        for (uint256 i = 0; i < allClaims.length; i++) {
            ClaimStatus status = _claims[allClaims[i]].status;
            if (status == ClaimStatus.Filed || status == ClaimStatus.EvidenceClosed) {
                count++;
            }
        }

        // Build array
        uint256[] memory pending = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < allClaims.length; i++) {
            ClaimStatus status = _claims[allClaims[i]].status;
            if (status == ClaimStatus.Filed || status == ClaimStatus.EvidenceClosed) {
                pending[index++] = allClaims[i];
            }
        }

        return pending;
    }

    /// @inheritdoc IClaimsManager
    function getClaimsByClaimant(address claimant) external view returns (uint256[] memory) {
        return _claimsByClaimant[claimant];
    }

    /// @inheritdoc IClaimsManager
    function getVotingProgress(uint256 claimId) external view returns (VotingProgress memory) {
        return _getVotingProgress(claimId);
    }

    /// @inheritdoc IClaimsManager
    function getVotes(uint256 claimId) external view returns (VoteRecord[] memory) {
        address[] storage voters = _voterList[claimId];
        VoteRecord[] memory records = new VoteRecord[](voters.length);

        for (uint256 i = 0; i < voters.length; i++) {
            records[i] = _votes[claimId][voters[i]];
        }

        return records;
    }

    /// @inheritdoc IClaimsManager
    function getVotersForClaim(uint256 claimId) external view returns (address[] memory) {
        return _voterList[claimId];
    }

    /// @inheritdoc IClaimsManager
    function getVote(uint256 claimId, address voter) external view returns (VoteRecord memory) {
        return _votes[claimId][voter];
    }

    /// @inheritdoc IClaimsManager
    function hasVoted(uint256 claimId, address voter) external view returns (bool) {
        return _votes[claimId][voter].votedAt != 0;
    }

    /// @inheritdoc IClaimsManager
    function getClaimStats(uint256 agentId) external view returns (ClaimStats memory) {
        return _agentStats[agentId];
    }

    /// @inheritdoc IClaimsManager
    function getPendingClaimCount(uint256 agentId) external view returns (uint256) {
        return _agentStats[agentId].pendingClaims;
    }

    /// @inheritdoc IClaimsManager
    function calculateRequiredDeposit(uint256 agentId, uint256 claimedAmount)
        external
        view
        returns (uint256)
    {
        if (!termsRegistry.hasActiveTerms(agentId)) {
            revert NoActiveTerms(agentId);
        }

        bytes32 councilId = termsRegistry.getCouncilForAgent(agentId);
        return councilRegistry.calculateRequiredDeposit(councilId, claimedAmount);
    }

    /// @inheritdoc IClaimsManager
    function nextClaimId() external view returns (uint256) {
        return _nextClaimId;
    }

    /// @inheritdoc IClaimsManager
    function calculateMedianApprovedAmount(uint256 claimId) public view returns (uint256) {
        address[] storage voters = _voterList[claimId];

        // Collect approve votes
        uint256[] memory amounts = new uint256[](voters.length);
        uint256 count = 0;

        for (uint256 i = 0; i < voters.length; i++) {
            VoteRecord storage record = _votes[claimId][voters[i]];
            if (record.vote == Vote.Approve) {
                amounts[count++] = record.approvedAmount;
            }
        }

        if (count == 0) return 0;

        // [v1.3] Sort using insertion sort (cleaner for audits, O(n²) is fine for n<=11)
        for (uint256 i = 1; i < count; i++) {
            uint256 key = amounts[i];
            uint256 j = i;
            while (j > 0 && amounts[j - 1] > key) {
                amounts[j] = amounts[j - 1];
                j--;
            }
            amounts[j] = key;
        }

        // Return median with safe averaging
        if (count % 2 == 1) {
            return amounts[count / 2];
        } else {
            // [v1.3] Safe average calculation to prevent overflow
            uint256 a = amounts[count / 2 - 1];
            uint256 b = amounts[count / 2];
            return a / 2 + b / 2 + (a % 2 + b % 2) / 2;
        }
    }

    /**
     * @notice Get USDC token address
     */
    function usdc() external view returns (address) {
        return address(_USDC);
    }

    // =========================================================================
    // Internal Functions
    // =========================================================================

    function _getVotingProgress(uint256 claimId) internal view returns (VotingProgress memory progress) {
        Claim storage claim = _claims[claimId];
        address[] storage voters = _voterList[claimId];

        for (uint256 i = 0; i < voters.length; i++) {
            Vote v = _votes[claimId][voters[i]].vote;
            if (v == Vote.Approve) progress.approveVotes++;
            else if (v == Vote.Reject) progress.rejectVotes++;
            else if (v == Vote.Abstain) progress.abstainVotes++;
        }

        progress.totalVotes = voters.length;
        progress.requiredQuorum = councilRegistry.calculateQuorum(claim.councilId);
        progress.deadline = claim.votingDeadline;
        progress.quorumReached = progress.totalVotes >= progress.requiredQuorum;
    }

    function _updateStatsOnResolution(uint256 agentId, ClaimStatus status) internal {
        ClaimStats storage stats = _agentStats[agentId];
        
        // [v1.3] Add underflow protection
        if (stats.pendingClaims > 0) {
            stats.pendingClaims--;
        }

        if (status == ClaimStatus.Approved) {
            stats.approvedClaims++;
        } else if (status == ClaimStatus.Rejected) {
            stats.rejectedClaims++;
        } else if (status == ClaimStatus.Expired) {
            stats.expiredClaims++;
        }
        // Cancelled doesn't increment approved/rejected/expired
    }

    function _requireConfigured() internal view {
        if (
            address(collateralVault) == address(0) ||
            address(termsRegistry) == address(0) ||
            address(councilRegistry) == address(0)
        ) {
            revert InvalidConfiguration();
        }
    }

    /**
     * @notice Transfer deposit to RulingExecutor for distribution
     * @param claimId The claim ID
     * @dev Called by RulingExecutor
     * @dev [v1.3] Uses CEI pattern - zeros deposit before transfer
     */
    function transferDepositToExecutor(uint256 claimId) external {
        require(msg.sender == rulingExecutor, "Only RulingExecutor");
        Claim storage claim = _claims[claimId];
        uint256 amount = claim.claimantDeposit;
        if (amount > 0) {
            // [v1.3] CEI: Effects before Interactions
            claim.claimantDeposit = 0;
            _USDC.safeTransfer(rulingExecutor, amount);
        }
    }

    /**
     * @notice Return deposit to claimant (for expired claims with no votes)
     * @param claimId The claim ID
     * @dev Called by RulingExecutor
     * @dev [v1.3] Uses CEI pattern - zeros deposit before transfer
     */
    function returnDepositToClaimant(uint256 claimId) external {
        require(msg.sender == rulingExecutor, "Only RulingExecutor");
        Claim storage claim = _claims[claimId];
        uint256 amount = claim.claimantDeposit;
        address claimant = claim.claimant;
        if (amount > 0) {
            // [v1.3] CEI: Effects before Interactions
            claim.claimantDeposit = 0;
            _USDC.safeTransfer(claimant, amount);
        }
    }

    /**
     * @notice Mark claim as executed
     * @param claimId The claim ID
     * @param paidAmount Amount paid to claimant (for stats)
     * @dev Called by RulingExecutor
     * @dev [v1.3] One-shot execution - reverts if already executed
     */
    function markExecuted(uint256 claimId, uint256 paidAmount) external {
        require(msg.sender == rulingExecutor, "Only RulingExecutor");
        Claim storage claim = _claims[claimId];
        
        // [v1.3] Ensure claim is in a finalized state, not already executed
        if (claim.status == ClaimStatus.Executed) {
            revert ClaimAlreadyExecuted(claimId);
        }
        require(
            claim.status == ClaimStatus.Approved ||
            claim.status == ClaimStatus.Rejected ||
            claim.status == ClaimStatus.Cancelled ||
            claim.status == ClaimStatus.Expired,
            "Claim not finalized"
        );

        claim.status = ClaimStatus.Executed;
        _agentStats[claim.agentId].totalPaidOut += paidAmount;

        emit ClaimExecuted(claimId, paidAmount);
    }
}

// =========================================================================
// External Interfaces
// =========================================================================

interface ICollateralVault {
    function lock(uint256 agentId, uint256 claimId, uint256 amount) external returns (uint256 locked);
    function unlock(uint256 agentId, uint256 claimId, uint256 amount) external;
    function slash(uint256 agentId, uint256 claimId, address recipient, uint256 amount) external;
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
    struct Council {
        bytes32 councilId;
        string name;
        string description;
        string vertical;
        uint256 memberCount;
        uint256 quorumPercentage;
        uint256 claimDepositPercentage;
        uint256 votingPeriod;
        uint256 evidencePeriod;
        bool active;
        uint256 createdAt;
        uint256 closedAt;
    }

    error CouncilNotActive(bytes32 councilId);

    function getCouncil(bytes32 councilId) external view returns (Council memory);
    function councilStatus(bytes32 councilId) external view returns (bool exists, bool active);
    function isActiveMember(bytes32 councilId, address member) external view returns (bool);
    function calculateRequiredDeposit(bytes32 councilId, uint256 claimAmount) external view returns (uint256);
    function calculateQuorum(bytes32 councilId) external view returns (uint256);
    function getAgentCouncil(uint256 agentId) external view returns (bytes32);
    function getActiveMemberCount(bytes32 councilId) external view returns (uint256);
    function incrementPendingClaims(bytes32 councilId) external;
    function decrementPendingClaims(bytes32 councilId) external;
    function incrementMemberVotes(bytes32 councilId, address member) external;
}

interface IERC8004Registry {
    function ownerOf(uint256 tokenId) external view returns (address);
}
