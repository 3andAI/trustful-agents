import { Router } from 'express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { requireAuth, requireSafeOwner } from '../middleware/auth.js';
import {
  validateBody,
  validateParams,
  proposeTransactionSchema,
  safeTxHashParamSchema,
} from '../middleware/validation.js';
import {
  getSafeInfo,
  getPendingTransactions,
  getTransaction,
} from '../services/safe.js';
import { logAuditEvent } from '../services/members.js';
import { notifyAllSigners } from '../services/email.js';

const router = Router();

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /safe/info
 * Get Safe multisig info
 */
router.get('/info', async (_req, res: Response) => {
  try {
    const info = await getSafeInfo();
    res.json(info);
  } catch (error) {
    console.error('Failed to fetch Safe info:', error);
    res.status(500).json({ error: 'Failed to fetch Safe info' });
  }
});

/**
 * GET /safe/pending
 * Get pending Safe transactions requiring signatures
 */
router.get(
  '/pending',
  requireAuth,
  requireSafeOwner,
  async (_req, res: Response) => {
    try {
      const transactions = await getPendingTransactions();
      res.json(transactions);
    } catch (error) {
      console.error('Failed to fetch pending transactions:', error);
      res.status(500).json({ error: 'Failed to fetch pending transactions' });
    }
  }
);

/**
 * GET /safe/transactions/:safeTxHash
 * Get a specific Safe transaction
 */
router.get(
  '/transactions/:safeTxHash',
  requireAuth,
  requireSafeOwner,
  validateParams(safeTxHashParamSchema),
  async (req, res: Response) => {
    try {
      const { safeTxHash } = req.params;
      const transaction = await getTransaction(safeTxHash);
      
      if (!transaction) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }
      
      res.json(transaction);
    } catch (error) {
      console.error('Failed to fetch transaction:', error);
      res.status(500).json({ error: 'Failed to fetch transaction' });
    }
  }
);

/**
 * POST /safe/propose
 * Propose a new Safe transaction
 * 
 * Note: This endpoint is for documentation/audit purposes.
 * Actual proposal should happen client-side using Safe SDK
 * to avoid sending private keys to the server.
 */
router.post(
  '/propose',
  requireAuth,
  requireSafeOwner,
  validateBody(proposeTransactionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { to, data, value, description } = req.body;
      
      // Log the proposal intent
      await logAuditEvent(
        'safe_tx_proposed',
        req.session!.address,
        'safe_tx',
        'pending', // Will be updated with actual hash after client-side proposal
        { to, data, value, description }
      );
      
      // Notify other signers
      await notifyAllSigners(
        'vote_required',
        {
          action: description,
          targetName: to,
          proposer: req.session!.address,
          currentVotes: '1',
          requiredVotes: (await getSafeInfo()).threshold.toString(),
          deadline: 'No deadline',
          dashboardUrl: process.env.DASHBOARD_URL || 'https://dashboard.trustful.agents',
        },
        req.session!.address // Exclude the proposer
      );
      
      res.json({
        message: 'Proposal logged. Use Safe SDK client-side to create the transaction.',
        instructions: {
          step1: 'Connect wallet to Safe App or use protocol-kit',
          step2: 'Create transaction with provided data',
          step3: 'Sign and propose to Safe Transaction Service',
        },
        transactionData: { to, data, value },
      });
    } catch (error) {
      console.error('Failed to log proposal:', error);
      res.status(500).json({ error: 'Failed to process proposal' });
    }
  }
);

/**
 * POST /safe/sign/:safeTxHash
 * Record a signature on a Safe transaction
 * 
 * Note: Actual signing happens client-side.
 * This endpoint logs the action for audit purposes.
 */
router.post(
  '/sign/:safeTxHash',
  requireAuth,
  requireSafeOwner,
  validateParams(safeTxHashParamSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { safeTxHash } = req.params;
      
      // Verify transaction exists
      const tx = await getTransaction(safeTxHash);
      if (!tx) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }
      
      // Log the signing
      await logAuditEvent(
        'safe_tx_signed',
        req.session!.address,
        'safe_tx',
        safeTxHash,
        { description: tx.description }
      );
      
      res.json({
        message: 'Signature recorded. Use Safe SDK client-side to submit signature.',
        safeTxHash,
        currentConfirmations: tx.confirmations,
        requiredConfirmations: tx.confirmationsRequired,
      });
    } catch (error) {
      console.error('Failed to record signature:', error);
      res.status(500).json({ error: 'Failed to record signature' });
    }
  }
);

/**
 * POST /safe/execute/:safeTxHash
 * Record execution of a Safe transaction
 * 
 * Note: Actual execution happens client-side.
 * This endpoint logs the action for audit purposes.
 */
router.post(
  '/execute/:safeTxHash',
  requireAuth,
  requireSafeOwner,
  validateParams(safeTxHashParamSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { safeTxHash } = req.params;
      
      // Verify transaction exists
      const tx = await getTransaction(safeTxHash);
      if (!tx) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }
      
      // Log the execution
      await logAuditEvent(
        'safe_tx_executed',
        req.session!.address,
        'safe_tx',
        safeTxHash,
        { description: tx.description }
      );
      
      res.json({
        message: 'Execution recorded.',
        safeTxHash,
      });
    } catch (error) {
      console.error('Failed to record execution:', error);
      res.status(500).json({ error: 'Failed to record execution' });
    }
  }
);

export default router;
