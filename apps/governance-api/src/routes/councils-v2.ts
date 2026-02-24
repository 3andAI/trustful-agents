import { Router } from 'express';
import type { Response } from 'express';
import type { Hex, Address } from 'viem';
import type { AuthenticatedRequest } from '../types/index.js';
import { requireAuth, requireSafeOwner } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { z } from 'zod';
import {
  getAllCouncils,
  getCouncil,
  getCouncilMembers,
  getMember,
  canCloseCouncil,
  type OnChainCouncil,
} from '../services/blockchain.js';
import {
  generateCreateCouncilTxData,
  generateCloseCouncilTxData,
  generateAddMemberTxData,
  generateRemoveMemberTxData,
  getSafeNewTransactionUrl,
  type CreateCouncilParams,
} from '../services/safeTx.js';
import { queryOne, queryMany } from '../db/index.js';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const councilIdSchema = z.object({
  councilId: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid council ID format'),
});

const createCouncilSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional().default(''),
  vertical: z.string().min(2).max(50),
  quorumPercentage: z.number().min(1000).max(10000).default(5000), // 10% to 100%
  claimDepositPercentage: z.number().min(100).max(5000).default(1000), // 1% to 50%
  votingPeriodDays: z.number().min(1).max(30).default(7),
  evidencePeriodDays: z.number().min(1).max(14).default(3),
});

const addMemberSchema = z.object({
  memberAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address'),
  name: z.string().max(100).optional(),
  email: z.string().email().optional(),
  description: z.string().max(500).optional(),
});

const removeMemberSchema = z.object({
  memberAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address'),
});

// ============================================================================
// Types
// ============================================================================

interface CouncilMetadata {
  council_id: string;
  display_name?: string;
  notes?: string;
}

interface MemberMetadata {
  address: string;
  council_id: string;
  name?: string;
  email?: string;
  description?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCouncil(council: OnChainCouncil, metadata?: CouncilMetadata | null) {
  return {
    councilId: council.councilId,
    name: council.name,
    description: council.description,
    vertical: council.vertical,
    memberCount: Number(council.memberCount),
    quorumPercentage: Number(council.quorumPercentage),
    claimDepositPercentage: Number(council.claimDepositPercentage),
    votingPeriod: Number(council.votingPeriod),
    evidencePeriod: Number(council.evidencePeriod),
    active: council.active,
    createdAt: new Date(Number(council.createdAt) * 1000).toISOString(),
    closedAt: council.closedAt > 0n 
      ? new Date(Number(council.closedAt) * 1000).toISOString() 
      : null,
    // Metadata from database
    displayName: metadata?.display_name,
    notes: metadata?.notes,
  };
}

async function getCouncilMetadata(councilId: string): Promise<CouncilMetadata | null> {
  try {
    return await queryOne<CouncilMetadata>(
      'SELECT * FROM council_metadata WHERE council_id = $1',
      [councilId]
    );
  } catch {
    // Table might not exist yet
    return null;
  }
}

async function getMemberMetadata(councilId: string, address: string): Promise<MemberMetadata | null> {
  return queryOne<MemberMetadata>(
    'SELECT * FROM council_members WHERE council_id = $1 AND LOWER(address) = LOWER($2)',
    [councilId, address]
  );
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /councils
 * List all active councils from blockchain
 */
router.get('/', async (_req, res: Response) => {
  try {
    const councils = await getAllCouncils();
    
    // Get metadata for each council
    const formattedCouncils = await Promise.all(
      councils.map(async (council) => {
        const metadata = await getCouncilMetadata(council.councilId);
        return formatCouncil(council, metadata);
      })
    );

    res.json({
      councils: formattedCouncils,
      count: formattedCouncils.length,
    });
  } catch (error) {
    console.error('Failed to fetch councils:', error);
    res.status(500).json({ error: 'Failed to fetch councils' });
  }
});

/**
 * GET /councils/:councilId
 * Get single council details from blockchain
 */
router.get(
  '/:councilId',
  validateParams(councilIdSchema),
  async (req, res: Response) => {
    try {
      const { councilId } = req.params;
      const council = await getCouncil(councilId as Hex);

      if (!council || council.councilId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        res.status(404).json({ error: 'Council not found' });
        return;
      }

      const metadata = await getCouncilMetadata(councilId);
      res.json(formatCouncil(council, metadata));
    } catch (error) {
      console.error('Failed to fetch council:', error);
      res.status(500).json({ error: 'Failed to fetch council' });
    }
  }
);

/**
 * GET /councils/:councilId/members
 * Get council members from blockchain + database metadata
 */
router.get(
  '/:councilId/members',
  validateParams(councilIdSchema),
  async (req, res: Response) => {
    try {
      const { councilId } = req.params;
      
      // Get member addresses from chain
      const memberAddresses = await getCouncilMembers(councilId as Hex);
      
      // Get on-chain member details and database metadata
      const members = await Promise.all(
        memberAddresses.map(async (address) => {
          const onChainMember = await getMember(councilId as Hex, address);
          const metadata = await getMemberMetadata(councilId, address);
          
          return {
            address,
            councilId,
            joinedAt: onChainMember 
              ? new Date(Number(onChainMember.joinedAt) * 1000).toISOString()
              : null,
            claimsVoted: onChainMember ? Number(onChainMember.claimsVoted) : 0,
            active: onChainMember?.active ?? true,
            // Database metadata
            name: metadata?.name ?? null,
            email: metadata?.email ?? null,
            description: metadata?.description ?? null,
          };
        })
      );

      res.json({
        members,
        count: members.length,
      });
    } catch (error) {
      console.error('Failed to fetch council members:', error);
      res.status(500).json({ error: 'Failed to fetch council members' });
    }
  }
);

/**
 * GET /councils/:councilId/agents
 * Get agents assigned to this council
 */
router.get(
  '/:councilId/agents',
  validateParams(councilIdSchema),
  async (req, res: Response) => {
    try {
      const { councilId } = req.params;
      
      console.log(`Fetching agents for council ${councilId}`);
      
      // Import viem client
      const { createPublicClient, http } = await import('viem');
      
      // Use chain from centralized config
      const { chain: configChain } = await import('../config/index.js');
      const { RPC_URL: configRpcUrl } = await import('../config/index.js');
      
      const client = createPublicClient({
        chain: configChain,
        transport: http(configRpcUrl),
      });
      
      // Contract addresses from centralized config
      const { CONTRACTS } = await import('../config/index.js');
      const TERMS_REGISTRY = CONTRACTS.termsRegistry as Address;
      const COUNCIL_REGISTRY = CONTRACTS.councilRegistry as Address;
      
      const TermsRegistryABI = [
        {
          type: 'function',
          name: 'getActiveTerms',
          inputs: [{ name: 'agentId', type: 'uint256' }],
          outputs: [
            {
              name: 'terms',
              type: 'tuple',
              components: [
                { name: 'contentHash', type: 'bytes32' },
                { name: 'contentUri', type: 'string' },
                { name: 'councilId', type: 'bytes32' },
                { name: 'registeredAt', type: 'uint256' },
                { name: 'active', type: 'bool' },
              ],
            },
            { name: 'version', type: 'uint256' },
          ],
          stateMutability: 'view',
        },
      ] as const;
      
      // CouncilRegistry ABI for checking governance overrides
      const CouncilRegistryAgentABI = [
        {
          type: 'function',
          name: 'getAgentCouncil',
          inputs: [{ name: 'agentId', type: 'uint256' }],
          outputs: [{ name: 'councilId', type: 'bytes32' }],
          stateMutability: 'view',
        },
      ] as const;
      
      // Get all agents from database
      const allAgents = await queryMany<{ agent_id: string; name: string; description: string | null; owner_address: string }>(
        'SELECT agent_id, name, description, owner_address FROM agents ORDER BY agent_id::integer ASC'
      );
      
      console.log(`Found ${allAgents.length} agents in database`);
      
      // Check each agent's council assignment
      const assignedAgents: Array<{
        agentId: string;
        name: string;
        description: string | null;
        ownerAddress: string;
      }> = [];
      
      for (const agent of allAgents) {
        try {
          // First check for governance override in CouncilRegistry
          let effectiveCouncilId: string | null = null;
          
          try {
            const overrideCouncilId = await client.readContract({
              address: COUNCIL_REGISTRY,
              abi: CouncilRegistryAgentABI,
              functionName: 'getAgentCouncil',
              args: [BigInt(agent.agent_id)],
            });
            
            // If override is set (not zero), use it
            if (overrideCouncilId && overrideCouncilId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
              effectiveCouncilId = overrideCouncilId;
              console.log(`Agent ${agent.agent_id}: using governance override council ${effectiveCouncilId}`);
            }
          } catch {
            // No override, continue to check TermsRegistry
          }
          
          // If no override, check TermsRegistry
          if (!effectiveCouncilId) {
            try {
              const result = await client.readContract({
                address: TERMS_REGISTRY,
                abi: TermsRegistryABI,
                functionName: 'getActiveTerms',
                args: [BigInt(agent.agent_id)],
              });
              
              const terms = result[0];
              if (terms.active) {
                effectiveCouncilId = terms.councilId;
              }
            } catch {
              // No terms registered
            }
          }
          
          // Check if this agent belongs to the requested council
          if (effectiveCouncilId && effectiveCouncilId.toLowerCase() === councilId.toLowerCase()) {
            assignedAgents.push({
              agentId: agent.agent_id,
              name: agent.name,
              description: agent.description,
              ownerAddress: agent.owner_address,
            });
          }
        } catch {
          // Skip agent on error
        }
      }
      
      console.log(`Found ${assignedAgents.length} agents for council ${councilId}`);
      
      res.json({
        councilId,
        agents: assignedAgents,
        count: assignedAgents.length,
      });
    } catch (error) {
      console.error('Failed to fetch council agents:', error);
      res.status(500).json({ error: 'Failed to fetch council agents' });
    }
  }
);

/**
 * GET /councils/:councilId/can-close
 * Check if council can be closed
 */
router.get(
  '/:councilId/can-close',
  validateParams(councilIdSchema),
  async (req, res: Response) => {
    try {
      const { councilId } = req.params;
      const result = await canCloseCouncil(councilId as Hex);
      res.json(result);
    } catch (error) {
      console.error('Failed to check if council can close:', error);
      res.status(500).json({ error: 'Failed to check' });
    }
  }
);

// ============================================================================
// Transaction Generation Routes (require auth)
// ============================================================================

/**
 * POST /councils/propose-create
 * Generate transaction data for creating a council
 * Returns data to be signed in Safe UI
 */
router.post(
  '/propose-create',
  requireAuth,
  requireSafeOwner,
  validateBody(createCouncilSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const params: CreateCouncilParams = {
        name: req.body.name,
        description: req.body.description || '',
        vertical: req.body.vertical,
        quorumPercentage: req.body.quorumPercentage,
        claimDepositPercentage: req.body.claimDepositPercentage,
        votingPeriodDays: req.body.votingPeriodDays,
        evidencePeriodDays: req.body.evidencePeriodDays,
      };

      const txData = generateCreateCouncilTxData(params);
      const safeUrl = getSafeNewTransactionUrl();

      res.json({
        transaction: txData,
        safeUrl,
        message: 'Copy the transaction data and create a new transaction in Safe',
      });
    } catch (error) {
      console.error('Failed to generate create council transaction:', error);
      res.status(500).json({ error: 'Failed to generate transaction' });
    }
  }
);

/**
 * POST /councils/:councilId/propose-close
 * Generate transaction data for closing a council
 */
router.post(
  '/:councilId/propose-close',
  requireAuth,
  requireSafeOwner,
  validateParams(councilIdSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { councilId } = req.params;
      
      // Check if council can be closed
      const canClose = await canCloseCouncil(councilId as Hex);
      if (!canClose.canClose) {
        res.status(400).json({ 
          error: 'Council cannot be closed',
          reason: canClose.reason,
        });
        return;
      }

      // Get council name
      const council = await getCouncil(councilId as Hex);
      const councilName = council?.name ?? 'Unknown';

      const txData = generateCloseCouncilTxData(councilId as Hex, councilName);
      const safeUrl = getSafeNewTransactionUrl();

      res.json({
        transaction: txData,
        safeUrl,
        message: 'Copy the transaction data and create a new transaction in Safe',
      });
    } catch (error) {
      console.error('Failed to generate close council transaction:', error);
      res.status(500).json({ error: 'Failed to generate transaction' });
    }
  }
);

/**
 * POST /councils/:councilId/propose-add-member
 * Generate transaction data for adding a member
 */
router.post(
  '/:councilId/propose-add-member',
  requireAuth,
  requireSafeOwner,
  validateParams(councilIdSchema),
  validateBody(addMemberSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { councilId } = req.params;
      const { memberAddress, name, email, description } = req.body;

      // Get council name
      const council = await getCouncil(councilId as Hex);
      if (!council) {
        res.status(404).json({ error: 'Council not found' });
        return;
      }

      // Store member metadata in database (will be associated after on-chain TX)
      if (name || email || description) {
        await queryOne(
          `INSERT INTO council_members (address, council_id, name, email, description)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (address, council_id) DO UPDATE SET
             name = COALESCE($3, council_members.name),
             email = COALESCE($4, council_members.email),
             description = COALESCE($5, council_members.description)
           RETURNING *`,
          [memberAddress.toLowerCase(), councilId, name ?? null, email ?? null, description ?? null]
        );
      }

      const txData = generateAddMemberTxData(
        councilId as Hex,
        council.name,
        memberAddress as Address
      );
      const safeUrl = getSafeNewTransactionUrl();

      res.json({
        transaction: txData,
        safeUrl,
        memberMetadata: { name, email, description },
        message: 'Copy the transaction data and create a new transaction in Safe',
      });
    } catch (error) {
      console.error('Failed to generate add member transaction:', error);
      res.status(500).json({ error: 'Failed to generate transaction' });
    }
  }
);

/**
 * POST /councils/:councilId/propose-remove-member
 * Generate transaction data for removing a member
 */
router.post(
  '/:councilId/propose-remove-member',
  requireAuth,
  requireSafeOwner,
  validateParams(councilIdSchema),
  validateBody(removeMemberSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { councilId } = req.params;
      const { memberAddress } = req.body;

      // Get council name
      const council = await getCouncil(councilId as Hex);
      if (!council) {
        res.status(404).json({ error: 'Council not found' });
        return;
      }

      const txData = generateRemoveMemberTxData(
        councilId as Hex,
        council.name,
        memberAddress as Address
      );
      const safeUrl = getSafeNewTransactionUrl();

      res.json({
        transaction: txData,
        safeUrl,
        message: 'Copy the transaction data and create a new transaction in Safe',
      });
    } catch (error) {
      console.error('Failed to generate remove member transaction:', error);
      res.status(500).json({ error: 'Failed to generate transaction' });
    }
  }
);

/**
 * PUT /councils/:councilId/members/:memberAddress/metadata
 * Update member metadata in database (not on-chain)
 */
router.put(
  '/:councilId/members/:memberAddress/metadata',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { councilId, memberAddress } = req.params;
      const { name, email, description } = req.body;

      const result = await queryOne<MemberMetadata>(
        `INSERT INTO council_members (address, council_id, name, email, description)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (address, council_id) DO UPDATE SET
           name = COALESCE($3, council_members.name),
           email = COALESCE($4, council_members.email),
           description = COALESCE($5, council_members.description)
         RETURNING *`,
        [memberAddress.toLowerCase(), councilId, name ?? null, email ?? null, description ?? null]
      );

      res.json(result);
    } catch (error) {
      console.error('Failed to update member metadata:', error);
      res.status(500).json({ error: 'Failed to update member metadata' });
    }
  }
);

export default router;
