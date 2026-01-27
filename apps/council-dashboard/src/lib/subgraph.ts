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
  vote: string | number | undefined // Can be "Approve"/"Reject"/"Abstain" OR 1/2/3
  approvedAmount?: string
  reasoning?: string
  votedAt?: string
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

// Helper to normalize vote value to number
function normalizeVote(vote: string | number | undefined | null): number {
  if (vote === undefined || vote === null) return 0
  if (typeof vote === 'number') return vote
  const voteStr = String(vote).toLowerCase()
  if (voteStr === 'approve' || voteStr === '1') return 1
  if (voteStr === 'reject' || voteStr === '2') return 2
  if (voteStr === 'abstain' || voteStr === '3') return 3
  return 0
}

// =============================================================================
// GraphQL Queries
// =============================================================================

// Query votes by voter address - using voter_contains for case-insensitive match
const VOTES_BY_VOTER_QUERY = `
  query GetVotesByVoter($voter: Bytes!) {
    votes(where: { voter: $voter }, orderBy: votedAt, orderDirection: desc, first: 100) {
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

// Fallback: Get all votes and filter client-side (more expensive but works)
const ALL_VOTES_QUERY = `
  query GetAllVotes {
    votes(orderBy: votedAt, orderDirection: desc, first: 1000) {
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
  const timeoutId = setTimeout(() => controller.abort(), 15000) // Increased timeout
  
  try {
    console.log('Subgraph query:', { query: query.slice(0, 100), variables })
    
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
    
    console.log('Subgraph response:', json)

    if (json.errors) {
      console.error('Subgraph errors:', json.errors)
      throw new Error(json.errors[0]?.message || 'Subgraph query failed')
    }

    return json.data
  } catch (error) {
    clearTimeout(timeoutId)
    console.error('Subgraph error:', error)
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
 * Extract voter address from vote ID (format: "claimId-voterAddress")
 */
function extractVoterFromId(id: string): string | null {
  if (!id) return null
  const parts = id.split('-')
  if (parts.length >= 2) {
    // The voter address is everything after the first dash
    // (in case claimId has dashes, rejoin everything after first part)
    return parts.slice(1).join('-').toLowerCase()
  }
  return null
}

/**
 * Get all votes by a specific voter address
 * First tries direct filter, falls back to client-side filtering if empty
 */
export async function getVotesByVoter(voterAddress: string): Promise<SubgraphVote[]> {
  // Guard against undefined/null address
  if (!voterAddress) {
    console.warn('getVotesByVoter called with empty address')
    return []
  }
  
  const normalizedAddress = voterAddress.toLowerCase()
  
  // Try direct query first
  try {
    const data = await querySubgraph<{ votes: SubgraphVote[] }>(VOTES_BY_VOTER_QUERY, {
      voter: normalizedAddress
    })
    
    if (data.votes && data.votes.length > 0) {
      console.log(`Found ${data.votes.length} votes via direct query`)
      return data.votes
    }
  } catch (e) {
    console.warn('Direct voter query failed, trying fallback:', e)
  }
  
  // Fallback: get all votes and filter client-side
  // Note: The subgraph voter field may not be indexed, so we extract from ID
  console.log('Using fallback: fetching all votes and filtering client-side')
  const allData = await querySubgraph<{ votes: SubgraphVote[] }>(ALL_VOTES_QUERY, {})
  
  if (!allData.votes) {
    console.warn('No votes returned from subgraph')
    return []
  }
  
  // Filter by voter - try both the voter field and extracting from ID
  const filtered = allData.votes.filter(v => {
    // First try the voter field
    if (v.voter && v.voter.toLowerCase() === normalizedAddress) {
      return true
    }
    // Fallback: extract voter from ID (format: "claimId-voterAddress")
    const voterFromId = extractVoterFromId(v.id)
    return voterFromId === normalizedAddress
  })
  
  console.log(`Found ${filtered.length} votes via client-side filter (out of ${allData.votes.length} total)`)
  return filtered
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
    // Skip votes with missing data
    if (!vote || !vote.claim) {
      console.warn('Skipping vote with missing claim data:', vote)
      continue
    }
    
    // Normalize vote to number (handles both string "Approve" and number 1)
    const voteNum = normalizeVote(vote.vote)
    
    // Count vote types
    if (voteNum === 1) approveVotes++
    else if (voteNum === 2) rejectVotes++
    else if (voteNum === 3) abstainVotes++
    
    const claim = vote.claim
    const status = claim.status || ''
    const isFinalized = status === 'Approved' || status === 'Rejected' || status === 'Executed'
    
    if (isFinalized) {
      finalizedVotes++
      
      // Calculate deposit earnings for non-abstain votes on finalized claims
      // Deposit is split among all non-abstain voters
      if (voteNum !== 3) { // Not abstain
        const nonAbstainVoters = (claim.approveVotes || 0) + (claim.rejectVotes || 0)
        if (nonAbstainVoters > 0 && claim.claimantDeposit) {
          try {
            const deposit = BigInt(claim.claimantDeposit)
            const share = deposit / BigInt(nonAbstainVoters)
            depositEarnings += share
          } catch (e) {
            console.warn('Error calculating deposit share:', e)
          }
        }
      }
      
      // Calculate win rate
      const claimApproved = status === 'Approved' || status === 'Executed'
      const votedApprove = voteNum === 1
      const votedReject = voteNum === 2
      
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
