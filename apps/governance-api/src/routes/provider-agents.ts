import { Router } from 'express';
import type { Request, Response } from 'express';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { z } from 'zod';
import {
  getAgentMetadata,
  getAgentsByOwner,
  createAgentMetadata,
  updateAgentMetadata,
  agentMetadataExists,
} from '../services/agents.js';

const router = Router();

// ============================================================================
// Configuration
// ============================================================================

const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';

const CONTRACTS = {
  erc8004Registry: '0xb3B4b5042Fd3600404846671Ff5558719860b694',
} as const;

const Erc8004RegistryAbi = [
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const;

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

// ============================================================================
// Validation Schemas
// ============================================================================

const createAgentSchema = z.object({
  agentId: z.string(),
  ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  capabilities: z.array(z.string().max(100)).max(20).optional(),
  websiteUrl: z.string().url().max(500).optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  capabilities: z.array(z.string().max(100)).max(20).optional(),
  websiteUrl: z.string().url().max(500).optional().nullable(),
});

// ============================================================================
// Helper Functions
// ============================================================================

async function verifyOwnership(agentId: string, claimedOwner: string, retries = 3): Promise<boolean> {
  console.log(`Verifying ownership: agent ${agentId}, claimed owner ${claimedOwner}`);
  console.log(`Using RPC: ${RPC_URL}`);
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const owner = await client.readContract({
        address: CONTRACTS.erc8004Registry,
        abi: Erc8004RegistryAbi,
        functionName: 'ownerOf',
        args: [BigInt(agentId)],
      });
      console.log(`Attempt ${attempt + 1}: on-chain owner is ${owner}`);
      
      if (owner.toLowerCase() === claimedOwner.toLowerCase()) {
        return true;
      }
      // Owner doesn't match, but maybe state hasn't propagated yet
      if (attempt < retries - 1) {
        console.log(`Ownership check attempt ${attempt + 1} failed for agent ${agentId}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
      }
    } catch (error) {
      console.log(`Attempt ${attempt + 1} error:`, error);
      // Token might not exist yet, retry
      if (attempt < retries - 1) {
        console.log(`Ownership check attempt ${attempt + 1} errored for agent ${agentId}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  return false;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /provider/agents/:agentId
 * Get agent metadata
 */
router.get('/:agentId', async (req: Request, res: Response) => {
  const { agentId } = req.params;

  try {
    const metadata = await getAgentMetadata(agentId);
    
    if (!metadata) {
      res.status(404).json({ error: 'Agent metadata not found' });
      return;
    }

    res.json(metadata);
  } catch (error) {
    console.error(`Error fetching agent ${agentId}:`, error);
    res.status(500).json({ error: 'Failed to fetch agent metadata' });
  }
});

/**
 * GET /provider/agents/owner/:address
 * Get all agents for an owner
 */
router.get('/owner/:address', async (req: Request, res: Response) => {
  const { address } = req.params;

  try {
    const agents = await getAgentsByOwner(address);
    res.json({ agents });
  } catch (error) {
    console.error(`Error fetching agents for ${address}:`, error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

/**
 * POST /provider/agents
 * Create agent metadata (called after minting)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createAgentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    const { agentId, ownerAddress, name, description, capabilities, websiteUrl } = parsed.data;

    // Verify on-chain ownership
    const isOwner = await verifyOwnership(agentId, ownerAddress);
    if (!isOwner) {
      res.status(403).json({ error: 'Not the owner of this agent' });
      return;
    }

    // Check if metadata already exists
    const exists = await agentMetadataExists(agentId);
    if (exists) {
      res.status(409).json({ error: 'Agent metadata already exists' });
      return;
    }

    const metadata = await createAgentMetadata({
      agentId,
      ownerAddress,
      name,
      description,
      capabilities,
      websiteUrl,
    });

    res.status(201).json(metadata);
  } catch (error) {
    console.error('Error creating agent metadata:', error);
    res.status(500).json({ error: 'Failed to create agent metadata' });
  }
});

/**
 * PUT /provider/agents/:agentId
 * Update agent metadata
 */
router.put('/:agentId', async (req: Request, res: Response) => {
  const { agentId } = req.params;
  console.log(`PUT /provider/agents/${agentId} - body:`, req.body);
  console.log(`PUT /provider/agents/${agentId} - headers:`, {
    'content-type': req.headers['content-type'],
    'x-owner-address': req.headers['x-owner-address'],
    'origin': req.headers['origin'],
  });

  try {
    const parsed = updateAgentSchema.safeParse(req.body);
    if (!parsed.success) {
      console.log('Validation failed:', parsed.error.issues);
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
      return;
    }

    // Get owner from request header (should be signed/authenticated in production)
    const ownerAddress = req.headers['x-owner-address'] as string;
    console.log('x-owner-address header:', ownerAddress);
    if (!ownerAddress || !/^0x[a-fA-F0-9]{40}$/.test(ownerAddress)) {
      res.status(400).json({ error: 'Missing or invalid x-owner-address header' });
      return;
    }

    // Verify on-chain ownership
    console.log('Verifying ownership...');
    const isOwner = await verifyOwnership(agentId, ownerAddress);
    if (!isOwner) {
      console.log(`Ownership verification failed for agent ${agentId}, claimed owner ${ownerAddress}`);
      res.status(403).json({ error: 'Not the owner of this agent' });
      return;
    }
    console.log('Ownership verified');

    const { name, description, capabilities, websiteUrl } = parsed.data;

    // Check if metadata exists, if not create it
    const exists = await agentMetadataExists(agentId);
    let metadata;
    
    if (!exists) {
      console.log(`Agent ${agentId} metadata does not exist, creating...`);
      metadata = await createAgentMetadata({
        agentId,
        ownerAddress,
        name: name || `Agent #${agentId}`,
        description,
        capabilities,
        websiteUrl: websiteUrl === null ? undefined : websiteUrl,
      });
    } else {
      metadata = await updateAgentMetadata(agentId, ownerAddress, {
        name,
        description,
        capabilities,
        websiteUrl: websiteUrl === null ? undefined : websiteUrl,
      });
    }

    if (!metadata) {
      res.status(500).json({ error: 'Failed to save agent metadata' });
      return;
    }

    console.log(`Successfully updated agent ${agentId} metadata`);
    res.json(metadata);
  } catch (error) {
    console.error(`Error updating agent ${agentId}:`, error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to update agent metadata', details: message });
  }
});

export default router;
