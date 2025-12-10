/**
 * Trustful Agents SDK
 *
 * TypeScript SDK for interacting with Trustful Agents smart contracts.
 *
 * @example
 * ```ts
 * import { createTrustfulClient } from '@trustful-agents/sdk';
 *
 * const client = createTrustfulClient({
 *   chainId: 84532, // Base Sepolia
 *   rpcUrl: 'https://sepolia.base.org',
 * });
 *
 * // Check if agent is validated
 * const isValid = await client.isValidated(agentId);
 *
 * // Get trust info
 * const trustInfo = await client.getTrustInfo(agentId);
 * ```
 */

export { createTrustfulClient, type TrustfulClient } from "./client";
export { type TrustfulConfig, DEFAULT_CONFIG } from "./config";

// Contract ABIs
export * from "./contracts";

// Types
export * from "./types";

// Utils
export { formatUSDC, parseUSDC } from "./utils/usdc";
export { computeRequestHash } from "./utils/hash";
