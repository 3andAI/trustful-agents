// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IRulingExecutor } from "../interfaces/IRulingExecutor.sol";
import { TrustfulPausable } from "../base/TrustfulPausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title RulingExecutor
 * @notice Executes claim rulings and distributes deposits to voting council members
 * @dev Coordinates between ClaimsManager and CollateralVault
 *
 * Distribution Rules (v1.2):
 * - Claimant deposits ALWAYS go to voting council members
 * - ONLY EXCEPTION: Expired claims with ZERO votes → deposit returned to claimant
 * - This eliminates council bias (no incentive to approve or reject)
 * - Only members who actually voted receive a share
 */
contract RulingExecutor is IRulingExecutor, TrustfulPausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =========================================================================
    // State
    // =========================================================================

    /// @notice USDC token
    IERC20 private immutable _USDC;

    /// @notice ClaimsManager contract
    IClaimsManager public claimsManager;

    /// @notice CollateralVault contract
    ICollateralVault public collateralVault;

    /// @notice CouncilRegistry contract
    ICouncilRegistry public councilRegistry;

    /// @notice Track executed claims
    mapping(uint256 => bool) private _executed;

    // =========================================================================
    // Errors
    // =========================================================================

    error InvalidConfiguration();

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor(
        address usdc_,
        address governance_
    ) TrustfulPausable(governance_) {
        if (usdc_ == address(0)) revert ZeroAddress();
        _USDC = IERC20(usdc_);
    }

    // =========================================================================
    // Admin Configuration
    // =========================================================================

    function setClaimsManager(address manager_) external onlyGovernance {
        if (manager_ == address(0)) revert ZeroAddress();
        claimsManager = IClaimsManager(manager_);
    }

    function setCollateralVault(address vault_) external onlyGovernance {
        if (vault_ == address(0)) revert ZeroAddress();
        collateralVault = ICollateralVault(vault_);
    }

    function setCouncilRegistry(address registry_) external onlyGovernance {
        if (registry_ == address(0)) revert ZeroAddress();
        councilRegistry = ICouncilRegistry(registry_);
    }

    // =========================================================================
    // Core Functions
    // =========================================================================

    /// @inheritdoc IRulingExecutor
    function executeApprovedClaim(uint256 claimId) external nonReentrant {
        _requireConfigured();
        
        IClaimsManager.Claim memory claim = claimsManager.getClaim(claimId);
        
        if (claim.claimId == 0) revert ClaimNotFound(claimId);
        if (claim.status != IClaimsManager.ClaimStatus.Approved) {
            revert ClaimNotFinalized(claimId);
        }
        if (_executed[claimId]) revert ClaimAlreadyExecuted(claimId);

        _executed[claimId] = true;

        // Calculate effective payout
        uint256 payout = claim.approvedAmount;
        if (payout > claim.lockedCollateral) {
            payout = claim.lockedCollateral;
        }

        // Slash collateral to claimant
        if (payout > 0) {
            collateralVault.slash(claim.agentId, claimId, claim.claimant, payout);
        }

        // Unlock any remaining locked collateral
        if (claim.lockedCollateral > payout) {
            collateralVault.unlock(claim.agentId, claimId, claim.lockedCollateral - payout);
        }

        // Distribute deposit to voters
        _distributeDeposit(claimId, claim);

        // Mark as executed
        claimsManager.markExecuted(claimId, payout);

        emit ClaimExecuted(claimId, claim.agentId, claim.claimant, payout, 0);
    }

    /// @inheritdoc IRulingExecutor
    function executeRejectedClaim(uint256 claimId) external nonReentrant {
        _requireConfigured();

        IClaimsManager.Claim memory claim = claimsManager.getClaim(claimId);

        if (claim.claimId == 0) revert ClaimNotFound(claimId);
        if (claim.status != IClaimsManager.ClaimStatus.Rejected) {
            revert ClaimNotFinalized(claimId);
        }
        if (_executed[claimId]) revert ClaimAlreadyExecuted(claimId);

        _executed[claimId] = true;

        // Unlock all collateral (no transfer)
        collateralVault.unlock(claim.agentId, claimId, claim.lockedCollateral);

        // Distribute deposit to voters
        _distributeDeposit(claimId, claim);

        // Mark as executed
        claimsManager.markExecuted(claimId, 0);

        emit CollateralUnlocked(claimId, claim.agentId, claim.lockedCollateral);
    }

    /// @inheritdoc IRulingExecutor
    function executeCancelledClaim(uint256 claimId) external nonReentrant {
        _requireConfigured();

        IClaimsManager.Claim memory claim = claimsManager.getClaim(claimId);

        if (claim.claimId == 0) revert ClaimNotFound(claimId);
        if (claim.status != IClaimsManager.ClaimStatus.Cancelled) {
            revert ClaimNotFinalized(claimId);
        }
        if (_executed[claimId]) revert ClaimAlreadyExecuted(claimId);

        _executed[claimId] = true;

        // Collateral already unlocked in cancelClaim()
        // Distribute deposit to council members (even though no votes)
        _distributeDepositToAllMembers(claimId, claim);

        // Mark as executed
        claimsManager.markExecuted(claimId, 0);
    }

    /// @inheritdoc IRulingExecutor
    function executeExpiredClaim(uint256 claimId) external nonReentrant {
        _requireConfigured();

        IClaimsManager.Claim memory claim = claimsManager.getClaim(claimId);

        if (claim.claimId == 0) revert ClaimNotFound(claimId);
        if (claim.status != IClaimsManager.ClaimStatus.Expired) {
            revert ClaimNotFinalized(claimId);
        }
        if (_executed[claimId]) revert ClaimAlreadyExecuted(claimId);

        _executed[claimId] = true;

        // Unlock all collateral
        collateralVault.unlock(claim.agentId, claimId, claim.lockedCollateral);

        // Special handling: if no votes, return deposit to claimant
        if (!claim.hadVotes) {
            claimsManager.returnDepositToClaimant(claimId);
            emit DepositReturned(claimId, claim.claimant, claim.claimantDeposit, "Expired with no votes");
        } else {
            // Had votes but didn't reach quorum - distribute to voters
            _distributeDeposit(claimId, claim);
        }

        // Mark as executed
        claimsManager.markExecuted(claimId, 0);

        emit CollateralUnlocked(claimId, claim.agentId, claim.lockedCollateral);
    }

    /// @inheritdoc IRulingExecutor
    function executeClaim(uint256 claimId) external whenNotPaused(PauseScope.Executions) {
        IClaimsManager.Claim memory claim = claimsManager.getClaim(claimId);

        if (claim.status == IClaimsManager.ClaimStatus.Approved) {
            this.executeApprovedClaim(claimId);
        } else if (claim.status == IClaimsManager.ClaimStatus.Rejected) {
            this.executeRejectedClaim(claimId);
        } else if (claim.status == IClaimsManager.ClaimStatus.Cancelled) {
            this.executeCancelledClaim(claimId);
        } else if (claim.status == IClaimsManager.ClaimStatus.Expired) {
            this.executeExpiredClaim(claimId);
        } else {
            revert ClaimNotFinalized(claimId);
        }
    }

    /// @inheritdoc IRulingExecutor
    function batchExecute(uint256[] calldata claimIds) external {
        for (uint256 i = 0; i < claimIds.length; i++) {
            try this.executeClaim(claimIds[i]) {} catch {}
        }
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /// @inheritdoc IRulingExecutor
    function canExecute(uint256 claimId)
        external
        view
        returns (bool canExec, string memory reason)
    {
        IClaimsManager.Claim memory claim = claimsManager.getClaim(claimId);

        if (claim.claimId == 0) {
            return (false, "Claim not found");
        }
        if (_executed[claimId]) {
            return (false, "Already executed");
        }
        if (
            claim.status != IClaimsManager.ClaimStatus.Approved &&
            claim.status != IClaimsManager.ClaimStatus.Rejected &&
            claim.status != IClaimsManager.ClaimStatus.Cancelled &&
            claim.status != IClaimsManager.ClaimStatus.Expired
        ) {
            return (false, "Claim not finalized");
        }

        return (true, "");
    }

    /// @inheritdoc IRulingExecutor
    function previewExecution(uint256 claimId)
        external
        view
        returns (ExecutionResult memory result)
    {
        IClaimsManager.Claim memory claim = claimsManager.getClaim(claimId);
        address[] memory voters = claimsManager.getVotersForClaim(claimId);

        result.claimId = claimId;
        result.agentId = claim.agentId;
        result.claimant = claim.claimant;
        result.depositAmount = claim.claimantDeposit;
        result.voterCount = voters.length;

        if (claim.status == IClaimsManager.ClaimStatus.Approved) {
            result.approvedAmount = claim.approvedAmount;
            result.effectivePayout = claim.approvedAmount > claim.lockedCollateral
                ? claim.lockedCollateral
                : claim.approvedAmount;
            result.claimantReceives = result.effectivePayout;
        }

        if (voters.length > 0) {
            result.depositPerVoter = claim.claimantDeposit / voters.length;
        }
    }

    /// @inheritdoc IRulingExecutor
    function previewDepositDistribution(uint256 claimId)
        external
        view
        returns (DepositDistribution memory distribution)
    {
        IClaimsManager.Claim memory claim = claimsManager.getClaim(claimId);
        address[] memory voters = claimsManager.getVotersForClaim(claimId);

        distribution.recipients = voters;
        distribution.totalDistributed = claim.claimantDeposit;

        if (voters.length > 0) {
            distribution.amountPerRecipient = claim.claimantDeposit / voters.length;
            distribution.remainder = claim.claimantDeposit % voters.length;
        }
    }

    /// @inheritdoc IRulingExecutor
    function calculateEffectivePayout(uint256 claimId)
        external
        view
        returns (uint256 effectivePayout, string memory cappedBy)
    {
        IClaimsManager.Claim memory claim = claimsManager.getClaim(claimId);

        if (claim.status != IClaimsManager.ClaimStatus.Approved) {
            return (0, "not_approved");
        }

        effectivePayout = claim.approvedAmount;
        cappedBy = "none";

        if (claim.lockedCollateral < effectivePayout) {
            effectivePayout = claim.lockedCollateral;
            cappedBy = "locked";
        }
    }

    /// @inheritdoc IRulingExecutor
    function getExecutableClaims() external view returns (uint256[] memory) {
        // This would need to iterate all claims - expensive
        // In practice, use events or subgraph for this
        revert("Use subgraph");
    }

    /// @inheritdoc IRulingExecutor
    function getExecutableClaimsByCouncil(bytes32) external view returns (uint256[] memory) {
        revert("Use subgraph");
    }

    /// @inheritdoc IRulingExecutor
    function willDepositBeReturned(uint256 claimId) external view returns (bool) {
        IClaimsManager.Claim memory claim = claimsManager.getClaim(claimId);
        return claim.status == IClaimsManager.ClaimStatus.Expired && !claim.hadVotes;
    }

    // =========================================================================
    // Internal Functions
    // =========================================================================

    /**
     * @notice Distribute deposit to voters only
     */
    function _distributeDeposit(uint256 claimId, IClaimsManager.Claim memory claim) internal {
        address[] memory voters = claimsManager.getVotersForClaim(claimId);

        if (voters.length == 0) {
            // No voters - shouldn't happen for approved/rejected claims
            // Return to claimant as fallback
            claimsManager.returnDepositToClaimant(claimId);
            emit DepositReturned(claimId, claim.claimant, claim.claimantDeposit, "No voters");
            return;
        }

        // Transfer deposit from ClaimsManager to this contract
        claimsManager.transferDepositToExecutor(claimId);

        // Distribute equally
        uint256 perVoter = claim.claimantDeposit / voters.length;
        uint256 remainder = claim.claimantDeposit % voters.length;

        for (uint256 i = 0; i < voters.length; i++) {
            uint256 amount = perVoter;
            if (i == 0) {
                amount += remainder; // First voter gets dust
            }
            _USDC.safeTransfer(voters[i], amount);
        }

        emit DepositDistributed(claimId, voters.length, claim.claimantDeposit, perVoter);
    }

    /**
     * @notice Distribute deposit to all council members (for cancelled claims)
     */
    function _distributeDepositToAllMembers(uint256 claimId, IClaimsManager.Claim memory claim) internal {
        address[] memory members = councilRegistry.getCouncilMembers(claim.councilId);

        if (members.length == 0) {
            // No members - return to claimant
            claimsManager.returnDepositToClaimant(claimId);
            emit DepositReturned(claimId, claim.claimant, claim.claimantDeposit, "No council members");
            return;
        }

        // Transfer deposit from ClaimsManager
        claimsManager.transferDepositToExecutor(claimId);

        // Distribute equally to all members
        uint256 perMember = claim.claimantDeposit / members.length;
        uint256 remainder = claim.claimantDeposit % members.length;

        for (uint256 i = 0; i < members.length; i++) {
            uint256 amount = perMember;
            if (i == 0) {
                amount += remainder;
            }
            _USDC.safeTransfer(members[i], amount);
        }

        emit DepositDistributed(claimId, members.length, claim.claimantDeposit, perMember);
    }

    function _requireConfigured() internal view {
        if (
            address(claimsManager) == address(0) ||
            address(collateralVault) == address(0) ||
            address(councilRegistry) == address(0)
        ) {
            revert InvalidConfiguration();
        }
    }
}

// =========================================================================
// External Interfaces
// =========================================================================

interface IClaimsManager {
    enum ClaimStatus {
        Filed,
        EvidenceClosed,
        VotingClosed,
        Approved,
        Rejected,
        Executed,
        Cancelled,
        Expired
    }

    struct Claim {
        uint256 claimId;
        uint256 agentId;
        address claimant;
        uint256 claimedAmount;
        uint256 approvedAmount;
        bytes32 evidenceHash;
        string evidenceUri;
        bytes32 paymentReceiptHash;
        bytes32 termsHashAtClaimTime;
        uint256 termsVersionAtClaimTime;
        address providerAtClaimTime;
        bytes32 councilId;
        uint256 claimantDeposit;
        uint256 lockedCollateral;
        ClaimStatus status;
        uint256 filedAt;
        uint256 evidenceDeadline;
        uint256 votingDeadline;
        bool hadVotes;
    }

    function getClaim(uint256 claimId) external view returns (Claim memory);
    function getVotersForClaim(uint256 claimId) external view returns (address[] memory);
    function transferDepositToExecutor(uint256 claimId) external;
    function returnDepositToClaimant(uint256 claimId) external;
    function markExecuted(uint256 claimId, uint256 paidAmount) external;
}

interface ICollateralVault {
    function unlock(uint256 agentId, uint256 claimId, uint256 amount) external;
    function slash(uint256 agentId, uint256 claimId, address recipient, uint256 amount) external;
}

interface ICouncilRegistry {
    function getCouncilMembers(bytes32 councilId) external view returns (address[] memory);
}
