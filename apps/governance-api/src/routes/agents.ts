import { Router } from 'express';
import type { Response } from 'express';
import { encodeFunctionData, type Address } from 'viem';
import type { AuthenticatedRequest } from '../types/index.js';
import { requireAuth, requireSafeOwner } from '../middleware/auth.js';
import {
  validateBody,
  validateParams,
  reassignAgentSchema,
  agentIdParamSchema,
} from '../middleware/validation.js';
import { logAuditEvent } from '../services/members.js';
import { notifyAllSigners } from '../services/email.js';
import { getSafeInfo } from '../services/safe.js';
import {
  COUNCIL_REGISTRY_ADDRESS,
  CLAIMS_MANAGER_ADDRESS,
  CouncilRegistryAbi,
  ClaimsManagerAbi,
  publicClient,
} from '../config/index.js';

const router = Router();

// Local aliases for the canonical ABIs
const CouncilRegistryABI = CouncilRegistryAbi;
const ClaimsManagerABI = ClaimsManagerAbi;

// ============================================================================
// Viem Client
// ============================================================================

function getClient() {
  return publicClient;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /agents/:id
 * Get agent's current council assignment
 */
router.get(
  '/:id',
  validateParams(agentIdParamSchema),
  async (req, res: Response) => {
    try {
      const agentId = BigInt(req.params.id);
      const client = getClient();
      
      // Get current council
      const councilId = await client.readContract({
        address: COUNCIL_REGISTRY_ADDRESS,
        abi: CouncilRegistryABI,
        functionName: 'getAgentCouncil',
        args: [agentId],
      });
      
      // Get pending claims count
      const pendingClaims = await client.readContract({
        address: CLAIMS_MANAGER_ADDRESS,
        abi: ClaimsManagerABI,
        functionName: 'getPendingClaimCount',
        args: [agentId],
      });
      
      // Get council details if assigned
      let councilName = null;
      if (councilId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        const council = await client.readContract({
          address: COUNCIL_REGISTRY_ADDRESS,
          abi: CouncilRegistryABI,
          functionName: 'getCouncil',
          args: [councilId],
        });
        councilName = council.name;
      }
      
      res.json({
        agentId: agentId.toString(),
        councilId,
        councilName,
        pendingClaims: Number(pendingClaims),
        canReassign: Number(pendingClaims) === 0,
      });
    } catch (error) {
      console.error('Failed to fetch agent:', error);
      res.status(500).json({ error: 'Failed to fetch agent' });
    }
  }
);

/**
 * POST /agents/propose-reassign
 * Prepare agent reassignment (returns transaction data for Safe)
 * Alternative endpoint that takes agentId in body
 */
router.post(
  '/propose-reassign',
  requireAuth,
  requireSafeOwner,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { agentId, newCouncilId } = req.body;
      
      if (!agentId || !newCouncilId) {
        res.status(400).json({ error: 'agentId and newCouncilId are required' });
        return;
      }

      const agentIdBigInt = BigInt(agentId);
      const client = getClient();
      
      // Check pending claims
      const pendingClaims = await client.readContract({
        address: CLAIMS_MANAGER_ADDRESS,
        abi: ClaimsManagerABI,
        functionName: 'getPendingClaimCount',
        args: [agentIdBigInt],
      });
      
      if (Number(pendingClaims) > 0) {
        res.status(400).json({
          error: 'Agent has pending claims',
          pendingClaims: Number(pendingClaims),
          message: 'Cannot reassign agent with open claims.',
        });
        return;
      }
      
      // Verify new council exists and is active
      const newCouncil = await client.readContract({
        address: COUNCIL_REGISTRY_ADDRESS,
        abi: CouncilRegistryABI,
        functionName: 'getCouncil',
        args: [newCouncilId as `0x${string}`],
      });
      
      if (Number(newCouncil.createdAt) === 0) {
        res.status(400).json({ error: 'Target council does not exist' });
        return;
      }
      
      if (!newCouncil.active) {
        res.status(400).json({ error: 'Target council is not active' });
        return;
      }
      
      // Get current council for logging
      const currentCouncilId = await client.readContract({
        address: COUNCIL_REGISTRY_ADDRESS,
        abi: CouncilRegistryABI,
        functionName: 'getAgentCouncil',
        args: [agentIdBigInt],
      });
      
      // Encode the transaction data
      const txData = encodeFunctionData({
        abi: CouncilRegistryABI,
        functionName: 'reassignAgentCouncil',
        args: [agentIdBigInt, newCouncilId as `0x${string}`],
      });
      
      // Log the reassignment intent
      await logAuditEvent(
        'agent_reassigned',
        req.session!.address,
        'agent',
        agentId.toString(),
        {
          fromCouncilId: currentCouncilId,
          toCouncilId: newCouncilId,
          toCouncilName: newCouncil.name,
        }
      );
      
      res.json({
        message: 'Reassignment prepared. Create Safe transaction with the provided data.',
        transaction: {
          to: COUNCIL_REGISTRY_ADDRESS,
          data: txData,
          value: '0',
        },
        details: {
          agentId: agentId.toString(),
          fromCouncilId: currentCouncilId,
          toCouncilId: newCouncilId,
          toCouncilName: newCouncil.name,
        },
      });
    } catch (error) {
      console.error('Failed to prepare reassignment:', error);
      res.status(500).json({ error: 'Failed to prepare reassignment' });
    }
  }
);

/**
 * POST /agents/:id/reassign
 * Prepare agent reassignment (returns transaction data for Safe)
 */
router.post(
  '/:id/reassign',
  requireAuth,
  requireSafeOwner,
  validateParams(agentIdParamSchema),
  validateBody(reassignAgentSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const agentId = BigInt(req.params.id);
      const { newCouncilId } = req.body;
      const client = getClient();
      
      // Check pending claims
      const pendingClaims = await client.readContract({
        address: CLAIMS_MANAGER_ADDRESS,
        abi: ClaimsManagerABI,
        functionName: 'getPendingClaimCount',
        args: [agentId],
      });
      
      if (Number(pendingClaims) > 0) {
        res.status(400).json({
          error: 'Agent has pending claims',
          pendingClaims: Number(pendingClaims),
          message: 'Cannot reassign agent with open claims. Phase 2 will add migration mode.',
        });
        return;
      }
      
      // Verify new council exists and is active
      const newCouncil = await client.readContract({
        address: COUNCIL_REGISTRY_ADDRESS,
        abi: CouncilRegistryABI,
        functionName: 'getCouncil',
        args: [newCouncilId as `0x${string}`],
      });
      
      if (Number(newCouncil.createdAt) === 0) {
        res.status(400).json({ error: 'Target council does not exist' });
        return;
      }
      
      if (!newCouncil.active) {
        res.status(400).json({ error: 'Target council is not active' });
        return;
      }
      
      // Get current council for logging
      const currentCouncilId = await client.readContract({
        address: COUNCIL_REGISTRY_ADDRESS,
        abi: CouncilRegistryABI,
        functionName: 'getAgentCouncil',
        args: [agentId],
      });
      
      // Encode the transaction data
      const txData = encodeFunctionData({
        abi: CouncilRegistryABI,
        functionName: 'reassignAgentCouncil',
        args: [agentId, newCouncilId as `0x${string}`],
      });
      
      // Log the reassignment intent
      await logAuditEvent(
        'agent_reassigned',
        req.session!.address,
        'agent',
        agentId.toString(),
        {
          fromCouncilId: currentCouncilId,
          toCouncilId: newCouncilId,
          toCouncilName: newCouncil.name,
        }
      );
      
      // Notify signers
      await notifyAllSigners(
        'vote_required',
        {
          action: `Reassign Agent #${agentId} to ${newCouncil.name}`,
          targetName: `Agent #${agentId}`,
          proposer: req.session!.address,
          currentVotes: '0',
          requiredVotes: (await getSafeInfo()).threshold.toString(),
          deadline: 'No deadline',
          dashboardUrl: process.env.DASHBOARD_URL || 'https://dashboard.trustful.agents',
        },
        req.session!.address
      );
      
      res.json({
        message: 'Reassignment prepared. Create Safe transaction with the provided data.',
        transactionData: {
          to: COUNCIL_REGISTRY_ADDRESS,
          data: txData,
          value: '0',
        },
        details: {
          agentId: agentId.toString(),
          fromCouncilId: currentCouncilId,
          toCouncilId: newCouncilId,
          toCouncilName: newCouncil.name,
        },
      });
    } catch (error) {
      console.error('Failed to prepare reassignment:', error);
      res.status(500).json({ error: 'Failed to prepare reassignment' });
    }
  }
);

export default router;
