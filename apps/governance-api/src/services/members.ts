import { queryOne, queryMany, query } from '../db/index.js';
import type { CouncilMember, AuditAction } from '../types/index.js';

// ============================================================================
// Council Member CRUD
// ============================================================================

export async function getCouncilMember(
  councilId: string,
  address: string
): Promise<CouncilMember | null> {
  return queryOne<CouncilMember>(
    `SELECT * FROM council_members 
     WHERE council_id = $1 AND address = $2`,
    [councilId, address.toLowerCase()]
  );
}

export async function getCouncilMembers(councilId: string): Promise<CouncilMember[]> {
  return queryMany<CouncilMember>(
    `SELECT * FROM council_members 
     WHERE council_id = $1 
     ORDER BY created_at ASC`,
    [councilId]
  );
}

export async function getMembersByAddress(address: string): Promise<CouncilMember[]> {
  return queryMany<CouncilMember>(
    `SELECT * FROM council_members 
     WHERE address = $1 
     ORDER BY created_at ASC`,
    [address.toLowerCase()]
  );
}

export async function createCouncilMember(
  councilId: string,
  address: string,
  name?: string,
  description?: string,
  email?: string
): Promise<CouncilMember> {
  const result = await queryOne<CouncilMember>(
    `INSERT INTO council_members (council_id, address, name, description, email)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [councilId, address.toLowerCase(), name ?? null, description ?? null, email ?? null]
  );
  
  if (!result) {
    throw new Error('Failed to create council member');
  }
  
  return result;
}

export async function updateCouncilMember(
  councilId: string,
  address: string,
  updates: { name?: string; description?: string; email?: string }
): Promise<CouncilMember | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;
  
  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  
  if (updates.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }
  
  if (updates.email !== undefined) {
    setClauses.push(`email = $${paramIndex++}`);
    values.push(updates.email);
  }
  
  if (setClauses.length === 0) {
    return getCouncilMember(councilId, address);
  }
  
  values.push(councilId, address.toLowerCase());
  
  return queryOne<CouncilMember>(
    `UPDATE council_members 
     SET ${setClauses.join(', ')}
     WHERE council_id = $${paramIndex} AND address = $${paramIndex + 1}
     RETURNING *`,
    values
  );
}

export async function deleteCouncilMember(
  councilId: string,
  address: string
): Promise<boolean> {
  const result = await query(
    `DELETE FROM council_members 
     WHERE council_id = $1 AND address = $2`,
    [councilId, address.toLowerCase()]
  );
  
  return (result.rowCount ?? 0) > 0;
}

export async function deleteAllCouncilMembers(councilId: string): Promise<number> {
  const result = await query(
    `DELETE FROM council_members WHERE council_id = $1`,
    [councilId]
  );
  
  return result.rowCount ?? 0;
}

// ============================================================================
// Audit Logging
// ============================================================================

export async function logAuditEvent(
  action: AuditAction,
  actorAddress: string,
  targetType: 'council' | 'member' | 'agent' | 'safe_tx',
  targetId: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await query(
    `INSERT INTO audit_log (action, actor_address, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [action, actorAddress.toLowerCase(), targetType, targetId, JSON.stringify(metadata)]
  );
}

export async function getAuditLogs(
  filters: {
    action?: AuditAction;
    actorAddress?: string;
    targetType?: string;
    targetId?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<Array<{
  id: number;
  action: AuditAction;
  actor_address: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}>> {
  const whereClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;
  
  if (filters.action) {
    whereClauses.push(`action = $${paramIndex++}`);
    values.push(filters.action);
  }
  
  if (filters.actorAddress) {
    whereClauses.push(`actor_address = $${paramIndex++}`);
    values.push(filters.actorAddress.toLowerCase());
  }
  
  if (filters.targetType) {
    whereClauses.push(`target_type = $${paramIndex++}`);
    values.push(filters.targetType);
  }
  
  if (filters.targetId) {
    whereClauses.push(`target_id = $${paramIndex++}`);
    values.push(filters.targetId);
  }
  
  const whereClause = whereClauses.length > 0 
    ? `WHERE ${whereClauses.join(' AND ')}` 
    : '';
  
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  
  values.push(limit, offset);
  
  return queryMany(
    `SELECT * FROM audit_log 
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    values
  );
}
