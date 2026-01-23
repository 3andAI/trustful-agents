// API client for Claimer Dashboard

const API_BASE = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_URL || 'https://api.trustful-agents.ai')

// Types
export enum ClaimStatus {
  Filed = 0,
  EvidenceClosed = 1,
  VotingClosed = 2,
  Approved = 3,
  Rejected = 4,
  Executed = 5,
  Cancelled = 6,
  Expired = 7
}

// Map string status to enum (for API responses that return strings)
export function parseClaimStatus(status: string | number): ClaimStatus {
  // Already a number
  if (typeof status === 'number') return status as ClaimStatus
  
  // Numeric string like "0", "1", "2"
  const numericValue = parseInt(status, 10)
  if (!isNaN(numericValue) && numericValue >= 0 && numericValue <= 7) {
    return numericValue as ClaimStatus
  }
  
  // Word string like "Filed", "EvidenceClosed"
  const statusMap: Record<string, ClaimStatus> = {
    'Filed': ClaimStatus.Filed,
    'EvidenceClosed': ClaimStatus.EvidenceClosed,
    'VotingClosed': ClaimStatus.VotingClosed,
    'Approved': ClaimStatus.Approved,
    'Rejected': ClaimStatus.Rejected,
    'Executed': ClaimStatus.Executed,
    'Cancelled': ClaimStatus.Cancelled,
    'Expired': ClaimStatus.Expired
  }
  return statusMap[status] ?? ClaimStatus.Filed
}

export interface Claim {
  claimId: string
  agentId: string
  claimant: string
  claimedAmount: string
  approvedAmount: string
  evidenceHash: string
  evidenceUri: string
  paymentReceiptHash: string
  termsHashAtClaimTime: string
  termsVersionAtClaimTime: number
  providerAtClaimTime: string
  councilId: string
  claimantDeposit: string
  lockedCollateral: string
  status: ClaimStatus
  filedAt: number
  evidenceDeadline: number
  votingDeadline: number
  hadVotes: boolean
  // Enriched data from API
  metadata?: ClaimMetadata
  evidence?: Evidence[]
  agent?: AgentInfo
  council?: CouncilInfo
  votingProgress?: VotingProgress
}

export interface ClaimMetadata {
  title: string
  description: string
}

export interface Evidence {
  id: string
  claimId: string
  submitterAddress: string
  evidenceHash: string
  evidenceUri: string
  submittedAt: string
  isCounterEvidence: boolean
}

export interface AgentInfo {
  id: string
  name: string
  owner: string
  uri: string
  isValidated: boolean
  collateral: string
  termsUri?: string
  councilId?: string
}

export interface CouncilInfo {
  id: string
  name: string
  vertical: string
  description: string
  quorumPercentage: number
  votingPeriodDays: number
  evidencePeriodDays: number
  claimDepositPercentage: number
  isActive: boolean
  memberCount: number
}

export interface VotingProgress {
  approveVotes: number
  rejectVotes: number
  abstainVotes: number
  totalVotes: number
  requiredQuorum: number
  deadline: number
  quorumReached: boolean
}

export interface DepositCalculation {
  deposit: string
  percentage: number
  councilName: string
}

// API Functions
export async function fetchMyClaims(address: string): Promise<Claim[]> {
  const res = await fetch(`${API_BASE}/claims?claimant=${address}`)
  if (!res.ok) throw new Error('Failed to fetch claims')
  const data = await res.json()
  // Handle both direct array response and wrapped response { claims: [...] }
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.claims)) return data.claims
  if (data && Array.isArray(data.data)) return data.data
  return []
}

export async function fetchClaim(claimId: string): Promise<Claim> {
  const res = await fetch(`${API_BASE}/claims/${claimId}`)
  if (!res.ok) throw new Error('Failed to fetch claim')
  return res.json()
}

export async function fetchClaimEvidence(claimId: string): Promise<Evidence[]> {
  const res = await fetch(`${API_BASE}/claims/${claimId}/evidence`)
  if (!res.ok) throw new Error('Failed to fetch evidence')
  const data = await res.json()
  // Handle both direct array response and wrapped response
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.evidence)) return data.evidence
  if (data && Array.isArray(data.data)) return data.data
  return []
}

export async function fetchAgentInfo(agentId: string): Promise<AgentInfo> {
  const res = await fetch(`${API_BASE}/agents/${agentId}`)
  if (!res.ok) throw new Error('Failed to fetch agent')
  return res.json()
}

export async function fetchAgentClaims(agentId: string): Promise<Claim[]> {
  const res = await fetch(`${API_BASE}/claims?agentId=${agentId}`)
  if (!res.ok) throw new Error('Failed to fetch agent claims')
  const data = await res.json()
  // Handle both direct array response and wrapped response
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.claims)) return data.claims
  if (data && Array.isArray(data.data)) return data.data
  return []
}

export async function calculateDeposit(agentId: string, amount: string): Promise<DepositCalculation> {
  const res = await fetch(`${API_BASE}/claims/deposit-calculator?agentId=${agentId}&amount=${amount}`)
  if (!res.ok) throw new Error('Failed to calculate deposit')
  return res.json()
}

export async function saveClaimMetadata(claimId: string, metadata: ClaimMetadata): Promise<void> {
  const res = await fetch(`${API_BASE}/claims/${claimId}/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata)
  })
  if (!res.ok) throw new Error('Failed to save metadata')
}

// Helper Functions
export function formatUSDC(amount: string | bigint): string {
  const value = typeof amount === 'string' ? BigInt(amount) : amount
  const whole = value / BigInt(1e6)
  const decimal = value % BigInt(1e6)
  const decimalStr = decimal.toString().padStart(6, '0').slice(0, 2)
  return `${whole.toLocaleString()}.${decimalStr}`
}

export function parseUSDC(amount: string): bigint {
  const [whole, decimal = ''] = amount.split('.')
  const wholeNum = BigInt(whole || '0') * BigInt(1e6)
  const decimalPadded = (decimal + '000000').slice(0, 6)
  const decimalNum = BigInt(decimalPadded)
  return wholeNum + decimalNum
}

export function formatAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function getStatusLabel(status: ClaimStatus): string {
  const labels: Record<ClaimStatus, string> = {
    [ClaimStatus.Filed]: 'Evidence Period',
    [ClaimStatus.EvidenceClosed]: 'Voting Open',
    [ClaimStatus.VotingClosed]: 'Awaiting Finalization',
    [ClaimStatus.Approved]: 'Approved',
    [ClaimStatus.Rejected]: 'Rejected',
    [ClaimStatus.Executed]: 'Executed',
    [ClaimStatus.Cancelled]: 'Cancelled',
    [ClaimStatus.Expired]: 'Expired'
  }
  return labels[status] || 'Unknown'
}

export function getStatusBadgeClass(status: ClaimStatus): string {
  const classes: Record<ClaimStatus, string> = {
    [ClaimStatus.Filed]: 'badge-filed',
    [ClaimStatus.EvidenceClosed]: 'badge-voting',
    [ClaimStatus.VotingClosed]: 'badge-evidence',
    [ClaimStatus.Approved]: 'badge-approved',
    [ClaimStatus.Rejected]: 'badge-rejected',
    [ClaimStatus.Executed]: 'badge-executed',
    [ClaimStatus.Cancelled]: 'badge-cancelled',
    [ClaimStatus.Expired]: 'badge-expired'
  }
  return classes[status] || 'badge'
}

export function getTimeRemaining(deadline: number): string {
  const now = Date.now() / 1000
  const remaining = deadline - now
  
  if (remaining <= 0) return 'Ended'
  
  const days = Math.floor(remaining / 86400)
  const hours = Math.floor((remaining % 86400) / 3600)
  const minutes = Math.floor((remaining % 3600) / 60)
  
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

// Safe deadline parsing - handles strings, numbers, bigints, null/undefined
export function parseDeadline(value: any): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    return isNaN(parsed) ? 0 : parsed
  }
  return 0
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function isDeadlinePassed(deadline: number): boolean {
  return Date.now() / 1000 > deadline
}

export function canSubmitEvidence(claim: Claim): boolean {
  return claim.status === ClaimStatus.Filed && !isDeadlinePassed(claim.evidenceDeadline)
}

export function canCancelClaim(claim: Claim): boolean {
  return claim.status === ClaimStatus.Filed
}

export function isClaimActive(claim: Claim): boolean {
  return claim.status === ClaimStatus.Filed || 
         claim.status === ClaimStatus.EvidenceClosed ||
         claim.status === ClaimStatus.VotingClosed
}

export function isClaimResolved(claim: Claim): boolean {
  return claim.status === ClaimStatus.Approved ||
         claim.status === ClaimStatus.Rejected ||
         claim.status === ClaimStatus.Executed ||
         claim.status === ClaimStatus.Cancelled ||
         claim.status === ClaimStatus.Expired
}

// IPFS helpers
export function ipfsToHttp(uri: string): string {
  if (!uri) return ''
  
  // Handle real IPFS URIs (CID starts with Qm or bafy)
  if (uri.startsWith('ipfs://')) {
    const cid = uri.slice(7)
    // Only convert if it looks like a real CID
    if (cid.startsWith('Qm') || cid.startsWith('bafy')) {
      return `https://gateway.pinata.cloud/ipfs/${cid}`
    }
    // Otherwise return as-is (it's probably a placeholder)
    return uri
  }
  
  // Handle hash:// URIs (placeholder for local files)
  if (uri.startsWith('hash://')) {
    return '' // No valid URL for hash-only evidence
  }
  
  // Return HTTP/HTTPS URLs as-is
  return uri
}

// Upload file to IPFS via Pinata
export async function uploadToIPFS(file: File): Promise<{ hash: string; uri: string } | null> {
  const pinataApiKey = import.meta.env.VITE_PINATA_API_KEY
  const pinataSecretKey = import.meta.env.VITE_PINATA_SECRET_KEY
  
  if (!pinataApiKey || !pinataSecretKey) {
    console.error('VITE_PINATA_API_KEY or VITE_PINATA_SECRET_KEY not configured')
    return null
  }
  
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    // Add metadata
    const metadata = JSON.stringify({
      name: file.name,
      keyvalues: {
        type: 'evidence',
        timestamp: Date.now().toString()
      }
    })
    formData.append('pinataMetadata', metadata)
    
    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'pinata_api_key': pinataApiKey,
        'pinata_secret_api_key': pinataSecretKey
      },
      body: formData
    })
    
    if (!res.ok) {
      console.error('Pinata upload failed:', await res.text())
      return null
    }
    
    const data = await res.json()
    const cid = data.IpfsHash
    
    return {
      hash: cid,
      uri: `ipfs://${cid}`
    }
  } catch (err) {
    console.error('Failed to upload to Pinata:', err)
    return null
  }
}

export function hashFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async () => {
      const buffer = reader.result as ArrayBuffer
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      resolve(hashHex)
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// Agent Metadata from governance API
export interface AgentMetadata {
  agent_id: string
  owner_address: string
  name: string
  description: string | null
  capabilities: string[] | null
  website_url: string | null
}

// Cache for agent metadata to avoid repeated API calls
const agentMetadataCache = new Map<string, AgentMetadata | null>()

export async function fetchAgentMetadata(agentId: string): Promise<AgentMetadata | null> {
  // Check cache first
  if (agentMetadataCache.has(agentId)) {
    return agentMetadataCache.get(agentId) || null
  }
  
  try {
    const res = await fetch(`${API_BASE}/provider/agents/${agentId}`)
    if (!res.ok) {
      agentMetadataCache.set(agentId, null)
      return null
    }
    const data = await res.json()
    agentMetadataCache.set(agentId, data)
    return data
  } catch (err) {
    console.error(`Failed to fetch agent ${agentId} metadata:`, err)
    agentMetadataCache.set(agentId, null)
    return null
  }
}

// Batch fetch multiple agent metadata
export async function fetchAgentMetadataBatch(agentIds: string[]): Promise<Map<string, AgentMetadata | null>> {
  const results = new Map<string, AgentMetadata | null>()
  const uncachedIds = agentIds.filter(id => !agentMetadataCache.has(id))
  
  // Return cached results for already fetched agents
  for (const id of agentIds) {
    if (agentMetadataCache.has(id)) {
      results.set(id, agentMetadataCache.get(id) || null)
    }
  }
  
  // Fetch uncached agents in parallel
  await Promise.all(
    uncachedIds.map(async (id) => {
      const metadata = await fetchAgentMetadata(id)
      results.set(id, metadata)
    })
  )
  
  return results
}

// Get display name for agent (name or fallback to #id)
export function getAgentDisplayName(agentId: string, metadata: AgentMetadata | null): string {
  return metadata?.name || `Agent #${agentId}`
}
