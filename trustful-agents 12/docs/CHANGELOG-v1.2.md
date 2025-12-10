# Trustful Agents v1.2 Changelog

## Release Date: 2025-12-09

This release incorporates architectural decisions made during user story validation to eliminate council bias, simplify on-chain storage, and add governance capabilities.

---

## Breaking Changes

### ITermsRegistry
- **REMOVED** `maxPayoutPerClaim` from `TermsVersion` struct
- **REMOVED** `maxPayoutPerClaim` parameter from `registerTerms()` and `updateTerms()`
- **REMOVED** `getMaxPayoutPerClaim()` function

**Migration:** `maxPayoutPerClaim` now lives in the T&C document (off-chain). Clients must fetch the document from `contentUri` and read the value from the JSON. Council members verify this value during claim evaluation.

### ITrustfulValidator
- **REMOVED** `maxPayoutPerClaim` from `getTrustInfo()` return values
- **CHANGED** `getTrustInfo()` now returns `TrustInfo` struct instead of tuple
- **REMOVED** `hasValidMaxPayout` from `ValidationConditions`
- **RENAMED** `hasTermsRegistered` → `hasActiveTerms` in `ValidationConditions`
- **ADDED** `councilIsActive` to `ValidationConditions`
- **CHANGED** `RevocationReason.MaxPayoutZero` → `RevocationReason.TermsInvalidated`

### IRulingExecutor
- **COMPLETE REWORK** of deposit distribution logic
- **REMOVED** `executeRuling()` and `executeRejection()` in favor of type-specific functions
- **ADDED** `executeApprovedClaim()`, `executeRejectedClaim()`, `executeCancelledClaim()`, `executeExpiredClaim()`

---

## New Features

### ICouncilRegistry
- **ADDED** `description` field to `Council` struct
- **ADDED** `closedAt` field to `Council` struct
- **ADDED** `closeCouncil(bytes32 councilId)` - Permanently close inactive councils
- **ADDED** `reassignAgentCouncil(uint256 agentId, bytes32 newCouncilId)` - Override agent's council
- **ADDED** `updateCouncilDescription(bytes32 councilId, string description)`
- **ADDED** `canCloseCouncil(bytes32 councilId)` - Check if closure is allowed
- **ADDED** `getAgentCountByCouncil(bytes32 councilId)`
- **ADDED** `getPendingClaimCountByCouncil(bytes32 councilId)`
- **ADDED** `getAgentCouncil(uint256 agentId)` - Get effective council (may be overridden)
- **ADDED** `isCouncilClosed(bytes32 councilId)`
- **ADDED** `getActiveCouncils()`
- **CHANGED** `createCouncil()` now requires `description` parameter

### IClaimsManager
- **ADDED** `Expired` to `ClaimStatus` enum
- **ADDED** `hadVotes` field to `Claim` struct
- **ADDED** `lastChangedAt` field to `VoteRecord` struct
- **ADDED** `expiredClaims` field to `ClaimStats` struct
- **ADDED** `changeVote(claimId, newVote, newApprovedAmount, newReasoning)` - Modify vote during voting period
- **ADDED** `getVotersForClaim(uint256 claimId)` - Get addresses of all voters
- **ADDED** `calculateMedianApprovedAmount(uint256 claimId)`
- **ADDED** `VoteChanged` event
- **ADDED** `ClaimExpired` event
- **CHANGED** `finalizeClaim()` replaces `closeVoting()` (handles all finalization cases)
- **CHANGED** `cancelClaim()` now forfeits deposit to voters (was: returned to claimant)

### IRulingExecutor
- **ADDED** `ExecutionResult` struct with deposit distribution details
- **ADDED** `DepositDistribution` struct
- **ADDED** `executeApprovedClaim(uint256 claimId)`
- **ADDED** `executeRejectedClaim(uint256 claimId)`
- **ADDED** `executeCancelledClaim(uint256 claimId)`
- **ADDED** `executeExpiredClaim(uint256 claimId)` - Special handling for no-votes case
- **ADDED** `executeClaim(uint256 claimId)` - Auto-routing convenience function
- **ADDED** `previewDepositDistribution(uint256 claimId)`
- **ADDED** `calculateEffectivePayout(uint256 claimId)`
- **ADDED** `getExecutableClaimsByCouncil(bytes32 councilId)`
- **ADDED** `willDepositBeReturned(uint256 claimId)`
- **ADDED** `DepositDistributed` and `DepositReturned` events

### ITrustfulValidator
- **ADDED** `TrustInfo` struct with `termsHash`, `termsUri`, `withdrawalPending`
- **ADDED** `councilIsActive` to `ValidationConditions`

---

## Architectural Decisions (v1.2)

### AD-06: Deposit Distribution to Voters Only
Claimant deposits are ALWAYS distributed to voting council members, regardless of outcome. This eliminates approval/rejection bias.

**Distribution Matrix:**
| Outcome | Deposit | Collateral |
|---------|---------|------------|
| Approved | → Voting members | → Claimant |
| Rejected | → Voting members | Unlocked |
| Cancelled | → Voting members | Unlocked |
| Expired (with votes) | → Voting members | Unlocked |
| Expired (no votes) | → Returned to claimant | Unlocked |

### AD-07: maxPayoutPerClaim Off-Chain
Liability cap stored in T&C document (IPFS), not on-chain. Council verifies from document during evaluation.

### AD-08: Governance via Multisig
All governance actions require multisig (e.g., Gnosis Safe) confirmation.

### AD-09: Vote Changes Overwrite
When council member changes vote, only final vote counts for median calculation.

### AD-10: Permissionless Claim Finalization
Anyone can call `finalizeClaim()` after voting deadline (enables automation via keepers).

---

## SDK Types Updates

- Updated all types to match interface changes
- Added `TermsDocument` interface for off-chain T&C schema
- Added `ExecutionResult` and `DepositDistribution` types
- Added `EvidencePackage` interface for off-chain evidence schema
- Removed `maxPayoutPerClaim` from on-chain types

---

## Migration Guide

### For Providers
1. Update T&C document to include `maxPayoutPerClaim` in JSON
2. Re-register terms (council parameter unchanged, maxPayout now in document)

### For Clients
1. Fetch T&C document from `termsUri` to read `maxPayoutPerClaim`
2. Use new `TrustInfo.termsUri` field from `getTrustInfo()`

### For Council Members
1. Verify `maxPayoutPerClaim` from T&C document during claim review
2. New ability to change votes during voting period via `changeVote()`

### For Governance
1. Set up multisig (Gnosis Safe) as governance address
2. New capabilities: `closeCouncil()`, `reassignAgentCouncil()`
