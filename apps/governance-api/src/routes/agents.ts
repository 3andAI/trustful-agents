import { Router } from 'express';
import type { Response } from 'express';
import { createPublicClient, http, encodeFunctionData, type Address } from 'viem';
import { base, baseSepolia } from 'viem/chains';
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

const router = Router();

// ============================================================================
// Configuration
// ============================================================================

const CHAIN_ID = parseInt(process.env.CHAIN_ID || '84532');
const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
const COUNCIL_REGISTRY_ADDRESS = process.env.COUNCIL_REGISTRY_ADDRESS as Address;
const CLAIMS_MANAGER_ADDRESS = process.env.CLAIMS_MANAGER_ADDRESS as Address;

// ABIs
const CouncilRegistryABI = [
  {
    type: 'function',
    name: 'getAgentCouncil',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: 'councilId', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCouncil',
    inputs: [{ name: 'councilId', type: 'bytes32' }],
    outputs: [
      {
        name: 'council',
        type: 'tuple',
        components: [
          { name: 'councilId', type: 'bytes32' },
          { name: 'name', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'vertical', type: 'string' },
          { name: 'memberCount', type: 'uint256' },
          { name: 'quorumPercentage', type: 'uint256' },
          { name: 'claimDepositPercentage', type: 'uint256' },
          { name: 'votingPeriod', type: 'uint256' },
          { name: 'evidencePeriod', type: 'uint256' },
          { name: 'active', type: 'bool' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'closedAt', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'reassignAgentCouncil',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'newCouncilId', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

const ClaimsManagerABI = [
  {
    type: 'function',
    name: 'getPendingClaimCount',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: 'count', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// ============================================================================
// Viem Client
// ============================================================================

function getClient() {
  const chain = CHAIN_ID === 8453 ? base : baseSepolia;
  return createPublicClient({
    chain,
    transport: http(RPC_URL),
  });
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
