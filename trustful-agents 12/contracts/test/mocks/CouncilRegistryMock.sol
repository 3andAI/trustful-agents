// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title CouncilRegistryMock
 * @notice Mock CouncilRegistry for testing
 */
contract CouncilRegistryMock {
    // =========================================================================
    // State
    // =========================================================================

    mapping(bytes32 => bool) private _activeCouncils;
    mapping(bytes32 => address[]) private _councilMembers;

    // =========================================================================
    // Setup Functions
    // =========================================================================

    /**
     * @notice Set council active status
     * @param councilId The council ID
     * @param active Whether the council is active
     */
    function setCouncilActive(bytes32 councilId, bool active) external {
        _activeCouncils[councilId] = active;
    }

    /**
     * @notice Add a member to a council
     * @param councilId The council ID
     * @param member The member address
     */
    function addMember(bytes32 councilId, address member) external {
        _councilMembers[councilId].push(member);
    }

    /**
     * @notice Set council members
     * @param councilId The council ID
     * @param members The member addresses
     */
    function setMembers(bytes32 councilId, address[] calldata members) external {
        delete _councilMembers[councilId];
        for (uint256 i = 0; i < members.length; i++) {
            _councilMembers[councilId].push(members[i]);
        }
    }

    // =========================================================================
    // View Functions (matches ICouncilRegistry interface)
    // =========================================================================

    /**
     * @notice Check if a council is active
     * @param councilId The council ID
     * @return isActive True if active
     */
    function isCouncilActive(bytes32 councilId) external view returns (bool) {
        return _activeCouncils[councilId];
    }

    /**
     * @notice Check if an address is a member of a council
     * @param councilId The council ID
     * @param member The address to check
     * @return isMember True if member
     */
    function isMember(bytes32 councilId, address member) external view returns (bool) {
        address[] storage members = _councilMembers[councilId];
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] == member) {
                return true;
            }
        }
        return false;
    }

    /**
     * @notice Get council members
     * @param councilId The council ID
     * @return members Array of member addresses
     */
    function getMembers(bytes32 councilId) external view returns (address[] memory) {
        return _councilMembers[councilId];
    }

    /**
     * @notice Get member count
     * @param councilId The council ID
     * @return count Number of members
     */
    function getMemberCount(bytes32 councilId) external view returns (uint256) {
        return _councilMembers[councilId].length;
    }
}
