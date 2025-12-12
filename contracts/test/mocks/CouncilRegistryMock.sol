// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../src/interfaces/ICouncilRegistry.sol";

/**
 * @title CouncilRegistryMock
 * @notice Mock CouncilRegistry for testing
 */
contract CouncilRegistryMock {
    // =========================================================================
    // State
    // =========================================================================

    struct CouncilData {
        uint256 quorumPercentage;
        uint256 depositPercentage;
        uint256 votingPeriod;
        uint256 evidencePeriod;
        uint256 memberCount;
        bool active;
    }

    struct Member {
        bool active;
        bool suspended;
        uint256 totalVotes;
    }

    mapping(bytes32 => CouncilData) private _councils;
    mapping(bytes32 => address[]) private _councilMembers;
    mapping(bytes32 => mapping(address => Member)) private _members;
    mapping(bytes32 => uint256) private _pendingClaims;
    mapping(uint256 => bytes32) private _agentCouncils; // agentId => councilId

    // =========================================================================
    // Setup Functions
    // =========================================================================

    /**
     * @notice Set council active status
     */
    function setCouncilActive(bytes32 councilId, bool active) external {
        _councils[councilId].active = active;
    }

    /**
     * @notice Configure a council
     */
    function setCouncil(
        bytes32 councilId,
        uint256 quorumPercentage,
        uint256 depositPercentage,
        uint256 votingPeriod,
        uint256 evidencePeriod,
        bool active
    ) external {
        _councils[councilId] = CouncilData({
            quorumPercentage: quorumPercentage,
            depositPercentage: depositPercentage,
            votingPeriod: votingPeriod,
            evidencePeriod: evidencePeriod,
            memberCount: 0,
            active: active
        });
    }

    /**
     * @notice Add a member to a council
     */
    function addMember(bytes32 councilId, address member) external {
        _councilMembers[councilId].push(member);
        _members[councilId][member] = Member({
            active: true,
            suspended: false,
            totalVotes: 0
        });
        _councils[councilId].memberCount++;
    }

    /**
     * @notice Set council members
     */
    function setMembers(bytes32 councilId, address[] calldata members) external {
        delete _councilMembers[councilId];
        for (uint256 i = 0; i < members.length; i++) {
            _councilMembers[councilId].push(members[i]);
            _members[councilId][members[i]] = Member({
                active: true,
                suspended: false,
                totalVotes: 0
            });
        }
        _councils[councilId].memberCount = members.length;
    }

    /**
     * @notice Suspend a member
     */
    function suspendMember(bytes32 councilId, address member) external {
        _members[councilId][member].suspended = true;
        _councils[councilId].memberCount--;
    }

    /**
     * @notice Set agent's council
     */
    function setAgentCouncil(uint256 agentId, bytes32 councilId) external {
        _agentCouncils[agentId] = councilId;
    }

    // =========================================================================
    // View Functions (matches ICouncilRegistry interface)
    // =========================================================================

    /**
     * @notice Check if a council is active
     */
    function isCouncilActive(bytes32 councilId) external view returns (bool) {
        return _councils[councilId].active;
    }

    /**
     * @notice Get council status (exists and active)
     */
    function councilStatus(bytes32 councilId) external view returns (bool exists, bool active) {
        CouncilData storage c = _councils[councilId];
        // Council exists if it has any non-default values (e.g., votingPeriod > 0 or memberCount > 0)
        exists = c.votingPeriod > 0 || c.memberCount > 0 || c.active;
        active = c.active;
    }

    /**
     * @notice Get full council data
     */
    function getCouncil(bytes32 councilId) external view returns (ICouncilRegistry.Council memory council) {
        CouncilData storage c = _councils[councilId];
        council = ICouncilRegistry.Council({
            councilId: councilId,
            name: "Test Council",
            description: "Mock council for testing",
            vertical: "test",
            memberCount: c.memberCount,
            quorumPercentage: c.quorumPercentage,
            claimDepositPercentage: c.depositPercentage,
            votingPeriod: c.votingPeriod,
            evidencePeriod: c.evidencePeriod,
            active: c.active,
            createdAt: 1,
            closedAt: 0
        });
    }

    /**
     * @notice Get agent's assigned council
     */
    function getAgentCouncil(uint256 agentId) external view returns (bytes32) {
        return _agentCouncils[agentId];
    }

    /**
     * @notice Check if an address is a member of a council
     */
    function isMember(bytes32 councilId, address member) external view returns (bool) {
        return _members[councilId][member].active;
    }

    /**
     * @notice Check if an address is an active member (not suspended)
     */
    function isActiveMember(bytes32 councilId, address member) external view returns (bool) {
        Member storage m = _members[councilId][member];
        return m.active && !m.suspended;
    }

    /**
     * @notice Check if a member can vote
     */
    function canVote(bytes32 councilId, address member) external view returns (bool) {
        Member storage m = _members[councilId][member];
        return m.active && !m.suspended && _councils[councilId].active;
    }

    /**
     * @notice Get council members
     */
    function getCouncilMembers(bytes32 councilId) external view returns (address[] memory) {
        return _councilMembers[councilId];
    }

    /**
     * @notice Get active member count
     */
    function getActiveMemberCount(bytes32 councilId) external view returns (uint256) {
        return _councils[councilId].memberCount;
    }

    /**
     * @notice Get council parameters
     */
    function getCouncilParameters(bytes32 councilId) external view returns (
        uint256 quorumPercentage,
        uint256 depositPercentage,
        uint256 votingPeriod,
        uint256 evidencePeriod
    ) {
        CouncilData storage c = _councils[councilId];
        return (c.quorumPercentage, c.depositPercentage, c.votingPeriod, c.evidencePeriod);
    }

    /**
     * @notice Calculate quorum
     */
    function calculateQuorum(bytes32 councilId) external view returns (uint256) {
        CouncilData storage c = _councils[councilId];
        return (c.memberCount * c.quorumPercentage + 99) / 100;
    }

    /**
     * @notice Calculate required deposit for a claim
     */
    function calculateRequiredDeposit(bytes32 councilId, uint256 claimAmount) external view returns (uint256 deposit) {
        CouncilData storage c = _councils[councilId];
        deposit = (claimAmount * c.depositPercentage) / 100;
    }

    /**
     * @notice Get pending claims count
     */
    function getPendingClaimsCount(bytes32 councilId) external view returns (uint256) {
        return _pendingClaims[councilId];
    }

    // =========================================================================
    // State Modification (called by ClaimsManager)
    // =========================================================================

    /**
     * @notice Increment pending claims
     */
    function incrementPendingClaims(bytes32 councilId) external {
        _pendingClaims[councilId]++;
    }

    /**
     * @notice Decrement pending claims
     */
    function decrementPendingClaims(bytes32 councilId) external {
        if (_pendingClaims[councilId] > 0) {
            _pendingClaims[councilId]--;
        }
    }

    /**
     * @notice Increment member votes
     */
    function incrementMemberVotes(bytes32 councilId, address member) external {
        _members[councilId][member].totalVotes++;
    }
}
