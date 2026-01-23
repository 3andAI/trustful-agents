import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { Bot, Shield, Coins, FileText, AlertTriangle, ChevronRight, Check, Zap, ExternalLink, Pencil, X, Save, Clock, DollarSign, User } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, Badge, Button, StatCard, LoadingState, Alert, Input } from '../components/ui'
import { useTransactionToast } from '../components/Toast'
import { useAgent, useRequestValidation } from '../hooks/useAgents'
import { useAgentTerms, useCouncil } from '../hooks/useTerms'
import { useAgentClaims, ClaimStatus, getStatusLabel, getStatusVariant, getEvidenceTimeRemaining } from '../hooks/useClaims'
import { formatUsdc, formatTimestamp } from '../lib/utils'
import { CONTRACTS, BLOCK_EXPLORER_URL, API_BASE_URL } from '../config/contracts'

interface AgentMetadata {
  agent_id: string
  owner_address: string
  name: string
  description: string | null
  capabilities: string[] | null
  website_url: string | null
}

export default function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>()
  const { address } = useAccount()
  const queryClient = useQueryClient()
  const { agent, conditions, isLoading, exists } = useAgent(agentId)
  const { terms, version: termsVersion } = useAgentTerms(agentId)
  const { council } = useCouncil(terms?.councilId)
  const { claims, isLoading: claimsLoading, pendingCount: pendingClaimsCount, totalCount: totalClaimsCount } = useAgentClaims(agentId)
  const [metadata, setMetadata] = useState<AgentMetadata | null>(null)
  const [metadataLoading, setMetadataLoading] = useState(true)

  // Fetch metadata from API
  useEffect(() => {
    async function fetchMetadata() {
      if (!agentId) return
      setMetadataLoading(true)
      try {
        const response = await fetch(API_BASE_URL + '/provider/agents/' + agentId)
        if (response.ok) {
          const data = await response.json()
          setMetadata(data)
        }
      } catch (err) {
        console.error('Failed to fetch metadata:', err)
      } finally {
        setMetadataLoading(false)
      }
    }
    fetchMetadata()
  }, [agentId])

  const refreshData = async () => {
    await new Promise(resolve => setTimeout(resolve, 2000))
    queryClient.invalidateQueries()
  }

  const refreshMetadata = async () => {
    if (!agentId) return
    try {
      const response = await fetch(API_BASE_URL + '/provider/agents/' + agentId)
      if (response.ok) {
        const data = await response.json()
        setMetadata(data)
      }
    } catch (err) {
      console.error('Failed to refresh metadata:', err)
    }
  }

  if (isLoading) {
    return <LoadingState message="Loading agent details..." />
  }

  if (!exists) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <Bot className="w-16 h-16 text-surface-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-surface-100 mb-2">Agent Not Found</h2>
        <p className="text-surface-400 mb-6">Agent #{agentId} does not exist.</p>
        <Link to="/dashboard"><Button variant="secondary">Back to Dashboard</Button></Link>
      </div>
    )
  }

  const isOwner = address && agent?.owner && address.toLowerCase() === agent.owner.toLowerCase()
  const isValidated = agent?.validation?.isValid ?? false
  const collateralBalance = agent?.collateral?.balance ?? BigInt(0)
  const lockedAmount = agent?.collateral?.lockedAmount ?? BigInt(0)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
            <Bot className="w-7 h-7 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-100">
              {metadata?.name || `Agent #${agentId}`}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-surface-500">#{agentId}</span>
              <Badge variant={isValidated ? 'success' : 'neutral'}>
                {isValidated ? 'Validated' : 'Not Validated'}
              </Badge>
              {isOwner && <Badge variant="primary">Owner</Badge>}
            </div>
          </div>
        </div>
        
        <a 
          href={`${BLOCK_EXPLORER_URL}/nft/${CONTRACTS.erc8004Registry}/${agentId}`} 
          target="_blank" 
          rel="noopener noreferrer"
        >
          <Button variant="ghost" size="sm">
            <ExternalLink className="w-4 h-4 mr-2" /> View NFT on Explorer
          </Button>
        </a>
      </div>

      {!isOwner && (
        <Alert variant="info" title="Third-Party View">
          You can view this agent and deposit collateral to support it.
        </Alert>
      )}

      {/* Agent Info Card - Editable by owner */}
      {isOwner && (
        <AgentInfoCard 
          agentId={agentId!}
          metadata={metadata}
          ownerAddress={address!}
          onUpdate={refreshMetadata}
        />
      )}

      {/* Validation Status */}
      <ValidationStatusCard 
        agentId={agentId!}
        isValidated={isValidated} 
        conditions={conditions} 
        isOwner={isOwner ?? false}
        collateralBalance={collateralBalance}
        ownerAddress={agent?.owner}
        termsUri={terms?.contentUri}
        councilName={council?.name}
        onValidationSuccess={refreshData}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Collateral" value={`${formatUsdc(collateralBalance)} USDC`} icon={<Coins className="w-5 h-5" />} />
        <StatCard label="Available" value={`${formatUsdc(collateralBalance - lockedAmount)} USDC`} subValue="after locks" icon={<Coins className="w-5 h-5" />} />
        <StatCard label="Terms Version" value={termsVersion !== undefined ? `v${termsVersion.toString()}` : 'None'} icon={<FileText className="w-5 h-5" />} />
        <StatCard label="Pending Claims" value={pendingClaimsCount} icon={<AlertTriangle className="w-5 h-5" />} />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to={`/agents/${agentId}/collateral`}>
          <Card className="hover:border-surface-700 transition-colors h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Coins className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-medium text-surface-100">
                    {isOwner ? 'Manage Collateral' : 'Deposit Collateral'}
                  </h3>
                  <p className="text-sm text-surface-400">
                    {isOwner ? 'Deposit or withdraw USDC' : 'Support this agent with USDC'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-surface-500" />
            </div>
          </Card>
        </Link>

        <Link to={`/agents/${agentId}/terms`}>
          <Card className="hover:border-surface-700 transition-colors h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-success" />
                </div>
                <div>
                  <h3 className="font-medium text-surface-100">Terms & Conditions</h3>
                  <p className="text-sm text-surface-400">
                    {isOwner ? 'Register or update T&C' : 'View agent terms'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-surface-500" />
            </div>
          </Card>
        </Link>
      </div>

      {/* Claims Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-surface-100 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Claims
          </h2>
          <p className="text-sm text-surface-400">
            {totalClaimsCount} total, {pendingClaimsCount} pending
          </p>
        </div>

        {claimsLoading && (
          <Card>
            <div className="flex items-center justify-center py-8">
              <div className="spinner" />
              <span className="ml-3 text-surface-400">Loading claims...</span>
            </div>
          </Card>
        )}

        {!claimsLoading && claims.length === 0 && (
          <Card>
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-surface-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-surface-100 mb-2">No Claims</h3>
              <p className="text-surface-400">This agent has no claims filed against it yet.</p>
            </div>
          </Card>
        )}

        {!claimsLoading && claims.length > 0 && (
          <div className="space-y-3">
            {claims.map((claim) => {
              const evidenceRemaining = getEvidenceTimeRemaining(claim)
              const isEvidenceOpen = claim.status === ClaimStatus.Filed && evidenceRemaining.total > 0

              return (
                <Link key={claim.id.toString()} to={`/agents/${agentId}/claims/${claim.id.toString()}`}>
                  <Card className="hover:border-surface-600 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                          <AlertTriangle className="w-6 h-6 text-warning" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-surface-100">
                              Claim #{claim.id.toString()}
                            </h3>
                            <Badge variant={getStatusVariant(claim.status)}>
                              {getStatusLabel(claim.status)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-surface-400">
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {formatUsdc(claim.claimedAmount)} USDC claimed
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {claim.claimant.slice(0, 6)}...{claim.claimant.slice(-4)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Filed {formatTimestamp(claim.filedAt, { relative: true })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {isEvidenceOpen && (
                          <div className="text-right">
                            <p className="text-xs text-surface-500">Evidence closes in</p>
                            <p className="text-sm font-medium text-warning">
                              {evidenceRemaining.days > 0 && `${evidenceRemaining.days}d `}
                              {evidenceRemaining.hours}h {evidenceRemaining.minutes}m
                            </p>
                          </div>
                        )}
                        <ChevronRight className="w-5 h-5 text-surface-500" />
                      </div>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function ValidationStatusCard({ 
  agentId,
  isValidated, 
  conditions,
  isOwner,
  collateralBalance,
  ownerAddress,
  termsUri,
  councilName,
  onValidationSuccess,
}: { 
  agentId: string
  isValidated: boolean
  conditions?: { hasMinimumCollateral: boolean; hasActiveTerms: boolean; isOwnerValid: boolean; councilIsActive: boolean }
  isOwner: boolean
  collateralBalance?: bigint
  ownerAddress?: string
  termsUri?: string
  councilName?: string
  onValidationSuccess: () => void
}) {
  const toastIdRef = useRef<string | null>(null)
  const { showPending, showConfirming, showSuccess, showError } = useTransactionToast()
  const { requestValidation, hash, isPending, isConfirming, isSuccess, error, reset } = useRequestValidation()

  // Council is only relevant if terms are registered
  // If no terms, council check returns true by default but shouldn't show as "met"
  const councilRelevant = conditions?.hasActiveTerms ?? false
  const allMet = conditions && 
    conditions.hasMinimumCollateral && 
    conditions.hasActiveTerms && 
    conditions.isOwnerValid && 
    (councilRelevant ? conditions.councilIsActive : false)

  // Transaction handlers
  useEffect(() => {
    if (isPending && !toastIdRef.current) {
      toastIdRef.current = showPending('Requesting Validation')
    }
  }, [isPending, showPending])

  useEffect(() => {
    if (isConfirming && hash && toastIdRef.current) {
      showConfirming(toastIdRef.current, hash)
    }
  }, [isConfirming, hash, showConfirming])

  useEffect(() => {
    if (isSuccess) {
      if (toastIdRef.current) {
        showSuccess(toastIdRef.current, 'Validation Successful', hash)
        toastIdRef.current = null
      }
      onValidationSuccess()
      reset()
    }
  }, [isSuccess, hash, showSuccess, onValidationSuccess, reset])

  useEffect(() => {
    if (error && toastIdRef.current) {
      showError(toastIdRef.current, error.message)
      toastIdRef.current = null
    }
  }, [error, showError])

  const handleRequestValidation = () => {
    requestValidation(agentId)
  }

  const isProcessing = isPending || isConfirming

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isValidated ? 'bg-success/10' : 'bg-surface-800'}`}>
              <Shield className={`w-5 h-5 ${isValidated ? 'text-success' : 'text-surface-400'}`} />
            </div>
            <div>
              <CardTitle>Validation Status</CardTitle>
              <CardDescription>
                {isValidated 
                  ? 'Your agent is validated and discoverable' 
                  : allMet 
                  ? 'All conditions met - request validation to complete' 
                  : 'Complete the following to get validated'}
              </CardDescription>
            </div>
          </div>
          <Badge variant={isValidated ? 'success' : allMet ? 'warning' : 'neutral'}>
            {isValidated ? 'Validated' : allMet ? 'Ready' : 'Not Valid'}
          </Badge>
        </div>
      </CardHeader>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <ConditionItem 
          label="Minimum Collateral" 
          met={conditions?.hasMinimumCollateral ?? false} 
          hint="Deposit at least 100 USDC" 
          info={collateralBalance !== undefined ? `${formatUsdc(collateralBalance)} USDC deposited` : undefined}
        />
        <ConditionItem 
          label="Active Terms" 
          met={conditions?.hasActiveTerms ?? false} 
          hint="Register your T&C document" 
          info={termsUri ? termsUri.replace('ipfs://', 'ipfs://').substring(0, 30) + '...' : undefined}
          link={termsUri}
        />
        <ConditionItem 
          label="Owner Valid" 
          met={conditions?.isOwnerValid ?? false} 
          hint="Ownership verified" 
          info={ownerAddress ? `${ownerAddress.slice(0, 6)}...${ownerAddress.slice(-4)}` : undefined}
        />
        <ConditionItem 
          label="Council Active" 
          met={councilRelevant && (conditions?.councilIsActive ?? false)} 
          hint={councilRelevant ? "Selected council must be active" : "Register terms to assign a council"}
          notApplicable={!councilRelevant}
          info={councilName}
        />
      </div>

      {/* Request Validation Button */}
      {!isValidated && allMet && isOwner && (
        <div className="mt-6 pt-4 border-t border-surface-800">
          <Button
            onClick={handleRequestValidation}
            disabled={isProcessing}
            loading={isProcessing}
            className="w-full"
            size="lg"
          >
            <Zap className="w-4 h-4 mr-2" />
            {isPending ? 'Confirm in wallet...' : isConfirming ? 'Validating...' : 'Request Validation'}
          </Button>
          <p className="text-sm text-surface-500 text-center mt-2">
            This will register your agent as validated on-chain
          </p>
        </div>
      )}
    </Card>
  )
}

function ConditionItem({ label, met, hint, notApplicable, info, link }: { label: string; met: boolean; hint?: string; notApplicable?: boolean; info?: string; link?: string }) {
  return (
    <div className={`p-3 rounded-lg ${met ? 'bg-success/10' : notApplicable ? 'bg-surface-800/30' : 'bg-surface-800/50'}`}>
      <div className="flex items-center gap-2">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
          met ? 'bg-success text-white' : notApplicable ? 'bg-surface-700 text-surface-500' : 'bg-surface-700 text-surface-400'
        }`}>
          {met ? '✓' : notApplicable ? '—' : '○'}
        </div>
        <span className={`font-medium ${met ? 'text-success-light' : notApplicable ? 'text-surface-500' : 'text-surface-300'}`}>{label}</span>
      </div>
      {info && met && (
        <p className="text-xs text-surface-400 mt-1 ml-7">
          {link ? (
            <a href={link.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${link.replace('ipfs://', '')}` : link} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              {info}
            </a>
          ) : info}
        </p>
      )}
      {hint && !met && <p className="text-xs text-surface-500 mt-1 ml-7">{hint}</p>}
    </div>
  )
}

function AgentInfoCard({ 
  agentId, 
  metadata, 
  ownerAddress,
  onUpdate 
}: { 
  agentId: string
  metadata: AgentMetadata | null
  ownerAddress: string
  onUpdate: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(metadata?.name || '')
  const [description, setDescription] = useState(metadata?.description || '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Update form when metadata loads
  useEffect(() => {
    if (metadata) {
      setName(metadata.name)
      setDescription(metadata.description || '')
    }
  }, [metadata])

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    
    setIsSaving(true)
    setError(null)
    
    try {
      const isCreating = !metadata
      let url: string
      let method: string
      let body: object
      
      if (isCreating) {
        url = API_BASE_URL + '/provider/agents'
        method = 'POST'
        body = { agentId, ownerAddress, name: name.trim(), description: description.trim() || undefined }
      } else {
        url = API_BASE_URL + '/provider/agents/' + agentId
        method = 'PUT'
        body = { name: name.trim(), description: description.trim() || undefined }
      }
      
      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-owner-address': ownerAddress,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save')
      }

      setIsEditing(false)
      onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setName(metadata?.name || '')
    setDescription(metadata?.description || '')
    setError(null)
    setIsEditing(false)
  }

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-medium text-surface-200">Agent Information</h3>
            {!isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="p-1 rounded hover:bg-surface-800 transition-colors"
              >
                <Pencil className="w-4 h-4 text-surface-500 hover:text-surface-300" />
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <Input
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., My Trading Bot"
                required
              />
              <div>
                <label className="block text-sm font-medium text-surface-200 mb-2">
                  Description <span className="text-surface-500">(optional)</span>
                </label>
                <textarea
                  className="w-full px-4 py-3 rounded-lg bg-surface-800 border border-surface-700 text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors resize-none"
                  rows={3}
                  placeholder="Describe what your agent does..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                />
              </div>
              
              {error && <p className="text-danger text-sm">{error}</p>}
              
              <div className="flex gap-2">
                <Button onClick={handleSave} loading={isSaving} size="sm">
                  <Save className="w-4 h-4 mr-1" /> Save
                </Button>
                <Button onClick={handleCancel} variant="ghost" size="sm" disabled={isSaving}>
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {metadata ? (
                <>
                  <p className="text-surface-100 font-medium">{metadata.name}</p>
                  {metadata.description && (
                    <p className="text-surface-400 text-sm mt-1">{metadata.description}</p>
                  )}
                </>
              ) : (
                <p className="text-surface-500 text-sm italic">
                  No metadata set. Click the pencil to add name and description.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
