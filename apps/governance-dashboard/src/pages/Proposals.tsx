import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Vote,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
  Filter,
  UserPlus,
  UserMinus,
  Trash2,
  Plus,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  getProposals,
  vote as castVote,
  getProposalTransaction,
  type Proposal,
} from '../lib/api';

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected' | 'expired' | 'executed';
type FilterType = 'all' | 'create_council' | 'delete_council' | 'add_member' | 'remove_member';

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', badge: 'badge-warning', icon: Clock },
  approved: { label: 'Approved', badge: 'badge-success', icon: CheckCircle2 },
  rejected: { label: 'Rejected', badge: 'badge-danger', icon: XCircle },
  expired: { label: 'Expired', badge: 'badge-neutral', icon: Clock },
  executed: { label: 'Executed', badge: 'badge-success', icon: CheckCircle2 },
};

const TYPE_CONFIG = {
  create_council: { label: 'Create Council', icon: Plus, color: 'text-accent' },
  delete_council: { label: 'Delete Council', icon: Trash2, color: 'text-danger' },
  add_member: { label: 'Add Member', icon: UserPlus, color: 'text-accent' },
  remove_member: { label: 'Remove Member', icon: UserMinus, color: 'text-warning' },
};

function VoteButtons({
  proposal,
  onVote,
  isVoting,
}: {
  proposal: Proposal;
  onVote: (choice: 'aye' | 'nay' | 'abstain') => void;
  isVoting: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onVote('aye')}
        disabled={isVoting}
        className={`vote-btn-aye ${proposal.myVote === 'aye' ? 'active' : ''}`}
      >
        {isVoting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aye'}
      </button>
      <button
        onClick={() => onVote('nay')}
        disabled={isVoting}
        className={`vote-btn-nay ${proposal.myVote === 'nay' ? 'active' : ''}`}
      >
        Nay
      </button>
      <button
        onClick={() => onVote('abstain')}
        disabled={isVoting}
        className={`vote-btn-abstain ${proposal.myVote === 'abstain' ? 'active' : ''}`}
      >
        Abstain
      </button>
    </div>
  );
}

function VoteProgress({
  aye,
  nay,
  abstain,
  threshold,
}: {
  aye: number;
  nay: number;
  abstain: number;
  threshold: number;
}) {
  const total = aye + nay + abstain;
  const ayePercent = total > 0 ? (aye / Math.max(total, threshold)) * 100 : 0;
  const nayPercent = total > 0 ? (nay / Math.max(total, threshold)) * 100 : 0;
  const thresholdPercent = (threshold / Math.max(total, threshold)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="text-accent font-medium">{aye} Aye</span>
          <span className="text-danger font-medium">{nay} Nay</span>
          <span className="text-governance-500">{abstain} Abstain</span>
        </div>
        <span className="text-governance-400">{threshold} needed</span>
      </div>
      <div className="relative h-3 bg-governance-800 rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-accent transition-all duration-500"
          style={{ width: `${ayePercent}%` }}
        />
        <div
          className="absolute top-0 h-full bg-danger transition-all duration-500"
          style={{ left: `${ayePercent}%`, width: `${nayPercent}%` }}
        />
        {/* Threshold marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-governance-400"
          style={{ left: `${thresholdPercent}%` }}
        />
      </div>
    </div>
  );
}

function ProposalCard({
  proposal,
  onVote,
  isVoting,
}: {
  proposal: Proposal;
  onVote: (proposalId: string, choice: 'aye' | 'nay' | 'abstain') => void;
  isVoting: boolean;
}) {
  const [showExecute, setShowExecute] = useState(false);
  const [safeUrl, setSafeUrl] = useState<string | null>(null);

  const statusConfig = STATUS_CONFIG[proposal.status];
  const typeConfig = TYPE_CONFIG[proposal.type];
  const StatusIcon = statusConfig.icon;
  const TypeIcon = typeConfig.icon;

  const handleExecute = async () => {
    try {
      const result = await getProposalTransaction(proposal.id);
      setSafeUrl(result.safeAppUrl);
      setShowExecute(true);
    } catch (error) {
      console.error('Failed to get transaction data:', error);
    }
  };

  // Determine the main title/subject of the proposal
  const getProposalTitle = () => {
    switch (proposal.type) {
      case 'create_council':
        return proposal.councilName || 'New Council';
      case 'delete_council':
        return `Delete Council`;
      case 'add_member':
        return proposal.memberName || shortenAddress(proposal.memberAddress || '');
      case 'remove_member':
        return shortenAddress(proposal.memberAddress || '');
      default:
        return 'Proposal';
    }
  };

  return (
    <div className="card p-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-governance-800/50 ${typeConfig.color}`}>
            <TypeIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-governance-100">
                {getProposalTitle()}
              </h3>
              <span className={statusConfig.badge}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </span>
            </div>
            <p className="text-sm text-governance-400 mt-0.5">
              {typeConfig.label}
              {proposal.councilId && proposal.type !== 'create_council' && (
                <span className="text-governance-500"> • Council {shortenAddress(proposal.councilId)}</span>
              )}
            </p>
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="text-governance-500">
            Proposed by {shortenAddress(proposal.proposerAddress)}
          </p>
          <p className="text-governance-400">
            {format(new Date(proposal.createdAt), 'MMM d, yyyy HH:mm')}
          </p>
        </div>
      </div>

      {/* Description for council proposals */}
      {proposal.councilDescription && (
        <p className="text-sm text-governance-300 mb-4 p-3 bg-governance-800/30 rounded-lg">
          {proposal.councilDescription}
        </p>
      )}

      {/* Vote progress */}
      <div className="mb-4">
        <VoteProgress
          aye={proposal.votesAye}
          nay={proposal.votesNay}
          abstain={proposal.votesAbstain}
          threshold={proposal.threshold}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-governance-800">
        <div className="text-sm text-governance-400">
          {proposal.status === 'pending' && (
            <>
              Expires {formatDistanceToNow(new Date(proposal.expiresAt), { addSuffix: true })}
            </>
          )}
          {proposal.status === 'approved' && !showExecute && (
            <button
              onClick={handleExecute}
              className="text-accent hover:text-accent-light flex items-center gap-1"
            >
              <ExternalLink className="w-4 h-4" />
              Execute in Safe
            </button>
          )}
          {proposal.status === 'executed' && (
            <span className="text-accent flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              Executed on-chain
            </span>
          )}
        </div>

        {proposal.status === 'pending' && (
          <VoteButtons
            proposal={proposal}
            onVote={(choice) => onVote(proposal.id, choice)}
            isVoting={isVoting}
          />
        )}
      </div>

      {/* Safe execution panel */}
      {showExecute && safeUrl && (
        <div className="mt-4 p-4 bg-accent/10 border border-accent/20 rounded-lg">
          <p className="text-sm text-governance-200 mb-3">
            This proposal is approved! Click below to execute the transaction in Safe.
          </p>
          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Open Safe App
          </a>
        </div>
      )}
    </div>
  );
}

export default function ProposalsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [votingProposalId, setVotingProposalId] = useState<string | null>(null);

  const { data: proposals, isLoading } = useQuery({
    queryKey: ['proposals', statusFilter, typeFilter],
    queryFn: () =>
      getProposals({
        status: statusFilter === 'all' ? undefined : statusFilter,
        type: typeFilter === 'all' ? undefined : typeFilter,
      }),
  });

  const voteMutation = useMutation({
    mutationFn: ({ proposalId, choice }: { proposalId: string; choice: 'aye' | 'nay' | 'abstain' }) =>
      castVote(proposalId, choice),
    onMutate: ({ proposalId }) => {
      setVotingProposalId(proposalId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['pendingProposals'] });
    },
    onSettled: () => {
      setVotingProposalId(null);
    },
  });

  const handleVote = (proposalId: string, choice: 'aye' | 'nay' | 'abstain') => {
    voteMutation.mutate({ proposalId, choice });
  };

  const pendingCount = proposals?.filter((p) => p.status === 'pending').length || 0;
  const needsVoteCount = proposals?.filter((p) => p.status === 'pending' && !p.myVote).length || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-governance-100">Proposals</h1>
        <p className="text-governance-400 mt-1">
          Review and vote on governance proposals
        </p>
      </div>

      {/* Action needed banner */}
      {needsVoteCount > 0 && (
        <div className="card p-4 border-warning/30 flex items-center gap-4">
          <div className="p-2 bg-warning/10 rounded-lg">
            <AlertCircle className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="text-governance-100 font-medium">
              {needsVoteCount} proposal{needsVoteCount > 1 ? 's' : ''} awaiting your vote
            </p>
            <p className="text-sm text-governance-400">
              Cast your vote before the deadline expires
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-governance-500" />
          <span className="text-sm text-governance-400">Filters:</span>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
          className="input w-auto text-sm"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
          <option value="executed">Executed</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as FilterType)}
          className="input w-auto text-sm"
        >
          <option value="all">All Types</option>
          <option value="create_council">Create Council</option>
          <option value="delete_council">Delete Council</option>
          <option value="add_member">Add Member</option>
          <option value="remove_member">Remove Member</option>
        </select>

        {pendingCount > 0 && (
          <span className="text-sm text-governance-400">
            {pendingCount} pending • {proposals?.length || 0} total
          </span>
        )}
      </div>

      {/* Proposals list */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-governance-400" />
          <p className="text-governance-400 mt-2">Loading proposals...</p>
        </div>
      ) : proposals && proposals.length > 0 ? (
        <div className="space-y-4">
          {proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onVote={handleVote}
              isVoting={votingProposalId === proposal.id}
            />
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Vote className="w-12 h-12 mx-auto text-governance-600 mb-4" />
          <h3 className="text-lg font-medium text-governance-300">No proposals found</h3>
          <p className="text-governance-500 mt-1">
            {statusFilter !== 'all' || typeFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Create a council or add members to get started'}
          </p>
        </div>
      )}

      {/* Vote mutation error */}
      {voteMutation.error && (
        <div className="fixed bottom-4 right-4 p-4 bg-danger/90 text-white rounded-lg shadow-lg animate-slide-up">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>
              {voteMutation.error instanceof Error
                ? voteMutation.error.message
                : 'Failed to cast vote'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
