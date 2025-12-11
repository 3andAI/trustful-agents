// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { CouncilRegistry } from "../src/core/CouncilRegistry.sol";
import { ICouncilRegistry } from "../src/interfaces/ICouncilRegistry.sol";
import { TrustfulPausable } from "../src/base/TrustfulPausable.sol";

/**
 * @title CouncilRegistryTest
 * @notice Comprehensive tests for CouncilRegistry contract
 */
contract CouncilRegistryTest is Test {
    // =========================================================================
    // Test Setup
    // =========================================================================

    CouncilRegistry public registry;

    address public governance = makeAddr("governance");
    address public claimsManager = makeAddr("claimsManager");
    address public termsRegistry = makeAddr("termsRegistry");
    
    address public member1 = makeAddr("member1");
    address public member2 = makeAddr("member2");
    address public member3 = makeAddr("member3");
    address public member4 = makeAddr("member4");
    address public member5 = makeAddr("member5");
    address public nonMember = makeAddr("nonMember");

    bytes32 public constant COUNCIL_ID = keccak256("test-council");
    uint256 public constant AGENT_ID = 1;

    // Default council parameters
    uint256 public constant QUORUM_PERCENTAGE = 51;
    uint256 public constant DEPOSIT_PERCENTAGE = 10;
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant EVIDENCE_PERIOD = 3 days;

    function setUp() public {
        // Deploy registry
        registry = new CouncilRegistry(governance);

        // Setup roles
        vm.startPrank(governance);
        registry.setClaimsManager(claimsManager);
        registry.setTermsRegistry(termsRegistry);
        vm.stopPrank();
    }

    // =========================================================================
    // Helper Functions
    // =========================================================================

    function _createDefaultCouncil() internal returns (bytes32) {
        address[] memory members = new address[](3);
        members[0] = member1;
        members[1] = member2;
        members[2] = member3;

        vm.prank(governance);
        registry.createCouncil(
            COUNCIL_ID,
            members,
            QUORUM_PERCENTAGE,
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );
        return COUNCIL_ID;
    }

    function _createActiveCouncil() internal returns (bytes32) {
        bytes32 councilId = _createDefaultCouncil();
        vm.prank(governance);
        registry.activateCouncil(councilId);
        return councilId;
    }

    // =========================================================================
    // Constructor Tests
    // =========================================================================

    function test_Constructor_SetsCorrectValues() public view {
        assertEq(registry.governance(), governance);
    }

    function test_Constructor_RevertsOnZeroGovernance() public {
        vm.expectRevert();
        new CouncilRegistry(address(0));
    }

    // =========================================================================
    // Council Creation Tests
    // =========================================================================

    function test_CreateCouncil_Success() public {
        address[] memory members = new address[](3);
        members[0] = member1;
        members[1] = member2;
        members[2] = member3;

        vm.expectEmit(true, false, false, true);
        emit ICouncilRegistry.CouncilCreated(
            COUNCIL_ID,
            members,
            QUORUM_PERCENTAGE,
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );

        vm.prank(governance);
        registry.createCouncil(
            COUNCIL_ID,
            members,
            QUORUM_PERCENTAGE,
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );

        // Verify council state
        (
            uint256 quorum,
            uint256 deposit,
            uint256 voting,
            uint256 evidence,
            uint256 memberCount,
            uint256 createdAt,
            bool active
        ) = registry.getCouncil(COUNCIL_ID);

        assertEq(quorum, QUORUM_PERCENTAGE);
        assertEq(deposit, DEPOSIT_PERCENTAGE);
        assertEq(voting, VOTING_PERIOD);
        assertEq(evidence, EVIDENCE_PERIOD);
        assertEq(memberCount, 3);
        assertEq(createdAt, block.timestamp);
        assertFalse(active); // Not active until explicitly activated
    }

    function test_CreateCouncil_RevertsOnNonGovernance() public {
        address[] memory members = new address[](1);
        members[0] = member1;

        vm.expectRevert(abi.encodeWithSelector(TrustfulPausable.NotGovernance.selector, nonMember));
        vm.prank(nonMember);
        registry.createCouncil(
            COUNCIL_ID,
            members,
            QUORUM_PERCENTAGE,
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );
    }

    function test_CreateCouncil_RevertsOnDuplicateId() public {
        _createDefaultCouncil();

        address[] memory members = new address[](1);
        members[0] = member1;

        vm.expectRevert(abi.encodeWithSelector(ICouncilRegistry.CouncilAlreadyExists.selector, COUNCIL_ID));
        vm.prank(governance);
        registry.createCouncil(
            COUNCIL_ID,
            members,
            QUORUM_PERCENTAGE,
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );
    }

    function test_CreateCouncil_RevertsOnEmptyMembers() public {
        address[] memory members = new address[](0);

        vm.expectRevert(ICouncilRegistry.EmptyMemberList.selector);
        vm.prank(governance);
        registry.createCouncil(
            COUNCIL_ID,
            members,
            QUORUM_PERCENTAGE,
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );
    }

    function test_CreateCouncil_RevertsOnZeroAddressMember() public {
        address[] memory members = new address[](2);
        members[0] = member1;
        members[1] = address(0);

        vm.expectRevert(ICouncilRegistry.ZeroAddressMember.selector);
        vm.prank(governance);
        registry.createCouncil(
            COUNCIL_ID,
            members,
            QUORUM_PERCENTAGE,
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );
    }

    function test_CreateCouncil_RevertsOnDuplicateMember() public {
        address[] memory members = new address[](2);
        members[0] = member1;
        members[1] = member1;

        vm.expectRevert(abi.encodeWithSelector(ICouncilRegistry.DuplicateMember.selector, member1));
        vm.prank(governance);
        registry.createCouncil(
            COUNCIL_ID,
            members,
            QUORUM_PERCENTAGE,
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );
    }

    function test_CreateCouncil_RevertsOnInvalidQuorum() public {
        address[] memory members = new address[](1);
        members[0] = member1;

        // Too low
        vm.expectRevert(abi.encodeWithSelector(ICouncilRegistry.InvalidQuorumPercentage.selector, 5));
        vm.prank(governance);
        registry.createCouncil(COUNCIL_ID, members, 5, DEPOSIT_PERCENTAGE, VOTING_PERIOD, EVIDENCE_PERIOD);

        // Too high
        vm.expectRevert(abi.encodeWithSelector(ICouncilRegistry.InvalidQuorumPercentage.selector, 101));
        vm.prank(governance);
        registry.createCouncil(COUNCIL_ID, members, 101, DEPOSIT_PERCENTAGE, VOTING_PERIOD, EVIDENCE_PERIOD);
    }

    function test_CreateCouncil_RevertsOnInvalidDepositPercentage() public {
        address[] memory members = new address[](1);
        members[0] = member1;

        vm.expectRevert(abi.encodeWithSelector(ICouncilRegistry.InvalidDepositPercentage.selector, 51));
        vm.prank(governance);
        registry.createCouncil(COUNCIL_ID, members, QUORUM_PERCENTAGE, 51, VOTING_PERIOD, EVIDENCE_PERIOD);
    }

    function test_CreateCouncil_RevertsOnInvalidVotingPeriod() public {
        address[] memory members = new address[](1);
        members[0] = member1;

        // Too short
        vm.expectRevert(abi.encodeWithSelector(ICouncilRegistry.InvalidVotingPeriod.selector, 1 hours));
        vm.prank(governance);
        registry.createCouncil(COUNCIL_ID, members, QUORUM_PERCENTAGE, DEPOSIT_PERCENTAGE, 1 hours, EVIDENCE_PERIOD);

        // Too long
        vm.expectRevert(abi.encodeWithSelector(ICouncilRegistry.InvalidVotingPeriod.selector, 60 days));
        vm.prank(governance);
        registry.createCouncil(COUNCIL_ID, members, QUORUM_PERCENTAGE, DEPOSIT_PERCENTAGE, 60 days, EVIDENCE_PERIOD);
    }

    function test_CreateCouncil_RevertsOnInvalidEvidencePeriod() public {
        address[] memory members = new address[](1);
        members[0] = member1;

        // Too short
        vm.expectRevert(abi.encodeWithSelector(ICouncilRegistry.InvalidEvidencePeriod.selector, 1 hours));
        vm.prank(governance);
        registry.createCouncil(COUNCIL_ID, members, QUORUM_PERCENTAGE, DEPOSIT_PERCENTAGE, VOTING_PERIOD, 1 hours);

        // Too long
        vm.expectRevert(abi.encodeWithSelector(ICouncilRegistry.InvalidEvidencePeriod.selector, 30 days));
        vm.prank(governance);
        registry.createCouncil(COUNCIL_ID, members, QUORUM_PERCENTAGE, DEPOSIT_PERCENTAGE, VOTING_PERIOD, 30 days);
    }

    // =========================================================================
    // Council Activation/Deactivation Tests
    // =========================================================================

    function test_ActivateCouncil_Success() public {
        _createDefaultCouncil();

        vm.expectEmit(true, false, false, false);
        emit ICouncilRegistry.CouncilActivated(COUNCIL_ID);

        vm.prank(governance);
        registry.activateCouncil(COUNCIL_ID);

        assertTrue(registry.isCouncilActive(COUNCIL_ID));
    }

    function test_ActivateCouncil_RevertsOnNonExistent() public {
        vm.expectRevert(abi.encodeWithSelector(ICouncilRegistry.CouncilNotFound.selector, COUNCIL_ID));
        vm.prank(governance);
        registry.activateCouncil(COUNCIL_ID);
    }

    function test_DeactivateCouncil_Success() public {
        _createActiveCouncil();

        vm.expectEmit(true, false, false, false);
        emit ICouncilRegistry.CouncilDeactivated(COUNCIL_ID);

        vm.prank(governance);
        registry.deactivateCouncil(COUNCIL_ID);

        assertFalse(registry.isCouncilActive(COUNCIL_ID));
    }

    // =========================================================================
    // Council Closure Tests
    // =========================================================================

    function test_CloseCouncil_Success() public {
        _createActiveCouncil();
        
        // Deactivate first
        vm.prank(governance);
        registry.deactivateCouncil(COUNCIL_ID);

        vm.expectEmit(true, false, false, false);
        emit ICouncilRegistry.CouncilClosed(COUNCIL_ID);

        vm.prank(governance);
        registry.closeCouncil(COUNCIL_ID);

        assertTrue(registry.isCouncilClosed(COUNCIL_ID));
    }

    function test_CloseCouncil_RevertsIfActive() public {
        _createActiveCouncil();

        vm.expectRevert(abi.encodeWithSelector(ICouncilRegistry.CouncilNotActive.selector, COUNCIL_ID));
        vm.prank(governance);
        registry.closeCouncil(COUNCIL_ID);
    }

    function test_CloseCouncil_RevertsIfHasPendingClaims() public {
        _createActiveCouncil();
        
        // Add pending claim
        vm.prank(claimsManager);
        registry.incrementPendingClaims(COUNCIL_ID);

        // Deactivate
        vm.prank(governance);
        registry.deactivateCouncil(COUNCIL_ID);

        vm.expectRevert(abi.encodeWithSelector(ICouncilRegistry.CouncilHasPendingClaims.selector, COUNCIL_ID, 1));
        vm.prank(governance);
        registry.closeCouncil(COUNCIL_ID);
    }

    // =========================================================================
    // Member Management Tests
    // =========================================================================

    function test_AddMember_Success() public {
        _createActiveCouncil();

        vm.expectEmit(true, true, false, false);
        emit ICouncilRegistry.MemberAdded(COUNCIL_ID, member4);

        vm.prank(governance);
        registry.addMember(COUNCIL_ID, member4);

        assertTrue(registry.isMember(COUNCIL_ID, member4));
        assertEq(registry.getActiveMemberCount(COUNCIL_ID), 4);
    }

    function test_AddMember_RevertsOnDuplicate() public {
        _createActiveCouncil();

        vm.expectRevert(abi.encodeWithSelector(ICouncilRegistry.MemberAlreadyExists.selector, COUNCIL_ID, member1));
        vm.prank(governance);
        registry.addMember(COUNCIL_ID, member1);
    }

    function test_RemoveMember_Success() public {
        _createActiveCouncil();

        vm.expectEmit(true, true, false, false);
        emit ICouncilRegistry.MemberRemoved(COUNCIL_ID, member1);

        vm.prank(governance);
        registry.removeMember(COUNCIL_ID, member1);

        assertFalse(registry.isMember(COUNCIL_ID, member1));
        assertEq(registry.getActiveMemberCount(COUNCIL_ID), 2);
    }

    function test_RemoveMember_RevertsOnLastMember() public {
        address[] memory members = new address[](1);
        members[0] = member1;

        vm.prank(governance);
        registry.createCouncil(
            COUNCIL_ID,
            members,
            QUORUM_PERCENTAGE,
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );

        vm.expectRevert(abi.encodeWithSelector(ICouncilRegistry.CannotRemoveLastMember.selector, COUNCIL_ID));
        vm.prank(governance);
        registry.removeMember(COUNCIL_ID, member1);
    }

    function test_SuspendMember_Success() public {
        _createActiveCouncil();

        vm.expectEmit(true, true, false, false);
        emit ICouncilRegistry.MemberSuspended(COUNCIL_ID, member1);

        vm.prank(governance);
        registry.suspendMember(COUNCIL_ID, member1);

        (bool active, bool suspended,) = registry.getMemberStatus(COUNCIL_ID, member1);
        assertTrue(active);
        assertTrue(suspended);
        
        // Suspended member still counts but can't vote
        assertEq(registry.getActiveMemberCount(COUNCIL_ID), 2); // Suspended decreases active count
    }

    function test_ReinstateMember_Success() public {
        _createActiveCouncil();

        vm.prank(governance);
        registry.suspendMember(COUNCIL_ID, member1);

        vm.expectEmit(true, true, false, false);
        emit ICouncilRegistry.MemberReinstated(COUNCIL_ID, member1);

        vm.prank(governance);
        registry.reinstateMember(COUNCIL_ID, member1);

        (bool active, bool suspended,) = registry.getMemberStatus(COUNCIL_ID, member1);
        assertTrue(active);
        assertFalse(suspended);
    }

    // =========================================================================
    // Member Voting Tests
    // =========================================================================

    function test_CanVote_ActiveMember() public {
        _createActiveCouncil();
        assertTrue(registry.canVote(COUNCIL_ID, member1));
    }

    function test_CanVote_SuspendedMemberCannotVote() public {
        _createActiveCouncil();

        vm.prank(governance);
        registry.suspendMember(COUNCIL_ID, member1);

        assertFalse(registry.canVote(COUNCIL_ID, member1));
    }

    function test_CanVote_NonMemberCannotVote() public {
        _createActiveCouncil();
        assertFalse(registry.canVote(COUNCIL_ID, nonMember));
    }

    function test_IncrementMemberVotes() public {
        _createActiveCouncil();

        vm.prank(claimsManager);
        registry.incrementMemberVotes(COUNCIL_ID, member1);

        (,, uint256 totalVotes) = registry.getMemberStatus(COUNCIL_ID, member1);
        assertEq(totalVotes, 1);
    }

    // =========================================================================
    // Agent Council Assignment Tests
    // =========================================================================

    function test_RegisterAgentWithCouncil_Success() public {
        _createActiveCouncil();

        vm.prank(termsRegistry);
        registry.registerAgentWithCouncil(AGENT_ID, COUNCIL_ID);

        assertEq(registry.getAgentCouncil(AGENT_ID), COUNCIL_ID);
    }

    function test_RegisterAgentWithCouncil_RevertsOnInactiveCouncil() public {
        _createDefaultCouncil(); // Not activated

        vm.expectRevert(abi.encodeWithSelector(ICouncilRegistry.CouncilNotActive.selector, COUNCIL_ID));
        vm.prank(termsRegistry);
        registry.registerAgentWithCouncil(AGENT_ID, COUNCIL_ID);
    }

    function test_ReassignAgentCouncil_GovernanceOverride() public {
        _createActiveCouncil();
        
        bytes32 newCouncilId = keccak256("new-council");
        address[] memory members = new address[](2);
        members[0] = member4;
        members[1] = member5;

        vm.startPrank(governance);
        registry.createCouncil(newCouncilId, members, QUORUM_PERCENTAGE, DEPOSIT_PERCENTAGE, VOTING_PERIOD, EVIDENCE_PERIOD);
        registry.activateCouncil(newCouncilId);
        vm.stopPrank();

        vm.prank(termsRegistry);
        registry.registerAgentWithCouncil(AGENT_ID, COUNCIL_ID);

        vm.prank(governance);
        registry.reassignAgentCouncil(AGENT_ID, newCouncilId);

        assertEq(registry.getAgentCouncil(AGENT_ID), newCouncilId);
    }

    function test_UnregisterAgentFromCouncil_Success() public {
        _createActiveCouncil();

        vm.prank(termsRegistry);
        registry.registerAgentWithCouncil(AGENT_ID, COUNCIL_ID);

        vm.prank(termsRegistry);
        registry.unregisterAgentFromCouncil(AGENT_ID);

        assertEq(registry.getAgentCouncil(AGENT_ID), bytes32(0));
    }

    // =========================================================================
    // Pending Claims Management Tests
    // =========================================================================

    function test_IncrementDecrementPendingClaims() public {
        _createActiveCouncil();

        vm.prank(claimsManager);
        registry.incrementPendingClaims(COUNCIL_ID);
        assertEq(registry.getPendingClaimsCount(COUNCIL_ID), 1);

        vm.prank(claimsManager);
        registry.incrementPendingClaims(COUNCIL_ID);
        assertEq(registry.getPendingClaimsCount(COUNCIL_ID), 2);

        vm.prank(claimsManager);
        registry.decrementPendingClaims(COUNCIL_ID);
        assertEq(registry.getPendingClaimsCount(COUNCIL_ID), 1);
    }

    function test_IncrementPendingClaims_RevertsOnNonClaimsManager() public {
        _createActiveCouncil();

        vm.expectRevert(abi.encodeWithSelector(ICouncilRegistry.NotClaimsManager.selector, nonMember));
        vm.prank(nonMember);
        registry.incrementPendingClaims(COUNCIL_ID);
    }

    // =========================================================================
    // Quorum Calculation Tests
    // =========================================================================

    function test_CalculateQuorum() public {
        _createActiveCouncil(); // 3 members, 51% quorum

        // 51% of 3 = 1.53, rounds up to 2
        assertEq(registry.calculateQuorum(COUNCIL_ID), 2);
    }

    function test_CalculateQuorum_With100Percent() public {
        address[] memory members = new address[](3);
        members[0] = member1;
        members[1] = member2;
        members[2] = member3;

        vm.prank(governance);
        registry.createCouncil(
            COUNCIL_ID,
            members,
            100, // 100% quorum
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );

        assertEq(registry.calculateQuorum(COUNCIL_ID), 3);
    }

    // =========================================================================
    // View Functions Tests
    // =========================================================================

    function test_GetCouncilMembers() public {
        _createActiveCouncil();

        address[] memory members = registry.getCouncilMembers(COUNCIL_ID);
        assertEq(members.length, 3);
        assertEq(members[0], member1);
        assertEq(members[1], member2);
        assertEq(members[2], member3);
    }

    function test_CouncilStatus() public {
        _createDefaultCouncil();

        (bool exists, bool active) = registry.councilStatus(COUNCIL_ID);
        assertTrue(exists);
        assertFalse(active);

        vm.prank(governance);
        registry.activateCouncil(COUNCIL_ID);

        (exists, active) = registry.councilStatus(COUNCIL_ID);
        assertTrue(exists);
        assertTrue(active);
    }

    // =========================================================================
    // Parameter Update Tests
    // =========================================================================

    function test_UpdateCouncilParameters_Success() public {
        _createActiveCouncil();

        vm.prank(governance);
        registry.updateCouncilParameters(COUNCIL_ID, 75, 15, 10 days, 5 days);

        (
            uint256 quorum,
            uint256 deposit,
            uint256 voting,
            uint256 evidence,
            ,
            ,
        ) = registry.getCouncil(COUNCIL_ID);

        assertEq(quorum, 75);
        assertEq(deposit, 15);
        assertEq(voting, 10 days);
        assertEq(evidence, 5 days);
    }

    // =========================================================================
    // Pause Tests
    // =========================================================================

    function test_Pause_Success() public {
        vm.prank(governance);
        registry.pause();

        assertTrue(registry.paused());
    }

    function test_Pause_RevertsOnNonGovernance() public {
        vm.expectRevert(abi.encodeWithSelector(TrustfulPausable.NotGovernance.selector, nonMember));
        vm.prank(nonMember);
        registry.pause();
    }

    function test_CreateCouncil_RevertsWhenPaused() public {
        vm.prank(governance);
        registry.pause();

        address[] memory members = new address[](1);
        members[0] = member1;

        vm.expectRevert(TrustfulPausable.ContractPaused.selector);
        vm.prank(governance);
        registry.createCouncil(COUNCIL_ID, members, QUORUM_PERCENTAGE, DEPOSIT_PERCENTAGE, VOTING_PERIOD, EVIDENCE_PERIOD);
    }
}
