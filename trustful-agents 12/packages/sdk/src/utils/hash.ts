import { keccak256, encodePacked } from "viem";

/**
 * Compute the ERC-8004 request hash for validation
 * @param agentId The agent token ID
 * @param nonce The validation nonce
 * @param validatorAddress The validator contract address
 * @returns The request hash
 */
export function computeRequestHash(
  agentId: bigint,
  nonce: bigint,
  validatorAddress: `0x${string}`
): `0x${string}` {
  return keccak256(
    encodePacked(
      ["uint256", "uint256", "address"],
      [agentId, nonce, validatorAddress]
    )
  );
}

/**
 * Compute content hash for T&C document
 * @param content The full T&C content string
 * @returns keccak256 hash
 */
export function computeContentHash(content: string): `0x${string}` {
  return keccak256(new TextEncoder().encode(content));
}

/**
 * Compute evidence hash
 * @param evidence Evidence document content or URI
 * @returns keccak256 hash
 */
export function computeEvidenceHash(evidence: string): `0x${string}` {
  return keccak256(new TextEncoder().encode(evidence));
}
