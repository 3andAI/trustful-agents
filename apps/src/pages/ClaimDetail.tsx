import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { 
  ArrowLeft, 
  Clock, 
  FileText, 
  User, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Plus,
  DollarSign
} from 'lucide-react'
import { 
  CONTRACTS, 
  CLAIMS_MANAGER_ABI,
  COUNCIL_REGISTRY_ABI,
  COLLATERAL_VAULT_ABI
} from '../config/wagmi'
import { 
  formatUSDC, 
  formatAddress, 
  getTimeRemaining,
  formatDate,
  ClaimStatus,
  getStatusLabel,
  canSubmitEvidence,
  canCancelClaim,
  ipfsToHttp,
  fetchAgentMetadata,
  getAgentDisplayName,
  type AgentMetadata
} from '../lib/api'
import { getCouncil, getAgent, type SubgraphCouncil, type SubgraphAgent } from '../lib/subgraph'
import { type Address } from 'viem'

export default function ClaimDetail() {
  const { claimId } = useParams()
  const { address } = useAccount()
  const [agentMeta, setAgentMeta] = useState<AgentMetadata | null>(null)
  const [subgraphCouncil, setSubgraphCouncil] = useState<SubgraphCouncil | null>(null)
  const [subgraphAgent, setSubgraphAgent] = useState<SubgraphAgent | null>(null)

  // Read claim data
  const { data: claimData, isLoading } = useReadContract({
    address: CONTRACTS.CLAIMS_MANAGER as Address,
    abi: CLAIMS_MANAGER_ABI,
    functionName: 'getClaim',
    args: claimId ? [BigInt(claimId)] : undefined,
    query: { enabled: !!claimId }
  })

  // Read voting progress
  const { data: votingProgress } = useReadContract({
    address: CONTRACTS.CLAIMS_MANAGER as Address,
    abi: CLAIMS_MANAGER_ABI,
    functionName: 'getVotingProgress',
    args: claimId ? [BigInt(claimId)] : undefined,
    query: { enabled: !!claimId }
  })

  // Read council info from contract
  const councilId = claimData ? (claimData as any).councilId : undefined
  const { data: councilData } = useReadContract({
    address: CONTRACTS.COUNCIL_REGISTRY as Address,
    abi: COUNCIL_REGISTRY_ABI,
    functionName: 'getCouncil',
    args: councilId ? [councilId] : undefined,
    query: { enabled: !!councilId && councilId !== '0x0000000000000000000000000000000000000000000000000000000000000000' }
  })

  // Read collateral for the agent from contract
  const agentId = claimData ? (claimData as any).agentId : undefined
  const { data: collateralData } = useReadContract({
    address: CONTRACTS.COLLATERAL_VAULT as Address,
    abi: COLLATERAL_VAULT_ABI,
    functionName: 'getAccount',
    args: agentId ? [agentId] : undefined,
    query: { enabled: !!agentId }
  })

  // Fetch agent metadata, council, and agent data from subgraph as fallback
  useEffect(() => {
    if (agentId) {
      const agentIdStr = agentId.toString()
      fetchAgentMetadata(agentIdStr).then(setAgentMeta)
      // Fetch agent from subgraph for collateral fallback
      getAgent(agentIdStr).then(setSubgraphAgent)
    }
    // Fetch council from subgraph as fallback
    if (councilId && councilId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      getCouncil(councilId).then(setSubgraphCouncil)
    }
  }, [agentId, councilId])

  // Cancel claim
  const { writeContract: cancelClaim, data: cancelTx, isPending: cancelPending } = useWriteContract()
  const { isLoading: cancelConfirming } = useWaitForTransactionReceipt({
    hash: cancelTx
  })

  const handleCancel = () => {
    if (!claimId) return
    cancelClaim({
      address: CONTRACTS.CLAIMS_MANAGER as Address,
      abi: CLAIMS_MANAGER_ABI,
      functionName: 'cancelClaim',
      args: [BigInt(claimId)]
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-claimer animate-spin" />
      </div>
    )
  }

  if (!claimData) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-danger mx-auto mb-4" />
        <h2 className="text-xl font-bold text-surface-100 mb-2">Claim Not Found</h2>
        <p className="text-surface-400 mb-4">This claim doesn't exist or has been removed.</p>
        <Link to="/claims" className="btn-secondary inline-flex">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Claims
        </Link>
      </div>
    )
  }

  const claim = claimData as any
  const status = Number(claim.status) as ClaimStatus
  const progress = votingProgress as any
  const council = councilData as any
  const collateral = collateralData as any

  const isOwner = claim.claimant.toLowerCase() === address?.toLowerCase()
  const showCancel = isOwner && canCancelClaim({ status } as any)
  const showAddEvidence = isOwner && canSubmitEvidence({ 
    status, 
    evidenceDeadline: Number(claim.evidenceDeadline) 
  } as any)

  const agentName = getAgentDisplayName(claim.agentId.toString(), agentMeta)
  
  // Get council name from contract or subgraph fallback
  const councilName = council?.name || subgraphCouncil?.name || 'Unknown'
  
  // Calculate available collateral - try contract data first, then subgraph
  let availableCollateral = BigInt(0)
  if (collateral && (collateral.balance || collateral[1])) {
    // Contract data - handle both object and array formats
    const balance = collateral.balance ?? collateral[1] ?? BigInt(0)
    const locked = collateral.lockedAmount ?? collateral[2] ?? BigInt(0)
    availableCollateral = BigInt(balance) - BigInt(locked)
  } else if (subgraphAgent) {
    // Subgraph fallback
    availableCollateral = BigInt(subgraphAgent.availableCollateral || '0')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link 
            to="/" 
            className="text-surface-400 hover:text-surface-100 mb-4 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-surface-100">Claim #{claimId}</h1>
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
          <p className="text-surface-400 mt-1">
            {agentName} (#{claim.agentId.toString()})
            {councilName !== 'Unknown' && <span> • {councilName}</span>}
          </p>
        </div>
        
        <div className="flex gap-2">
          {showAddEvidence && (
            <button className="btn btn-secondary">
              <Plus className="w-4 h-4 mr-2" />
              Add Evidence
            </button>
          )}
          {showCancel && (
            <button 
              onClick={handleCancel}
              disabled={cancelPending || cancelConfirming}
              className="btn btn-danger"
            >
              {cancelPending || cancelConfirming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel Claim
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Claim Details */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-surface-100 mb-4">Claim Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-surface-500">Agent</p>
                <Link 
                  to={`/agent/${claim.agentId}`}
                  className="text-claimer hover:underline"
                >
                  {agentName} (#{claim.agentId.toString()})
                </Link>
              </div>
              <div>
                <p className="text-sm text-surface-500">Council</p>
                <p className="text-surface-200">
                  {councilName}
                </p>
              </div>
              <div>
                <p className="text-sm text-surface-500">Claimed Amount</p>
                <p className="text-surface-100 font-medium">
                  ${formatUSDC(claim.claimedAmount)} USDC
                </p>
              </div>
              <div>
                <p className="text-sm text-surface-500">Approved Amount</p>
                <p className="text-surface-100 font-medium">
                  ${formatUSDC(claim.approvedAmount)} USDC
                </p>
              </div>
              <div>
                <p className="text-sm text-surface-500">Your Deposit</p>
                <p className="text-surface-200">
                  ${formatUSDC(claim.claimantDeposit)} USDC
                </p>
              </div>
              <div>
                <p className="text-sm text-surface-500">Locked Collateral</p>
                <p className="text-surface-200">
                  ${formatUSDC(claim.lockedCollateral)} USDC
                </p>
              </div>
              <div>
                <p className="text-sm text-surface-500">Agent Collateral Available</p>
                <p className="text-surface-200 flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-accent" />
                  ${formatUSDC(availableCollateral)} USDC
                </p>
              </div>
              <div>
                <p className="text-sm text-surface-500">Provider</p>
                <p className="text-surface-200 font-mono text-sm">
                  {formatAddress(claim.providerAtClaimTime)}
                </p>
              </div>
              <div>
                <p className="text-sm text-surface-500">Filed At</p>
                <p className="text-surface-200">
                  {formatDate(Number(claim.filedAt))}
                </p>
              </div>
              <div>
                <p className="text-sm text-surface-500">Claimant</p>
                <p className="text-surface-200 font-mono text-sm">
                  {formatAddress(claim.claimant)}
                </p>
              </div>
            </div>
          </div>

          {/* Evidence */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-surface-100 mb-4">Evidence</h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-surface-800 rounded-lg border border-surface-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-surface-400">Primary Evidence</span>
                  {claim.evidenceUri && ipfsToHttp(claim.evidenceUri) && (
                    <a 
                      href={ipfsToHttp(claim.evidenceUri)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-claimer hover:text-claimer-light flex items-center gap-1"
                    >
                      View <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
                <p className="text-sm text-surface-500 font-mono break-all">
                  Hash: {claim.evidenceHash}
                </p>
                {claim.evidenceUri && (
                  <p className="text-sm text-surface-500 font-mono break-all mt-1">
                    URI: {claim.evidenceUri}
                  </p>
                )}
              </div>

              {claim.paymentReceiptHash && claim.paymentReceiptHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                <div className="p-4 bg-surface-800 rounded-lg border border-surface-700">
                  <p className="text-surface-400 mb-2">Payment Receipt</p>
                  <p className="text-sm text-surface-500 font-mono break-all">
                    {claim.paymentReceiptHash}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timeline */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-surface-100 mb-4">Timeline</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-surface-100">Claim Filed</p>
                  <p className="text-sm text-surface-400">
                    {formatDate(Number(claim.filedAt))}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  Date.now() / 1000 > Number(claim.evidenceDeadline)
                    ? 'bg-accent/20'
                    : 'bg-claimer/20'
                }`}>
                  <Clock className={`w-4 h-4 ${
                    Date.now() / 1000 > Number(claim.evidenceDeadline)
                      ? 'text-accent'
                      : 'text-claimer'
                  }`} />
                </div>
                <div>
                  <p className="font-medium text-surface-100">Evidence Deadline</p>
                  <p className="text-sm text-surface-400">
                    {formatDate(Number(claim.evidenceDeadline))}
                  </p>
                  {Date.now() / 1000 < Number(claim.evidenceDeadline) && (
                    <p className="text-sm text-claimer">
                      {getTimeRemaining(Number(claim.evidenceDeadline))} remaining
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  Date.now() / 1000 > Number(claim.votingDeadline)
                    ? 'bg-accent/20'
                    : status >= ClaimStatus.EvidenceClosed
                    ? 'bg-claimer/20'
                    : 'bg-surface-700'
                }`}>
                  <User className={`w-4 h-4 ${
                    Date.now() / 1000 > Number(claim.votingDeadline)
                      ? 'text-accent'
                      : status >= ClaimStatus.EvidenceClosed
                      ? 'text-claimer'
                      : 'text-surface-400'
                  }`} />
                </div>
                <div>
                  <p className="font-medium text-surface-100">Voting Deadline</p>
                  <p className="text-sm text-surface-400">
                    {formatDate(Number(claim.votingDeadline))}
                  </p>
                  {Date.now() / 1000 < Number(claim.votingDeadline) && status >= ClaimStatus.EvidenceClosed && (
                    <p className="text-sm text-claimer">
                      {getTimeRemaining(Number(claim.votingDeadline))} remaining
                    </p>
                  )}
                </div>
              </div>

              {status >= ClaimStatus.Approved && (
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    status === ClaimStatus.Approved || status === ClaimStatus.Executed
                      ? 'bg-accent/20'
                      : 'bg-danger/20'
                  }`}>
                    {status === ClaimStatus.Approved || status === ClaimStatus.Executed ? (
                      <CheckCircle className="w-4 h-4 text-accent" />
                    ) : (
                      <XCircle className="w-4 h-4 text-danger" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-surface-100">
                      {getStatusLabel(status)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Voting Progress */}
          {progress && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-surface-100 mb-4">Voting Progress</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-accent">Approve</span>
                  <span className="text-surface-200">{progress.approveVotes.toString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-danger">Reject</span>
                  <span className="text-surface-200">{progress.rejectVotes.toString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-surface-400">Abstain</span>
                  <span className="text-surface-200">{progress.abstainVotes.toString()}</span>
                </div>
                <hr className="border-surface-700" />
                <div className="flex justify-between text-sm">
                  <span className="text-surface-400">Total Votes</span>
                  <span className="text-surface-200">
                    {progress.totalVotes.toString()} / {progress.requiredQuorum.toString()}
                  </span>
                </div>
                {progress.quorumReached && (
                  <div className="flex items-center gap-2 text-accent">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">Quorum Reached</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Council Info */}
          {(council || subgraphCouncil) && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-surface-100 mb-4">Council</h3>
              <div className="space-y-2">
                <p className="text-surface-100 font-medium">{councilName}</p>
                {(council?.vertical || subgraphCouncil?.vertical) && (
                  <p className="text-sm text-surface-400">{council?.vertical || subgraphCouncil?.vertical}</p>
                )}
                {council?.description && (
                  <p className="text-sm text-surface-500">{council.description}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
