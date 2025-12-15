/**
 * Database entity types for Governance API
 */

// ============================================================================
// Database Entities
// ============================================================================

export interface GovernanceSigner {
  address: string;
  name: string | null;
  email: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CouncilMember {
  id: number;
  address: string;
  council_id: string; // bytes32 as hex string
  name: string | null;
  description: string | null;
  email: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Session {
  id: string;
  address: string;
  nonce: string;
  expires_at: Date;
  created_at: Date;
}

export interface AuditLog {
  id: number;
  action: AuditAction;
  actor_address: string;
  target_type: TargetType;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface EmailQueueItem {
  id: number;
  recipient_email: string;
  template: EmailTemplate;
  variables: Record<string, string>;
  status: EmailStatus;
  attempts: number;
  last_error: string | null;
  scheduled_at: Date;
  sent_at: Date | null;
  created_at: Date;
}

// ============================================================================
// Enums
// ============================================================================

export type AuditAction =
  | 'council_created'
  | 'council_closed'
  | 'council_updated'
  | 'member_added'
  | 'member_removed'
  | 'member_metadata_updated'
  | 'agent_reassigned'
  | 'safe_tx_proposed'
  | 'safe_tx_signed'
  | 'safe_tx_executed';

export type TargetType = 'council' | 'member' | 'agent' | 'safe_tx';

export type EmailTemplate =
  | 'council_deletion_proposed'
  | 'council_deleted'
  | 'council_deletion_rejected'
  | 'member_added'
  | 'member_removed'
  | 'vote_required';

export type EmailStatus = 'pending' | 'sent' | 'failed';

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface NonceResponse {
  nonce: string;
}

export interface LoginRequest {
  message: string;
  signature: string;
}

export interface LoginResponse {
  token: string;
  address: string;
  expiresAt: string;
}

export interface ProfileResponse {
  address: string;
  name: string | null;
  email: string | null;
  isSafeSigner: boolean;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
}

export interface CouncilResponse {
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

export interface CouncilMemberResponse {
  address: string;
  name: string | null;
  description: string | null;
  email: string | null;
  joinedAt: number;
  claimsVoted: number;
  active: boolean;
}

export interface AddMemberRequest {
  address: string;
  name?: string;
  description?: string;
  email?: string;
}

export interface UpdateMemberRequest {
  name?: string;
  description?: string;
  email?: string;
}

export interface ReassignAgentRequest {
  newCouncilId: string;
}

export interface SafeTransactionResponse {
  safeTxHash: string;
  to: string;
  data: string;
  value: string;
  operation: number;
  nonce: number;
  confirmations: number;
  confirmationsRequired: number;
  isExecuted: boolean;
  proposer: string;
  description: string;
}

export interface ProposeTransactionRequest {
  to: string;
  data: string;
  value?: string;
  description: string;
}

// ============================================================================
// Safe Types
// ============================================================================

export interface SafeInfo {
  address: string;
  threshold: number;
  owners: string[];
  nonce: number;
}

// ============================================================================
// Authenticated Request
// ============================================================================

import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  session?: {
    address: string;
    sessionId: string;
  };
}
