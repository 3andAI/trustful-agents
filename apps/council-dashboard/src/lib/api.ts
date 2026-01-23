// API Client for Council Dashboard

// const API_BASE = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_URL || '');
const API_BASE = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_URL || 'https://api.trustful-agents.ai');

// ============================================================================
// Types
// ============================================================================

export interface Claim {
  claimId: string;
  agentId: string;
  claimant: string;
  claimedAmount: string;
  approvedAmount: string;
  evidenceHash: string;
  evidenceUri: string;
  paymentReceiptHash: string;
  termsHashAtClaimTime: string;
  termsVersionAtClaimTime: string;
  providerAtClaimTime: string;
  councilId: string;
  councilName?: string;
  claimantDeposit: string;
  lockedCollateral: string;
  status: string;
  statusCode: number;
  filedAt: string;
  evidenceDeadline: string;
  votingDeadline: string;
  hadVotes: boolean;
  isInEvidencePeriod: boolean;
  isInVotingPeriod: boolean;
  canVote: boolean;
  canFinalize: boolean;
  hasVoted?: boolean;
  votingProgress?: VotingProgress;
}

export interface VotingProgress {
  approveVotes: string;
  rejectVotes: string;
  abstainVotes: string;
  totalVotes: string;
  requiredQuorum: string;
  deadline: string;
  quorumReached: boolean;
}

export interface Vote {
  voter: string;
  vote: string;
  voteCode: number;
  approvedAmount: string;
  reasoning: string;
  votedAt: string;
  lastChangedAt: string | null;
}

export interface Council {
  councilId: string;
  name: string;
  description: string;
  vertical: string;
  memberCount: number;
}

export interface TransactionData {
  to: string;
  data: string;
  value: string;
}

// ============================================================================
// API Helpers
// ============================================================================

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Claims Endpoints
// ============================================================================

export async function getClaims(params?: {
  councilId?: string;
  status?: string;
  claimant?: string;
  agentId?: string;
  pending?: boolean;
}): Promise<{ claims: Claim[]; count: number }> {
  const query = new URLSearchParams();
  if (params?.councilId) query.set('councilId', params.councilId);
  if (params?.status) query.set('status', params.status);
  if (params?.claimant) query.set('claimant', params.claimant);
  if (params?.agentId) query.set('agentId', params.agentId);
  if (params?.pending) query.set('pending', 'true');
  
  const queryString = query.toString();
  return apiRequest(`/claims${queryString ? `?${queryString}` : ''}`);
}

export async function getClaim(claimId: string): Promise<Claim> {
  return apiRequest(`/claims/${claimId}`);
}

export async function getClaimVotes(claimId: string): Promise<{ votes: Vote[]; count: number }> {
  return apiRequest(`/claims/${claimId}/votes`);
}

export async function getMyVote(claimId: string, address: string): Promise<{ hasVoted: boolean; vote: Vote | null }> {
  return apiRequest(`/claims/${claimId}/my-vote?address=${address}`);
}

export async function prepareVoteTransaction(
  claimId: string,
  params: {
    vote: number; // 1=Approve, 2=Reject, 3=Abstain
    approvedAmount?: string;
    reasoning?: string;
    voterAddress: string;
  }
): Promise<{ transaction: TransactionData; isChangeVote: boolean; message: string }> {
  return apiRequest(`/claims/${claimId}/vote`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function prepareFinalizeTransaction(
  claimId: string
): Promise<{ transaction: TransactionData; message: string }> {
  return apiRequest(`/claims/${claimId}/finalize`, {
    method: 'POST',
  });
}

// ============================================================================
// Member Endpoints
// ============================================================================

export async function getMemberCouncils(address: string): Promise<{ councils: Council[]; count: number }> {
  return apiRequest(`/claims/members/${address}/councils`);
}

export async function getMemberPendingClaims(address: string): Promise<{ claims: Claim[]; count: number }> {
  return apiRequest(`/claims/members/${address}/pending-claims`);
}

// ============================================================================
// Council Endpoints (from existing API)
// ============================================================================

export async function getCouncils(): Promise<{ councils: Council[]; count: number }> {
  return apiRequest('/councils');
}

export async function getCouncil(councilId: string): Promise<Council> {
  return apiRequest(`/councils/${councilId}`);
}

// ============================================================================
// Utility Functions
// ============================================================================

export function formatUSDC(amount: string | bigint): string {
  const value = typeof amount === 'string' ? BigInt(amount) : amount;
  const dollars = Number(value) / 1_000_000;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function getTimeRemaining(deadline: string): string {
  const now = new Date();
  const end = new Date(deadline);
  const diff = end.getTime() - now.getTime();
  
  if (diff <= 0) return 'Ended';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'filed':
      return 'text-blue-400';
    case 'evidenceclosed':
    case 'votingclosed':
      return 'text-council';
    case 'approved':
    case 'executed':
      return 'text-accent';
    case 'rejected':
    case 'cancelled':
      return 'text-danger';
    case 'expired':
      return 'text-governance-400';
    default:
      return 'text-governance-400';
  }
}

export function getStatusBadge(status: string): string {
  switch (status.toLowerCase()) {
    case 'filed':
      return 'badge bg-blue-500/20 text-blue-400';
    case 'evidenceclosed':
    case 'votingclosed':
      return 'badge-council';
    case 'approved':
    case 'executed':
      return 'badge-success';
    case 'rejected':
    case 'cancelled':
      return 'badge-danger';
    case 'expired':
      return 'badge-neutral';
    default:
      return 'badge-neutral';
  }
}
