import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { 
  FileText, 
  FilePlus, 
  Clock, 
  CheckCircle, 
  XCircle,
  ArrowRight,
  Loader2
} from 'lucide-react'
import { CONTRACTS, CLAIMS_MANAGER_ABI } from '../config/wagmi'
import { 
  formatUSDC, 
  getTimeRemaining,
  parseDeadline,
  ClaimStatus,
  getStatusLabel,
  isClaimActive,
  formatDate,
  fetchAgentMetadata,
  getAgentDisplayName,
  type AgentMetadata
} from '../lib/api'
import { getCouncil, type SubgraphCouncil } from '../lib/subgraph'
import { type Address } from 'viem'

type FilterType = 'all' | 'active' | 'approved' | 'rejected'

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color = 'claimer' 
}: { 
  title: string
  value: string | number
  icon: React.ElementType
  color?: string
}) {
  const colorClasses: Record<string, string> = {
    claimer: 'from-claimer to-claimer-dark',
    success: 'from-accent to-accent-dark',
    danger: 'from-danger to-red-700',
    warning: 'from-yellow-500 to-yellow-600',
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-sm text-surface-400">{title}</p>
          <p className="text-2xl font-bold text-surface-100">{value}</p>
        </div>
      </div>
    </div>
  )
}

function ClaimRow({ claimId, filter }: { claimId: bigint; filter: FilterType }) {
  const [agentMeta, setAgentMeta] = useState<AgentMetadata | null>(null)
  const [councilInfo, setCouncilInfo] = useState<SubgraphCouncil | null>(null)
  
  const { data: claimData, isLoading } = useReadContract({
    address: CONTRACTS.CLAIMS_MANAGER as Address,
    abi: CLAIMS_MANAGER_ABI,
    functionName: 'getClaim',
    args: [claimId]
  })

  // Fetch agent metadata and council info when claim data loads
  useEffect(() => {
    if (claimData) {
      const claim = claimData as any
      // Fetch agent metadata
      fetchAgentMetadata(claim.agentId.toString()).then(setAgentMeta)
      
      // Fetch council info - councilId is bytes32 from contract
      if (claim.councilId && claim.councilId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        getCouncil(claim.councilId).then(setCouncilInfo)
      }
    }
  }, [claimData])

  if (isLoading) {
    return (
      <div className="p-4 bg-surface-800/50 rounded-lg border border-surface-700 animate-pulse">
        <div className="h-6 bg-surface-700 rounded w-32 mb-2" />
        <div className="h-4 bg-surface-700 rounded w-48" />
      </div>
    )
  }

  if (!claimData) return null

  const claim = claimData as any
  const status = Number(claim.status) as ClaimStatus
  const isActive = isClaimActive({ status } as any)
  const agentIdStr = claim.agentId.toString()
  const agentName = getAgentDisplayName(agentIdStr, agentMeta)

  // Apply filter
  if (filter === 'active' && !isActive) return null
  if (filter === 'approved' && status !== ClaimStatus.Approved && status !== ClaimStatus.Executed) return null
  if (filter === 'rejected' && status !== ClaimStatus.Rejected && status !== ClaimStatus.Cancelled && status !== ClaimStatus.Expired) return null

  return (
    <Link 
      to={`/claims/${claimId.toString()}`}
      className="flex items-center gap-4 p-4 bg-surface-800/50 rounded-lg border border-surface-700 
        hover:border-claimer/30 hover:bg-surface-800 transition-colors"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
        status === ClaimStatus.Approved || status === ClaimStatus.Executed
          ? 'bg-accent/20'
          : status === ClaimStatus.Rejected || status === ClaimStatus.Cancelled
          ? 'bg-danger/20'
          : 'bg-claimer/20'
      }`}>
        <FileText className={`w-5 h-5 ${
          status === ClaimStatus.Approved || status === ClaimStatus.Executed
            ? 'text-accent'
            : status === ClaimStatus.Rejected || status === ClaimStatus.Cancelled
            ? 'text-danger'
            : 'text-claimer'
        }`} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-surface-100">Claim #{claimId.toString()}</p>
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
        <p className="text-sm text-surface-400">
          {agentName} (#{agentIdStr}) • ${formatUSDC(claim.claimedAmount)} USDC • 
          Filed {formatDate(Number(claim.filedAt))}
          {councilInfo && <span className="text-surface-500"> • {councilInfo.name}</span>}
        </p>
      </div>

      <div className="text-right">
        {isActive && (
          <p className="text-sm text-surface-400">
            <Clock className="w-4 h-4 inline mr-1" />
            {getTimeRemaining(status === ClaimStatus.Filed 
              ? parseDeadline(claim.evidenceDeadline) 
              : parseDeadline(claim.votingDeadline)
            )}
          </p>
        )}
        {(status === ClaimStatus.Approved || status === ClaimStatus.Executed) && claim.approvedAmount > 0 && (
          <p className="text-sm text-accent">
            +${formatUSDC(claim.approvedAmount)} USDC
          </p>
        )}
      </div>

      <ArrowRight className="w-5 h-5 text-surface-500" />
    </Link>
  )
}

export default function Dashboard() {
  const { address } = useAccount()
  const [filter, setFilter] = useState<FilterType>('all')

  // Read claim IDs for this address directly from contract
  // Reduced polling to avoid overwhelming RPC
  const { data: claimIds, isLoading: loadingIds } = useReadContract({
    address: CONTRACTS.CLAIMS_MANAGER as Address,
    abi: CLAIMS_MANAGER_ABI,
    functionName: 'getClaimsByClaimant',
    args: address ? [address] : undefined,
    query: { 
      enabled: !!address,
      refetchInterval: 15000, // Refetch every 15 seconds (reduced from 3s)
      refetchOnWindowFocus: true
    }
  })

  const claimIdList = (claimIds as bigint[]) || []

  // Read all claims data for stats calculation
  const claimContracts = claimIdList.map(claimId => ({
    address: CONTRACTS.CLAIMS_MANAGER as Address,
    abi: CLAIMS_MANAGER_ABI,
    functionName: 'getClaim',
    args: [claimId]
  }))

  const { data: claimsData } = useReadContracts({
    contracts: claimContracts,
    query: { 
      enabled: claimIdList.length > 0,
      refetchInterval: 15000, // Refetch every 15 seconds
      refetchOnWindowFocus: true
    }
  })

  // Calculate stats from claims data
  const stats = { active: 0, approved: 0, rejected: 0, totalReceived: BigInt(0) }
  
  if (claimsData) {
    claimsData.forEach(result => {
      if (result.status === 'success' && result.result) {
        const claim = result.result as any
        const status = Number(claim.status) as ClaimStatus

        if (status === ClaimStatus.Filed || status === ClaimStatus.EvidenceClosed || status === ClaimStatus.VotingClosed) {
          stats.active++
        } else if (status === ClaimStatus.Approved || status === ClaimStatus.Executed) {
          stats.approved++
          if (claim.approvedAmount) {
            stats.totalReceived += BigInt(claim.approvedAmount)
          }
        } else if (status === ClaimStatus.Rejected || status === ClaimStatus.Cancelled || status === ClaimStatus.Expired) {
          stats.rejected++
        }
      }
    })
  }

  const filterButtons: { key: FilterType; label: string; icon: React.ElementType }[] = [
    { key: 'all', label: 'All', icon: FileText },
    { key: 'active', label: 'Active', icon: Clock },
    { key: 'approved', label: 'Approved', icon: CheckCircle },
    { key: 'rejected', label: 'Rejected', icon: XCircle },
  ]

  if (loadingIds) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-claimer animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Dashboard</h1>
          <p className="text-surface-400">
            {claimIdList.length} claim{claimIdList.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <Link to="/file" className="btn btn-primary">
          <FilePlus className="w-5 h-5 mr-2" />
          File New Claim
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Active Claims" 
          value={stats.active} 
          icon={Clock}
          color="claimer"
        />
        <StatCard 
          title="Approved" 
          value={stats.approved} 
          icon={CheckCircle}
          color="success"
        />
        <StatCard 
          title="Rejected" 
          value={stats.rejected} 
          icon={XCircle}
          color="danger"
        />
        <StatCard 
          title="Total Received" 
          value={`$${formatUSDC(stats.totalReceived)}`} 
          icon={FileText}
          color="success"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {filterButtons.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              filter === key
                ? 'bg-claimer text-white'
                : 'bg-surface-800 text-surface-400 hover:text-surface-100 hover:bg-surface-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Claims List */}
      {claimIdList.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-surface-700 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-surface-400" />
          </div>
          <h2 className="text-xl font-bold text-surface-100 mb-2">No Claims Yet</h2>
          <p className="text-surface-400 mb-6">
            You haven't filed any claims. If an AI agent has caused you damages,
            you can file a claim to seek compensation.
          </p>
          <Link to="/file" className="btn btn-primary">
            <FilePlus className="w-5 h-5 mr-2" />
            File Your First Claim
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {claimIdList.map((claimId) => (
            <ClaimRow key={claimId.toString()} claimId={claimId} filter={filter} />
          ))}
        </div>
      )}
    </div>
  )
}
