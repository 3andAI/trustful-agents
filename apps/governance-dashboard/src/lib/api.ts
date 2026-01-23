// API Client for Trustful Agents Governance Dashboard
// Simplified version - councils read from blockchain via API

const API_BASE = import.meta.env.DEV ? '/api' : '';

// ============================================================================
// Token Management
// ============================================================================

const TOKEN_KEY = 'trustful_auth_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ============================================================================
// API Helpers
// ============================================================================

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

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
// Types
// ============================================================================

export interface Profile {
  address: string;
  name: string | null;
  email: string | null;
  isSafeSigner: boolean;
}

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
  createdAt: string;
  closedAt: string | null;
  displayName?: string;
  notes?: string;
}

export interface CouncilMember {
  address: string;
  councilId: string;
  joinedAt: string | null;
  claimsVoted: number;
  active: boolean;
  name: string | null;
  email: string | null;
  description: string | null;
}

export interface TransactionData {
  to: string;
  data: string;
  value: string;
  description: string;
}

export interface ProposeResponse {
  transaction: TransactionData;
  safeUrl: string;
  message: string;
}

export interface SafeInfo {
  address: string;
  threshold: number;
  owners: string[];
  nonce: number;
}

// ============================================================================
// Auth Endpoints
// ============================================================================

export async function getNonce(): Promise<string> {
  const response = await apiRequest<{ nonce: string }>('/auth/nonce');
  return response.nonce;
}

export async function login(
  message: string,
  signature: string
): Promise<{ token: string; address: string; expiresAt: string }> {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ message, signature }),
  });
}

export async function logout(): Promise<void> {
  await apiRequest('/auth/logout', { method: 'POST' });
}

export async function getProfile(): Promise<Profile> {
  return apiRequest('/auth/me');
}

export async function updateProfile(
  updates: { name?: string; email?: string }
): Promise<Profile> {
  return apiRequest('/auth/me', {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

// ============================================================================
// Council Endpoints (read from blockchain)
// ============================================================================

export async function getCouncils(): Promise<{ councils: Council[]; count: number }> {
  return apiRequest('/councils');
}

export async function getCouncil(councilId: string): Promise<Council> {
  return apiRequest(`/councils/${councilId}`);
}

export async function getCouncilMembers(
  councilId: string
): Promise<{ members: CouncilMember[]; count: number }> {
  return apiRequest(`/councils/${councilId}/members`);
}

export interface CouncilAgent {
  agentId: string;
  name: string;
  description: string | null;
  ownerAddress: string;
}

export async function getCouncilAgents(
  councilId: string
): Promise<{ councilId: string; agents: CouncilAgent[]; count: number }> {
  return apiRequest(`/councils/${councilId}/agents`);
}

export async function canCloseCouncil(
  councilId: string
): Promise<{ canClose: boolean; reason: string }> {
  return apiRequest(`/councils/${councilId}/can-close`);
}

// ============================================================================
// Transaction Proposal Endpoints
// ============================================================================

export interface CreateCouncilParams {
  name: string;
  description?: string;
  vertical: string;
  quorumPercentage?: number;
  claimDepositPercentage?: number;
  votingPeriodDays?: number;
  evidencePeriodDays?: number;
}

export async function proposeCreateCouncil(
  params: CreateCouncilParams
): Promise<ProposeResponse> {
  return apiRequest('/councils/propose-create', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function proposeCloseCouncil(
  councilId: string
): Promise<ProposeResponse> {
  return apiRequest(`/councils/${councilId}/propose-close`, {
    method: 'POST',
  });
}

export async function proposeAddMember(
  councilId: string,
  params: {
    memberAddress: string;
    name?: string;
    email?: string;
    description?: string;
  }
): Promise<ProposeResponse & { memberMetadata: { name?: string; email?: string; description?: string } }> {
  return apiRequest(`/councils/${councilId}/propose-add-member`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function proposeRemoveMember(
  councilId: string,
  memberAddress: string
): Promise<ProposeResponse> {
  return apiRequest(`/councils/${councilId}/propose-remove-member`, {
    method: 'POST',
    body: JSON.stringify({ memberAddress }),
  });
}

export async function updateMemberMetadata(
  councilId: string,
  memberAddress: string,
  metadata: { name?: string; email?: string; description?: string }
): Promise<CouncilMember> {
  return apiRequest(`/councils/${councilId}/members/${memberAddress}/metadata`, {
    method: 'PUT',
    body: JSON.stringify(metadata),
  });
}

// ============================================================================
// Safe Endpoints
// ============================================================================

export async function getSafeInfo(): Promise<SafeInfo> {
  return apiRequest('/safe/info');
}

// ============================================================================
// Pending Transactions Endpoints
// ============================================================================

export interface PendingTransaction {
  safeTxHash: string;
  actionType: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  proposedBy: string;
  proposedAt: string;
  status: string;
  confirmations?: number;
  confirmationsRequired?: number;
}

export async function getPendingTransactions(): Promise<{
  transactions: PendingTransaction[];
  safeThreshold: number;
  safeOwners: number;
}> {
  return apiRequest('/pending');
}

export async function getPendingTransaction(
  safeTxHash: string
): Promise<PendingTransaction> {
  return apiRequest(`/pending/${safeTxHash}`);
}

export async function storePendingTransaction(params: {
  safeTxHash: string;
  actionType: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; safeTxHash: string }> {
  return apiRequest('/pending', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function syncPendingTransactions(): Promise<{
  success: boolean;
  checked: number;
  updated: number;
}> {
  return apiRequest('/pending/sync', { method: 'POST' });
}

// ============================================================================
// Agent Endpoints
// ============================================================================

export async function proposeReassignAgent(params: {
  agentId: string;
  newCouncilId: string;
}): Promise<ProposeResponse & { details: { agentId: string; fromCouncilId: string; toCouncilId: string; toCouncilName: string } }> {
  return apiRequest('/agents/propose-reassign', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
