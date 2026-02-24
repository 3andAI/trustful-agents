// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockValidationRegistry
 * @notice Test mock for the ERC-8004 Validation Registry
 * @dev Simulates the request/response pattern of the real Validation Registry
 */
contract MockValidationRegistry {
    struct ValidationEntry {
        address validatorAddress;
        uint256 agentId;
        uint8 response;
        bytes32 responseHash;
        bytes32 tag;
        uint256 lastUpdate;
    }

    mapping(bytes32 => ValidationEntry) public validations;

    /// @notice Track the last response for assertions in tests
    bytes32 public lastResponseRequestHash;
    uint8 public lastResponseScore;
    string public lastResponseUri;
    bytes32 public lastResponseHash;
    bytes32 public lastResponseTag;
    uint256 public responseCount;

    /// @notice Simulate a validationRequest being filed by an agent owner
    /// @param requestHash The request hash (would normally be provided by the caller)
    /// @param validatorAddress The validator that should respond
    /// @param agentId The agent being validated
    function simulateRequest(bytes32 requestHash, address validatorAddress, uint256 agentId) external {
        validations[requestHash] = ValidationEntry({
            validatorAddress: validatorAddress,
            agentId: agentId,
            response: 0,
            responseHash: bytes32(0),
            tag: bytes32(0),
            lastUpdate: block.timestamp
        });
    }

    /// @notice Called by the validator contract to submit a response
    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseHash,
        bytes32 tag
    ) external {
        ValidationEntry storage entry = validations[requestHash];
        require(entry.validatorAddress == msg.sender, "not validator");
        require(response <= 100, "resp>100");

        entry.response = response;
        entry.responseHash = responseHash;
        entry.tag = tag;
        entry.lastUpdate = block.timestamp;

        // Store for test assertions
        lastResponseRequestHash = requestHash;
        lastResponseScore = response;
        lastResponseUri = responseURI;
        lastResponseHash = responseHash;
        lastResponseTag = tag;
        responseCount++;
    }

    /// @notice Get validation status (matches real contract signature)
    function getValidationStatus(bytes32 requestHash)
        external
        view
        returns (
            address validatorAddress,
            uint256 agentId,
            uint8 response,
            bytes32 responseHash,
            bytes32 tag,
            uint256 lastUpdate
        )
    {
        ValidationEntry storage entry = validations[requestHash];
        require(entry.lastUpdate > 0, "unknown");
        return (
            entry.validatorAddress,
            entry.agentId,
            entry.response,
            entry.responseHash,
            entry.tag,
            entry.lastUpdate
        );
    }
}
