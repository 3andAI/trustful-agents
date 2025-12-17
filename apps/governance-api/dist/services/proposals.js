import { pool } from '../db/index.js';
// ============================================================================
// Proposal CRUD
// ============================================================================
export async function createProposal(type, proposerAddress, threshold, data) {
    // 7 day voting period
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const result = await pool.query(`INSERT INTO proposals (
      type, proposer_address, threshold, expires_at,
      council_name, council_description, council_vertical,
      council_id, member_address, member_name, member_description, member_email
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`, [
        type,
        proposerAddress.toLowerCase(),
        threshold,
        expiresAt,
        data.councilName || null,
        data.councilDescription || null,
        data.councilVertical || null,
        data.councilId || null,
        data.memberAddress?.toLowerCase() || null,
        data.memberName || null,
        data.memberDescription || null,
        data.memberEmail || null,
    ]);
    return result.rows[0];
}
export async function getProposal(id) {
    const result = await pool.query('SELECT * FROM proposals WHERE id = $1', [id]);
    return result.rows[0] || null;
}
export async function getProposals(status, type, councilId) {
    let query = 'SELECT * FROM proposals WHERE 1=1';
    const params = [];
    if (status) {
        params.push(status);
        query += ` AND status = $${params.length}`;
    }
    if (type) {
        params.push(type);
        query += ` AND type = $${params.length}`;
    }
    if (councilId) {
        params.push(councilId);
        query += ` AND council_id = $${params.length}`;
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    return result.rows;
}
export async function getPendingProposals() {
    const result = await pool.query(`SELECT * FROM proposals 
     WHERE status = 'pending' AND expires_at > NOW()
     ORDER BY created_at DESC`);
    return result.rows;
}
export async function updateProposalStatus(id, status, safeTxHash) {
    const executedAt = status === 'executed' ? new Date() : null;
    const result = await pool.query(`UPDATE proposals 
     SET status = $2, executed_at = $3, safe_tx_hash = $4
     WHERE id = $1
     RETURNING *`, [id, status, executedAt, safeTxHash || null]);
    return result.rows[0] || null;
}
// ============================================================================
// Voting
// ============================================================================
export async function castVote(proposalId, voterAddress, choice) {
    // Upsert vote (last vote counts)
    const result = await pool.query(`INSERT INTO votes (proposal_id, voter_address, choice)
     VALUES ($1, $2, $3)
     ON CONFLICT (proposal_id, voter_address)
     DO UPDATE SET choice = $3, updated_at = NOW()
     RETURNING *`, [proposalId, voterAddress.toLowerCase(), choice]);
    // Recalculate vote counts
    await recalculateVotes(proposalId);
    return result.rows[0];
}
export async function getVote(proposalId, voterAddress) {
    const result = await pool.query('SELECT * FROM votes WHERE proposal_id = $1 AND voter_address = $2', [proposalId, voterAddress.toLowerCase()]);
    return result.rows[0] || null;
}
export async function getVotesForProposal(proposalId) {
    const result = await pool.query('SELECT * FROM votes WHERE proposal_id = $1 ORDER BY created_at', [proposalId]);
    return result.rows;
}
async function recalculateVotes(proposalId) {
    const counts = await pool.query(`SELECT 
       COUNT(*) FILTER (WHERE choice = 'aye') as votes_aye,
       COUNT(*) FILTER (WHERE choice = 'nay') as votes_nay,
       COUNT(*) FILTER (WHERE choice = 'abstain') as votes_abstain
     FROM votes WHERE proposal_id = $1`, [proposalId]);
    const { votes_aye, votes_nay, votes_abstain } = counts.rows[0];
    await pool.query(`UPDATE proposals 
     SET votes_aye = $2, votes_nay = $3, votes_abstain = $4
     WHERE id = $1`, [proposalId, parseInt(votes_aye), parseInt(votes_nay), parseInt(votes_abstain)]);
}
// ============================================================================
// Proposal Resolution
// ============================================================================
export async function checkAndResolveProposal(proposalId, totalSigners) {
    const proposal = await getProposal(proposalId);
    if (!proposal || proposal.status !== 'pending') {
        return { resolved: false, status: proposal?.status || 'pending' };
    }
    // Check if expired
    if (new Date(proposal.expires_at) < new Date()) {
        await updateProposalStatus(proposalId, 'expired');
        return { resolved: true, status: 'expired' };
    }
    // Check if threshold reached
    // Approval requires: votes_aye >= threshold AND votes_aye > votes_nay
    if (proposal.votes_aye >= proposal.threshold && proposal.votes_aye > proposal.votes_nay) {
        await updateProposalStatus(proposalId, 'approved');
        return { resolved: true, status: 'approved' };
    }
    // Check if rejection is certain (impossible to reach threshold)
    const remainingVotes = totalSigners - proposal.votes_aye - proposal.votes_nay - proposal.votes_abstain;
    if (proposal.votes_nay > 0 && proposal.votes_aye + remainingVotes < proposal.threshold) {
        await updateProposalStatus(proposalId, 'rejected');
        return { resolved: true, status: 'rejected' };
    }
    return { resolved: false, status: 'pending' };
}
export async function expireOldProposals() {
    const result = await pool.query(`UPDATE proposals 
     SET status = 'expired'
     WHERE status = 'pending' AND expires_at < NOW()`);
    return result.rowCount || 0;
}
// ============================================================================
// Duplicate Check
// ============================================================================
export async function hasPendingProposal(type, councilId, memberAddress) {
    let query = `SELECT 1 FROM proposals WHERE type = $1 AND status = 'pending'`;
    const params = [type];
    if (councilId) {
        params.push(councilId);
        query += ` AND council_id = $${params.length}`;
    }
    if (memberAddress) {
        params.push(memberAddress.toLowerCase());
        query += ` AND member_address = $${params.length}`;
    }
    const result = await pool.query(query + ' LIMIT 1', params);
    return result.rows.length > 0;
}
//# sourceMappingURL=proposals.js.map