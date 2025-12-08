// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ITermsRegistry
 * @notice Stores Terms & Conditions versions per agent with on-chain liability cap
 * @dev T&C content stored off-chain (IPFS), hash committed on-chain
 */
interface ITermsRegistry {
    // =========================================================================
    // Structs
    // =========================================================================

    struct TermsVersion {
        bytes32 contentHash;          // keccak256 of T&C document
        string contentUri;            // IPFS URI or URL to full document
        uint256 maxPayoutPerClaim;    // Maximum compensation per claim (USDC, 6 decimals)
        bytes32 councilId;            // Council that handles disputes for these terms
        uint256 registeredAt;         // Block timestamp when registered
        bool active;                  // Whether this is the current active version
    }

    struct TermsConfig {
        uint256 activeVersion;        // Current active version number
        uint256 versionCount;         // Total versions registered
    }

    // =========================================================================
    // Events
    // =========================================================================

    event TermsRegistered(
        uint256 indexed agentId,
        uint256 indexed version,
        bytes32 contentHash,
        string contentUri,
        uint256 maxPayoutPerClaim,
        bytes32 councilId
    );

    event TermsActivated(uint256 indexed agentId, uint256 indexed version);
    event TermsDeactivated(uint256 indexed agentId, uint256 indexed version);

    // =========================================================================
    // Core Functions
    // =========================================================================

    /**
     * @notice Register new T&C version for an agent
     * @param agentId The ERC-8004 token ID of the agent
     * @param contentHash keccak256 hash of the T&C document
     * @param contentUri URI pointing to full T&C document (IPFS recommended)
     * @param maxPayoutPerClaim Maximum payout per claim in USDC (6 decimals)
     * @param councilId The council that will handle disputes under these terms
     * @return version The new version number
     * @dev Only agent owner can call
     * @dev New version automatically becomes active
     */
    function registerTerms(
        uint256 agentId,
        bytes32 contentHash,
        string calldata contentUri,
        uint256 maxPayoutPerClaim,
        bytes32 councilId
    ) external returns (uint256 version);

    /**
     * @notice Update to new T&C version (convenience function)
     * @param agentId The ERC-8004 token ID
     * @param contentHash New content hash
     * @param contentUri New content URI
     * @param maxPayoutPerClaim New max payout
     * @param councilId New council (can be same as before)
     * @return version The new version number
     * @dev Only agent owner can call
     * @dev Previous terms remain stored for historical claims
     */
    function updateTerms(
        uint256 agentId,
        bytes32 contentHash,
        string calldata contentUri,
        uint256 maxPayoutPerClaim,
        bytes32 councilId
    ) external returns (uint256 version);

    // =========================================================================
    // View Functions
    // =========================================================================

    /**
     * @notice Get the currently active T&C for an agent
     * @param agentId The ERC-8004 token ID
     * @return terms The active TermsVersion struct
     * @return version The version number
     */
    function getActiveTerms(uint256 agentId)
        external
        view
        returns (TermsVersion memory terms, uint256 version);

    /**
     * @notice Get T&C by specific version
     * @param agentId The ERC-8004 token ID
     * @param version The version number
     * @return terms The TermsVersion struct
     */
    function getTermsVersion(uint256 agentId, uint256 version)
        external
        view
        returns (TermsVersion memory terms);

    /**
     * @notice Get the content hash of active T&C
     * @param agentId The ERC-8004 token ID
     * @return hash The content hash
     */
    function getActiveTermsHash(uint256 agentId) external view returns (bytes32 hash);

    /**
     * @notice Get terms configuration for an agent
     * @param agentId The ERC-8004 token ID
     * @return config The TermsConfig struct
     */
    function getTermsConfig(uint256 agentId) external view returns (TermsConfig memory config);

    /**
     * @notice Check if an agent has registered T&C
     * @param agentId The ERC-8004 token ID
     * @return hasTerms True if at least one version exists
     */
    function hasTerms(uint256 agentId) external view returns (bool hasTerms);

    /**
     * @notice Get the council ID for active terms
     * @param agentId The ERC-8004 token ID
     * @return councilId The council identifier
     */
    function getCouncilForAgent(uint256 agentId) external view returns (bytes32 councilId);

    /**
     * @notice Get the max payout per claim for active terms
     * @param agentId The ERC-8004 token ID
     * @return maxPayout The maximum payout in USDC
     */
    function getMaxPayoutPerClaim(uint256 agentId) external view returns (uint256 maxPayout);
}
