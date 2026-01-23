const API_BASE = '/api';

// ============================================================================
// Types
// ============================================================================

export interface Council {
  councilId: string;
  name: string;
  description: string;
  vertical: string;
  memberCount: number;
  quorumPercentage: number;
  claimDepositPercentage: number;
  votingPeriod: number;
  evidencePeriod: number;
  active: boolean;
  createdAt: number;
  closedAt: number;
}

export interface CouncilMember {
  address: string;
  name: string | null;
  description: string | null;
  email: string | null;
  joinedAt: number;
  claimsVoted: number;
  active: boolean;
}

export interface Proposal {
  id: string;
  type: 'create_council' | 'delete_council' | 'add_member' | 'remove_member';
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'executed';
  councilName: string | null;
  councilDescription: string | null;
  councilVertical: string | null;
  councilId: string | null;
  memberAddress: string | null;
  memberName: string | null;
  proposerAddress: string;
  votesAye: number;
  votesNay: number;
  votesAbstain: number;
  threshold: number;
  expiresAt: string;
  createdAt: string;
  myVote: 'aye' | 'nay' | 'abstain' | null;
}

export interface SafeInfo {
  address: string;
  threshold: number;
  owners: string[];
  nonce: number;
}

export interface Profile {
  address: string;
  name: string | null;
  email: string | null;
  isSafeSigner: boolean;
}

// ============================================================================
// Auth Token Management
// ============================================================================

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('governance_token', token);
  } else {
    localStorage.removeItem('governance_token');
  }
}

export function getAuthToken(): string | null {
  if (!authToken) {
    authToken = localStorage.getItem('governance_token');
  }
  return authToken;
}

export function clearAuthToken() {
  authToken = null;
  localStorage.removeItem('governance_token');
}

// ============================================================================
// API Helper
// ============================================================================

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
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
// Auth API
// ============================================================================

export async function getNonce(): Promise<string> {
  const data = await apiFetch<{ nonce: string }>('/auth/nonce');
  return data.nonce;
}

export async function login(
  message: string,
  signature: string
): Promise<{ token: string; address: string; expiresAt: string }> {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ message, signature }),
  });
}

export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' });
  clearAuthToken();
}

export async function getProfile(): Promise<Profile> {
  return apiFetch('/auth/me');
}

export async function updateProfile(data: {
  name?: string;
  email?: string;
}): Promise<Profile> {
  return apiFetch('/auth/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// Councils API
// ============================================================================

export async function getCouncils(): Promise<Council[]> {
  return apiFetch('/councils');
}

export async function getCouncil(councilId: string): Promise<Council> {
  return apiFetch(`/councils/${councilId}`);
}

export async function getCouncilMembers(councilId: string): Promise<CouncilMember[]> {
  return apiFetch(`/councils/${councilId}/members`);
}

// ============================================================================
// Proposals API
// ============================================================================

export async function getProposals(params?: {
  status?: string;
  type?: string;
  councilId?: string;
}): Promise<Proposal[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.councilId) searchParams.set('councilId', params.councilId);

  const query = searchParams.toString();
  return apiFetch(`/proposals${query ? `?${query}` : ''}`);
}

export async function getPendingProposals(): Promise<Proposal[]> {
  return apiFetch('/proposals/pending');
}

export async function getProposal(id: string): Promise<Proposal & { votes: Array<{ voterAddress: string; choice: string; votedAt: string }> }> {
  return apiFetch(`/proposals/${id}`);
}

export async function createCouncilProposal(data: {
  name: string;
  description: string;
  vertical: string;
}): Promise<Proposal> {
  return apiFetch('/proposals/create-council', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteCouncilProposal(councilId: string): Promise<Proposal> {
  return apiFetch('/proposals/delete-council', {
    method: 'POST',
    body: JSON.stringify({ councilId }),
  });
}

export async function addMemberProposal(data: {
  councilId: string;
  address: string;
  name?: string;
  description?: string;
  email?: string;
}): Promise<Proposal> {
  return apiFetch('/proposals/add-member', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function removeMemberProposal(data: {
  councilId: string;
  address: string;
}): Promise<Proposal> {
  return apiFetch('/proposals/remove-member', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function vote(
  proposalId: string,
  choice: 'aye' | 'nay' | 'abstain'
): Promise<{
  proposal: Proposal;
  resolved: boolean;
  transactionData: {
    to: string;
    data: string;
    value: string;
    description: string;
  } | null;
}> {
  return apiFetch(`/proposals/${proposalId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ choice }),
  });
}

export async function getProposalTransaction(proposalId: string): Promise<{
  proposalId: string;
  transactionData: {
    to: string;
    data: string;
    value: string;
    description: string;
    councilId?: string;
  };
  safeAppUrl: string;
}> {
  return apiFetch(`/proposals/${proposalId}/transaction`);
}

export async function markProposalExecuted(
  proposalId: string,
  safeTxHash: string
): Promise<{ success: boolean }> {
  return apiFetch(`/proposals/${proposalId}/execute`, {
    method: 'POST',
    body: JSON.stringify({ safeTxHash }),
  });
}

// ============================================================================
// Safe API
// ============================================================================

export async function getSafeInfo(): Promise<SafeInfo> {
  return apiFetch('/safe/info');
}
