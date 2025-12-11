// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test, console2 } from "forge-std/Test.sol";
import { ClaimsManager } from "../src/core/ClaimsManager.sol";
import { IClaimsManager } from "../src/interfaces/IClaimsManager.sol";
import { TrustfulPausable } from "../src/base/TrustfulPausable.sol";
import { ERC20Mock } from "./mocks/ERC20Mock.sol";
import { ERC8004RegistryMock } from "./mocks/ERC8004RegistryMock.sol";
import { CouncilRegistryMock } from "./mocks/CouncilRegistryMock.sol";
import { TermsRegistryMock } from "./mocks/TermsRegistryMock.sol";
import { CollateralVaultMock } from "./mocks/CollateralVaultMock.sol";

/**
 * @title ClaimsManagerTest
 * @notice Comprehensive tests for ClaimsManager contract
 */
contract ClaimsManagerTest is Test {
    // =========================================================================
    // Test Setup
    // =========================================================================

    ClaimsManager public claimsManager;
    ERC20Mock public usdc;
    ERC8004RegistryMock public agentRegistry;
    CouncilRegistryMock public councilRegistry;
    TermsRegistryMock public termsRegistry;
    CollateralVaultMock public collateralVault;

    address public governance = makeAddr("governance");
    address public rulingExecutor = makeAddr("rulingExecutor");
    address public provider = makeAddr("provider");
    address public claimant = makeAddr("claimant");
    
    address public member1 = makeAddr("member1");
    address public member2 = makeAddr("member2");
    address public member3 = makeAddr("member3");
    address public nonMember = makeAddr("nonMember");

    uint256 public constant AGENT_ID = 1;
    bytes32 public constant COUNCIL_ID = keccak256("test-council");
    bytes32 public constant TERMS_HASH = keccak256("terms-v1");
    
    uint256 public constant CLAIM_AMOUNT = 1000e6; // 1000 USDC
    uint256 public constant DEPOSIT_PERCENTAGE = 10; // 10%
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant EVIDENCE_PERIOD = 3 days;
    uint256 public constant QUORUM_PERCENTAGE = 51;

    bytes32 public constant EVIDENCE_HASH = keccak256("evidence");
    string public constant EVIDENCE_URI = "ipfs://evidence";

    function setUp() public {
        // Deploy mocks
        usdc = new ERC20Mock("USD Coin", "USDC", 6);
        agentRegistry = new ERC8004RegistryMock();
        councilRegistry = new CouncilRegistryMock();
        termsRegistry = new TermsRegistryMock();
        collateralVault = new CollateralVaultMock(address(usdc));

        // Deploy ClaimsManager
        claimsManager = new ClaimsManager(
            address(usdc),
            address(agentRegistry),
            governance
        );

        // Setup roles
        vm.startPrank(governance);
        claimsManager.setCollateralVault(address(collateralVault));
        claimsManager.setTermsRegistry(address(termsRegistry));
        claimsManager.setCouncilRegistry(address(councilRegistry));
        claimsManager.setRulingExecutor(rulingExecutor);
        vm.stopPrank();

        // Setup agent
        agentRegistry.mint(provider, AGENT_ID);

        // Setup council
        councilRegistry.setCouncil(
            COUNCIL_ID,
            QUORUM_PERCENTAGE,
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD,
            true // active
        );
        
        address[] memory members = new address[](3);
        members[0] = member1;
        members[1] = member2;
        members[2] = member3;
        councilRegistry.setMembers(COUNCIL_ID, members);

        // Setup terms
        termsRegistry.setAgentTerms(
            AGENT_ID,
            COUNCIL_ID,
            TERMS_HASH,
            1, // version
            10000e6, // maxPayout
            true // active
        );
        termsRegistry.setAgentProvider(AGENT_ID, provider);

        // Setup collateral
        collateralVault.setDeposit(AGENT_ID, 50000e6); // 50k USDC

        // Fund accounts
        usdc.mint(claimant, 100_000e6);
        usdc.mint(address(collateralVault), 100_000e6); // For slash payouts

        // Approve
        vm.prank(claimant);
        usdc.approve(address(claimsManager), type(uint256).max);
    }

    // =========================================================================
    // Helper Functions
    // =========================================================================

    function _fileDefaultClaim() internal returns (uint256 claimId) {
        vm.prank(claimant);
        claimId = claimsManager.fileClaim(
            AGENT_ID,
            CLAIM_AMOUNT,
            EVIDENCE_HASH,
            EVIDENCE_URI
        );
    }

    function _skipToVotingPeriod() internal {
        vm.warp(block.timestamp + EVIDENCE_PERIOD + 1);
    }

    function _skipToAfterVoting() internal {
        vm.warp(block.timestamp + EVIDENCE_PERIOD + VOTING_PERIOD + 1);
    }

    // =========================================================================
    // Constructor Tests
    // =========================================================================

    function test_Constructor_SetsCorrectValues() public view {
        assertEq(address(claimsManager.collateralVault()), address(collateralVault));
        assertEq(address(claimsManager.termsRegistry()), address(termsRegistry));
        assertEq(address(claimsManager.councilRegistry()), address(councilRegistry));
        assertEq(claimsManager.governance(), governance);
    }

    // =========================================================================
    // Claim Filing Tests
    // =========================================================================

    function test_FileClaim_Success() public {
        uint256 expectedDeposit = (CLAIM_AMOUNT * DEPOSIT_PERCENTAGE) / 100;
        uint256 claimantBalanceBefore = usdc.balanceOf(claimant);

        vm.expectEmit(true, true, true, true);
        emit IClaimsManager.ClaimFiled(
            1, // claimId
            AGENT_ID,
            claimant,
            CLAIM_AMOUNT,
            expectedDeposit,
            COUNCIL_ID
        );

        uint256 claimId = _fileDefaultClaim();

        assertEq(claimId, 1);
        assertEq(usdc.balanceOf(claimant), claimantBalanceBefore - expectedDeposit);

        // Verify claim state
        (
            uint256 agentId,
            address claimantAddr,
            uint256 amount,
            ,
            bytes32 councilId,
            IClaimsManager.ClaimStatus status,
            ,
            ,
            ,
            ,
            uint256 deposit,
            ,
        ) = claimsManager.getClaim(claimId);

        assertEq(agentId, AGENT_ID);
        assertEq(claimantAddr, claimant);
        assertEq(amount, CLAIM_AMOUNT);
        assertEq(councilId, COUNCIL_ID);
        assertEq(uint8(status), uint8(IClaimsManager.ClaimStatus.Filed));
        assertEq(deposit, expectedDeposit);

        // Verify collateral was locked
        assertEq(collateralVault.lockCallCount(), 1);
        assertEq(collateralVault.lastLockAgentId(), AGENT_ID);
        assertEq(collateralVault.lastLockAmount(), CLAIM_AMOUNT);
    }

    function test_FileClaim_RevertsOnNoActiveTerms() public {
        termsRegistry.setAgentTerms(AGENT_ID, COUNCIL_ID, TERMS_HASH, 1, 10000e6, false);

        vm.expectRevert(abi.encodeWithSelector(IClaimsManager.AgentNotActive.selector, AGENT_ID));
        vm.prank(claimant);
        claimsManager.fileClaim(AGENT_ID, CLAIM_AMOUNT, EVIDENCE_HASH, EVIDENCE_URI);
    }

    function test_FileClaim_RevertsOnAmountBelowMinimum() public {
        vm.expectRevert(abi.encodeWithSelector(IClaimsManager.AmountBelowMinimum.selector, 100, 1e6));
        vm.prank(claimant);
        claimsManager.fileClaim(AGENT_ID, 100, EVIDENCE_HASH, EVIDENCE_URI); // 0.0001 USDC
    }

    function test_FileClaim_RevertsOnZeroEvidenceHash() public {
        vm.expectRevert(IClaimsManager.InvalidEvidenceHash.selector);
        vm.prank(claimant);
        claimsManager.fileClaim(AGENT_ID, CLAIM_AMOUNT, bytes32(0), EVIDENCE_URI);
    }

    function test_FileClaim_RevertsOnEmptyEvidenceUri() public {
        vm.expectRevert(IClaimsManager.InvalidEvidenceUri.selector);
        vm.prank(claimant);
        claimsManager.fileClaim(AGENT_ID, CLAIM_AMOUNT, EVIDENCE_HASH, "");
    }

    function test_FileClaim_MultipleClaims() public {
        uint256 claimId1 = _fileDefaultClaim();
        uint256 claimId2 = _fileDefaultClaim();
        uint256 claimId3 = _fileDefaultClaim();

        assertEq(claimId1, 1);
        assertEq(claimId2, 2);
        assertEq(claimId3, 3);

        // All claims should lock collateral
        assertEq(collateralVault.lockCallCount(), 3);
    }

    // =========================================================================
    // Evidence Submission Tests
    // =========================================================================

    function test_SubmitAdditionalEvidence_Success() public {
        uint256 claimId = _fileDefaultClaim();
        bytes32 newHash = keccak256("additional-evidence");
        string memory newUri = "ipfs://additional";

        vm.expectEmit(true, true, false, true);
        emit IClaimsManager.EvidenceSubmitted(claimId, claimant, newHash, newUri, false);

        vm.prank(claimant);
        claimsManager.submitAdditionalEvidence(claimId, newHash, newUri);
    }

    function test_SubmitAdditionalEvidence_RevertsAfterEvidencePeriod() public {
        uint256 claimId = _fileDefaultClaim();
        
        _skipToVotingPeriod();

        vm.expectRevert(IClaimsManager.EvidencePeriodEnded.selector);
        vm.prank(claimant);
        claimsManager.submitAdditionalEvidence(claimId, keccak256("late"), "ipfs://late");
    }

    function test_SubmitAdditionalEvidence_RevertsOnNonClaimant() public {
        uint256 claimId = _fileDefaultClaim();

        vm.expectRevert(abi.encodeWithSelector(IClaimsManager.NotClaimant.selector, nonMember, claimant));
        vm.prank(nonMember);
        claimsManager.submitAdditionalEvidence(claimId, keccak256("wrong"), "ipfs://wrong");
    }

    function test_SubmitCounterEvidence_Success() public {
        uint256 claimId = _fileDefaultClaim();
        bytes32 counterHash = keccak256("counter-evidence");
        string memory counterUri = "ipfs://counter";

        vm.expectEmit(true, true, false, true);
        emit IClaimsManager.EvidenceSubmitted(claimId, provider, counterHash, counterUri, true);

        vm.prank(provider);
        claimsManager.submitCounterEvidence(claimId, counterHash, counterUri);
    }

    function test_SubmitCounterEvidence_RevertsOnNonProvider() public {
        uint256 claimId = _fileDefaultClaim();

        vm.expectRevert(abi.encodeWithSelector(IClaimsManager.NotProvider.selector, nonMember, provider));
        vm.prank(nonMember);
        claimsManager.submitCounterEvidence(claimId, keccak256("wrong"), "ipfs://wrong");
    }

    // =========================================================================
    // Voting Tests
    // =========================================================================

    function test_CastVote_Approve() public {
        uint256 claimId = _fileDefaultClaim();
        _skipToVotingPeriod();

        vm.expectEmit(true, true, false, true);
        emit IClaimsManager.VoteCast(claimId, member1, IClaimsManager.VoteType.Approve, CLAIM_AMOUNT);

        vm.prank(member1);
        claimsManager.castVote(claimId, IClaimsManager.VoteType.Approve, CLAIM_AMOUNT);

        // Verify vote record
        (IClaimsManager.VoteType voteType, uint256 approvedAmount, bool hasVoted) = 
            claimsManager.getVote(claimId, member1);
        
        assertEq(uint8(voteType), uint8(IClaimsManager.VoteType.Approve));
        assertEq(approvedAmount, CLAIM_AMOUNT);
        assertTrue(hasVoted);
    }

    function test_CastVote_Reject() public {
        uint256 claimId = _fileDefaultClaim();
        _skipToVotingPeriod();

        vm.prank(member1);
        claimsManager.castVote(claimId, IClaimsManager.VoteType.Reject, 0);

        (IClaimsManager.VoteType voteType,, bool hasVoted) = claimsManager.getVote(claimId, member1);
        assertEq(uint8(voteType), uint8(IClaimsManager.VoteType.Reject));
        assertTrue(hasVoted);
    }

    function test_CastVote_Abstain() public {
        uint256 claimId = _fileDefaultClaim();
        _skipToVotingPeriod();

        vm.prank(member1);
        claimsManager.castVote(claimId, IClaimsManager.VoteType.Abstain, 0);

        (IClaimsManager.VoteType voteType,, bool hasVoted) = claimsManager.getVote(claimId, member1);
        assertEq(uint8(voteType), uint8(IClaimsManager.VoteType.Abstain));
        assertTrue(hasVoted);
    }

    function test_CastVote_RevertsBeforeVotingPeriod() public {
        uint256 claimId = _fileDefaultClaim();
        // Still in evidence period

        vm.expectRevert(IClaimsManager.VotingNotStarted.selector);
        vm.prank(member1);
        claimsManager.castVote(claimId, IClaimsManager.VoteType.Approve, CLAIM_AMOUNT);
    }

    function test_CastVote_RevertsAfterVotingPeriod() public {
        uint256 claimId = _fileDefaultClaim();
        _skipToAfterVoting();

        vm.expectRevert(IClaimsManager.VotingEnded.selector);
        vm.prank(member1);
        claimsManager.castVote(claimId, IClaimsManager.VoteType.Approve, CLAIM_AMOUNT);
    }

    function test_CastVote_RevertsOnNonMember() public {
        uint256 claimId = _fileDefaultClaim();
        _skipToVotingPeriod();

        vm.expectRevert(abi.encodeWithSelector(IClaimsManager.NotCouncilMember.selector, nonMember, COUNCIL_ID));
        vm.prank(nonMember);
        claimsManager.castVote(claimId, IClaimsManager.VoteType.Approve, CLAIM_AMOUNT);
    }

    function test_CastVote_RevertsOnApproveAmountExceedsClaim() public {
        uint256 claimId = _fileDefaultClaim();
        _skipToVotingPeriod();

        vm.expectRevert(abi.encodeWithSelector(
            IClaimsManager.ApprovedAmountExceedsClaim.selector, 
            CLAIM_AMOUNT + 1, 
            CLAIM_AMOUNT
        ));
        vm.prank(member1);
        claimsManager.castVote(claimId, IClaimsManager.VoteType.Approve, CLAIM_AMOUNT + 1);
    }

    function test_ChangeVote_Success() public {
        uint256 claimId = _fileDefaultClaim();
        _skipToVotingPeriod();

        // Initial vote
        vm.prank(member1);
        claimsManager.castVote(claimId, IClaimsManager.VoteType.Approve, CLAIM_AMOUNT);

        // Change vote
        vm.expectEmit(true, true, false, true);
        emit IClaimsManager.VoteChanged(claimId, member1, IClaimsManager.VoteType.Reject, 0);

        vm.prank(member1);
        claimsManager.changeVote(claimId, IClaimsManager.VoteType.Reject, 0);

        (IClaimsManager.VoteType voteType,,) = claimsManager.getVote(claimId, member1);
        assertEq(uint8(voteType), uint8(IClaimsManager.VoteType.Reject));
    }

    function test_ChangeVote_RevertsIfNotVoted() public {
        uint256 claimId = _fileDefaultClaim();
        _skipToVotingPeriod();

        vm.expectRevert(abi.encodeWithSelector(IClaimsManager.NotVoted.selector, member1));
        vm.prank(member1);
        claimsManager.changeVote(claimId, IClaimsManager.VoteType.Reject, 0);
    }

    // =========================================================================
    // Finalization Tests
    // =========================================================================

    function test_FinalizeClaim_Approved() public {
        uint256 claimId = _fileDefaultClaim();
        _skipToVotingPeriod();

        // All 3 members vote approve (quorum = 51% of 3 = 2)
        vm.prank(member1);
        claimsManager.castVote(claimId, IClaimsManager.VoteType.Approve, CLAIM_AMOUNT);
        vm.prank(member2);
        claimsManager.castVote(claimId, IClaimsManager.VoteType.Approve, 800e6); // Partial

        _skipToAfterVoting();

        vm.expectEmit(true, false, false, true);
        emit IClaimsManager.ClaimFinalized(claimId, IClaimsManager.ClaimStatus.Approved, 900e6); // Median

        claimsManager.finalizeClaim(claimId);

        (,,,,, IClaimsManager.ClaimStatus status,,,,,,,) = claimsManager.getClaim(claimId);
        assertEq(uint8(status), uint8(IClaimsManager.ClaimStatus.Approved));
    }

    function test_FinalizeClaim_Rejected() public {
        uint256 claimId = _fileDefaultClaim();
        _skipToVotingPeriod();

        // 2 reject votes
        vm.prank(member1);
        claimsManager.castVote(claimId, IClaimsManager.VoteType.Reject, 0);
        vm.prank(member2);
        claimsManager.castVote(claimId, IClaimsManager.VoteType.Reject, 0);

        _skipToAfterVoting();

        claimsManager.finalizeClaim(claimId);

        (,,,,, IClaimsManager.ClaimStatus status,,,,,,,) = claimsManager.getClaim(claimId);
        assertEq(uint8(status), uint8(IClaimsManager.ClaimStatus.Rejected));
    }

    function test_FinalizeClaim_Expired_NoQuorum() public {
        uint256 claimId = _fileDefaultClaim();
        _skipToVotingPeriod();

        // Only 1 vote (quorum needs 2)
        vm.prank(member1);
        claimsManager.castVote(claimId, IClaimsManager.VoteType.Approve, CLAIM_AMOUNT);

        _skipToAfterVoting();

        claimsManager.finalizeClaim(claimId);

        (,,,,, IClaimsManager.ClaimStatus status,,,,,,,) = claimsManager.getClaim(claimId);
        assertEq(uint8(status), uint8(IClaimsManager.ClaimStatus.Expired));
    }

    function test_FinalizeClaim_Expired_NoVotes() public {
        uint256 claimId = _fileDefaultClaim();
        
        _skipToAfterVoting();

        claimsManager.finalizeClaim(claimId);

        (,,,,, IClaimsManager.ClaimStatus status,,,,,,,) = claimsManager.getClaim(claimId);
        assertEq(uint8(status), uint8(IClaimsManager.ClaimStatus.Expired));
    }

    function test_FinalizeClaim_RevertsBeforeVotingEnds() public {
        uint256 claimId = _fileDefaultClaim();
        _skipToVotingPeriod();

        vm.expectRevert(IClaimsManager.VotingNotEnded.selector);
        claimsManager.finalizeClaim(claimId);
    }

    function test_FinalizeClaim_RevertsOnAlreadyFinalized() public {
        uint256 claimId = _fileDefaultClaim();
        _skipToAfterVoting();

        claimsManager.finalizeClaim(claimId);

        vm.expectRevert(abi.encodeWithSelector(
            IClaimsManager.InvalidClaimStatus.selector, 
            IClaimsManager.ClaimStatus.Expired
        ));
        claimsManager.finalizeClaim(claimId);
    }

    // =========================================================================
    // Cancellation Tests
    // =========================================================================

    function test_CancelClaim_Success() public {
        uint256 claimId = _fileDefaultClaim();

        vm.expectEmit(true, false, false, false);
        emit IClaimsManager.ClaimCancelled(claimId);

        vm.prank(claimant);
        claimsManager.cancelClaim(claimId);

        (,,,,, IClaimsManager.ClaimStatus status,,,,,,,) = claimsManager.getClaim(claimId);
        assertEq(uint8(status), uint8(IClaimsManager.ClaimStatus.Cancelled));

        // Verify collateral was unlocked
        assertEq(collateralVault.unlockCallCount(), 1);
    }

    function test_CancelClaim_RevertsOnNonClaimant() public {
        uint256 claimId = _fileDefaultClaim();

        vm.expectRevert(abi.encodeWithSelector(IClaimsManager.NotClaimant.selector, nonMember, claimant));
        vm.prank(nonMember);
        claimsManager.cancelClaim(claimId);
    }

    function test_CancelClaim_RevertsAfterVotingStarts() public {
        uint256 claimId = _fileDefaultClaim();
        _skipToVotingPeriod();

        // Cast a vote
        vm.prank(member1);
        claimsManager.castVote(claimId, IClaimsManager.VoteType.Approve, CLAIM_AMOUNT);

        vm.expectRevert(IClaimsManager.VotingAlreadyStarted.selector);
        vm.prank(claimant);
        claimsManager.cancelClaim(claimId);
    }

    // =========================================================================
    // Stats Tracking Tests
    // =========================================================================

    function test_StatsTracking() public {
        // File 3 claims
        uint256 claimId1 = _fileDefaultClaim();
        uint256 claimId2 = _fileDefaultClaim();
        uint256 claimId3 = _fileDefaultClaim();

        // Approve claim 1
        _skipToVotingPeriod();
        vm.prank(member1);
        claimsManager.castVote(claimId1, IClaimsManager.VoteType.Approve, CLAIM_AMOUNT);
        vm.prank(member2);
        claimsManager.castVote(claimId1, IClaimsManager.VoteType.Approve, CLAIM_AMOUNT);

        // Reject claim 2
        vm.prank(member1);
        claimsManager.castVote(claimId2, IClaimsManager.VoteType.Reject, 0);
        vm.prank(member2);
        claimsManager.castVote(claimId2, IClaimsManager.VoteType.Reject, 0);

        // Leave claim 3 without quorum

        _skipToAfterVoting();

        claimsManager.finalizeClaim(claimId1);
        claimsManager.finalizeClaim(claimId2);
        claimsManager.finalizeClaim(claimId3);

        (
            uint256 total,
            uint256 approved,
            uint256 rejected,
            uint256 expired,
            uint256 pending,
        ) = claimsManager.getAgentStats(AGENT_ID);

        assertEq(total, 3);
        assertEq(approved, 1);
        assertEq(rejected, 1);
        assertEq(expired, 1);
        assertEq(pending, 0);
    }

    // =========================================================================
    // Ruling Executor Integration Tests
    // =========================================================================

    function test_TransferDepositToExecutor() public {
        uint256 claimId = _fileDefaultClaim();
        uint256 deposit = (CLAIM_AMOUNT * DEPOSIT_PERCENTAGE) / 100;

        uint256 executorBalanceBefore = usdc.balanceOf(rulingExecutor);

        vm.prank(rulingExecutor);
        claimsManager.transferDepositToExecutor(claimId);

        assertEq(usdc.balanceOf(rulingExecutor), executorBalanceBefore + deposit);
    }

    function test_TransferDepositToExecutor_RevertsOnNonExecutor() public {
        uint256 claimId = _fileDefaultClaim();

        vm.expectRevert(abi.encodeWithSelector(IClaimsManager.NotRulingExecutor.selector, nonMember));
        vm.prank(nonMember);
        claimsManager.transferDepositToExecutor(claimId);
    }

    function test_ReturnDepositToClaimant() public {
        uint256 claimId = _fileDefaultClaim();
        uint256 deposit = (CLAIM_AMOUNT * DEPOSIT_PERCENTAGE) / 100;

        uint256 claimantBalanceBefore = usdc.balanceOf(claimant);

        vm.prank(rulingExecutor);
        claimsManager.returnDepositToClaimant(claimId);

        assertEq(usdc.balanceOf(claimant), claimantBalanceBefore + deposit);
    }

    function test_MarkExecuted() public {
        uint256 claimId = _fileDefaultClaim();
        _skipToAfterVoting();
        claimsManager.finalizeClaim(claimId);

        vm.prank(rulingExecutor);
        claimsManager.markExecuted(claimId);

        (,,,,, IClaimsManager.ClaimStatus status,,,,,,,) = claimsManager.getClaim(claimId);
        assertEq(uint8(status), uint8(IClaimsManager.ClaimStatus.Executed));
    }

    // =========================================================================
    // Pause Tests
    // =========================================================================

    function test_Pause_Success() public {
        vm.prank(governance);
        claimsManager.pause();

        assertTrue(claimsManager.paused());
    }

    function test_FileClaim_RevertsWhenPaused() public {
        vm.prank(governance);
        claimsManager.pause();

        vm.expectRevert(TrustfulPausable.ContractPaused.selector);
        vm.prank(claimant);
        claimsManager.fileClaim(AGENT_ID, CLAIM_AMOUNT, EVIDENCE_HASH, EVIDENCE_URI);
    }

    // =========================================================================
    // View Function Tests
    // =========================================================================

    function test_GetClaimsByAgent() public {
        _fileDefaultClaim();
        _fileDefaultClaim();
        _fileDefaultClaim();

        uint256[] memory claims = claimsManager.getClaimsByAgent(AGENT_ID);
        assertEq(claims.length, 3);
        assertEq(claims[0], 1);
        assertEq(claims[1], 2);
        assertEq(claims[2], 3);
    }

    function test_GetClaimsByClaimant() public {
        _fileDefaultClaim();
        _fileDefaultClaim();

        uint256[] memory claims = claimsManager.getClaimsByClaimant(claimant);
        assertEq(claims.length, 2);
    }

    function test_GetVoters() public {
        uint256 claimId = _fileDefaultClaim();
        _skipToVotingPeriod();

        vm.prank(member1);
        claimsManager.castVote(claimId, IClaimsManager.VoteType.Approve, CLAIM_AMOUNT);
        vm.prank(member2);
        claimsManager.castVote(claimId, IClaimsManager.VoteType.Reject, 0);

        address[] memory voters = claimsManager.getVoters(claimId);
        assertEq(voters.length, 2);
        assertEq(voters[0], member1);
        assertEq(voters[1], member2);
    }
}
