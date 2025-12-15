// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ICouncilRegistry } from "../interfaces/ICouncilRegistry.sol";
import { IClaimsManager } from "../interfaces/IClaimsManager.sol";
import { TrustfulPausable } from "../base/TrustfulPausable.sol";

/**
 * @title CouncilRegistry
 * @notice Manages councils and their members for dispute resolution
 * @dev Councils are vertical-specific (e.g., DeFi, Healthcare, Legal)
 *
 * Key Design:
 * - Councils have configurable quorum, deposit %, voting/evidence periods
 * - Members can be added/removed/suspended by governance
 * - Councils can be deactivated (reversible) or closed (permanent)
 * - Agents can be reassigned to different councils by governance
 */
contract CouncilRegistry is ICouncilRegistry, TrustfulPausable {
    // =========================================================================
    // State
    // =========================================================================

    /// @notice All councils by ID
    mapping(bytes32 => Council) private _councils;

    /// @notice Council members: councilId => member => CouncilMember
    mapping(bytes32 => mapping(address => CouncilMember)) private _members;

    /// @notice Active member addresses per council: councilId => addresses
    mapping(bytes32 => address[]) private _memberList;

    /// @notice Member index in list: councilId => member => index
    mapping(bytes32 => mapping(address => uint256)) private _memberIndex;

    /// @notice Councils by vertical: vertical => councilIds
    mapping(string => bytes32[]) private _councilsByVertical;

    /// @notice All council IDs
    bytes32[] private _allCouncilIds;

    /// @notice Agent council overrides: agentId => councilId (0 = use T&C)
    mapping(uint256 => bytes32) private _agentCouncilOverride;

    /// @notice Agent count per council (for closure validation)
    mapping(bytes32 => uint256) private _agentCountByCouncil;

    /// @notice Pending claim count per council (for closure validation)
    mapping(bytes32 => uint256) private _pendingClaimsByCouncil;

    /// @notice Terms registry for looking up agent's default council
    address public termsRegistry;

    /// @notice Claims manager (for pending claims tracking)
    address public claimsManager;

    // =========================================================================
    // Constants
    // =========================================================================

    uint256 public constant MIN_QUORUM_PERCENTAGE = 1000; // 10%
    uint256 public constant MAX_QUORUM_PERCENTAGE = 10000; // 100%
    uint256 public constant MAX_DEPOSIT_PERCENTAGE = 5000; // 50%
    uint256 public constant MIN_VOTING_PERIOD = 1 days;
    uint256 public constant MAX_VOTING_PERIOD = 30 days;
    uint256 public constant MIN_EVIDENCE_PERIOD = 1 days;
    uint256 public constant MAX_EVIDENCE_PERIOD = 14 days;

    // =========================================================================
    // Errors
    // =========================================================================

    error InvalidQuorumPercentage(uint256 provided, uint256 min, uint256 max);
    error InvalidDepositPercentage(uint256 provided, uint256 max);
    error InvalidVotingPeriod(uint256 provided, uint256 min, uint256 max);
    error InvalidEvidencePeriod(uint256 provided, uint256 min, uint256 max);
    error CouncilAlreadyExists(bytes32 councilId);
    error MemberAlreadyExists(bytes32 councilId, address member);
    error MemberNotFound(bytes32 councilId, address member);
    error MemberNotActive(bytes32 councilId, address member);
    error MemberAlreadyActive(bytes32 councilId, address member);
    error CannotReactivateClosedCouncil(bytes32 councilId);

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor(address governance_) TrustfulPausable(governance_) {}

    // =========================================================================
    // Admin Configuration
    // =========================================================================

    /**
     * @notice Set the TermsRegistry address
     * @param termsRegistry_ The TermsRegistry contract address
     */
    function setTermsRegistry(address termsRegistry_) external onlyGovernance {
        termsRegistry = termsRegistry_;
    }

    /**
     * @notice Set the ClaimsManager address
     * @param claimsManager_ The ClaimsManager contract address
     */
    function setClaimsManager(address claimsManager_) external onlyGovernance {
        claimsManager = claimsManager_;
    }

    // =========================================================================
    // Council Management
    // =========================================================================

    /// @inheritdoc ICouncilRegistry
    function createCouncil(
        string calldata name,
        string calldata description,
        string calldata vertical,
        uint256 quorumPercentage,
        uint256 claimDepositPercentage,
        uint256 votingPeriod,
        uint256 evidencePeriod
    ) external onlyGovernance returns (bytes32 councilId) {
        // Generate council ID
        councilId = keccak256(abi.encodePacked(name, block.timestamp));

        // Check doesn't exist
        if (_councils[councilId].createdAt != 0) {
            revert CouncilAlreadyExists(councilId);
        }

        // Validate parameters
        _validateCouncilParams(quorumPercentage, claimDepositPercentage, votingPeriod, evidencePeriod);

        // Create council
        _councils[councilId] = Council({
            councilId: councilId,
            name: name,
            description: description,
            vertical: vertical,
            memberCount: 0,
            quorumPercentage: quorumPercentage,
            claimDepositPercentage: claimDepositPercentage,
            votingPeriod: votingPeriod,
            evidencePeriod: evidencePeriod,
            active: true,
            createdAt: block.timestamp,
            closedAt: 0
        });

        _allCouncilIds.push(councilId);
        _councilsByVertical[vertical].push(councilId);

        emit CouncilCreated(councilId, name, vertical, quorumPercentage, claimDepositPercentage);
    }

    /// @inheritdoc ICouncilRegistry
    function closeCouncil(bytes32 councilId) external onlyGovernance {
        Council storage council = _councils[councilId];

        if (council.createdAt == 0) revert CouncilNotFound(councilId);
        if (council.closedAt != 0) revert CouncilAlreadyClosed(councilId);

        // Check no agents assigned
        uint256 agentCount = _agentCountByCouncil[councilId];
        if (agentCount > 0) {
            revert CouncilHasActiveAgents(councilId, agentCount);
        }

        // Check no pending claims
        uint256 pendingClaims = _pendingClaimsByCouncil[councilId];
        if (pendingClaims > 0) {
            revert CouncilHasPendingClaims(councilId, pendingClaims);
        }

        // Close council
        council.active = false;
        council.closedAt = block.timestamp;

        // Remove all members
        address[] storage members = _memberList[councilId];
        for (uint256 i = 0; i < members.length; i++) {
            address member = members[i];
            _members[councilId][member].active = false;
            emit MemberRemoved(councilId, member);
        }
        council.memberCount = 0;

        emit CouncilClosed(councilId, block.timestamp);
    }

    /// @inheritdoc ICouncilRegistry
    function updateCouncil(
        bytes32 councilId,
        uint256 quorumPercentage,
        uint256 claimDepositPercentage,
        uint256 votingPeriod,
        uint256 evidencePeriod
    ) external onlyGovernance {
        Council storage council = _councils[councilId];
        if (council.createdAt == 0) revert CouncilNotFound(councilId);
        if (council.closedAt != 0) revert CouncilAlreadyClosed(councilId);

        _validateCouncilParams(quorumPercentage, claimDepositPercentage, votingPeriod, evidencePeriod);

        council.quorumPercentage = quorumPercentage;
        council.claimDepositPercentage = claimDepositPercentage;
        council.votingPeriod = votingPeriod;
        council.evidencePeriod = evidencePeriod;

        emit CouncilUpdated(councilId);
    }

    /// @inheritdoc ICouncilRegistry
    function updateCouncilDescription(
        bytes32 councilId,
        string calldata description
    ) external onlyGovernance {
        Council storage council = _councils[councilId];
        if (council.createdAt == 0) revert CouncilNotFound(councilId);

        council.description = description;
        emit CouncilUpdated(councilId);
    }

    /// @inheritdoc ICouncilRegistry
    function deactivateCouncil(bytes32 councilId) external onlyGovernance {
        Council storage council = _councils[councilId];
        if (council.createdAt == 0) revert CouncilNotFound(councilId);
        if (council.closedAt != 0) revert CouncilAlreadyClosed(councilId);

        council.active = false;
        emit CouncilDeactivated(councilId);
    }

    /// @inheritdoc ICouncilRegistry
    function activateCouncil(bytes32 councilId) external onlyGovernance {
        Council storage council = _councils[councilId];
        if (council.createdAt == 0) revert CouncilNotFound(councilId);
        if (council.closedAt != 0) revert CannotReactivateClosedCouncil(councilId);

        council.active = true;
        emit CouncilActivated(councilId);
    }

    /// @inheritdoc ICouncilRegistry
    function reassignAgentCouncil(uint256 agentId, bytes32 newCouncilId) external onlyGovernance {
        Council storage council = _councils[newCouncilId];
        if (council.createdAt == 0) revert CouncilNotFound(newCouncilId);
        if (!council.active) revert CouncilNotActive(newCouncilId);

        // Check no pending claims for this agent
        // Phase 2 will add "migration mode" to allow reassignment with open claims
        if (claimsManager != address(0)) {
            uint256 pendingCount = IClaimsManager(claimsManager).getPendingClaimCount(agentId);
            if (pendingCount > 0) {
                revert AgentHasOpenClaims(agentId, pendingCount);
            }
        }

        bytes32 oldCouncilId = _agentCouncilOverride[agentId];

        // Update counts
        if (oldCouncilId != bytes32(0)) {
            _agentCountByCouncil[oldCouncilId]--;
        }
        _agentCountByCouncil[newCouncilId]++;

        _agentCouncilOverride[agentId] = newCouncilId;

        emit AgentCouncilReassigned(agentId, oldCouncilId, newCouncilId);
    }

    // =========================================================================
    // Member Management
    // =========================================================================

    /// @inheritdoc ICouncilRegistry
    function addMember(bytes32 councilId, address member) external onlyGovernance {
        if (member == address(0)) revert MemberNotFound(councilId, member);
        
        Council storage council = _councils[councilId];
        if (council.createdAt == 0) revert CouncilNotFound(councilId);
        if (council.closedAt != 0) revert CouncilAlreadyClosed(councilId);

        CouncilMember storage memberData = _members[councilId][member];
        if (memberData.joinedAt != 0) revert MemberAlreadyExists(councilId, member);

        // Add member
        memberData.member = member;
        memberData.councilId = councilId;
        memberData.joinedAt = block.timestamp;
        memberData.claimsVoted = 0;
        memberData.active = true;

        // Track in list
        _memberIndex[councilId][member] = _memberList[councilId].length;
        _memberList[councilId].push(member);

        council.memberCount++;

        emit MemberAdded(councilId, member);
    }

    /// @inheritdoc ICouncilRegistry
    function removeMember(bytes32 councilId, address member) external onlyGovernance {
        Council storage council = _councils[councilId];
        if (council.createdAt == 0) revert CouncilNotFound(councilId);

        CouncilMember storage memberData = _members[councilId][member];
        if (memberData.joinedAt == 0) revert MemberNotFound(councilId, member);

        // Remove from list (swap and pop)
        uint256 index = _memberIndex[councilId][member];
        uint256 lastIndex = _memberList[councilId].length - 1;

        if (index != lastIndex) {
            address lastMember = _memberList[councilId][lastIndex];
            _memberList[councilId][index] = lastMember;
            _memberIndex[councilId][lastMember] = index;
        }
        _memberList[councilId].pop();
        delete _memberIndex[councilId][member];

        // Update state
        if (memberData.active) {
            council.memberCount--;
        }
        memberData.active = false;

        emit MemberRemoved(councilId, member);
    }

    /// @inheritdoc ICouncilRegistry
    function suspendMember(bytes32 councilId, address member) external onlyGovernance {
        Council storage council = _councils[councilId];
        if (council.createdAt == 0) revert CouncilNotFound(councilId);

        CouncilMember storage memberData = _members[councilId][member];
        if (memberData.joinedAt == 0) revert MemberNotFound(councilId, member);
        if (!memberData.active) revert MemberNotActive(councilId, member);

        memberData.active = false;
        council.memberCount--;

        emit MemberSuspended(councilId, member);
    }

    /// @inheritdoc ICouncilRegistry
    function reinstateMember(bytes32 councilId, address member) external onlyGovernance {
        Council storage council = _councils[councilId];
        if (council.createdAt == 0) revert CouncilNotFound(councilId);
        if (council.closedAt != 0) revert CouncilAlreadyClosed(councilId);

        CouncilMember storage memberData = _members[councilId][member];
        if (memberData.joinedAt == 0) revert MemberNotFound(councilId, member);
        if (memberData.active) revert MemberAlreadyActive(councilId, member);

        memberData.active = true;
        council.memberCount++;

        emit MemberReinstated(councilId, member);
    }

    // =========================================================================
    // External State Updates (called by ClaimsManager)
    // =========================================================================

    /**
     * @notice Increment pending claims count for a council
     * @param councilId The council ID
     * @dev Called by ClaimsManager when claim is filed
     */
    function incrementPendingClaims(bytes32 councilId) external {
        require(msg.sender == claimsManager, "Only ClaimsManager");
        _pendingClaimsByCouncil[councilId]++;
    }

    /**
     * @notice Decrement pending claims count for a council
     * @param councilId The council ID
     * @dev Called by ClaimsManager when claim is resolved
     */
    function decrementPendingClaims(bytes32 councilId) external {
        require(msg.sender == claimsManager, "Only ClaimsManager");
        if (_pendingClaimsByCouncil[councilId] > 0) {
            _pendingClaimsByCouncil[councilId]--;
        }
    }

    /**
     * @notice Increment member's voted claims count
     * @param councilId The council ID
     * @param member The member address
     * @dev Called by ClaimsManager when member votes
     */
    function incrementMemberVotes(bytes32 councilId, address member) external {
        require(msg.sender == claimsManager, "Only ClaimsManager");
        _members[councilId][member].claimsVoted++;
    }

    /**
     * @notice Register agent with a council (called when T&C registered)
     * @param councilId The council ID
     * @dev Called by TermsRegistry
     */
    function registerAgentWithCouncil(bytes32 councilId) external {
        require(msg.sender == termsRegistry, "Only TermsRegistry");
        _agentCountByCouncil[councilId]++;
    }

    /**
     * @notice Unregister agent from a council (called when T&C invalidated)
     * @param councilId The council ID
     * @dev Called by TermsRegistry
     */
    function unregisterAgentFromCouncil(bytes32 councilId) external {
        require(msg.sender == termsRegistry, "Only TermsRegistry");
        if (_agentCountByCouncil[councilId] > 0) {
            _agentCountByCouncil[councilId]--;
        }
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /// @inheritdoc ICouncilRegistry
    function getCouncil(bytes32 councilId) external view returns (Council memory) {
        return _councils[councilId];
    }

    /// @inheritdoc ICouncilRegistry
    function canCloseCouncil(bytes32 councilId)
        external
        view
        returns (bool canClose, string memory reason)
    {
        Council storage council = _councils[councilId];

        if (council.createdAt == 0) {
            return (false, "Council not found");
        }
        if (council.closedAt != 0) {
            return (false, "Council already closed");
        }
        if (_agentCountByCouncil[councilId] > 0) {
            return (false, "Council has active agents");
        }
        if (_pendingClaimsByCouncil[councilId] > 0) {
            return (false, "Council has pending claims");
        }

        return (true, "");
    }

    /// @inheritdoc ICouncilRegistry
    function getAgentCountByCouncil(bytes32 councilId) external view returns (uint256) {
        return _agentCountByCouncil[councilId];
    }

    /// @inheritdoc ICouncilRegistry
    function getPendingClaimCountByCouncil(bytes32 councilId) external view returns (uint256) {
        return _pendingClaimsByCouncil[councilId];
    }

    /// @inheritdoc ICouncilRegistry
    function getAgentCouncil(uint256 agentId) external view returns (bytes32) {
        bytes32 override_ = _agentCouncilOverride[agentId];
        if (override_ != bytes32(0)) {
            return override_;
        }

        // If no override, would need to query TermsRegistry
        // This is handled by ClaimsManager which has access to TermsRegistry
        return bytes32(0);
    }

    /// @inheritdoc ICouncilRegistry
    function councilStatus(bytes32 councilId) external view returns (bool exists, bool active) {
        Council storage council = _councils[councilId];
        exists = council.createdAt != 0;
        active = exists && council.active && council.closedAt == 0;
    }

    /// @inheritdoc ICouncilRegistry
    function isCouncilClosed(bytes32 councilId) external view returns (bool) {
        return _councils[councilId].closedAt != 0;
    }

    /// @inheritdoc ICouncilRegistry
    function isCouncilActive(bytes32 councilId) external view returns (bool) {
        Council storage council = _councils[councilId];
        return council.createdAt != 0 && council.active && council.closedAt == 0;
    }

    /// @inheritdoc ICouncilRegistry
    function getCouncilMembers(bytes32 councilId) external view returns (address[] memory) {
        return _memberList[councilId];
    }

    /// @inheritdoc ICouncilRegistry
    function getActiveMemberCount(bytes32 councilId) external view returns (uint256) {
        return _councils[councilId].memberCount;
    }

    /// @inheritdoc ICouncilRegistry
    function isActiveMember(bytes32 councilId, address member) external view returns (bool) {
        CouncilMember storage memberData = _members[councilId][member];
        return memberData.joinedAt != 0 && memberData.active;
    }

    /// @inheritdoc ICouncilRegistry
    function getMember(bytes32 councilId, address member)
        external
        view
        returns (CouncilMember memory)
    {
        return _members[councilId][member];
    }

    /// @inheritdoc ICouncilRegistry
    function getCouncilsByVertical(string calldata vertical)
        external
        view
        returns (bytes32[] memory)
    {
        return _councilsByVertical[vertical];
    }

    /// @inheritdoc ICouncilRegistry
    function getActiveCouncils() external view returns (bytes32[] memory) {
        // Count active councils
        uint256 count = 0;
        for (uint256 i = 0; i < _allCouncilIds.length; i++) {
            Council storage council = _councils[_allCouncilIds[i]];
            if (council.active && council.closedAt == 0) {
                count++;
            }
        }

        // Build array
        bytes32[] memory activeCouncils = new bytes32[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < _allCouncilIds.length; i++) {
            Council storage council = _councils[_allCouncilIds[i]];
            if (council.active && council.closedAt == 0) {
                activeCouncils[index++] = _allCouncilIds[i];
            }
        }

        return activeCouncils;
    }

    /// @inheritdoc ICouncilRegistry
    function calculateRequiredDeposit(bytes32 councilId, uint256 claimAmount)
        external
        view
        returns (uint256)
    {
        Council storage council = _councils[councilId];
        if (council.createdAt == 0) revert CouncilNotFound(councilId);

        return (claimAmount * council.claimDepositPercentage) / 10000;
    }

    /// @inheritdoc ICouncilRegistry
    function calculateQuorum(bytes32 councilId) external view returns (uint256) {
        Council storage council = _councils[councilId];
        if (council.createdAt == 0) revert CouncilNotFound(councilId);

        uint256 memberCount = council.memberCount;
        if (memberCount == 0) return 0;

        return (memberCount * council.quorumPercentage + 9999) / 10000; // Round up
    }

    // =========================================================================
    // Internal Functions
    // =========================================================================

    function _validateCouncilParams(
        uint256 quorumPercentage,
        uint256 claimDepositPercentage,
        uint256 votingPeriod,
        uint256 evidencePeriod
    ) internal pure {
        if (quorumPercentage < MIN_QUORUM_PERCENTAGE || quorumPercentage > MAX_QUORUM_PERCENTAGE) {
            revert InvalidQuorumPercentage(quorumPercentage, MIN_QUORUM_PERCENTAGE, MAX_QUORUM_PERCENTAGE);
        }
        if (claimDepositPercentage > MAX_DEPOSIT_PERCENTAGE) {
            revert InvalidDepositPercentage(claimDepositPercentage, MAX_DEPOSIT_PERCENTAGE);
        }
        if (votingPeriod < MIN_VOTING_PERIOD || votingPeriod > MAX_VOTING_PERIOD) {
            revert InvalidVotingPeriod(votingPeriod, MIN_VOTING_PERIOD, MAX_VOTING_PERIOD);
        }
        if (evidencePeriod < MIN_EVIDENCE_PERIOD || evidencePeriod > MAX_EVIDENCE_PERIOD) {
            revert InvalidEvidencePeriod(evidencePeriod, MIN_EVIDENCE_PERIOD, MAX_EVIDENCE_PERIOD);
        }
    }
}
