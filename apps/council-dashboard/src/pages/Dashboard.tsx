import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileCheck, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  ArrowRight,
  Loader2,
  Users,
  MessageSquare,
} from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { useMemberCouncils, useMemberPendingClaims } from '../hooks/useClaims';
import { formatUSDC, getTimeRemaining, formatAddress } from '../lib/api';

export default function DashboardPage() {
  const { address } = useWallet();
  const { data: councilsData, isLoading: councilsLoading } = useMemberCouncils(address);
  const { data: claimsData, isLoading: claimsLoading } = useMemberPendingClaims(address);

  const councils = councilsData?.councils ?? [];
  const pendingClaims = claimsData?.claims ?? [];
  
  // Create a lookup map for council names
  const councilNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    councils.forEach(c => {
      map[c.councilId] = c.name;
    });
    return map;
  }, [councils]);
  
  const urgentClaims = pendingClaims.filter(c => {
    const deadline = new Date(c.votingDeadline);
    const hoursLeft = (deadline.getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursLeft > 0 && hoursLeft < 24;
  });
  const needsVote = pendingClaims.filter(c => !c.hasVoted && c.canVote);
  
  // Claims in evidence period (Filed status, evidence deadline not passed)
  const evidencePeriodClaims = pendingClaims.filter(c => c.isInEvidencePeriod);
  
  // Helper to get council name
  const getCouncilName = (councilId: string) => councilNameMap[councilId] || null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-governance-100">Dashboard</h1>
        <p className="text-governance-400 mt-1">
          Welcome back, {address ? formatAddress(address) : 'Council Member'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-governance-500">My Councils</p>
              <p className="text-2xl font-bold text-governance-100 mt-1">
                {councilsLoading ? '—' : councils.length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-council/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-council" />
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-governance-500">Pending Claims</p>
              <p className="text-2xl font-bold text-governance-100 mt-1">
                {claimsLoading ? '—' : pendingClaims.length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-governance-500">Need My Vote</p>
              <p className="text-2xl font-bold text-council mt-1">
                {claimsLoading ? '—' : needsVote.length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-accent" />
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-governance-500">Urgent (&lt;24h)</p>
              <p className="text-2xl font-bold text-danger mt-1">
                {claimsLoading ? '—' : urgentClaims.length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-danger/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-danger" />
            </div>
          </div>
        </div>
      </div>

      {/* My Councils */}
      {councils.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-governance-100 mb-4">My Councils</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {councils.map((council) => (
              <div
                key={council.councilId}
                className="p-4 bg-governance-800/50 rounded-lg border border-governance-700"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-governance-100">{council.name}</h3>
                    <p className="text-sm text-governance-400 capitalize">{council.vertical}</p>
                  </div>
                  <span className="badge-council">{council.memberCount} members</span>
                </div>
                {council.description && (
                  <p className="mt-2 text-xs text-governance-500 line-clamp-2">
                    {council.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claims Needing Vote */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-governance-100">Claims Needing Your Vote</h2>
          <Link
            to="/claims"
            className="text-council hover:text-council-light text-sm flex items-center gap-1"
          >
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {claimsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-council" />
          </div>
        ) : needsVote.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-accent mx-auto mb-3" />
            <p className="text-governance-300">All caught up!</p>
            <p className="text-governance-500 text-sm mt-1">
              No claims currently need your vote
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {needsVote.slice(0, 5).map((claim) => (
              <Link
                key={claim.claimId}
                to={`/claims/${claim.claimId}`}
                className="claim-card flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-governance-800 flex items-center justify-center">
                    <FileCheck className="w-5 h-5 text-governance-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-governance-100">
                        Claim #{claim.claimId}
                      </span>
                      <span className="text-sm text-governance-500">
                        Agent #{claim.agentId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-governance-400">
                        {formatUSDC(claim.claimedAmount)} claimed
                      </p>
                      {getCouncilName(claim.councilId) && (
                        <span className="text-xs px-2 py-0.5 bg-council/20 text-council rounded">
                          {getCouncilName(claim.councilId)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-warning text-sm">
                    <Clock className="w-4 h-4" />
                    <span>{getTimeRemaining(claim.votingDeadline)}</span>
                  </div>
                  <p className="text-xs text-governance-500 mt-1">to vote</p>
                </div>
              </Link>
            ))}

            {needsVote.length > 5 && (
              <Link
                to="/claims"
                className="block text-center py-3 text-council hover:text-council-light text-sm"
              >
                +{needsVote.length - 5} more claims need your vote
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Claims in Evidence Period */}
      {evidencePeriodClaims.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-governance-100">Claims in Evidence Period</h2>
            </div>
            <span className="text-sm text-governance-500">
              {evidencePeriodClaims.length} claim{evidencePeriodClaims.length > 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-sm text-governance-400 mb-4">
            These claims are collecting evidence. You can review and add comments before voting opens.
          </p>
          <div className="space-y-3">
            {evidencePeriodClaims.slice(0, 5).map((claim) => (
              <Link
                key={claim.claimId}
                to={`/claims/${claim.claimId}`}
                className="claim-card flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-governance-100">
                        Claim #{claim.claimId}
                      </span>
                      <span className="text-sm text-governance-500">
                        Agent #{claim.agentId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-governance-400">
                        {formatUSDC(claim.claimedAmount)} claimed
                      </p>
                      {getCouncilName(claim.councilId) && (
                        <span className="text-xs px-2 py-0.5 bg-council/20 text-council rounded">
                          {getCouncilName(claim.councilId)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-blue-400 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>{getTimeRemaining(claim.evidenceDeadline)}</span>
                  </div>
                  <p className="text-xs text-governance-500 mt-1">evidence period</p>
                </div>
              </Link>
            ))}

            {evidencePeriodClaims.length > 5 && (
              <Link
                to="/claims"
                className="block text-center py-3 text-council hover:text-council-light text-sm"
              >
                +{evidencePeriodClaims.length - 5} more claims in evidence period
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Urgent Claims Warning */}
      {urgentClaims.length > 0 && (
        <div className="card p-6 border-danger/50 bg-danger/5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-danger/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-danger" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-danger">Urgent: Claims Expiring Soon</h3>
              <p className="text-sm text-governance-400 mt-1">
                {urgentClaims.length} claim{urgentClaims.length > 1 ? 's' : ''} will close
                within 24 hours. Vote now to receive your share of the deposit.
              </p>
              <div className="mt-4 space-y-2">
                {urgentClaims.map((claim) => (
                  <Link
                    key={claim.claimId}
                    to={`/claims/${claim.claimId}`}
                    className="flex items-center justify-between p-3 bg-governance-900/50 rounded-lg hover:bg-governance-800/50 transition-colors"
                  >
                    <span className="text-governance-100">Claim #{claim.claimId}</span>
                    <span className="text-danger text-sm">
                      {getTimeRemaining(claim.votingDeadline)} remaining
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Not a Member Warning */}
      {!councilsLoading && councils.length === 0 && (
        <div className="card p-6 border-warning/50 bg-warning/5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <h3 className="font-medium text-warning">Not a Council Member</h3>
              <p className="text-sm text-governance-400 mt-1">
                Your wallet is not registered as a member of any council. Contact the governance team
                if you believe this is an error.
              </p>
              <p className="text-xs text-governance-500 mt-2">
                Wallet: {address}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
