// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ICollateralVault
 * @notice Holds USDC collateral per ERC-8004 agent with partial locking for claims
 * @dev Implements withdrawal grace period and claim-based locking
 */
interface ICollateralVault {
    // =========================================================================
    // Structs
    // =========================================================================

    struct CollateralAccount {
        uint256 balance;              // Total USDC deposited
        uint256 lockedAmount;         // Amount locked by pending claims
        uint256 withdrawalInitiatedAt; // Timestamp when withdrawal was initiated (0 if none)
        uint256 withdrawalAmount;     // Amount requested for withdrawal
    }

    // =========================================================================
    // Events
    // =========================================================================

    event Deposited(uint256 indexed agentId, address indexed depositor, uint256 amount);
    event WithdrawalInitiated(uint256 indexed agentId, uint256 amount, uint256 executeAfter);
    event WithdrawalCancelled(uint256 indexed agentId);
    event WithdrawalExecuted(uint256 indexed agentId, address indexed recipient, uint256 amount);
    event CollateralLocked(uint256 indexed agentId, uint256 claimId, uint256 amount);
    event CollateralUnlocked(uint256 indexed agentId, uint256 claimId, uint256 amount);
    event CollateralSlashed(uint256 indexed agentId, uint256 claimId, address indexed recipient, uint256 amount);

    // =========================================================================
    // Core Functions
    // =========================================================================

    /**
     * @notice Deposit USDC collateral for an agent
     * @param agentId The ERC-8004 token ID of the agent
     * @param amount The amount of USDC to deposit (6 decimals)
     * @dev Anyone can deposit; only owner can withdraw
     * @dev Requires prior USDC approval
     */
    function deposit(uint256 agentId, uint256 amount) external;

    /**
     * @notice Initiate withdrawal with grace period
     * @param agentId The ERC-8004 token ID of the agent
     * @param amount The amount to withdraw
     * @dev Only agent owner can call
     * @dev Starts grace period countdown
     */
    function initiateWithdrawal(uint256 agentId, uint256 amount) external;

    /**
     * @notice Cancel a pending withdrawal
     * @param agentId The ERC-8004 token ID of the agent
     * @dev Only agent owner can call
     */
    function cancelWithdrawal(uint256 agentId) external;

    /**
     * @notice Execute withdrawal after grace period
     * @param agentId The ERC-8004 token ID of the agent
     * @dev Only agent owner can call
     * @dev Reverts if grace period not elapsed or insufficient unlocked balance
     */
    function executeWithdrawal(uint256 agentId) external;

    // =========================================================================
    // Claim Locking Functions (called by ClaimsManager)
    // =========================================================================

    /**
     * @notice Lock collateral for a pending claim
     * @param agentId The ERC-8004 token ID
     * @param claimId The claim ID
     * @param amount The amount to lock
     * @return actualLocked The actual amount locked (may be less if insufficient)
     * @dev Only callable by ClaimsManager
     */
    function lock(uint256 agentId, uint256 claimId, uint256 amount) external returns (uint256 actualLocked);

    /**
     * @notice Unlock collateral when claim is rejected
     * @param agentId The ERC-8004 token ID
     * @param claimId The claim ID
     * @param amount The amount to unlock
     * @dev Only callable by ClaimsManager/RulingExecutor
     */
    function unlock(uint256 agentId, uint256 claimId, uint256 amount) external;

    /**
     * @notice Transfer collateral to claimant (slash)
     * @param agentId The ERC-8004 token ID
     * @param claimId The claim ID
     * @param recipient The address to receive compensation
     * @param amount The amount to transfer
     * @dev Only callable by RulingExecutor
     */
    function slash(uint256 agentId, uint256 claimId, address recipient, uint256 amount) external;

    // =========================================================================
    // View Functions
    // =========================================================================

    /**
     * @notice Get collateral account details for an agent
     * @param agentId The ERC-8004 token ID
     * @return account The collateral account struct
     */
    function getAccount(uint256 agentId) external view returns (CollateralAccount memory account);

    /**
     * @notice Get available (unlocked) balance for an agent
     * @param agentId The ERC-8004 token ID
     * @return available The unlocked balance
     */
    function getAvailableBalance(uint256 agentId) external view returns (uint256 available);

    /**
     * @notice Check if withdrawal grace period has elapsed
     * @param agentId The ERC-8004 token ID
     * @return canExecute True if withdrawal can be executed
     */
    function canExecuteWithdrawal(uint256 agentId) external view returns (bool canExecute);

    /**
     * @notice Get the USDC token address
     * @return usdc The USDC contract address
     */
    function usdcToken() external view returns (address usdc);

    /**
     * @notice Get the withdrawal grace period
     * @return period The grace period in seconds
     */
    function gracePeriod() external view returns (uint256 period);

    /**
     * @notice Get the ERC-8004 registry address
     * @return registry The registry contract address
     */
    function agentRegistry() external view returns (address registry);
}
