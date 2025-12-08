// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IRulingExecutor
 * @notice Executes approved claim compensations and handles deposits
 * @dev Coordinates between ClaimsManager and CollateralVault
 */
interface IRulingExecutor {
    // =========================================================================
    // Events
    // =========================================================================

    event RulingExecuted(
        uint256 indexed claimId,
        uint256 indexed agentId,
        address indexed recipient,
        uint256 compensationAmount,
        uint256 depositReturned
    );

    event RejectionExecuted(
        uint256 indexed claimId,
        uint256 depositForfeited,
        bytes32 councilId
    );

    event PartialExecution(
        uint256 indexed claimId,
        uint256 requestedAmount,
        uint256 actualAmount,
        string reason
    );

    // =========================================================================
    // Core Functions
    // =========================================================================

    /**
     * @notice Execute an approved claim ruling
     * @param claimId The claim ID to execute
     * @dev Can be called by anyone after claim is approved
     * @dev Transfers compensation from CollateralVault to claimant
     * @dev Returns claimant deposit
     */
    function executeRuling(uint256 claimId) external;

    /**
     * @notice Execute a rejected claim (forfeit deposit)
     * @param claimId The claim ID
     * @dev Can be called by anyone after claim is rejected
     * @dev Forfeits claimant deposit to council treasury
     * @dev Unlocks collateral
     */
    function executeRejection(uint256 claimId) external;

    /**
     * @notice Execute multiple rulings in batch
     * @param claimIds Array of claim IDs
     * @dev Continues on individual failures
     */
    function batchExecute(uint256[] calldata claimIds) external;

    // =========================================================================
    // View Functions
    // =========================================================================

    /**
     * @notice Check if a claim can be executed
     * @param claimId The claim ID
     * @return canExecute True if ready for execution
     * @return reason Reason if cannot execute
     */
    function canExecute(uint256 claimId)
        external
        view
        returns (bool canExecute, string memory reason);

    /**
     * @notice Preview execution outcome
     * @param claimId The claim ID
     * @return compensationAmount Amount that will be paid
     * @return depositReturn Amount of deposit to return
     * @return collateralUnlock Amount of collateral to unlock
     */
    function previewExecution(uint256 claimId)
        external
        view
        returns (
            uint256 compensationAmount,
            uint256 depositReturn,
            uint256 collateralUnlock
        );

    /**
     * @notice Get claims ready for execution
     * @return claimIds Array of executable claim IDs
     */
    function getExecutableClaims() external view returns (uint256[] memory claimIds);
}
