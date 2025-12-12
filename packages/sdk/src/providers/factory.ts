/**
 * Data Provider Factory
 * 
 * Creates the appropriate data provider based on configuration.
 * 
 * Usage:
 * 
 *   // Testnet: Use RPC (simple, no infrastructure needed)
 *   const provider = createDataProvider({
 *     mode: 'rpc',
 *     rpcUrl: 'https://sepolia.base.org',
 *     contracts: { ... }
 *   });
 * 
 *   // Mainnet: Use Subgraph (efficient queries, needs subgraph deployed)
 *   const provider = createDataProvider({
 *     mode: 'subgraph',
 *     subgraphUrl: 'https://api.studio.thegraph.com/query/.../trustful-agents/version/latest'
 *   });
 */

import type { DataProvider, DataProviderConfig, DataProviderMode } from './index';
import { RpcDataProvider } from './rpc';
import { SubgraphDataProvider } from './subgraph';

/**
 * Create a data provider instance
 */
export function createDataProvider(config: DataProviderConfig): DataProvider {
  switch (config.mode) {
    case 'rpc':
      return new RpcDataProvider(config);
    
    case 'subgraph':
      return new SubgraphDataProvider(config);
    
    default:
      throw new Error(`Unknown data provider mode: ${(config as any).mode}`);
  }
}

/**
 * Recommended configuration for different environments
 */
export const RECOMMENDED_CONFIGS = {
  /**
   * Local development with Anvil
   */
  local: {
    mode: 'rpc' as DataProviderMode,
    rpcUrl: 'http://localhost:8545',
  },

  /**
   * Base Sepolia testnet
   */
  testnet: {
    mode: 'rpc' as DataProviderMode,
    rpcUrl: 'https://sepolia.base.org',
  },

  /**
   * Base mainnet (requires deployed subgraph)
   */
  mainnet: {
    mode: 'subgraph' as DataProviderMode,
    subgraphUrl: 'https://api.studio.thegraph.com/query/YOUR_ID/trustful-agents/version/latest',
  },
};

/**
 * Helper to determine the best mode for a chain
 */
export function getRecommendedMode(chainId: number): DataProviderMode {
  switch (chainId) {
    case 31337: // Anvil
    case 84532: // Base Sepolia
      return 'rpc';
    
    case 8453: // Base mainnet
      return 'subgraph';
    
    default:
      return 'rpc';
  }
}
