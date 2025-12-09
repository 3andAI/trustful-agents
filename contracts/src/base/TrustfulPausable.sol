// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ITrustfulPausable } from "../interfaces/ITrustfulPausable.sol";

/**
 * @title TrustfulPausable
 * @notice Base contract implementing emergency pause mechanism
 * @dev All core Trustful contracts inherit from this
 */
abstract contract TrustfulPausable is ITrustfulPausable {
    // =========================================================================
    // State
    // =========================================================================

    /// @notice Governance address (multisig) with full control
    address public governance;

    /// @notice Mapping of pause scope to paused status
    mapping(PauseScope => bool) private _pausedScopes;

    /// @notice Set of authorized pausers
    mapping(address => bool) private _pausers;

    /// @notice Array of pauser addresses for enumeration
    address[] private _pauserList;

    // =========================================================================
    // Errors
    // =========================================================================

    error NotGovernance(address caller);
    error NotPauser(address caller);
    error AlreadyPaused(PauseScope scope);
    error NotPaused(PauseScope scope);
    error AlreadyPauser(address account);
    error NotAPauser(address account);
    error ZeroAddress();

    // =========================================================================
    // Modifiers
    // =========================================================================

    modifier onlyGovernance() {
        if (msg.sender != governance) revert NotGovernance(msg.sender);
        _;
    }

    modifier onlyPauser() {
        if (!_pausers[msg.sender]) revert NotPauser(msg.sender);
        _;
    }

    modifier whenNotPaused(PauseScope scope) {
        if (_pausedScopes[PauseScope.All] || _pausedScopes[scope]) {
            revert AlreadyPaused(scope);
        }
        _;
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor(address _governance) {
        if (_governance == address(0)) revert ZeroAddress();
        governance = _governance;
        _pausers[_governance] = true;
        _pauserList.push(_governance);
    }

    // =========================================================================
    // Pause Functions
    // =========================================================================

    /// @inheritdoc ITrustfulPausable
    function pause(PauseScope scope, string calldata reason) external onlyPauser {
        if (_pausedScopes[scope]) revert AlreadyPaused(scope);
        _pausedScopes[scope] = true;
        emit Paused(msg.sender, scope, reason);
    }

    /// @inheritdoc ITrustfulPausable
    function unpause(PauseScope scope) external onlyGovernance {
        if (!_pausedScopes[scope]) revert NotPaused(scope);
        _pausedScopes[scope] = false;
        emit Unpaused(msg.sender, scope);
    }

    /// @inheritdoc ITrustfulPausable
    function emergencyPauseAll(string calldata reason) external onlyPauser {
        _pausedScopes[PauseScope.All] = true;
        emit Paused(msg.sender, PauseScope.All, reason);
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /// @inheritdoc ITrustfulPausable
    function isPaused(PauseScope scope) external view returns (bool) {
        return _pausedScopes[PauseScope.All] || _pausedScopes[scope];
    }

    /// @inheritdoc ITrustfulPausable
    function isFullyPaused() external view returns (bool allPaused) {
        return _pausedScopes[PauseScope.All];
    }

    /// @inheritdoc ITrustfulPausable
    function getPauseStatus()
        external
        view
        returns (PauseScope[] memory scopes, bool[] memory statuses)
    {
        scopes = new PauseScope[](6);
        statuses = new bool[](6);

        scopes[0] = PauseScope.All;
        scopes[1] = PauseScope.Deposits;
        scopes[2] = PauseScope.Withdrawals;
        scopes[3] = PauseScope.Claims;
        scopes[4] = PauseScope.Voting;
        scopes[5] = PauseScope.Executions;

        bool allPaused = _pausedScopes[PauseScope.All];
        for (uint256 i = 0; i < 6; i++) {
            statuses[i] = allPaused || _pausedScopes[scopes[i]];
        }
    }

    /// @inheritdoc ITrustfulPausable
    function isPauser(address account) external view returns (bool) {
        return _pausers[account];
    }

    /// @inheritdoc ITrustfulPausable
    function getPausers() external view returns (address[] memory pausers) {
        return _pauserList;
    }

    // =========================================================================
    // Admin Functions
    // =========================================================================

    /// @inheritdoc ITrustfulPausable
    function addPauser(address pauser) external onlyGovernance {
        if (pauser == address(0)) revert ZeroAddress();
        if (_pausers[pauser]) revert AlreadyPauser(pauser);
        _pausers[pauser] = true;
        _pauserList.push(pauser);
        emit PauserAdded(pauser);
    }

    /// @inheritdoc ITrustfulPausable
    function removePauser(address pauser) external onlyGovernance {
        if (!_pausers[pauser]) revert NotAPauser(pauser);
        _pausers[pauser] = false;

        // Remove from list (order doesn't matter, so swap with last)
        for (uint256 i = 0; i < _pauserList.length; i++) {
            if (_pauserList[i] == pauser) {
                _pauserList[i] = _pauserList[_pauserList.length - 1];
                _pauserList.pop();
                break;
            }
        }

        emit PauserRemoved(pauser);
    }

    // =========================================================================
    // Internal Helpers
    // =========================================================================

    /// @notice Check if a scope is currently active (not paused)
    function _isActive(PauseScope scope) internal view returns (bool) {
        return !_pausedScopes[PauseScope.All] && !_pausedScopes[scope];
    }
}
