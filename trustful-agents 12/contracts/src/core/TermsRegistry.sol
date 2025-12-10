// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ITermsRegistry } from "../interfaces/ITermsRegistry.sol";
import { TrustfulPausable } from "../base/TrustfulPausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TermsRegistry
 * @notice Stores Terms & Conditions versions per agent with content hash verification
 * @dev T&C content stored off-chain (IPFS), hash committed on-chain
 *
 * Key Design Decisions:
 * - Each agent can have multiple T&C versions (history preserved for claims)
 * - Only agent owner can register/update terms
 * - Council binding determines which council handles disputes
 * - TrustfulValidator can invalidate terms on ownership change
 * - maxPayoutPerClaim lives in T&C document, not on-chain (v1.2)
 *
 * Version Numbering:
 * - Versions start at 1 (version 0 means no terms)
 * - Each registerTerms/updateTerms increments version
 * - Previous versions remain queryable for historical claims
 */
contract TermsRegistry is ITermsRegistry, TrustfulPausable, ReentrancyGuard {
    // =========================================================================
    // State
    // =========================================================================

    /// @notice Terms versions per agent: agentId => version => TermsVersion
    mapping(uint256 => mapping(uint256 => TermsVersion)) private _terms;

    /// @notice Terms configuration per agent
    mapping(uint256 => TermsConfig) private _configs;

    /// @notice The ERC-8004 agent registry
    IERC8004Registry private immutable _REGISTRY;

    /// @notice The CouncilRegistry for validating councils (optional)
    address public councilRegistry;

    /// @notice The TrustfulValidator authorized to invalidate terms
    address public trustfulValidator;

    /// @notice Whether to enforce council validation
    bool public enforceCouncilValidation;

    // =========================================================================
    // Errors
    // =========================================================================

    error NotTrustfulValidator(address caller);
    error NotAuthorized(address caller);

    // =========================================================================
    // Constructor
    // =========================================================================

    /**
     * @notice Initialize the TermsRegistry
     * @param registry_ The ERC-8004 agent registry address
     * @param governance_ The governance multisig address
     */
    constructor(
        address registry_,
        address governance_
    ) TrustfulPausable(governance_) {
        if (registry_ == address(0)) revert ZeroAddress();
        _REGISTRY = IERC8004Registry(registry_);
    }

    // =========================================================================
    // Admin Functions
    // =========================================================================

    /**
     * @notice Set the CouncilRegistry address
     * @param councilRegistry_ The CouncilRegistry address
     * @dev Only callable by governance
     */
    function setCouncilRegistry(address councilRegistry_) external onlyGovernance {
        councilRegistry = councilRegistry_;
    }

    /**
     * @notice Set the TrustfulValidator address
     * @param validator_ The TrustfulValidator address
     * @dev Only callable by governance
     */
    function setTrustfulValidator(address validator_) external onlyGovernance {
        if (validator_ == address(0)) revert ZeroAddress();
        trustfulValidator = validator_;
    }

    /**
     * @notice Enable/disable council validation enforcement
     * @param enforce_ Whether to enforce council validation
     * @dev Only callable by governance
     */
    function setEnforceCouncilValidation(bool enforce_) external onlyGovernance {
        enforceCouncilValidation = enforce_;
    }

    // =========================================================================
    // Core Functions
    // =========================================================================

    /// @inheritdoc ITermsRegistry
    function registerTerms(
        uint256 agentId,
        bytes32 contentHash,
        string calldata contentUri,
        bytes32 councilId
    ) external nonReentrant returns (uint256 version) {
        _requireAgentOwner(agentId);
        _validateTermsInput(contentHash, contentUri);
        _validateCouncil(councilId);

        return _createTermsVersion(agentId, contentHash, contentUri, councilId);
    }

    /// @inheritdoc ITermsRegistry
    function updateTerms(
        uint256 agentId,
        bytes32 contentHash,
        string calldata contentUri,
        bytes32 councilId
    ) external nonReentrant returns (uint256 version) {
        _requireAgentOwner(agentId);
        _validateTermsInput(contentHash, contentUri);
        _validateCouncil(councilId);

        // Deactivate previous version if exists
        TermsConfig storage config = _configs[agentId];
        if (config.activeVersion > 0) {
            _terms[agentId][config.activeVersion].active = false;
            emit TermsDeactivated(agentId, config.activeVersion);
        }

        return _createTermsVersion(agentId, contentHash, contentUri, councilId);
    }

    /// @inheritdoc ITermsRegistry
    function invalidateTerms(uint256 agentId, string calldata reason) external nonReentrant {
        // Only TrustfulValidator or governance can invalidate
        if (msg.sender != trustfulValidator && msg.sender != governance) {
            revert NotAuthorized(msg.sender);
        }

        TermsConfig storage config = _configs[agentId];
        if (config.activeVersion == 0) {
            revert NoActiveTerms(agentId);
        }

        // Deactivate current terms
        _terms[agentId][config.activeVersion].active = false;
        emit TermsDeactivated(agentId, config.activeVersion);

        // Reset active version
        config.activeVersion = 0;

        emit TermsInvalidated(agentId, reason);
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /// @inheritdoc ITermsRegistry
    function getActiveTerms(uint256 agentId)
        external
        view
        returns (TermsVersion memory terms, uint256 version)
    {
        TermsConfig storage config = _configs[agentId];
        if (config.activeVersion == 0) {
            revert NoActiveTerms(agentId);
        }
        version = config.activeVersion;
        terms = _terms[agentId][version];
    }

    /// @inheritdoc ITermsRegistry
    function getTermsVersion(
        uint256 agentId,
        uint256 version
    ) external view returns (TermsVersion memory terms) {
        if (version == 0 || version > _configs[agentId].versionCount) {
            revert VersionNotFound(agentId, version);
        }
        return _terms[agentId][version];
    }

    /// @inheritdoc ITermsRegistry
    function getActiveTermsHash(uint256 agentId) external view returns (bytes32 hash) {
        TermsConfig storage config = _configs[agentId];
        if (config.activeVersion == 0) {
            revert NoActiveTerms(agentId);
        }
        return _terms[agentId][config.activeVersion].contentHash;
    }

    /// @inheritdoc ITermsRegistry
    function getTermsConfig(uint256 agentId) external view returns (TermsConfig memory config) {
        return _configs[agentId];
    }

    /// @inheritdoc ITermsRegistry
    function hasTerms(uint256 agentId) external view returns (bool) {
        return _configs[agentId].versionCount > 0;
    }

    /// @inheritdoc ITermsRegistry
    function hasActiveTerms(uint256 agentId) external view returns (bool) {
        return _configs[agentId].activeVersion > 0;
    }

    /// @inheritdoc ITermsRegistry
    function getCouncilForAgent(uint256 agentId) external view returns (bytes32 councilId) {
        TermsConfig storage config = _configs[agentId];
        if (config.activeVersion == 0) {
            return bytes32(0);
        }
        return _terms[agentId][config.activeVersion].councilId;
    }

    /// @inheritdoc ITermsRegistry
    function getTermsHistory(uint256 agentId)
        external
        view
        returns (TermsVersion[] memory versions)
    {
        uint256 count = _configs[agentId].versionCount;
        versions = new TermsVersion[](count);

        for (uint256 i = 0; i < count; i++) {
            versions[i] = _terms[agentId][i + 1]; // Versions are 1-indexed
        }
    }

    /// @inheritdoc ITermsRegistry
    function verifyTermsHash(
        uint256 agentId,
        uint256 version,
        bytes32 contentHash
    ) external view returns (bool matches) {
        if (version == 0 || version > _configs[agentId].versionCount) {
            return false;
        }
        return _terms[agentId][version].contentHash == contentHash;
    }

    /**
     * @notice Get the ERC-8004 registry address
     * @return registry The registry contract address
     */
    function agentRegistry() external view returns (address registry) {
        return address(_REGISTRY);
    }

    // =========================================================================
    // Internal Functions
    // =========================================================================

    /**
     * @notice Create a new terms version
     * @param agentId The ERC-8004 token ID
     * @param contentHash The content hash
     * @param contentUri The content URI
     * @param councilId The council ID
     * @return version The new version number
     */
    function _createTermsVersion(
        uint256 agentId,
        bytes32 contentHash,
        string calldata contentUri,
        bytes32 councilId
    ) internal returns (uint256 version) {
        TermsConfig storage config = _configs[agentId];

        // Increment version count
        config.versionCount += 1;
        version = config.versionCount;

        // Store new version
        _terms[agentId][version] = TermsVersion({
            contentHash: contentHash,
            contentUri: contentUri,
            councilId: councilId,
            registeredAt: block.timestamp,
            active: true
        });

        // Set as active
        config.activeVersion = version;

        emit TermsRegistered(agentId, version, contentHash, contentUri, councilId);
        emit TermsActivated(agentId, version);
    }

    /**
     * @notice Validate terms input parameters
     * @param contentHash The content hash
     * @param contentUri The content URI
     */
    function _validateTermsInput(bytes32 contentHash, string calldata contentUri) internal pure {
        if (contentHash == bytes32(0)) {
            revert InvalidContentHash();
        }
        if (bytes(contentUri).length == 0) {
            revert InvalidContentUri();
        }
    }

    /**
     * @notice Validate council exists and is active
     * @param councilId The council ID
     * @dev Only enforced if enforceCouncilValidation is true
     */
    function _validateCouncil(bytes32 councilId) internal view {
        if (!enforceCouncilValidation) {
            return;
        }

        if (councilRegistry == address(0)) {
            return; // No council registry set, skip validation
        }

        // Check council is active via CouncilRegistry
        bool isActive = ICouncilRegistry(councilRegistry).isCouncilActive(councilId);
        if (!isActive) {
            revert CouncilNotActive(councilId);
        }
    }

    /**
     * @notice Require caller is the agent owner
     * @param agentId The ERC-8004 token ID
     */
    function _requireAgentOwner(uint256 agentId) internal view {
        address owner = _REGISTRY.ownerOf(agentId);
        if (msg.sender != owner) {
            revert NotAgentOwner(agentId, msg.sender);
        }
    }
}

// =========================================================================
// External Interfaces
// =========================================================================

/**
 * @title IERC8004Registry
 * @notice Minimal interface for ERC-8004 Agent Registry
 */
interface IERC8004Registry {
    function ownerOf(uint256 tokenId) external view returns (address owner);
}

/**
 * @title ICouncilRegistry
 * @notice Minimal interface for CouncilRegistry
 */
interface ICouncilRegistry {
    function isCouncilActive(bytes32 councilId) external view returns (bool);
}
