import { type Address } from "viem";
import type { DataProviderMode } from "./providers";

export interface TrustfulConfig {
  chainId: number;
  contracts: {
    collateralVault: Address;
    termsRegistry: Address;
    trustfulValidator: Address;
    councilRegistry: Address;
    claimsManager: Address;
    rulingExecutor: Address;
    usdc: Address;
    erc8004Registry: Address;
  };
  // Data source configuration
  dataSource: {
    mode: DataProviderMode;
    rpcUrl?: string;
    subgraphUrl?: string;
  };
  validationApiUrl: string;
}

// Base Sepolia (testnet) - MVP contracts deployed
export const BASE_SEPOLIA_CONFIG: TrustfulConfig = {
  chainId: 84532,
  contracts: {
    // MVP contracts (deployed)
    collateralVault: "0xDDC4eebCf1D6e62821A25Fa26B6Df021dcee11C4" as Address,
    termsRegistry: "0x5Ae03075290e284ee05Fa648843F0ce81fffFA5d" as Address,
    trustfulValidator: "0xe75817D8aADA91968AD492d583602Ec10B2569a6" as Address,
    // Phase 1 contracts (update after deployment)
    councilRegistry: "0x0000000000000000000000000000000000000000" as Address,
    claimsManager: "0x0000000000000000000000000000000000000000" as Address,
    rulingExecutor: "0x0000000000000000000000000000000000000000" as Address,
    // External dependencies (mocks on testnet)
    usdc: "0x63d5a529eD8a8192E2201c0cea4469397efE30Ba" as Address,
    erc8004Registry: "0xb3B4b5042Fd3600404846671Ff5558719860b694" as Address,
  },
  dataSource: {
    mode: 'rpc',
    rpcUrl: 'https://sepolia.base.org',
  },
  validationApiUrl: "https://api.trustful-agents.org/v1",
};

// Base Mainnet
export const BASE_MAINNET_CONFIG: TrustfulConfig = {
  chainId: 8453,
  contracts: {
    collateralVault: "0x0000000000000000000000000000000000000000" as Address,
    termsRegistry: "0x0000000000000000000000000000000000000000" as Address,
    trustfulValidator: "0x0000000000000000000000000000000000000000" as Address,
    councilRegistry: "0x0000000000000000000000000000000000000000" as Address,
    claimsManager: "0x0000000000000000000000000000000000000000" as Address,
    rulingExecutor: "0x0000000000000000000000000000000000000000" as Address,
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address, // Base USDC
    erc8004Registry: "0x0000000000000000000000000000000000000000" as Address,
  },
  dataSource: {
    mode: 'subgraph',
    subgraphUrl: 'https://api.studio.thegraph.com/query/YOUR_ID/trustful-agents/version/latest',
  },
  validationApiUrl: "https://api.trustful-agents.org/v1",
};

export const DEFAULT_CONFIG = BASE_SEPOLIA_CONFIG;

export function getChainConfig(chainId: number): TrustfulConfig {
  switch (chainId) {
    case 84532:
      return BASE_SEPOLIA_CONFIG;
    case 8453:
      return BASE_MAINNET_CONFIG;
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`);
  }
}
