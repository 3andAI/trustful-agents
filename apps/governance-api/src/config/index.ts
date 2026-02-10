// =============================================================================
// Governance API — Central Configuration
// =============================================================================
// All routes and services import from here. No file should read process.env
// for contract addresses, chain config, or service URLs directly.
//
// This module re-exports everything from the generated contracts.ts and adds
// runtime-only config (publicClient, database URL, secrets from env).
// =============================================================================

import { createPublicClient, http, type Address, type Chain } from 'viem';
import { base, baseSepolia } from 'viem/chains';

// Re-export everything from the generated config
export {
  // Network
  NETWORK,
  CHAIN_ID,
  RPC_URL,
  BLOCK_EXPLORER_URL,
  START_BLOCK,

  // Contract addresses (object + individual)
  CONTRACTS,
  USDC_ADDRESS,
  ERC8004_REGISTRY_ADDRESS,
  COLLATERAL_VAULT_ADDRESS,
  TERMS_REGISTRY_ADDRESS,
  COUNCIL_REGISTRY_ADDRESS,
  TRUSTFUL_VALIDATOR_ADDRESS,
  CLAIMS_MANAGER_ADDRESS,
  RULING_EXECUTOR_ADDRESS,

  // Safe
  SAFE_ADDRESS,
  SAFE_TX_SERVICE_URL,
  SAFE_APP_URL,
  SAFE_NETWORK_PREFIX,

  // Service URLs
  API_URL,
  SUBGRAPH_URL,
  SUBGRAPH_VERSION,
  IPFS_GATEWAY,

  // Dashboard URLs
  DASHBOARD_URLS,

  // Database
  DATABASE_NAME,
  DATABASE_PORT,

  // USDC
  USDC_DECIMALS,
  USDC_SYMBOL,

  // ABIs
  ClaimsManagerAbi,
  CollateralVaultAbi,
  CouncilRegistryAbi,
  ERC8004RegistryAbi,
  RulingExecutorAbi,
  TermsRegistryAbi,
  TrustfulValidatorAbi,
  USDCAbi,

  // Legacy aliases
  MockUsdcAbi,
  Erc8004RegistryAbi,
} from './contracts.js';

import {
  CHAIN_ID,
  RPC_URL,
  SAFE_TX_SERVICE_URL,
  SAFE_ADDRESS,
  SAFE_NETWORK_PREFIX,
  SAFE_APP_URL,
  DATABASE_NAME,
  DATABASE_PORT,
  COUNCIL_REGISTRY_ADDRESS,
} from './contracts.js';

// =============================================================================
// Chain & Public Client
// =============================================================================

export const chain: Chain = CHAIN_ID === 8453 ? base : baseSepolia;

export const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL),
});

// =============================================================================
// Database URL
// =============================================================================
// Constructed from generated config (database name) + secrets (.env.local)
// Priority: DATABASE_URL env var > constructed from parts

export const DATABASE_URL =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.DATABASE_USER || 'postgres'}:${process.env.DATABASE_PASSWORD || 'postgres'}@${process.env.DATABASE_HOST || 'localhost'}:${DATABASE_PORT}/${DATABASE_NAME}`;

// =============================================================================
// Runtime-only Config (from process.env / .env.local)
// =============================================================================

export const DOMAIN = process.env.DOMAIN || 'localhost';
export const PORT = parseInt(process.env.PORT || '3001');
export const NODE_ENV = process.env.NODE_ENV || 'development';

// Pinata (server-side only — never exposed to frontend)
export const PINATA_API_KEY = process.env.PINATA_API_KEY || '';
export const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY || '';

// AWS SES
export const AWS_REGION = process.env.AWS_REGION || 'eu-central-1';
export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || '';
export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';
export const SES_FROM_EMAIL = process.env.FROM_EMAIL || process.env.SES_FROM_EMAIL || 'noreply@trustful-agents.ai';

// JWT
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';

// CORS
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '';

// =============================================================================
// Safe Transaction Service Helpers
// =============================================================================
// These are derived from the generated config but provided as convenience
// functions since multiple routes build URLs from them.

export function getSafeMultisigTxUrl(safeAddress?: string): string {
  const addr = safeAddress || SAFE_ADDRESS;
  return `${SAFE_TX_SERVICE_URL}/api/v1/safes/${addr}/multisig-transactions/`;
}

export function getSafeQueueUrl(): string {
  return `${SAFE_APP_URL}/transactions/queue?safe=${SAFE_NETWORK_PREFIX}:${SAFE_ADDRESS}`;
}
