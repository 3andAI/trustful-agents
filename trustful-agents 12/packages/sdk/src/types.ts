import { type Address } from "viem";

/**
 * Trustful Agents SDK Types
 * v1.2 - Updated to match smart contract interface changes
 * 
 * v1.2 Changes:
 * - Removed maxPayoutPerClaim from on-chain types (now in T&C document)
 * - Added Expired status for claims
 * - Added council description and closedAt
 * - Added vote change tracking
 * - Updated TrustInfo structure
 */

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

/**
 * On-chain terms version
 * Note: maxPayoutPerClaim is now stored off-chain in the T&C document
 * Fetch the document from contentUri to get maxPayoutPerClaim
 */
export interface TermsVersion {
  contentHash: `0x${string}`;
  contentUri: string;
  // maxPayoutPerClaim removed in v1.2 - read from T&C document
  councilId: `0x${string}`;
  registeredAt: bigint;
  active: boolean;
}

export interface TermsConfig {
  activeVersion: bigint;
  versionCount: bigint;
}

/**
 * Off-chain T&C document structure (IPFS/URI)
 * This is the JSON schema for the document at contentUri
 */
export interface TermsDocument {
  version: string;
  agentId: string;
  provider: {
    name: string;
    address: Address;
  };
  terms: {
    serviceDescription: string;
    limitations: string[];
    maxPayoutPerClaim: string; // USDC amount as string (6 decimals)
    coveredDamages: string[];
    excludedDamages: string[];
  };
  legal?: {
    jurisdiction?: string;
    governingLaw?: string;
  };
  signature?: {
    hash: `0x${string}`;
    timestamp: string;
  };
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
  TermsInvalidated = 3, // [v1.2] Renamed from MaxPayoutZero
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
  hasActiveTerms: boolean; // [v1.2] Renamed from hasTermsRegistered
  // hasValidMaxPayout removed in v1.2
  isOwnerValid: boolean;
  councilIsActive: boolean; // [v1.2] Added
}

/**
 * Trust info returned by validator
 * Note: maxPayoutPerClaim removed - fetch from termsUri document
 */
export interface TrustInfo {
  collateralAmount: bigint;
  termsHash: `0x${string}`; // [v1.2] Added
  termsUri: string; // [v1.2] Added - fetch T&C document to get maxPayoutPerClaim
  // maxPayoutPerClaim removed in v1.2
  councilId: `0x${string}`;
  isValid: boolean;
  withdrawalPending: boolean; // [v1.2] Added - risk signal for clients
}

// =============================================================================
// Council
// =============================================================================

export interface Council {
  councilId: `0x${string}`;
  name: string;
  description: string; // [v1.2] Added
  vertical: string;
  memberCount: bigint;
  quorumPercentage: bigint;
  claimDepositPercentage: bigint;
  votingPeriod: bigint;
  evidencePeriod: bigint;
  active: boolean;
  createdAt: bigint;
  closedAt: bigint; // [v1.2] Added (0 = not closed)
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
  Expired = 7, // [v1.2] Added
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
  hadVotes: boolean; // [v1.2] Added - true if at least one vote was cast
}

export interface VoteRecord {
  voter: Address;
  vote: Vote;
  approvedAmount: bigint;
  reasoning: string;
  votedAt: bigint;
  lastChangedAt: bigint; // [v1.2] Added - timestamp of last vote change (0 if never changed)
}

export interface ClaimStats {
  totalClaims: bigint;
  approvedClaims: bigint;
  rejectedClaims: bigint;
  pendingClaims: bigint;
  expiredClaims: bigint; // [v1.2] Added
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

// =============================================================================
// Ruling Executor [v1.2]
// =============================================================================

export interface ExecutionResult {
  claimId: bigint;
  agentId: bigint;
  claimant: Address;
  approvedAmount: bigint;
  effectivePayout: bigint;
  councilFee: bigint;
  claimantReceives: bigint;
  depositAmount: bigint;
  voterCount: bigint;
  depositPerVoter: bigint;
  executedAt: bigint;
}

export interface DepositDistribution {
  recipients: Address[];
  amountPerRecipient: bigint;
  remainder: bigint;
  totalDistributed: bigint;
}

// =============================================================================
// Evidence Package (Off-chain)
// =============================================================================

export interface EvidencePackage {
  claimId?: string;
  paymentProof: {
    type: "x402" | "crypto" | "fiat" | "other";
    x402Receipt?: string;
    transactionHash?: `0x${string}`;
    amount: string;
    timestamp: string;
  };
  termsSnapshot: {
    hash: `0x${string}`;
    uri: string;
    maxPayoutPerClaim: string;
  };
  incident: {
    description: string;
    timestamp: string;
    logs?: string[];
  };
  damages: {
    description: string;
    amount: string;
    evidence: string[];
  };
}
