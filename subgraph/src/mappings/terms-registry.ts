import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  TermsRegistered,
  TermsActivated,
  TermsDeactivated
} from "../../generated/TermsRegistry/TermsRegistry"
import { Agent, TermsVersion } from "../../generated/schema"
import { getOrCreateAgent, ZERO_BI } from "./helpers"

// =============================================================================
// Terms Events
// =============================================================================

/**
 * Handle TermsRegistered event
 * Creates a new TermsVersion and updates Agent
 */
export function handleTermsRegistered(event: TermsRegistered): void {
  let agentId = event.params.agentId
  let version = event.params.version.toI32()
  
  // Get or create agent
  let agent = getOrCreateAgent(agentId, event.block.timestamp)
  
  // Create TermsVersion entity
  let termsId = agentId.toHexString() + "-" + version.toString()
  let terms = new TermsVersion(termsId)
  terms.agent = agent.id
  terms.version = version
  terms.contentHash = event.params.contentHash
  terms.contentUri = event.params.contentUri
  terms.maxPayoutPerClaim = ZERO_BI // Now stored off-chain in T&C document
  terms.councilId = event.params.councilId
  terms.isActive = true // Will be marked active by subsequent TermsActivated event
  terms.registeredAt = event.block.timestamp
  terms.deactivatedAt = null
  terms.save()
  
  // Update agent with active terms info
  agent.activeTermsVersion = version
  agent.activeTermsHash = event.params.contentHash
  agent.activeTermsUri = event.params.contentUri
  agent.councilId = event.params.councilId
  agent.updatedAt = event.block.timestamp
  agent.save()
}

/**
 * Handle TermsActivated event
 * Marks a terms version as active
 */
export function handleTermsActivated(event: TermsActivated): void {
  let agentId = event.params.agentId
  let version = event.params.version.toI32()
  
  // Update TermsVersion
  let termsId = agentId.toHexString() + "-" + version.toString()
  let terms = TermsVersion.load(termsId)
  if (terms != null) {
    terms.isActive = true
    terms.save()
  }
  
  // Update Agent
  let agent = Agent.load(agentId.toHexString())
  if (agent != null) {
    agent.activeTermsVersion = version
    if (terms != null) {
      agent.activeTermsHash = terms.contentHash
      agent.activeTermsUri = terms.contentUri
      agent.councilId = terms.councilId
    }
    agent.updatedAt = event.block.timestamp
    agent.save()
  }
}

/**
 * Handle TermsDeactivated event
 * Marks a terms version as inactive
 */
export function handleTermsDeactivated(event: TermsDeactivated): void {
  let agentId = event.params.agentId
  let version = event.params.version.toI32()
  
  // Update TermsVersion
  let termsId = agentId.toHexString() + "-" + version.toString()
  let terms = TermsVersion.load(termsId)
  if (terms != null) {
    terms.isActive = false
    terms.deactivatedAt = event.block.timestamp
    terms.save()
  }
  
  // Update Agent if this was the active version
  let agent = Agent.load(agentId.toHexString())
  if (agent != null && agent.activeTermsVersion == version) {
    agent.activeTermsVersion = 0
    agent.activeTermsHash = null
    agent.activeTermsUri = null
    // Note: councilId is NOT cleared - it's still associated via last known terms
    agent.updatedAt = event.block.timestamp
    agent.save()
  }
}
