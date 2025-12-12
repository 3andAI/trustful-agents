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
 * 
 * @example Data Provider (for list queries)
 * ```ts
 * import { createDataProvider } from '@trustful-agents/sdk';
 * 
 * // Testnet: Use RPC
 * const provider = createDataProvider({
 *   mode: 'rpc',
 *   rpcUrl: 'https://sepolia.base.org',
 *   contracts: { ... }
 * });
 * 
 * // Mainnet: Use Subgraph
 * const provider = createDataProvider({
 *   mode: 'subgraph',
 *   subgraphUrl: 'https://api.studio.thegraph.com/...'
 * });
 * 
 * // Query claims
 * const claims = await provider.getClaims({ agentId: 5n, status: 'Voting' });
 * ```
 */

export { createTrustfulClient, type TrustfulClient } from "./client";
export { type TrustfulConfig, DEFAULT_CONFIG } from "./config";

// Contract ABIs
export * from "./contracts";

// Types
export * from "./types";

// Data Providers (RPC for testnet, Subgraph for mainnet)
export {
  createDataProvider,
  RpcDataProvider,
  SubgraphDataProvider,
  RECOMMENDED_CONFIGS,
  getRecommendedMode,
  type DataProvider,
  type DataProviderConfig,
  type DataProviderMode,
  type ClaimListQuery,
  type ClaimListItem,
  type AgentListQuery,
  type AgentListItem,
  type CouncilMemberQuery,
  type CouncilMemberItem,
  type VoteListQuery,
  type VoteItem,
} from "./providers";

// Utils
export { formatUSDC, parseUSDC } from "./utils/usdc";
export { computeRequestHash } from "./utils/hash";
