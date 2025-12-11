// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test, console2 } from "forge-std/Test.sol";
import { RulingExecutor } from "../src/core/RulingExecutor.sol";
import { IRulingExecutor } from "../src/interfaces/IRulingExecutor.sol";
import { IClaimsManager } from "../src/interfaces/IClaimsManager.sol";
import { TrustfulPausable } from "../src/base/TrustfulPausable.sol";
import { ERC20Mock } from "./mocks/ERC20Mock.sol";
import { CouncilRegistryMock } from "./mocks/CouncilRegistryMock.sol";
import { CollateralVaultMock } from "./mocks/CollateralVaultMock.sol";

/**
 * @title ClaimsManagerMock
 * @notice Mock ClaimsManager for RulingExecutor testing
 */
contract ClaimsManagerMock {
    struct MockClaim {
        uint256 agentId;
        address claimant;
        uint256 amount;
        uint256 approvedAmount;
        bytes32 councilId;
        IClaimsManager.ClaimStatus status;
        uint256 deposit;
        bool hadVotes;
        address[] voters;
    }

    mapping(uint256 => MockClaim) public claims;
    uint256 public nextClaimId = 1;
    
    ERC20Mock public usdc;
    bool public depositTransferred;
    bool public depositReturned;
    bool public claimMarkedExecuted;

    constructor(address _usdc) {
        usdc = ERC20Mock(_usdc);
    }

    function createClaim(
        uint256 agentId,
        address claimant,
        uint256 amount,
        uint256 approvedAmount,
        bytes32 councilId,
        IClaimsManager.ClaimStatus status,
        uint256 deposit,
        bool hadVotes,
        address[] memory voters
    ) external returns (uint256) {
        uint256 claimId = nextClaimId++;
        claims[claimId] = MockClaim({
            agentId: agentId,
            claimant: claimant,
            amount: amount,
            approvedAmount: approvedAmount,
            councilId: councilId,
            status: status,
            deposit: deposit,
            hadVotes: hadVotes,
            voters: voters
        });
        return claimId;
    }

    function getClaim(uint256 claimId) external view returns (
        uint256 agentId,
        address claimant,
        uint256 amount,
        uint256 approvedAmount,
        bytes32 councilId,
        IClaimsManager.ClaimStatus status,
        uint256 evidenceDeadline,
        uint256 votingDeadline,
        bytes32 termsHashAtClaim,
        uint256 termsVersionAtClaim,
        uint256 deposit,
        bool hadVotes,
        uint256 lockedCollateral
    ) {
        MockClaim storage c = claims[claimId];
        return (
            c.agentId,
            c.claimant,
            c.amount,
            c.approvedAmount,
            c.councilId,
            c.status,
            0, // evidenceDeadline
            0, // votingDeadline
            bytes32(0), // termsHash
            0, // termsVersion
            c.deposit,
            c.hadVotes,
            c.amount // lockedCollateral = amount for simplicity
        );
    }

    function getVoters(uint256 claimId) external view returns (address[] memory) {
        return claims[claimId].voters;
    }

    function transferDepositToExecutor(uint256) external {
        depositTransferred = true;
        // Transfer happens from ClaimsManager which holds deposits
        usdc.transfer(msg.sender, 100e6); // Fixed amount for testing
    }

    function returnDepositToClaimant(uint256 claimId) external {
        depositReturned = true;
        usdc.transfer(claims[claimId].claimant, claims[claimId].deposit);
    }

    function markExecuted(uint256 claimId) external {
        claimMarkedExecuted = true;
        claims[claimId].status = IClaimsManager.ClaimStatus.Executed;
    }

    function setClaimStatus(uint256 claimId, IClaimsManager.ClaimStatus status) external {
        claims[claimId].status = status;
    }
}

/**
 * @title RulingExecutorTest
 * @notice Comprehensive tests for RulingExecutor contract
 */
contract RulingExecutorTest is Test {
    // =========================================================================
    // Test Setup
    // =========================================================================

    RulingExecutor public executor;
    ERC20Mock public usdc;
    CouncilRegistryMock public councilRegistry;
    CollateralVaultMock public collateralVault;
    ClaimsManagerMock public claimsManager;

    address public governance = makeAddr("governance");
    address public claimant = makeAddr("claimant");
    address public provider = makeAddr("provider");
    
    address public member1 = makeAddr("member1");
    address public member2 = makeAddr("member2");
    address public member3 = makeAddr("member3");

    uint256 public constant AGENT_ID = 1;
    bytes32 public constant COUNCIL_ID = keccak256("test-council");
    uint256 public constant CLAIM_AMOUNT = 1000e6;
    uint256 public constant APPROVED_AMOUNT = 800e6;
    uint256 public constant DEPOSIT = 100e6;

    function setUp() public {
        // Deploy mocks
        usdc = new ERC20Mock("USD Coin", "USDC", 6);
        councilRegistry = new CouncilRegistryMock();
        collateralVault = new CollateralVaultMock(address(usdc));
        claimsManager = new ClaimsManagerMock(address(usdc));

        // Deploy executor
        executor = new RulingExecutor(address(usdc), governance);

        // Setup roles
        vm.startPrank(governance);
        executor.setClaimsManager(address(claimsManager));
        executor.setCollateralVault(address(collateralVault));
        executor.setCouncilRegistry(address(councilRegistry));
        vm.stopPrank();

        // Setup council
        councilRegistry.setCouncil(COUNCIL_ID, 51, 10, 7 days, 3 days, true);
        address[] memory members = new address[](3);
        members[0] = member1;
        members[1] = member2;
        members[2] = member3;
        councilRegistry.setMembers(COUNCIL_ID, members);

        // Setup collateral
        collateralVault.setDeposit(AGENT_ID, 50000e6);

        // Fund contracts for transfers
        usdc.mint(address(collateralVault), 100_000e6);
        usdc.mint(address(claimsManager), 100_000e6);
        usdc.mint(address(executor), 100_000e6);
    }

    // =========================================================================
    // Helper Functions
    // =========================================================================

    function _createApprovedClaim() internal returns (uint256) {
        address[] memory voters = new address[](2);
        voters[0] = member1;
        voters[1] = member2;

        return claimsManager.createClaim(
            AGENT_ID,
            claimant,
            CLAIM_AMOUNT,
            APPROVED_AMOUNT,
            COUNCIL_ID,
            IClaimsManager.ClaimStatus.Approved,
            DEPOSIT,
            true,
            voters
        );
    }

    function _createRejectedClaim() internal returns (uint256) {
        address[] memory voters = new address[](2);
        voters[0] = member1;
        voters[1] = member2;

        return claimsManager.createClaim(
            AGENT_ID,
            claimant,
            CLAIM_AMOUNT,
            0,
            COUNCIL_ID,
            IClaimsManager.ClaimStatus.Rejected,
            DEPOSIT,
            true,
            voters
        );
    }

    function _createCancelledClaim() internal returns (uint256) {
        address[] memory voters = new address[](0);

        return claimsManager.createClaim(
            AGENT_ID,
            claimant,
            CLAIM_AMOUNT,
            0,
            COUNCIL_ID,
            IClaimsManager.ClaimStatus.Cancelled,
            DEPOSIT,
            false,
            voters
        );
    }

    function _createExpiredClaimWithVotes() internal returns (uint256) {
        address[] memory voters = new address[](1);
        voters[0] = member1;

        return claimsManager.createClaim(
            AGENT_ID,
            claimant,
            CLAIM_AMOUNT,
            0,
            COUNCIL_ID,
            IClaimsManager.ClaimStatus.Expired,
            DEPOSIT,
            true,
            voters
        );
    }

    function _createExpiredClaimNoVotes() internal returns (uint256) {
        address[] memory voters = new address[](0);

        return claimsManager.createClaim(
            AGENT_ID,
            claimant,
            CLAIM_AMOUNT,
            0,
            COUNCIL_ID,
            IClaimsManager.ClaimStatus.Expired,
            DEPOSIT,
            false,
            voters
        );
    }

    // =========================================================================
    // Constructor Tests
    // =========================================================================

    function test_Constructor_SetsCorrectValues() public view {
        assertEq(executor.governance(), governance);
    }

    // =========================================================================
    // Execute Approved Claim Tests
    // =========================================================================

    function test_ExecuteApprovedClaim_Success() public {
        uint256 claimId = _createApprovedClaim();
        
        uint256 claimantBalanceBefore = usdc.balanceOf(claimant);

        vm.expectEmit(true, false, false, true);
        emit IRulingExecutor.ClaimExecuted(claimId, IClaimsManager.ClaimStatus.Approved, APPROVED_AMOUNT);

        executor.executeApprovedClaim(claimId);

        // Verify collateral was slashed to claimant
        assertEq(collateralVault.slashCallCount(), 1);
        
        // Verify deposit was transferred and distributed
        assertTrue(claimsManager.depositTransferred());
        
        // Verify claim marked as executed
        assertTrue(claimsManager.claimMarkedExecuted());
    }

    function test_ExecuteApprovedClaim_RevertsOnWrongStatus() public {
        uint256 claimId = _createRejectedClaim();

        vm.expectRevert(abi.encodeWithSelector(
            IRulingExecutor.InvalidClaimStatusForExecution.selector,
            claimId,
            IClaimsManager.ClaimStatus.Rejected
        ));
        executor.executeApprovedClaim(claimId);
    }

    // =========================================================================
    // Execute Rejected Claim Tests
    // =========================================================================

    function test_ExecuteRejectedClaim_Success() public {
        uint256 claimId = _createRejectedClaim();

        vm.expectEmit(true, false, false, true);
        emit IRulingExecutor.ClaimExecuted(claimId, IClaimsManager.ClaimStatus.Rejected, 0);

        executor.executeRejectedClaim(claimId);

        // Verify collateral was unlocked
        assertEq(collateralVault.unlockCallCount(), 1);
        
        // Verify deposit distributed to voters
        assertTrue(claimsManager.depositTransferred());
        
        // Verify marked executed
        assertTrue(claimsManager.claimMarkedExecuted());
    }

    // =========================================================================
    // Execute Cancelled Claim Tests
    // =========================================================================

    function test_ExecuteCancelledClaim_Success() public {
        uint256 claimId = _createCancelledClaim();

        vm.expectEmit(true, false, false, true);
        emit IRulingExecutor.ClaimExecuted(claimId, IClaimsManager.ClaimStatus.Cancelled, 0);

        executor.executeCancelledClaim(claimId);

        // Deposit goes to ALL council members (not voters, since none voted)
        assertTrue(claimsManager.depositTransferred());
        assertTrue(claimsManager.claimMarkedExecuted());
    }

    // =========================================================================
    // Execute Expired Claim Tests
    // =========================================================================

    function test_ExecuteExpiredClaim_WithVotes_DepositToVoters() public {
        uint256 claimId = _createExpiredClaimWithVotes();

        executor.executeExpiredClaim(claimId);

        // With votes: deposit goes to voters
        assertTrue(claimsManager.depositTransferred());
        assertFalse(claimsManager.depositReturned());
        assertTrue(claimsManager.claimMarkedExecuted());
    }

    function test_ExecuteExpiredClaim_NoVotes_DepositToClaimant() public {
        uint256 claimId = _createExpiredClaimNoVotes();

        executor.executeExpiredClaim(claimId);

        // No votes: deposit returns to claimant
        assertTrue(claimsManager.depositReturned());
        assertTrue(claimsManager.claimMarkedExecuted());
    }

    // =========================================================================
    // Generic Execute Tests
    // =========================================================================

    function test_ExecuteClaim_RoutesToCorrectHandler() public {
        uint256 approvedClaimId = _createApprovedClaim();
        uint256 rejectedClaimId = _createRejectedClaim();
        uint256 cancelledClaimId = _createCancelledClaim();
        uint256 expiredClaimId = _createExpiredClaimNoVotes();

        // Should all succeed via auto-routing
        executor.executeClaim(approvedClaimId);
        executor.executeClaim(rejectedClaimId);
        executor.executeClaim(cancelledClaimId);
        executor.executeClaim(expiredClaimId);
    }

    function test_ExecuteClaim_RevertsOnFiledStatus() public {
        address[] memory voters = new address[](0);
        uint256 claimId = claimsManager.createClaim(
            AGENT_ID,
            claimant,
            CLAIM_AMOUNT,
            0,
            COUNCIL_ID,
            IClaimsManager.ClaimStatus.Filed,
            DEPOSIT,
            false,
            voters
        );

        vm.expectRevert(abi.encodeWithSelector(
            IRulingExecutor.ClaimNotExecutable.selector,
            claimId,
            IClaimsManager.ClaimStatus.Filed
        ));
        executor.executeClaim(claimId);
    }

    // =========================================================================
    // Batch Execute Tests
    // =========================================================================

    function test_BatchExecute_Success() public {
        uint256 claim1 = _createApprovedClaim();
        uint256 claim2 = _createRejectedClaim();
        uint256 claim3 = _createExpiredClaimNoVotes();

        uint256[] memory claimIds = new uint256[](3);
        claimIds[0] = claim1;
        claimIds[1] = claim2;
        claimIds[2] = claim3;

        (uint256 successful, uint256 failed) = executor.batchExecute(claimIds);

        assertEq(successful, 3);
        assertEq(failed, 0);
    }

    function test_BatchExecute_ContinuesOnFailure() public {
        uint256 validClaim = _createApprovedClaim();
        
        // Create invalid claim (Filed status)
        address[] memory voters = new address[](0);
        uint256 invalidClaim = claimsManager.createClaim(
            AGENT_ID,
            claimant,
            CLAIM_AMOUNT,
            0,
            COUNCIL_ID,
            IClaimsManager.ClaimStatus.Filed,
            DEPOSIT,
            false,
            voters
        );

        uint256[] memory claimIds = new uint256[](2);
        claimIds[0] = invalidClaim;
        claimIds[1] = validClaim;

        (uint256 successful, uint256 failed) = executor.batchExecute(claimIds);

        assertEq(successful, 1);
        assertEq(failed, 1);
    }

    // =========================================================================
    // Can Execute Tests
    // =========================================================================

    function test_CanExecute_Approved() public {
        uint256 claimId = _createApprovedClaim();
        assertTrue(executor.canExecute(claimId));
    }

    function test_CanExecute_Filed() public {
        address[] memory voters = new address[](0);
        uint256 claimId = claimsManager.createClaim(
            AGENT_ID,
            claimant,
            CLAIM_AMOUNT,
            0,
            COUNCIL_ID,
            IClaimsManager.ClaimStatus.Filed,
            DEPOSIT,
            false,
            voters
        );

        assertFalse(executor.canExecute(claimId));
    }

    function test_CanExecute_AlreadyExecuted() public {
        address[] memory voters = new address[](0);
        uint256 claimId = claimsManager.createClaim(
            AGENT_ID,
            claimant,
            CLAIM_AMOUNT,
            0,
            COUNCIL_ID,
            IClaimsManager.ClaimStatus.Executed,
            DEPOSIT,
            false,
            voters
        );

        assertFalse(executor.canExecute(claimId));
    }

    // =========================================================================
    // Preview Tests
    // =========================================================================

    function test_PreviewExecution_Approved() public {
        uint256 claimId = _createApprovedClaim();

        (
            address recipient,
            uint256 payoutAmount,
            address[] memory depositRecipients,
            uint256 depositPerRecipient
        ) = executor.previewExecution(claimId);

        assertEq(recipient, claimant);
        assertEq(payoutAmount, APPROVED_AMOUNT);
        assertEq(depositRecipients.length, 2); // 2 voters
    }

    function test_PreviewExecution_Rejected() public {
        uint256 claimId = _createRejectedClaim();

        (
            address recipient,
            uint256 payoutAmount,
            address[] memory depositRecipients,
        ) = executor.previewExecution(claimId);

        assertEq(recipient, address(0)); // No payout recipient for rejected
        assertEq(payoutAmount, 0);
        assertEq(depositRecipients.length, 2); // 2 voters
    }

    function test_WillDepositBeReturned_ExpiredNoVotes() public {
        uint256 claimId = _createExpiredClaimNoVotes();
        assertTrue(executor.willDepositBeReturned(claimId));
    }

    function test_WillDepositBeReturned_ExpiredWithVotes() public {
        uint256 claimId = _createExpiredClaimWithVotes();
        assertFalse(executor.willDepositBeReturned(claimId));
    }

    function test_WillDepositBeReturned_Approved() public {
        uint256 claimId = _createApprovedClaim();
        assertFalse(executor.willDepositBeReturned(claimId));
    }

    // =========================================================================
    // Pause Tests
    // =========================================================================

    function test_Pause_Success() public {
        vm.prank(governance);
        executor.pause();

        assertTrue(executor.paused());
    }

    function test_ExecuteClaim_RevertsWhenPaused() public {
        uint256 claimId = _createApprovedClaim();

        vm.prank(governance);
        executor.pause();

        vm.expectRevert(TrustfulPausable.ContractPaused.selector);
        executor.executeClaim(claimId);
    }
}
