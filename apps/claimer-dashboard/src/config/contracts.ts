// =============================================================================
// Claimer Dashboard Contract Configuration
// Re-exports from centralized config with dashboard-specific naming
// =============================================================================

import {
  CHAIN_ID,
  CONTRACTS as BASE_CONTRACTS,
  API_URL,
  SUBGRAPH_URL,
  IPFS_GATEWAY,
  USDC_DECIMALS,
  // ABIs
  USDCAbi,
  ClaimsManagerAbi,
  ERC8004RegistryAbi,
  TermsRegistryAbi,
  CollateralVaultAbi,
  TrustfulValidatorAbi,
  CouncilRegistryAbi,
} from '../../../../config/generated/contracts';

// Re-export for convenience
export { CHAIN_ID, API_URL, SUBGRAPH_URL, IPFS_GATEWAY, USDC_DECIMALS };

// Contract addresses with UPPERCASE naming (claimer dashboard convention)
export const CONTRACTS = {
  USDC: BASE_CONTRACTS.usdc,
  ERC8004_REGISTRY: BASE_CONTRACTS.erc8004Registry,
  COLLATERAL_VAULT: BASE_CONTRACTS.collateralVault,
  TERMS_REGISTRY: BASE_CONTRACTS.termsRegistry,
  COUNCIL_REGISTRY: BASE_CONTRACTS.councilRegistry,
  TRUSTFUL_VALIDATOR: BASE_CONTRACTS.trustfulValidator,
  CLAIMS_MANAGER: BASE_CONTRACTS.claimsManager,
  RULING_EXECUTOR: BASE_CONTRACTS.rulingExecutor,
} as const;

// ABI exports with claimer dashboard naming convention
export const USDC_ABI = USDCAbi;
export const CLAIMS_MANAGER_ABI = ClaimsManagerAbi;
export const ERC8004_REGISTRY_ABI = ERC8004RegistryAbi;
export const TERMS_REGISTRY_ABI = TermsRegistryAbi;
export const COLLATERAL_VAULT_ABI = CollateralVaultAbi;
export const TRUSTFUL_VALIDATOR_ABI = TrustfulValidatorAbi;
export const COUNCIL_REGISTRY_ABI = CouncilRegistryAbi;
