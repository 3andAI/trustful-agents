import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useReadContract } from 'wagmi'
import { 
  Search, 
  Shield, 
  ShieldOff,
  DollarSign,
  FileText,
  Users,
  ArrowRight,
  Loader2,
  AlertTriangle,
  ExternalLink,
  History,
  TrendingUp,
  RefreshCw,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { 
  CONTRACTS, 
  ERC8004_REGISTRY_ABI,
  TRUSTFUL_VALIDATOR_ABI
} from '../config/wagmi'
import { 
  formatUSDC,
  formatAddress,
  ClaimStatus,
  getStatusLabel,
  ipfsToHttp,
  type AgentMetadata
} from '../lib/api'
import {
  searchAgents,
  getAgent,
  getAgentTermsHistory,
  getAgentClaims,
  getCouncil,
  SubgraphAgent,
  SubgraphTermsVersion,
  SubgraphClaim,
  SubgraphCouncil,
  fromHexId,
  formatSubgraphDate
} from '../lib/subgraph'
import { type Address } from 'viem'

export default function AgentLookup() {
  const { agentId: paramAgentId } = useParams()
  
  // If we have an agent ID in params, show detail view
  if (paramAgentId && paramAgentId !== 'search') {
    return <AgentDetailView agentId={paramAgentId} />
  }
  
  return <AgentSearchView />
}

// =============================================================================
// Search View - Shows grid of agents from subgraph
// =============================================================================

function AgentSearchView() {
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState('')
  const [agents, setAgents] = useState<SubgraphAgent[]>([])
  const [agentMetadata, setAgentMetadata] = useState<Map<string, AgentMetadata | null>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    setLoading(true)
    setError(null)
    try {
      // Only show validated agents
      const data = await searchAgents({
        first: 50,
        isValidated: true,
        orderBy: 'collateralBalance',
        orderDirection: 'desc' as const
      })
      setAgents(data)
      
      // Fetch metadata for all agents
      const agentIds = data.map(a => fromHexId(a.id))
      const metadataMap = new Map<string, AgentMetadata | null>()
      await Promise.all(
        agentIds.map(async (id) => {
          try {
            const res = await fetch(`https://api.trustful-agents.ai/provider/agents/${id}`)
            if (res.ok) {
              const meta = await res.json()
              metadataMap.set(id, meta)
            } else {
              metadataMap.set(id, null)
            }
          } catch {
            metadataMap.set(id, null)
          }
        })
      )
      setAgentMetadata(metadataMap)
    } catch (err) {
      console.error('Failed to load agents:', err)
      setError('Failed to load agents from subgraph')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput && /^\d+$/.test(searchInput)) {
      navigate(`/agent/${searchInput}`)
    }
  }

  // Filter agents by search input (ID, owner address, or name)
  const filteredAgents = agents.filter(agent => {
    if (!searchInput) return true
    const numericId = fromHexId(agent.id)
    const meta = agentMetadata.get(numericId)
    const searchLower = searchInput.toLowerCase()
    
    return numericId.includes(searchInput) || 
           agent.owner.toLowerCase().includes(searchLower) ||
           (meta?.name && meta.name.toLowerCase().includes(searchLower))
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Find an Agent</h1>
          <p className="text-surface-400 mt-1">
            Search validated agents to view their trust status and file claims
          </p>
        </div>
        <button
          onClick={loadAgents}
          className="btn btn-secondary"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="card p-4">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by Agent ID or name…"
              className="input pl-10 w-full"
            />
          </div>
        </form>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-claimer animate-spin" />
        </div>
      ) : error ? (
        <div className="card p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-danger mx-auto mb-4" />
          <p className="text-surface-300">{error}</p>
          <button onClick={loadAgents} className="btn btn-secondary mt-4">
            Try Again
          </button>
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="card p-8 text-center">
          <Users className="w-12 h-12 text-surface-500 mx-auto mb-4" />
          <p className="text-surface-300">No validated agents found</p>
          {searchInput && (
            <p className="text-surface-500 text-sm mt-2">
              Try a different search term
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => (
            <AgentCard 
              key={agent.id} 
              agent={agent} 
              metadata={agentMetadata.get(fromHexId(agent.id)) || null}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AgentCard({ agent, metadata }: { agent: SubgraphAgent; metadata: AgentMetadata | null }) {
  const numericId = fromHexId(agent.id)
  const [councilInfo, setCouncilInfo] = useState<SubgraphCouncil | null>(null)
  
  // Always read owner from contract
  const { data: contractOwner } = useReadContract({
    address: CONTRACTS.ERC8004_REGISTRY as Address,
    abi: ERC8004_REGISTRY_ABI,
    functionName: 'ownerOf',
    args: [BigInt(numericId)]
  })
  
  useEffect(() => {
    if (agent.councilId) {
      getCouncil(agent.councilId).then(setCouncilInfo)
    }
  }, [agent.councilId])
  
  const displayName = metadata?.name || `Agent #${numericId}`
  // Get provider address from metadata first, or contract owner as fallback
  const providerAddress = metadata?.owner_address || (contractOwner as string) || null
  
  return (
    <Link
      to={`/agent/${numericId}`}
      className="card p-4 hover:border-claimer/50 transition-colors group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-accent/20">
            <Shield className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-surface-100 group-hover:text-claimer transition-colors">
              {displayName}
            </h3>
            <p className="text-xs text-surface-500">
              ID: {numericId}
            </p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-surface-500 group-hover:text-claimer transition-colors" />
      </div>

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {councilInfo && (
          <span className="badge badge-claimer text-xs">{councilInfo.name}</span>
        )}
        {providerAddress && providerAddress !== '0x0000000000000000000000000000000000000000' && (
          <span className="text-xs text-surface-500 font-mono">
            Provider: {formatAddress(providerAddress)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-surface-800/50 rounded-lg p-2">
          <p className="text-xs text-surface-500">Collateral Available</p>
          <p className="text-sm font-medium text-surface-200">
            ${formatUSDC(agent.availableCollateral)}
          </p>
        </div>
        <div className="bg-surface-800/50 rounded-lg p-2">
          <p className="text-xs text-surface-500">Claims</p>
          <p className="text-sm font-medium text-surface-200">
            {agent.totalClaims}
            {agent.pendingClaims > 0 && (
              <span className="text-claimer ml-1">({agent.pendingClaims} active)</span>
            )}
          </p>
        </div>
      </div>

      {agent.withdrawalPending && (
        <div className="mt-3 px-2 py-1 bg-danger/10 border border-danger/20 rounded text-xs text-danger">
          ⚠️ Withdrawal pending
        </div>
      )}
    </Link>
  )
}

// =============================================================================
// Detail View - Shows single agent with terms history
// =============================================================================

function AgentDetailView({ agentId }: { agentId: string }) {
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState('')
  const [agent, setAgent] = useState<SubgraphAgent | null>(null)
  const [agentMeta, setAgentMeta] = useState<AgentMetadata | null>(null)
  const [termsHistory, setTermsHistory] = useState<SubgraphTermsVersion[]>([])
  const [claims, setClaims] = useState<SubgraphClaim[]>([])
  const [council, setCouncil] = useState<SubgraphCouncil | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isValidAgentId = /^\d+$/.test(agentId)

  useEffect(() => {
    if (isValidAgentId) {
      loadAgentData()
    }
  }, [agentId])

  const loadAgentData = async () => {
    setLoading(true)
    setError(null)
    try {
      const agentData = await getAgent(agentId)
      if (!agentData) {
        setError('Agent not found')
        setLoading(false)
        return
      }
      setAgent(agentData)

      // Fetch agent metadata (name)
      try {
        const res = await fetch(`https://api.trustful-agents.ai/provider/agents/${agentId}`)
        if (res.ok) {
          const meta = await res.json()
          setAgentMeta(meta)
        }
      } catch {
        // Metadata not available, continue with fallback
      }

      const terms = await getAgentTermsHistory(agentId)
      setTermsHistory(terms)

      const claimsData = await getAgentClaims(agentId)
      setClaims(claimsData)

      if (agentData.councilId) {
        const councilData = await getCouncil(agentData.councilId)
        setCouncil(councilData)
      }
    } catch (err) {
      console.error('Failed to load agent:', err)
      setError('Failed to load agent data')
    } finally {
      setLoading(false)
    }
  }

  // Read validation conditions from contract for accuracy
  const { data: conditions } = useReadContract({
    address: CONTRACTS.TRUSTFUL_VALIDATOR as Address,
    abi: TRUSTFUL_VALIDATOR_ABI,
    functionName: 'checkConditions',
    args: [BigInt(agentId)],
    query: { enabled: isValidAgentId }
  })

  const { data: agentUri } = useReadContract({
    address: CONTRACTS.ERC8004_REGISTRY as Address,
    abi: ERC8004_REGISTRY_ABI,
    functionName: 'tokenURI',
    args: [BigInt(agentId)],
    query: { enabled: isValidAgentId }
  })

  const conditionData = conditions as [boolean, boolean, boolean, boolean] | undefined
  const displayName = agentMeta?.name || `Agent #${agentId}`

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput) {
      navigate(`/agent/${searchInput}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-claimer animate-spin" />
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="card p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-danger mx-auto mb-4" />
          <h2 className="text-xl font-bold text-surface-100 mb-2">Agent Not Found</h2>
          <p className="text-surface-400 mb-6">
            {error || `Agent #${agentId} doesn't exist or hasn't been indexed yet.`}
          </p>
          <button 
            onClick={() => navigate('/agent/search')}
            className="btn btn-secondary"
          >
            Search Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search another agent..."
            className="input pl-10"
          />
        </div>
      </form>

      {/* Agent Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
              agent.isValidated ? 'bg-accent/20' : 'bg-danger/20'
            }`}>
              {agent.isValidated ? (
                <Shield className="w-8 h-8 text-accent" />
              ) : (
                <ShieldOff className="w-8 h-8 text-danger" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-100">{displayName}</h1>
              <p className="text-surface-500 text-sm">
                ID: {agentId}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`badge ${agent.isValidated ? 'badge-success' : 'badge-danger'}`}>
                  {agent.isValidated ? 'Validated' : 'Not Validated'}
                </span>
                {council && (
                  <span className="badge badge-claimer">{council.name}</span>
                )}
              </div>
              {agentUri && (
                <a 
                  href={ipfsToHttp(agentUri as string)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-claimer hover:underline flex items-center gap-1 mt-2"
                >
                  View Agent Card <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
          <Link 
            to={`/file?agent=${agentId}`}
            className="btn btn-primary"
          >
            File Claim
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trust Status */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-100 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Trust Status
          </h2>
          
          <div className={`p-4 rounded-lg mb-4 ${
            agent.isValidated ? 'bg-accent/10 border border-accent/20' : 'bg-danger/10 border border-danger/20'
          }`}>
            <div className="flex items-center gap-3">
              {agent.isValidated ? (
                <CheckCircle className="w-6 h-6 text-accent" />
              ) : (
                <XCircle className="w-6 h-6 text-danger" />
              )}
              <span className={`font-medium ${agent.isValidated ? 'text-accent' : 'text-danger'}`}>
                {agent.isValidated ? 'Validated' : 'Not Validated'}
              </span>
            </div>
          </div>

          {conditionData && (
            <div className="space-y-2">
              <ConditionRow label="Has Collateral" met={conditionData[0]} />
              <ConditionRow label="Has Active Terms" met={conditionData[1]} />
              <ConditionRow label="Owner Valid" met={conditionData[2]} />
              <ConditionRow label="Council Active" met={conditionData[3]} />
            </div>
          )}
        </div>

        {/* Collateral */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-100 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Collateral
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-claimer/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-claimer" />
              </div>
              <div>
                <p className="text-2xl font-bold text-surface-100">
                  ${formatUSDC(agent.collateralBalance)}
                </p>
                <p className="text-sm text-surface-400">Total Balance</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-surface-800 rounded-lg">
                <p className="text-xs text-surface-500">Available</p>
                <p className="text-surface-200 font-medium">
                  ${formatUSDC(agent.availableCollateral)}
                </p>
              </div>
              <div className="p-3 bg-surface-800 rounded-lg">
                <p className="text-xs text-surface-500">Locked</p>
                <p className="text-surface-200 font-medium">
                  ${formatUSDC(agent.lockedCollateral)}
                </p>
              </div>
            </div>

            {agent.withdrawalPending && agent.withdrawalAmount && (
              <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
                <p className="text-sm text-danger font-medium">⚠️ Withdrawal Pending</p>
                <p className="text-surface-200 text-sm">
                  ${formatUSDC(agent.withdrawalAmount)} USDC
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Statistics */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-100 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Statistics
          </h2>
          
          <div className="space-y-3">
            <StatRow label="Total Claims" value={agent.totalClaims.toString()} />
            <StatRow label="Approved" value={agent.approvedClaims.toString()} color="text-accent" />
            <StatRow label="Rejected" value={agent.rejectedClaims.toString()} color="text-danger" />
            <StatRow label="Pending" value={agent.pendingClaims.toString()} color="text-claimer" />
            <div className="border-t border-surface-700 pt-3 mt-3">
              <StatRow 
                label="Total Paid Out" 
                value={`$${formatUSDC(agent.totalPaidOut)}`} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Terms History */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4 flex items-center gap-2">
          <History className="w-5 h-5" />
          Terms & Conditions History ({termsHistory.length})
        </h2>

        {termsHistory.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-8 h-8 text-surface-500 mx-auto mb-2" />
            <p className="text-surface-400">No terms registered yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {termsHistory.map((terms) => (
              <TermsVersionRow key={terms.id} terms={terms} />
            ))}
          </div>
        )}
      </div>

      {/* Claims History */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Claims History ({claims.length})
        </h2>

        {claims.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-8 h-8 text-surface-500 mx-auto mb-2" />
            <p className="text-surface-400">No claims filed against this agent</p>
          </div>
        ) : (
          <div className="space-y-2">
            {claims.map((claim) => (
              <ClaimRow key={claim.id} claim={claim} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Helper Components
// =============================================================================

function ConditionRow({ label, met }: { label: string; met: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-surface-400">{label}</span>
      <span className={`flex items-center gap-1 ${met ? 'text-accent' : 'text-danger'}`}>
        {met ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
        {met ? 'Yes' : 'No'}
      </span>
    </div>
  )
}

function StatRow({ label, value, color = 'text-surface-200' }: { 
  label: string
  value: string
  color?: string 
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-surface-400">{label}</span>
      <span className={`font-medium ${color}`}>{value}</span>
    </div>
  )
}

function TermsVersionRow({ terms }: { terms: SubgraphTermsVersion }) {
  const [councilName, setCouncilName] = useState<string | null>(null)

  useEffect(() => {
    if (terms.councilId) {
      getCouncil(terms.councilId).then(c => setCouncilName(c?.name || null))
    }
  }, [terms.councilId])

  return (
    <div className={`p-4 rounded-lg border ${
      terms.isActive 
        ? 'bg-accent/5 border-accent/20' 
        : 'bg-surface-800 border-surface-700'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            terms.isActive ? 'bg-accent/20' : 'bg-surface-700'
          }`}>
            <FileText className={`w-5 h-5 ${terms.isActive ? 'text-accent' : 'text-surface-500'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-surface-200">
                Version {terms.version}
              </span>
              {terms.isActive && (
                <span className="badge badge-success text-xs">Active</span>
              )}
            </div>
            <p className="text-sm text-surface-500">
              Registered {formatSubgraphDate(terms.registeredAt)}
            </p>
          </div>
        </div>
        {councilName && (
          <span className="badge badge-claimer text-xs">{councilName}</span>
        )}
      </div>
      
      {terms.contentUri && (
        <a 
          href={ipfsToHttp(terms.contentUri)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block p-2 bg-surface-900 rounded hover:bg-surface-800 transition-colors"
        >
          <p className="text-xs text-surface-500 mb-1">IPFS Document</p>
          <p className="text-claimer text-sm truncate flex items-center gap-1">
            {terms.contentUri} <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </p>
        </a>
      )}

      {terms.deactivatedAt && (
        <p className="text-xs text-surface-500 mt-2">
          Deactivated {formatSubgraphDate(terms.deactivatedAt)}
        </p>
      )}
    </div>
  )
}

function ClaimRow({ claim }: { claim: SubgraphClaim }) {
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
  
  const status = statusMap[claim.status] ?? ClaimStatus.Filed

  return (
    <Link
      to={`/claims/${claim.id}`}
      className="flex items-center justify-between p-3 bg-surface-800 rounded-lg hover:bg-surface-750 transition-colors"
    >
      <div className="flex items-center gap-3">
        <FileText className="w-4 h-4 text-surface-500" />
        <div>
          <span className="text-surface-200">Claim #{claim.id}</span>
          <p className="text-xs text-surface-500">
            Filed {formatSubgraphDate(claim.filedAt)}
          </p>
        </div>
        <span className={`badge ${
          status === ClaimStatus.Approved || status === ClaimStatus.Executed
            ? 'badge-success'
            : status === ClaimStatus.Rejected || status === ClaimStatus.Cancelled
            ? 'badge-danger'
            : 'badge-claimer'
        }`}>
          {getStatusLabel(status)}
        </span>
      </div>
      <div className="text-right">
        <span className="text-surface-300">${formatUSDC(claim.claimedAmount)}</span>
        {claim.totalVotes > 0 && (
          <p className="text-xs text-surface-500">
            {claim.approveVotes}↑ {claim.rejectVotes}↓
          </p>
        )}
      </div>
    </Link>
  )
}
