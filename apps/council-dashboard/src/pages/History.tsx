import { Link } from 'react-router-dom';
import { 
  History as HistoryIcon, 
  CheckCircle, 
  XCircle, 
  MinusCircle,
  Loader2,
} from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { useMemberPendingClaims } from '../hooks/useClaims';
import { formatUSDC } from '../lib/api';

export default function HistoryPage() {
  const { address } = useWallet();
  const { data: claimsData, isLoading } = useMemberPendingClaims(address);
  
  // For now, we show voted claims from pending claims
  // In production, this would query historical data from a subgraph
  const votedClaims = claimsData?.claims.filter(c => c.hasVoted) ?? [];

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
          <p className="text-sm text-governance-500">Total Votes Cast</p>
          <p className="text-2xl font-bold text-governance-100 mt-1">
            {isLoading ? '—' : votedClaims.length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-governance-500">Deposit Earnings</p>
          <p className="text-2xl font-bold text-accent mt-1">
            Coming Soon
          </p>
          <p className="text-xs text-governance-500 mt-1">Requires subgraph</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-governance-500">Win Rate</p>
          <p className="text-2xl font-bold text-governance-100 mt-1">
            Coming Soon
          </p>
          <p className="text-xs text-governance-500 mt-1">Requires subgraph</p>
        </div>
      </div>

      {/* History List */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-governance-100 mb-4">Recent Votes</h2>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-council" />
          </div>
        ) : votedClaims.length === 0 ? (
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
            {votedClaims.map((claim) => (
              <Link
                key={claim.claimId}
                to={`/claims/${claim.claimId}`}
                className="flex items-center justify-between p-4 bg-governance-800/50 rounded-lg hover:bg-governance-800 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-governance-100">
                      Claim #{claim.claimId}
                    </p>
                    <p className="text-sm text-governance-400">
                      Agent #{claim.agentId} • {formatUSDC(claim.claimedAmount)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-sm ${
                    claim.status === 'Approved' ? 'text-accent' :
                    claim.status === 'Rejected' ? 'text-danger' :
                    'text-governance-400'
                  }`}>
                    {claim.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Note about full history */}
        <div className="mt-6 p-4 bg-governance-800/30 rounded-lg border border-governance-700">
          <p className="text-sm text-governance-400">
            <strong className="text-governance-300">Note:</strong> Full voting history including 
            resolved claims and deposit earnings will be available once the subgraph is deployed. 
            Currently showing only pending claims where you've voted.
          </p>
        </div>
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
              Vote to approve the claim and specify the compensation amount. The median of all approval amounts becomes the final payout.
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
            Claimant deposits are always distributed to council members who voted (except abstentions). 
            This happens regardless of the outcome—even if the claim is approved, voters receive their 
            share of the deposit as compensation for their time and judgment.
          </p>
        </div>
      </div>
    </div>
  );
}
