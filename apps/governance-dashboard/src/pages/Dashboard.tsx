import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  Vote,
  Clock,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getCouncils, getPendingProposals, getSafeInfo, type Proposal } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-governance-400">{label}</p>
          <p className="text-3xl font-bold text-governance-100 mt-1">{value}</p>
        </div>
        <div className="p-3 bg-governance-800/50 rounded-lg">
          <Icon className="w-6 h-6 text-accent" />
        </div>
      </div>
    </div>
  );
}

function ProposalTypeLabel({ type }: { type: Proposal['type'] }) {
  const labels = {
    create_council: 'Create Council',
    delete_council: 'Delete Council',
    add_member: 'Add Member',
    remove_member: 'Remove Member',
  };
  return <span>{labels[type]}</span>;
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
  const ayePercent = total > 0 ? (aye / total) * 100 : 0;
  const nayPercent = total > 0 ? (nay / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-accent">{aye} Aye</span>
        <span className="text-governance-500">{threshold} needed</span>
        <span className="text-danger">{nay} Nay</span>
      </div>
      <div className="h-2 bg-governance-800 rounded-full overflow-hidden flex">
        <div
          className="bg-accent transition-all duration-300"
          style={{ width: `${ayePercent}%` }}
        />
        <div
          className="bg-danger transition-all duration-300"
          style={{ width: `${nayPercent}%` }}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { profile } = useAuth();

  const { data: councils, isLoading: councilsLoading } = useQuery({
    queryKey: ['councils'],
    queryFn: getCouncils,
  });

  const { data: pendingProposals, isLoading: proposalsLoading } = useQuery({
    queryKey: ['pendingProposals'],
    queryFn: getPendingProposals,
  });

  const { data: safeInfo } = useQuery({
    queryKey: ['safeInfo'],
    queryFn: getSafeInfo,
  });

  const activeCouncils = councils?.filter((c) => c.active) || [];
  const totalMembers = councils?.reduce((sum, c) => sum + c.memberCount, 0) || 0;
  const needsMyVote = pendingProposals?.filter((p) => !p.myVote) || [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-governance-100">
          Welcome back{profile?.name ? `, ${profile.name}` : ''}
        </h1>
        <p className="text-governance-400 mt-1">
          Here's what's happening with governance today
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Councils"
          value={councilsLoading ? '...' : activeCouncils.length}
          icon={Users}
        />
        <StatCard
          label="Total Members"
          value={councilsLoading ? '...' : totalMembers}
          icon={Users}
        />
        <StatCard
          label="Pending Proposals"
          value={proposalsLoading ? '...' : pendingProposals?.length || 0}
          icon={Vote}
        />
        <StatCard
          label="Safe Threshold"
          value={safeInfo ? `${safeInfo.threshold}/${safeInfo.owners.length}` : '...'}
          icon={CheckCircle2}
        />
      </div>

      {/* Action needed */}
      {needsMyVote.length > 0 && (
        <div className="card p-6 border-warning/30">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-warning/10 rounded-lg">
              <AlertCircle className="w-6 h-6 text-warning" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-governance-100">
                Action Required
              </h2>
              <p className="text-governance-400 text-sm mt-1">
                You have {needsMyVote.length} proposal{needsMyVote.length > 1 ? 's' : ''} waiting for your vote
              </p>
              <Link
                to="/proposals"
                className="inline-flex items-center gap-2 text-warning hover:text-warning/80 text-sm font-medium mt-3"
              >
                View proposals <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Recent proposals */}
      <div className="card">
        <div className="p-6 border-b border-governance-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-governance-100">
              Recent Proposals
            </h2>
            <Link
              to="/proposals"
              className="text-sm text-accent hover:text-accent-light"
            >
              View all
            </Link>
          </div>
        </div>

        {proposalsLoading ? (
          <div className="p-8 text-center text-governance-400">Loading...</div>
        ) : pendingProposals && pendingProposals.length > 0 ? (
          <div className="divide-y divide-governance-800">
            {pendingProposals.slice(0, 5).map((proposal) => (
              <div key={proposal.id} className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="badge badge-warning">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </span>
                      <span className="text-xs text-governance-500">
                        <ProposalTypeLabel type={proposal.type} />
                      </span>
                    </div>
                    <h3 className="text-governance-100 font-medium mt-2">
                      {proposal.councilName || proposal.memberName || proposal.memberAddress?.slice(0, 10) + '...' || 'Proposal'}
                    </h3>
                    <p className="text-sm text-governance-400 mt-1">
                      Expires {formatDistanceToNow(new Date(proposal.expiresAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="w-48">
                    <VoteProgress
                      aye={proposal.votesAye}
                      nay={proposal.votesNay}
                      abstain={proposal.votesAbstain}
                      threshold={proposal.threshold}
                    />
                    {!proposal.myVote && (
                      <Link
                        to="/proposals"
                        className="btn-primary text-xs w-full mt-3"
                      >
                        Vote Now
                      </Link>
                    )}
                    {proposal.myVote && (
                      <p className="text-xs text-governance-500 text-center mt-3">
                        You voted: <span className="text-accent capitalize">{proposal.myVote}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-governance-400">
            <Vote className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No pending proposals</p>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/councils"
          className="card p-6 hover:border-accent/30 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-accent/10 rounded-lg">
              <Users className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-governance-100 group-hover:text-accent transition-colors">
                Manage Councils
              </h3>
              <p className="text-sm text-governance-400">
                Create, view, or delete councils
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-governance-500 group-hover:text-accent group-hover:translate-x-1 transition-all" />
          </div>
        </Link>

        <Link
          to="/proposals"
          className="card p-6 hover:border-accent/30 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-accent/10 rounded-lg">
              <Vote className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-governance-100 group-hover:text-accent transition-colors">
                Vote on Proposals
              </h3>
              <p className="text-sm text-governance-400">
                Review and cast your votes
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-governance-500 group-hover:text-accent group-hover:translate-x-1 transition-all" />
          </div>
        </Link>
      </div>
    </div>
  );
}
