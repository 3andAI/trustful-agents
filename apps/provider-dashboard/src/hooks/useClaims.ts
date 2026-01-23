import { useQuery } from '@tanstack/react-query'
import { API_BASE_URL } from '../config/contracts'
import { getAgentClaims, type SubgraphClaim } from '../lib/subgraph'

// Claim status enum matching the contract
export enum ClaimStatus {
  Filed = 0,
  EvidenceClosed = 1,
  Approved = 2,
  Rejected = 3,
  Cancelled = 4,
  Expired = 5,
  Executed = 6,
}

// Map subgraph status string to enum
function parseStatus(status: string): ClaimStatus {
  const statusMap: Record<string, ClaimStatus> = {
    'Filed': ClaimStatus.Filed,
    'EvidenceClosed': ClaimStatus.EvidenceClosed,
    'Approved': ClaimStatus.Approved,
    'Rejected': ClaimStatus.Rejected,
    'Cancelled': ClaimStatus.Cancelled,
    'Expired': ClaimStatus.Expired,
    'Executed': ClaimStatus.Executed,
  }
  return statusMap[status] ?? ClaimStatus.Filed
}

export function getStatusLabel(status: ClaimStatus): string {
  const labels: Record<ClaimStatus, string> = {
    [ClaimStatus.Filed]: 'Filed',
    [ClaimStatus.EvidenceClosed]: 'Evidence Closed',
    [ClaimStatus.Approved]: 'Approved',
    [ClaimStatus.Rejected]: 'Rejected',
    [ClaimStatus.Cancelled]: 'Cancelled',
    [ClaimStatus.Expired]: 'Expired',
    [ClaimStatus.Executed]: 'Executed',
  }
  return labels[status] || 'Unknown'
}

export function getStatusVariant(status: ClaimStatus): 'warning' | 'success' | 'danger' | 'neutral' | 'primary' {
  const variants: Record<ClaimStatus, 'warning' | 'success' | 'danger' | 'neutral' | 'primary'> = {
    [ClaimStatus.Filed]: 'warning',
    [ClaimStatus.EvidenceClosed]: 'primary',
    [ClaimStatus.Approved]: 'success',
    [ClaimStatus.Rejected]: 'danger',
    [ClaimStatus.Cancelled]: 'neutral',
    [ClaimStatus.Expired]: 'neutral',
    [ClaimStatus.Executed]: 'success',
  }
  return variants[status] || 'neutral'
}

// Internal Claim type
export interface Claim {
  id: bigint
  agentId: bigint
  claimant: string
  claimedAmount: bigint
  approvedAmount: bigint
  claimantDeposit: bigint
  lockedCollateral: bigint
  evidenceHash: string
  evidenceUri: string
  paymentReceiptHash: string
  councilId: string
  providerAtClaimTime: string
  status: ClaimStatus
  filedAt: bigint
  evidenceDeadline: bigint
  votingDeadline: bigint
  votesFor: bigint
  votesAgainst: bigint
  votesAbstain: bigint
}

// Convert subgraph claim to internal Claim type
function subgraphClaimToClaim(sgClaim: SubgraphClaim, agentId: string): Claim {
  // Extract numeric claim ID from hex id
  const claimIdPart = sgClaim.id.includes('-') ? sgClaim.id.split('-')[1] : sgClaim.id
  const numericClaimId = claimIdPart.startsWith('0x') 
    ? BigInt(claimIdPart) 
    : BigInt(parseInt(claimIdPart, 10) || 0)
  
  return {
    id: numericClaimId,
    agentId: BigInt(agentId),
    claimant: sgClaim.claimant,
    claimedAmount: BigInt(sgClaim.claimedAmount),
    approvedAmount: BigInt(sgClaim.approvedAmount || '0'),
    claimantDeposit: BigInt(0),
    lockedCollateral: BigInt(0),
    evidenceHash: '',
    evidenceUri: '',
    paymentReceiptHash: '',
    councilId: '',
    providerAtClaimTime: '',
    status: parseStatus(sgClaim.status),
    filedAt: BigInt(sgClaim.filedAt),
    evidenceDeadline: BigInt(sgClaim.evidenceDeadline),
    votingDeadline: BigInt(sgClaim.votingDeadline),
    votesFor: BigInt(sgClaim.approveVotes),
    votesAgainst: BigInt(sgClaim.rejectVotes),
    votesAbstain: BigInt(sgClaim.abstainVotes),
  }
}

// API claim type (for single claim details)
interface ApiClaim {
  claimId: string
  agentId: string
  claimant: string
  claimedAmount: string
  approvedAmount: string
  claimantDeposit: string
  lockedCollateral: string
  evidenceHash: string
  evidenceUri: string
  paymentReceiptHash: string
  councilId: string
  providerAtClaimTime: string
  status: string
  statusCode: number
  filedAt: string
  evidenceDeadline: string
  votingDeadline: string
  votesFor?: string
  votesAgainst?: string
  votesAbstain?: string
  votingProgress?: {
    approveVotes: string
    rejectVotes: string
    abstainVotes: string
  }
}

function apiClaimToClaim(apiClaim: ApiClaim): Claim {
  return {
    id: BigInt(apiClaim.claimId),
    agentId: BigInt(apiClaim.agentId),
    claimant: apiClaim.claimant,
    claimedAmount: BigInt(apiClaim.claimedAmount),
    approvedAmount: BigInt(apiClaim.approvedAmount || '0'),
    claimantDeposit: BigInt(apiClaim.claimantDeposit),
    lockedCollateral: BigInt(apiClaim.lockedCollateral),
    evidenceHash: apiClaim.evidenceHash,
    evidenceUri: apiClaim.evidenceUri,
    paymentReceiptHash: apiClaim.paymentReceiptHash,
    councilId: apiClaim.councilId,
    providerAtClaimTime: apiClaim.providerAtClaimTime,
    status: apiClaim.statusCode as ClaimStatus,
    filedAt: BigInt(Math.floor(new Date(apiClaim.filedAt).getTime() / 1000)),
    evidenceDeadline: BigInt(Math.floor(new Date(apiClaim.evidenceDeadline).getTime() / 1000)),
    votingDeadline: BigInt(Math.floor(new Date(apiClaim.votingDeadline).getTime() / 1000)),
    votesFor: BigInt(apiClaim.votingProgress?.approveVotes || apiClaim.votesFor || '0'),
    votesAgainst: BigInt(apiClaim.votingProgress?.rejectVotes || apiClaim.votesAgainst || '0'),
    votesAbstain: BigInt(apiClaim.votingProgress?.abstainVotes || apiClaim.votesAbstain || '0'),
  }
}

/**
 * Fetch claims for an agent using SUBGRAPH (efficient - no rate limits!)
 */
export function useAgentClaims(agentId: string | undefined) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['agentClaimsSubgraph', agentId],
    queryFn: async () => {
      const sgClaims = await getAgentClaims(agentId!, 100, 0)
      return sgClaims.map(c => subgraphClaimToClaim(c, agentId!))
    },
    enabled: !!agentId,
    staleTime: 30000,
    refetchInterval: 60000,
  })

  const claims = data || []
  const pendingCount = claims.filter(c => 
    c.status === ClaimStatus.Filed || c.status === ClaimStatus.EvidenceClosed
  ).length

  return {
    claims,
    claimIds: claims.map(c => c.id),
    pendingCount,
    totalCount: claims.length,
    isLoading,
    error,
    refetch,
  }
}

/**
 * Fetch a single claim by ID (uses API for full details)
 */
export function useClaim(claimId: string | undefined) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['claim', claimId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/claims/${claimId}`)
      if (!response.ok) throw new Error('Failed to fetch claim')
      const apiClaim = await response.json()
      return apiClaimToClaim(apiClaim)
    },
    enabled: !!claimId,
    staleTime: 10000,
    refetchInterval: 30000,
  })

  return {
    claim: data || null,
    isLoading,
    error,
    refetch,
  }
}

/**
 * Fetch council details for a claim
 */
export function useClaimCouncil(councilId: string | undefined) {
  return {
    council: councilId ? { name: councilId.slice(0, 10) + '...' } : null,
    isLoading: false,
    error: null,
  }
}

/**
 * Check if evidence period is still open
 */
export function isEvidencePeriodOpen(claim: Claim): boolean {
  const now = BigInt(Math.floor(Date.now() / 1000))
  return claim.status === ClaimStatus.Filed && now < claim.evidenceDeadline
}

/**
 * Get time remaining for evidence period
 */
export function getEvidenceTimeRemaining(claim: Claim): { days: number; hours: number; minutes: number; total: number } {
  const now = Math.floor(Date.now() / 1000)
  const deadline = Number(claim.evidenceDeadline)
  const remaining = Math.max(0, deadline - now)

  return {
    days: Math.floor(remaining / 86400),
    hours: Math.floor((remaining % 86400) / 3600),
    minutes: Math.floor((remaining % 3600) / 60),
    total: remaining,
  }
}
