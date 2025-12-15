// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ICouncilRegistry
 * @notice Manages councils and their members for dispute resolution
 * @dev Councils are vertical-specific (e.g., DeFi, Healthcare, Legal)
 * 
 * v1.2 Changes:
 * - Added `description` field to Council struct for provider visibility
 * - Added `closedAt` field to track council closure
 * - Added `closeCouncil()` for governance to permanently close inactive councils
 * - Added `reassignAgentCouncil()` for governance to override agent's council assignment
 * - Added pre-check view functions for council closure validation
 * - Added `getAgentCouncil()` to query agent-council mapping
 */
interface ICouncilRegistry {
    // =========================================================================
    // Structs
    // =========================================================================

    struct Council {
        bytes32 councilId;              // Unique identifier (keccak256 of name)
        string name;                    // Human-readable name
        string description;             // [v1.2] Council description for providers/clients
        string vertical;                // Industry vertical (e.g., "defi", "healthcare")
        uint256 memberCount;            // Current number of active members
        uint256 quorumPercentage;       // Required percentage for valid vote (basis points)
        uint256 claimDepositPercentage; // Deposit required from claimants (basis points)
        uint256 votingPeriod;           // Time allowed for voting (seconds)
        uint256 evidencePeriod;         // Time for evidence submission (seconds)
        bool active;                    // Whether council is accepting new claims
        uint256 createdAt;              // Creation timestamp
        uint256 closedAt;               // [v1.2] Closure timestamp (0 = not closed)
    }

    struct CouncilMember {
        address member;                 // Member address
        bytes32 councilId;              // Council they belong to
        uint256 joinedAt;               // When they joined
        uint256 claimsVoted;            // Total claims participated in
        bool active;                    // Currently active
    }

    // =========================================================================
    // Events
    // =========================================================================

    event CouncilCreated(
        bytes32 indexed councilId,
        string name,
        string vertical,
        uint256 quorumPercentage,
        uint256 claimDepositPercentage
    );

    event CouncilClosed(
        bytes32 indexed councilId,
        uint256 timestamp
    );

    event CouncilUpdated(bytes32 indexed councilId);
    event CouncilDeactivated(bytes32 indexed councilId);
    event CouncilActivated(bytes32 indexed councilId);

    event MemberAdded(bytes32 indexed councilId, address indexed member);
    event MemberRemoved(bytes32 indexed councilId, address indexed member);
    event MemberSuspended(bytes32 indexed councilId, address indexed member);
    event MemberReinstated(bytes32 indexed councilId, address indexed member);

    event AgentCouncilReassigned(
        uint256 indexed agentId,
        bytes32 indexed oldCouncilId,
        bytes32 indexed newCouncilId
    );

    // =========================================================================
    // Errors
    // =========================================================================

    error CouncilNotFound(bytes32 councilId);
    error CouncilNotActive(bytes32 councilId);
    error CouncilAlreadyClosed(bytes32 councilId);
    error CouncilHasActiveAgents(bytes32 councilId, uint256 agentCount);
    error CouncilHasPendingClaims(bytes32 councilId, uint256 claimCount);
    error AgentHasOpenClaims(uint256 agentId, uint256 pendingCount);

    // =========================================================================
    // Council Management (Governance)
    // =========================================================================

    /**
     * @notice Create a new council
     * @param name Human-readable council name
     * @param description Council description explaining its purpose/vertical
     * @param vertical Industry vertical identifier
     * @param quorumPercentage Required vote percentage (basis points, e.g., 5000 = 50%)
     * @param claimDepositPercentage Claimant deposit requirement (basis points)
     * @param votingPeriod Duration for voting in seconds
     * @param evidencePeriod Duration for evidence submission in seconds
     * @return councilId The generated council identifier
     * @dev Only governance can call
     * [v1.2] Added description parameter
     */
    function createCouncil(
        string calldata name,
        string calldata description,
        string calldata vertical,
        uint256 quorumPercentage,
        uint256 claimDepositPercentage,
        uint256 votingPeriod,
        uint256 evidencePeriod
    ) external returns (bytes32 councilId);

    /**
     * @notice Permanently close a council
     * @param councilId The council to close
     * @dev Only governance can call
     * @dev Requires no agents assigned to this council
     * @dev Requires no pending claims using this council
     * @dev Automatically removes all members upon closure
     * [v1.2] New function
     */
    function closeCouncil(bytes32 councilId) external;

    /**
     * @notice Update council parameters
     * @param councilId The council to update
     * @param quorumPercentage New quorum percentage
     * @param claimDepositPercentage New deposit percentage
     * @param votingPeriod New voting period
     * @param evidencePeriod New evidence period
     * @dev Only governance can call
     */
    function updateCouncil(
        bytes32 councilId,
        uint256 quorumPercentage,
        uint256 claimDepositPercentage,
        uint256 votingPeriod,
        uint256 evidencePeriod
    ) external;

    /**
     * @notice Update council description
     * @param councilId The council to update
     * @param description New description
     * @dev Only governance can call
     * [v1.2] New function
     */
    function updateCouncilDescription(
        bytes32 councilId,
        string calldata description
    ) external;

    /**
     * @notice Deactivate a council (no new claims, can be reactivated)
     * @param councilId The council to deactivate
     * @dev Only governance can call
     * @dev Different from closeCouncil - this is reversible
     */
    function deactivateCouncil(bytes32 councilId) external;

    /**
     * @notice Reactivate a deactivated council
     * @param councilId The council to activate
     * @dev Only governance can call
     * @dev Cannot reactivate a closed council
     */
    function activateCouncil(bytes32 councilId) external;

    /**
     * @notice Reassign an agent to a different council
     * @param agentId The ERC-8004 agent token ID
     * @param newCouncilId The new council to assign
     * @dev Only governance can call
     * @dev Overrides the council set in agent's T&C
     * @dev Used when provider selected wrong council or governance needs to redirect
     * @dev Requires agent to have no pending claims (Phase 2 will add migration mode)
     * [v1.2] New function
     */
    function reassignAgentCouncil(uint256 agentId, bytes32 newCouncilId) external;

    // =========================================================================
    // Member Management
    // =========================================================================

    /**
     * @notice Add a member to a council
     * @param councilId The council identifier
     * @param member The address to add
     * @dev Only governance can call
     */
    function addMember(bytes32 councilId, address member) external;

    /**
     * @notice Remove a member from a council
     * @param councilId The council identifier
     * @param member The address to remove
     * @dev Only governance can call
     */
    function removeMember(bytes32 councilId, address member) external;

    /**
     * @notice Temporarily suspend a member
     * @param councilId The council identifier
     * @param member The address to suspend
     * @dev Only governance can call
     */
    function suspendMember(bytes32 councilId, address member) external;

    /**
     * @notice Reinstate a suspended member
     * @param councilId The council identifier
     * @param member The address to reinstate
     * @dev Only governance can call
     */
    function reinstateMember(bytes32 councilId, address member) external;

    // =========================================================================
    // View Functions
    // =========================================================================

    /**
     * @notice Get council details
     * @param councilId The council identifier
     * @return council The Council struct
     */
    function getCouncil(bytes32 councilId) external view returns (Council memory council);

    /**
     * @notice Check if a council can be closed
     * @param councilId The council identifier
     * @return canClose True if closure is allowed
     * @return reason Reason if cannot close (empty if can close)
     * [v1.2] New function
     */
    function canCloseCouncil(bytes32 councilId) 
        external 
        view 
        returns (bool canClose, string memory reason);

    /**
     * @notice Get count of agents assigned to a council
     * @param councilId The council identifier
     * @return count Number of agents using this council
     * [v1.2] New function
     */
    function getAgentCountByCouncil(bytes32 councilId) 
        external 
        view 
        returns (uint256 count);

    /**
     * @notice Get count of pending (unresolved) claims for a council
     * @param councilId The council identifier
     * @return count Number of pending claims
     * [v1.2] New function
     */
    function getPendingClaimCountByCouncil(bytes32 councilId) 
        external 
        view 
        returns (uint256 count);

    /**
     * @notice Get the effective council for an agent
     * @param agentId The ERC-8004 agent token ID
     * @return councilId The council ID (may be reassigned by governance)
     * @dev Returns governance-assigned council if reassigned, otherwise from T&C
     * [v1.2] New function
     */
    function getAgentCouncil(uint256 agentId) 
        external 
        view 
        returns (bytes32 councilId);

    /**
     * @notice Check if a council exists and is active
     * @param councilId The council identifier
     * @return exists True if council exists
     * @return active True if council is active (not deactivated or closed)
     */
    function councilStatus(bytes32 councilId) external view returns (bool exists, bool active);

    /**
     * @notice Check if a council is closed
     * @param councilId The council identifier
     * @return isClosed True if council is permanently closed
     * [v1.2] New function
     */
    function isCouncilClosed(bytes32 councilId) external view returns (bool isClosed);

    /**
     * @notice Check if a council is active (exists, not deactivated, not closed)
     * @param councilId The council identifier
     * @return isActive True if council is active
     */
    function isCouncilActive(bytes32 councilId) external view returns (bool isActive);

    /**
     * @notice Get all members of a council
     * @param councilId The council identifier
     * @return members Array of member addresses
     */
    function getCouncilMembers(bytes32 councilId) external view returns (address[] memory members);

    /**
     * @notice Get active member count for a council
     * @param councilId The council identifier
     * @return count Number of active members
     */
    function getActiveMemberCount(bytes32 councilId) external view returns (uint256 count);

    /**
     * @notice Check if an address is an active member of a council
     * @param councilId The council identifier
     * @param member The address to check
     * @return isMember True if active member
     */
    function isActiveMember(bytes32 councilId, address member) external view returns (bool isMember);

    /**
     * @notice Get member details
     * @param councilId The council identifier
     * @param member The member address
     * @return memberInfo The CouncilMember struct
     */
    function getMember(bytes32 councilId, address member)
        external
        view
        returns (CouncilMember memory memberInfo);

    /**
     * @notice Get councils by vertical
     * @param vertical The vertical identifier
     * @return councilIds Array of council IDs in this vertical
     */
    function getCouncilsByVertical(string calldata vertical)
        external
        view
        returns (bytes32[] memory councilIds);

    /**
     * @notice Get all active (non-closed, non-deactivated) councils
     * @return councilIds Array of active council IDs
     * [v1.2] New function
     */
    function getActiveCouncils() external view returns (bytes32[] memory councilIds);

    /**
     * @notice Calculate required deposit for a claim amount
     * @param councilId The council identifier
     * @param claimAmount The amount being claimed
     * @return deposit The required deposit amount
     */
    function calculateRequiredDeposit(bytes32 councilId, uint256 claimAmount)
        external
        view
        returns (uint256 deposit);

    /**
     * @notice Calculate required votes for quorum
     * @param councilId The council identifier
     * @return required Number of votes needed
     */
    function calculateQuorum(bytes32 councilId) external view returns (uint256 required);
}
