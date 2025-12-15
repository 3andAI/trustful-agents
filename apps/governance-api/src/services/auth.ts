import { SiweMessage, generateNonce } from 'siwe';
import { queryOne, query } from '../db/index.js';
import type { Session, GovernanceSigner } from '../types/index.js';

// ============================================================================
// Configuration
// ============================================================================

const SESSION_DURATION_HOURS = 24;
const NONCE_EXPIRY_MINUTES = 10;

// ============================================================================
// Nonce Management
// ============================================================================

interface NonceRecord {
  nonce: string;
  created_at: Date;
}

// In-memory nonce store (could use Redis in production)
const nonceStore = new Map<string, NonceRecord>();

export function createNonce(): string {
  const nonce = generateNonce();
  nonceStore.set(nonce, {
    nonce,
    created_at: new Date(),
  });
  
  // Cleanup old nonces
  cleanupExpiredNonces();
  
  return nonce;
}

export function validateNonce(nonce: string): boolean {
  const record = nonceStore.get(nonce);
  if (!record) return false;
  
  const now = new Date();
  const expiresAt = new Date(record.created_at.getTime() + NONCE_EXPIRY_MINUTES * 60 * 1000);
  
  if (now > expiresAt) {
    nonceStore.delete(nonce);
    return false;
  }
  
  // Nonce is single-use
  nonceStore.delete(nonce);
  return true;
}

function cleanupExpiredNonces(): void {
  const now = new Date();
  for (const [nonce, record] of nonceStore) {
    const expiresAt = new Date(record.created_at.getTime() + NONCE_EXPIRY_MINUTES * 60 * 1000);
    if (now > expiresAt) {
      nonceStore.delete(nonce);
    }
  }
}

// ============================================================================
// SIWE Verification
// ============================================================================

export interface VerifyResult {
  success: boolean;
  address?: string;
  error?: string;
}

export async function verifySiweMessage(
  message: string,
  signature: string,
  expectedDomain: string,
  expectedChainId: number
): Promise<VerifyResult> {
  try {
    const siweMessage = new SiweMessage(message);
    
    // Verify the signature
    const result = await siweMessage.verify({
      signature,
      domain: expectedDomain,
      nonce: siweMessage.nonce,
    });
    
    if (!result.success) {
      return { success: false, error: 'Invalid signature' };
    }
    
    // Validate nonce
    if (!validateNonce(siweMessage.nonce)) {
      return { success: false, error: 'Invalid or expired nonce' };
    }
    
    // Validate domain
    if (siweMessage.domain !== expectedDomain) {
      return { success: false, error: 'Domain mismatch' };
    }
    
    // Validate chain ID
    if (siweMessage.chainId !== expectedChainId) {
      return { success: false, error: 'Chain ID mismatch' };
    }
    
    // Check expiration
    if (siweMessage.expirationTime) {
      const expiration = new Date(siweMessage.expirationTime);
      if (new Date() > expiration) {
        return { success: false, error: 'Message expired' };
      }
    }
    
    return {
      success: true,
      address: siweMessage.address.toLowerCase(),
    };
  } catch (error) {
    console.error('SIWE verification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

// ============================================================================
// Session Management
// ============================================================================

export async function createSession(address: string, nonce: string): Promise<Session> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  
  const result = await queryOne<Session>(
    `INSERT INTO sessions (address, nonce, expires_at)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [address.toLowerCase(), nonce, expiresAt]
  );
  
  if (!result) {
    throw new Error('Failed to create session');
  }
  
  return result;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  return queryOne<Session>(
    `SELECT * FROM sessions 
     WHERE id = $1 AND expires_at > NOW()`,
    [sessionId]
  );
}

export async function deleteSession(sessionId: string): Promise<void> {
  await query('DELETE FROM sessions WHERE id = $1', [sessionId]);
}

export async function deleteAllSessionsForAddress(address: string): Promise<void> {
  await query('DELETE FROM sessions WHERE address = $1', [address.toLowerCase()]);
}

// ============================================================================
// Governance Signer Management
// ============================================================================

export async function getGovernanceSigner(address: string): Promise<GovernanceSigner | null> {
  return queryOne<GovernanceSigner>(
    'SELECT * FROM governance_signers WHERE address = $1',
    [address.toLowerCase()]
  );
}

export async function upsertGovernanceSigner(
  address: string,
  name?: string,
  email?: string
): Promise<GovernanceSigner> {
  const result = await queryOne<GovernanceSigner>(
    `INSERT INTO governance_signers (address, name, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (address) DO UPDATE SET
       name = COALESCE($2, governance_signers.name),
       email = COALESCE($3, governance_signers.email)
     RETURNING *`,
    [address.toLowerCase(), name ?? null, email ?? null]
  );
  
  if (!result) {
    throw new Error('Failed to upsert governance signer');
  }
  
  return result;
}

export async function updateGovernanceSignerProfile(
  address: string,
  updates: { name?: string; email?: string }
): Promise<GovernanceSigner | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;
  
  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  
  if (updates.email !== undefined) {
    setClauses.push(`email = $${paramIndex++}`);
    values.push(updates.email);
  }
  
  if (setClauses.length === 0) {
    return getGovernanceSigner(address);
  }
  
  values.push(address.toLowerCase());
  
  return queryOne<GovernanceSigner>(
    `UPDATE governance_signers 
     SET ${setClauses.join(', ')}
     WHERE address = $${paramIndex}
     RETURNING *`,
    values
  );
}

// ============================================================================
// Session Cleanup
// ============================================================================

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await query<{ count: number }>(
    'SELECT cleanup_expired_sessions() as count'
  );
  return result.rows[0]?.count ?? 0;
}
