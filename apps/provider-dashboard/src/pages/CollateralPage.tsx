import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { 
  ArrowLeft, 
  Wallet, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Clock, 
  Check,
  X,
  Coins,
  Shield,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, Button, Input, Alert, Tabs, StatCard } from '../components/ui'
import { useTransactionToast } from '../components/Toast'
import { useAgent, useAgentOwner } from '../hooks/useAgents'
import { 
  useCollateralAccount, 
  useUsdcBalance, 
  useApproveUsdc, 
  useDeposit,
  useInitiateWithdrawal,
  useExecuteWithdrawal,
  useCancelWithdrawal,
  useMintTestUsdc
} from '../hooks/useCollateral'
import { formatUsdc, parseUsdc, getWithdrawalTimeRemaining, formatTimeRemaining, canExecuteWithdrawal } from '../lib/utils'
import { GRACE_PERIOD_DAYS } from '../config/contracts'

type Tab = 'deposit' | 'withdraw'

export default function CollateralPage() {
  const { agentId } = useParams<{ agentId: string }>()
  const { address } = useAccount()
  const [activeTab, setActiveTab] = useState<Tab>('deposit')
  const queryClient = useQueryClient()

  const { agent, isLoading: agentLoading } = useAgent(agentId)
  const { owner } = useAgentOwner(agentId)
  const { account, availableBalance, refetch: refetchAccount } = useCollateralAccount(agentId)
  const { balance: usdcBalance, allowance, refetch: refetchUsdc } = useUsdcBalance()

  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase()

  // Function to refresh all data after transaction
  const refreshAllData = async () => {
    // Small delay to ensure blockchain state is updated
    await new Promise(resolve => setTimeout(resolve, 2000))
    // Invalidate all queries to force refetch
    queryClient.invalidateQueries()
    // Also call explicit refetch
    refetchAccount()
    refetchUsdc()
  }

  // Refresh data periodically for withdrawal timer
  useEffect(() => {
    const interval = setInterval(() => {
      if (account?.withdrawalInitiatedAt && account.withdrawalInitiatedAt > BigInt(0)) {
        refetchAccount()
      }
    }, 10000) // every 10 seconds
    return () => clearInterval(interval)
  }, [account?.withdrawalInitiatedAt, refetchAccount])

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

  const hasWithdrawalPending = account?.withdrawalInitiatedAt && account.withdrawalInitiatedAt > BigInt(0)
  const withdrawalCanExecute = hasWithdrawalPending && canExecuteWithdrawal(account!.withdrawalInitiatedAt)

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
          <h1 className="text-2xl font-bold text-surface-100">Collateral Management</h1>
          <p className="text-surface-400">Agent #{agentId}</p>
        </div>
      </div>

      {/* Ownership Warning */}
      {!isOwner && (
        <Alert variant="warning" title="View Only">
          You don't own this agent. You can view collateral details but cannot make changes.
        </Alert>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Balance"
          value={formatUsdc(account?.balance ?? BigInt(0))}
          icon={<Wallet className="w-5 h-5" />}
        />
        <StatCard
          label="Available"
          value={formatUsdc(availableBalance ?? BigInt(0))}
          icon={<Coins className="w-5 h-5" />}
          variant="success"
        />
        <StatCard
          label="Locked"
          value={formatUsdc(account?.lockedAmount ?? BigInt(0))}
          icon={<Shield className="w-5 h-5" />}
          variant="warning"
        />
        <StatCard
          label="Your USDC"
          value={formatUsdc(usdcBalance ?? BigInt(0))}
          icon={<Wallet className="w-5 h-5" />}
          variant="neutral"
        />
      </div>

      {/* Pending Withdrawal Banner */}
      {hasWithdrawalPending && (
        <PendingWithdrawalBanner
          agentId={agentId!}
          amount={account!.withdrawalAmount}
          initiatedAt={account!.withdrawalInitiatedAt}
          canExecute={withdrawalCanExecute}
          onSuccess={refreshAllData}
          isOwner={isOwner ?? false}
        />
      )}

      {/* Tabs */}
      {isOwner && !hasWithdrawalPending && (
        <>
          <Tabs
            tabs={[
              { id: 'deposit', label: 'Deposit', icon: <ArrowDownCircle className="w-4 h-4" /> },
              { id: 'withdraw', label: 'Withdraw', icon: <ArrowUpCircle className="w-4 h-4" /> },
            ]}
            activeTab={activeTab}
            onChange={(tab) => setActiveTab(tab as Tab)}
          />

          {activeTab === 'deposit' ? (
            <DepositForm
              agentId={agentId!}
              usdcBalance={usdcBalance}
              allowance={allowance}
              onSuccess={refreshAllData}
            />
          ) : (
            <WithdrawForm
              agentId={agentId!}
              availableBalance={availableBalance}
              onSuccess={refreshAllData}
            />
          )}
        </>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About Collateral</CardTitle>
          </CardHeader>
          <div className="text-sm text-surface-400 space-y-2">
            <p>
              Collateral is used to back your agent's commitments. Clients can file claims
              against your collateral if your agent fails to meet its terms.
            </p>
            <p>
              A minimum collateral balance is required to maintain validation status.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Withdrawal Process</CardTitle>
          </CardHeader>
          <div className="text-sm text-surface-400 space-y-2">
            <p>
              Withdrawals have a <strong className="text-surface-200">{GRACE_PERIOD_DAYS}-day grace period</strong> to 
              protect clients from sudden collateral removal.
            </p>
            <p>
              During this period, new claims can still be filed against the withdrawal amount.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}

// =============================================================================
// Deposit Form
// =============================================================================

interface DepositFormProps {
  agentId: string
  usdcBalance: bigint | undefined
  allowance: bigint | undefined
  onSuccess: () => void
}

function DepositForm({ agentId, usdcBalance, allowance, onSuccess }: DepositFormProps) {
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<'input' | 'approve' | 'deposit'>('input')
  const toastIdRef = useRef<string | null>(null)
  const { showPending, showConfirming, showSuccess, showError } = useTransactionToast()

  const { approve, hash: approveHash, isPending: approvePending, isConfirming: approveConfirming, isSuccess: approveSuccess, error: approveError, reset: resetApprove } = useApproveUsdc()
  const { deposit, hash: depositHash, isPending: depositPending, isConfirming: depositConfirming, isSuccess: depositSuccess, error: depositError, reset: resetDeposit } = useDeposit()
  const { mint, hash: mintHash, isPending: mintPending, isConfirming: mintConfirming, isSuccess: mintSuccess, error: mintError, reset: resetMint } = useMintTestUsdc()

  const parsedAmount = amount ? parseUsdc(amount) : BigInt(0)
  const hasEnoughBalance = usdcBalance && parsedAmount <= usdcBalance
  const hasEnoughAllowance = allowance && parsedAmount <= allowance
  const canDeposit = parsedAmount > BigInt(0) && hasEnoughBalance

  // Handle approval pending
  useEffect(() => {
    if (approvePending && !toastIdRef.current) {
      toastIdRef.current = showPending('Approving USDC')
    }
  }, [approvePending, showPending])

  // Handle approval confirming
  useEffect(() => {
    if (approveConfirming && approveHash && toastIdRef.current) {
      showConfirming(toastIdRef.current, approveHash)
    }
  }, [approveConfirming, approveHash, showConfirming])

  // Handle approval success
  useEffect(() => {
    if (approveSuccess && step === 'approve') {
      if (toastIdRef.current) {
        showSuccess(toastIdRef.current, 'USDC Approved', approveHash)
        toastIdRef.current = null
      }
      setStep('deposit')
      resetApprove()
    }
  }, [approveSuccess, step, approveHash, showSuccess, resetApprove])

  // Handle approval error
  useEffect(() => {
    if (approveError && toastIdRef.current) {
      showError(toastIdRef.current, approveError.message)
      toastIdRef.current = null
      setStep('input')
    }
  }, [approveError, showError])

  // Handle deposit pending
  useEffect(() => {
    if (depositPending && !toastIdRef.current) {
      toastIdRef.current = showPending('Depositing Collateral')
    }
  }, [depositPending, showPending])

  // Handle deposit confirming
  useEffect(() => {
    if (depositConfirming && depositHash && toastIdRef.current) {
      showConfirming(toastIdRef.current, depositHash)
    }
  }, [depositConfirming, depositHash, showConfirming])

  // Handle deposit success
  useEffect(() => {
    if (depositSuccess) {
      if (toastIdRef.current) {
        showSuccess(toastIdRef.current, 'Deposit Successful', depositHash)
        toastIdRef.current = null
      }
      onSuccess()
      setAmount('')
      setStep('input')
      resetDeposit()
    }
  }, [depositSuccess, depositHash, showSuccess, onSuccess, resetDeposit])

  // Handle deposit error
  useEffect(() => {
    if (depositError && toastIdRef.current) {
      showError(toastIdRef.current, depositError.message)
      toastIdRef.current = null
      setStep('input')
    }
  }, [depositError, showError])

  // Handle mint pending
  useEffect(() => {
    if (mintPending && !toastIdRef.current) {
      toastIdRef.current = showPending('Minting Test USDC')
    }
  }, [mintPending, showPending])

  // Handle mint confirming
  useEffect(() => {
    if (mintConfirming && mintHash && toastIdRef.current) {
      showConfirming(toastIdRef.current, mintHash)
    }
  }, [mintConfirming, mintHash, showConfirming])

  // Handle mint success
  useEffect(() => {
    if (mintSuccess) {
      if (toastIdRef.current) {
        showSuccess(toastIdRef.current, 'Test USDC Minted', mintHash)
        toastIdRef.current = null
      }
      onSuccess()
      resetMint()
    }
  }, [mintSuccess, mintHash, showSuccess, onSuccess, resetMint])

  // Handle mint error
  useEffect(() => {
    if (mintError && toastIdRef.current) {
      showError(toastIdRef.current, mintError.message)
      toastIdRef.current = null
    }
  }, [mintError, showError])

  const handleSubmit = () => {
    if (!canDeposit) return

    if (!hasEnoughAllowance) {
      setStep('approve')
      approve(amount)
    } else {
      setStep('deposit')
      deposit(agentId, amount)
    }
  }

  const handleDeposit = () => {
    deposit(agentId, amount)
  }

  const isProcessing = approvePending || approveConfirming || depositPending || depositConfirming

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
            <ArrowDownCircle className="w-5 h-5 text-success" />
          </div>
          <div>
            <CardTitle>Deposit USDC</CardTitle>
            <CardDescription>Add collateral to your agent</CardDescription>
          </div>
        </div>
      </CardHeader>

      <div className="mt-6 space-y-4">
        <div>
          <Input
            label="Amount"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            hint={`Available: ${formatUsdc(usdcBalance ?? BigInt(0))} USDC`}
            error={amount && !hasEnoughBalance ? 'Insufficient USDC balance' : undefined}
            disabled={isProcessing}
          />
          <div className="flex gap-2 mt-2">
            {['100', '500', '1000'].map((preset) => (
              <button
                key={preset}
                onClick={() => setAmount(preset)}
                disabled={isProcessing}
                className="px-3 py-1 text-xs rounded-md bg-surface-800 hover:bg-surface-700 text-surface-300 transition-colors disabled:opacity-50"
              >
                {preset} USDC
              </button>
            ))}
            <button
              onClick={() => usdcBalance && setAmount((Number(usdcBalance) / 1e6).toString())}
              disabled={isProcessing}
              className="px-3 py-1 text-xs rounded-md bg-surface-800 hover:bg-surface-700 text-surface-300 transition-colors disabled:opacity-50"
            >
              Max
            </button>
          </div>
        </div>

        {step === 'deposit' && !depositSuccess && !isProcessing && (
          <Alert variant="success" title="Approval Complete">
            USDC approved! Now confirm the deposit.
          </Alert>
        )}

        {step === 'input' && (
          <Button
            onClick={handleSubmit}
            disabled={!canDeposit || isProcessing}
            loading={approvePending || approveConfirming}
            className="w-full"
            size="lg"
          >
            {!hasEnoughAllowance && canDeposit ? 'Approve & Deposit' : 'Deposit'}
          </Button>
        )}

        {step === 'approve' && (
          <Button
            disabled
            loading
            className="w-full"
            size="lg"
          >
            Approving USDC...
          </Button>
        )}

        {step === 'deposit' && (
          <Button
            onClick={handleDeposit}
            loading={depositPending || depositConfirming}
            className="w-full"
            size="lg"
          >
            {depositPending ? 'Confirm in wallet...' : depositConfirming ? 'Depositing...' : 'Confirm Deposit'}
          </Button>
        )}

        {/* Testnet faucet */}
        <div className="pt-4 border-t border-surface-800">
          <p className="text-sm text-surface-500 mb-2">Need test USDC?</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => mint('1000')}
            loading={mintPending || mintConfirming}
            disabled={isProcessing}
          >
            <Coins className="w-4 h-4 mr-2" />
            Mint 1000 Test USDC
          </Button>
        </div>
      </div>
    </Card>
  )
}

// =============================================================================
// Withdraw Form
// =============================================================================

interface WithdrawFormProps {
  agentId: string
  availableBalance: bigint | undefined
  onSuccess: () => void
}

function WithdrawForm({ agentId, availableBalance, onSuccess }: WithdrawFormProps) {
  const [amount, setAmount] = useState('')
  const toastIdRef = useRef<string | null>(null)
  const { showPending, showConfirming, showSuccess, showError } = useTransactionToast()

  const { initiateWithdrawal, hash, isPending, isConfirming, isSuccess, error, reset } = useInitiateWithdrawal()

  const parsedAmount = amount ? parseUsdc(amount) : BigInt(0)
  const hasEnoughBalance = availableBalance && parsedAmount <= availableBalance
  const canWithdraw = parsedAmount > BigInt(0) && hasEnoughBalance

  // Handle pending
  useEffect(() => {
    if (isPending && !toastIdRef.current) {
      toastIdRef.current = showPending('Initiating Withdrawal')
    }
  }, [isPending, showPending])

  // Handle confirming
  useEffect(() => {
    if (isConfirming && hash && toastIdRef.current) {
      showConfirming(toastIdRef.current, hash)
    }
  }, [isConfirming, hash, showConfirming])

  // Handle success
  useEffect(() => {
    if (isSuccess) {
      if (toastIdRef.current) {
        showSuccess(toastIdRef.current, 'Withdrawal Initiated', hash)
        toastIdRef.current = null
      }
      onSuccess()
      setAmount('')
      reset()
    }
  }, [isSuccess, hash, showSuccess, onSuccess, reset])

  // Handle error
  useEffect(() => {
    if (error && toastIdRef.current) {
      showError(toastIdRef.current, error.message)
      toastIdRef.current = null
    }
  }, [error, showError])

  const handleSubmit = () => {
    if (!canWithdraw) return
    initiateWithdrawal(agentId, amount)
  }

  const isProcessing = isPending || isConfirming

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
            <ArrowUpCircle className="w-5 h-5 text-warning" />
          </div>
          <div>
            <CardTitle>Initiate Withdrawal</CardTitle>
            <CardDescription>Start the {GRACE_PERIOD_DAYS}-day withdrawal process</CardDescription>
          </div>
        </div>
      </CardHeader>

      <div className="mt-6 space-y-4">
        <Alert variant="warning" title="Grace Period">
          Withdrawals require a {GRACE_PERIOD_DAYS}-day waiting period. During this time, pending claims 
          can still be filed against the withdrawal amount.
        </Alert>

        <div>
          <Input
            label="Amount"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            hint={`Available: ${formatUsdc(availableBalance ?? BigInt(0))} USDC`}
            error={amount && !hasEnoughBalance ? 'Exceeds available balance' : undefined}
            disabled={isProcessing}
          />
          <div className="flex gap-2 mt-2">
            {['100', '500'].map((preset) => (
              <button
                key={preset}
                onClick={() => setAmount(preset)}
                disabled={isProcessing}
                className="px-3 py-1 text-xs rounded-md bg-surface-800 hover:bg-surface-700 text-surface-300 transition-colors disabled:opacity-50"
              >
                {preset} USDC
              </button>
            ))}
            <button
              onClick={() => availableBalance && setAmount((Number(availableBalance) / 1e6).toString())}
              disabled={isProcessing}
              className="px-3 py-1 text-xs rounded-md bg-surface-800 hover:bg-surface-700 text-surface-300 transition-colors disabled:opacity-50"
            >
              Max
            </button>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!canWithdraw || isProcessing}
          loading={isProcessing}
          className="w-full"
          size="lg"
          variant="secondary"
        >
          {isPending ? 'Confirm in wallet...' : isConfirming ? 'Processing...' : 'Initiate Withdrawal'}
        </Button>
      </div>
    </Card>
  )
}

// =============================================================================
// Pending Withdrawal Banner
// =============================================================================

interface PendingWithdrawalBannerProps {
  agentId: string
  amount: bigint
  initiatedAt: bigint
  canExecute: boolean
  onSuccess: () => void
  isOwner: boolean
}

function PendingWithdrawalBanner({ agentId, amount, initiatedAt, canExecute, onSuccess, isOwner }: PendingWithdrawalBannerProps) {
  const executeToastRef = useRef<string | null>(null)
  const cancelToastRef = useRef<string | null>(null)
  const { showPending, showConfirming, showSuccess, showError } = useTransactionToast()

  const { executeWithdrawal, hash: executeHash, isPending: executePending, isConfirming: executeConfirming, isSuccess: executeSuccess, error: executeError, reset: resetExecute } = useExecuteWithdrawal()
  const { cancelWithdrawal, hash: cancelHash, isPending: cancelPending, isConfirming: cancelConfirming, isSuccess: cancelSuccess, error: cancelError, reset: resetCancel } = useCancelWithdrawal()

  const timeRemaining = getWithdrawalTimeRemaining(initiatedAt)

  // Execute handlers
  useEffect(() => {
    if (executePending && !executeToastRef.current) {
      executeToastRef.current = showPending('Executing Withdrawal')
    }
  }, [executePending, showPending])

  useEffect(() => {
    if (executeConfirming && executeHash && executeToastRef.current) {
      showConfirming(executeToastRef.current, executeHash)
    }
  }, [executeConfirming, executeHash, showConfirming])

  useEffect(() => {
    if (executeSuccess) {
      if (executeToastRef.current) {
        showSuccess(executeToastRef.current, 'Withdrawal Complete', executeHash)
        executeToastRef.current = null
      }
      onSuccess()
      resetExecute()
    }
  }, [executeSuccess, executeHash, showSuccess, onSuccess, resetExecute])

  useEffect(() => {
    if (executeError && executeToastRef.current) {
      showError(executeToastRef.current, executeError.message)
      executeToastRef.current = null
    }
  }, [executeError, showError])

  // Cancel handlers
  useEffect(() => {
    if (cancelPending && !cancelToastRef.current) {
      cancelToastRef.current = showPending('Cancelling Withdrawal')
    }
  }, [cancelPending, showPending])

  useEffect(() => {
    if (cancelConfirming && cancelHash && cancelToastRef.current) {
      showConfirming(cancelToastRef.current, cancelHash)
    }
  }, [cancelConfirming, cancelHash, showConfirming])

  useEffect(() => {
    if (cancelSuccess) {
      if (cancelToastRef.current) {
        showSuccess(cancelToastRef.current, 'Withdrawal Cancelled', cancelHash)
        cancelToastRef.current = null
      }
      onSuccess()
      resetCancel()
    }
  }, [cancelSuccess, cancelHash, showSuccess, onSuccess, resetCancel])

  useEffect(() => {
    if (cancelError && cancelToastRef.current) {
      showError(cancelToastRef.current, cancelError.message)
      cancelToastRef.current = null
    }
  }, [cancelError, showError])

  const isProcessing = executePending || executeConfirming || cancelPending || cancelConfirming

  return (
    <Card className={canExecute ? 'border-success/50 bg-success/5' : 'border-warning/50 bg-warning/5'}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${canExecute ? 'bg-success/20' : 'bg-warning/20'}`}>
            {canExecute ? (
              <Check className="w-6 h-6 text-success" />
            ) : (
              <Clock className="w-6 h-6 text-warning" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-surface-100">
              {canExecute ? 'Withdrawal Ready' : 'Withdrawal Pending'}
            </h3>
            <p className="text-2xl font-bold text-surface-100 mt-1">
              {formatUsdc(amount)} USDC
            </p>
            {!canExecute && (
              <p className="text-sm text-surface-400 mt-1">
                <Clock className="w-4 h-4 inline mr-1" />
                {formatTimeRemaining(timeRemaining)} remaining
              </p>
            )}
          </div>
        </div>

        {isOwner && (
          <div className="flex gap-2">
            {canExecute ? (
              <Button
                onClick={() => executeWithdrawal(agentId)}
                loading={executePending || executeConfirming}
                disabled={isProcessing}
                variant="primary"
              >
                <Check className="w-4 h-4 mr-2" />
                Execute Withdrawal
              </Button>
            ) : (
              <Button
                onClick={() => cancelWithdrawal(agentId)}
                loading={cancelPending || cancelConfirming}
                disabled={isProcessing}
                variant="danger"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
