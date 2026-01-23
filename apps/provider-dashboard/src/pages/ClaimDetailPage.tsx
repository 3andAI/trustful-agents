import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { 
  AlertTriangle, 
  Clock, 
  ArrowLeft, 
  DollarSign, 
  User, 
  FileText,
  ExternalLink,
  Shield,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { Card, Badge, Button, LoadingState, StatCard } from '../components/ui'
import { useClaim, useClaimCouncil, ClaimStatus, getStatusLabel, getStatusVariant, isEvidencePeriodOpen, getEvidenceTimeRemaining } from '../hooks/useClaims'
import { formatUsdc, formatTimestamp, shortenAddress, shortenHash } from '../lib/utils'
import { API_BASE_URL, BLOCK_EXPLORER_URL } from '../config/contracts'
import ClaimConversation, { type AuthorRole } from '../components/ClaimConversation'

export default function ClaimDetailPage() {
  const { agentId, claimId } = useParams<{ agentId: string; claimId: string }>()
  const { address } = useAccount()
  const { claim, isLoading, error, refetch } = useClaim(claimId)
  const { council } = useClaimCouncil(claim?.councilId)
  
  const [claimDescription, setClaimDescription] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<AuthorRole | null>(null)

  // Fetch claim metadata (description)
  useEffect(() => {
    if (claimId) {
      fetch(`${API_BASE_URL}/claims/${claimId}/metadata`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.description) {
            setClaimDescription(data.description)
          }
        })
        .catch(err => console.error('Failed to fetch claim metadata:', err))
    }
  }, [claimId])

  // Determine user's role in this claim
  useEffect(() => {
    if (!address || !claim) {
      setUserRole(null)
      return
    }
    
    const userLower = address.toLowerCase()
    const claimantLower = claim.claimant?.toLowerCase()
    const providerLower = claim.providerAtClaimTime?.toLowerCase()
    
    if (userLower === claimantLower) {
      setUserRole('claimer')
    } else if (userLower === providerLower) {
      setUserRole('provider')
    } else {
      // Could check if user is a councilor, but for provider dashboard we mainly care about provider role
      setUserRole(null)
    }
  }, [address, claim])

  if (isLoading) {
    return <LoadingState message="Loading claim details..." />
  }

  if (error || !claim) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <AlertTriangle className="w-16 h-16 text-danger mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-surface-100 mb-2">Claim Not Found</h2>
        <p className="text-surface-400 mb-6">
          {error?.message || `Claim #${claimId} does not exist.`}
        </p>
        <Link to={`/agents/${agentId}/claims`}>
          <Button variant="secondary">Back to Claims</Button>
        </Link>
      </div>
    )
  }

  const isOwner = address && claim.providerAtClaimTime.toLowerCase() === address.toLowerCase()
  const evidenceOpen = isEvidencePeriodOpen(claim)
  const evidenceRemaining = getEvidenceTimeRemaining(claim)

  // Convert IPFS URI to HTTP URL
  const evidenceUrl = claim.evidenceUri && claim.evidenceUri.startsWith('ipfs://') 
    ? `https://gateway.pinata.cloud/ipfs/${claim.evidenceUri.replace('ipfs://', '')}`
    : claim.evidenceUri

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to={`/agents/${agentId}/claims`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-surface-100">
                Claim #{claimId}
              </h1>
              <Badge variant={getStatusVariant(claim.status)}>
                {getStatusLabel(claim.status)}
              </Badge>
            </div>
            <p className="text-surface-400 mt-1">
              Against Agent #{agentId}
            </p>
          </div>
        </div>

        {isOwner && (
          <Badge variant="primary" className="self-start sm:self-auto">
            You are the Provider
          </Badge>
        )}
      </div>

      {/* Evidence Period Alert */}
      {evidenceOpen && (
        <Card className="border-warning/30 bg-warning/5">
          <div className="flex items-center gap-4">
            <Clock className="w-6 h-6 text-warning flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-surface-100">Evidence Period Open</h3>
              <p className="text-sm text-surface-400">
                You can submit counter-evidence and respond to the claimant. 
                Time remaining: <span className="text-warning font-medium">
                  {evidenceRemaining.days > 0 && `${evidenceRemaining.days}d `}
                  {evidenceRemaining.hours}h {evidenceRemaining.minutes}m
                </span>
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Claimed Amount" 
          value={`${formatUsdc(claim.claimedAmount)} USDC`} 
          icon={<DollarSign className="w-5 h-5" />} 
        />
        <StatCard 
          label="Approved Amount" 
          value={`${formatUsdc(claim.approvedAmount)} USDC`} 
          icon={<CheckCircle className="w-5 h-5" />} 
        />
        <StatCard 
          label="Locked Collateral" 
          value={`${formatUsdc(claim.lockedCollateral)} USDC`} 
          icon={<DollarSign className="w-5 h-5" />} 
        />
        <StatCard 
          label="Claimant Deposit" 
          value={`${formatUsdc(claim.claimantDeposit)} USDC`} 
          icon={<DollarSign className="w-5 h-5" />} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Claim Details */}
          <Card>
            <h2 className="text-lg font-semibold text-surface-100 mb-4">Claim Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-surface-500">Claimant</p>
                <p className="text-surface-200 font-mono text-sm">
                  {shortenAddress(claim.claimant)}
                </p>
              </div>
              <div>
                <p className="text-sm text-surface-500">Provider (at claim time)</p>
                <p className="text-surface-200 font-mono text-sm">
                  {shortenAddress(claim.providerAtClaimTime)}
                </p>
              </div>
              <div>
                <p className="text-sm text-surface-500">Council</p>
                <p className="text-surface-200">
                  {council?.name || shortenHash(claim.councilId)}
                </p>
              </div>
              <div>
                <p className="text-sm text-surface-500">Filed At</p>
                <p className="text-surface-200">
                  {formatTimestamp(claim.filedAt)}
                </p>
              </div>
            </div>
          </Card>

          {/* Evidence */}
          <Card>
            <h2 className="text-lg font-semibold text-surface-100 mb-4">Evidence</h2>
            <div className="space-y-4">
              <div className="p-4 bg-surface-800 rounded-lg border border-surface-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-surface-400">Primary Evidence</span>
                  {evidenceUrl && (
                    <a 
                      href={evidenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:text-accent/80 flex items-center gap-1"
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
          </Card>

          {/* Conversation */}
          <Card>
            <ClaimConversation
              claimId={claimId!}
              currentUserAddress={address}
              currentUserRole={userRole}
              isEvidencePeriod={evidenceOpen}
              claimantAddress={claim.claimant}
              providerAddress={claim.providerAtClaimTime}
              filedAt={Number(claim.filedAt)}
              initialDescription={claimDescription}
              onMessagePosted={() => refetch()}
            />
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timeline */}
          <Card>
            <h3 className="text-lg font-semibold text-surface-100 mb-4">Timeline</h3>
            <div className="space-y-4">
              <TimelineItem
                icon={<FileText className="w-4 h-4" />}
                title="Claim Filed"
                time={formatTimestamp(claim.filedAt)}
                active
              />
              <TimelineItem
                icon={<Clock className="w-4 h-4" />}
                title="Evidence Deadline"
                time={formatTimestamp(claim.evidenceDeadline)}
                active={Date.now() / 1000 < Number(claim.evidenceDeadline)}
                warning={evidenceOpen}
              />
              <TimelineItem
                icon={<Shield className="w-4 h-4" />}
                title="Voting Deadline"
                time={formatTimestamp(claim.votingDeadline)}
                active={claim.status === ClaimStatus.EvidenceClosed}
              />
              {claim.status === ClaimStatus.Approved && (
                <TimelineItem
                  icon={<CheckCircle className="w-4 h-4" />}
                  title="Approved"
                  time={`${formatUsdc(claim.approvedAmount)} USDC`}
                  active
                  success
                />
              )}
              {claim.status === ClaimStatus.Rejected && (
                <TimelineItem
                  icon={<XCircle className="w-4 h-4" />}
                  title="Rejected"
                  time="Claim was rejected by council"
                  active
                  danger
                />
              )}
            </div>
          </Card>

          {/* Voting Stats (if applicable) */}
          {(claim.votesFor > 0 || claim.votesAgainst > 0 || claim.votesAbstain > 0) && (
            <Card>
              <h3 className="text-lg font-semibold text-surface-100 mb-4">Voting</h3>
              <div className="space-y-3">
                <VoteStat label="For" count={Number(claim.votesFor)} variant="success" />
                <VoteStat label="Against" count={Number(claim.votesAgainst)} variant="danger" />
                <VoteStat label="Abstain" count={Number(claim.votesAbstain)} variant="neutral" />
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function TimelineItem({ 
  icon, 
  title, 
  time, 
  active, 
  warning, 
  success, 
  danger 
}: { 
  icon: React.ReactNode
  title: string
  time: string
  active?: boolean
  warning?: boolean
  success?: boolean
  danger?: boolean
}) {
  let colorClass = 'bg-surface-700 text-surface-400'
  if (warning) colorClass = 'bg-warning/20 text-warning'
  else if (success) colorClass = 'bg-success/20 text-success'
  else if (danger) colorClass = 'bg-danger/20 text-danger'
  else if (active) colorClass = 'bg-accent/20 text-accent'

  return (
    <div className="flex items-start gap-3">
      <div className={`w-8 h-8 rounded-full ${colorClass} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="font-medium text-surface-100">{title}</p>
        <p className="text-sm text-surface-400">{time}</p>
      </div>
    </div>
  )
}

function VoteStat({ 
  label, 
  count, 
  variant 
}: { 
  label: string
  count: number
  variant: 'success' | 'danger' | 'neutral'
}) {
  const colors = {
    success: 'bg-success/20 text-success',
    danger: 'bg-danger/20 text-danger',
    neutral: 'bg-surface-700 text-surface-400',
  }

  return (
    <div className="flex items-center justify-between">
      <span className="text-surface-400">{label}</span>
      <span className={`px-2 py-1 rounded text-sm font-medium ${colors[variant]}`}>
        {count}
      </span>
    </div>
  )
}
