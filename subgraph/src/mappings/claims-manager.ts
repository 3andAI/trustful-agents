import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  ClaimFiled,
  EvidenceSubmitted,
  VoteCast,
  ClaimApproved,
  ClaimRejected,
  ClaimCancelled,
  ClaimExecuted,
} from "../../generated/ClaimsManager/ClaimsManager";
import {
  Agent,
  Claim,
  Evidence,
  Vote,
  Council,
  CouncilMember,
  ProtocolStats,
} from "../../generated/schema";

// =============================================================================
// Helper Functions
// =============================================================================

function getOrCreateAgent(agentId: BigInt): Agent {
  let id = agentId.toHexString();
  let agent = Agent.load(id);
  if (agent == null) {
    agent = new Agent(id);
    agent.owner = Bytes.empty();
    agent.collateralBalance = BigInt.zero();
    agent.lockedCollateral = BigInt.zero();
    agent.availableCollateral = BigInt.zero();
    agent.withdrawalPending = false;
    agent.isValidated = false;
    agent.totalClaims = 0;
    agent.approvedClaims = 0;
    agent.rejectedClaims = 0;
    agent.pendingClaims = 0;
    agent.totalPaidOut = BigInt.zero();
    agent.createdAt = BigInt.zero();
    agent.updatedAt = BigInt.zero();
  }
  return agent;
}

function getOrCreateProtocolStats(): ProtocolStats {
  let stats = ProtocolStats.load("global");
  if (stats == null) {
    stats = new ProtocolStats("global");
    stats.totalAgents = 0;
    stats.validatedAgents = 0;
    stats.totalCollateral = BigInt.zero();
    stats.lockedCollateral = BigInt.zero();
    stats.totalCouncils = 0;
    stats.activeCouncils = 0;
    stats.totalCouncilMembers = 0;
    stats.totalClaims = 0;
    stats.pendingClaims = 0;
    stats.approvedClaims = 0;
    stats.rejectedClaims = 0;
    stats.totalCompensationPaid = BigInt.zero();
    stats.totalDepositsForfeited = BigInt.zero();
    stats.updatedAt = BigInt.zero();
  }
  return stats;
}

// =============================================================================
// Event Handlers
// =============================================================================

export function handleClaimFiled(event: ClaimFiled): void {
  let claimId = event.params.claimId.toString();
  let claim = new Claim(claimId);

  let agent = getOrCreateAgent(event.params.agentId);

  claim.agent = agent.id;
  claim.council = event.params.councilId.toHexString();
  claim.claimant = event.params.claimant;
  claim.claimedAmount = event.params.claimedAmount;
  claim.claimantDeposit = event.params.claimantDeposit;
  claim.evidenceHash = Bytes.empty(); // Will be set from other data
  claim.evidenceUri = "";
  claim.paymentReceiptHash = Bytes.empty();
  claim.termsHashAtClaimTime = Bytes.empty();
  claim.termsVersionAtClaimTime = 0;
  claim.providerAtClaimTime = Bytes.empty();
  claim.lockedCollateral = BigInt.zero();
  claim.status = "Filed";
  claim.filedAt = event.block.timestamp;
  claim.evidenceDeadline = BigInt.zero(); // TODO: Calculate from council settings
  claim.votingDeadline = BigInt.zero();
  claim.approveVotes = 0;
  claim.rejectVotes = 0;
  claim.abstainVotes = 0;
  claim.totalVotes = 0;
  claim.save();

  // Update agent stats
  agent.totalClaims = agent.totalClaims + 1;
  agent.pendingClaims = agent.pendingClaims + 1;
  agent.updatedAt = event.block.timestamp;
  agent.save();

  // Update protocol stats
  let stats = getOrCreateProtocolStats();
  stats.totalClaims = stats.totalClaims + 1;
  stats.pendingClaims = stats.pendingClaims + 1;
  stats.updatedAt = event.block.timestamp;
  stats.save();
}

export function handleEvidenceSubmitted(event: EvidenceSubmitted): void {
  let claim = Claim.load(event.params.claimId.toString());
  if (claim == null) return;

  // Create evidence entity
  let evidenceCount = claim.totalVotes; // Use as counter for simplicity
  let evidenceId = event.params.claimId.toString() + "-" + evidenceCount.toString();
  let evidence = new Evidence(evidenceId);

  evidence.claim = claim.id;
  evidence.submitter = event.transaction.from;
  evidence.isCounterEvidence = event.params.isCounterEvidence;
  evidence.evidenceHash = event.params.evidenceHash;
  evidence.evidenceUri = event.params.evidenceUri;
  evidence.submittedAt = event.block.timestamp;
  evidence.save();
}

export function handleVoteCast(event: VoteCast): void {
  let claim = Claim.load(event.params.claimId.toString());
  if (claim == null) return;

  let voteId = event.params.claimId.toString() + "-" + event.params.voter.toHexString();
  let vote = new Vote(voteId);

  vote.claim = claim.id;
  vote.voter = claim.council + "-" + event.params.voter.toHexString();

  // Map vote enum (0=None, 1=Approve, 2=Reject, 3=Abstain)
  let voteValue = event.params.vote;
  if (voteValue == 1) {
    vote.vote = "Approve";
    claim.approveVotes = claim.approveVotes + 1;
  } else if (voteValue == 2) {
    vote.vote = "Reject";
    claim.rejectVotes = claim.rejectVotes + 1;
  } else {
    vote.vote = "Abstain";
    claim.abstainVotes = claim.abstainVotes + 1;
  }

  vote.approvedAmount = event.params.approvedAmount;
  vote.votedAt = event.block.timestamp;
  vote.save();

  claim.totalVotes = claim.totalVotes + 1;
  claim.save();

  // Update council member stats
  let memberId = claim.council + "-" + event.params.voter.toHexString();
  let member = CouncilMember.load(memberId);
  if (member != null) {
    member.claimsVoted = member.claimsVoted + 1;
    if (voteValue == 1) member.approveVotes = member.approveVotes + 1;
    else if (voteValue == 2) member.rejectVotes = member.rejectVotes + 1;
    else member.abstainVotes = member.abstainVotes + 1;
    member.save();
  }
}

export function handleClaimApproved(event: ClaimApproved): void {
  let claim = Claim.load(event.params.claimId.toString());
  if (claim == null) return;

  claim.status = "Approved";
  claim.approvedAmount = event.params.approvedAmount;
  claim.closedAt = event.block.timestamp;
  claim.save();

  let agent = Agent.load(claim.agent);
  if (agent != null) {
    agent.approvedClaims = agent.approvedClaims + 1;
    agent.pendingClaims = agent.pendingClaims - 1;
    agent.updatedAt = event.block.timestamp;
    agent.save();
  }

  let stats = getOrCreateProtocolStats();
  stats.approvedClaims = stats.approvedClaims + 1;
  stats.pendingClaims = stats.pendingClaims - 1;
  stats.updatedAt = event.block.timestamp;
  stats.save();
}

export function handleClaimRejected(event: ClaimRejected): void {
  let claim = Claim.load(event.params.claimId.toString());
  if (claim == null) return;

  claim.status = "Rejected";
  claim.closedAt = event.block.timestamp;
  claim.save();

  let agent = Agent.load(claim.agent);
  if (agent != null) {
    agent.rejectedClaims = agent.rejectedClaims + 1;
    agent.pendingClaims = agent.pendingClaims - 1;
    agent.updatedAt = event.block.timestamp;
    agent.save();
  }

  let stats = getOrCreateProtocolStats();
  stats.rejectedClaims = stats.rejectedClaims + 1;
  stats.pendingClaims = stats.pendingClaims - 1;
  stats.updatedAt = event.block.timestamp;
  stats.save();
}

export function handleClaimCancelled(event: ClaimCancelled): void {
  let claim = Claim.load(event.params.claimId.toString());
  if (claim == null) return;

  claim.status = "Cancelled";
  claim.closedAt = event.block.timestamp;
  claim.save();

  let agent = Agent.load(claim.agent);
  if (agent != null) {
    agent.pendingClaims = agent.pendingClaims - 1;
    agent.updatedAt = event.block.timestamp;
    agent.save();
  }

  let stats = getOrCreateProtocolStats();
  stats.pendingClaims = stats.pendingClaims - 1;
  stats.updatedAt = event.block.timestamp;
  stats.save();
}

export function handleClaimExecuted(event: ClaimExecuted): void {
  let claim = Claim.load(event.params.claimId.toString());
  if (claim == null) return;

  claim.status = "Executed";
  claim.executedAt = event.block.timestamp;
  claim.save();

  let agent = Agent.load(claim.agent);
  if (agent != null) {
    agent.totalPaidOut = agent.totalPaidOut.plus(event.params.amountPaid);
    agent.updatedAt = event.block.timestamp;
    agent.save();
  }

  let stats = getOrCreateProtocolStats();
  stats.totalCompensationPaid = stats.totalCompensationPaid.plus(event.params.amountPaid);
  stats.updatedAt = event.block.timestamp;
  stats.save();
}
