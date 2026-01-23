import { BigInt } from "@graphprotocol/graph-ts"
import {
  ClaimExecuted as RulingClaimExecuted,
  DepositDistributed,
  DepositReturned,
  CollateralUnlocked
} from "../../generated/RulingExecutor/RulingExecutor"
import { Claim, Agent, Council } from "../../generated/schema"
import { getOrCreateProtocolStats } from "./helpers"

// =============================================================================
// Ruling Execution Events
// =============================================================================

/**
 * Handle ClaimExecuted event from RulingExecutor
 * This is the final execution that transfers compensation
 */
export function handleRulingExecuted(event: RulingClaimExecuted): void {
  let claimId = event.params.claimId.toString()
  let compensationAmount = event.params.compensationAmount
  let councilFee = event.params.councilFee
  
  // Load claim
  let claim = Claim.load(claimId)
  if (claim == null) return
  
  // Update claim
  claim.status = "Executed"
  claim.executedAt = event.block.timestamp
  claim.save()
  
  // Update council stats with compensation paid
  let council = Council.load(claim.council)
  if (council != null) {
    council.totalCompensationPaid = council.totalCompensationPaid.plus(compensationAmount)
    council.updatedAt = event.block.timestamp
    council.save()
  }
  
  // Note: Agent stats (totalPaidOut) are updated by CollateralSlashed event
}

/**
 * Handle DepositDistributed event
 * Tracks when claimant deposits are distributed to council voters
 */
export function handleDepositDistributed(event: DepositDistributed): void {
  let claimId = event.params.claimId.toString()
  let totalAmount = event.params.totalAmount
  
  // Load claim to get council
  let claim = Claim.load(claimId)
  if (claim == null) return
  
  // Update council stats
  let council = Council.load(claim.council)
  if (council != null) {
    council.totalDepositsForfeited = council.totalDepositsForfeited.plus(totalAmount)
    council.updatedAt = event.block.timestamp
    council.save()
  }
  
  // Update protocol stats
  let stats = getOrCreateProtocolStats()
  stats.totalDepositsForfeited = stats.totalDepositsForfeited.plus(totalAmount)
  stats.updatedAt = event.block.timestamp
  stats.save()
}

/**
 * Handle DepositReturned event
 * When deposit is returned to claimant (e.g., expired with no votes)
 */
export function handleDepositReturned(event: DepositReturned): void {
  // This event doesn't change stats - deposit is returned, not forfeited
  // We could track this separately if needed
}

/**
 * Handle CollateralUnlocked event from RulingExecutor
 * This happens when claims are rejected/cancelled/expired
 */
export function handleCollateralUnlockedByExecutor(event: CollateralUnlocked): void {
  // Collateral unlocking is primarily tracked by CollateralVault events
  // This event from RulingExecutor is informational
  // The actual state changes happen in collateral-vault.ts handlers
}
