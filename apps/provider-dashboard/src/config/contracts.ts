// =============================================================================
// Provider Dashboard Contract Configuration
// Re-exports from centralized config with dashboard-specific additions
// =============================================================================

// Re-export everything from centralized config
export {
  // Network
  CHAIN_ID,
  BLOCK_EXPLORER_URL,
  RPC_URL,
  
  // Contracts
  CONTRACTS,
  
  // Service URLs
  API_URL,
  SUBGRAPH_URL,
  IPFS_GATEWAY,
  
  // Constants
  USDC_DECIMALS,
  
  // ABIs - both naming conventions for compatibility
  USDCAbi,
  USDCAbi as MockUsdcAbi,
  ERC8004RegistryAbi,
  ERC8004RegistryAbi as Erc8004RegistryAbi,
  ERC8004RegistryAbi as MockErc8004RegistryAbi,
  CollateralVaultAbi,
  TermsRegistryAbi,
  TrustfulValidatorAbi,
  CouncilRegistryAbi,
  ClaimsManagerAbi,
} from '../../../../config/generated/contracts';

// ---------------------------------------------------------------------------
// Dashboard-specific constants
// ---------------------------------------------------------------------------

export const GRACE_PERIOD_DAYS = 7;
export const GRACE_PERIOD_SECONDS = GRACE_PERIOD_DAYS * 24 * 60 * 60;

// Alias for backward compatibility
import { API_URL } from '../../../../config/generated/contracts';
export const API_BASE_URL = API_URL;

// Check if contracts are configured
import { CONTRACTS } from '../../../../config/generated/contracts';
export const isConfigured = CONTRACTS.usdc !== '0x0000000000000000000000000000000000000000';
