// =============================================================================
// Governance Dashboard Contract Configuration
// Re-exports from centralized config
// =============================================================================

export {
  CHAIN_ID,
  CONTRACTS,
  API_URL,
  SAFE_ADDRESS,
  SAFE_TX_SERVICE_URL,
  SAFE_APP_URL,
  SAFE_NETWORK_PREFIX,
  DASHBOARD_URLS,
  CouncilRegistryAbi,
} from '../../../../config/generated/contracts';

// Chain helper
import { base, baseSepolia, sepolia, type Chain } from 'viem/chains';
import { CHAIN_ID } from '../../../../config/generated/contracts';
export const chain: Chain = CHAIN_ID === 8453 ? base : CHAIN_ID === 11155111 ? sepolia : baseSepolia;
