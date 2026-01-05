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
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  getPendingTransactions,
  syncPendingTransactions,
  getSafeInfo,
  type PendingTransaction,
} from '../lib/api';

// Action type icons and labels
const ACTION_CONFIG: Record<string, { icon: typeof Building2; label: string; color: string }> = {
  create_council: { icon: Building2, label: 'Create Council', color: 'text-accent' },
  close_council: { icon: Trash2, label: 'Close Council', color: 'text-danger' },
  add_member: { icon: UserPlus, label: 'Add Member', color: 'text-success' },
  remove_member: { icon: UserMinus, label: 'Remove Member', color: 'text-warning' },
};

export default function PendingVotesPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pendingTransactions'],
    queryFn: getPendingTransactions,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: safeInfo } = useQuery({
    queryKey: ['safeInfo'],
    queryFn: getSafeInfo,
  });

  const syncMutation = useMutation({
    mutationFn: syncPendingTransactions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingTransactions'] });
    },
  });

  const transactions = data?.transactions ?? [];
  const threshold = data?.safeThreshold ?? safeInfo?.threshold ?? 1;

  const getSafeUrl = () => {
    if (!safeInfo?.address) return '#';
    return `https://app.safe.global/transactions/queue?safe=basesep:${safeInfo.address}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-governance-100">Pending Votes</h1>
          <p className="text-governance-400 mt-1">
            Review and approve governance transactions
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync Status
          </button>
          <a
            href={getSafeUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex items-center gap-2"
          >
            Open Safe
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Info Banner */}
      <div className="card p-4 bg-accent/5 border-accent/20">
        <div className="flex items-start gap-3">
          <Vote className="w-5 h-5 text-accent mt-0.5" />
          <div>
            <p className="text-sm text-governance-200">
              Transactions require {threshold} signature{threshold !== 1 ? 's' : ''} to execute.
              Click "Vote in Safe" to approve a transaction.
            </p>
          </div>
        </div>
      </div>

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

      {/* Transactions List */}
      {!isLoading && transactions.length > 0 && (
        <div className="space-y-4">
          {transactions.map((tx) => (
            <TransactionCard
              key={tx.safeTxHash}
              transaction={tx}
              threshold={threshold}
              safeAddress={safeInfo?.address}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TransactionCard({
  transaction,
  threshold,
  safeAddress,
}: {
  transaction: PendingTransaction;
  threshold: number;
  safeAddress?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  
  const config = ACTION_CONFIG[transaction.actionType] || {
    icon: Vote,
    label: transaction.actionType,
    color: 'text-governance-400',
  };
  const Icon = config.icon;

  const confirmations = transaction.confirmations ?? 0;
  const remaining = threshold - confirmations;
  const progress = Math.min((confirmations / threshold) * 100, 100);

  const getSafeTxUrl = () => {
    if (!safeAddress) return '#';
    return `https://app.safe.global/transactions/tx?safe=basesep:${safeAddress}&id=multisig_${safeAddress}_${transaction.safeTxHash}`;
  };

  return (
    <div className="card p-5">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl bg-governance-800 flex items-center justify-center ${config.color}`}>
          <Icon className="w-6 h-6" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className={`text-xs font-medium ${config.color}`}>
                {config.label}
              </span>
              <h3 className="font-medium text-governance-100 mt-0.5">
                {transaction.title}
              </h3>
              {transaction.description && (
                <p className="text-sm text-governance-400 mt-1">
                  {transaction.description}
                </p>
              )}
            </div>

            {/* Vote Button */}
            <a
              href={getSafeTxUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary flex items-center gap-2 shrink-0"
            >
              <Vote className="w-4 h-4" />
              Vote in Safe
            </a>
          </div>

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

          {/* Meta */}
          <div className="flex items-center gap-4 mt-3 text-xs text-governance-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(transaction.proposedAt), { addSuffix: true })}
            </span>
            <span>
              by {transaction.proposedBy.slice(0, 6)}...{transaction.proposedBy.slice(-4)}
            </span>
          </div>

          {/* Expandable Details */}
          {Object.keys(transaction.metadata || {}).length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-accent hover:underline"
              >
                {expanded ? 'Hide details' : 'Show details'}
              </button>
              {expanded && (
                <div className="mt-2 p-3 bg-governance-800/50 rounded-lg">
                  <pre className="text-xs text-governance-300 overflow-auto">
                    {JSON.stringify(transaction.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
