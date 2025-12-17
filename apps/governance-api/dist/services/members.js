import { queryOne, queryMany, query } from '../db/index.js';
// ============================================================================
// Council Member CRUD
// ============================================================================
export async function getCouncilMember(councilId, address) {
    return queryOne(`SELECT * FROM council_members 
     WHERE council_id = $1 AND address = $2`, [councilId, address.toLowerCase()]);
}
export async function getCouncilMembers(councilId) {
    return queryMany(`SELECT * FROM council_members 
     WHERE council_id = $1 
     ORDER BY created_at ASC`, [councilId]);
}
export async function getMembersByAddress(address) {
    return queryMany(`SELECT * FROM council_members 
     WHERE address = $1 
     ORDER BY created_at ASC`, [address.toLowerCase()]);
}
export async function createCouncilMember(councilId, address, name, description, email) {
    const result = await queryOne(`INSERT INTO council_members (council_id, address, name, description, email)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`, [councilId, address.toLowerCase(), name ?? null, description ?? null, email ?? null]);
    if (!result) {
        throw new Error('Failed to create council member');
    }
    return result;
}
export async function updateCouncilMember(councilId, address, updates) {
    const setClauses = [];
    const values = [];
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
    return queryOne(`UPDATE council_members 
     SET ${setClauses.join(', ')}
     WHERE council_id = $${paramIndex} AND address = $${paramIndex + 1}
     RETURNING *`, values);
}
export async function deleteCouncilMember(councilId, address) {
    const result = await query(`DELETE FROM council_members 
     WHERE council_id = $1 AND address = $2`, [councilId, address.toLowerCase()]);
    return (result.rowCount ?? 0) > 0;
}
export async function deleteAllCouncilMembers(councilId) {
    const result = await query(`DELETE FROM council_members WHERE council_id = $1`, [councilId]);
    return result.rowCount ?? 0;
}
// ============================================================================
// Audit Logging
// ============================================================================
export async function logAuditEvent(action, actorAddress, targetType, targetId, metadata = {}) {
    await query(`INSERT INTO audit_log (action, actor_address, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5)`, [action, actorAddress.toLowerCase(), targetType, targetId, JSON.stringify(metadata)]);
}
export async function getAuditLogs(filters = {}) {
    const whereClauses = [];
    const values = [];
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
    return queryMany(`SELECT * FROM audit_log 
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, values);
}
//# sourceMappingURL=members.js.map