import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUsdc, formatUsdc, shortenAddress, formatTimestamp, hashTermsContent } from './lib/utils'
import {
  CONTRACTS,
  MockUsdcAbi,
  MockErc8004RegistryAbi,
  CollateralVaultAbi,
  TermsRegistryAbi,
  TrustfulValidatorAbi,
} from './config/contracts'

// Check if contracts are configured
const isConfigured = CONTRACTS.mockUsdc !== '0x0000000000000000000000000000000000000000'

type Step = 'connect' | 'agent' | 'collateral' | 'terms' | 'validate' | 'complete'

export default function App() {
  const [currentStep, setCurrentStep] = useState<Step>('connect')
  const [agentId, setAgentId] = useState<bigint | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()

  // Update step when wallet connects
  useEffect(() => {
    if (isConnected && currentStep === 'connect') {
      setCurrentStep('agent')
    }
    if (!isConnected) {
      setCurrentStep('connect')
      setAgentId(null)
    }
  }, [isConnected, currentStep])

  if (!isConfigured) {
    return <ConfigurationRequired />
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold">Trustful Agents</h1>
            <p className="text-sm text-gray-400">Provider Dashboard</p>
          </div>
          {isConnected && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">{shortenAddress(address!)}</span>
              <button
                onClick={() => disconnect()}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <StepIndicator currentStep={currentStep} />

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-300">
            {error}
            <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-300">×</button>
          </div>
        )}

        <div className="space-y-6">
          {currentStep === 'connect' && (
            <ConnectStep />
          )}
          {currentStep === 'agent' && (
            <AgentStep
              address={address!}
              onAgentMinted={(id) => { setAgentId(id); setCurrentStep('collateral') }}
              onError={setError}
            />
          )}
          {currentStep === 'collateral' && agentId !== null && (
            <CollateralStep
              agentId={agentId}
              address={address!}
              onComplete={() => setCurrentStep('terms')}
              onError={setError}
            />
          )}
          {currentStep === 'terms' && agentId !== null && (
            <TermsStep
              agentId={agentId}
              onComplete={() => setCurrentStep('validate')}
              onError={setError}
            />
          )}
          {currentStep === 'validate' && agentId !== null && (
            <ValidateStep
              agentId={agentId}
              onComplete={() => setCurrentStep('complete')}
              onError={setError}
            />
          )}
          {currentStep === 'complete' && agentId !== null && (
            <CompleteStep agentId={agentId} />
          )}
        </div>
      </main>
    </div>
  )
}

function ConfigurationRequired() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
      <div className="max-w-lg p-8 bg-gray-900 rounded-lg border border-gray-800">
        <h1 className="text-xl font-semibold mb-4 text-yellow-400">⚠️ Configuration Required</h1>
        <p className="text-gray-300 mb-4">
          Please update the contract addresses in <code className="text-blue-400">src/config/contracts.ts</code> with your deployed contract addresses on Base Sepolia.
        </p>
        <div className="bg-gray-800 p-4 rounded text-sm font-mono text-gray-300">
          <p>mockUsdc: '0x...'</p>
          <p>mockErc8004Registry: '0x...'</p>
          <p>collateralVault: '0x...'</p>
          <p>termsRegistry: '0x...'</p>
          <p>trustfulValidator: '0x...'</p>
        </div>
      </div>
    </div>
  )
}

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'connect', label: 'Connect' },
    { key: 'agent', label: 'Mint Agent' },
    { key: 'collateral', label: 'Deposit' },
    { key: 'terms', label: 'Register T&C' },
    { key: 'validate', label: 'Validate' },
    { key: 'complete', label: 'Complete' },
  ]

  const currentIndex = steps.findIndex(s => s.key === currentStep)

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center">
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
              ${index < currentIndex ? 'bg-green-600 text-white' : ''}
              ${index === currentIndex ? 'bg-blue-600 text-white' : ''}
              ${index > currentIndex ? 'bg-gray-800 text-gray-500' : ''}
            `}>
              {index < currentIndex ? '✓' : index + 1}
            </div>
            {index < steps.length - 1 && (
              <div className={`w-12 h-0.5 mx-2 ${index < currentIndex ? 'bg-green-600' : 'bg-gray-800'}`} />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2">
        {steps.map((step) => (
          <span key={step.key} className="text-xs text-gray-500 w-16 text-center">{step.label}</span>
        ))}
      </div>
    </div>
  )
}

function ConnectStep() {
  const { connect, connectors } = useConnect()
  
  return (
    <div className="p-6 bg-gray-900 rounded-lg border border-gray-800">
      <h2 className="text-lg font-medium mb-4">Connect Wallet</h2>
      <p className="text-gray-400 mb-6">Connect your wallet to get started. Make sure you're on Base Sepolia testnet.</p>
      <div className="flex flex-wrap gap-3">
        {connectors.map((connector) => (
          <button
            key={connector.uid}
            onClick={() => connect({ connector })}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            {connector.name}
          </button>
        ))}
      </div>
    </div>
  )
}

function AgentStep({ address, onAgentMinted, onError }: { address: `0x${string}`; onAgentMinted: (id: bigint) => void; onError: (error: string) => void }) {
  const [customId, setCustomId] = useState('')
  
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const { data: nextTokenId } = useReadContract({
    address: CONTRACTS.mockErc8004Registry,
    abi: MockErc8004RegistryAbi,
    functionName: 'nextTokenId',
  })

  useEffect(() => {
    if (isSuccess && nextTokenId !== undefined) {
      // Use custom ID if provided, otherwise use the auto-generated one
      const mintedId = customId ? BigInt(customId) : nextTokenId - BigInt(1)
      onAgentMinted(mintedId)
    }
  }, [isSuccess, nextTokenId, customId, onAgentMinted])

  useEffect(() => {
    if (error) onError(error.message)
  }, [error, onError])

  const mintAgent = () => {
    if (customId) {
      writeContract({
        address: CONTRACTS.mockErc8004Registry,
        abi: MockErc8004RegistryAbi,
        functionName: 'mint',
        args: [address, BigInt(customId)],
      })
    } else {
      writeContract({
        address: CONTRACTS.mockErc8004Registry,
        abi: MockErc8004RegistryAbi,
        functionName: 'mintAuto',
        args: [address],
      })
    }
  }

  return (
    <div className="p-6 bg-gray-900 rounded-lg border border-gray-800">
      <h2 className="text-lg font-medium mb-4">Mint Test Agent</h2>
      <p className="text-gray-400 mb-6">Mint an ERC-8004 agent token. This represents your AI agent on-chain.</p>
      
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">Agent ID (optional)</label>
        <input
          type="number"
          value={customId}
          onChange={(e) => setCustomId(e.target.value)}
          placeholder="Leave empty for auto-generated ID"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500"
        />
        <p className="text-xs text-gray-500 mt-1">Next auto ID: {nextTokenId?.toString() ?? '...'}</p>
      </div>

      <button
        onClick={mintAgent}
        disabled={isPending || isConfirming}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
      >
        {isPending ? 'Confirm in wallet...' : isConfirming ? 'Minting...' : 'Mint Agent'}
      </button>
    </div>
  )
}

function CollateralStep({ agentId, address, onComplete, onError }: { agentId: bigint; address: `0x${string}`; onComplete: () => void; onError: (error: string) => void }) {
  const [amount, setAmount] = useState('100')
  const [phase, setPhase] = useState<'mint' | 'approve' | 'deposit'>('mint')
  
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.mockUsdc,
    abi: MockUsdcAbi,
    functionName: 'balanceOf',
    args: [address],
  })

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.mockUsdc,
    abi: MockUsdcAbi,
    functionName: 'allowance',
    args: [address, CONTRACTS.collateralVault],
  })

  const { data: collateralAccount, refetch: refetchCollateral } = useReadContract({
    address: CONTRACTS.collateralVault,
    abi: CollateralVaultAbi,
    functionName: 'getAccount',
    args: [agentId],
  })

  const { data: minCollateral } = useReadContract({
    address: CONTRACTS.trustfulValidator,
    abi: TrustfulValidatorAbi,
    functionName: 'minimumCollateral',
  })

  useEffect(() => {
    if (isSuccess) {
      reset()
      refetchBalance()
      refetchAllowance()
      refetchCollateral()
      
      if (phase === 'mint') setPhase('approve')
      else if (phase === 'approve') setPhase('deposit')
      else if (phase === 'deposit') onComplete()
    }
  }, [isSuccess, phase, reset, refetchBalance, refetchAllowance, refetchCollateral, onComplete])

  useEffect(() => {
    if (error) onError(error.message)
  }, [error, onError])

  const amountInUnits = parseUsdc(amount)

  const mintUsdc = () => {
    writeContract({
      address: CONTRACTS.mockUsdc,
      abi: MockUsdcAbi,
      functionName: 'mint',
      args: [address, amountInUnits],
    })
  }

  const approveUsdc = () => {
    writeContract({
      address: CONTRACTS.mockUsdc,
      abi: MockUsdcAbi,
      functionName: 'approve',
      args: [CONTRACTS.collateralVault, amountInUnits],
    })
  }

  const depositCollateral = () => {
    writeContract({
      address: CONTRACTS.collateralVault,
      abi: CollateralVaultAbi,
      functionName: 'deposit',
      args: [agentId, amountInUnits],
    })
  }

  const hasEnoughBalance = usdcBalance !== undefined && usdcBalance >= amountInUnits
  const hasEnoughAllowance = allowance !== undefined && allowance >= amountInUnits

  return (
    <div className="p-6 bg-gray-900 rounded-lg border border-gray-800">
      <h2 className="text-lg font-medium mb-4">Deposit Collateral</h2>
      <p className="text-gray-400 mb-6">
        Agent #{agentId.toString()} needs collateral. Minimum required: {minCollateral ? formatUsdc(minCollateral) : '...'} USDC
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div className="p-3 bg-gray-800 rounded">
          <div className="text-gray-400">Your USDC Balance</div>
          <div className="text-lg font-medium">{usdcBalance !== undefined ? formatUsdc(usdcBalance) : '...'}</div>
        </div>
        <div className="p-3 bg-gray-800 rounded">
          <div className="text-gray-400">Agent Collateral</div>
          <div className="text-lg font-medium">{collateralAccount ? formatUsdc(collateralAccount.balance) : '0'}</div>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">Amount (USDC)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={mintUsdc}
          disabled={isPending || isConfirming || phase !== 'mint'}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            phase === 'mint' 
              ? 'bg-blue-600 hover:bg-blue-700' 
              : 'bg-green-800 cursor-default'
          } disabled:bg-gray-700 disabled:cursor-not-allowed`}
        >
          {phase !== 'mint' ? '✓ Minted' : isPending ? 'Confirm...' : isConfirming ? 'Minting...' : '1. Mint USDC'}
        </button>
        <button
          onClick={approveUsdc}
          disabled={isPending || isConfirming || phase !== 'approve' || !hasEnoughBalance}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            phase === 'deposit' 
              ? 'bg-green-800 cursor-default' 
              : phase === 'approve' 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-gray-800'
          } disabled:bg-gray-700 disabled:cursor-not-allowed`}
        >
          {hasEnoughAllowance && phase === 'deposit' ? '✓ Approved' : isPending && phase === 'approve' ? 'Confirm...' : isConfirming && phase === 'approve' ? 'Approving...' : '2. Approve'}
        </button>
        <button
          onClick={depositCollateral}
          disabled={isPending || isConfirming || phase !== 'deposit' || !hasEnoughAllowance}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            phase === 'deposit' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-800'
          } disabled:bg-gray-700 disabled:cursor-not-allowed`}
        >
          {isPending && phase === 'deposit' ? 'Confirm...' : isConfirming && phase === 'deposit' ? 'Depositing...' : '3. Deposit'}
        </button>
      </div>
    </div>
  )
}

function TermsStep({ agentId, onComplete, onError }: { agentId: bigint; onComplete: () => void; onError: (error: string) => void }) {
  const [termsUri, setTermsUri] = useState('ipfs://QmExample123...')
  const [termsContent, setTermsContent] = useState('# Terms & Conditions\n\nYour T&C content here...')
  
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const { data: hasTerms, refetch } = useReadContract({
    address: CONTRACTS.termsRegistry,
    abi: TermsRegistryAbi,
    functionName: 'hasActiveTerms',
    args: [agentId],
  })

  useEffect(() => {
    if (isSuccess) {
      refetch()
      onComplete()
    }
  }, [isSuccess, refetch, onComplete])

  useEffect(() => {
    if (error) onError(error.message)
  }, [error, onError])

  const contentHash = hashTermsContent(termsContent)
  // For MVP, use a placeholder council ID (zero)
  const councilId = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`

  const registerTerms = () => {
    writeContract({
      address: CONTRACTS.termsRegistry,
      abi: TermsRegistryAbi,
      functionName: 'registerTerms',
      args: [agentId, contentHash, termsUri, councilId],
    })
  }

  return (
    <div className="p-6 bg-gray-900 rounded-lg border border-gray-800">
      <h2 className="text-lg font-medium mb-4">Register Terms & Conditions</h2>
      <p className="text-gray-400 mb-6">
        Define your agent's terms. The content hash is computed from the content and stored on-chain.
      </p>

      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">IPFS URI</label>
        <input
          type="text"
          value={termsUri}
          onChange={(e) => setTermsUri(e.target.value)}
          placeholder="ipfs://..."
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">Terms Content (for hash)</label>
        <textarea
          value={termsContent}
          onChange={(e) => setTermsContent(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 font-mono text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Content Hash: <code className="text-blue-400">{contentHash.slice(0, 18)}...</code>
        </p>
      </div>

      <button
        onClick={registerTerms}
        disabled={isPending || isConfirming || hasTerms}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
      >
        {hasTerms ? '✓ Terms Registered' : isPending ? 'Confirm in wallet...' : isConfirming ? 'Registering...' : 'Register Terms'}
      </button>
    </div>
  )
}

function ValidateStep({ agentId, onComplete, onError }: { agentId: bigint; onComplete: () => void; onError: (error: string) => void }) {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const { data: isValidated, refetch: refetchValidation } = useReadContract({
    address: CONTRACTS.trustfulValidator,
    abi: TrustfulValidatorAbi,
    functionName: 'isValidated',
    args: [agentId],
  })

  const { data: conditions } = useReadContract({
    address: CONTRACTS.trustfulValidator,
    abi: TrustfulValidatorAbi,
    functionName: 'checkConditions',
    args: [agentId],
  })

  useEffect(() => {
    if (isSuccess) {
      refetchValidation()
      onComplete()
    }
  }, [isSuccess, refetchValidation, onComplete])

  useEffect(() => {
    if (error) onError(error.message)
  }, [error, onError])

  const requestValidation = () => {
    writeContract({
      address: CONTRACTS.trustfulValidator,
      abi: TrustfulValidatorAbi,
      functionName: 'requestValidation',
      args: [agentId],
    })
  }

  const allConditionsMet = conditions &&
    conditions.hasMinimumCollateral &&
    conditions.hasActiveTerms &&
    conditions.isOwnerValid

  return (
    <div className="p-6 bg-gray-900 rounded-lg border border-gray-800">
      <h2 className="text-lg font-medium mb-4">Request Validation</h2>
      <p className="text-gray-400 mb-6">
        Your agent needs to pass validation checks to be considered "trusted".
      </p>

      <div className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <span className={conditions?.hasMinimumCollateral ? 'text-green-400' : 'text-red-400'}>
            {conditions?.hasMinimumCollateral ? '✓' : '✗'}
          </span>
          <span className="text-gray-300">Minimum collateral deposited</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={conditions?.hasActiveTerms ? 'text-green-400' : 'text-red-400'}>
            {conditions?.hasActiveTerms ? '✓' : '✗'}
          </span>
          <span className="text-gray-300">Active terms registered</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={conditions?.isOwnerValid ? 'text-green-400' : 'text-red-400'}>
            {conditions?.isOwnerValid ? '✓' : '✗'}
          </span>
          <span className="text-gray-300">Agent ownership valid</span>
        </div>
      </div>

      <button
        onClick={requestValidation}
        disabled={isPending || isConfirming || isValidated || !allConditionsMet}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
      >
        {isValidated ? '✓ Already Validated' : isPending ? 'Confirm in wallet...' : isConfirming ? 'Validating...' : !allConditionsMet ? 'Conditions not met' : 'Request Validation'}
      </button>
    </div>
  )
}

function CompleteStep({ agentId }: { agentId: bigint }) {
  const { data: validationRecord } = useReadContract({
    address: CONTRACTS.trustfulValidator,
    abi: TrustfulValidatorAbi,
    functionName: 'getValidationRecord',
    args: [agentId],
  })

  const { data: collateralAccount } = useReadContract({
    address: CONTRACTS.collateralVault,
    abi: CollateralVaultAbi,
    functionName: 'getAccount',
    args: [agentId],
  })

  return (
    <div className="p-6 bg-gray-900 rounded-lg border border-green-800">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-xl">✓</div>
        <div>
          <h2 className="text-lg font-medium text-green-400">Agent Validated!</h2>
          <p className="text-gray-400">Agent #{agentId.toString()} is now trusted</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
        <div className="p-4 bg-gray-800 rounded-lg">
          <div className="text-gray-400 mb-1">Validation Hash</div>
          <div className="font-mono text-xs text-blue-400 break-all">
            {validationRecord?.requestHash ?? '...'}
          </div>
        </div>
        <div className="p-4 bg-gray-800 rounded-lg">
          <div className="text-gray-400 mb-1">Validated At</div>
          <div className="text-gray-100">
            {validationRecord ? formatTimestamp(validationRecord.issuedAt) : '...'}
          </div>
        </div>
        <div className="p-4 bg-gray-800 rounded-lg">
          <div className="text-gray-400 mb-1">Collateral Balance</div>
          <div className="text-gray-100">
            {collateralAccount ? formatUsdc(collateralAccount.balance) : '...'} USDC
          </div>
        </div>
        <div className="p-4 bg-gray-800 rounded-lg">
          <div className="text-gray-400 mb-1">Validation Nonce</div>
          <div className="text-gray-100">
            {validationRecord?.nonce?.toString() ?? '...'}
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
        <p className="text-blue-300 text-sm">
          Your agent is now discoverable as a validated ERC-8004 agent. Clients can trust that your agent has collateral backing and published Terms & Conditions.
        </p>
      </div>
    </div>
  )
}
