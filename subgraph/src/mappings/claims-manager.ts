import { BigInt, Bytes, Address } from "@graphprotocol/graph-ts"
import {
  ClaimFiled,
  EvidenceSubmitted,
  VoteCast,
  VoteChanged,
  ClaimApproved,
  ClaimRejected,
  ClaimCancelled,
  ClaimExpired,
  ClaimExecuted
} from "../../generated/ClaimsManager/ClaimsManager"
import { Agent, Claim, Evidence, Vote, Council, CouncilMember } from "../../generated/schema"
import { 
  getOrCreateAgent, 
  getOrCreateCouncil,
  getOrCreateProtocolStats,
  voteTypeToString,
  ZERO_BI,
  ZERO_ADDRESS,
  ZERO_BYTES32
} from "./helpers"

// =============================================================================
// Claim Filing
// =============================================================================

/**
 * Handle ClaimFiled event
 * Creates a new Claim entity
 */
export function handleClaimFiled(event: ClaimFiled): void {
  let claimId = event.params.claimId.toString()
  let agentId = event.params.agentId
  let councilId = event.params.councilId
  
  // Get or create agent
  let agent = getOrCreateAgent(agentId, event.block.timestamp)
  
  // Get or create council
  let council = getOrCreateCouncil(councilId, event.block.timestamp)
  
  // Create Claim entity
  let claim = new Claim(claimId)
  claim.agent = agent.id
  claim.council = council.id
  claim.claimant = event.params.claimant
  claim.claimedAmount = event.params.claimedAmount
  claim.approvedAmount = null
  claim.evidenceHash = ZERO_BYTES32 // Will be set via EvidenceSubmitted
  claim.evidenceUri = ""
  claim.paymentReceiptHash = ZERO_BYTES32
  
  // Safely handle nullable fields
  let termsHash = agent.activeTermsHash
  claim.termsHashAtClaimTime = termsHash !== null ? termsHash : ZERO_BYTES32
  
  let termsVersion = agent.activeTermsVersion
  claim.termsVersionAtClaimTime = termsVersion !== null ? termsVersion : 0
  claim.providerAtClaimTime = agent.owner
  claim.claimantDeposit = event.params.claimantDeposit
  claim.lockedCollateral = ZERO_BI // Will be updated by CollateralLocked event
  claim.status = "Filed"
  claim.filedAt = event.block.timestamp
  claim.evidenceDeadline = ZERO_BI // Would need to be fetched from contract
  claim.votingDeadline = ZERO_BI
  claim.closedAt = null
  claim.executedAt = null
  claim.approveVotes = 0
  claim.rejectVotes = 0
  claim.abstainVotes = 0
  claim.totalVotes = 0
  claim.save()
  
  // Update agent stats
  agent.totalClaims = agent.totalClaims + 1
  agent.pendingClaims = agent.pendingClaims + 1
  agent.updatedAt = event.block.timestamp
  agent.save()
  
  // Update council stats
  council.totalClaims = council.totalClaims + 1
  council.updatedAt = event.block.timestamp
  council.save()
  
  // Update protocol stats
  let stats = getOrCreateProtocolStats()
  stats.totalClaims = stats.totalClaims + 1
  stats.pendingClaims = stats.pendingClaims + 1
  stats.updatedAt = event.block.timestamp
  stats.save()
}

// =============================================================================
// Evidence
// =============================================================================

/**
 * Handle EvidenceSubmitted event
 * Creates Evidence entity and optionally updates Claim
 */
export function handleEvidenceSubmitted(event: EvidenceSubmitted): void {
  let claimId = event.params.claimId.toString()
  
  // Load claim
  let claim = Claim.load(claimId)
  if (claim == null) return
  
  // Count existing evidence for this claim to generate index
  // Note: This is a simplified approach; in production you might track this differently
  let evidenceIndex = claim.totalVotes // Using totalVotes as a proxy; not ideal but works
  
  // Create Evidence entity
  let evidenceId = claimId + "-" + event.logIndex.toString()
  let evidence = new Evidence(evidenceId)
  evidence.claim = claimId
  evidence.submitter = event.transaction.from
  evidence.isCounterEvidence = event.params.isCounterEvidence
  evidence.evidenceHash = event.params.evidenceHash
  evidence.evidenceUri = event.params.evidenceUri
  evidence.submittedAt = event.block.timestamp
  evidence.save()
  
  // Update claim with initial evidence if not counter-evidence
  if (!event.params.isCounterEvidence && claim.evidenceUri == "") {
    claim.evidenceHash = event.params.evidenceHash
    claim.evidenceUri = event.params.evidenceUri
    claim.save()
  }
}

// =============================================================================
// Voting
// =============================================================================

/**
 * Handle VoteCast event
 * Creates Vote entity and updates Claim vote counts
 */
export function handleVoteCast(event: VoteCast): void {
  let claimId = event.params.claimId.toString()
  let voterAddress = event.params.voter
  let voteType = event.params.vote
  let approvedAmount = event.params.approvedAmount
  
  // Load claim
  let claim = Claim.load(claimId)
  if (claim == null) return
  
  // Create Vote entity
  let voteId = claimId + "-" + voterAddress.toHexString()
  let vote = new Vote(voteId)
  vote.claim = claimId
  
  // Find the CouncilMember
  let councilId = claim.council
  let memberId = councilId + "-" + voterAddress.toHexString()
  let member = CouncilMember.load(memberId)
  if (member != null) {
    vote.voter = member.id
    
    // Update member stats
    member.claimsVoted = member.claimsVoted + 1
    if (voteType == 1) member.approveVotes = member.approveVotes + 1
    else if (voteType == 2) member.rejectVotes = member.rejectVotes + 1
    else if (voteType == 3) member.abstainVotes = member.abstainVotes + 1
    member.save()
  } else {
    // Create a placeholder voter ID if member not found
    vote.voter = memberId
  }
  
  vote.vote = voteTypeToString(voteType)
  vote.approvedAmount = voteType == 1 ? approvedAmount : null
  vote.reasoning = null
  vote.votedAt = event.block.timestamp
  vote.save()
  
  // Update claim vote counts
  claim.totalVotes = claim.totalVotes + 1
  if (voteType == 1) claim.approveVotes = claim.approveVotes + 1
  else if (voteType == 2) claim.rejectVotes = claim.rejectVotes + 1
  else if (voteType == 3) claim.abstainVotes = claim.abstainVotes + 1
  claim.save()
}

/**
 * Handle VoteChanged event
 * Updates existing Vote entity and adjusts Claim vote counts
 */
export function handleVoteChanged(event: VoteChanged): void {
  let claimId = event.params.claimId.toString()
  let voterAddress = event.params.voter
  let oldVoteType = event.params.oldVote
  let newVoteType = event.params.newVote
  let newApprovedAmount = event.params.newApprovedAmount
  
  // Load claim
  let claim = Claim.load(claimId)
  if (claim == null) return
  
  // Update Vote entity
  let voteId = claimId + "-" + voterAddress.toHexString()
  let vote = Vote.load(voteId)
  if (vote != null) {
    vote.vote = voteTypeToString(newVoteType)
    vote.approvedAmount = newVoteType == 1 ? newApprovedAmount : null
    vote.votedAt = event.block.timestamp
    vote.save()
  }
  
  // Update claim vote counts (remove old, add new)
  if (oldVoteType == 1) claim.approveVotes = claim.approveVotes - 1
  else if (oldVoteType == 2) claim.rejectVotes = claim.rejectVotes - 1
  else if (oldVoteType == 3) claim.abstainVotes = claim.abstainVotes - 1
  
  if (newVoteType == 1) claim.approveVotes = claim.approveVotes + 1
  else if (newVoteType == 2) claim.rejectVotes = claim.rejectVotes + 1
  else if (newVoteType == 3) claim.abstainVotes = claim.abstainVotes + 1
  
  claim.save()
  
  // Update member stats
  let councilId = claim.council
  let memberId = councilId + "-" + voterAddress.toHexString()
  let member = CouncilMember.load(memberId)
  if (member != null) {
    // Remove old vote type count
    if (oldVoteType == 1) member.approveVotes = member.approveVotes - 1
    else if (oldVoteType == 2) member.rejectVotes = member.rejectVotes - 1
    else if (oldVoteType == 3) member.abstainVotes = member.abstainVotes - 1
    
    // Add new vote type count
    if (newVoteType == 1) member.approveVotes = member.approveVotes + 1
    else if (newVoteType == 2) member.rejectVotes = member.rejectVotes + 1
    else if (newVoteType == 3) member.abstainVotes = member.abstainVotes + 1
    
    member.save()
  }
}

// =============================================================================
// Claim Resolution
// =============================================================================

/**
 * Handle ClaimApproved event
 */
export function handleClaimApproved(event: ClaimApproved): void {
  let claimId = event.params.claimId.toString()
  
  let claim = Claim.load(claimId)
  if (claim == null) return
  
  claim.status = "Approved"
  claim.approvedAmount = event.params.approvedAmount
  claim.closedAt = event.block.timestamp
  claim.save()
  
  // Update agent stats
  let agent = Agent.load(claim.agent)
  if (agent != null) {
    agent.pendingClaims = agent.pendingClaims - 1
    agent.approvedClaims = agent.approvedClaims + 1
    agent.updatedAt = event.block.timestamp
    agent.save()
  }
  
  // Update council stats
  let council = Council.load(claim.council)
  if (council != null) {
    council.approvedClaims = council.approvedClaims + 1
    council.updatedAt = event.block.timestamp
    council.save()
  }
  
  // Update protocol stats
  let stats = getOrCreateProtocolStats()
  stats.pendingClaims = stats.pendingClaims - 1
  stats.approvedClaims = stats.approvedClaims + 1
  stats.updatedAt = event.block.timestamp
  stats.save()
}

/**
 * Handle ClaimRejected event
 */
export function handleClaimRejected(event: ClaimRejected): void {
  let claimId = event.params.claimId.toString()
  
  let claim = Claim.load(claimId)
  if (claim == null) return
  
  claim.status = "Rejected"
  claim.closedAt = event.block.timestamp
  claim.save()
  
  // Update agent stats
  let agent = Agent.load(claim.agent)
  if (agent != null) {
    agent.pendingClaims = agent.pendingClaims - 1
    agent.rejectedClaims = agent.rejectedClaims + 1
    agent.updatedAt = event.block.timestamp
    agent.save()
  }
  
  // Update council stats
  let council = Council.load(claim.council)
  if (council != null) {
    council.rejectedClaims = council.rejectedClaims + 1
    council.updatedAt = event.block.timestamp
    council.save()
  }
  
  // Update protocol stats
  let stats = getOrCreateProtocolStats()
  stats.pendingClaims = stats.pendingClaims - 1
  stats.rejectedClaims = stats.rejectedClaims + 1
  stats.updatedAt = event.block.timestamp
  stats.save()
}

/**
 * Handle ClaimCancelled event
 */
export function handleClaimCancelled(event: ClaimCancelled): void {
  let claimId = event.params.claimId.toString()
  
  let claim = Claim.load(claimId)
  if (claim == null) return
  
  claim.status = "Cancelled"
  claim.closedAt = event.block.timestamp
  claim.save()
  
  // Update agent stats
  let agent = Agent.load(claim.agent)
  if (agent != null) {
    agent.pendingClaims = agent.pendingClaims - 1
    agent.updatedAt = event.block.timestamp
    agent.save()
  }
  
  // Update protocol stats
  let stats = getOrCreateProtocolStats()
  stats.pendingClaims = stats.pendingClaims - 1
  stats.totalDepositsForfeited = stats.totalDepositsForfeited.plus(event.params.depositForfeited)
  stats.updatedAt = event.block.timestamp
  stats.save()
}

/**
 * Handle ClaimExpired event
 */
export function handleClaimExpired(event: ClaimExpired): void {
  let claimId = event.params.claimId.toString()
  
  let claim = Claim.load(claimId)
  if (claim == null) return
  
  claim.status = "Expired"
  claim.closedAt = event.block.timestamp
  claim.save()
  
  // Update agent stats
  let agent = Agent.load(claim.agent)
  if (agent != null) {
    agent.pendingClaims = agent.pendingClaims - 1
    agent.updatedAt = event.block.timestamp
    agent.save()
  }
  
  // Update protocol stats
  let stats = getOrCreateProtocolStats()
  stats.pendingClaims = stats.pendingClaims - 1
  stats.updatedAt = event.block.timestamp
  stats.save()
}

/**
 * Handle ClaimExecuted event
 * Marks claim as executed after payout
 */
export function handleClaimExecuted(event: ClaimExecuted): void {
  let claimId = event.params.claimId.toString()
  
  let claim = Claim.load(claimId)
  if (claim == null) return
  
  claim.status = "Executed"
  claim.executedAt = event.block.timestamp
  claim.save()
}
