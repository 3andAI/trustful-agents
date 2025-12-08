// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ICouncilRegistry
 * @notice Manages councils and their members for dispute resolution
 * @dev Councils are vertical-specific (e.g., DeFi, Healthcare, Legal)
 */
interface ICouncilRegistry {
    // =========================================================================
    // Structs
    // =========================================================================

    struct Council {
        bytes32 councilId;            // Unique identifier (keccak256 of name)
        string name;                  // Human-readable name
        string vertical;              // Industry vertical (e.g., "defi", "healthcare")
        uint256 memberCount;          // Current number of active members
        uint256 quorumPercentage;     // Required percentage for valid vote (basis points)
        uint256 claimDepositPercentage; // Deposit required from claimants (basis points)
        uint256 votingPeriod;         // Time allowed for voting (seconds)
        uint256 evidencePeriod;       // Time for evidence submission (seconds)
        bool active;                  // Whether council is accepting new claims
        uint256 createdAt;            // Creation timestamp
    }

    struct CouncilMember {
        address member;               // Member address
        bytes32 councilId;            // Council they belong to
        uint256 joinedAt;             // When they joined
        uint256 claimsVoted;          // Total claims participated in
        bool active;                  // Currently active
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

    event CouncilUpdated(bytes32 indexed councilId);
    event CouncilDeactivated(bytes32 indexed councilId);
    event CouncilActivated(bytes32 indexed councilId);

    event MemberAdded(bytes32 indexed councilId, address indexed member);
    event MemberRemoved(bytes32 indexed councilId, address indexed member);
    event MemberSuspended(bytes32 indexed councilId, address indexed member);
    event MemberReinstated(bytes32 indexed councilId, address indexed member);

    // =========================================================================
    // Council Management (Governance)
    // =========================================================================

    /**
     * @notice Create a new council
     * @param name Human-readable council name
     * @param vertical Industry vertical identifier
     * @param quorumPercentage Required vote percentage (basis points, e.g., 5000 = 50%)
     * @param claimDepositPercentage Claimant deposit requirement (basis points)
     * @param votingPeriod Duration for voting in seconds
     * @param evidencePeriod Duration for evidence submission in seconds
     * @return councilId The generated council identifier
     * @dev Only governance can call
     */
    function createCouncil(
        string calldata name,
        string calldata vertical,
        uint256 quorumPercentage,
        uint256 claimDepositPercentage,
        uint256 votingPeriod,
        uint256 evidencePeriod
    ) external returns (bytes32 councilId);

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
     * @notice Deactivate a council (no new claims)
     * @param councilId The council to deactivate
     * @dev Only governance can call
     */
    function deactivateCouncil(bytes32 councilId) external;

    /**
     * @notice Reactivate a council
     * @param councilId The council to activate
     * @dev Only governance can call
     */
    function activateCouncil(bytes32 councilId) external;

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
     * @notice Check if a council exists and is active
     * @param councilId The council identifier
     * @return exists True if council exists
     * @return active True if council is active
     */
    function councilStatus(bytes32 councilId) external view returns (bool exists, bool active);

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
