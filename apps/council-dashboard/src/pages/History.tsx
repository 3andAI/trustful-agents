import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  History as HistoryIcon, 
  CheckCircle, 
  XCircle, 
  MinusCircle,
  Loader2,
  TrendingUp,
  Coins,
} from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { formatUSDC } from '../lib/api';
import { getVoterStats, type SubgraphVote } from '../lib/subgraph';

// Format USDC from BigInt
function formatUSDCBigInt(amount: bigint): string {
  const dollars = Number(amount) / 1_000_000;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

// Get vote type label
function getVoteLabel(vote: number): string {
  switch (vote) {
    case 1: return 'Approved';
    case 2: return 'Rejected';
    case 3: return 'Abstained';
    default: return 'Unknown';
  }
}

// Get vote icon
function VoteIcon({ vote }: { vote: number }) {
  switch (vote) {
    case 1: return <CheckCircle className="w-5 h-5 text-accent" />;
    case 2: return <XCircle className="w-5 h-5 text-danger" />;
    case 3: return <MinusCircle className="w-5 h-5 text-governance-400" />;
    default: return null;
  }
}

export default function HistoryPage() {
  const { address } = useWallet();
  
  // Fetch voter stats from subgraph
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['voterStats', address],
    queryFn: () => getVoterStats(address!),
    enabled: !!address,
    staleTime: 60000, // 1 minute
    refetchInterval: 120000, // 2 minutes
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-governance-100">Voting History</h1>
        <p className="text-governance-400 mt-1">
          Your votes on past and pending claims
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-governance-500">Total Votes Cast</p>
              <p className="text-2xl font-bold text-governance-100 mt-1">
                {isLoading ? '—' : stats?.totalVotes ?? 0}
              </p>
              {stats && (
                <p className="text-xs text-governance-500 mt-1">
                  {stats.approveVotes} approve • {stats.rejectVotes} reject • {stats.abstainVotes} abstain
                </p>
              )}
            </div>
            <div className="w-10 h-10 rounded-lg bg-council/20 flex items-center justify-center">
              <HistoryIcon className="w-5 h-5 text-council" />
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-governance-500">Deposit Earnings</p>
              <p className="text-2xl font-bold text-accent mt-1">
                {isLoading ? '—' : stats ? formatUSDCBigInt(stats.depositEarnings) : '$0.00'}
              </p>
              <p className="text-xs text-governance-500 mt-1">From finalized claims</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <Coins className="w-5 h-5 text-accent" />
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-governance-500">Win Rate</p>
              <p className="text-2xl font-bold text-governance-100 mt-1">
                {isLoading ? '—' : stats ? `${stats.winRate}%` : '—'}
              </p>
              <p className="text-xs text-governance-500 mt-1">Votes matching outcome</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-council/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-council" />
            </div>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-governance-100 mb-4">Vote History</h2>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-council" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <HistoryIcon className="w-12 h-12 text-danger mx-auto mb-3" />
            <p className="text-governance-300">Failed to load voting history</p>
            <p className="text-governance-500 text-sm mt-1">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        ) : !stats || stats.votes.length === 0 ? (
          <div className="text-center py-12">
            <HistoryIcon className="w-12 h-12 text-governance-600 mx-auto mb-3" />
            <p className="text-governance-300">No voting history yet</p>
            <p className="text-governance-500 text-sm mt-1">
              Start voting on claims to build your history
            </p>
            <Link to="/claims" className="btn-primary inline-block mt-4">
              View Pending Claims
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {stats.votes.map((vote) => (
              <VoteHistoryItem key={vote.id} vote={vote} />
            ))}
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-governance-100 mb-4">How Voting Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center mb-3">
              <CheckCircle className="w-5 h-5 text-accent" />
            </div>
            <h3 className="font-medium text-governance-100">Approve</h3>
            <p className="text-sm text-governance-400">
              Vote to approve the claim. If approved, the claimant receives the claimed amount from the agent's collateral.
            </p>
          </div>
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-danger/20 flex items-center justify-center mb-3">
              <XCircle className="w-5 h-5 text-danger" />
            </div>
            <h3 className="font-medium text-governance-100">Reject</h3>
            <p className="text-sm text-governance-400">
              Vote to reject the claim if you believe it's invalid or unsupported by evidence. No compensation is paid if rejected.
            </p>
          </div>
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-governance-800 flex items-center justify-center mb-3">
              <MinusCircle className="w-5 h-5 text-governance-400" />
            </div>
            <h3 className="font-medium text-governance-100">Abstain</h3>
            <p className="text-sm text-governance-400">
              Abstain if you have a conflict of interest or cannot make an informed decision. You won't receive a share of the deposit.
            </p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-governance-800">
          <h3 className="font-medium text-governance-100 mb-2">Deposit Distribution</h3>
          <p className="text-sm text-governance-400">
            Claimant deposits are distributed to council members who voted (except abstentions) once a claim is finalized. 
            This happens regardless of the outcome—even if the claim is approved, voters receive their 
            share of the deposit as compensation for their time and judgment.
          </p>
        </div>
      </div>
    </div>
  );
}

// Vote history item component
function VoteHistoryItem({ vote }: { vote: SubgraphVote }) {
  const claim = vote.claim;
  
  return (
    <Link
      to={`/claims/${claim.id}`}
      className="flex items-center justify-between p-4 bg-governance-800/50 rounded-lg hover:bg-governance-800 transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-governance-700/50 flex items-center justify-center">
          <VoteIcon vote={vote.vote} />
        </div>
        <div>
          <p className="font-medium text-governance-100">
            Claim #{claim.id}
          </p>
          <p className="text-sm text-governance-400">
            {formatUSDC(claim.claimedAmount)} • You {getVoteLabel(vote.vote).toLowerCase()}
          </p>
          {vote.reasoning && (
            <p className="text-xs text-governance-500 mt-1 italic">
              "{vote.reasoning.slice(0, 50)}{vote.reasoning.length > 50 ? '...' : ''}"
            </p>
          )}
        </div>
      </div>
      <div className="text-right">
        <span className={`text-sm font-medium ${
          claim.status === 'Approved' || claim.status === 'Executed' ? 'text-accent' :
          claim.status === 'Rejected' ? 'text-danger' :
          'text-governance-400'
        }`}>
          {claim.status}
        </span>
        <p className="text-xs text-governance-500 mt-1">
          {new Date(parseInt(vote.votedAt) * 1000).toLocaleDateString()}
        </p>
      </div>
    </Link>
  );
}
