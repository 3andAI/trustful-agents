import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  CouncilCreated,
  CouncilClosed,
  CouncilUpdated,
  CouncilDeactivated,
  CouncilActivated,
  MemberAdded,
  MemberRemoved
} from "../../generated/CouncilRegistry/CouncilRegistry"
import { Council, CouncilMember } from "../../generated/schema"
import { getOrCreateCouncil, getOrCreateProtocolStats, ZERO_BI } from "./helpers"

// =============================================================================
// Council Events
// =============================================================================

/**
 * Handle CouncilCreated event
 * Creates a new Council entity
 */
export function handleCouncilCreated(event: CouncilCreated): void {
  let council = getOrCreateCouncil(event.params.councilId, event.block.timestamp)
  
  council.name = event.params.name
  council.vertical = event.params.vertical
  council.quorumPercentage = event.params.quorumPercentage.toI32()
  council.claimDepositPercentage = event.params.claimDepositPercentage.toI32()
  council.isActive = true
  council.createdAt = event.block.timestamp
  council.updatedAt = event.block.timestamp
  council.save()
  
  // Update protocol stats
  let stats = getOrCreateProtocolStats()
  stats.totalCouncils = stats.totalCouncils + 1
  stats.activeCouncils = stats.activeCouncils + 1
  stats.updatedAt = event.block.timestamp
  stats.save()
}

/**
 * Handle CouncilClosed event
 * Permanently closes a council
 */
export function handleCouncilClosed(event: CouncilClosed): void {
  let council = Council.load(event.params.councilId.toHexString())
  if (council == null) return
  
  council.isActive = false
  council.updatedAt = event.block.timestamp
  council.save()
  
  // Update protocol stats
  let stats = getOrCreateProtocolStats()
  stats.activeCouncils = stats.activeCouncils - 1
  stats.updatedAt = event.block.timestamp
  stats.save()
}

/**
 * Handle CouncilUpdated event
 * Note: This event only signals an update occurred
 * Full details would need to be fetched from contract (not implemented here)
 */
export function handleCouncilUpdated(event: CouncilUpdated): void {
  let council = Council.load(event.params.councilId.toHexString())
  if (council == null) return
  
  council.updatedAt = event.block.timestamp
  council.save()
}

/**
 * Handle CouncilDeactivated event
 * Temporarily deactivates a council (can be reactivated)
 */
export function handleCouncilDeactivated(event: CouncilDeactivated): void {
  let council = Council.load(event.params.councilId.toHexString())
  if (council == null) return
  
  council.isActive = false
  council.updatedAt = event.block.timestamp
  council.save()
  
  // Update protocol stats
  let stats = getOrCreateProtocolStats()
  stats.activeCouncils = stats.activeCouncils - 1
  stats.updatedAt = event.block.timestamp
  stats.save()
}

/**
 * Handle CouncilActivated event
 * Reactivates a deactivated council
 */
export function handleCouncilActivated(event: CouncilActivated): void {
  let council = Council.load(event.params.councilId.toHexString())
  if (council == null) return
  
  council.isActive = true
  council.updatedAt = event.block.timestamp
  council.save()
  
  // Update protocol stats
  let stats = getOrCreateProtocolStats()
  stats.activeCouncils = stats.activeCouncils + 1
  stats.updatedAt = event.block.timestamp
  stats.save()
}

// =============================================================================
// Member Events
// =============================================================================

/**
 * Handle MemberAdded event
 * Adds a new member to a council
 */
export function handleMemberAdded(event: MemberAdded): void {
  let councilId = event.params.councilId.toHexString()
  let memberAddress = event.params.member
  
  // Create CouncilMember entity
  let memberId = councilId + "-" + memberAddress.toHexString()
  let member = new CouncilMember(memberId)
  member.council = councilId
  member.member = memberAddress
  member.isActive = true
  member.joinedAt = event.block.timestamp
  member.leftAt = null
  member.claimsVoted = 0
  member.approveVotes = 0
  member.rejectVotes = 0
  member.abstainVotes = 0
  member.save()
  
  // Update council member count
  let council = Council.load(councilId)
  if (council != null) {
    council.memberCount = council.memberCount + 1
    council.updatedAt = event.block.timestamp
    council.save()
  }
  
  // Update protocol stats
  let stats = getOrCreateProtocolStats()
  stats.totalCouncilMembers = stats.totalCouncilMembers + 1
  stats.updatedAt = event.block.timestamp
  stats.save()
}

/**
 * Handle MemberRemoved event
 * Removes a member from a council
 */
export function handleMemberRemoved(event: MemberRemoved): void {
  let councilId = event.params.councilId.toHexString()
  let memberAddress = event.params.member
  
  // Update CouncilMember entity
  let memberId = councilId + "-" + memberAddress.toHexString()
  let member = CouncilMember.load(memberId)
  if (member != null) {
    member.isActive = false
    member.leftAt = event.block.timestamp
    member.save()
  }
  
  // Update council member count
  let council = Council.load(councilId)
  if (council != null) {
    council.memberCount = council.memberCount - 1
    council.updatedAt = event.block.timestamp
    council.save()
  }
  
  // Update protocol stats
  let stats = getOrCreateProtocolStats()
  stats.totalCouncilMembers = stats.totalCouncilMembers - 1
  stats.updatedAt = event.block.timestamp
  stats.save()
}
