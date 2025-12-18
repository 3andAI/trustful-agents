import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Building2,
  Users,
  ExternalLink,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { getCouncils, getSafeInfo } from '../lib/api';

export default function DashboardPage() {
  const { data: councilsData, isLoading: councilsLoading } = useQuery({
    queryKey: ['councils'],
    queryFn: getCouncils,
  });

  const { data: safeInfo, isLoading: safeLoading } = useQuery({
    queryKey: ['safeInfo'],
    queryFn: getSafeInfo,
  });

  const councils = councilsData?.councils ?? [];
  const activeCouncils = councils.filter((c) => c.active);
  const totalMembers = councils.reduce((sum, c) => sum + c.memberCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-governance-100">Dashboard</h1>
        <p className="text-governance-400 mt-1">
          Trustful Agents Governance Overview
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Councils"
          value={activeCouncils.length}
          icon={Building2}
          loading={councilsLoading}
        />
        <StatCard
          title="Total Members"
          value={totalMembers}
          icon={Users}
          loading={councilsLoading}
        />
        <StatCard
          title="Safe Threshold"
          value={safeInfo ? `${safeInfo.threshold}/${safeInfo.owners.length}` : '-'}
          icon={Users}
          loading={safeLoading}
        />
        <StatCard
          title="Total Councils"
          value={councils.length}
          icon={Building2}
          loading={councilsLoading}
        />
      </div>

      {/* Info Banner */}
      <div className="card p-4 bg-accent/5 border-accent/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-accent mt-0.5" />
          <div>
            <p className="text-sm text-governance-200">
              All governance actions require Safe multisig approval. Council data is read directly from the blockchain.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link to="/councils" className="card p-6 hover:border-accent/50 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-governance-100">Manage Councils</h3>
              <p className="text-sm text-governance-400">
                View, create, and manage validation councils
              </p>
            </div>
          </div>
        </Link>

        <a
          href={safeInfo ? `https://app.safe.global/home?safe=basesep:${safeInfo.address}` : '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="card p-6 hover:border-accent/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <ExternalLink className="w-6 h-6 text-indigo-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-governance-100">Open Safe</h3>
              <p className="text-sm text-governance-400">
                View pending transactions and sign proposals
              </p>
            </div>
          </div>
        </a>
      </div>

      {/* Recent Councils */}
      {!councilsLoading && councils.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-governance-100">Recent Councils</h2>
            <Link to="/councils" className="text-sm text-accent hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {councils.slice(0, 5).map((council) => (
              <Link
                key={council.councilId}
                to={`/councils/${council.councilId}`}
                className="flex items-center justify-between p-3 bg-governance-800/50 rounded-lg hover:bg-governance-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-governance-100">{council.name}</p>
                    <p className="text-xs text-governance-400 capitalize">{council.vertical}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-governance-400">
                    {council.memberCount} members
                  </span>
                  {council.active ? (
                    <span className="badge-success">Active</span>
                  ) : (
                    <span className="badge-neutral">Closed</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-accent" />
        </div>
        <div>
          <p className="text-sm text-governance-400">{title}</p>
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-governance-400 mt-1" />
          ) : (
            <p className="text-2xl font-bold text-governance-100">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
}
