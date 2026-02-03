import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { 
  Search, 
  AlertTriangle, 
  Info,
  Upload,
  FileText,
  DollarSign,
  CheckCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Shield
} from 'lucide-react'
import { 
  CONTRACTS, 
  CLAIMS_MANAGER_ABI, 
  USDC_ABI,
  ERC8004_REGISTRY_ABI,
  COLLATERAL_VAULT_ABI,
  TRUSTFUL_VALIDATOR_ABI
} from '../config/wagmi'
import { 
  formatUSDC, 
  parseUSDC, 
  hashFile, 
  formatAddress,
  getAgentDisplayName,
  fileToBase64DataUri,
  MAX_EVIDENCE_SIZE,
  type AgentMetadata
} from '../lib/api'
import { 
  searchAgents, 
  getCouncil,
  fromHexId,
  type SubgraphAgent,
  type SubgraphCouncil
} from '../lib/subgraph'
import { keccak256, toBytes, type Address } from 'viem'

type Step = 'agent' | 'amount' | 'evidence' | 'review' | 'submit'

export default function FileClaim() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { address } = useAccount()
  
  // Form state
  const [step, setStep] = useState<Step>('agent')
  const [searchInput, setSearchInput] = useState('')
  const [agentId, setAgentId] = useState(searchParams.get('agent') || '')
  const [claimedAmount, setClaimedAmount] = useState('')
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [evidenceHash, setEvidenceHash] = useState('')
  const [paymentReceiptHash] = useState('')
  const [description, setDescription] = useState('')
  
  // Agent lookup state
  const [agents, setAgents] = useState<SubgraphAgent[]>([])
  const [agentMetadata, setAgentMetadata] = useState<Map<string, AgentMetadata | null>>(new Map())
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<SubgraphAgent | null>(null)
  const [selectedAgentMeta, setSelectedAgentMeta] = useState<AgentMetadata | null>(null)
  const [selectedCouncil, setSelectedCouncil] = useState<SubgraphCouncil | null>(null)
  
  // Check if approval needed - default to true until we confirm otherwise
  const [needsApproval, setNeedsApproval] = useState(true)
  const [checkedAllowance, setCheckedAllowance] = useState(false)

  // Load validated agents on mount
  useEffect(() => {
    loadAgents()
  }, [])

  // When agentId changes from URL param, select that agent
  useEffect(() => {
    if (agentId && agents.length > 0) {
      const hexId = `0x${BigInt(agentId).toString(16).padStart(64, '0')}`
      const agent = agents.find(a => a.id === hexId || fromHexId(a.id) === agentId)
      if (agent) {
        selectAgent(agent)
      }
    }
  }, [agentId, agents])

  const loadAgents = async () => {
    setLoadingAgents(true)
    try {
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
    } finally {
      setLoadingAgents(false)
    }
  }

  const selectAgent = async (agent: SubgraphAgent) => {
    const numericId = fromHexId(agent.id)
    setSelectedAgent(agent)
    setAgentId(numericId)
    
    // Fetch metadata
    const meta = agentMetadata.get(numericId) || null
    setSelectedAgentMeta(meta)
    
    // Fetch council info
    if (agent.councilId) {
      const council = await getCouncil(agent.councilId)
      setSelectedCouncil(council)
    } else {
      setSelectedCouncil(null)
    }
  }

  // Filter agents by search
  const filteredAgents = agents.filter(agent => {
    if (!searchInput) return true
    const numericId = fromHexId(agent.id)
    const meta = agentMetadata.get(numericId)
    const searchLower = searchInput.toLowerCase()
    
    return numericId.includes(searchInput) || 
           (meta?.name && meta.name.toLowerCase().includes(searchLower))
  })

  // Read agent owner (for display)
  const { data: agentOwner } = useReadContract({
    address: CONTRACTS.ERC8004_REGISTRY as Address,
    abi: ERC8004_REGISTRY_ABI,
    functionName: 'ownerOf',
    args: agentId ? [BigInt(agentId)] : undefined,
    query: { enabled: !!agentId && /^\d+$/.test(agentId) }
  })

  // Read validation status
  const { data: isValidated } = useReadContract({
    address: CONTRACTS.TRUSTFUL_VALIDATOR as Address,
    abi: TRUSTFUL_VALIDATOR_ABI,
    functionName: 'isValidated',
    args: agentId ? [BigInt(agentId)] : undefined,
    query: { enabled: !!agentId && /^\d+$/.test(agentId) }
  })

  // Read agent collateral from contract (for accurate available amount)
  const { data: agentAccount } = useReadContract({
    address: CONTRACTS.COLLATERAL_VAULT as Address,
    abi: COLLATERAL_VAULT_ABI,
    functionName: 'getAccount',
    args: agentId ? [BigInt(agentId)] : undefined,
    query: { enabled: !!agentId && /^\d+$/.test(agentId) }
  })

  // Calculate available collateral
  const availableCollateral = agentAccount 
    ? BigInt((agentAccount as any).balance || (agentAccount as any)[1] || 0) - 
      BigInt((agentAccount as any).lockedAmount || (agentAccount as any)[2] || 0)
    : (selectedAgent ? BigInt(selectedAgent.availableCollateral || '0') : BigInt(0))

  // Calculate required deposit
  const { data: requiredDeposit } = useReadContract({
    address: CONTRACTS.CLAIMS_MANAGER as Address,
    abi: CLAIMS_MANAGER_ABI,
    functionName: 'calculateRequiredDeposit',
    args: agentId && claimedAmount ? [BigInt(agentId), parseUSDC(claimedAmount)] : undefined,
    query: { enabled: !!agentId && !!claimedAmount && parseFloat(claimedAmount) > 0 }
  })

  // Check USDC allowance
  const { data: allowance } = useReadContract({
    address: CONTRACTS.USDC as Address,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.CLAIMS_MANAGER as Address] : undefined,
    query: { enabled: !!address }
  })

  // Check USDC balance
  const { data: usdcBalance } = useReadContract({
    address: CONTRACTS.USDC as Address,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  })

  // Write contracts
  const { writeContract: approve, data: approveTx, isPending: approvePending } = useWriteContract()
  const { writeContract: fileClaim, data: claimTx, isPending: claimPending } = useWriteContract()
  
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({
    hash: approveTx
  })
  
  const { isLoading: claimConfirming, isSuccess: claimSuccess, data: claimReceipt } = useWaitForTransactionReceipt({
    hash: claimTx
  })

  // State for metadata saving
  const [savingMetadata, setSavingMetadata] = useState(false)

  // Check if approval needed
  useEffect(() => {
    if (requiredDeposit && allowance !== undefined) {
      const allowanceBigInt = BigInt(allowance?.toString() || '0')
      const requiredBigInt = BigInt(requiredDeposit?.toString() || '0')
      const needsMore = allowanceBigInt < requiredBigInt
      
      console.log('Allowance check:', {
        allowance: allowanceBigInt.toString(),
        requiredDeposit: requiredBigInt.toString(),
        needsApproval: needsMore
      })
      
      setNeedsApproval(needsMore)
      setCheckedAllowance(true)
    }
  }, [requiredDeposit, allowance])

  // After approval succeeds, proceed with claim
  useEffect(() => {
    if (approveSuccess) {
      setNeedsApproval(false)
    }
  }, [approveSuccess])

  // After claim succeeds, save metadata and evidence to DB
  useEffect(() => {
    if (claimSuccess && claimReceipt) {
      console.log('Claim successful, saving to database...')
      
      const CLAIM_FILED_TOPIC = '0x06f7262d6b8a70cc3597bdcd5bccc0324b8bad2b73b9974502b3b9f8e25c9be5'
      const claimsManagerAddress = CONTRACTS.CLAIMS_MANAGER.toLowerCase()
      
      const claimFiledLog = claimReceipt.logs.find(log => 
        log.address.toLowerCase() === claimsManagerAddress &&
        log.topics && 
        log.topics[0]?.toLowerCase() === CLAIM_FILED_TOPIC.toLowerCase()
      )
      
      if (claimFiledLog && claimFiledLog.topics[1]) {
        const claimId = BigInt(claimFiledLog.topics[1]).toString()
        console.log('Extracted claimId:', claimId)
        
        setSavingMetadata(true)
        const apiBase = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_URL || 'https://api.trustful-agents.ai')
        
        // Save metadata
        const saveMetadata = fetch(`${apiBase}/claims/${claimId}/metadata`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `Claim against Agent #${agentId}`,
            description: description
          })
        })
        
        // If there's an evidence file, post it as the initial message
        const saveEvidence = (evidenceFile && address) 
          ? fileToBase64DataUri(evidenceFile).then(evidenceData =>
              fetch(`${apiBase}/claims/${claimId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  authorAddress: address,
                  authorRole: 'claimer',
                  content: description,
                  evidenceHash: evidenceHash || null,
                  evidenceData: evidenceData,
                  evidenceFilename: evidenceFile.name,
                  evidenceMimetype: evidenceFile.type,
                  evidenceSize: evidenceFile.size
                })
              })
            )
          : Promise.resolve()
        
        Promise.all([saveMetadata, saveEvidence])
          .catch(err => console.error('Failed to save to database:', err))
          .finally(() => {
            setSavingMetadata(false)
            navigate('/')
          })
      } else {
        console.warn('Could not find ClaimFiled event in logs')
        navigate('/')
      }
    }
  }, [claimSuccess, claimReceipt, description, agentId, navigate, evidenceFile, evidenceHash, address])

  // Hash and upload evidence file when selected
  // Hash evidence file when selected (no IPFS upload in v1.3)
  useEffect(() => {
    if (evidenceFile) {
      hashFile(evidenceFile).then(setEvidenceHash)
    }
  }, [evidenceFile])

  const handleApprove = () => {
    if (!requiredDeposit) return
    approve({
      address: CONTRACTS.USDC as Address,
      abi: USDC_ABI,
      functionName: 'approve',
      args: [CONTRACTS.CLAIMS_MANAGER as Address, requiredDeposit]
    })
  }

  // v1.3: fileClaim only takes 3 params - evidence is stored in DB separately
  const handleFileClaim = () => {
    if (!agentId || !claimedAmount) return
    
    const paymentHash = paymentReceiptHash || keccak256(toBytes('no-payment-receipt'))
    
    fileClaim({
      address: CONTRACTS.CLAIMS_MANAGER as Address,
      abi: CLAIMS_MANAGER_ABI,
      functionName: 'fileClaim',
      args: [
        BigInt(agentId),
        parseUSDC(claimedAmount),
        paymentHash as `0x${string}`
      ]
    })
  }

  // Check if claimed amount exceeds available collateral
  const claimAmountBigInt = claimedAmount ? parseUSDC(claimedAmount) : BigInt(0)
  const exceedsAvailable = claimAmountBigInt > availableCollateral

  const canProceed = {
    agent: agentId && selectedAgent && isValidated,
    amount: claimedAmount && parseFloat(claimedAmount) > 0 && requiredDeposit && !exceedsAvailable,
    evidence: description.trim().length > 0,  // v1.3: just need description
    review: true,
    submit: !needsApproval
  }

  const agentDisplayName = getAgentDisplayName(agentId, selectedAgentMeta)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <button 
          onClick={() => navigate('/')}
          className="text-surface-400 hover:text-surface-100 mb-4 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold text-surface-100">File a Claim</h1>
        <p className="text-surface-400">Submit a claim against an AI agent for damages</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {(['agent', 'amount', 'evidence', 'review', 'submit'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === s 
                ? 'bg-claimer text-white' 
                : i < ['agent', 'amount', 'evidence', 'review', 'submit'].indexOf(step)
                ? 'bg-accent text-white'
                : 'bg-surface-700 text-surface-400'
            }`}>
              {i + 1}
            </div>
            {i < 4 && <div className={`w-8 h-0.5 ${
              i < ['agent', 'amount', 'evidence', 'review', 'submit'].indexOf(step)
                ? 'bg-accent'
                : 'bg-surface-700'
            }`} />}
          </div>
        ))}
      </div>

      {/* Step: Select Agent */}
      {step === 'agent' && (
        <div className="card p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-surface-100 mb-4">
              Step 1: Select Agent
            </h2>
            <p className="text-surface-400 text-sm mb-4">
              Choose a validated agent to file a claim against
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by Agent ID or name…"
                className="input pl-10"
              />
            </div>
          </div>

          {loadingAgents ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-claimer animate-spin" />
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredAgents.map(agent => {
                const numericId = fromHexId(agent.id)
                const meta = agentMetadata.get(numericId)
                const isSelected = agentId === numericId
                const displayName = meta?.name || `Agent #${numericId}`
                
                return (
                  <button
                    key={agent.id}
                    onClick={() => selectAgent(agent)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      isSelected 
                        ? 'bg-claimer/10 border-claimer' 
                        : 'bg-surface-800/50 border-surface-700 hover:border-claimer/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent/20">
                        <Shield className="w-4 h-4 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-surface-100 truncate">{displayName}</p>
                        <p className="text-xs text-surface-500">
                          ID: {numericId} • Available: ${formatUSDC(agent.availableCollateral)}
                        </p>
                      </div>
                      {isSelected && <CheckCircle className="w-5 h-5 text-claimer" />}
                    </div>
                  </button>
                )
              })}
              {filteredAgents.length === 0 && (
                <p className="text-center text-surface-400 py-4">No agents found</p>
              )}
            </div>
          )}

          {/* Selected Agent Card */}
          {selectedAgent && (
            <div className="p-4 bg-surface-800 rounded-lg border border-claimer/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-accent/20">
                    <Shield className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold text-surface-100">{agentDisplayName}</p>
                    <p className="text-xs text-surface-500">ID: {agentId}</p>
                  </div>
                </div>
                {isValidated ? (
                  <span className="badge badge-success">Validated</span>
                ) : (
                  <span className="badge badge-danger">Not Validated</span>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-2 bg-surface-900/50 rounded">
                  <p className="text-surface-500 text-xs">Provider</p>
                  <p className="text-surface-200 font-mono text-xs">
                    {agentOwner ? formatAddress(agentOwner as string) : 
                     selectedAgentMeta?.owner_address ? formatAddress(selectedAgentMeta.owner_address) : '—'}
                  </p>
                </div>
                <div className="p-2 bg-surface-900/50 rounded">
                  <p className="text-surface-500 text-xs">Council</p>
                  <p className="text-surface-200">{selectedCouncil?.name || '—'}</p>
                </div>
                <div className="p-2 bg-surface-900/50 rounded">
                  <p className="text-surface-500 text-xs">Collateral Available</p>
                  <p className="text-surface-200 font-medium">${formatUSDC(availableCollateral)}</p>
                </div>
                <div className="p-2 bg-surface-900/50 rounded">
                  <p className="text-surface-500 text-xs">Total Claims</p>
                  <p className="text-surface-200">{selectedAgent.totalClaims}</p>
                </div>
              </div>
            </div>
          )}

          {selectedAgent && !isValidated && (
            <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0" />
              <div>
                <p className="font-medium text-danger">Agent Not Validated</p>
                <p className="text-sm text-surface-400">
                  This agent is not currently validated. Claims cannot be filed against unvalidated agents.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => setStep('amount')}
              disabled={!canProceed.agent}
              className="btn btn-primary"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      )}

      {/* Step: Enter Amount */}
      {step === 'amount' && (
        <div className="card p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-surface-100 mb-4">
              Step 2: Claim Amount
            </h2>
            
            {/* Show available collateral */}
            <div className="p-3 bg-surface-800 rounded-lg border border-surface-700 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-surface-400">Available Collateral</span>
                <span className="text-surface-100 font-medium">${formatUSDC(availableCollateral)} USDC</span>
              </div>
              <p className="text-xs text-surface-500 mt-1">
                Maximum amount you can claim from {agentDisplayName}
              </p>
            </div>
            
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500" />
              <input
                type="number"
                value={claimedAmount}
                onChange={(e) => setClaimedAmount(e.target.value)}
                placeholder="Enter amount in USDC"
                min="0"
                max={Number(formatUSDC(availableCollateral))}
                step="0.01"
                className="input pl-10"
              />
            </div>
          </div>

          {exceedsAvailable && claimedAmount && (
            <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0" />
              <div>
                <p className="font-medium text-danger">Amount Exceeds Available Collateral</p>
                <p className="text-sm text-surface-400">
                  You can claim a maximum of ${formatUSDC(availableCollateral)} USDC from this agent.
                </p>
              </div>
            </div>
          )}

          {requiredDeposit !== undefined && requiredDeposit > 0n && !exceedsAvailable && (
            <div className="p-4 bg-surface-800 rounded-lg border border-surface-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-surface-400">Required Deposit</span>
                <span className="text-surface-100 font-medium">
                  ${formatUSDC(requiredDeposit)} USDC
                </span>
              </div>
              <p className="text-sm text-surface-500">
                This deposit will be distributed to council members who vote on your claim.
                If your claim is rejected, you will lose this deposit.
              </p>
            </div>
          )}

          {usdcBalance !== undefined && requiredDeposit !== undefined && usdcBalance < requiredDeposit && (
            <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0" />
              <div>
                <p className="font-medium text-danger">Insufficient Balance</p>
                <p className="text-sm text-surface-400">
                  You have ${formatUSDC(usdcBalance)} USDC but need ${formatUSDC(requiredDeposit)} USDC
                  for the deposit.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep('agent')} className="btn btn-secondary">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </button>
            <button
              onClick={() => setStep('evidence')}
              disabled={!canProceed.amount}
              className="btn btn-primary"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      )}

      {/* Step: Upload Evidence */}
      {step === 'evidence' && (
        <div className="card p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-surface-100 mb-4">
              Step 3: Evidence
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-2">
                  Description *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what happened and why you're filing this claim..."
                  rows={4}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-2">
                  Evidence File (Optional)
                </label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center border-surface-600">
                  <input
                    type="file"
                    onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="evidence-upload"
                  />
                  <label htmlFor="evidence-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-surface-400 mx-auto mb-2" />
                    <p className="text-surface-300">
                      {evidenceFile ? evidenceFile.name : 'Click to upload evidence'}
                    </p>
                    <p className="text-sm text-surface-500">
                      Max {MAX_EVIDENCE_SIZE / 1024}KB - Screenshots, documents, logs
                    </p>
                  </label>
                </div>
                
                {/* File size warning */}
                {evidenceFile && evidenceFile.size > MAX_EVIDENCE_SIZE && (
                  <div className="mt-2 p-2 bg-danger/10 border border-danger/20 rounded">
                    <p className="text-sm text-danger">
                      File too large ({(evidenceFile.size / 1024).toFixed(1)}KB). Maximum is {MAX_EVIDENCE_SIZE / 1024}KB.
                    </p>
                  </div>
                )}
                
                {/* File selected success */}
                {evidenceFile && evidenceFile.size <= MAX_EVIDENCE_SIZE && (
                  <div className="mt-2 p-2 bg-accent/10 border border-accent/20 rounded flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-accent" />
                    <span className="text-sm text-accent">File ready ({(evidenceFile.size / 1024).toFixed(1)}KB)</span>
                  </div>
                )}
              </div>

              {evidenceHash && (
                <div className="p-3 bg-surface-800 rounded-lg">
                  <p className="text-xs text-surface-500">Evidence Hash (SHA-256)</p>
                  <p className="text-sm text-surface-300 font-mono break-all">{evidenceHash}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep('amount')} className="btn btn-secondary">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </button>
            <button
              onClick={() => setStep('review')}
              disabled={!canProceed.evidence || (evidenceFile !== null && evidenceFile.size > MAX_EVIDENCE_SIZE)}
              className="btn btn-primary"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && (
        <div className="card p-6 space-y-6">
          <h2 className="text-lg font-semibold text-surface-100 mb-4">
            Step 4: Review Your Claim
          </h2>

          <div className="space-y-4">
            <div className="p-4 bg-surface-800 rounded-lg border border-surface-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-surface-500 text-sm">Agent</p>
                  <p className="text-surface-100">{agentDisplayName} (#{agentId})</p>
                </div>
                <div>
                  <p className="text-surface-500 text-sm">Council</p>
                  <p className="text-surface-100">{selectedCouncil?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-surface-500 text-sm">Claimed Amount</p>
                  <p className="text-surface-100">${claimedAmount} USDC</p>
                </div>
                <div>
                  <p className="text-surface-500 text-sm">Required Deposit</p>
                  <p className="text-surface-100">${formatUSDC(requiredDeposit || BigInt(0))} USDC</p>
                </div>
                <div className="col-span-2">
                  <p className="text-surface-500 text-sm">Evidence</p>
                  <p className="text-surface-100 truncate">
                    {evidenceFile?.name || 'No file attached'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-surface-500 text-sm">Description</p>
                  <p className="text-surface-100 text-sm">{description}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-claimer/10 border border-claimer/20 rounded-lg flex items-start gap-3">
              <Info className="w-5 h-5 text-claimer flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-claimer">Important</p>
                <p className="text-surface-400">
                  By filing this claim, your deposit of ${formatUSDC(requiredDeposit || BigInt(0))} USDC
                  will be locked. If your claim is approved, you'll receive compensation from the agent's
                  collateral. If rejected, you'll lose your deposit.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep('evidence')} className="btn btn-secondary">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </button>
            <button
              onClick={() => setStep('submit')}
              className="btn btn-primary"
            >
              Proceed to Submit
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      )}

      {/* Step: Submit */}
      {step === 'submit' && (
        <div className="card p-6 space-y-6">
          <h2 className="text-lg font-semibold text-surface-100 mb-4">
            Step 5: Submit Claim
          </h2>

          {/* Show loading while checking allowance */}
          {!checkedAllowance ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-claimer animate-spin mr-2" />
              <span className="text-surface-400">Checking USDC allowance...</span>
            </div>
          ) : needsApproval ? (
            <div className="space-y-4">
              <div className="p-4 bg-surface-800 rounded-lg border border-surface-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-claimer/20 flex items-center justify-center">
                    <span className="text-claimer font-bold">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-surface-100">Approve USDC Deposit</p>
                    <p className="text-sm text-surface-400">
                      Allow ClaimsManager to transfer ${formatUSDC(requiredDeposit || BigInt(0))} USDC as your deposit
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleApprove}
                  disabled={approvePending || approveConfirming}
                  className="btn btn-primary w-full"
                >
                  {approvePending || approveConfirming ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {approvePending ? 'Confirm in wallet...' : 'Confirming...'}
                    </>
                  ) : (
                    'Approve USDC'
                  )}
                </button>
              </div>

              <div className="p-4 bg-surface-800/50 rounded-lg border border-surface-700/50 opacity-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-700 flex items-center justify-center">
                    <span className="text-surface-400 font-bold">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-surface-400">File Claim & Pay Deposit</p>
                    <p className="text-sm text-surface-500">
                      Submit your claim after approval
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-surface-800 rounded-lg border border-accent/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-surface-100">USDC Allowance Confirmed</p>
                    <p className="text-sm text-surface-400">
                      ClaimsManager can transfer your deposit
                    </p>
                  </div>
                </div>
              </div>

              {/* Deposit info box */}
              <div className="p-4 bg-claimer/10 border border-claimer/20 rounded-lg">
                <p className="text-sm text-surface-300">
                  <strong className="text-claimer">Deposit: ${formatUSDC(requiredDeposit || BigInt(0))} USDC</strong>
                  <br />
                  This amount will be transferred from your wallet when you file the claim.
                </p>
              </div>

              <div className="p-4 bg-surface-800 rounded-lg border border-surface-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-claimer/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-claimer" />
                  </div>
                  <div>
                    <p className="font-medium text-surface-100">File Claim</p>
                    <p className="text-sm text-surface-400">
                      Submit your claim to the blockchain
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleFileClaim}
                  disabled={claimPending || claimConfirming || savingMetadata}
                  className="btn btn-primary w-full"
                >
                  {claimPending || claimConfirming || savingMetadata ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {claimPending ? 'Confirm in wallet...' : claimConfirming ? 'Filing claim...' : 'Saving...'}
                    </>
                  ) : (
                    'File Claim'
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-start">
            <button onClick={() => setStep('review')} className="btn btn-secondary">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
