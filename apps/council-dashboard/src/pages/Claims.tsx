import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Clock, 
  FileCheck,
  Loader2,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { useMemberPendingClaims, useMemberCouncils } from '../hooks/useClaims';
import { formatUSDC, getTimeRemaining, getStatusBadge, formatAddress } from '../lib/api';
import type { Claim } from '../lib/api';

type FilterStatus = 'all' | 'needs_vote' | 'voted' | 'urgent';

export default function ClaimsPage() {
  const { address } = useWallet();
  const { data: claimsData, isLoading } = useMemberPendingClaims(address);
  const { data: councilsData } = useMemberCouncils(address);
  
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedCouncil, setSelectedCouncil] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allClaims = claimsData?.claims ?? [];
  const councils = councilsData?.councils ?? [];

  // Apply filters
  const filteredClaims = allClaims.filter((claim) => {
    // Council filter
    if (selectedCouncil !== 'all' && claim.councilId !== selectedCouncil) {
      return false;
    }

    // Status filter
    if (filterStatus === 'needs_vote' && (claim.hasVoted || !claim.canVote)) {
      return false;
    }
    if (filterStatus === 'voted' && !claim.hasVoted) {
      return false;
    }
    if (filterStatus === 'urgent') {
      const deadline = new Date(claim.votingDeadline);
      const hoursLeft = (deadline.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursLeft <= 0 || hoursLeft > 24) {
        return false;
      }
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        claim.claimId.includes(query) ||
        claim.agentId.includes(query) ||
        claim.claimant.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Stats
  const stats = {
    total: allClaims.length,
    needsVote: allClaims.filter(c => !c.hasVoted && c.canVote).length,
    voted: allClaims.filter(c => c.hasVoted).length,
    urgent: allClaims.filter(c => {
      const deadline = new Date(c.votingDeadline);
      const hoursLeft = (deadline.getTime() - Date.now()) / (1000 * 60 * 60);
      return hoursLeft > 0 && hoursLeft < 24;
    }).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-governance-100">Claims Queue</h1>
        <p className="text-governance-400 mt-1">
          Review and vote on claims assigned to your councils
        </p>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-governance-500" />
            <input
              type="text"
              placeholder="Search by claim ID, agent ID, or claimant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Council Filter */}
          <div className="relative">
            <select
              value={selectedCouncil}
              onChange={(e) => setSelectedCouncil(e.target.value)}
              className="input appearance-none pr-10 min-w-[180px]"
            >
              <option value="all">All Councils</option>
              {councils.map((council) => (
                <option key={council.councilId} value={council.councilId}>
                  {council.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-governance-500 pointer-events-none" />
          </div>
        </div>

        {/* Quick Filters */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'all'
                ? 'bg-council text-governance-950'
                : 'bg-governance-800 text-governance-300 hover:text-governance-100'
            }`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setFilterStatus('needs_vote')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'needs_vote'
                ? 'bg-council text-governance-950'
                : 'bg-governance-800 text-governance-300 hover:text-governance-100'
            }`}
          >
            Needs Vote ({stats.needsVote})
          </button>
          <button
            onClick={() => setFilterStatus('voted')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'voted'
                ? 'bg-council text-governance-950'
                : 'bg-governance-800 text-governance-300 hover:text-governance-100'
            }`}
          >
            Voted ({stats.voted})
          </button>
          <button
            onClick={() => setFilterStatus('urgent')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'urgent'
                ? 'bg-danger text-white'
                : 'bg-governance-800 text-governance-300 hover:text-governance-100'
            }`}
          >
            <Clock className="w-4 h-4 inline mr-1" />
            Urgent ({stats.urgent})
          </button>
        </div>
      </div>

      {/* Claims List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-council" />
        </div>
      ) : filteredClaims.length === 0 ? (
        <div className="card p-12 text-center">
          <FileCheck className="w-12 h-12 text-governance-600 mx-auto mb-3" />
          <p className="text-governance-300">No claims found</p>
          <p className="text-governance-500 text-sm mt-1">
            {searchQuery || selectedCouncil !== 'all' || filterStatus !== 'all'
              ? 'Try adjusting your filters'
              : 'No pending claims for your councils'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClaims.map((claim) => (
            <ClaimCard key={claim.claimId} claim={claim} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClaimCard({ claim }: { claim: Claim }) {
  const deadline = new Date(claim.votingDeadline);
  const hoursLeft = (deadline.getTime() - Date.now()) / (1000 * 60 * 60);
  const isUrgent = hoursLeft > 0 && hoursLeft < 24;

  return (
    <Link
      to={`/claims/${claim.claimId}`}
      className={`claim-card block ${isUrgent ? 'border-danger/50' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* Status Icon */}
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            claim.hasVoted
              ? 'bg-accent/20'
              : claim.canVote
              ? 'bg-council/20'
              : 'bg-governance-800'
          }`}>
            {claim.hasVoted ? (
              <CheckCircle2 className="w-5 h-5 text-accent" />
            ) : claim.canVote ? (
              <FileCheck className="w-5 h-5 text-council" />
            ) : (
              <AlertCircle className="w-5 h-5 text-governance-500" />
            )}
          </div>

          {/* Main Info */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-governance-100">
                Claim #{claim.claimId}
              </span>
              <span className={getStatusBadge(claim.status)}>
                {claim.status}
              </span>
              {claim.hasVoted && (
                <span className="badge-success">Voted</span>
              )}
              {isUrgent && !claim.hasVoted && (
                <span className="badge-danger">Urgent</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <p className="text-sm text-governance-400">
                Agent #{claim.agentId} • by {formatAddress(claim.claimant)}
              </p>
              {claim.councilName && (
                <span className="text-xs px-2 py-0.5 bg-council/20 text-council rounded">
                  {claim.councilName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side */}
        <div className="text-right flex-shrink-0">
          <p className="font-medium text-governance-100">
            {formatUSDC(claim.claimedAmount)}
          </p>
          {claim.canVote && (
            <div className={`flex items-center gap-1 text-sm mt-1 ${
              isUrgent ? 'text-danger' : 'text-governance-400'
            }`}>
              <Clock className="w-4 h-4" />
              <span>{getTimeRemaining(claim.votingDeadline)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar (if voting) */}
      {claim.canVote && claim.votingProgress && (
        <div className="mt-4 pt-4 border-t border-governance-800">
          <div className="flex items-center justify-between text-xs text-governance-500 mb-2">
            <span>
              {claim.votingProgress.totalVotes} / {claim.votingProgress.requiredQuorum} votes
            </span>
            <span>
              {claim.votingProgress.quorumReached ? (
                <span className="text-accent">Quorum reached</span>
              ) : (
                `${Number(claim.votingProgress.requiredQuorum) - Number(claim.votingProgress.totalVotes)} more needed`
              )}
            </span>
          </div>
          <div className="h-2 bg-governance-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-council transition-all duration-300"
              style={{
                width: `${Math.min(100, (Number(claim.votingProgress.totalVotes) / Number(claim.votingProgress.requiredQuorum)) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </Link>
  );
}
