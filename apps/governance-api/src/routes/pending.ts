import { Router, type Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { query, queryOne, queryMany } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { getSafeInfo } from '../services/safe.js';

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface PendingTransaction {
  safeTxHash: string;
  actionType: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  proposedBy: string;
  proposedAt: string;
  status: string;
  // Added from Safe API
  confirmations?: number;
  confirmationsRequired?: number;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /pending
 * List all pending transactions with metadata
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await queryMany<{
      safe_tx_hash: string;
      action_type: string;
      title: string;
      description: string | null;
      metadata: Record<string, unknown>;
      proposed_by: string;
      proposed_at: Date;
      status: string;
    }>(
      `SELECT * FROM pending_transactions 
       WHERE status = 'pending' 
       ORDER BY proposed_at DESC`
    );

    // Get Safe info for threshold
    const safeInfo = await getSafeInfo();

    // Try to get confirmation counts from Safe API (with rate limit protection)
    // Fetch ALL recent transactions (not just non-executed) to properly update status
    let confirmationCounts: Record<string, number> = {};
    let executedHashes: Set<string> = new Set();
    
    try {
      const txServiceUrl = process.env.CHAIN_ID === '8453'
        ? 'https://safe-transaction-base.safe.global'
        : 'https://safe-transaction-base-sepolia.safe.global';
      
      // Fetch all recent transactions (remove executed=false filter)
      const response = await fetch(
        `${txServiceUrl}/api/v1/safes/${safeInfo.address}/multisig-transactions/?limit=50`,
        { headers: { 'Accept': 'application/json' } }
      );
      
      if (response.ok) {
        const data = await response.json() as { results: Array<{ safeTxHash: string; confirmations: unknown[]; isExecuted: boolean }> };
        for (const tx of data.results || []) {
          confirmationCounts[tx.safeTxHash] = tx.confirmations?.length || 0;
          
          // Track executed transactions
          if (tx.isExecuted) {
            executedHashes.add(tx.safeTxHash);
            // Update status in database
            await query(
              `UPDATE pending_transactions SET status = 'executed', executed_at = NOW() WHERE safe_tx_hash = $1 AND status = 'pending'`,
              [tx.safeTxHash]
            );
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch Safe confirmations (rate limited?):', err);
    }

    // Filter out any transactions that are now executed
    const pendingRows = rows.filter(row => !executedHashes.has(row.safe_tx_hash));

    const transactions: PendingTransaction[] = pendingRows.map((row) => ({
      safeTxHash: row.safe_tx_hash,
      actionType: row.action_type,
      title: row.title,
      description: row.description,
      metadata: row.metadata,
      proposedBy: row.proposed_by,
      proposedAt: row.proposed_at.toISOString(),
      status: row.status,
      confirmations: confirmationCounts[row.safe_tx_hash] || 0,
      confirmationsRequired: safeInfo.threshold,
    }));

    res.json({ 
      transactions,
      safeThreshold: safeInfo.threshold,
      safeOwners: safeInfo.owners.length,
    });
  } catch (error) {
    console.error('Failed to get pending transactions:', error);
    res.status(500).json({ error: 'Failed to get pending transactions' });
  }
});

/**
 * GET /pending/:safeTxHash
 * Get a specific pending transaction
 */
router.get('/:safeTxHash', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { safeTxHash } = req.params;

    const row = await queryOne<{
      safe_tx_hash: string;
      action_type: string;
      title: string;
      description: string | null;
      metadata: Record<string, unknown>;
      proposed_by: string;
      proposed_at: Date;
      status: string;
    }>(
      `SELECT * FROM pending_transactions WHERE safe_tx_hash = $1`,
      [safeTxHash]
    );

    if (!row) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      safeTxHash: row.safe_tx_hash,
      actionType: row.action_type,
      title: row.title,
      description: row.description,
      metadata: row.metadata,
      proposedBy: row.proposed_by,
      proposedAt: row.proposed_at.toISOString(),
      status: row.status,
    });
  } catch (error) {
    console.error('Failed to get pending transaction:', error);
    res.status(500).json({ error: 'Failed to get pending transaction' });
  }
});

/**
 * POST /pending
 * Store a new pending transaction (called after proposing to Safe)
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { safeTxHash, actionType, title, description, metadata } = req.body;
    const proposedBy = req.session!.address;

    if (!safeTxHash || !actionType || !title) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await query(
      `INSERT INTO pending_transactions (safe_tx_hash, action_type, title, description, metadata, proposed_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (safe_tx_hash) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         metadata = EXCLUDED.metadata`,
      [safeTxHash, actionType, title, description || null, JSON.stringify(metadata || {}), proposedBy]
    );

    res.json({ success: true, safeTxHash });
  } catch (error) {
    console.error('Failed to store pending transaction:', error);
    res.status(500).json({ error: 'Failed to store pending transaction' });
  }
});

/**
 * DELETE /pending/:safeTxHash
 * Mark a transaction as rejected/cancelled
 */
router.delete('/:safeTxHash', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { safeTxHash } = req.params;

    await query(
      `UPDATE pending_transactions SET status = 'rejected' WHERE safe_tx_hash = $1`,
      [safeTxHash]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update pending transaction:', error);
    res.status(500).json({ error: 'Failed to update pending transaction' });
  }
});

/**
 * POST /pending/sync
 * Sync pending transaction statuses with Safe API
 */
router.post('/sync', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const safeInfo = await getSafeInfo();
    const txServiceUrl = process.env.CHAIN_ID === '8453'
      ? 'https://safe-transaction-base.safe.global'
      : 'https://safe-transaction-base-sepolia.safe.global';

    // Get pending transactions from our DB
    const pending = await queryMany<{ safe_tx_hash: string }>(
      `SELECT safe_tx_hash FROM pending_transactions WHERE status = 'pending'`
    );

    let updated = 0;
    
    // Check each one against Safe API
    for (const tx of pending) {
      try {
        const response = await fetch(
          `${txServiceUrl}/api/v1/multisig-transactions/${tx.safe_tx_hash}/`,
          { headers: { 'Accept': 'application/json' } }
        );
        
        if (response.ok) {
          const data = await response.json() as { isExecuted: boolean };
          if (data.isExecuted) {
            await query(
              `UPDATE pending_transactions SET status = 'executed', executed_at = NOW() WHERE safe_tx_hash = $1`,
              [tx.safe_tx_hash]
            );
            updated++;
          }
        } else if (response.status === 404) {
          // Transaction no longer exists - mark as rejected
          await query(
            `UPDATE pending_transactions SET status = 'rejected' WHERE safe_tx_hash = $1`,
            [tx.safe_tx_hash]
          );
          updated++;
        }
      } catch (err) {
        // Rate limited or other error - skip
        console.warn(`Could not check tx ${tx.safe_tx_hash}:`, err);
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    res.json({ success: true, checked: pending.length, updated });
  } catch (error) {
    console.error('Failed to sync pending transactions:', error);
    res.status(500).json({ error: 'Failed to sync pending transactions' });
  }
});

export default router;
