// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ITermsRegistry
 * @notice Stores Terms & Conditions versions per agent with content hash verification
 * @dev T&C content stored off-chain (IPFS), hash committed on-chain
 * 
 * v1.2 Changes:
 * - REMOVED `maxPayoutPerClaim` from on-chain storage
 * - maxPayoutPerClaim now lives in the T&C document (off-chain)
 * - Council verifies maxPayoutPerClaim from T&C document during claim evaluation
 * - This avoids sync issues when T&C is updated
 * - T&C document schema requires maxPayoutPerClaim field
 * - REMOVED `getMaxPayoutPerClaim()` function
 * 
 * T&C Document Schema (off-chain):
 * {
 *   "terms": {
 *     "maxPayoutPerClaim": "5000000000",  // 5000 USDC (6 decimals)
 *     ...
 *   }
 * }
 */
interface ITermsRegistry {
    // =========================================================================
    // Structs
    // =========================================================================

    struct TermsVersion {
        bytes32 contentHash;          // keccak256 of T&C document
        string contentUri;            // IPFS URI or URL to full document
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
        bytes32 councilId
    );

    event TermsActivated(uint256 indexed agentId, uint256 indexed version);
    event TermsDeactivated(uint256 indexed agentId, uint256 indexed version);
    event TermsInvalidated(uint256 indexed agentId, string reason);

    // =========================================================================
    // Errors
    // =========================================================================

    error NotAgentOwner(uint256 agentId, address caller);
    error AgentNotFound(uint256 agentId);
    error NoActiveTerms(uint256 agentId);
    error VersionNotFound(uint256 agentId, uint256 version);
    error CouncilNotActive(bytes32 councilId);
    error InvalidContentHash();
    error InvalidContentUri();

    // =========================================================================
    // Core Functions
    // =========================================================================

    /**
     * @notice Register new T&C version for an agent
     * @param agentId The ERC-8004 token ID of the agent
     * @param contentHash keccak256 hash of the T&C document
     * @param contentUri URI pointing to full T&C document (IPFS recommended)
     * @param councilId The council that will handle disputes under these terms
     * @return version The new version number
     * @dev Only agent owner can call
     * @dev New version automatically becomes active
     * @dev T&C document must include maxPayoutPerClaim (verified off-chain)
     * [v1.2] Removed maxPayoutPerClaim parameter - now in T&C document
     */
    function registerTerms(
        uint256 agentId,
        bytes32 contentHash,
        string calldata contentUri,
        bytes32 councilId
    ) external returns (uint256 version);

    /**
     * @notice Update to new T&C version (convenience function)
     * @param agentId The ERC-8004 token ID
     * @param contentHash New content hash
     * @param contentUri New content URI
     * @param councilId New council (can be same as before)
     * @return version The new version number
     * @dev Only agent owner can call
     * @dev Previous terms remain stored for historical claims
     * [v1.2] Removed maxPayoutPerClaim parameter - now in T&C document
     */
    function updateTerms(
        uint256 agentId,
        bytes32 contentHash,
        string calldata contentUri,
        bytes32 councilId
    ) external returns (uint256 version);

    /**
     * @notice Invalidate current terms (e.g., on ownership transfer)
     * @param agentId The ERC-8004 token ID
     * @param reason Reason for invalidation
     * @dev Can be called by TrustfulValidator on ownership change
     */
    function invalidateTerms(uint256 agentId, string calldata reason) external;

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
     * @notice Check if an agent has active (non-invalidated) T&C
     * @param agentId The ERC-8004 token ID
     * @return hasActive True if active terms exist
     */
    function hasActiveTerms(uint256 agentId) external view returns (bool hasActive);

    /**
     * @notice Get the council ID for active terms
     * @param agentId The ERC-8004 token ID
     * @return councilId The council identifier
     * @dev Returns bytes32(0) if no active terms
     */
    function getCouncilForAgent(uint256 agentId) external view returns (bytes32 councilId);

    /**
     * @notice Get all terms versions for an agent
     * @param agentId The ERC-8004 token ID
     * @return versions Array of TermsVersion structs
     */
    function getTermsHistory(uint256 agentId) 
        external 
        view 
        returns (TermsVersion[] memory versions);

    /**
     * @notice Verify a content hash matches a specific terms version
     * @param agentId The ERC-8004 token ID
     * @param version The version number
     * @param contentHash The hash to verify
     * @return matches True if hash matches
     */
    function verifyTermsHash(
        uint256 agentId, 
        uint256 version, 
        bytes32 contentHash
    ) external view returns (bool matches);
}
