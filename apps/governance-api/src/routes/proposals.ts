import { Router } from 'express';
import type { Response } from 'express';
import { encodeFunctionData, keccak256, toHex, type Address } from 'viem';
import type {
  AuthenticatedRequest,
  ProposalResponse,
  VoteChoice,
} from '../types/index.js';
import { requireAuth, requireSafeOwner } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { z } from 'zod';
import {
  createProposal,
  getProposal,
  getProposals,
  getPendingProposals,
  castVote,
  getVote,
  getVotesForProposal,
  checkAndResolveProposal,
  hasPendingProposal,
  updateProposalStatus,
} from '../services/proposals.js';
import { getSafeInfo } from '../services/safe.js';
import { logAuditEvent } from '../services/members.js';
import { notifyAllSigners } from '../services/email.js';
import {
  COUNCIL_REGISTRY_ADDRESS,
  CouncilRegistryAbi as CouncilRegistryABI,
  publicClient,
} from '../config/index.js';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const createCouncilSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1).max(2000),
  vertical: z.string().min(1).max(100),
});

const deleteCouncilSchema = z.object({
  councilId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

const addMemberSchema = z.object({
  councilId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  name: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  email: z.string().email().optional(),
});

const removeMemberSchema = z.object({
  councilId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

const voteSchema = z.object({
  choice: z.enum(['aye', 'nay', 'abstain']),
});

const proposalIdParamSchema = z.object({
  id: z.string().uuid(),
});

// ============================================================================
// Helpers
// ============================================================================

function getClient() {
  return publicClient;
}

function generateCouncilId(): `0x${string}` {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  return toHex(randomBytes) as `0x${string}`;
}

function formatProposalResponse(
  proposal: Awaited<ReturnType<typeof getProposal>>,
  myVote: VoteChoice | null
): ProposalResponse | null {
  if (!proposal) return null;

  return {
    id: proposal.id,
    type: proposal.type,
    status: proposal.status,
    councilName: proposal.council_name,
    councilDescription: proposal.council_description,
    councilVertical: proposal.council_vertical,
    councilId: proposal.council_id,
    memberAddress: proposal.member_address,
    memberName: proposal.member_name,
    proposerAddress: proposal.proposer_address,
    votesAye: proposal.votes_aye,
    votesNay: proposal.votes_nay,
    votesAbstain: proposal.votes_abstain,
    threshold: proposal.threshold,
    expiresAt: proposal.expires_at.toISOString(),
    createdAt: proposal.created_at.toISOString(),
    myVote,
  };
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /proposals
 * List all proposals (optionally filter by status)
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, type, councilId } = req.query;

    const proposals = await getProposals(
      status as string | undefined,
      type as string | undefined,
      councilId as string | undefined
    );

    // Get user's votes for each proposal
    const response: ProposalResponse[] = [];
    for (const proposal of proposals) {
      const vote = await getVote(proposal.id, req.session!.address);
      const formatted = formatProposalResponse(proposal, vote?.choice || null);
      if (formatted) response.push(formatted);
    }

    res.json(response);
  } catch (error) {
    console.error('Failed to fetch proposals:', error);
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});

/**
 * GET /proposals/pending
 * List pending proposals requiring votes
 */
router.get('/pending', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const proposals = await getPendingProposals();

    const response: ProposalResponse[] = [];
    for (const proposal of proposals) {
      const vote = await getVote(proposal.id, req.session!.address);
      const formatted = formatProposalResponse(proposal, vote?.choice || null);
      if (formatted) response.push(formatted);
    }

    res.json(response);
  } catch (error) {
    console.error('Failed to fetch pending proposals:', error);
    res.status(500).json({ error: 'Failed to fetch pending proposals' });
  }
});

/**
 * GET /proposals/:id
 * Get proposal details with votes
 */
router.get(
  '/:id',
  requireAuth,
  validateParams(proposalIdParamSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const proposal = await getProposal(req.params.id);
      if (!proposal) {
        res.status(404).json({ error: 'Proposal not found' });
        return;
      }

      const myVote = await getVote(proposal.id, req.session!.address);
      const allVotes = await getVotesForProposal(proposal.id);

      res.json({
        ...formatProposalResponse(proposal, myVote?.choice || null),
        votes: allVotes.map((v) => ({
          voterAddress: v.voter_address,
          choice: v.choice,
          votedAt: v.created_at.toISOString(),
        })),
      });
    } catch (error) {
      console.error('Failed to fetch proposal:', error);
      res.status(500).json({ error: 'Failed to fetch proposal' });
    }
  }
);

/**
 * POST /proposals/create-council
 * Propose creating a new council
 */
router.post(
  '/create-council',
  requireAuth,
  requireSafeOwner,
  validateBody(createCouncilSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, description, vertical } = req.body;

      // Get Safe threshold for approval requirement
      const safeInfo = await getSafeInfo();

      // Create proposal
      const proposal = await createProposal(
        'create_council',
        req.session!.address,
        safeInfo.threshold,
        {
          councilName: name,
          councilDescription: description,
          councilVertical: vertical,
        }
      );

      // Log audit
      await logAuditEvent(
        'council_created',
        req.session!.address,
        'council',
        proposal.id,
        { name, description, vertical, status: 'proposed' }
      );

      // Notify other signers
      await notifyAllSigners(
        'vote_required',
        {
          action: `Create Council: ${name}`,
          targetName: name,
          proposer: req.session!.address,
          currentVotes: '0',
          requiredVotes: safeInfo.threshold.toString(),
          deadline: proposal.expires_at.toISOString(),
          dashboardUrl: process.env.DASHBOARD_URL || 'https://dashboard.trustful.agents',
        },
        req.session!.address
      );

      const myVote = await getVote(proposal.id, req.session!.address);
      res.status(201).json(formatProposalResponse(proposal, myVote?.choice || null));
    } catch (error) {
      console.error('Failed to create council proposal:', error);
      res.status(500).json({ error: 'Failed to create proposal' });
    }
  }
);

/**
 * POST /proposals/delete-council
 * Propose deleting a council
 */
router.post(
  '/delete-council',
  requireAuth,
  requireSafeOwner,
  validateBody(deleteCouncilSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { councilId } = req.body;
      const client = getClient();

      // Verify council exists and is active
      const council = await client.readContract({
        address: COUNCIL_REGISTRY_ADDRESS,
        abi: CouncilRegistryABI,
        functionName: 'getCouncil',
        args: [councilId as `0x${string}`],
      });

      if (Number(council.createdAt) === 0) {
        res.status(400).json({ error: 'Council does not exist' });
        return;
      }

      if (!council.active) {
        res.status(400).json({ error: 'Council is already closed' });
        return;
      }

      // Check for linked agents
      const agentCount = await client.readContract({
        address: COUNCIL_REGISTRY_ADDRESS,
        abi: CouncilRegistryABI,
        functionName: 'getAgentCountByCouncil',
        args: [councilId as `0x${string}`],
      });

      if (Number(agentCount) > 0) {
        res.status(400).json({
          error: 'Cannot delete council with linked agents',
          agentCount: Number(agentCount),
        });
        return;
      }

      // Check for pending deletion proposal
      const hasPending = await hasPendingProposal('delete_council', councilId);
      if (hasPending) {
        res.status(400).json({ error: 'A deletion proposal is already pending for this council' });
        return;
      }

      // Get Safe threshold
      const safeInfo = await getSafeInfo();

      // Create proposal
      const proposal = await createProposal(
        'delete_council',
        req.session!.address,
        safeInfo.threshold,
        { councilId }
      );

      // Log audit
      await logAuditEvent(
        'council_closed',
        req.session!.address,
        'council',
        councilId,
        { councilName: council.name, status: 'proposed' }
      );

      // Notify signers
      await notifyAllSigners(
        'vote_required',
        {
          action: `Delete Council: ${council.name}`,
          targetName: council.name,
          proposer: req.session!.address,
          currentVotes: '0',
          requiredVotes: safeInfo.threshold.toString(),
          deadline: proposal.expires_at.toISOString(),
          dashboardUrl: process.env.DASHBOARD_URL || 'https://dashboard.trustful.agents',
        },
        req.session!.address
      );

      const myVote = await getVote(proposal.id, req.session!.address);
      res.status(201).json(formatProposalResponse(proposal, myVote?.choice || null));
    } catch (error) {
      console.error('Failed to create delete council proposal:', error);
      res.status(500).json({ error: 'Failed to create proposal' });
    }
  }
);

/**
 * POST /proposals/add-member
 * Propose adding a member to a council
 */
router.post(
  '/add-member',
  requireAuth,
  requireSafeOwner,
  validateBody(addMemberSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { councilId, address, name, description, email } = req.body;
      const client = getClient();

      // Verify council exists and is active
      const council = await client.readContract({
        address: COUNCIL_REGISTRY_ADDRESS,
        abi: CouncilRegistryABI,
        functionName: 'getCouncil',
        args: [councilId as `0x${string}`],
      });

      if (Number(council.createdAt) === 0) {
        res.status(400).json({ error: 'Council does not exist' });
        return;
      }

      if (!council.active) {
        res.status(400).json({ error: 'Council is not active' });
        return;
      }

      // Check for pending add member proposal
      const hasPending = await hasPendingProposal('add_member', councilId, address);
      if (hasPending) {
        res.status(400).json({ error: 'A proposal to add this member is already pending' });
        return;
      }

      // Get Safe threshold
      const safeInfo = await getSafeInfo();

      // Create proposal
      const proposal = await createProposal(
        'add_member',
        req.session!.address,
        safeInfo.threshold,
        {
          councilId,
          memberAddress: address,
          memberName: name,
          memberDescription: description,
          memberEmail: email,
        }
      );

      // Log audit
      await logAuditEvent(
        'member_added',
        req.session!.address,
        'member',
        `${councilId}:${address}`,
        { councilName: council.name, memberName: name, status: 'proposed' }
      );

      // Notify signers
      await notifyAllSigners(
        'vote_required',
        {
          action: `Add Member to ${council.name}`,
          targetName: name || address,
          proposer: req.session!.address,
          currentVotes: '0',
          requiredVotes: safeInfo.threshold.toString(),
          deadline: proposal.expires_at.toISOString(),
          dashboardUrl: process.env.DASHBOARD_URL || 'https://dashboard.trustful.agents',
        },
        req.session!.address
      );

      const myVote = await getVote(proposal.id, req.session!.address);
      res.status(201).json(formatProposalResponse(proposal, myVote?.choice || null));
    } catch (error) {
      console.error('Failed to create add member proposal:', error);
      res.status(500).json({ error: 'Failed to create proposal' });
    }
  }
);

/**
 * POST /proposals/remove-member
 * Propose removing a member from a council
 */
router.post(
  '/remove-member',
  requireAuth,
  requireSafeOwner,
  validateBody(removeMemberSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { councilId, address } = req.body;
      const client = getClient();

      // Verify council exists
      const council = await client.readContract({
        address: COUNCIL_REGISTRY_ADDRESS,
        abi: CouncilRegistryABI,
        functionName: 'getCouncil',
        args: [councilId as `0x${string}`],
      });

      if (Number(council.createdAt) === 0) {
        res.status(400).json({ error: 'Council does not exist' });
        return;
      }

      // Check for pending remove member proposal
      const hasPending = await hasPendingProposal('remove_member', councilId, address);
      if (hasPending) {
        res.status(400).json({ error: 'A proposal to remove this member is already pending' });
        return;
      }

      // Get Safe threshold
      const safeInfo = await getSafeInfo();

      // Create proposal
      const proposal = await createProposal(
        'remove_member',
        req.session!.address,
        safeInfo.threshold,
        {
          councilId,
          memberAddress: address,
        }
      );

      // Log audit
      await logAuditEvent(
        'member_removed',
        req.session!.address,
        'member',
        `${councilId}:${address}`,
        { councilName: council.name, status: 'proposed' }
      );

      // Notify signers
      await notifyAllSigners(
        'vote_required',
        {
          action: `Remove Member from ${council.name}`,
          targetName: address,
          proposer: req.session!.address,
          currentVotes: '0',
          requiredVotes: safeInfo.threshold.toString(),
          deadline: proposal.expires_at.toISOString(),
          dashboardUrl: process.env.DASHBOARD_URL || 'https://dashboard.trustful.agents',
        },
        req.session!.address
      );

      const myVote = await getVote(proposal.id, req.session!.address);
      res.status(201).json(formatProposalResponse(proposal, myVote?.choice || null));
    } catch (error) {
      console.error('Failed to create remove member proposal:', error);
      res.status(500).json({ error: 'Failed to create proposal' });
    }
  }
);

/**
 * POST /proposals/:id/vote
 * Cast a vote on a proposal
 */
router.post(
  '/:id/vote',
  requireAuth,
  requireSafeOwner,
  validateParams(proposalIdParamSchema),
  validateBody(voteSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { choice } = req.body;

      // Get proposal
      const proposal = await getProposal(id);
      if (!proposal) {
        res.status(404).json({ error: 'Proposal not found' });
        return;
      }

      if (proposal.status !== 'pending') {
        res.status(400).json({ error: `Proposal is ${proposal.status}, voting not allowed` });
        return;
      }

      if (new Date(proposal.expires_at) < new Date()) {
        await updateProposalStatus(id, 'expired');
        res.status(400).json({ error: 'Proposal has expired' });
        return;
      }

      // Cast vote
      await castVote(id, req.session!.address, choice);

      // Check if proposal is resolved
      const safeInfo = await getSafeInfo();
      const { resolved, status } = await checkAndResolveProposal(id, safeInfo.owners.length);

      // Get updated proposal
      const updated = await getProposal(id);
      const myVote = await getVote(id, req.session!.address);

      // If approved, prepare Safe transaction data
      let transactionData = null;
      if (status === 'approved' && updated) {
        transactionData = prepareTransactionData(updated);
      }

      res.json({
        proposal: formatProposalResponse(updated, myVote?.choice || null),
        resolved,
        transactionData,
      });
    } catch (error) {
      console.error('Failed to cast vote:', error);
      res.status(500).json({ error: 'Failed to cast vote' });
    }
  }
);

/**
 * GET /proposals/:id/transaction
 * Get Safe transaction data for an approved proposal
 */
router.get(
  '/:id/transaction',
  requireAuth,
  requireSafeOwner,
  validateParams(proposalIdParamSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const proposal = await getProposal(req.params.id);
      if (!proposal) {
        res.status(404).json({ error: 'Proposal not found' });
        return;
      }

      if (proposal.status !== 'approved') {
        res.status(400).json({ error: 'Proposal is not approved' });
        return;
      }

      const transactionData = prepareTransactionData(proposal);
      if (!transactionData) {
        res.status(500).json({ error: 'Failed to prepare transaction data' });
        return;
      }

      res.json({
        proposalId: proposal.id,
        transactionData,
        safeAppUrl: `https://app.safe.global/transactions/queue?safe=base-sep:${process.env.SAFE_ADDRESS}`,
      });
    } catch (error) {
      console.error('Failed to get transaction data:', error);
      res.status(500).json({ error: 'Failed to get transaction data' });
    }
  }
);

/**
 * POST /proposals/:id/execute
 * Mark a proposal as executed (after Safe TX is confirmed)
 */
router.post(
  '/:id/execute',
  requireAuth,
  requireSafeOwner,
  validateParams(proposalIdParamSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { safeTxHash } = req.body;
      const proposal = await getProposal(req.params.id);

      if (!proposal) {
        res.status(404).json({ error: 'Proposal not found' });
        return;
      }

      if (proposal.status !== 'approved') {
        res.status(400).json({ error: 'Proposal must be approved before execution' });
        return;
      }

      await updateProposalStatus(proposal.id, 'executed', safeTxHash);

      res.json({ success: true, message: 'Proposal marked as executed' });
    } catch (error) {
      console.error('Failed to mark proposal as executed:', error);
      res.status(500).json({ error: 'Failed to mark proposal as executed' });
    }
  }
);

// ============================================================================
// Transaction Data Preparation
// ============================================================================

function prepareTransactionData(proposal: NonNullable<Awaited<ReturnType<typeof getProposal>>>) {
  switch (proposal.type) {
    case 'create_council': {
      const data = encodeFunctionData({
        abi: CouncilRegistryABI,
        functionName: 'createCouncil',
        args: [
          proposal.council_name || '',
          proposal.council_description || '',
          proposal.council_vertical || '',
          BigInt(51), // 51% quorum
          BigInt(10), // 10% claim deposit
          BigInt(7 * 24 * 60 * 60), // 7 days voting period
          BigInt(3 * 24 * 60 * 60), // 3 days evidence period
        ],
      });
      return {
        to: COUNCIL_REGISTRY_ADDRESS,
        data,
        value: '0',
        description: `Create Council: ${proposal.council_name}`,
      };
    }

    case 'delete_council': {
      const data = encodeFunctionData({
        abi: CouncilRegistryABI,
        functionName: 'closeCouncil',
        args: [proposal.council_id as `0x${string}`],
      });
      return {
        to: COUNCIL_REGISTRY_ADDRESS,
        data,
        value: '0',
        description: `Delete Council`,
      };
    }

    case 'add_member': {
      const data = encodeFunctionData({
        abi: CouncilRegistryABI,
        functionName: 'addMember',
        args: [
          proposal.council_id as `0x${string}`,
          proposal.member_address as `0x${string}`,
        ],
      });
      return {
        to: COUNCIL_REGISTRY_ADDRESS,
        data,
        value: '0',
        description: `Add Member: ${proposal.member_name || proposal.member_address}`,
      };
    }

    case 'remove_member': {
      const data = encodeFunctionData({
        abi: CouncilRegistryABI,
        functionName: 'removeMember',
        args: [
          proposal.council_id as `0x${string}`,
          proposal.member_address as `0x${string}`,
        ],
      });
      return {
        to: COUNCIL_REGISTRY_ADDRESS,
        data,
        value: '0',
        description: `Remove Member: ${proposal.member_address}`,
      };
    }

    default:
      return null;
  }
}

export default router;
