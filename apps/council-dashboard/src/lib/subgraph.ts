// Subgraph client for Council Dashboard
// Fetches voting history and deposit earnings

const SUBGRAPH_URL = import.meta.env.VITE_SUBGRAPH_URL || 
  'https://api.studio.thegraph.com/query/1723244/trustful-agents/v0.1'

// =============================================================================
// Types
// =============================================================================

export interface SubgraphVote {
  id: string
  voter: string
  vote: number // 1=Approve, 2=Reject, 3=Abstain
  approvedAmount: string
  reasoning: string
  votedAt: string
  claim: SubgraphClaim
}

export interface SubgraphClaim {
  id: string
  claimant: string
  claimedAmount: string
  approvedAmount: string | null
  claimantDeposit: string
  status: string // Filed, EvidenceClosed, Approved, Rejected, etc.
  filedAt: string
  closedAt: string | null
  approveVotes: number
  rejectVotes: number
  abstainVotes: number
  totalVotes: number
}

export interface VoterStats {
  totalVotes: number
  approveVotes: number
  rejectVotes: number
  abstainVotes: number
  depositEarnings: bigint
  winRate: number // percentage
  votes: SubgraphVote[]
}

// =============================================================================
// GraphQL Queries
// =============================================================================

const VOTES_BY_VOTER_QUERY = `
  query GetVotesByVoter($voter: Bytes!) {
    votes(where: { voter: $voter }, orderBy: votedAt, orderDirection: desc) {
      id
      voter
      vote
      approvedAmount
      reasoning
      votedAt
      claim {
        id
        claimant
        claimedAmount
        approvedAmount
        claimantDeposit
        status
        filedAt
        closedAt
        approveVotes
        rejectVotes
        abstainVotes
        totalVotes
      }
    }
  }
`

// =============================================================================
// Client
// =============================================================================

async function querySubgraph<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)
  
  try {
    const response = await fetch(SUBGRAPH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Subgraph request failed: ${response.status}`)
    }

    const json = await response.json()

    if (json.errors) {
      console.error('Subgraph errors:', json.errors)
      throw new Error(json.errors[0]?.message || 'Subgraph query failed')
    }

    return json.data
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Subgraph request timed out')
    }
    throw error
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get all votes by a specific voter address
 */
export async function getVotesByVoter(voterAddress: string): Promise<SubgraphVote[]> {
  const data = await querySubgraph<{ votes: SubgraphVote[] }>(VOTES_BY_VOTER_QUERY, {
    voter: voterAddress.toLowerCase()
  })
  return data.votes
}

/**
 * Calculate voter statistics including deposit earnings
 */
export async function getVoterStats(voterAddress: string): Promise<VoterStats> {
  const votes = await getVotesByVoter(voterAddress)
  
  let approveVotes = 0
  let rejectVotes = 0
  let abstainVotes = 0
  let depositEarnings = BigInt(0)
  let correctVotes = 0
  let finalizedVotes = 0
  
  for (const vote of votes) {
    // Count vote types
    if (vote.vote === 1) approveVotes++
    else if (vote.vote === 2) rejectVotes++
    else if (vote.vote === 3) abstainVotes++
    
    const claim = vote.claim
    const isFinalized = claim.status === 'Approved' || claim.status === 'Rejected' || claim.status === 'Executed'
    
    if (isFinalized) {
      finalizedVotes++
      
      // Calculate deposit earnings for non-abstain votes on finalized claims
      // Deposit is split among all non-abstain voters
      if (vote.vote !== 3) { // Not abstain
        const nonAbstainVoters = claim.approveVotes + claim.rejectVotes
        if (nonAbstainVoters > 0) {
          const deposit = BigInt(claim.claimantDeposit)
          const share = deposit / BigInt(nonAbstainVoters)
          depositEarnings += share
        }
      }
      
      // Calculate win rate
      const claimApproved = claim.status === 'Approved' || claim.status === 'Executed'
      const votedApprove = vote.vote === 1
      const votedReject = vote.vote === 2
      
      if ((claimApproved && votedApprove) || (!claimApproved && votedReject)) {
        correctVotes++
      }
    }
  }
  
  const winRate = finalizedVotes > 0 ? Math.round((correctVotes / finalizedVotes) * 100) : 0
  
  return {
    totalVotes: votes.length,
    approveVotes,
    rejectVotes,
    abstainVotes,
    depositEarnings,
    winRate,
    votes,
  }
}
