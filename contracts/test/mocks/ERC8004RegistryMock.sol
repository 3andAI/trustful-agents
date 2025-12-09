// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title ERC8004RegistryMock
 * @notice Mock ERC-8004 registry for testing
 * @dev Simplified ERC721 implementation representing agent identities
 */
contract ERC8004RegistryMock is ERC721 {
    // =========================================================================
    // State
    // =========================================================================

    /// @notice Counter for generating unique agent IDs
    uint256 private _nextTokenId;

    /// @notice Mapping from agent ID to validation status
    mapping(uint256 => bool) private _validations;

    /// @notice Mapping from agent ID to validator address
    mapping(uint256 => address) private _validators;

    // =========================================================================
    // Events
    // =========================================================================

    event ValidationIssued(uint256 indexed agentId, address indexed validator, bytes32 requestHash);
    event ValidationRevoked(uint256 indexed agentId, address indexed validator, bytes32 requestHash);

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor() ERC721("ERC8004 Agent Registry", "AGENT") { }

    // =========================================================================
    // Mint Functions
    // =========================================================================

    /**
     * @notice Mint a new agent token
     * @param to The owner address
     * @param tokenId The specific token ID to mint
     */
    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }

    /**
     * @notice Mint a new agent token with auto-incrementing ID
     * @param to The owner address
     * @return tokenId The minted token ID
     */
    function mintAuto(address to) external returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _mint(to, tokenId);
    }

    // =========================================================================
    // Validation Functions (Mock)
    // =========================================================================

    /**
     * @notice Issue a validation for an agent
     * @param agentId The agent token ID
     * @param validator The validator address
     * @param requestHash The validation request hash
     */
    function issueValidation(
        uint256 agentId,
        address validator,
        bytes32 requestHash
    ) external {
        _validations[agentId] = true;
        _validators[agentId] = validator;
        emit ValidationIssued(agentId, validator, requestHash);
    }

    /**
     * @notice Revoke a validation for an agent
     * @param agentId The agent token ID
     * @param requestHash The validation request hash
     */
    function revokeValidation(uint256 agentId, bytes32 requestHash) external {
        address validator = _validators[agentId];
        _validations[agentId] = false;
        _validators[agentId] = address(0);
        emit ValidationRevoked(agentId, validator, requestHash);
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /**
     * @notice Check if an agent has an active validation
     * @param agentId The agent token ID
     * @return isValid True if validated
     */
    function isValidated(uint256 agentId) external view returns (bool) {
        return _validations[agentId];
    }

    /**
     * @notice Get the validator for an agent
     * @param agentId The agent token ID
     * @return validator The validator address
     */
    function getValidator(uint256 agentId) external view returns (address) {
        return _validators[agentId];
    }

    /**
     * @notice Get the next token ID
     * @return nextId The next token ID
     */
    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }
}
