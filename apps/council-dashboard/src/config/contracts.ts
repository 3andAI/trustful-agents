// =============================================================================
// Council Dashboard Contract Configuration
// Re-exports from centralized config
// =============================================================================

export {
  CHAIN_ID,
  CONTRACTS,
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
  RulingExecutorAbi,
} from '../../../../config/generated/contracts';

// Alias for backward compatibility (council dashboard uses lowercase 'contracts')
import { CONTRACTS, CHAIN_ID } from '../../../../config/generated/contracts';
export const contracts = {
  chainId: CHAIN_ID,
  usdc: CONTRACTS.usdc,
  erc8004Registry: CONTRACTS.erc8004Registry,
  collateralVault: CONTRACTS.collateralVault,
  termsRegistry: CONTRACTS.termsRegistry,
  councilRegistry: CONTRACTS.councilRegistry,
  trustfulValidator: CONTRACTS.trustfulValidator,
  claimsManager: CONTRACTS.claimsManager,
  rulingExecutor: CONTRACTS.rulingExecutor,
} as const;
