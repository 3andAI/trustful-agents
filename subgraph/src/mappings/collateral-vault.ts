import { BigInt, Bytes, Address } from "@graphprotocol/graph-ts"
import {
  Deposited,
  WithdrawalInitiated,
  WithdrawalCancelled,
  WithdrawalExecuted,
  CollateralLocked,
  CollateralUnlocked,
  CollateralSlashed
} from "../../generated/CollateralVault/CollateralVault"
import { Agent, Deposit, Withdrawal } from "../../generated/schema"
import { 
  getOrCreateAgent, 
  getOrCreateProtocolStats, 
  updateAvailableCollateral,
  ZERO_BI 
} from "./helpers"

// =============================================================================
// Deposit Events
// =============================================================================

/**
 * Handle Deposited event
 * Creates/updates Agent and creates Deposit entity
 */
export function handleDeposited(event: Deposited): void {
  let agent = getOrCreateAgent(event.params.agentId, event.block.timestamp)
  
  // Update agent collateral
  agent.collateralBalance = agent.collateralBalance.plus(event.params.amount)
  updateAvailableCollateral(agent)
  agent.updatedAt = event.block.timestamp
  agent.save()
  
  // Create Deposit entity
  let depositId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let deposit = new Deposit(depositId)
  deposit.agent = agent.id
  deposit.depositor = event.params.depositor
  deposit.amount = event.params.amount
  deposit.timestamp = event.block.timestamp
  deposit.transactionHash = event.transaction.hash
  deposit.save()
  
  // Update protocol stats
  let stats = getOrCreateProtocolStats()
  stats.totalCollateral = stats.totalCollateral.plus(event.params.amount)
  stats.updatedAt = event.block.timestamp
  stats.save()
}

// =============================================================================
// Withdrawal Events
// =============================================================================

/**
 * Handle WithdrawalInitiated event
 * Updates Agent withdrawal state
 */
export function handleWithdrawalInitiated(event: WithdrawalInitiated): void {
  let agent = Agent.load(event.params.agentId.toHexString())
  if (agent == null) return
  
  agent.withdrawalPending = true
  agent.withdrawalAmount = event.params.amount
  agent.withdrawalExecuteAfter = event.params.executeAfter
  agent.updatedAt = event.block.timestamp
  agent.save()
  
  // Create Withdrawal entity
  let withdrawalId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let withdrawal = new Withdrawal(withdrawalId)
  withdrawal.agent = agent.id
  withdrawal.recipient = Address.fromString("0x0000000000000000000000000000000000000000") // Will be set on execution
  withdrawal.amount = event.params.amount
  withdrawal.initiatedAt = event.block.timestamp
  withdrawal.executedAt = null
  withdrawal.cancelledAt = null
  withdrawal.transactionHash = event.transaction.hash
  withdrawal.save()
}

/**
 * Handle WithdrawalCancelled event
 * Clears Agent withdrawal state
 */
export function handleWithdrawalCancelled(event: WithdrawalCancelled): void {
  let agent = Agent.load(event.params.agentId.toHexString())
  if (agent == null) return
  
  agent.withdrawalPending = false
  agent.withdrawalAmount = null
  agent.withdrawalExecuteAfter = null
  agent.updatedAt = event.block.timestamp
  agent.save()
}

/**
 * Handle WithdrawalExecuted event
 * Completes withdrawal, updates Agent balance
 */
export function handleWithdrawalExecuted(event: WithdrawalExecuted): void {
  let agent = Agent.load(event.params.agentId.toHexString())
  if (agent == null) return
  
  // Update agent
  agent.collateralBalance = agent.collateralBalance.minus(event.params.amount)
  updateAvailableCollateral(agent)
  agent.withdrawalPending = false
  agent.withdrawalAmount = null
  agent.withdrawalExecuteAfter = null
  agent.updatedAt = event.block.timestamp
  agent.save()
  
  // Update protocol stats
  let stats = getOrCreateProtocolStats()
  stats.totalCollateral = stats.totalCollateral.minus(event.params.amount)
  stats.updatedAt = event.block.timestamp
  stats.save()
}

// =============================================================================
// Locking Events
// =============================================================================

/**
 * Handle CollateralLocked event
 * Increases locked collateral for an agent
 */
export function handleCollateralLocked(event: CollateralLocked): void {
  let agent = Agent.load(event.params.agentId.toHexString())
  if (agent == null) return
  
  agent.lockedCollateral = agent.lockedCollateral.plus(event.params.amount)
  updateAvailableCollateral(agent)
  agent.updatedAt = event.block.timestamp
  agent.save()
  
  // Update protocol stats
  let stats = getOrCreateProtocolStats()
  stats.lockedCollateral = stats.lockedCollateral.plus(event.params.amount)
  stats.updatedAt = event.block.timestamp
  stats.save()
}

/**
 * Handle CollateralUnlocked event
 * Decreases locked collateral for an agent
 */
export function handleCollateralUnlocked(event: CollateralUnlocked): void {
  let agent = Agent.load(event.params.agentId.toHexString())
  if (agent == null) return
  
  agent.lockedCollateral = agent.lockedCollateral.minus(event.params.amount)
  updateAvailableCollateral(agent)
  agent.updatedAt = event.block.timestamp
  agent.save()
  
  // Update protocol stats
  let stats = getOrCreateProtocolStats()
  stats.lockedCollateral = stats.lockedCollateral.minus(event.params.amount)
  stats.updatedAt = event.block.timestamp
  stats.save()
}

/**
 * Handle CollateralSlashed event
 * Reduces both locked and total collateral, transfers to claimant
 */
export function handleCollateralSlashed(event: CollateralSlashed): void {
  let agent = Agent.load(event.params.agentId.toHexString())
  if (agent == null) return
  
  // Reduce both locked and total balance
  agent.lockedCollateral = agent.lockedCollateral.minus(event.params.amount)
  agent.collateralBalance = agent.collateralBalance.minus(event.params.amount)
  updateAvailableCollateral(agent)
  agent.totalPaidOut = agent.totalPaidOut.plus(event.params.amount)
  agent.updatedAt = event.block.timestamp
  agent.save()
  
  // Update protocol stats
  let stats = getOrCreateProtocolStats()
  stats.lockedCollateral = stats.lockedCollateral.minus(event.params.amount)
  stats.totalCollateral = stats.totalCollateral.minus(event.params.amount)
  stats.totalCompensationPaid = stats.totalCompensationPaid.plus(event.params.amount)
  stats.updatedAt = event.block.timestamp
  stats.save()
}
