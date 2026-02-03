// Subgraph client for Trustful Agents
// Endpoint: https://api.studio.thegraph.com/query/1723244/trustful-agents/v0.1

const SUBGRAPH_URL = import.meta.env.VITE_SUBGRAPH_URL || 
  'https://api.studio.thegraph.com/query/1723244/trustful-agents/v1.3.1'

// =============================================================================
// Types
// =============================================================================

export interface SubgraphAgent {
  id: string
  owner: string
  collateralBalance: string
  lockedCollateral: string
  availableCollateral: string
  withdrawalPending: boolean
  withdrawalAmount: string | null
  withdrawalExecuteAfter: string | null
  activeTermsVersion: number | null
  activeTermsHash: string | null
  activeTermsUri: string | null
  councilId: string | null
  isValidated: boolean
  validationRequestHash: string | null
  validationIssuedAt: string | null
  validationRevokedAt: string | null
  revocationReason: string | null
  totalClaims: number
  approvedClaims: number
  rejectedClaims: number
  pendingClaims: number
  totalPaidOut: string
  createdAt: string
  updatedAt: string
}

export interface SubgraphTermsVersion {
  id: string
  version: number
  contentHash: string
  contentUri: string
  councilId: string
  isActive: boolean
  registeredAt: string
  deactivatedAt: string | null
}

export interface SubgraphCouncil {
  id: string
  name: string
  vertical: string
  memberCount: number
  quorumPercentage: number
  claimDepositPercentage: number
  votingPeriod: string
  evidencePeriod: string
  isActive: boolean
  totalClaims: number
}

export interface SubgraphClaim {
  id: string
  claimant: string
  claimedAmount: string
  approvedAmount: string | null
  status: string
  filedAt: string
  evidenceDeadline: string
  votingDeadline: string
  closedAt: string | null
  executedAt: string | null
  approveVotes: number
  rejectVotes: number
  abstainVotes: number
  totalVotes: number
}

export interface SubgraphProtocolStats {
  totalAgents: number
  validatedAgents: number
  totalCollateral: string
  lockedCollateral: string
  totalClaims: number
  pendingClaims: number
  approvedClaims: number
  rejectedClaims: number
  totalCompensationPaid: string
}

// =============================================================================
// GraphQL Queries
// =============================================================================

const AGENT_SEARCH_QUERY = `
  query SearchAgents($first: Int!, $skip: Int!, $where: Agent_filter, $orderBy: Agent_orderBy, $orderDirection: OrderDirection) {
    agents(
      first: $first
      skip: $skip
      where: $where
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      id
      owner
      collateralBalance
      lockedCollateral
      availableCollateral
      isValidated
      activeTermsVersion
      activeTermsUri
      councilId
      totalClaims
      approvedClaims
      rejectedClaims
      pendingClaims
      totalPaidOut
      createdAt
      updatedAt
    }
  }
`

const AGENT_DETAIL_QUERY = `
  query GetAgent($id: ID!) {
    agent(id: $id) {
      id
      owner
      collateralBalance
      lockedCollateral
      availableCollateral
      withdrawalPending
      withdrawalAmount
      withdrawalExecuteAfter
      activeTermsVersion
      activeTermsHash
      activeTermsUri
      councilId
      isValidated
      validationRequestHash
      validationIssuedAt
      validationRevokedAt
      revocationReason
      totalClaims
      approvedClaims
      rejectedClaims
      pendingClaims
      totalPaidOut
      createdAt
      updatedAt
    }
  }
`

const AGENT_TERMS_HISTORY_QUERY = `
  query GetAgentTermsHistory($agentId: String!) {
    termsVersions(
      where: { agent: $agentId }
      orderBy: version
      orderDirection: desc
    ) {
      id
      version
      contentHash
      contentUri
      councilId
      isActive
      registeredAt
      deactivatedAt
    }
  }
`

const AGENT_CLAIMS_QUERY = `
  query GetAgentClaims($agentId: String!, $first: Int!, $skip: Int!) {
    claims(
      where: { agent: $agentId }
      orderBy: filedAt
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      claimant
      claimedAmount
      approvedAmount
      status
      filedAt
      evidenceDeadline
      votingDeadline
      closedAt
      executedAt
      approveVotes
      rejectVotes
      abstainVotes
      totalVotes
    }
  }
`

const COUNCIL_QUERY = `
  query GetCouncil($id: ID!) {
    council(id: $id) {
      id
      name
      vertical
      memberCount
      quorumPercentage
      claimDepositPercentage
      votingPeriod
      evidencePeriod
      isActive
      totalClaims
    }
  }
`

const PROTOCOL_STATS_QUERY = `
  query GetProtocolStats {
    protocolStats(id: "global") {
      totalAgents
      validatedAgents
      totalCollateral
      lockedCollateral
      totalClaims
      pendingClaims
      approvedClaims
      rejectedClaims
      totalCompensationPaid
    }
  }
`

const AGENTS_BY_IDS_QUERY = `
  query GetAgentsByIds($ids: [ID!]!) {
    agents(where: { id_in: $ids }) {
      id
      owner
      collateralBalance
      lockedCollateral
      availableCollateral
      isValidated
      activeTermsVersion
      activeTermsUri
      councilId
      totalClaims
      approvedClaims
      rejectedClaims
      pendingClaims
      totalPaidOut
      createdAt
      updatedAt
    }
  }
`

// =============================================================================
// Client Functions
// =============================================================================

async function querySubgraph<T>(query: string, variables: Record<string, any> = {}): Promise<T> {
  // Add timeout to prevent hanging
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
  
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
 * Search agents with optional filters
 */
export async function searchAgents(options: {
  first?: number
  skip?: number
  minCollateral?: string
  isValidated?: boolean
  orderBy?: 'collateralBalance' | 'totalClaims' | 'createdAt' | 'updatedAt'
  orderDirection?: 'asc' | 'desc'
} = {}): Promise<SubgraphAgent[]> {
  const {
    first = 50,
    skip = 0,
    minCollateral,
    isValidated,
    orderBy = 'createdAt',
    orderDirection = 'desc'
  } = options

  const where: Record<string, any> = {}
  
  if (minCollateral) {
    where.collateralBalance_gte = minCollateral
  }
  
  if (isValidated !== undefined) {
    where.isValidated = isValidated
  }

  const data = await querySubgraph<{ agents: SubgraphAgent[] }>(AGENT_SEARCH_QUERY, {
    first,
    skip,
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy,
    orderDirection
  })

  return data.agents
}

/**
 * Get agents with collateral (useful for finding active agents)
 */
export async function getActiveAgents(limit = 50): Promise<SubgraphAgent[]> {
  return searchAgents({
    first: limit,
    minCollateral: '1', // At least 1 wei of collateral
    orderBy: 'collateralBalance',
    orderDirection: 'desc'
  })
}

/**
 * Get validated agents only
 */
export async function getValidatedAgents(limit = 50): Promise<SubgraphAgent[]> {
  return searchAgents({
    first: limit,
    isValidated: true,
    orderBy: 'collateralBalance',
    orderDirection: 'desc'
  })
}

/**
 * Get agent by ID (hex string of token ID)
 */
export async function getAgent(agentId: string): Promise<SubgraphAgent | null> {
  // Convert numeric ID to hex format for subgraph
  const hexId = toHexId(agentId)
  
  const data = await querySubgraph<{ agent: SubgraphAgent | null }>(AGENT_DETAIL_QUERY, {
    id: hexId
  })

  return data.agent
}

/**
 * Get terms history for an agent
 */
export async function getAgentTermsHistory(agentId: string): Promise<SubgraphTermsVersion[]> {
  const hexId = toHexId(agentId)
  
  const data = await querySubgraph<{ termsVersions: SubgraphTermsVersion[] }>(AGENT_TERMS_HISTORY_QUERY, {
    agentId: hexId
  })

  return data.termsVersions
}

/**
 * Get claims for an agent
 */
export async function getAgentClaims(agentId: string, first = 20, skip = 0): Promise<SubgraphClaim[]> {
  const hexId = toHexId(agentId)
  
  const data = await querySubgraph<{ claims: SubgraphClaim[] }>(AGENT_CLAIMS_QUERY, {
    agentId: hexId,
    first,
    skip
  })

  return data.claims
}

/**
 * Get council info by ID
 */
export async function getCouncil(councilId: string): Promise<SubgraphCouncil | null> {
  const data = await querySubgraph<{ council: SubgraphCouncil | null }>(COUNCIL_QUERY, {
    id: councilId
  })

  return data.council
}

/**
 * Get protocol statistics
 */
export async function getProtocolStats(): Promise<SubgraphProtocolStats | null> {
  const data = await querySubgraph<{ protocolStats: SubgraphProtocolStats | null }>(PROTOCOL_STATS_QUERY, {})
  return data.protocolStats
}

/**
 * Get multiple agents by their IDs in a single query (efficient batch fetch)
 */
export async function getAgentsByIds(agentIds: string[]): Promise<SubgraphAgent[]> {
  if (agentIds.length === 0) return []
  
  // Convert numeric IDs to hex format
  const hexIds = agentIds.map(id => toHexId(id))
  
  const data = await querySubgraph<{ agents: SubgraphAgent[] }>(AGENTS_BY_IDS_QUERY, {
    ids: hexIds
  })
  return data.agents
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Convert numeric agent ID to hex format for subgraph queries
 */
export function toHexId(agentId: string): string {
  // If already a hex string, return as-is (lowercase)
  if (agentId.startsWith('0x')) {
    return agentId.toLowerCase()
  }
  
  // Convert numeric string to hex
  try {
    const num = BigInt(agentId)
    return '0x' + num.toString(16)
  } catch {
    return agentId.toLowerCase()
  }
}

/**
 * Convert hex ID back to numeric string for display
 */
export function fromHexId(hexId: string): string {
  if (!hexId.startsWith('0x')) {
    return hexId
  }
  
  try {
    const num = BigInt(hexId)
    return num.toString()
  } catch {
    return hexId
  }
}

/**
 * Format timestamp from subgraph (string) to Date
 */
export function parseTimestamp(timestamp: string): Date {
  return new Date(parseInt(timestamp) * 1000)
}

/**
 * Format subgraph timestamp for display
 */
export function formatSubgraphDate(timestamp: string): string {
  return parseTimestamp(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Format subgraph timestamp with time
 */
export function formatSubgraphDateTime(timestamp: string): string {
  return parseTimestamp(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
