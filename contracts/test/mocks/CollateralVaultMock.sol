// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "forge-std/interfaces/IERC20.sol";

/**
 * @title CollateralVaultMock
 * @notice Mock CollateralVault for testing ClaimsManager and RulingExecutor
 */
contract CollateralVaultMock {
    // =========================================================================
    // State
    // =========================================================================

    IERC20 public usdc;
    
    mapping(uint256 => uint256) private _deposits;
    mapping(uint256 => uint256) private _lockedAmounts;
    mapping(uint256 => mapping(uint256 => uint256)) private _claimLocks; // agentId => claimId => amount

    // Track calls for testing
    uint256 public lockCallCount;
    uint256 public unlockCallCount;
    uint256 public slashCallCount;
    
    uint256 public lastLockAgentId;
    uint256 public lastLockClaimId;
    uint256 public lastLockAmount;

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    // =========================================================================
    // Setup Functions
    // =========================================================================

    /**
     * @notice Set agent deposit balance
     */
    function setDeposit(uint256 agentId, uint256 amount) external {
        _deposits[agentId] = amount;
    }

    /**
     * @notice Set agent locked amount
     */
    function setLockedAmount(uint256 agentId, uint256 amount) external {
        _lockedAmounts[agentId] = amount;
    }

    // =========================================================================
    // Mock Functions (matches ICollateralVault interface)
    // =========================================================================

    /**
     * @notice Lock collateral for a claim
     */
    function lock(uint256 agentId, uint256 claimId, uint256 amount) external returns (bool) {
        lockCallCount++;
        lastLockAgentId = agentId;
        lastLockClaimId = claimId;
        lastLockAmount = amount;
        
        _claimLocks[agentId][claimId] = amount;
        _lockedAmounts[agentId] += amount;
        return true;
    }

    /**
     * @notice Unlock collateral from a claim
     */
    function unlock(uint256 agentId, uint256 claimId, uint256 amount) external returns (bool) {
        unlockCallCount++;
        
        uint256 locked = _claimLocks[agentId][claimId];
        if (amount > locked) amount = locked;
        
        _claimLocks[agentId][claimId] -= amount;
        _lockedAmounts[agentId] -= amount;
        return true;
    }

    /**
     * @notice Slash collateral and transfer to recipient
     */
    function slash(uint256 agentId, uint256 claimId, address recipient, uint256 amount) external returns (bool) {
        slashCallCount++;
        
        // Use claim lock if set, otherwise use deposit directly (for simpler testing)
        uint256 locked = _claimLocks[agentId][claimId];
        if (locked == 0) {
            locked = _deposits[agentId];
        }
        if (amount > locked) amount = locked;
        
        if (_claimLocks[agentId][claimId] > 0) {
            _claimLocks[agentId][claimId] -= amount;
            _lockedAmounts[agentId] -= amount;
        }
        _deposits[agentId] -= amount;
        
        // Transfer USDC to recipient
        usdc.transfer(recipient, amount);
        return true;
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /**
     * @notice Get agent deposit
     */
    function getDeposit(uint256 agentId) external view returns (uint256) {
        return _deposits[agentId];
    }

    /**
     * @notice Get available (unlocked) collateral
     */
    function getAvailableCollateral(uint256 agentId) external view returns (uint256) {
        return _deposits[agentId] - _lockedAmounts[agentId];
    }

    /**
     * @notice Get total locked amount for agent
     */
    function getLockedAmount(uint256 agentId) external view returns (uint256) {
        return _lockedAmounts[agentId];
    }

    /**
     * @notice Get locked amount for specific claim
     */
    function getClaimLock(uint256 agentId, uint256 claimId) external view returns (uint256) {
        return _claimLocks[agentId][claimId];
    }

    /**
     * @notice Get USDC token address
     */
    function usdcToken() external view returns (address) {
        return address(usdc);
    }
}
