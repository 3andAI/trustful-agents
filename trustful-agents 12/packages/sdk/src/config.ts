import { type Address } from "viem";

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
  validationApiUrl: string;
  subgraphUrl: string;
}

// Base Sepolia (testnet)
export const BASE_SEPOLIA_CONFIG: TrustfulConfig = {
  chainId: 84532,
  contracts: {
    collateralVault: "0x0000000000000000000000000000000000000000" as Address,
    termsRegistry: "0x0000000000000000000000000000000000000000" as Address,
    trustfulValidator: "0x0000000000000000000000000000000000000000" as Address,
    councilRegistry: "0x0000000000000000000000000000000000000000" as Address,
    claimsManager: "0x0000000000000000000000000000000000000000" as Address,
    rulingExecutor: "0x0000000000000000000000000000000000000000" as Address,
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address, // Base Sepolia USDC
    erc8004Registry: "0x0000000000000000000000000000000000000000" as Address,
  },
  validationApiUrl: "https://api.trustful-agents.org/v1",
  subgraphUrl: "https://api.studio.thegraph.com/query/.../trustful-agents/version/latest",
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
  validationApiUrl: "https://api.trustful-agents.org/v1",
  subgraphUrl: "https://api.studio.thegraph.com/query/.../trustful-agents/version/latest",
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
