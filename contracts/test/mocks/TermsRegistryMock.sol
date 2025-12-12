// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ITermsRegistry } from "../../src/interfaces/ITermsRegistry.sol";

/**
 * @title TermsRegistryMock
 * @notice Mock TermsRegistry for testing ClaimsManager
 */
contract TermsRegistryMock {
    // =========================================================================
    // State
    // =========================================================================

    struct AgentTerms {
        bytes32 councilId;
        bytes32 termsHash;
        uint256 version;
        uint256 maxPayout;
        bool active;
    }

    mapping(uint256 => AgentTerms) private _agentTerms;
    mapping(uint256 => address) private _agentProviders;

    // =========================================================================
    // Setup Functions
    // =========================================================================

    /**
     * @notice Set agent terms
     */
    function setAgentTerms(
        uint256 agentId,
        bytes32 councilId,
        bytes32 termsHash,
        uint256 version,
        uint256 maxPayout,
        bool active
    ) external {
        _agentTerms[agentId] = AgentTerms({
            councilId: councilId,
            termsHash: termsHash,
            version: version,
            maxPayout: maxPayout,
            active: active
        });
    }

    /**
     * @notice Set agent provider
     */
    function setAgentProvider(uint256 agentId, address provider) external {
        _agentProviders[agentId] = provider;
    }

    // =========================================================================
    // View Functions (matches ITermsRegistry interface)
    // =========================================================================

    /**
     * @notice Check if agent has active terms
     */
    function hasActiveTerms(uint256 agentId) external view returns (bool) {
        return _agentTerms[agentId].active;
    }

    /**
     * @notice Get active terms for an agent (required by ClaimsManager)
     */
    function getActiveTerms(uint256 agentId) external view returns (
        ITermsRegistry.TermsVersion memory terms,
        uint256 version
    ) {
        AgentTerms storage t = _agentTerms[agentId];
        terms = ITermsRegistry.TermsVersion({
            contentHash: t.termsHash,
            contentUri: "ipfs://test",
            councilId: t.councilId,
            registeredAt: block.timestamp,
            active: t.active
        });
        version = t.version;
    }

    /**
     * @notice Get current terms for an agent
     */
    function getCurrentTerms(uint256 agentId) external view returns (
        bytes32 termsHash,
        string memory termsUri,
        uint256 version,
        uint256 effectiveAt,
        uint256 maxPayout
    ) {
        AgentTerms storage terms = _agentTerms[agentId];
        return (
            terms.termsHash,
            "", // termsUri not needed for tests
            terms.version,
            block.timestamp,
            terms.maxPayout
        );
    }

    /**
     * @notice Get agent's council
     */
    function getAgentCouncil(uint256 agentId) external view returns (bytes32) {
        return _agentTerms[agentId].councilId;
    }

    /**
     * @notice Get agent provider
     */
    function getAgentProvider(uint256 agentId) external view returns (address) {
        return _agentProviders[agentId];
    }

    /**
     * @notice Get current terms version
     */
    function getCurrentTermsVersion(uint256 agentId) external view returns (uint256) {
        return _agentTerms[agentId].version;
    }

    /**
     * @notice Get current terms hash
     */
    function getCurrentTermsHash(uint256 agentId) external view returns (bytes32) {
        return _agentTerms[agentId].termsHash;
    }
}
