// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ICollateralVault } from "../interfaces/ICollateralVault.sol";
import { ITrustfulPausable } from "../interfaces/ITrustfulPausable.sol";
import { TrustfulPausable } from "../base/TrustfulPausable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CollateralVault
 * @notice Holds USDC collateral per ERC-8004 agent with partial locking for claims
 * @dev Implements withdrawal grace period and claim-based locking
 *
 * Key Design Decisions:
 * - Anyone can deposit for any agent (allows third-party sponsorship)
 * - Only agent owner can withdraw (verified via ERC-8004 registry)
 * - Grace period prevents front-running claims
 * - ClaimsManager can lock collateral for pending claims
 * - RulingExecutor can slash (transfer) collateral to claimants
 */
contract CollateralVault is ICollateralVault, TrustfulPausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =========================================================================
    // Constants
    // =========================================================================

    /// @notice Default grace period for withdrawals (7 days)
    uint256 public constant DEFAULT_GRACE_PERIOD = 7 days;

    // =========================================================================
    // Immutables
    // =========================================================================

    /// @notice The USDC token contract
    IERC20 private immutable _USDC;

    /// @notice The ERC-8004 agent registry
    IERC8004Registry private immutable _REGISTRY;

    /// @notice The withdrawal grace period
    uint256 private immutable _GRACE_PERIOD;

    // =========================================================================
    // State
    // =========================================================================

    /// @notice Collateral accounts per agent
    mapping(uint256 => CollateralAccount) private _accounts;

    /// @notice Authorized caller for lock/unlock operations (ClaimsManager)
    address public claimsManager;

    /// @notice Authorized caller for slash operations (RulingExecutor)
    address public rulingExecutor;

    /// @notice Locked amounts per claim ID
    mapping(uint256 => mapping(uint256 => uint256)) private _lockedByClaim;

    // =========================================================================
    // Errors
    // =========================================================================

    error NotAgentOwner(uint256 agentId, address caller);
    error NotClaimsManager(address caller);
    error NotRulingExecutor(address caller);
    error InsufficientBalance(uint256 available, uint256 requested);
    error InsufficientUnlockedBalance(uint256 available, uint256 requested);
    error NoWithdrawalPending(uint256 agentId);
    error WithdrawalAlreadyPending(uint256 agentId);
    error GracePeriodNotElapsed(uint256 agentId, uint256 executeAfter);
    error ZeroAmount();
    error AgentNotFound(uint256 agentId);
    error NotAuthorized(address caller);

    // =========================================================================
    // Constructor
    // =========================================================================

    /**
     * @notice Initialize the CollateralVault
     * @param usdc_ The USDC token address
     * @param registry_ The ERC-8004 agent registry address
     * @param governance_ The governance multisig address
     * @param gracePeriod_ The withdrawal grace period (use 0 for default 7 days)
     */
    constructor(
        address usdc_,
        address registry_,
        address governance_,
        uint256 gracePeriod_
    ) TrustfulPausable(governance_) {
        if (usdc_ == address(0) || registry_ == address(0)) {
            revert ZeroAddress();
        }
        _USDC = IERC20(usdc_);
        _REGISTRY = IERC8004Registry(registry_);
        _GRACE_PERIOD = gracePeriod_ > 0 ? gracePeriod_ : DEFAULT_GRACE_PERIOD;
    }

    // =========================================================================
    // Admin Functions
    // =========================================================================

    /**
     * @notice Set the ClaimsManager address
     * @param claimsManager_ The new ClaimsManager address
     * @dev Only callable by governance
     */
    function setClaimsManager(address claimsManager_) external onlyGovernance {
        if (claimsManager_ == address(0)) revert ZeroAddress();
        claimsManager = claimsManager_;
    }

    /**
     * @notice Set the RulingExecutor address
     * @param rulingExecutor_ The new RulingExecutor address
     * @dev Only callable by governance
     */
    function setRulingExecutor(address rulingExecutor_) external onlyGovernance {
        if (rulingExecutor_ == address(0)) revert ZeroAddress();
        rulingExecutor = rulingExecutor_;
    }

    // =========================================================================
    // Core Functions
    // =========================================================================

    /// @inheritdoc ICollateralVault
    function deposit(
        uint256 agentId,
        uint256 amount
    ) external nonReentrant whenNotPaused(ITrustfulPausable.PauseScope.Deposits) {
        if (amount == 0) revert ZeroAmount();
        if (!_agentExists(agentId)) revert AgentNotFound(agentId);

        _accounts[agentId].balance += amount;

        _USDC.safeTransferFrom(msg.sender, address(this), amount);

        emit Deposited(agentId, msg.sender, amount);
    }

    /// @inheritdoc ICollateralVault
    function initiateWithdrawal(
        uint256 agentId,
        uint256 amount
    ) external nonReentrant whenNotPaused(ITrustfulPausable.PauseScope.Withdrawals) {
        _requireAgentOwner(agentId);

        CollateralAccount storage account = _accounts[agentId];

        if (account.withdrawalInitiatedAt != 0) {
            revert WithdrawalAlreadyPending(agentId);
        }

        uint256 available = _getAvailable(account);
        if (amount > available) {
            revert InsufficientUnlockedBalance(available, amount);
        }

        account.withdrawalInitiatedAt = block.timestamp;
        account.withdrawalAmount = amount;

        uint256 executeAfter = block.timestamp + _GRACE_PERIOD;
        emit WithdrawalInitiated(agentId, amount, executeAfter);
    }

    /// @inheritdoc ICollateralVault
    function cancelWithdrawal(uint256 agentId) external nonReentrant {
        _requireAgentOwner(agentId);

        CollateralAccount storage account = _accounts[agentId];

        if (account.withdrawalInitiatedAt == 0) {
            revert NoWithdrawalPending(agentId);
        }

        account.withdrawalInitiatedAt = 0;
        account.withdrawalAmount = 0;

        emit WithdrawalCancelled(agentId);
    }

    /// @inheritdoc ICollateralVault
    function executeWithdrawal(
        uint256 agentId
    ) external nonReentrant whenNotPaused(ITrustfulPausable.PauseScope.Withdrawals) {
        _requireAgentOwner(agentId);

        CollateralAccount storage account = _accounts[agentId];

        if (account.withdrawalInitiatedAt == 0) {
            revert NoWithdrawalPending(agentId);
        }

        uint256 executeAfter = account.withdrawalInitiatedAt + _GRACE_PERIOD;
        if (block.timestamp < executeAfter) {
            revert GracePeriodNotElapsed(agentId, executeAfter);
        }

        uint256 amount = account.withdrawalAmount;
        uint256 available = _getAvailable(account);

        // Handle case where balance was reduced (e.g., slashed) during grace period
        if (amount > available) {
            amount = available;
        }

        if (amount == 0) {
            revert InsufficientUnlockedBalance(0, account.withdrawalAmount);
        }

        // Clear withdrawal state
        account.withdrawalInitiatedAt = 0;
        account.withdrawalAmount = 0;
        
        // [v1.3] Add underflow protection (defensive - should never trigger)
        if (account.balance >= amount) {
            account.balance -= amount;
        } else {
            // This shouldn't happen, but cap withdrawal to actual balance
            amount = account.balance;
            account.balance = 0;
        }

        address recipient = _getAgentOwner(agentId);
        _USDC.safeTransfer(recipient, amount);

        emit WithdrawalExecuted(agentId, recipient, amount);
    }

    // =========================================================================
    // Claim Locking Functions
    // =========================================================================

    /// @inheritdoc ICollateralVault
    function lock(
        uint256 agentId,
        uint256 claimId,
        uint256 amount
    ) external nonReentrant returns (uint256 actualLocked) {
        if (msg.sender != claimsManager) revert NotClaimsManager(msg.sender);
        if (amount == 0) revert ZeroAmount();

        CollateralAccount storage account = _accounts[agentId];
        uint256 available = _getAvailable(account);

        // Lock what's available, up to requested amount
        actualLocked = amount > available ? available : amount;

        if (actualLocked > 0) {
            account.lockedAmount += actualLocked;
            _lockedByClaim[agentId][claimId] = actualLocked;

            emit CollateralLocked(agentId, claimId, actualLocked);
        }
    }

    /// @inheritdoc ICollateralVault
    function unlock(
        uint256 agentId,
        uint256 claimId,
        uint256 amount
    ) external nonReentrant {
        if (msg.sender != claimsManager && msg.sender != rulingExecutor) {
            revert NotAuthorized(msg.sender);
        }

        CollateralAccount storage account = _accounts[agentId];
        uint256 lockedForClaim = _lockedByClaim[agentId][claimId];

        // Unlock up to what was locked for this claim
        uint256 actualUnlock = amount > lockedForClaim ? lockedForClaim : amount;

        if (actualUnlock > 0) {
            // [v1.3] Add underflow protection
            if (account.lockedAmount >= actualUnlock) {
                account.lockedAmount -= actualUnlock;
            } else {
                account.lockedAmount = 0;
            }
            
            // [v1.3] Add underflow protection for per-claim tracking
            if (_lockedByClaim[agentId][claimId] >= actualUnlock) {
                _lockedByClaim[agentId][claimId] -= actualUnlock;
            } else {
                _lockedByClaim[agentId][claimId] = 0;
            }

            emit CollateralUnlocked(agentId, claimId, actualUnlock);
        }
    }

    /// @inheritdoc ICollateralVault
    function slash(
        uint256 agentId,
        uint256 claimId,
        address recipient,
        uint256 amount
    ) external nonReentrant whenNotPaused(ITrustfulPausable.PauseScope.Executions) {
        if (msg.sender != rulingExecutor) revert NotRulingExecutor(msg.sender);
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        CollateralAccount storage account = _accounts[agentId];
        uint256 lockedForClaim = _lockedByClaim[agentId][claimId];

        // Slash from locked amount for this claim
        uint256 actualSlash = amount > lockedForClaim ? lockedForClaim : amount;

        if (actualSlash > 0) {
            // [v1.3] Add underflow protection for all decrements
            if (account.lockedAmount >= actualSlash) {
                account.lockedAmount -= actualSlash;
            } else {
                account.lockedAmount = 0;
            }
            
            if (account.balance >= actualSlash) {
                account.balance -= actualSlash;
            } else {
                // This shouldn't happen, but protect against it
                actualSlash = account.balance;
                account.balance = 0;
            }
            
            // [v1.3] Add underflow protection for per-claim tracking
            if (_lockedByClaim[agentId][claimId] >= actualSlash) {
                _lockedByClaim[agentId][claimId] -= actualSlash;
            } else {
                _lockedByClaim[agentId][claimId] = 0;
            }

            _USDC.safeTransfer(recipient, actualSlash);

            emit CollateralSlashed(agentId, claimId, recipient, actualSlash);
        }
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /// @inheritdoc ICollateralVault
    function getAccount(uint256 agentId) external view returns (CollateralAccount memory account) {
        return _accounts[agentId];
    }

    /// @inheritdoc ICollateralVault
    function getAvailableBalance(uint256 agentId) external view returns (uint256 available) {
        return _getAvailable(_accounts[agentId]);
    }

    /// @inheritdoc ICollateralVault
    function canExecuteWithdrawal(uint256 agentId) external view returns (bool canExecute) {
        CollateralAccount storage account = _accounts[agentId];

        if (account.withdrawalInitiatedAt == 0) {
            return false;
        }

        uint256 executeAfter = account.withdrawalInitiatedAt + _GRACE_PERIOD;
        return block.timestamp >= executeAfter;
    }

    /// @inheritdoc ICollateralVault
    function usdcToken() external view returns (address usdc) {
        return address(_USDC);
    }

    /// @inheritdoc ICollateralVault
    function gracePeriod() external view returns (uint256 period) {
        return _GRACE_PERIOD;
    }

    /// @inheritdoc ICollateralVault
    function agentRegistry() external view returns (address registry) {
        return address(_REGISTRY);
    }

    /**
     * @notice Get the amount locked for a specific claim
     * @param agentId The ERC-8004 token ID
     * @param claimId The claim ID
     * @return locked The locked amount
     */
    function getLockedForClaim(
        uint256 agentId,
        uint256 claimId
    ) external view returns (uint256 locked) {
        return _lockedByClaim[agentId][claimId];
    }

    // =========================================================================
    // Internal Functions
    // =========================================================================

    /**
     * @notice Calculate available (unlocked) balance
     * @param account The collateral account
     * @return available The available balance
     */
    function _getAvailable(CollateralAccount storage account) internal view returns (uint256) {
        if (account.balance <= account.lockedAmount) {
            return 0;
        }
        return account.balance - account.lockedAmount;
    }

    /**
     * @notice Require caller is the agent owner
     * @param agentId The ERC-8004 token ID
     */
    function _requireAgentOwner(uint256 agentId) internal view {
        address owner = _getAgentOwner(agentId);
        if (msg.sender != owner) {
            revert NotAgentOwner(agentId, msg.sender);
        }
    }

    /**
     * @notice Get the owner of an agent
     * @param agentId The ERC-8004 token ID
     * @return owner The owner address
     */
    function _getAgentOwner(uint256 agentId) internal view returns (address) {
        return _REGISTRY.ownerOf(agentId);
    }

    /**
     * @notice Check if an agent exists
     * @param agentId The ERC-8004 token ID
     * @return exists True if the agent exists
     */
    function _agentExists(uint256 agentId) internal view returns (bool) {
        try _REGISTRY.ownerOf(agentId) returns (address owner) {
            return owner != address(0);
        } catch {
            return false;
        }
    }
}

// =========================================================================
// External Interface (minimal ERC-8004 Registry interface)
// =========================================================================

/**
 * @title IERC8004Registry
 * @notice Minimal interface for ERC-8004 Agent Registry (ERC-721 compatible)
 */
interface IERC8004Registry {
    /// @notice Returns the owner of the specified token ID
    function ownerOf(uint256 tokenId) external view returns (address owner);
}
