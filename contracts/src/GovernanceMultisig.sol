// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title GovernanceMultisig
 * @notice Simple 2-of-3 multisig for governance actions
 * @dev Collects EIP-712 signatures off-chain, verifies on-chain before executing
 */
contract GovernanceMultisig is EIP712 {
    using ECDSA for bytes32;

    // ============================================================================
    // Constants
    // ============================================================================

    uint256 public constant THRESHOLD = 2;
    uint256 public constant SIGNER_COUNT = 3;

    // EIP-712 type hash for proposals
    bytes32 public constant PROPOSAL_TYPEHASH = keccak256(
        "Proposal(address target,bytes data,uint256 nonce,string description)"
    );

    // ============================================================================
    // State
    // ============================================================================

    address[3] public signers;
    mapping(address => bool) public isSigner;
    uint256 public nonce;

    // Track executed proposal hashes to prevent replay
    mapping(bytes32 => bool) public executed;

    // ============================================================================
    // Events
    // ============================================================================

    event ProposalExecuted(
        bytes32 indexed proposalHash,
        address indexed target,
        bytes data,
        uint256 nonce,
        string description,
        address executor
    );

    event SignerUpdated(uint256 indexed index, address oldSigner, address newSigner);

    // ============================================================================
    // Errors
    // ============================================================================

    error InvalidSignature();
    error InsufficientSignatures();
    error DuplicateSigner();
    error ProposalAlreadyExecuted();
    error ExecutionFailed();
    error InvalidSignerIndex();
    error ZeroAddress();
    error NotSigner();

    // ============================================================================
    // Constructor
    // ============================================================================

    constructor(
        address _signer1,
        address _signer2,
        address _signer3
    ) EIP712("GovernanceMultisig", "1") {
        if (_signer1 == address(0) || _signer2 == address(0) || _signer3 == address(0)) {
            revert ZeroAddress();
        }
        if (_signer1 == _signer2 || _signer2 == _signer3 || _signer1 == _signer3) {
            revert DuplicateSigner();
        }

        signers[0] = _signer1;
        signers[1] = _signer2;
        signers[2] = _signer3;

        isSigner[_signer1] = true;
        isSigner[_signer2] = true;
        isSigner[_signer3] = true;
    }

    // ============================================================================
    // External Functions
    // ============================================================================

    /**
     * @notice Execute a proposal with 2-of-3 signatures
     * @param target The contract to call
     * @param data The calldata to send
     * @param description Human-readable description of the action
     * @param signatures Array of 2 or more signatures from signers
     */
    function execute(
        address target,
        bytes calldata data,
        string calldata description,
        bytes[] calldata signatures
    ) external returns (bytes memory) {
        if (signatures.length < THRESHOLD) {
            revert InsufficientSignatures();
        }

        uint256 currentNonce = nonce;
        
        // Compute proposal hash
        bytes32 structHash = keccak256(
            abi.encode(
                PROPOSAL_TYPEHASH,
                target,
                keccak256(data),
                currentNonce,
                keccak256(bytes(description))
            )
        );
        bytes32 proposalHash = _hashTypedDataV4(structHash);

        // Check not already executed
        if (executed[proposalHash]) {
            revert ProposalAlreadyExecuted();
        }

        // Verify signatures
        address[] memory signersSeen = new address[](signatures.length);
        uint256 validSignatures = 0;

        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = proposalHash.recover(signatures[i]);
            
            // Check is valid signer
            if (!isSigner[signer]) {
                revert InvalidSignature();
            }

            // Check for duplicates
            for (uint256 j = 0; j < validSignatures; j++) {
                if (signersSeen[j] == signer) {
                    revert DuplicateSigner();
                }
            }

            signersSeen[validSignatures] = signer;
            validSignatures++;
        }

        if (validSignatures < THRESHOLD) {
            revert InsufficientSignatures();
        }

        // Mark as executed and increment nonce
        executed[proposalHash] = true;
        nonce = currentNonce + 1;

        // Execute the call
        (bool success, bytes memory result) = target.call(data);
        if (!success) {
            // Bubble up the revert reason
            if (result.length > 0) {
                assembly {
                    revert(add(result, 32), mload(result))
                }
            }
            revert ExecutionFailed();
        }

        emit ProposalExecuted(proposalHash, target, data, currentNonce, description, msg.sender);

        return result;
    }

    /**
     * @notice Update a signer (requires 2-of-3 approval)
     * @param index Index of signer to replace (0, 1, or 2)
     * @param newSigner New signer address
     * @param signatures Array of 2+ signatures approving this change
     */
    function updateSigner(
        uint256 index,
        address newSigner,
        bytes[] calldata signatures
    ) external {
        if (index >= SIGNER_COUNT) {
            revert InvalidSignerIndex();
        }
        if (newSigner == address(0)) {
            revert ZeroAddress();
        }
        if (isSigner[newSigner]) {
            revert DuplicateSigner();
        }

        // Encode as a self-call and verify signatures
        bytes memory data = abi.encodeWithSignature(
            "_updateSignerInternal(uint256,address)",
            index,
            newSigner
        );

        uint256 currentNonce = nonce;
        string memory description = "Update signer";

        bytes32 structHash = keccak256(
            abi.encode(
                PROPOSAL_TYPEHASH,
                address(this),
                keccak256(data),
                currentNonce,
                keccak256(bytes(description))
            )
        );
        bytes32 proposalHash = _hashTypedDataV4(structHash);

        if (executed[proposalHash]) {
            revert ProposalAlreadyExecuted();
        }

        // Verify signatures
        address[] memory signersSeen = new address[](signatures.length);
        uint256 validSignatures = 0;

        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = proposalHash.recover(signatures[i]);
            
            if (!isSigner[signer]) {
                revert InvalidSignature();
            }

            for (uint256 j = 0; j < validSignatures; j++) {
                if (signersSeen[j] == signer) {
                    revert DuplicateSigner();
                }
            }

            signersSeen[validSignatures] = signer;
            validSignatures++;
        }

        if (validSignatures < THRESHOLD) {
            revert InsufficientSignatures();
        }

        // Mark executed and increment nonce
        executed[proposalHash] = true;
        nonce = currentNonce + 1;

        // Update signer
        address oldSigner = signers[index];
        isSigner[oldSigner] = false;
        isSigner[newSigner] = true;
        signers[index] = newSigner;

        emit SignerUpdated(index, oldSigner, newSigner);
    }

    // ============================================================================
    // View Functions
    // ============================================================================

    /**
     * @notice Get all signers
     */
    function getSigners() external view returns (address[3] memory) {
        return signers;
    }

    /**
     * @notice Get the EIP-712 domain separator
     */
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @notice Compute the hash that needs to be signed for a proposal
     * @param target The contract to call
     * @param data The calldata to send
     * @param proposalNonce The nonce for this proposal (use current nonce)
     * @param description Human-readable description
     */
    function getProposalHash(
        address target,
        bytes calldata data,
        uint256 proposalNonce,
        string calldata description
    ) external view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                PROPOSAL_TYPEHASH,
                target,
                keccak256(data),
                proposalNonce,
                keccak256(bytes(description))
            )
        );
        return _hashTypedDataV4(structHash);
    }
}
