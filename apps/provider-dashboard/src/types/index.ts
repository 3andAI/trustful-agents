/**
 * Provider Dashboard Types
 */

import type { Address } from 'viem'

// Agent types
export interface Agent {
  id: bigint
  owner: Address
}

export interface AgentWithDetails extends Agent {
  collateral?: {
    balance: bigint
    lockedAmount: bigint
    withdrawalPending: boolean
    withdrawalAmount?: bigint
    withdrawalInitiatedAt?: bigint
  }
  terms?: {
    contentHash: `0x${string}`
    contentUri: string
    councilId: `0x${string}`
    registeredAt: bigint
    version: bigint
  }
  validation?: {
    isValid: boolean
    issuedAt?: bigint
    revokedAt?: bigint
    revocationReason?: number
  }
  claims?: {
    total: number
    pending: number
    approved: number
  }
}

// Collateral account from contract
export interface CollateralAccount {
  balance: bigint
  lockedAmount: bigint
  withdrawalInitiatedAt: bigint
  withdrawalAmount: bigint
}

// Validation conditions from contract
export interface ValidationConditions {
  hasMinimumCollateral: boolean
  hasActiveTerms: boolean
  isOwnerValid: boolean
  councilIsActive: boolean
}

// Validation record from contract
export interface ValidationRecord {
  requestHash: `0x${string}`
  issuedAt: bigint
  revokedAt: bigint
  nonce: bigint
  revocationReason: number
}

// Council from contract
export interface Council {
  councilId: `0x${string}`
  name: string
  description: string
  vertical: string
  memberCount: bigint
  quorumPercentage: bigint
  claimDepositPercentage: bigint
  votingPeriod: bigint
  evidencePeriod: bigint
  active: boolean
  createdAt: bigint
  closedAt: bigint
}

// Terms from contract
export interface Terms {
  contentHash: `0x${string}`
  contentUri: string
  councilId: `0x${string}`
  registeredAt: bigint
  active: boolean
}

// Navigation
export interface NavItem {
  path: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
  exact?: boolean
}

// Trustful Extension for A2A Agent Card
export interface TrustfulExtension {
  version: string
  validatorAddress: Address
  collateral: {
    amount: string
    asset: string
    withdrawalPending: boolean
  }
  terms: {
    hash: `0x${string}`
    uri: string
    councilId: `0x${string}`
  }
  validation: {
    status: 'valid' | 'invalid' | 'revoked'
    issuedAt?: string
  }
  claims?: {
    total: number
    approved: number
    pending: number
  }
}
