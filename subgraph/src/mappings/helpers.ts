import { BigInt, Bytes, Address } from "@graphprotocol/graph-ts"
import { Agent, Council, ProtocolStats } from "../../generated/schema"

// =============================================================================
// Constants
// =============================================================================

export const PROTOCOL_STATS_ID = "global"
export const ZERO_BI = BigInt.fromI32(0)
export const ONE_BI = BigInt.fromI32(1)
export const ZERO_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000000")
export const ZERO_BYTES32 = Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000") as Bytes

// =============================================================================
// Agent Helpers
// =============================================================================

/**
 * Get or create an Agent entity
 * Agent ID is the hex representation of the ERC-8004 token ID
 */
export function getOrCreateAgent(agentId: BigInt, timestamp: BigInt): Agent {
  let id = agentId.toHexString()
  let agent = Agent.load(id)
  
  if (agent == null) {
    agent = new Agent(id)
    agent.owner = ZERO_ADDRESS
    agent.collateralBalance = ZERO_BI
    agent.lockedCollateral = ZERO_BI
    agent.availableCollateral = ZERO_BI
    agent.withdrawalPending = false
    agent.withdrawalAmount = null
    agent.withdrawalExecuteAfter = null
    agent.activeTermsVersion = 0
    agent.activeTermsHash = null
    agent.activeTermsUri = null
    agent.maxPayoutPerClaim = null
    agent.councilId = null
    agent.isValidated = false
    agent.validationRequestHash = null
    agent.validationIssuedAt = null
    agent.validationRevokedAt = null
    agent.revocationReason = null
    agent.totalClaims = 0
    agent.approvedClaims = 0
    agent.rejectedClaims = 0
    agent.pendingClaims = 0
    agent.totalPaidOut = ZERO_BI
    agent.createdAt = timestamp
    agent.updatedAt = timestamp
    
    // Update protocol stats
    let stats = getOrCreateProtocolStats()
    stats.totalAgents = stats.totalAgents + 1
    stats.updatedAt = timestamp
    stats.save()
  }
  
  return agent
}

/**
 * Update available collateral (balance - locked)
 */
export function updateAvailableCollateral(agent: Agent): void {
  if (agent.collateralBalance > agent.lockedCollateral) {
    agent.availableCollateral = agent.collateralBalance.minus(agent.lockedCollateral)
  } else {
    agent.availableCollateral = ZERO_BI
  }
}

// =============================================================================
// Council Helpers
// =============================================================================

/**
 * Get or create a Council entity
 * Council ID is the bytes32 hex string
 */
export function getOrCreateCouncil(councilId: Bytes, timestamp: BigInt): Council {
  let id = councilId.toHexString()
  let council = Council.load(id)
  
  if (council == null) {
    council = new Council(id)
    council.name = ""
    council.vertical = ""
    council.memberCount = 0
    council.quorumPercentage = 0
    council.claimDepositPercentage = 0
    council.votingPeriod = ZERO_BI
    council.evidencePeriod = ZERO_BI
    council.isActive = true
    council.totalClaims = 0
    council.approvedClaims = 0
    council.rejectedClaims = 0
    council.totalCompensationPaid = ZERO_BI
    council.totalDepositsForfeited = ZERO_BI
    council.createdAt = timestamp
    council.updatedAt = timestamp
  }
  
  return council
}

// =============================================================================
// Protocol Stats Helpers
// =============================================================================

/**
 * Get or create the singleton ProtocolStats entity
 */
export function getOrCreateProtocolStats(): ProtocolStats {
  let stats = ProtocolStats.load(PROTOCOL_STATS_ID)
  
  if (stats == null) {
    stats = new ProtocolStats(PROTOCOL_STATS_ID)
    stats.totalAgents = 0
    stats.validatedAgents = 0
    stats.totalCollateral = ZERO_BI
    stats.lockedCollateral = ZERO_BI
    stats.totalCouncils = 0
    stats.activeCouncils = 0
    stats.totalCouncilMembers = 0
    stats.totalClaims = 0
    stats.pendingClaims = 0
    stats.approvedClaims = 0
    stats.rejectedClaims = 0
    stats.totalCompensationPaid = ZERO_BI
    stats.totalDepositsForfeited = ZERO_BI
    stats.updatedAt = ZERO_BI
    stats.save()
  }
  
  return stats
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert vote enum to string
 * 0 = None, 1 = Approve, 2 = Reject, 3 = Abstain
 */
export function voteTypeToString(voteType: i32): string {
  if (voteType == 1) return "Approve"
  if (voteType == 2) return "Reject"
  if (voteType == 3) return "Abstain"
  return "None"
}

/**
 * Convert revocation reason enum to string
 */
export function revocationReasonToString(reason: i32): string {
  if (reason == 0) return "None"
  if (reason == 1) return "CollateralBelowMinimum"
  if (reason == 2) return "TermsNotRegistered"
  if (reason == 3) return "TermsInvalidated"
  if (reason == 4) return "OwnershipChanged"
  if (reason == 5) return "ManualRevocation"
  if (reason == 6) return "EmergencyPause"
  return "Unknown"
}

/**
 * Convert claim status enum to string
 */
export function claimStatusToString(status: i32): string {
  if (status == 0) return "Filed"
  if (status == 1) return "EvidenceClosed"
  if (status == 2) return "VotingClosed"
  if (status == 3) return "Approved"
  if (status == 4) return "Rejected"
  if (status == 5) return "Executed"
  if (status == 6) return "Cancelled"
  if (status == 7) return "Expired"
  return "Unknown"
}
