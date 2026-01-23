import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, useReadContract } from 'wagmi'
import { 
  FileText, 
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

export default function MyClaims() {
  const { address } = useAccount()
  const [filter, setFilter] = useState<FilterType>('all')

  // Read claim IDs for this address
  const { data: claimIds, isLoading: loadingIds } = useReadContract({
    address: CONTRACTS.CLAIMS_MANAGER as Address,
    abi: CLAIMS_MANAGER_ABI,
    functionName: 'getClaimsByClaimant',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  })

  // We need to fetch each claim individually
  // In production, this would be done via API/subgraph
  const claimIdList = (claimIds as bigint[]) || []

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">My Claims</h1>
          <p className="text-surface-400">
            {claimIdList.length} claim{claimIdList.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <Link to="/file" className="btn btn-primary">
          File New Claim
        </Link>
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
          <h2 className="text-xl font-bold text-surface-100 mb-2">No Claims</h2>
          <p className="text-surface-400 mb-6">
            You haven't filed any claims yet.
          </p>
          <Link to="/file" className="btn btn-primary">
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
  const agentName = getAgentDisplayName(claim.agentId.toString(), agentMeta)

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
          {agentName} • ${formatUSDC(claim.claimedAmount)} USDC • 
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
