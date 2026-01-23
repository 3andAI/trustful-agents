import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { 
  ArrowLeft, 
  FileText, 
  Upload, 
  Check, 
  ExternalLink,
  Shield,
  Clock,
  AlertCircle,
  Hash,
  Globe,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, Button, Alert, Badge } from '../components/ui'
import { useTransactionToast } from '../components/Toast'
import { useAgent, useAgentOwner } from '../hooks/useAgents'
import { useAgentTerms, useTermsHistory, useRegisterTerms, useActiveCouncils, useCouncil, hashFileContent } from '../hooks/useTerms'
import { uploadToIPFS, getIPFSGatewayUrl, isPinataConfigured } from '../services/pinata'
import { shortenHash, formatTimestamp } from '../lib/utils'

type Step = 'upload' | 'council' | 'register'

export default function TermsPage() {
  const { agentId } = useParams<{ agentId: string }>()
  const { address } = useAccount()
  const queryClient = useQueryClient()

  const { agent, isLoading: agentLoading } = useAgent(agentId)
  const { owner } = useAgentOwner(agentId)
  const { terms, version, hasTerms, refetch: refetchTerms } = useAgentTerms(agentId)
  const { history, activeVersion, versionCount, isLoading: historyLoading } = useTermsHistory(agentId)
  const { council: currentCouncil } = useCouncil(terms?.councilId)

  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase()

  const refreshAllData = async () => {
    await new Promise(resolve => setTimeout(resolve, 2000))
    queryClient.invalidateQueries()
    refetchTerms()
  }

  if (agentLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-surface-100">Agent not found</h2>
        <Link to="/agents" className="text-accent hover:underline mt-2 block">
          Back to agents
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to={`/agents/${agentId}`}
          className="p-2 rounded-lg bg-surface-800 hover:bg-surface-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-surface-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Terms & Conditions</h1>
          <p className="text-surface-400">Agent #{agentId}</p>
        </div>
      </div>

      {/* Ownership Warning */}
      {!isOwner && (
        <Alert variant="warning" title="View Only">
          You don't own this agent. You can view terms but cannot make changes.
        </Alert>
      )}

      {/* Current Terms */}
      {hasTerms && terms && (
        <CurrentTermsCard 
          terms={terms} 
          version={version!} 
          council={currentCouncil}
        />
      )}

      {/* Terms History */}
      {hasTerms && history.length > 1 && (
        <TermsHistoryCard 
          history={history}
          activeVersion={activeVersion}
          isLoading={historyLoading}
        />
      )}

      {/* Register New Terms Wizard */}
      {isOwner && (
        <RegisterTermsWizard 
          agentId={agentId!} 
          hasExistingTerms={hasTerms ?? false}
          existingCouncilId={terms?.councilId}
          onSuccess={refreshAllData}
        />
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About Terms & Conditions</CardTitle>
          </CardHeader>
          <div className="text-sm text-surface-400 space-y-2">
            <p>
              Terms & Conditions define what your agent commits to. Clients can 
              file claims against your collateral if these terms are violated.
            </p>
            <p>
              The document is stored on IPFS and its hash is recorded on-chain
              for tamper-proof verification.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Council Selection</CardTitle>
          </CardHeader>
          <div className="text-sm text-surface-400 space-y-2">
            <p>
              Each agent must be assigned to a council that handles disputes.
              Councils specialize in different verticals (e.g., Finance, Healthcare).
            </p>
            <p>
              Choose a council that matches your agent's domain for best results.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}

// =============================================================================
// Current Terms Card
// =============================================================================

interface CurrentTermsCardProps {
  terms: {
    contentHash: `0x${string}`
    contentUri: string
    councilId: `0x${string}`
    registeredAt: bigint
    active: boolean
  }
  version: bigint
  council?: {
    name: string
    vertical: string
  }
}

function CurrentTermsCard({ terms, version, council }: CurrentTermsCardProps) {
  const gatewayUrl = getIPFSGatewayUrl(terms.contentUri)

  return (
    <Card className="border-success/30 bg-success/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
              <Check className="w-5 h-5 text-success" />
            </div>
            <div>
              <CardTitle>Active Terms</CardTitle>
              <CardDescription>Version {version.toString()}</CardDescription>
            </div>
          </div>
          <Badge variant="success">Active</Badge>
        </div>
      </CardHeader>

      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-surface-800/50">
            <div className="flex items-center gap-2 text-sm text-surface-400 mb-1">
              <Hash className="w-4 h-4" />
              Content Hash
            </div>
            <p className="font-mono text-surface-200 text-sm">
              {shortenHash(terms.contentHash, 10)}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-surface-800/50">
            <div className="flex items-center gap-2 text-sm text-surface-400 mb-1">
              <Clock className="w-4 h-4" />
              Registered
            </div>
            <p className="text-surface-200 text-sm">
              {formatTimestamp(terms.registeredAt)}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-surface-800/50">
            <div className="flex items-center gap-2 text-sm text-surface-400 mb-1">
              <Shield className="w-4 h-4" />
              Council
            </div>
            <p className="text-surface-200 text-sm">
              {council?.name || shortenHash(terms.councilId, 8)}
              {council?.vertical && (
                <span className="text-surface-400 ml-2">({council.vertical})</span>
              )}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-surface-800/50">
            <div className="flex items-center gap-2 text-sm text-surface-400 mb-1">
              <Globe className="w-4 h-4" />
              Document
            </div>
            <a
              href={gatewayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline text-sm flex items-center gap-1"
            >
              View on IPFS <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </Card>
  )
}

// =============================================================================
// Terms History Card
// =============================================================================

interface TermsHistoryCardProps {
  history: Array<{
    contentHash: `0x${string}`
    contentUri: string
    councilId: `0x${string}`
    registeredAt: bigint
    active: boolean
  }>
  activeVersion: bigint | undefined
  isLoading: boolean
}

function TermsHistoryCard({ history, activeVersion, isLoading }: TermsHistoryCardProps) {
  const [expanded, setExpanded] = useState(false)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Terms History</CardTitle>
        </CardHeader>
        <div className="flex items-center gap-2 text-surface-400 p-4">
          <div className="spinner" />
          Loading history...
        </div>
      </Card>
    )
  }

  // Skip showing if only 1 version (already shown in CurrentTermsCard)
  if (history.length <= 1) return null

  // Previous versions (exclude the active one)
  const previousVersions = history.slice(0, -1).reverse() // Oldest first, then reverse to show newest first
  const displayVersions = expanded ? previousVersions : previousVersions.slice(0, 3)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Terms History</CardTitle>
          <Badge variant="neutral">{history.length} versions</Badge>
        </div>
        <CardDescription>Previous terms versions are preserved for historical claims</CardDescription>
      </CardHeader>

      <div className="space-y-3 mt-4">
        {displayVersions.map((terms, idx) => {
          const versionNumber = history.length - 1 - previousVersions.indexOf(terms)
          const gatewayUrl = getIPFSGatewayUrl(terms.contentUri)
          
          return (
            <div 
              key={idx} 
              className="p-3 rounded-lg bg-surface-800/50 border border-surface-700"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-surface-400" />
                  <span className="text-sm font-medium text-surface-200">
                    Version {versionNumber}
                  </span>
                </div>
                <span className="text-xs text-surface-500">
                  {formatTimestamp(terms.registeredAt)}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-surface-400 font-mono text-xs">
                  {shortenHash(terms.contentHash, 8)}
                </span>
                <a
                  href={gatewayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline text-xs flex items-center gap-1"
                >
                  View <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )
        })}

        {previousVersions.length > 3 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setExpanded(!expanded)}
            className="w-full"
          >
            {expanded 
              ? `Show less` 
              : `Show ${previousVersions.length - 3} more versions`
            }
          </Button>
        )}
      </div>
    </Card>
  )
}

// =============================================================================
// Register Terms Wizard (Two-Step Process)
// =============================================================================

interface RegisterTermsWizardProps {
  agentId: string
  hasExistingTerms: boolean
  existingCouncilId?: `0x${string}`
  onSuccess: () => void
}

function RegisterTermsWizard({ agentId, hasExistingTerms, existingCouncilId, onSuccess }: RegisterTermsWizardProps) {
  // If updating existing terms, skip council step (go directly from upload to register)
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [contentHash, setContentHash] = useState<`0x${string}` | null>(null)
  const [ipfsUri, setIpfsUri] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'hashing' | 'uploading' | 'done' | 'error'>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectedCouncil, setSelectedCouncil] = useState<`0x${string}` | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toastIdRef = useRef<string | null>(null)
  const { showPending, showConfirming, showSuccess, showError } = useTransactionToast()

  // Only load councils if this is first registration
  const { councils, councilIds, isLoading: councilsLoading, error: councilsError } = useActiveCouncils()
  const { registerTerms, hash, isPending, isConfirming, isSuccess, error, reset } = useRegisterTerms()

  // The council to use: existing one for updates, or selected one for first registration
  const councilToUse = hasExistingTerms ? existingCouncilId : selectedCouncil

  // Reset wizard
  const resetWizard = () => {
    setStep('upload')
    setFile(null)
    setContentHash(null)
    setIpfsUri(null)
    setSelectedCouncil(null)
    setUploadStatus('idle')
    setUploadError(null)
    reset()
  }

  // Handle file selection
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    if (!isPinataConfigured()) {
      setUploadStatus('error')
      setUploadError('Pinata API keys not configured. Please set VITE_PINATA_API_KEY and VITE_PINATA_SECRET_KEY in .env file.')
      return
    }

    setFile(selectedFile)
    setUploadStatus('hashing')
    setUploadError(null)
    setIpfsUri(null)

    try {
      // Hash the file content
      const hash = await hashFileContent(selectedFile)
      setContentHash(hash)
      
      // Upload to IPFS
      setUploadStatus('uploading')
      const result = await uploadToIPFS(selectedFile)
      setIpfsUri(result.uri)
      setUploadStatus('done')
    } catch (err) {
      setUploadStatus('error')
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
      setContentHash(null)
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }

  // Transaction handlers
  useEffect(() => {
    if (isPending && !toastIdRef.current) {
      toastIdRef.current = showPending('Registering Terms')
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
        showSuccess(toastIdRef.current, 'Terms Registered', hash)
        toastIdRef.current = null
      }
      onSuccess()
      resetWizard()
    }
  }, [isSuccess, hash, showSuccess, onSuccess])

  useEffect(() => {
    if (error && toastIdRef.current) {
      showError(toastIdRef.current, error.message)
      toastIdRef.current = null
    }
  }, [error, showError])

  const handleRegister = () => {
    if (!contentHash || !ipfsUri || !councilToUse) return
    registerTerms(agentId, contentHash, ipfsUri, councilToUse)
  }

  const isProcessing = isPending || isConfirming

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-accent" />
          </div>
          <div>
            <CardTitle>{hasExistingTerms ? 'Update Terms' : 'Register Terms'}</CardTitle>
            <CardDescription>
              {hasExistingTerms 
                ? 'Upload a new version of your Terms & Conditions'
                : 'Upload your Terms & Conditions document'
              }
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {/* Step Indicator */}
      <div className="mt-6 mb-6">
        <div className="flex items-center gap-2">
          <StepIndicator 
            number={1} 
            label="Upload Document" 
            active={step === 'upload'} 
            completed={uploadStatus === 'done'} 
          />
          <ChevronRight className="w-4 h-4 text-surface-600" />
          {!hasExistingTerms && (
            <>
              <StepIndicator 
                number={2} 
                label="Select Council" 
                active={step === 'council'} 
                completed={!!selectedCouncil} 
              />
              <ChevronRight className="w-4 h-4 text-surface-600" />
            </>
          )}
          <StepIndicator 
            number={hasExistingTerms ? 2 : 3} 
            label="Register On-Chain" 
            active={step === 'register'} 
            completed={isSuccess} 
          />
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors
              ${uploadStatus === 'done' 
                ? 'border-success/50 bg-success/5' 
                : uploadStatus === 'error'
                ? 'border-danger/50 bg-danger/5'
                : 'border-surface-700 hover:border-surface-600 hover:bg-surface-800/50'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,.doc,.docx"
              onChange={handleFileChange}
              className="hidden"
            />

            {uploadStatus === 'idle' && (
              <>
                <Upload className="w-10 h-10 text-surface-400 mx-auto mb-3" />
                <p className="text-surface-200 mb-1">
                  Drop your T&C document here or click to browse
                </p>
                <p className="text-sm text-surface-500">
                  PDF, TXT, MD, DOC, DOCX
                </p>
              </>
            )}

            {uploadStatus === 'hashing' && (
              <>
                <div className="spinner mx-auto mb-3" />
                <p className="text-surface-200">Hashing document...</p>
              </>
            )}

            {uploadStatus === 'uploading' && (
              <>
                <div className="spinner mx-auto mb-3" />
                <p className="text-surface-200">Uploading to IPFS...</p>
              </>
            )}

            {uploadStatus === 'done' && file && (
              <>
                <Check className="w-10 h-10 text-success mx-auto mb-3" />
                <p className="text-surface-200 mb-1">{file.name}</p>
                <p className="text-sm text-surface-500">
                  Click to replace
                </p>
              </>
            )}

            {uploadStatus === 'error' && (
              <>
                <AlertCircle className="w-10 h-10 text-danger mx-auto mb-3" />
                <p className="text-danger mb-1">Upload failed</p>
                <p className="text-sm text-surface-500">
                  {uploadError || 'Click to try again'}
                </p>
              </>
            )}
          </div>

          {/* Hash & IPFS Info */}
          {contentHash && ipfsUri && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-surface-800/50">
                <div className="flex items-center gap-2 text-sm text-surface-400 mb-1">
                  <Hash className="w-4 h-4" />
                  Content Hash
                </div>
                <p className="font-mono text-surface-200 text-sm truncate">
                  {shortenHash(contentHash, 12)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-surface-800/50">
                <div className="flex items-center gap-2 text-sm text-surface-400 mb-1">
                  <Globe className="w-4 h-4" />
                  IPFS URI
                </div>
                <a
                  href={getIPFSGatewayUrl(ipfsUri)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline text-sm flex items-center gap-1"
                >
                  View on IPFS <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          <Button
            onClick={() => setStep(hasExistingTerms ? 'register' : 'council')}
            disabled={uploadStatus !== 'done'}
            className="w-full"
            size="lg"
          >
            {hasExistingTerms ? 'Continue to Register' : 'Continue to Council Selection'}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      {/* Step 2: Select Council */}
      {step === 'council' && (
        <div className="space-y-4">
          {/* Back button */}
          <Button variant="ghost" size="sm" onClick={() => setStep('upload')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Upload
          </Button>

          {/* Document Summary */}
          <div className="p-4 rounded-lg bg-surface-800/50 flex items-center gap-4">
            <FileText className="w-8 h-8 text-success" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-surface-100 truncate">{file?.name}</p>
              <p className="text-sm text-surface-400">Uploaded to IPFS</p>
            </div>
            <a
              href={getIPFSGatewayUrl(ipfsUri!)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline text-sm flex items-center gap-1"
            >
              View <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Council Selection */}
          <div>
            <label className="label">Select Council</label>
            
            {councilsLoading && (
              <div className="flex items-center gap-2 text-surface-400 p-4">
                <div className="spinner" />
                Loading councils from blockchain...
              </div>
            )}

            {councilsError && (
              <Alert variant="danger" title="Failed to Load Councils">
                <p className="mb-2">Could not fetch councils from the blockchain.</p>
                <p className="text-sm opacity-80">Error: {councilsError.message}</p>
              </Alert>
            )}

            {!councilsLoading && !councilsError && councils.length === 0 && (
              <Alert variant="warning" title="No Active Councils">
                <p className="mb-2">There are no active councils available on-chain.</p>
                {councilIds && councilIds.length > 0 ? (
                  <p className="text-sm opacity-80">
                    Found {councilIds.length} council ID(s) but none are active.
                  </p>
                ) : (
                  <p className="text-sm opacity-80">
                    No council IDs returned from CouncilRegistry.getActiveCouncils()
                  </p>
                )}
                <p className="text-sm opacity-80 mt-2">
                  Please create councils using the Governance Dashboard first.
                </p>
              </Alert>
            )}

            {!councilsLoading && councils.length > 0 && (
              <div className="space-y-2">
                {councils.map((council) => (
                  <button
                    key={council.councilId}
                    onClick={() => setSelectedCouncil(council.councilId)}
                    className={`
                      w-full p-4 rounded-lg border text-left transition-all
                      ${selectedCouncil === council.councilId
                        ? 'border-accent bg-accent/10'
                        : 'border-surface-700 hover:border-surface-600 bg-surface-800/50'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-surface-100">{council.name}</p>
                        <p className="text-sm text-surface-400">{council.vertical}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-surface-400">
                          {council.memberCount.toString()} members
                        </p>
                        <p className="text-xs text-surface-500">
                          {Number(council.quorumPercentage) / 100}% quorum
                        </p>
                      </div>
                    </div>
                    {council.description && (
                      <p className="text-sm text-surface-500 mt-2 line-clamp-2">
                        {council.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={() => setStep('register')}
            disabled={!selectedCouncil}
            className="w-full"
            size="lg"
          >
            Continue to Register
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      {/* Step 3: Register On-Chain */}
      {step === 'register' && (
        <div className="space-y-4">
          {/* Back button */}
          <Button variant="ghost" size="sm" onClick={() => setStep(hasExistingTerms ? 'upload' : 'council')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {hasExistingTerms ? 'Back to Upload' : 'Back to Council Selection'}
          </Button>

          {/* Summary */}
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-surface-800/50">
              <p className="text-sm text-surface-400 mb-1">Document</p>
              <p className="font-medium text-surface-100">{file?.name}</p>
              <p className="text-sm text-surface-500 font-mono mt-1">
                Hash: {shortenHash(contentHash!, 12)}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-surface-800/50">
              <p className="text-sm text-surface-400 mb-1">Council</p>
              <p className="font-medium text-surface-100">
                {councils.find(c => c.councilId === councilToUse)?.name || shortenHash(councilToUse!, 8)}
              </p>
              <p className="text-sm text-surface-500 mt-1">
                {councils.find(c => c.councilId === councilToUse)?.vertical}
                {hasExistingTerms && (
                  <span className="text-surface-400 ml-2">(unchanged - contact governance to reassign)</span>
                )}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-surface-800/50">
              <p className="text-sm text-surface-400 mb-1">IPFS Location</p>
              <a
                href={getIPFSGatewayUrl(ipfsUri!)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline flex items-center gap-1"
              >
                {ipfsUri} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <Alert variant="info" title="On-Chain Registration">
            This will record the content hash and IPFS URI on the blockchain.
            You will need to confirm the transaction in your wallet.
          </Alert>

          <Button
            onClick={handleRegister}
            disabled={isProcessing}
            loading={isProcessing}
            className="w-full"
            size="lg"
          >
            {isPending ? 'Confirm in wallet...' : isConfirming ? 'Registering...' : 'Register Terms On-Chain'}
          </Button>
        </div>
      )}
    </Card>
  )
}

// =============================================================================
// Step Indicator
// =============================================================================

function StepIndicator({ number, label, active, completed }: { 
  number: number
  label: string
  active: boolean
  completed: boolean 
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={`
        w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium
        ${completed 
          ? 'bg-success text-white' 
          : active 
          ? 'bg-accent text-white' 
          : 'bg-surface-700 text-surface-400'
        }
      `}>
        {completed ? <Check className="w-4 h-4" /> : number}
      </div>
      <span className={`text-sm ${active ? 'text-surface-100' : 'text-surface-400'}`}>
        {label}
      </span>
    </div>
  )
}
