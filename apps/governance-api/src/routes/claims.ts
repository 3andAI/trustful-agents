// Claims Routes - Extension for governance-api
// Add this file to governance-api/src/routes/claims.ts
// Then add to index.ts: import claimsRoutes from './routes/claims.js';
// And: app.use('/claims', claimsRoutes);

import { Router, Request, Response } from 'express';
import { publicClient, CHAIN_ID, RPC_URL } from '../services/blockchain.js';
import { db } from '../db/index.js';
import { type Address, type Hex, encodeFunctionData, parseAbi } from 'viem';

const router = Router();

// ============================================================================
// Contract Configuration
// ============================================================================

const CLAIMS_MANAGER_ADDRESS = process.env.CLAIMS_MANAGER_ADDRESS as Address;
const COUNCIL_REGISTRY_ADDRESS = process.env.COUNCIL_REGISTRY_ADDRESS as Address;
const RULING_EXECUTOR_ADDRESS = process.env.RULING_EXECUTOR_ADDRESS as Address;

// ============================================================================
// ABI Definitions
// ============================================================================

const claimsManagerABI = parseAbi([
  // View functions (v1.3 - evidenceHash and evidenceUri removed from Claim struct)
  'function getClaim(uint256 claimId) view returns ((uint256 claimId, uint256 agentId, address claimant, uint256 claimedAmount, uint256 approvedAmount, bytes32 paymentReceiptHash, bytes32 termsHashAtClaimTime, uint256 termsVersionAtClaimTime, address providerAtClaimTime, bytes32 councilId, uint256 claimantDeposit, uint256 lockedCollateral, uint8 status, uint256 filedAt, uint256 evidenceDeadline, uint256 votingDeadline, bool hadVotes))',
  'function getClaimsByCouncil(bytes32 councilId) view returns (uint256[])',
  'function getPendingClaimsByCouncil(bytes32 councilId) view returns (uint256[])',
  'function getClaimsByClaimant(address claimant) view returns (uint256[])',
  'function getClaimsByAgent(uint256 agentId) view returns (uint256[])',
  'function getVotingProgress(uint256 claimId) view returns ((uint256 approveVotes, uint256 rejectVotes, uint256 abstainVotes, uint256 totalVotes, uint256 requiredQuorum, uint256 deadline, bool quorumReached))',
  'function getVotes(uint256 claimId) view returns ((address voter, uint8 vote, uint256 approvedAmount, string reasoning, uint256 votedAt, uint256 lastChangedAt)[])',
  'function getVote(uint256 claimId, address voter) view returns ((address voter, uint8 vote, uint256 approvedAmount, string reasoning, uint256 votedAt, uint256 lastChangedAt))',
  'function hasVoted(uint256 claimId, address voter) view returns (bool)',
  'function getVotersForClaim(uint256 claimId) view returns (address[])',
  'function calculateRequiredDeposit(uint256 agentId, uint256 claimedAmount) view returns (uint256)',
  'function nextClaimId() view returns (uint256)',
  'function getClaimStats(uint256 agentId) view returns ((uint256 totalClaims, uint256 approvedClaims, uint256 rejectedClaims, uint256 pendingClaims, uint256 expiredClaims, uint256 totalPaidOut))',
  'function calculateMedianApprovedAmount(uint256 claimId) view returns (uint256)',
  // Write functions (v1.3 - fileClaim only takes 3 params, submitAdditionalEvidence removed)
  'function fileClaim(uint256 agentId, uint256 claimedAmount, bytes32 paymentReceiptHash) returns (uint256)',
  'function castVote(uint256 claimId, uint8 vote, uint256 approvedAmount, string reasoning)',
  'function changeVote(uint256 claimId, uint8 vote, uint256 approvedAmount, string reasoning)',
  'function finalizeClaim(uint256 claimId)',
  'function cancelClaim(uint256 claimId)',
]);

const councilRegistryABI = parseAbi([
  'function isActiveMember(bytes32 councilId, address member) view returns (bool)',
  'function getCouncilMembers(bytes32 councilId) view returns (address[])',
  'function getCouncil(bytes32 councilId) view returns ((bytes32 councilId, string name, string description, string vertical, uint256 memberCount, uint256 quorumPercentage, uint256 claimDepositPercentage, uint256 votingPeriod, uint256 evidencePeriod, bool active, uint256 createdAt, uint256 closedAt))',
]);

const rulingExecutorABI = parseAbi([
  'function executeClaim(uint256 claimId)',
  'function executeApprovedClaim(uint256 claimId)',
  'function executeRejectedClaim(uint256 claimId)',
  'function executeExpiredClaim(uint256 claimId)',
  'function executeCancelledClaim(uint256 claimId)',
]);

// ============================================================================
// Types
// ============================================================================

enum ClaimStatus {
  Filed = 0,
  EvidenceClosed = 1,
  VotingClosed = 2,
  Approved = 3,
  Rejected = 4,
  Executed = 5,
  Cancelled = 6,
  Expired = 7,
}

enum Vote {
  None = 0,
  Approve = 1,
  Reject = 2,
  Abstain = 3,
}

interface ClaimResponse {
  claimId: string;
  agentId: string;
  claimant: string;
  claimedAmount: string;
  approvedAmount: string;
  // v1.3: evidenceHash and evidenceUri removed (now in DB messages)
  paymentReceiptHash: string;
  termsHashAtClaimTime: string;
  termsVersionAtClaimTime: string;
  providerAtClaimTime: string;
  councilId: string;
  claimantDeposit: string;
  lockedCollateral: string;
  status: string;
  statusCode: number;
  filedAt: string;
  evidenceDeadline: string;
  votingDeadline: string;
  hadVotes: boolean;
  // Computed fields
  isInEvidencePeriod: boolean;
  isInVotingPeriod: boolean;
  canVote: boolean;
  canFinalize: boolean;
}

interface VoteResponse {
  voter: string;
  vote: string;
  voteCode: number;
  approvedAmount: string;
  reasoning: string;
  votedAt: string;
  lastChangedAt: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

function statusToString(status: number): string {
  const statuses = ['Filed', 'EvidenceClosed', 'VotingClosed', 'Approved', 'Rejected', 'Executed', 'Cancelled', 'Expired'];
  return statuses[status] || 'Unknown';
}

function voteToString(vote: number): string {
  const votes = ['None', 'Approve', 'Reject', 'Abstain'];
  return votes[vote] || 'Unknown';
}

function formatClaim(claim: any): ClaimResponse {
  const now = Math.floor(Date.now() / 1000);
  const evidenceDeadline = Number(claim.evidenceDeadline);
  const votingDeadline = Number(claim.votingDeadline);
  const status = Number(claim.status);
  
  return {
    claimId: claim.claimId.toString(),
    agentId: claim.agentId.toString(),
    claimant: claim.claimant,
    claimedAmount: claim.claimedAmount.toString(),
    approvedAmount: claim.approvedAmount.toString(),
    // v1.3: evidenceHash and evidenceUri removed
    paymentReceiptHash: claim.paymentReceiptHash,
    termsHashAtClaimTime: claim.termsHashAtClaimTime,
    termsVersionAtClaimTime: claim.termsVersionAtClaimTime.toString(),
    providerAtClaimTime: claim.providerAtClaimTime,
    councilId: claim.councilId,
    claimantDeposit: claim.claimantDeposit.toString(),
    lockedCollateral: claim.lockedCollateral.toString(),
    status: statusToString(status),
    statusCode: status,
    filedAt: new Date(Number(claim.filedAt) * 1000).toISOString(),
    evidenceDeadline: new Date(evidenceDeadline * 1000).toISOString(),
    votingDeadline: new Date(votingDeadline * 1000).toISOString(),
    hadVotes: claim.hadVotes,
    // Computed fields
    isInEvidencePeriod: now < evidenceDeadline && status === ClaimStatus.Filed,
    isInVotingPeriod: now >= evidenceDeadline && now < votingDeadline && (status === ClaimStatus.Filed || status === ClaimStatus.EvidenceClosed),
    canVote: now >= evidenceDeadline && now < votingDeadline && (status === ClaimStatus.Filed || status === ClaimStatus.EvidenceClosed),
    // canFinalize is true when:
    // 1. Voting period ended and claim needs finalization (status Filed/EvidenceClosed/VotingClosed)
    // 2. OR claim is finalized but needs execution (status Approved/Rejected/Cancelled/Expired)
    canFinalize: status !== ClaimStatus.Executed && (
      (now >= votingDeadline && status <= ClaimStatus.VotingClosed) ||
      status === ClaimStatus.Approved ||
      status === ClaimStatus.Rejected ||
      status === ClaimStatus.Cancelled ||
      status === ClaimStatus.Expired
    ),
  };
}

function formatVote(vote: any): VoteResponse {
  return {
    voter: vote.voter,
    vote: voteToString(Number(vote.vote)),
    voteCode: Number(vote.vote),
    approvedAmount: vote.approvedAmount.toString(),
    reasoning: vote.reasoning,
    votedAt: new Date(Number(vote.votedAt) * 1000).toISOString(),
    lastChangedAt: Number(vote.lastChangedAt) > 0 ? new Date(Number(vote.lastChangedAt) * 1000).toISOString() : null,
  };
}

// ============================================================================
// Routes
// ============================================================================

// GET /claims - List claims with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { councilId, status, claimant, agentId, pending } = req.query;
    
    if (!CLAIMS_MANAGER_ADDRESS) {
      return res.status(500).json({ error: 'CLAIMS_MANAGER_ADDRESS not configured' });
    }
    
    let claimIds: bigint[] = [];
    
    if (councilId) {
      if (pending === 'true') {
        claimIds = await publicClient.readContract({
          address: CLAIMS_MANAGER_ADDRESS,
          abi: claimsManagerABI,
          functionName: 'getPendingClaimsByCouncil',
          args: [councilId as Hex],
        }) as bigint[];
      } else {
        claimIds = await publicClient.readContract({
          address: CLAIMS_MANAGER_ADDRESS,
          abi: claimsManagerABI,
          functionName: 'getClaimsByCouncil',
          args: [councilId as Hex],
        }) as bigint[];
      }
    } else if (claimant) {
      claimIds = await publicClient.readContract({
        address: CLAIMS_MANAGER_ADDRESS,
        abi: claimsManagerABI,
        functionName: 'getClaimsByClaimant',
        args: [claimant as Address],
      }) as bigint[];
    } else if (agentId) {
      claimIds = await publicClient.readContract({
        address: CLAIMS_MANAGER_ADDRESS,
        abi: claimsManagerABI,
        functionName: 'getClaimsByAgent',
        args: [BigInt(agentId as string)],
      }) as bigint[];
    } else {
      // Get total claims and fetch recent ones
      const nextId = await publicClient.readContract({
        address: CLAIMS_MANAGER_ADDRESS,
        abi: claimsManagerABI,
        functionName: 'nextClaimId',
      }) as bigint;
      
      // Get last 50 claims max
      const start = nextId > 50n ? nextId - 50n : 0n;
      for (let i = start; i < nextId; i++) {
        claimIds.push(i);
      }
    }
    
    // Fetch claim details
    const claims: ClaimResponse[] = [];
    for (const claimId of claimIds) {
      try {
        const claim = await publicClient.readContract({
          address: CLAIMS_MANAGER_ADDRESS,
          abi: claimsManagerABI,
          functionName: 'getClaim',
          args: [claimId],
        });
        
        const formatted = formatClaim(claim);
        
        // Apply status filter if provided
        if (status && formatted.status.toLowerCase() !== (status as string).toLowerCase()) {
          continue;
        }
        
        claims.push(formatted);
      } catch (error) {
        console.warn(`Failed to fetch claim ${claimId}:`, error);
      }
    }
    
    // Sort by filed date descending (newest first)
    claims.sort((a, b) => new Date(b.filedAt).getTime() - new Date(a.filedAt).getTime());
    
    res.json({ claims, count: claims.length });
  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

// GET /claims/:claimId - Get claim details
router.get('/:claimId', async (req: Request, res: Response) => {
  try {
    const { claimId } = req.params;
    
    if (!CLAIMS_MANAGER_ADDRESS) {
      return res.status(500).json({ error: 'CLAIMS_MANAGER_ADDRESS not configured' });
    }
    
    const claim = await publicClient.readContract({
      address: CLAIMS_MANAGER_ADDRESS,
      abi: claimsManagerABI,
      functionName: 'getClaim',
      args: [BigInt(claimId)],
    });
    
    const formatted = formatClaim(claim);
    
    // Get voting progress
    const progress = await publicClient.readContract({
      address: CLAIMS_MANAGER_ADDRESS,
      abi: claimsManagerABI,
      functionName: 'getVotingProgress',
      args: [BigInt(claimId)],
    }) as any;
    
    // Get council info for context
    let councilName = '';
    try {
      const council = await publicClient.readContract({
        address: COUNCIL_REGISTRY_ADDRESS,
        abi: councilRegistryABI,
        functionName: 'getCouncil',
        args: [formatted.councilId as Hex],
      }) as any;
      councilName = council.name;
    } catch {}
    
    res.json({
      ...formatted,
      councilName,
      votingProgress: {
        approveVotes: progress.approveVotes.toString(),
        rejectVotes: progress.rejectVotes.toString(),
        abstainVotes: progress.abstainVotes.toString(),
        totalVotes: progress.totalVotes.toString(),
        requiredQuorum: progress.requiredQuorum.toString(),
        deadline: new Date(Number(progress.deadline) * 1000).toISOString(),
        quorumReached: progress.quorumReached,
      },
    });
  } catch (error) {
    console.error('Error fetching claim:', error);
    res.status(500).json({ error: 'Failed to fetch claim' });
  }
});

// GET /claims/:claimId/votes - Get all votes for a claim
router.get('/:claimId/votes', async (req: Request, res: Response) => {
  try {
    const { claimId } = req.params;
    
    if (!CLAIMS_MANAGER_ADDRESS) {
      return res.status(500).json({ error: 'CLAIMS_MANAGER_ADDRESS not configured' });
    }
    
    const votes = await publicClient.readContract({
      address: CLAIMS_MANAGER_ADDRESS,
      abi: claimsManagerABI,
      functionName: 'getVotes',
      args: [BigInt(claimId)],
    }) as any[];
    
    const formattedVotes = votes.map(formatVote);
    
    res.json({ votes: formattedVotes, count: formattedVotes.length });
  } catch (error) {
    console.error('Error fetching votes:', error);
    res.status(500).json({ error: 'Failed to fetch votes' });
  }
});

// GET /claims/:claimId/my-vote - Check if address has voted
router.get('/:claimId/my-vote', async (req: Request, res: Response) => {
  try {
    const { claimId } = req.params;
    const { address } = req.query;
    
    if (!address) {
      return res.status(400).json({ error: 'address query parameter required' });
    }
    
    if (!CLAIMS_MANAGER_ADDRESS) {
      return res.status(500).json({ error: 'CLAIMS_MANAGER_ADDRESS not configured' });
    }
    
    const hasVoted = await publicClient.readContract({
      address: CLAIMS_MANAGER_ADDRESS,
      abi: claimsManagerABI,
      functionName: 'hasVoted',
      args: [BigInt(claimId), address as Address],
    }) as boolean;
    
    if (!hasVoted) {
      return res.json({ hasVoted: false, vote: null });
    }
    
    const vote = await publicClient.readContract({
      address: CLAIMS_MANAGER_ADDRESS,
      abi: claimsManagerABI,
      functionName: 'getVote',
      args: [BigInt(claimId), address as Address],
    });
    
    res.json({ hasVoted: true, vote: formatVote(vote) });
  } catch (error) {
    console.error('Error fetching my vote:', error);
    res.status(500).json({ error: 'Failed to fetch vote' });
  }
});

// POST /claims/:claimId/vote - Get transaction data for voting
router.post('/:claimId/vote', async (req: Request, res: Response) => {
  try {
    const { claimId } = req.params;
    const { vote, approvedAmount, reasoning, voterAddress } = req.body;
    
    if (vote === undefined || voterAddress === undefined) {
      return res.status(400).json({ error: 'vote and voterAddress are required' });
    }
    
    if (!CLAIMS_MANAGER_ADDRESS) {
      return res.status(500).json({ error: 'CLAIMS_MANAGER_ADDRESS not configured' });
    }
    
    // Check if already voted
    const hasVoted = await publicClient.readContract({
      address: CLAIMS_MANAGER_ADDRESS,
      abi: claimsManagerABI,
      functionName: 'hasVoted',
      args: [BigInt(claimId), voterAddress as Address],
    }) as boolean;
    
    // Encode the appropriate function
    const functionName = hasVoted ? 'changeVote' : 'castVote';
    const data = encodeFunctionData({
      abi: claimsManagerABI,
      functionName,
      args: [
        BigInt(claimId),
        vote,
        BigInt(approvedAmount || '0'),
        reasoning || '',
      ],
    });
    
    res.json({
      transaction: {
        to: CLAIMS_MANAGER_ADDRESS,
        data,
        value: '0',
      },
      isChangeVote: hasVoted,
      message: hasVoted ? 'Transaction to change your vote' : 'Transaction to cast your vote',
    });
  } catch (error) {
    console.error('Error preparing vote transaction:', error);
    res.status(500).json({ error: 'Failed to prepare vote transaction' });
  }
});

// POST /claims/:claimId/finalize - Get transaction data for finalization
// This endpoint is SMART: it returns the correct transaction based on claim status
// - If claim needs finalization (Filed/EvidenceClosed) → returns finalizeClaim tx
// - If claim is already finalized (Approved/Rejected/Expired) → returns executeClaim tx
router.post('/:claimId/finalize', async (req: Request, res: Response) => {
  try {
    const { claimId } = req.params;
    
    if (!CLAIMS_MANAGER_ADDRESS) {
      return res.status(500).json({ error: 'CLAIMS_MANAGER_ADDRESS not configured' });
    }
    
    // Get current claim status
    const claim = await publicClient.readContract({
      address: CLAIMS_MANAGER_ADDRESS,
      abi: claimsManagerABI,
      functionName: 'getClaim',
      args: [BigInt(claimId)],
    }) as any;
    
    const status = Number(claim.status);
    
    // ClaimStatus enum: Filed=0, EvidenceClosed=1, VotingClosed=2, Approved=3, Rejected=4, Executed=5, Cancelled=6, Expired=7
    
    if (status === 5) {
      // Already executed
      return res.status(400).json({ error: 'Claim already executed' });
    }
    
    if (status === 0 || status === 1) {
      // Needs finalization first (Filed or EvidenceClosed)
      const data = encodeFunctionData({
        abi: claimsManagerABI,
        functionName: 'finalizeClaim',
        args: [BigInt(claimId)],
      });
      
      return res.json({
        transaction: {
          to: CLAIMS_MANAGER_ADDRESS,
          data,
          value: '0',
        },
        step: 'finalize',
        message: 'Transaction to finalize claim voting. After this completes, call finalize again to execute and distribute funds.',
      });
    }
    
    if (status === 3 || status === 4 || status === 6 || status === 7) {
      // Already finalized, needs execution (Approved, Rejected, Cancelled, Expired)
      if (!RULING_EXECUTOR_ADDRESS) {
        return res.status(500).json({ error: 'RULING_EXECUTOR_ADDRESS not configured' });
      }
      
      const data = encodeFunctionData({
        abi: rulingExecutorABI,
        functionName: 'executeClaim',
        args: [BigInt(claimId)],
      });
      
      const statusNames = ['Filed', 'EvidenceClosed', 'VotingClosed', 'Approved', 'Rejected', 'Executed', 'Cancelled', 'Expired'];
      
      return res.json({
        transaction: {
          to: RULING_EXECUTOR_ADDRESS,
          data,
          value: '0',
        },
        step: 'execute',
        message: `Transaction to execute ${statusNames[status]} claim. This will distribute funds to claimant (if approved) and deposits to voters.`,
      });
    }
    
    // VotingClosed (2) - shouldn't happen normally
    return res.status(400).json({ error: 'Claim is in VotingClosed status - please wait or contact support' });
    
  } catch (error) {
    console.error('Error preparing finalize transaction:', error);
    res.status(500).json({ error: 'Failed to prepare finalize transaction' });
  }
});

// POST /claims/:claimId/execute - Get transaction data for execution (RulingExecutor)
// Use this after finalizeClaim to distribute funds
router.post('/:claimId/execute', async (req: Request, res: Response) => {
  try {
    const { claimId } = req.params;
    
    if (!RULING_EXECUTOR_ADDRESS) {
      return res.status(500).json({ error: 'RULING_EXECUTOR_ADDRESS not configured' });
    }
    
    const data = encodeFunctionData({
      abi: rulingExecutorABI,
      functionName: 'executeClaim',
      args: [BigInt(claimId)],
    });
    
    res.json({
      transaction: {
        to: RULING_EXECUTOR_ADDRESS,
        data,
        value: '0',
      },
      message: 'Transaction to execute claim ruling and distribute funds',
    });
  } catch (error) {
    console.error('Error preparing execute transaction:', error);
    res.status(500).json({ error: 'Failed to prepare execute transaction' });
  }
});

// GET /members/:address/councils - Get councils where address is a member
router.get('/members/:address/councils', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    if (!COUNCIL_REGISTRY_ADDRESS) {
      return res.status(500).json({ error: 'COUNCIL_REGISTRY_ADDRESS not configured' });
    }
    
    // Get all active councils
    const councilIds = await publicClient.readContract({
      address: COUNCIL_REGISTRY_ADDRESS,
      abi: parseAbi(['function getActiveCouncils() view returns (bytes32[])']),
      functionName: 'getActiveCouncils',
    }) as Hex[];
    
    const memberCouncils: any[] = [];
    
    for (const councilId of councilIds) {
      const isMember = await publicClient.readContract({
        address: COUNCIL_REGISTRY_ADDRESS,
        abi: councilRegistryABI,
        functionName: 'isActiveMember',
        args: [councilId, address as Address],
      }) as boolean;
      
      if (isMember) {
        const council = await publicClient.readContract({
          address: COUNCIL_REGISTRY_ADDRESS,
          abi: councilRegistryABI,
          functionName: 'getCouncil',
          args: [councilId],
        }) as any;
        
        memberCouncils.push({
          councilId,
          name: council.name,
          description: council.description,
          vertical: council.vertical,
          memberCount: Number(council.memberCount),
        });
      }
    }
    
    res.json({ councils: memberCouncils, count: memberCouncils.length });
  } catch (error) {
    console.error('Error fetching member councils:', error);
    res.status(500).json({ error: 'Failed to fetch member councils' });
  }
});

// GET /members/:address/pending-claims - Get pending claims for member's councils
router.get('/members/:address/pending-claims', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    if (!COUNCIL_REGISTRY_ADDRESS || !CLAIMS_MANAGER_ADDRESS) {
      return res.status(500).json({ error: 'Contract addresses not configured' });
    }
    
    // Get member's councils
    const councilIds = await publicClient.readContract({
      address: COUNCIL_REGISTRY_ADDRESS,
      abi: parseAbi(['function getActiveCouncils() view returns (bytes32[])']),
      functionName: 'getActiveCouncils',
    }) as Hex[];
    
    const pendingClaims: ClaimResponse[] = [];
    
    for (const councilId of councilIds) {
      const isMember = await publicClient.readContract({
        address: COUNCIL_REGISTRY_ADDRESS,
        abi: councilRegistryABI,
        functionName: 'isActiveMember',
        args: [councilId, address as Address],
      }) as boolean;
      
      if (isMember) {
        const claimIds = await publicClient.readContract({
          address: CLAIMS_MANAGER_ADDRESS,
          abi: claimsManagerABI,
          functionName: 'getPendingClaimsByCouncil',
          args: [councilId],
        }) as bigint[];
        
        for (const claimId of claimIds) {
          try {
            const claim = await publicClient.readContract({
              address: CLAIMS_MANAGER_ADDRESS,
              abi: claimsManagerABI,
              functionName: 'getClaim',
              args: [claimId],
            });
            
            const formatted = formatClaim(claim);
            
            // Check if this member has voted
            const hasVoted = await publicClient.readContract({
              address: CLAIMS_MANAGER_ADDRESS,
              abi: claimsManagerABI,
              functionName: 'hasVoted',
              args: [claimId, address as Address],
            }) as boolean;
            
            pendingClaims.push({
              ...formatted,
              hasVoted,
            } as any);
          } catch (error) {
            console.warn(`Failed to fetch claim ${claimId}:`, error);
          }
        }
      }
    }
    
    // Sort by voting deadline (most urgent first)
    pendingClaims.sort((a, b) => new Date(a.votingDeadline).getTime() - new Date(b.votingDeadline).getTime());
    
    res.json({ claims: pendingClaims, count: pendingClaims.length });
  } catch (error) {
    console.error('Error fetching pending claims:', error);
    res.status(500).json({ error: 'Failed to fetch pending claims' });
  }
});

// GET /deposit-calculator - Calculate required deposit for a claim
router.get('/deposit-calculator', async (req: Request, res: Response) => {
  try {
    const { agentId, claimedAmount } = req.query;
    
    if (!agentId || !claimedAmount) {
      return res.status(400).json({ error: 'agentId and claimedAmount query parameters required' });
    }
    
    if (!CLAIMS_MANAGER_ADDRESS) {
      return res.status(500).json({ error: 'CLAIMS_MANAGER_ADDRESS not configured' });
    }
    
    const deposit = await publicClient.readContract({
      address: CLAIMS_MANAGER_ADDRESS,
      abi: claimsManagerABI,
      functionName: 'calculateRequiredDeposit',
      args: [BigInt(agentId as string), BigInt(claimedAmount as string)],
    }) as bigint;
    
    res.json({
      agentId: agentId,
      claimedAmount: claimedAmount,
      requiredDeposit: deposit.toString(),
    });
  } catch (error) {
    console.error('Error calculating deposit:', error);
    res.status(500).json({ error: 'Failed to calculate deposit' });
  }
});

// ============================================================================
// Claim Metadata Routes
// ============================================================================

// GET /claims/:claimId/metadata - Get claim metadata (title, description)
router.get('/:claimId/metadata', async (req: Request, res: Response) => {
  try {
    const { claimId } = req.params;
    
    const result = await db.query(
      'SELECT claim_id, title, description, created_at, updated_at FROM claim_metadata WHERE claim_id = $1',
      [claimId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Metadata not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching claim metadata:', error);
    res.status(500).json({ error: 'Failed to fetch metadata' });
  }
});

// POST /claims/:claimId/metadata - Save claim metadata
router.post('/:claimId/metadata', async (req: Request, res: Response) => {
  try {
    const { claimId } = req.params;
    const { title, description } = req.body;
    
    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }
    
    // Upsert metadata
    const result = await db.query(
      `INSERT INTO claim_metadata (claim_id, title, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (claim_id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         updated_at = NOW()
       RETURNING *`,
      [claimId, title || null, description]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving claim metadata:', error);
    res.status(500).json({ error: 'Failed to save metadata' });
  }
});

// ============================================================================
// Claim Conversation Routes
// ============================================================================

// GET /claims/:claimId/messages - Get all messages for a claim
router.get('/:claimId/messages', async (req: Request, res: Response) => {
  try {
    const { claimId } = req.params;
    
    // v1.3: evidence stored in DB as base64 data (evidence_data, evidence_mimetype)
    const result = await db.query(
      `SELECT id, claim_id, parent_id, author_address, author_role,
              content, evidence_hash, evidence_data, evidence_filename, evidence_mimetype, evidence_size, created_at
       FROM claim_messages
       WHERE claim_id = $1
       ORDER BY created_at ASC`,
      [claimId]
    );
    
    // Build threaded structure
    const messages = result.rows;
    const messageMap = new Map<string, any>();
    const rootMessages: any[] = [];
    
    // First pass: create map of all messages
    for (const msg of messages) {
      messageMap.set(msg.id, { ...msg, replies: [] });
    }
    
    // Second pass: build tree structure
    for (const msg of messages) {
      const messageWithReplies = messageMap.get(msg.id);
      if (msg.parent_id && messageMap.has(msg.parent_id)) {
        messageMap.get(msg.parent_id).replies.push(messageWithReplies);
      } else {
        rootMessages.push(messageWithReplies);
      }
    }
    
    res.json({
      messages: rootMessages,
      totalCount: messages.length
    });
  } catch (error) {
    console.error('Error fetching claim messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /claims/:claimId/messages - Add a message to the conversation
router.post('/:claimId/messages', async (req: Request, res: Response) => {
  try {
    const { claimId } = req.params;
    const { 
      authorAddress, 
      authorRole, 
      content, 
      parentId,
      evidenceHash,
      // v1.3: evidence stored as base64 in DB
      evidenceData,
      evidenceFilename,
      evidenceMimetype,
      evidenceSize
    } = req.body;
    
    // Validate required fields
    if (!authorAddress) {
      return res.status(400).json({ error: 'authorAddress is required' });
    }
    // v1.3: accept 'council' or 'councilor' for backwards compatibility
    const validRoles = ['claimer', 'provider', 'council', 'councilor'];
    if (!authorRole || !validRoles.includes(authorRole)) {
      return res.status(400).json({ error: 'authorRole must be claimer, provider, or councilor' });
    }
    // Normalize 'council' to 'councilor' (frontend standard)
    const normalizedRole = authorRole === 'council' ? 'councilor' : authorRole;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'content is required' });
    }
    
    // Validate evidence file size (10KB max)
    if (evidenceSize && evidenceSize > 10240) {
      return res.status(400).json({ error: 'Evidence file must be 10KB or less' });
    }
    
    // Council members cannot submit evidence
    if (normalizedRole === 'councilor' && (evidenceHash || evidenceData)) {
      return res.status(403).json({ error: 'Council members cannot submit evidence, only comments' });
    }
    
    // Verify the claim exists and check if evidence period is still open
    if (!CLAIMS_MANAGER_ADDRESS) {
      return res.status(500).json({ error: 'CLAIMS_MANAGER_ADDRESS not configured' });
    }
    
    try {
      const claim = await publicClient.readContract({
        address: CLAIMS_MANAGER_ADDRESS,
        abi: claimsManagerABI,
        functionName: 'getClaim',
        args: [BigInt(claimId)],
      }) as any;
      
      const now = Math.floor(Date.now() / 1000);
      const evidenceDeadline = Number(claim.evidenceDeadline);
      const status = Number(claim.status);
      
      // Only allow messages during evidence period (status = Filed = 0)
      if (status !== 0 || now >= evidenceDeadline) {
        return res.status(403).json({ 
          error: 'Conversation is locked. Evidence period has ended.',
          evidenceDeadline: new Date(evidenceDeadline * 1000).toISOString(),
          currentTime: new Date(now * 1000).toISOString(),
          status: status
        });
      }
      
      // Verify author role matches their actual role for this claim
      const claimantAddress = claim.claimant.toLowerCase();
      const providerAddress = claim.providerAtClaimTime.toLowerCase();
      const authorLower = authorAddress.toLowerCase();
      
      if (normalizedRole === 'claimer' && authorLower !== claimantAddress) {
        return res.status(403).json({ error: 'Only the claimant can post as claimer' });
      }
      
      if (normalizedRole === 'provider' && authorLower !== providerAddress) {
        return res.status(403).json({ error: 'Only the provider can post as provider' });
      }
      
      if (normalizedRole === 'councilor') {
        // Verify they are a council member
        const isMember = await publicClient.readContract({
          address: COUNCIL_REGISTRY_ADDRESS,
          abi: councilRegistryABI,
          functionName: 'isActiveMember',
          args: [claim.councilId, authorAddress as Address],
        }) as boolean;
        
        if (!isMember) {
          return res.status(403).json({ error: 'Only council members can post as councilor' });
        }
      }
      
    } catch (contractError) {
      console.error('Error verifying claim:', contractError);
      return res.status(404).json({ error: 'Claim not found' });
    }
    
    // Validate parent_id if provided
    if (parentId) {
      const parentCheck = await db.query(
        'SELECT id FROM claim_messages WHERE id = $1 AND claim_id = $2',
        [parentId, claimId]
      );
      if (parentCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Parent message not found' });
      }
    }
    
    // Insert the message (v1.3: use evidence_data and evidence_mimetype columns)
    const result = await db.query(
      `INSERT INTO claim_messages 
       (claim_id, parent_id, author_address, author_role, content, evidence_hash, evidence_data, evidence_filename, evidence_mimetype, evidence_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        claimId,
        parentId || null,
        authorAddress.toLowerCase(),
        normalizedRole,
        content.trim(),
        evidenceHash || null,
        evidenceData || null,
        evidenceFilename || null,
        evidenceMimetype || null,
        evidenceSize || null
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error posting message:', error);
    res.status(500).json({ error: 'Failed to post message' });
  }
});

// GET /claims/:claimId/messages/:messageId - Get a single message with its replies
router.get('/:claimId/messages/:messageId', async (req: Request, res: Response) => {
  try {
    const { claimId, messageId } = req.params;
    
    // Get the message and all its descendants (v1.3: use evidence_data, evidence_mimetype)
    const result = await db.query(
      `WITH RECURSIVE message_tree AS (
         SELECT id, claim_id, parent_id, author_address, author_role,
                content, evidence_hash, evidence_data, evidence_filename, evidence_mimetype, evidence_size, created_at, 0 as depth
         FROM claim_messages
         WHERE id = $1 AND claim_id = $2
         
         UNION ALL
         
         SELECT cm.id, cm.claim_id, cm.parent_id, cm.author_address, cm.author_role,
                cm.content, cm.evidence_hash, cm.evidence_data, cm.evidence_filename, cm.evidence_mimetype, cm.evidence_size, cm.created_at, mt.depth + 1
         FROM claim_messages cm
         INNER JOIN message_tree mt ON cm.parent_id = mt.id
       )
       SELECT * FROM message_tree ORDER BY depth, created_at`,
      [messageId, claimId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Build tree structure
    const messages = result.rows;
    const messageMap = new Map<string, any>();
    
    for (const msg of messages) {
      messageMap.set(msg.id, { ...msg, replies: [] });
    }
    
    let rootMessage: any = null;
    for (const msg of messages) {
      const messageWithReplies = messageMap.get(msg.id);
      if (msg.id === messageId) {
        rootMessage = messageWithReplies;
      } else if (msg.parent_id && messageMap.has(msg.parent_id)) {
        messageMap.get(msg.parent_id).replies.push(messageWithReplies);
      }
    }
    
    res.json(rootMessage);
  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

export default router;
