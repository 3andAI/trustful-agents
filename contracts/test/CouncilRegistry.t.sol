// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { CouncilRegistry } from "../src/core/CouncilRegistry.sol";
import { ICouncilRegistry } from "../src/interfaces/ICouncilRegistry.sol";
import { TrustfulPausable } from "../src/base/TrustfulPausable.sol";
import { ITrustfulPausable } from "../src/interfaces/ITrustfulPausable.sol";

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

    uint256 public constant AGENT_ID = 1;

    // Default council parameters (in basis points: 100 = 1%, 10000 = 100%)
    string public constant COUNCIL_NAME = "Test Council";
    string public constant COUNCIL_DESCRIPTION = "A test council for DeFi";
    string public constant COUNCIL_VERTICAL = "defi";
    uint256 public constant QUORUM_PERCENTAGE = 5100;  // 51%
    uint256 public constant DEPOSIT_PERCENTAGE = 1000; // 10%
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
        vm.prank(governance);
        bytes32 councilId = registry.createCouncil(
            COUNCIL_NAME,
            COUNCIL_DESCRIPTION,
            COUNCIL_VERTICAL,
            QUORUM_PERCENTAGE,
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );
        return councilId;
    }

    function _createCouncilWithMembers() internal returns (bytes32) {
        bytes32 councilId = _createDefaultCouncil();
        
        vm.startPrank(governance);
        registry.addMember(councilId, member1);
        registry.addMember(councilId, member2);
        registry.addMember(councilId, member3);
        vm.stopPrank();
        
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
        vm.expectEmit(false, false, false, true);
        emit ICouncilRegistry.CouncilCreated(
            bytes32(0), // councilId is generated, we don't know it ahead of time
            COUNCIL_NAME,
            COUNCIL_VERTICAL,
            QUORUM_PERCENTAGE,
            DEPOSIT_PERCENTAGE
        );

        vm.prank(governance);
        bytes32 councilId = registry.createCouncil(
            COUNCIL_NAME,
            COUNCIL_DESCRIPTION,
            COUNCIL_VERTICAL,
            QUORUM_PERCENTAGE,
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );

        // Verify council state
        ICouncilRegistry.Council memory council = registry.getCouncil(councilId);

        assertEq(council.quorumPercentage, QUORUM_PERCENTAGE);
        assertEq(council.claimDepositPercentage, DEPOSIT_PERCENTAGE);
        assertEq(council.votingPeriod, VOTING_PERIOD);
        assertEq(council.evidencePeriod, EVIDENCE_PERIOD);
        assertEq(council.memberCount, 0);
        assertEq(council.createdAt, block.timestamp);
        assertTrue(council.active); // Councils are active by default
    }

    function test_CreateCouncil_RevertsOnNonGovernance() public {
        vm.expectRevert(abi.encodeWithSelector(TrustfulPausable.NotGovernance.selector, nonMember));
        vm.prank(nonMember);
        registry.createCouncil(
            COUNCIL_NAME,
            COUNCIL_DESCRIPTION,
            COUNCIL_VERTICAL,
            QUORUM_PERCENTAGE,
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );
    }

    function test_CreateCouncil_RevertsOnInvalidQuorum() public {
        // Quorum too low (below 10% = 1000 basis points)
        vm.expectRevert();
        vm.prank(governance);
        registry.createCouncil(
            COUNCIL_NAME,
            COUNCIL_DESCRIPTION,
            COUNCIL_VERTICAL,
            500, // 5% - Too low
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );

        // Quorum too high (above 100% = 10000 basis points)
        vm.expectRevert();
        vm.prank(governance);
        registry.createCouncil(
            "Another Council",
            COUNCIL_DESCRIPTION,
            COUNCIL_VERTICAL,
            10100, // 101% - Too high
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );
    }

    function test_CreateCouncil_RevertsOnInvalidDepositPercentage() public {
        // Deposit percentage too high (above 50% = 5000 basis points)
        vm.expectRevert();
        vm.prank(governance);
        registry.createCouncil(
            COUNCIL_NAME,
            COUNCIL_DESCRIPTION,
            COUNCIL_VERTICAL,
            QUORUM_PERCENTAGE,
            5100, // 51% - Too high
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );
    }

    function test_CreateCouncil_RevertsOnInvalidVotingPeriod() public {
        // Voting period too short
        vm.expectRevert();
        vm.prank(governance);
        registry.createCouncil(
            COUNCIL_NAME,
            COUNCIL_DESCRIPTION,
            COUNCIL_VERTICAL,
            QUORUM_PERCENTAGE,
            DEPOSIT_PERCENTAGE,
            0, // Too short
            EVIDENCE_PERIOD
        );
    }

    // =========================================================================
    // Member Management Tests
    // =========================================================================

    function test_AddMember_Success() public {
        bytes32 councilId = _createDefaultCouncil();

        vm.expectEmit(true, true, false, false);
        emit ICouncilRegistry.MemberAdded(councilId, member1);

        vm.prank(governance);
        registry.addMember(councilId, member1);

        ICouncilRegistry.Council memory council = registry.getCouncil(councilId);
        assertEq(council.memberCount, 1);
        assertTrue(registry.isActiveMember(councilId, member1));
    }

    function test_AddMember_RevertsOnNonGovernance() public {
        bytes32 councilId = _createDefaultCouncil();

        vm.expectRevert(abi.encodeWithSelector(TrustfulPausable.NotGovernance.selector, nonMember));
        vm.prank(nonMember);
        registry.addMember(councilId, member1);
    }

    function test_AddMember_RevertsOnZeroAddress() public {
        bytes32 councilId = _createDefaultCouncil();

        vm.expectRevert();
        vm.prank(governance);
        registry.addMember(councilId, address(0));
    }

    function test_AddMember_RevertsOnDuplicateMember() public {
        bytes32 councilId = _createDefaultCouncil();

        vm.startPrank(governance);
        registry.addMember(councilId, member1);
        
        vm.expectRevert();
        registry.addMember(councilId, member1);
        vm.stopPrank();
    }

    function test_RemoveMember_Success() public {
        bytes32 councilId = _createCouncilWithMembers();

        vm.expectEmit(true, true, false, false);
        emit ICouncilRegistry.MemberRemoved(councilId, member1);

        vm.prank(governance);
        registry.removeMember(councilId, member1);

        ICouncilRegistry.Council memory council = registry.getCouncil(councilId);
        assertEq(council.memberCount, 2);
        assertFalse(registry.isActiveMember(councilId, member1));
    }

    function test_RemoveMember_RevertsOnNonMember() public {
        bytes32 councilId = _createCouncilWithMembers();

        vm.expectRevert();
        vm.prank(governance);
        registry.removeMember(councilId, nonMember);
    }

    function test_SuspendMember_Success() public {
        bytes32 councilId = _createCouncilWithMembers();

        vm.expectEmit(true, true, false, false);
        emit ICouncilRegistry.MemberSuspended(councilId, member1);

        vm.prank(governance);
        registry.suspendMember(councilId, member1);

        // Member is suspended (not active but still exists)
        ICouncilRegistry.CouncilMember memory memberData = registry.getMember(councilId, member1);
        assertTrue(memberData.joinedAt != 0); // Still exists
        assertFalse(registry.isActiveMember(councilId, member1)); // But not active
    }

    function test_ReinstateMember_Success() public {
        bytes32 councilId = _createCouncilWithMembers();

        vm.startPrank(governance);
        registry.suspendMember(councilId, member1);
        
        vm.expectEmit(true, true, false, false);
        emit ICouncilRegistry.MemberReinstated(councilId, member1);
        
        registry.reinstateMember(councilId, member1);
        vm.stopPrank();

        assertTrue(registry.isActiveMember(councilId, member1));
    }

    // =========================================================================
    // Council Activation/Deactivation Tests
    // =========================================================================

    function test_DeactivateCouncil_Success() public {
        bytes32 councilId = _createDefaultCouncil();

        vm.expectEmit(true, false, false, false);
        emit ICouncilRegistry.CouncilDeactivated(councilId);

        vm.prank(governance);
        registry.deactivateCouncil(councilId);

        ICouncilRegistry.Council memory council = registry.getCouncil(councilId);
        assertFalse(council.active);
    }

    function test_ActivateCouncil_Success() public {
        bytes32 councilId = _createDefaultCouncil();

        vm.startPrank(governance);
        registry.deactivateCouncil(councilId);
        
        vm.expectEmit(true, false, false, false);
        emit ICouncilRegistry.CouncilActivated(councilId);
        
        registry.activateCouncil(councilId);
        vm.stopPrank();

        ICouncilRegistry.Council memory council = registry.getCouncil(councilId);
        assertTrue(council.active);
    }

    // =========================================================================
    // Council Closure Tests
    // =========================================================================

    function test_CloseCouncil_Success() public {
        bytes32 councilId = _createCouncilWithMembers();

        vm.expectEmit(true, false, false, true);
        emit ICouncilRegistry.CouncilClosed(councilId, block.timestamp);

        vm.prank(governance);
        registry.closeCouncil(councilId);

        ICouncilRegistry.Council memory council = registry.getCouncil(councilId);
        assertEq(council.closedAt, block.timestamp);
    }

    function test_CloseCouncil_RevertsWithActiveAgents() public {
        bytes32 councilId = _createCouncilWithMembers();

        // Register an agent with the council (via termsRegistry)
        vm.prank(termsRegistry);
        registry.registerAgentWithCouncil(councilId);

        vm.expectRevert(abi.encodeWithSelector(ICouncilRegistry.CouncilHasActiveAgents.selector, councilId, 1));
        vm.prank(governance);
        registry.closeCouncil(councilId);
    }

    function test_CloseCouncil_RevertsWithPendingClaims() public {
        bytes32 councilId = _createCouncilWithMembers();

        // Register pending claim
        vm.prank(claimsManager);
        registry.incrementPendingClaims(councilId);

        vm.expectRevert(abi.encodeWithSelector(ICouncilRegistry.CouncilHasPendingClaims.selector, councilId, 1));
        vm.prank(governance);
        registry.closeCouncil(councilId);
    }

    // =========================================================================
    // Agent Assignment Tests
    // =========================================================================

    function test_RegisterAgentWithCouncil_Success() public {
        bytes32 councilId = _createCouncilWithMembers();

        vm.prank(termsRegistry);
        registry.registerAgentWithCouncil(councilId);

        assertEq(registry.getAgentCountByCouncil(councilId), 1);
    }

    function test_RegisterAgentWithCouncil_RevertsOnNonTermsRegistry() public {
        bytes32 councilId = _createCouncilWithMembers();

        vm.expectRevert();
        vm.prank(nonMember);
        registry.registerAgentWithCouncil(councilId);
    }

    function test_UnregisterAgentFromCouncil_Success() public {
        bytes32 councilId = _createCouncilWithMembers();

        vm.startPrank(termsRegistry);
        registry.registerAgentWithCouncil(councilId);
        registry.registerAgentWithCouncil(councilId);
        assertEq(registry.getAgentCountByCouncil(councilId), 2);
        
        registry.unregisterAgentFromCouncil(councilId);
        vm.stopPrank();

        assertEq(registry.getAgentCountByCouncil(councilId), 1);
    }

    function test_ReassignAgentCouncil_Success() public {
        bytes32 councilId1 = _createCouncilWithMembers();
        
        // Create second council
        vm.prank(governance);
        bytes32 councilId2 = registry.createCouncil(
            "Second Council",
            "Another test council",
            "healthcare",
            QUORUM_PERCENTAGE,
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );
        
        vm.startPrank(governance);
        registry.addMember(councilId2, member4);
        registry.addMember(councilId2, member5);
        vm.stopPrank();

        // Mock ClaimsManager to return 0 pending claims
        vm.mockCall(
            claimsManager,
            abi.encodeWithSignature("getPendingClaimCount(uint256)", AGENT_ID),
            abi.encode(uint256(0))
        );

        // Reassign via governance override (no prior assignment needed)
        vm.expectEmit(true, true, true, false);
        emit ICouncilRegistry.AgentCouncilReassigned(AGENT_ID, bytes32(0), councilId2);

        vm.prank(governance);
        registry.reassignAgentCouncil(AGENT_ID, councilId2);

        assertEq(registry.getAgentCouncil(AGENT_ID), councilId2);
    }

    // =========================================================================
    // Pending Claims Tests
    // =========================================================================

    function test_IncrementPendingClaims_Success() public {
        bytes32 councilId = _createDefaultCouncil();

        vm.prank(claimsManager);
        registry.incrementPendingClaims(councilId);

        assertEq(registry.getPendingClaimCountByCouncil(councilId), 1);
    }

    function test_DecrementPendingClaims_Success() public {
        bytes32 councilId = _createDefaultCouncil();

        vm.startPrank(claimsManager);
        registry.incrementPendingClaims(councilId);
        registry.incrementPendingClaims(councilId);
        registry.decrementPendingClaims(councilId);
        vm.stopPrank();

        assertEq(registry.getPendingClaimCountByCouncil(councilId), 1);
    }

    // =========================================================================
    // Quorum Calculation Tests
    // =========================================================================

    function test_GetRequiredQuorum_Success() public {
        bytes32 councilId = _createCouncilWithMembers();

        // 3 members, 51% quorum = 2 required (rounds up)
        uint256 requiredQuorum = registry.calculateQuorum(councilId);
        assertEq(requiredQuorum, 2);
    }

    function test_GetRequiredQuorum_RoundsUp() public {
        bytes32 councilId = _createDefaultCouncil();

        // Add 5 members
        vm.startPrank(governance);
        registry.addMember(councilId, member1);
        registry.addMember(councilId, member2);
        registry.addMember(councilId, member3);
        registry.addMember(councilId, member4);
        registry.addMember(councilId, member5);
        vm.stopPrank();

        // 5 members, 51% quorum = 3 required (2.55 rounds up to 3)
        uint256 requiredQuorum = registry.calculateQuorum(councilId);
        assertEq(requiredQuorum, 3);
    }

    // =========================================================================
    // View Function Tests
    // =========================================================================

    function test_GetCouncilMembers_Success() public {
        bytes32 councilId = _createCouncilWithMembers();

        address[] memory members = registry.getCouncilMembers(councilId);
        assertEq(members.length, 3);
    }

    function test_GetActiveCouncils_Success() public {
        _createDefaultCouncil();
        
        vm.prank(governance);
        registry.createCouncil(
            "Second Council",
            "Another description",
            "healthcare",
            QUORUM_PERCENTAGE,
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );

        bytes32[] memory councils = registry.getActiveCouncils();
        assertEq(councils.length, 2);
    }

    function test_GetCouncilsByVertical_Success() public {
        _createDefaultCouncil(); // defi
        
        vm.prank(governance);
        registry.createCouncil(
            "Healthcare Council",
            "Healthcare description",
            "healthcare",
            QUORUM_PERCENTAGE,
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );

        bytes32[] memory defiCouncils = registry.getCouncilsByVertical("defi");
        assertEq(defiCouncils.length, 1);

        bytes32[] memory healthcareCouncils = registry.getCouncilsByVertical("healthcare");
        assertEq(healthcareCouncils.length, 1);
    }

    function test_IsCouncilActive_Success() public {
        bytes32 councilId = _createDefaultCouncil();

        assertTrue(registry.isCouncilActive(councilId));

        vm.prank(governance);
        registry.deactivateCouncil(councilId);

        assertFalse(registry.isCouncilActive(councilId));
    }

    // =========================================================================
    // Agent Reassignment with Pending Claims Tests
    // =========================================================================

    function test_ReassignAgentCouncil_RevertsWhenHasPendingClaims() public {
        bytes32 councilId1 = _createDefaultCouncil();
        
        vm.prank(governance);
        bytes32 councilId2 = registry.createCouncil(
            "Second Council",
            "Second council description",
            "healthcare",
            QUORUM_PERCENTAGE,
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );

        // Mock ClaimsManager to return 0 pending claims initially (for first assignment)
        vm.mockCall(
            claimsManager,
            abi.encodeWithSignature("getPendingClaimCount(uint256)", AGENT_ID),
            abi.encode(uint256(0))
        );

        // First, assign agent to council1
        vm.prank(governance);
        registry.reassignAgentCouncil(AGENT_ID, councilId1);

        // Now mock ClaimsManager to return pending claims > 0
        vm.mockCall(
            claimsManager,
            abi.encodeWithSignature("getPendingClaimCount(uint256)", AGENT_ID),
            abi.encode(uint256(1))
        );

        // Try to reassign - should revert
        vm.prank(governance);
        vm.expectRevert(abi.encodeWithSelector(ICouncilRegistry.AgentHasOpenClaims.selector, AGENT_ID, 1));
        registry.reassignAgentCouncil(AGENT_ID, councilId2);
    }

    function test_ReassignAgentCouncil_SucceedsWhenNoPendingClaims() public {
        bytes32 councilId1 = _createDefaultCouncil();
        
        vm.prank(governance);
        bytes32 councilId2 = registry.createCouncil(
            "Second Council",
            "Second council description",
            "healthcare",
            QUORUM_PERCENTAGE,
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );

        // Mock ClaimsManager to return pending claims = 0
        vm.mockCall(
            claimsManager,
            abi.encodeWithSignature("getPendingClaimCount(uint256)", AGENT_ID),
            abi.encode(uint256(0))
        );

        // First, assign agent to council1
        vm.prank(governance);
        registry.reassignAgentCouncil(AGENT_ID, councilId1);

        // Reassign to council2 - should succeed (still 0 pending)
        vm.prank(governance);
        registry.reassignAgentCouncil(AGENT_ID, councilId2);

        assertEq(registry.getAgentCouncil(AGENT_ID), councilId2);
    }

    function test_ReassignAgentCouncil_SucceedsWhenClaimsManagerNotSet() public {
        // Deploy a fresh registry without claimsManager
        CouncilRegistry freshRegistry = new CouncilRegistry(governance);
        
        vm.prank(governance);
        bytes32 councilId = freshRegistry.createCouncil(
            COUNCIL_NAME,
            COUNCIL_DESCRIPTION,
            COUNCIL_VERTICAL,
            QUORUM_PERCENTAGE,
            DEPOSIT_PERCENTAGE,
            VOTING_PERIOD,
            EVIDENCE_PERIOD
        );

        // Reassign without claimsManager set - should succeed (skips check)
        vm.prank(governance);
        freshRegistry.reassignAgentCouncil(AGENT_ID, councilId);

        assertEq(freshRegistry.getAgentCouncil(AGENT_ID), councilId);
    }

    // =========================================================================
    // Pause Tests
    // =========================================================================

    function test_Pause_Success() public {
        vm.prank(governance);
        registry.pause(ITrustfulPausable.PauseScope.All, "test pause");

        assertTrue(registry.isPaused(ITrustfulPausable.PauseScope.All));
    }
}
