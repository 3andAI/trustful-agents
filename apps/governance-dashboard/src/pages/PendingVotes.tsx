import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Vote,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  Building2,
  UserPlus,
  UserMinus,
  Trash2,
  RefreshCw,
  PenLine,
  Play,
  AlertTriangle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  getPendingTransactions,
  syncPendingTransactions,
  clearAllPendingTransactions,
  getSafeInfo,
} from '../lib/api';
import { useSafeConfirm, type SafePendingTransaction } from '../hooks/useSafeConfirm';
import { useWallet } from '../hooks/useWallet';

// Action type icons and labels
const ACTION_CONFIG: Record<string, { icon: typeof Building2; label: string; color: string }> = {
  create_council: { icon: Building2, label: 'Create Council', color: 'text-accent' },
  close_council: { icon: Trash2, label: 'Close Council', color: 'text-danger' },
  add_member: { icon: UserPlus, label: 'Add Member', color: 'text-success' },
  remove_member: { icon: UserMinus, label: 'Remove Member', color: 'text-warning' },
};

export default function PendingVotesPage() {
  const queryClient = useQueryClient();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { address } = useWallet();
  
  const {
    fetchPendingTransactions,
    confirmTransaction,
    executeTransaction,
    isOwner,
    hasAlreadySigned,
    isConfirming,
    isExecuting,
    safeAddress,
    safeOwners,
  } = useSafeConfirm();

  // Fetch from our database (for metadata like title, actionType)
  const { data: dbData } = useQuery({
    queryKey: ['pendingTransactions'],
    queryFn: getPendingTransactions,
    refetchInterval: 30000,
  });

  // Fetch from Safe API (for actual confirmations)
  const { data: safeTxs, isLoading, error, refetch } = useQuery({
    queryKey: ['safePendingTransactions', safeAddress],
    queryFn: fetchPendingTransactions,
    enabled: !!safeAddress,
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  const { data: safeInfo } = useQuery({
    queryKey: ['safeInfo'],
    queryFn: getSafeInfo,
  });

  const syncMutation = useMutation({
    mutationFn: syncPendingTransactions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['safePendingTransactions'] });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: clearAllPendingTransactions,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['pendingTransactions'] });
      setShowClearConfirm(false);
      alert(`Cleared ${result.cleared} pending transaction(s)`);
    },
    onError: (err) => {
      alert(`Failed to clear: ${err instanceof Error ? err.message : 'Unknown error'}`);
    },
  });

  // Merge database metadata with Safe API data
  const transactions = (safeTxs || []).map(safeTx => {
    const dbTx = dbData?.transactions.find(t => t.safeTxHash === safeTx.safeTxHash);
    return {
      ...safeTx,
      title: dbTx?.title || `Transaction to ${safeTx.to.slice(0, 10)}...`,
      description: dbTx?.description,
      actionType: dbTx?.actionType || 'unknown',
      metadata: dbTx?.metadata || {},
    };
  });

  const threshold = safeInfo?.threshold ?? 2;

  // Get current on-chain nonce (lowest nonce among pending txs or from safeInfo)
  const currentNonce = transactions.length > 0 
    ? Math.min(...transactions.map(t => t.nonce))
    : null;

  // Filter to show only transactions at current nonce (executable ones)
  const executableTxs = transactions.filter(t => t.nonce === currentNonce);
  const queuedTxs = transactions.filter(t => t.nonce !== currentNonce);

  const getSafeUrl = () => {
    if (!safeAddress) return '#';
    return `https://app.safe.global/transactions/queue?safe=basesep:${safeAddress}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-governance-100">Pending Votes</h1>
          <p className="text-governance-400 mt-1">
            Review, sign, and execute governance transactions
          </p>
        </div>
        <div className="flex gap-3">
          {transactions.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={clearAllMutation.isPending}
              className="btn-secondary flex items-center gap-2 text-danger hover:bg-danger/10"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          )}
          <button
            onClick={() => {
              syncMutation.mutate();
              refetch();
            }}
            disabled={syncMutation.isPending}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <a
            href={getSafeUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex items-center gap-2"
          >
            Open Safe
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-governance-100 mb-2">
              Clear All Pending Transactions?
            </h3>
            <p className="text-governance-400 mb-4">
              This will mark all pending transaction(s) as rejected in our database.
              Use this to clean up stale transactions.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="btn-secondary"
                disabled={clearAllMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={() => clearAllMutation.mutate()}
                className="btn-primary bg-danger hover:bg-danger/80"
                disabled={clearAllMutation.isPending}
              >
                {clearAllMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  'Clear All'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Status Banner */}
      {!address && (
        <div className="card p-4 bg-warning/10 border-warning/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
            <div>
              <p className="text-sm text-governance-200">
                Connect your wallet to sign or execute transactions.
              </p>
            </div>
          </div>
        </div>
      )}

      {address && !isOwner() && (
        <div className="card p-4 bg-warning/10 border-warning/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
            <div>
              <p className="text-sm text-governance-200">
                Your wallet ({address.slice(0, 6)}...{address.slice(-4)}) is not a Safe owner. 
                You can view transactions but cannot sign or execute them.
              </p>
            </div>
          </div>
        </div>
      )}

      {address && isOwner() && (
        <div className="card p-4 bg-accent/5 border-accent/20">
          <div className="flex items-start gap-3">
            <Vote className="w-5 h-5 text-accent mt-0.5" />
            <div>
              <p className="text-sm text-governance-200">
                Connected as Safe owner. Transactions require {threshold} of {safeOwners.length} signatures.
                Click "Sign" to add your signature, or "Execute" when enough signatures are collected.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="card p-6 text-center">
          <AlertCircle className="w-12 h-12 text-danger mx-auto mb-3" />
          <p className="text-governance-300">Failed to load pending transactions</p>
          <button onClick={() => refetch()} className="btn-secondary mt-4">
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && transactions.length === 0 && (
        <div className="card p-12 text-center">
          <CheckCircle className="w-16 h-16 text-success/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-governance-200 mb-2">
            No pending transactions
          </h3>
          <p className="text-governance-400">
            All governance actions have been executed or there are no pending proposals.
          </p>
        </div>
      )}

      {/* Executable Transactions (current nonce) */}
      {!isLoading && executableTxs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-governance-200">
              Ready to Process (Nonce {currentNonce})
            </h2>
            {executableTxs.length > 1 && (
              <span className="text-xs bg-warning/20 text-warning px-2 py-1 rounded">
                {executableTxs.length} conflicting - only 1 can execute
              </span>
            )}
          </div>
          
          {executableTxs.map((tx) => (
            <TransactionCard
              key={tx.safeTxHash}
              transaction={tx}
              threshold={threshold}
              safeAddress={safeAddress}
              onConfirm={confirmTransaction}
              onExecute={executeTransaction}
              canSign={isOwner() && !hasAlreadySigned(tx)}
              hasSigned={hasAlreadySigned(tx)}
              isConfirming={isConfirming}
              isExecuting={isExecuting}
              onRefresh={refetch}
            />
          ))}
        </div>
      )}

      {/* Queued Transactions (future nonces) */}
      {!isLoading && queuedTxs.length > 0 && (
        <div className="space-y-4 mt-8">
          <h2 className="text-lg font-semibold text-governance-200">
            Queued (Waiting for earlier transactions)
          </h2>
          <p className="text-sm text-governance-400 -mt-2">
            These transactions have higher nonces and can only be executed after the current nonce transactions.
          </p>
          
          {queuedTxs.map((tx) => (
            <TransactionCard
              key={tx.safeTxHash}
              transaction={tx}
              threshold={threshold}
              safeAddress={safeAddress}
              onConfirm={confirmTransaction}
              onExecute={executeTransaction}
              canSign={isOwner() && !hasAlreadySigned(tx)}
              hasSigned={hasAlreadySigned(tx)}
              isConfirming={isConfirming}
              isExecuting={isExecuting}
              isQueued={true}
              onRefresh={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ExtendedSafeTx extends SafePendingTransaction {
  title: string;
  description?: string | null;
  actionType: string;
  metadata: Record<string, unknown>;
}

function TransactionCard({
  transaction,
  threshold,
  safeAddress,
  onConfirm,
  onExecute,
  canSign,
  hasSigned,
  isConfirming,
  isExecuting,
  isQueued = false,
  onRefresh,
}: {
  transaction: ExtendedSafeTx;
  threshold: number;
  safeAddress?: string | null;
  onConfirm: (safeTxHash: string) => Promise<{ success: boolean; error?: string }>;
  onExecute: (tx: SafePendingTransaction) => Promise<{ success: boolean; txHash?: string; error?: string }>;
  canSign: boolean;
  hasSigned: boolean;
  isConfirming: boolean;
  isExecuting: boolean;
  isQueued?: boolean;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  
  const config = ACTION_CONFIG[transaction.actionType] || {
    icon: Vote,
    label: transaction.actionType,
    color: 'text-governance-400',
  };
  const Icon = config.icon;

  const confirmations = transaction.confirmations?.length ?? 0;
  const remaining = threshold - confirmations;
  const progress = Math.min((confirmations / threshold) * 100, 100);
  const canExecute = remaining <= 0;

  const handleSign = async () => {
    setActionError(null);
    setActionInProgress(true);
    const result = await onConfirm(transaction.safeTxHash);
    setActionInProgress(false);
    
    if (result.success) {
      onRefresh();
    } else {
      setActionError(result.error || 'Failed to sign');
    }
  };

  const handleExecute = async () => {
    setActionError(null);
    setActionInProgress(true);
    const result = await onExecute(transaction);
    setActionInProgress(false);
    
    if (result.success) {
      alert(`Transaction executed successfully!\nTx Hash: ${result.txHash}`);
      onRefresh();
    } else {
      setActionError(result.error || 'Failed to execute');
    }
  };

  const getSafeTxUrl = () => {
    if (!safeAddress) return '#';
    return `https://app.safe.global/transactions/tx?safe=basesep:${safeAddress}&id=multisig_${safeAddress}_${transaction.safeTxHash}`;
  };

  return (
    <div className={`card p-5 ${isQueued ? 'opacity-70' : ''}`}>
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl bg-governance-800 flex items-center justify-center ${config.color}`}>
          <Icon className="w-6 h-6" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${config.color}`}>
                  {config.label}
                </span>
                <span className="text-xs text-governance-500">
                  Nonce #{transaction.nonce}
                </span>
              </div>
              <h3 className="font-medium text-governance-100 mt-0.5">
                {transaction.title}
              </h3>
              {transaction.description && (
                <p className="text-sm text-governance-400 mt-1">
                  {transaction.description}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {canSign && !isQueued && (
                <button
                  onClick={handleSign}
                  disabled={actionInProgress || isConfirming}
                  className="btn-primary flex items-center gap-2"
                >
                  {actionInProgress && isConfirming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <PenLine className="w-4 h-4" />
                  )}
                  Sign
                </button>
              )}
              
              {hasSigned && !canExecute && (
                <span className="text-xs text-success bg-success/10 px-2 py-1 rounded">
                  ✓ Signed
                </span>
              )}
              
              {canExecute && !isQueued && (
                <button
                  onClick={handleExecute}
                  disabled={actionInProgress || isExecuting}
                  className="btn-primary bg-success hover:bg-success/80 flex items-center gap-2"
                >
                  {actionInProgress && isExecuting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Execute
                </button>
              )}

              <a
                href={getSafeTxUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex items-center gap-2"
                title="View in Safe"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Error Display */}
          {actionError && (
            <div className="mt-3 p-2 bg-danger/10 border border-danger/20 rounded text-sm text-danger">
              {actionError}
            </div>
          )}

          {/* Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-governance-400">
                <Users className="w-4 h-4 inline mr-1" />
                {confirmations} of {threshold} signatures
              </span>
              {remaining > 0 ? (
                <span className="text-warning">
                  {remaining} more needed
                </span>
              ) : (
                <span className="text-success">
                  Ready to execute
                </span>
              )}
            </div>
            <div className="h-2 bg-governance-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  remaining > 0 ? 'bg-warning' : 'bg-success'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Signers List */}
          <div className="mt-3 flex flex-wrap gap-2">
            {transaction.confirmations?.map((conf) => (
              <span
                key={conf.owner}
                className="text-xs bg-governance-800 px-2 py-1 rounded"
                title={conf.owner}
              >
                {conf.owner.slice(0, 6)}...{conf.owner.slice(-4)} ✓
              </span>
            ))}
          </div>

          {/* Meta */}
          <div className="flex items-center gap-4 mt-3 text-xs text-governance-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(transaction.submissionDate), { addSuffix: true })}
            </span>
            <span>
              by {transaction.proposer.slice(0, 6)}...{transaction.proposer.slice(-4)}
            </span>
          </div>

          {/* Expandable Details */}
          <div className="mt-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-accent hover:underline"
            >
              {expanded ? 'Hide details' : 'Show details'}
            </button>
            {expanded && (
              <div className="mt-2 p-3 bg-governance-800/50 rounded-lg space-y-2">
                <div className="text-xs">
                  <span className="text-governance-500">Safe TX Hash:</span>
                  <span className="text-governance-300 ml-2 font-mono break-all">{transaction.safeTxHash}</span>
                </div>
                <div className="text-xs">
                  <span className="text-governance-500">Target:</span>
                  <span className="text-governance-300 ml-2 font-mono">{transaction.to}</span>
                </div>
                <div className="text-xs">
                  <span className="text-governance-500">Data:</span>
                  <span className="text-governance-300 ml-2 font-mono break-all">{transaction.data.slice(0, 66)}...</span>
                </div>
                {Object.keys(transaction.metadata || {}).length > 0 && (
                  <div className="text-xs">
                    <span className="text-governance-500">Metadata:</span>
                    <pre className="text-governance-300 mt-1 overflow-auto">
                      {JSON.stringify(transaction.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
