// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ITrustfulPausable
 * @notice Emergency pause mechanism controlled by multisig
 * @dev All core contracts inherit from this for consistent pause functionality
 */
interface ITrustfulPausable {
    // =========================================================================
    // Enums
    // =========================================================================

    enum PauseScope {
        All,                // Pause everything
        Deposits,           // Only pause new deposits
        Withdrawals,        // Only pause withdrawals
        Claims,             // Only pause new claims
        Voting,             // Only pause voting
        Executions          // Only pause ruling executions
    }

    // =========================================================================
    // Events
    // =========================================================================

    event Paused(address indexed by, PauseScope scope, string reason);
    event Unpaused(address indexed by, PauseScope scope);
    event EmergencyWithdrawal(address indexed by, address token, uint256 amount);
    event PauserAdded(address indexed pauser);
    event PauserRemoved(address indexed pauser);

    // =========================================================================
    // Pause Functions
    // =========================================================================

    /**
     * @notice Pause specific functionality
     * @param scope What to pause
     * @param reason Human-readable reason
     * @dev Only authorized pausers can call
     */
    function pause(PauseScope scope, string calldata reason) external;

    /**
     * @notice Unpause specific functionality
     * @param scope What to unpause
     * @dev Only governance can call (higher threshold than pause)
     */
    function unpause(PauseScope scope) external;

    /**
     * @notice Emergency pause all functionality
     * @param reason Human-readable reason
     * @dev Any pauser can trigger
     */
    function emergencyPauseAll(string calldata reason) external;

    // =========================================================================
    // View Functions
    // =========================================================================

    /**
     * @notice Check if a scope is currently paused
     * @param scope The scope to check
     * @return isPaused True if paused
     */
    function isPaused(PauseScope scope) external view returns (bool isPaused);

    /**
     * @notice Check if everything is paused
     * @return allPaused True if All scope is paused
     */
    function isFullyPaused() external view returns (bool allPaused);

    /**
     * @notice Get pause status for all scopes
     * @return scopes Array of PauseScope values
     * @return statuses Array of pause statuses
     */
    function getPauseStatus()
        external
        view
        returns (PauseScope[] memory scopes, bool[] memory statuses);

    /**
     * @notice Check if an address is an authorized pauser
     * @param account The address to check
     * @return isPauser True if authorized
     */
    function isPauser(address account) external view returns (bool isPauser);

    /**
     * @notice Get all authorized pausers
     * @return pausers Array of pauser addresses
     */
    function getPausers() external view returns (address[] memory pausers);

    // =========================================================================
    // Admin Functions
    // =========================================================================

    /**
     * @notice Add a new pauser
     * @param pauser The address to authorize
     * @dev Only governance can call
     */
    function addPauser(address pauser) external;

    /**
     * @notice Remove a pauser
     * @param pauser The address to remove
     * @dev Only governance can call
     */
    function removePauser(address pauser) external;
}
