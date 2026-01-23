import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  ValidationIssued,
  ValidationRevoked
} from "../../generated/TrustfulValidator/TrustfulValidator"
import { Agent, ValidationEvent } from "../../generated/schema"
import { 
  getOrCreateAgent, 
  getOrCreateProtocolStats, 
  revocationReasonToString 
} from "./helpers"

// =============================================================================
// Validation Events
// =============================================================================

/**
 * Handle ValidationIssued event
 * Marks an agent as validated
 */
export function handleValidationIssued(event: ValidationIssued): void {
  let agentId = event.params.agentId
  
  // Get or create agent
  let agent = getOrCreateAgent(agentId, event.block.timestamp)
  
  // Update validation status
  agent.isValidated = true
  agent.validationRequestHash = event.params.requestHash
  agent.validationIssuedAt = event.block.timestamp
  agent.validationRevokedAt = null
  agent.revocationReason = null
  agent.updatedAt = event.block.timestamp
  agent.save()
  
  // Create ValidationEvent
  let eventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let validationEvent = new ValidationEvent(eventId)
  validationEvent.agent = agent.id
  validationEvent.eventType = "Issued"
  validationEvent.requestHash = event.params.requestHash
  validationEvent.reason = null
  validationEvent.timestamp = event.block.timestamp
  validationEvent.transactionHash = event.transaction.hash
  validationEvent.save()
  
  // Update protocol stats
  let stats = getOrCreateProtocolStats()
  stats.validatedAgents = stats.validatedAgents + 1
  stats.updatedAt = event.block.timestamp
  stats.save()
}

/**
 * Handle ValidationRevoked event
 * Marks an agent as no longer validated
 */
export function handleValidationRevoked(event: ValidationRevoked): void {
  let agentId = event.params.agentId
  let reason = event.params.reason
  
  // Get agent
  let agent = Agent.load(agentId.toHexString())
  if (agent == null) return
  
  // Update validation status
  agent.isValidated = false
  agent.validationRevokedAt = event.block.timestamp
  agent.revocationReason = revocationReasonToString(reason)
  agent.updatedAt = event.block.timestamp
  agent.save()
  
  // Create ValidationEvent
  let eventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let validationEvent = new ValidationEvent(eventId)
  validationEvent.agent = agent.id
  validationEvent.eventType = "Revoked"
  validationEvent.requestHash = event.params.requestHash
  validationEvent.reason = revocationReasonToString(reason)
  validationEvent.timestamp = event.block.timestamp
  validationEvent.transactionHash = event.transaction.hash
  validationEvent.save()
  
  // Update protocol stats
  let stats = getOrCreateProtocolStats()
  stats.validatedAgents = stats.validatedAgents - 1
  stats.updatedAt = event.block.timestamp
  stats.save()
}
