// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { CollateralVault } from "../src/core/CollateralVault.sol";
import { ICollateralVault } from "../src/interfaces/ICollateralVault.sol";
import { ITrustfulPausable } from "../src/interfaces/ITrustfulPausable.sol";
import { TrustfulPausable } from "../src/base/TrustfulPausable.sol";
import { ERC20Mock } from "./mocks/ERC20Mock.sol";
import { ERC8004RegistryMock } from "./mocks/ERC8004RegistryMock.sol";

/**
 * @title CollateralVaultTest
 * @notice Comprehensive tests for CollateralVault contract
 */
contract CollateralVaultTest is Test {
    // =========================================================================
    // Test Setup
    // =========================================================================

    CollateralVault public vault;
    ERC20Mock public usdc;
    ERC8004RegistryMock public registry;

    address public governance = makeAddr("governance");
    address public claimsManager = makeAddr("claimsManager");
    address public rulingExecutor = makeAddr("rulingExecutor");
    address public provider = makeAddr("provider");
    address public depositor = makeAddr("depositor");
    address public claimant = makeAddr("claimant");

    uint256 public constant AGENT_ID = 1;
    uint256 public constant GRACE_PERIOD = 7 days;
    uint256 public constant INITIAL_DEPOSIT = 10_000e6; // 10,000 USDC

    function setUp() public {
        // Deploy mocks
        usdc = new ERC20Mock("USD Coin", "USDC", 6);
        registry = new ERC8004RegistryMock();

        // Deploy vault
        vault = new CollateralVault(
            address(usdc),
            address(registry),
            governance,
            GRACE_PERIOD
        );

        // Setup roles
        vm.startPrank(governance);
        vault.setClaimsManager(claimsManager);
        vault.setRulingExecutor(rulingExecutor);
        vm.stopPrank();

        // Register agent
        registry.mint(provider, AGENT_ID);

        // Fund accounts
        usdc.mint(provider, 100_000e6);
        usdc.mint(depositor, 100_000e6);
        usdc.mint(claimant, 100_000e6);

        // Approve vault
        vm.prank(provider);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(depositor);
        usdc.approve(address(vault), type(uint256).max);
    }

    // =========================================================================
    // Constructor Tests
    // =========================================================================

    function test_Constructor_SetsCorrectValues() public view {
        assertEq(vault.usdcToken(), address(usdc));
        assertEq(vault.agentRegistry(), address(registry));
        assertEq(vault.gracePeriod(), GRACE_PERIOD);
        assertEq(vault.governance(), governance);
    }

    function test_Constructor_DefaultGracePeriod() public {
        CollateralVault defaultVault = new CollateralVault(
            address(usdc),
            address(registry),
            governance,
            0 // Use default
        );
        assertEq(defaultVault.gracePeriod(), 7 days);
    }

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert();
        new CollateralVault(address(0), address(registry), governance, GRACE_PERIOD);

        vm.expectRevert();
        new CollateralVault(address(usdc), address(0), governance, GRACE_PERIOD);

        vm.expectRevert();
        new CollateralVault(address(usdc), address(registry), address(0), GRACE_PERIOD);
    }

    // =========================================================================
    // Deposit Tests
    // =========================================================================

    function test_Deposit_Success() public {
        vm.prank(provider);
        vault.deposit(AGENT_ID, INITIAL_DEPOSIT);

        ICollateralVault.CollateralAccount memory account = vault.getAccount(AGENT_ID);
        assertEq(account.balance, INITIAL_DEPOSIT);
        assertEq(account.lockedAmount, 0);
        assertEq(usdc.balanceOf(address(vault)), INITIAL_DEPOSIT);
    }

    function test_Deposit_EmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit ICollateralVault.Deposited(AGENT_ID, provider, INITIAL_DEPOSIT);

        vm.prank(provider);
        vault.deposit(AGENT_ID, INITIAL_DEPOSIT);
    }

    function test_Deposit_AnyoneCanDeposit() public {
        vm.prank(depositor);
        vault.deposit(AGENT_ID, INITIAL_DEPOSIT);

        assertEq(vault.getAvailableBalance(AGENT_ID), INITIAL_DEPOSIT);
    }

    function test_Deposit_MultipleDeposits() public {
        vm.prank(provider);
        vault.deposit(AGENT_ID, INITIAL_DEPOSIT);

        vm.prank(depositor);
        vault.deposit(AGENT_ID, INITIAL_DEPOSIT);

        assertEq(vault.getAvailableBalance(AGENT_ID), INITIAL_DEPOSIT * 2);
    }

    function test_Deposit_RevertsOnZeroAmount() public {
        vm.prank(provider);
        vm.expectRevert(CollateralVault.ZeroAmount.selector);
        vault.deposit(AGENT_ID, 0);
    }

    function test_Deposit_RevertsOnNonexistentAgent() public {
        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSelector(CollateralVault.AgentNotFound.selector, 999));
        vault.deposit(999, INITIAL_DEPOSIT);
    }

    function test_Deposit_RevertsWhenPaused() public {
        vm.prank(governance);
        vault.pause(ITrustfulPausable.PauseScope.Deposits, "test");

        vm.prank(provider);
        vm.expectRevert();
        vault.deposit(AGENT_ID, INITIAL_DEPOSIT);
    }

    // =========================================================================
    // Withdrawal Flow Tests
    // =========================================================================

    function test_InitiateWithdrawal_Success() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        vm.prank(provider);
        vault.initiateWithdrawal(AGENT_ID, INITIAL_DEPOSIT);

        ICollateralVault.CollateralAccount memory account = vault.getAccount(AGENT_ID);
        assertEq(account.withdrawalInitiatedAt, block.timestamp);
        assertEq(account.withdrawalAmount, INITIAL_DEPOSIT);
    }

    function test_InitiateWithdrawal_EmitsEvent() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        uint256 expectedExecuteAfter = block.timestamp + GRACE_PERIOD;

        vm.expectEmit(true, false, false, true);
        emit ICollateralVault.WithdrawalInitiated(AGENT_ID, INITIAL_DEPOSIT, expectedExecuteAfter);

        vm.prank(provider);
        vault.initiateWithdrawal(AGENT_ID, INITIAL_DEPOSIT);
    }

    function test_InitiateWithdrawal_RevertsIfNotOwner() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        vm.prank(depositor);
        vm.expectRevert(
            abi.encodeWithSelector(CollateralVault.NotAgentOwner.selector, AGENT_ID, depositor)
        );
        vault.initiateWithdrawal(AGENT_ID, INITIAL_DEPOSIT);
    }

    function test_InitiateWithdrawal_RevertsIfAlreadyPending() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        vm.startPrank(provider);
        vault.initiateWithdrawal(AGENT_ID, INITIAL_DEPOSIT / 2);

        vm.expectRevert(
            abi.encodeWithSelector(CollateralVault.WithdrawalAlreadyPending.selector, AGENT_ID)
        );
        vault.initiateWithdrawal(AGENT_ID, INITIAL_DEPOSIT / 2);
        vm.stopPrank();
    }

    function test_InitiateWithdrawal_RevertsIfInsufficientBalance() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        vm.prank(provider);
        vm.expectRevert(
            abi.encodeWithSelector(
                CollateralVault.InsufficientUnlockedBalance.selector,
                INITIAL_DEPOSIT,
                INITIAL_DEPOSIT + 1
            )
        );
        vault.initiateWithdrawal(AGENT_ID, INITIAL_DEPOSIT + 1);
    }

    function test_CancelWithdrawal_Success() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        vm.startPrank(provider);
        vault.initiateWithdrawal(AGENT_ID, INITIAL_DEPOSIT);
        vault.cancelWithdrawal(AGENT_ID);
        vm.stopPrank();

        ICollateralVault.CollateralAccount memory account = vault.getAccount(AGENT_ID);
        assertEq(account.withdrawalInitiatedAt, 0);
        assertEq(account.withdrawalAmount, 0);
    }

    function test_CancelWithdrawal_EmitsEvent() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        vm.startPrank(provider);
        vault.initiateWithdrawal(AGENT_ID, INITIAL_DEPOSIT);

        vm.expectEmit(true, false, false, false);
        emit ICollateralVault.WithdrawalCancelled(AGENT_ID);

        vault.cancelWithdrawal(AGENT_ID);
        vm.stopPrank();
    }

    function test_CancelWithdrawal_RevertsIfNoPending() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        vm.prank(provider);
        vm.expectRevert(
            abi.encodeWithSelector(CollateralVault.NoWithdrawalPending.selector, AGENT_ID)
        );
        vault.cancelWithdrawal(AGENT_ID);
    }

    function test_ExecuteWithdrawal_Success() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        vm.startPrank(provider);
        vault.initiateWithdrawal(AGENT_ID, INITIAL_DEPOSIT);
        vm.stopPrank();

        // Fast forward past grace period
        vm.warp(block.timestamp + GRACE_PERIOD);

        uint256 balanceBefore = usdc.balanceOf(provider);

        vm.prank(provider);
        vault.executeWithdrawal(AGENT_ID);

        assertEq(usdc.balanceOf(provider), balanceBefore + INITIAL_DEPOSIT);
        assertEq(vault.getAvailableBalance(AGENT_ID), 0);
    }

    function test_ExecuteWithdrawal_EmitsEvent() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        vm.prank(provider);
        vault.initiateWithdrawal(AGENT_ID, INITIAL_DEPOSIT);

        vm.warp(block.timestamp + GRACE_PERIOD);

        vm.expectEmit(true, true, false, true);
        emit ICollateralVault.WithdrawalExecuted(AGENT_ID, provider, INITIAL_DEPOSIT);

        vm.prank(provider);
        vault.executeWithdrawal(AGENT_ID);
    }

    function test_ExecuteWithdrawal_RevertsIfGracePeriodNotElapsed() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        vm.prank(provider);
        vault.initiateWithdrawal(AGENT_ID, INITIAL_DEPOSIT);

        uint256 executeAfter = block.timestamp + GRACE_PERIOD;

        vm.prank(provider);
        vm.expectRevert(
            abi.encodeWithSelector(
                CollateralVault.GracePeriodNotElapsed.selector,
                AGENT_ID,
                executeAfter
            )
        );
        vault.executeWithdrawal(AGENT_ID);
    }

    function test_ExecuteWithdrawal_PartialIfSlashedDuringGracePeriod() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        vm.prank(provider);
        vault.initiateWithdrawal(AGENT_ID, INITIAL_DEPOSIT);

        // Simulate slash during grace period
        uint256 slashAmount = 3_000e6;
        uint256 claimId = 1;

        vm.prank(claimsManager);
        vault.lock(AGENT_ID, claimId, slashAmount);

        vm.prank(rulingExecutor);
        vault.slash(AGENT_ID, claimId, claimant, slashAmount);

        vm.warp(block.timestamp + GRACE_PERIOD);

        uint256 balanceBefore = usdc.balanceOf(provider);

        vm.prank(provider);
        vault.executeWithdrawal(AGENT_ID);

        // Should only receive remaining balance
        assertEq(usdc.balanceOf(provider), balanceBefore + (INITIAL_DEPOSIT - slashAmount));
    }

    function test_CanExecuteWithdrawal() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        assertFalse(vault.canExecuteWithdrawal(AGENT_ID));

        vm.prank(provider);
        vault.initiateWithdrawal(AGENT_ID, INITIAL_DEPOSIT);

        assertFalse(vault.canExecuteWithdrawal(AGENT_ID));

        vm.warp(block.timestamp + GRACE_PERIOD - 1);
        assertFalse(vault.canExecuteWithdrawal(AGENT_ID));

        vm.warp(block.timestamp + 1);
        assertTrue(vault.canExecuteWithdrawal(AGENT_ID));
    }

    // =========================================================================
    // Lock/Unlock Tests
    // =========================================================================

    function test_Lock_Success() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        uint256 lockAmount = 5_000e6;
        uint256 claimId = 1;

        vm.prank(claimsManager);
        uint256 actualLocked = vault.lock(AGENT_ID, claimId, lockAmount);

        assertEq(actualLocked, lockAmount);
        assertEq(vault.getAvailableBalance(AGENT_ID), INITIAL_DEPOSIT - lockAmount);
        assertEq(vault.getLockedForClaim(AGENT_ID, claimId), lockAmount);
    }

    function test_Lock_EmitsEvent() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        uint256 lockAmount = 5_000e6;
        uint256 claimId = 1;

        vm.expectEmit(true, false, false, true);
        emit ICollateralVault.CollateralLocked(AGENT_ID, claimId, lockAmount);

        vm.prank(claimsManager);
        vault.lock(AGENT_ID, claimId, lockAmount);
    }

    function test_Lock_PartialIfInsufficientBalance() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        uint256 claimId = 1;
        uint256 requestedLock = INITIAL_DEPOSIT + 5_000e6;

        vm.prank(claimsManager);
        uint256 actualLocked = vault.lock(AGENT_ID, claimId, requestedLock);

        assertEq(actualLocked, INITIAL_DEPOSIT);
        assertEq(vault.getAvailableBalance(AGENT_ID), 0);
    }

    function test_Lock_MultipleClaims() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        uint256 claim1Lock = 3_000e6;
        uint256 claim2Lock = 4_000e6;

        vm.startPrank(claimsManager);
        vault.lock(AGENT_ID, 1, claim1Lock);
        vault.lock(AGENT_ID, 2, claim2Lock);
        vm.stopPrank();

        assertEq(vault.getAvailableBalance(AGENT_ID), INITIAL_DEPOSIT - claim1Lock - claim2Lock);
        assertEq(vault.getLockedForClaim(AGENT_ID, 1), claim1Lock);
        assertEq(vault.getLockedForClaim(AGENT_ID, 2), claim2Lock);
    }

    function test_Lock_RevertsIfNotClaimsManager() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSelector(CollateralVault.NotClaimsManager.selector, provider));
        vault.lock(AGENT_ID, 1, 1_000e6);
    }

    function test_Unlock_Success() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        uint256 lockAmount = 5_000e6;
        uint256 claimId = 1;

        vm.prank(claimsManager);
        vault.lock(AGENT_ID, claimId, lockAmount);

        vm.prank(claimsManager);
        vault.unlock(AGENT_ID, claimId, lockAmount);

        assertEq(vault.getAvailableBalance(AGENT_ID), INITIAL_DEPOSIT);
        assertEq(vault.getLockedForClaim(AGENT_ID, claimId), 0);
    }

    function test_Unlock_EmitsEvent() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        uint256 lockAmount = 5_000e6;
        uint256 claimId = 1;

        vm.prank(claimsManager);
        vault.lock(AGENT_ID, claimId, lockAmount);

        vm.expectEmit(true, false, false, true);
        emit ICollateralVault.CollateralUnlocked(AGENT_ID, claimId, lockAmount);

        vm.prank(claimsManager);
        vault.unlock(AGENT_ID, claimId, lockAmount);
    }

    function test_Unlock_PartialUnlock() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        uint256 lockAmount = 5_000e6;
        uint256 unlockAmount = 2_000e6;
        uint256 claimId = 1;

        vm.prank(claimsManager);
        vault.lock(AGENT_ID, claimId, lockAmount);

        vm.prank(claimsManager);
        vault.unlock(AGENT_ID, claimId, unlockAmount);

        assertEq(vault.getLockedForClaim(AGENT_ID, claimId), lockAmount - unlockAmount);
    }

    function test_Unlock_ByRulingExecutor() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        uint256 lockAmount = 5_000e6;
        uint256 claimId = 1;

        vm.prank(claimsManager);
        vault.lock(AGENT_ID, claimId, lockAmount);

        vm.prank(rulingExecutor);
        vault.unlock(AGENT_ID, claimId, lockAmount);

        assertEq(vault.getAvailableBalance(AGENT_ID), INITIAL_DEPOSIT);
    }

    function test_Unlock_RevertsIfNotAuthorized() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        uint256 claimId = 1;
        vm.prank(claimsManager);
        vault.lock(AGENT_ID, claimId, 5_000e6);

        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSelector(CollateralVault.NotAuthorized.selector, provider));
        vault.unlock(AGENT_ID, claimId, 5_000e6);
    }

    // =========================================================================
    // Slash Tests
    // =========================================================================

    function test_Slash_Success() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        uint256 lockAmount = 5_000e6;
        uint256 slashAmount = 3_000e6;
        uint256 claimId = 1;

        vm.prank(claimsManager);
        vault.lock(AGENT_ID, claimId, lockAmount);

        uint256 claimantBalanceBefore = usdc.balanceOf(claimant);

        vm.prank(rulingExecutor);
        vault.slash(AGENT_ID, claimId, claimant, slashAmount);

        assertEq(usdc.balanceOf(claimant), claimantBalanceBefore + slashAmount);
        assertEq(vault.getLockedForClaim(AGENT_ID, claimId), lockAmount - slashAmount);

        ICollateralVault.CollateralAccount memory account = vault.getAccount(AGENT_ID);
        assertEq(account.balance, INITIAL_DEPOSIT - slashAmount);
        assertEq(account.lockedAmount, lockAmount - slashAmount);
    }

    function test_Slash_EmitsEvent() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        uint256 lockAmount = 5_000e6;
        uint256 claimId = 1;

        vm.prank(claimsManager);
        vault.lock(AGENT_ID, claimId, lockAmount);

        vm.expectEmit(true, false, true, true);
        emit ICollateralVault.CollateralSlashed(AGENT_ID, claimId, claimant, lockAmount);

        vm.prank(rulingExecutor);
        vault.slash(AGENT_ID, claimId, claimant, lockAmount);
    }

    function test_Slash_CappedToLockedAmount() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        uint256 lockAmount = 5_000e6;
        uint256 claimId = 1;

        vm.prank(claimsManager);
        vault.lock(AGENT_ID, claimId, lockAmount);

        vm.prank(rulingExecutor);
        vault.slash(AGENT_ID, claimId, claimant, lockAmount + 1_000e6);

        // Should only transfer locked amount
        ICollateralVault.CollateralAccount memory account = vault.getAccount(AGENT_ID);
        assertEq(account.balance, INITIAL_DEPOSIT - lockAmount);
    }

    function test_Slash_RevertsIfNotRulingExecutor() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        uint256 claimId = 1;
        vm.prank(claimsManager);
        vault.lock(AGENT_ID, claimId, 5_000e6);

        vm.prank(claimsManager);
        vm.expectRevert(
            abi.encodeWithSelector(CollateralVault.NotRulingExecutor.selector, claimsManager)
        );
        vault.slash(AGENT_ID, claimId, claimant, 5_000e6);
    }

    function test_Slash_RevertsWhenPaused() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        uint256 claimId = 1;
        vm.prank(claimsManager);
        vault.lock(AGENT_ID, claimId, 5_000e6);

        vm.prank(governance);
        vault.pause(ITrustfulPausable.PauseScope.Executions, "test");

        vm.prank(rulingExecutor);
        vm.expectRevert();
        vault.slash(AGENT_ID, claimId, claimant, 5_000e6);
    }

    // =========================================================================
    // Pause Tests
    // =========================================================================

    function test_Pause_DepositsOnly() public {
        vm.prank(governance);
        vault.pause(ITrustfulPausable.PauseScope.Deposits, "test");

        assertTrue(vault.isPaused(ITrustfulPausable.PauseScope.Deposits));
        assertFalse(vault.isPaused(ITrustfulPausable.PauseScope.Withdrawals));
    }

    function test_Pause_EmergencyPauseAll() public {
        vm.prank(governance);
        vault.emergencyPauseAll("emergency");

        assertTrue(vault.isFullyPaused());
        assertTrue(vault.isPaused(ITrustfulPausable.PauseScope.Deposits));
        assertTrue(vault.isPaused(ITrustfulPausable.PauseScope.Withdrawals));
    }

    function test_Unpause() public {
        vm.startPrank(governance);
        vault.pause(ITrustfulPausable.PauseScope.Deposits, "test");
        vault.unpause(ITrustfulPausable.PauseScope.Deposits);
        vm.stopPrank();

        assertFalse(vault.isPaused(ITrustfulPausable.PauseScope.Deposits));
    }

    // =========================================================================
    // Admin Tests
    // =========================================================================

    function test_SetClaimsManager_RevertsIfNotGovernance() public {
        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSelector(TrustfulPausable.NotGovernance.selector, provider));
        vault.setClaimsManager(makeAddr("new"));
    }

    function test_SetRulingExecutor_RevertsIfNotGovernance() public {
        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSelector(TrustfulPausable.NotGovernance.selector, provider));
        vault.setRulingExecutor(makeAddr("new"));
    }

    // =========================================================================
    // Fuzz Tests
    // =========================================================================

    function testFuzz_Deposit(uint256 amount) public {
        amount = bound(amount, 1, usdc.balanceOf(provider));

        vm.prank(provider);
        vault.deposit(AGENT_ID, amount);

        assertEq(vault.getAvailableBalance(AGENT_ID), amount);
    }

    function testFuzz_LockUnlock(uint256 depositAmount, uint256 lockAmount) public {
        depositAmount = bound(depositAmount, 1e6, 100_000e6);
        lockAmount = bound(lockAmount, 1, depositAmount);

        usdc.mint(provider, depositAmount);
        _depositCollateral(AGENT_ID, depositAmount);

        vm.prank(claimsManager);
        uint256 actualLocked = vault.lock(AGENT_ID, 1, lockAmount);

        assertEq(actualLocked, lockAmount);
        assertEq(vault.getAvailableBalance(AGENT_ID), depositAmount - lockAmount);

        vm.prank(claimsManager);
        vault.unlock(AGENT_ID, 1, lockAmount);

        assertEq(vault.getAvailableBalance(AGENT_ID), depositAmount);
    }

    // =========================================================================
    // Integration Tests
    // =========================================================================

    function test_FullClaimLifecycle() public {
        // 1. Provider deposits collateral
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        // 2. Claim filed, collateral locked
        uint256 claimId = 1;
        uint256 claimedAmount = 5_000e6;

        vm.prank(claimsManager);
        vault.lock(AGENT_ID, claimId, claimedAmount);

        assertEq(vault.getAvailableBalance(AGENT_ID), INITIAL_DEPOSIT - claimedAmount);

        // 3. Claim approved, collateral slashed
        vm.prank(rulingExecutor);
        vault.slash(AGENT_ID, claimId, claimant, claimedAmount);

        assertEq(usdc.balanceOf(claimant), 100_000e6 + claimedAmount);
        assertEq(vault.getAvailableBalance(AGENT_ID), INITIAL_DEPOSIT - claimedAmount);

        // 4. Provider withdraws remaining
        vm.startPrank(provider);
        vault.initiateWithdrawal(AGENT_ID, vault.getAvailableBalance(AGENT_ID));
        vm.warp(block.timestamp + GRACE_PERIOD);
        vault.executeWithdrawal(AGENT_ID);
        vm.stopPrank();

        assertEq(vault.getAvailableBalance(AGENT_ID), 0);
    }

    function test_RejectedClaimLifecycle() public {
        _depositCollateral(AGENT_ID, INITIAL_DEPOSIT);

        uint256 claimId = 1;
        uint256 claimedAmount = 5_000e6;

        vm.prank(claimsManager);
        vault.lock(AGENT_ID, claimId, claimedAmount);

        // Claim rejected, collateral unlocked
        vm.prank(rulingExecutor);
        vault.unlock(AGENT_ID, claimId, claimedAmount);

        assertEq(vault.getAvailableBalance(AGENT_ID), INITIAL_DEPOSIT);
    }

    // =========================================================================
    // Helper Functions
    // =========================================================================

    function _depositCollateral(uint256 agentId, uint256 amount) internal {
        vm.prank(provider);
        vault.deposit(agentId, amount);
    }
}
