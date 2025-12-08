import { type Address } from "viem";

// =============================================================================
// Collateral Vault
// =============================================================================

export interface CollateralAccount {
  balance: bigint;
  lockedAmount: bigint;
  withdrawalInitiatedAt: bigint;
  withdrawalAmount: bigint;
}

// =============================================================================
// Terms Registry
// =============================================================================

export interface TermsVersion {
  contentHash: `0x${string}`;
  contentUri: string;
  maxPayoutPerClaim: bigint;
  councilId: `0x${string}`;
  registeredAt: bigint;
  active: boolean;
}

export interface TermsConfig {
  activeVersion: bigint;
  versionCount: bigint;
}

// =============================================================================
// Validator
// =============================================================================

export enum ValidationStatus {
  NotValidated = 0,
  Valid = 1,
  Revoked = 2,
  ConditionsNotMet = 3,
}

export enum RevocationReason {
  None = 0,
  CollateralBelowMinimum = 1,
  TermsNotRegistered = 2,
  MaxPayoutZero = 3,
  OwnershipChanged = 4,
  ManualRevocation = 5,
  EmergencyPause = 6,
}

export interface ValidationRecord {
  requestHash: `0x${string}`;
  issuedAt: bigint;
  revokedAt: bigint;
  nonce: bigint;
  revocationReason: RevocationReason;
}

export interface ValidationConditions {
  hasMinimumCollateral: boolean;
  hasTermsRegistered: boolean;
  hasValidMaxPayout: boolean;
  isOwnerValid: boolean;
}

export interface TrustInfo {
  collateralAmount: bigint;
  maxPayoutPerClaim: bigint;
  councilId: `0x${string}`;
  isValid: boolean;
}

// =============================================================================
// Council
// =============================================================================

export interface Council {
  councilId: `0x${string}`;
  name: string;
  vertical: string;
  memberCount: bigint;
  quorumPercentage: bigint;
  claimDepositPercentage: bigint;
  votingPeriod: bigint;
  evidencePeriod: bigint;
  active: boolean;
  createdAt: bigint;
}

export interface CouncilMember {
  member: Address;
  councilId: `0x${string}`;
  joinedAt: bigint;
  claimsVoted: bigint;
  active: boolean;
}

// =============================================================================
// Claims
// =============================================================================

export enum ClaimStatus {
  Filed = 0,
  EvidenceClosed = 1,
  VotingClosed = 2,
  Approved = 3,
  Rejected = 4,
  Executed = 5,
  Cancelled = 6,
}

export enum Vote {
  None = 0,
  Approve = 1,
  Reject = 2,
  Abstain = 3,
}

export interface Claim {
  claimId: bigint;
  agentId: bigint;
  claimant: Address;
  claimedAmount: bigint;
  approvedAmount: bigint;
  evidenceHash: `0x${string}`;
  evidenceUri: string;
  paymentReceiptHash: `0x${string}`;
  termsHashAtClaimTime: `0x${string}`;
  termsVersionAtClaimTime: bigint;
  providerAtClaimTime: Address;
  councilId: `0x${string}`;
  claimantDeposit: bigint;
  lockedCollateral: bigint;
  status: ClaimStatus;
  filedAt: bigint;
  evidenceDeadline: bigint;
  votingDeadline: bigint;
}

export interface VoteRecord {
  voter: Address;
  vote: Vote;
  approvedAmount: bigint;
  reasoning: string;
  votedAt: bigint;
}

export interface ClaimStats {
  totalClaims: bigint;
  approvedClaims: bigint;
  rejectedClaims: bigint;
  pendingClaims: bigint;
  totalPaidOut: bigint;
}

export interface VotingProgress {
  approveVotes: bigint;
  rejectVotes: bigint;
  abstainVotes: bigint;
  totalVotes: bigint;
  requiredQuorum: bigint;
  deadline: bigint;
  quorumReached: boolean;
}
