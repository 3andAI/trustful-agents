import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Building2,
  Users,
  ExternalLink,
  Loader2,
  AlertCircle,
  Plus,
  Activity,
  Search,
  CheckCircle,
} from 'lucide-react';
import { getCouncils, getSafeInfo, proposeCreateCouncil, type Council } from '../lib/api';
import { useSafeTransaction } from '../hooks/useSafe';

// Vertical options
const VERTICALS = [
  { value: 'defi', label: 'DeFi' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'legal', label: 'Legal' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'general', label: 'General' },
];

export default function DashboardPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  const filteredCouncils = councils.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.vertical.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-governance-100">Dashboard</h1>
          <p className="text-governance-400 mt-1">
            Trustful Agents Governance Overview
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Council
        </button>
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
            <p className="text-xs text-governance-400 mt-1">
              Safe threshold: {safeInfo?.threshold ?? '-'} of {safeInfo?.owners?.length ?? '-'} owners
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
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

        <Link to="/pending" className="card p-6 hover:border-accent/50 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <Activity className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-governance-100">Pending Votes</h3>
              <p className="text-sm text-governance-400">
                Review and vote on pending proposals
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* Councils Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-governance-100">Councils</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-governance-500" />
            <input
              type="text"
              placeholder="Search councils..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-64"
            />
          </div>
        </div>

        {/* Loading State */}
        {councilsLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        )}

        {/* Empty State */}
        {!councilsLoading && councils.length === 0 && (
          <div className="card p-12 text-center">
            <Building2 className="w-16 h-16 text-governance-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-governance-200 mb-2">
              No councils found
            </h3>
            <p className="text-governance-400 mb-6">
              No councils have been created on-chain yet.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create First Council
            </button>
          </div>
        )}

        {/* Councils Grid */}
        {!councilsLoading && filteredCouncils.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCouncils.map((council) => (
              <CouncilCard key={council.councilId} council={council} />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateCouncilModal onClose={() => setShowCreateModal(false)} />
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

function CouncilCard({ council }: { council: Council }) {
  return (
    <Link to={`/councils/${council.councilId}`} className="card p-5 hover:border-accent/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-medium text-governance-100">{council.name}</h3>
            <span className="text-xs text-governance-400 capitalize">{council.vertical}</span>
          </div>
        </div>
        {council.active ? (
          <span className="badge-success">Active</span>
        ) : (
          <span className="badge-neutral">Closed</span>
        )}
      </div>

      {council.description && (
        <p className="text-sm text-governance-400 mb-4 line-clamp-2">
          {council.description}
        </p>
      )}

      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1 text-governance-400">
          <Users className="w-4 h-4" />
          <span>{council.memberCount} members</span>
        </div>
        <div className="flex items-center gap-1 text-governance-400">
          <Activity className="w-4 h-4" />
          <span>{council.quorumPercentage / 100}% quorum</span>
        </div>
      </div>
    </Link>
  );
}

type ModalStep = 'form' | 'signing' | 'success' | 'error';

function CreateCouncilModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<ModalStep>('form');
  const [safeTxHash, setSafeTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    vertical: 'general',
    quorumPercentage: 5000,
    claimDepositPercentage: 1000,
    votingPeriodDays: 7,
    evidencePeriodDays: 3,
  });

  const { proposeTransaction, getSafeUrl, isProposing } = useSafeTransaction();

  const getEncodedTx = useMutation({
    mutationFn: proposeCreateCouncil,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('signing');
    setErrorMessage(null);

    try {
      const txResponse = await getEncodedTx.mutateAsync(formData);
      
      const result = await proposeTransaction(
        {
          to: txResponse.transaction.to,
          data: txResponse.transaction.data,
          value: txResponse.transaction.value,
        },
        {
          actionType: 'create_council',
          title: `Create Council: ${formData.name}`,
          description: `Create a new ${formData.vertical} council with ${formData.quorumPercentage / 100}% quorum`,
          metadata: {
            councilName: formData.name,
            vertical: formData.vertical,
            quorumPercentage: formData.quorumPercentage,
            votingPeriodDays: formData.votingPeriodDays,
          },
        }
      );

      if (result.success && result.safeTxHash) {
        setSafeTxHash(result.safeTxHash);
        setStep('success');
      } else {
        setErrorMessage(result.error || 'Failed to propose transaction');
        setStep('error');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create transaction');
      setStep('error');
    }
  };

  const safeUrl = getSafeUrl();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        
        {step === 'form' && (
          <>
            <h2 className="text-xl font-bold text-governance-100 mb-4">Create Council</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-governance-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input w-full"
                  required
                  minLength={3}
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-governance-300 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input w-full"
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-governance-300 mb-1">Vertical *</label>
                <select
                  value={formData.vertical}
                  onChange={(e) => setFormData({ ...formData, vertical: e.target.value })}
                  className="input w-full"
                >
                  {VERTICALS.map((v) => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-governance-300 mb-1">Quorum %</label>
                  <input
                    type="number"
                    value={formData.quorumPercentage / 100}
                    onChange={(e) => setFormData({ ...formData, quorumPercentage: Number(e.target.value) * 100 })}
                    className="input w-full"
                    min={10}
                    max={100}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-governance-300 mb-1">Deposit %</label>
                  <input
                    type="number"
                    value={formData.claimDepositPercentage / 100}
                    onChange={(e) => setFormData({ ...formData, claimDepositPercentage: Number(e.target.value) * 100 })}
                    className="input w-full"
                    min={1}
                    max={50}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-governance-300 mb-1">Voting Period (days)</label>
                  <input
                    type="number"
                    value={formData.votingPeriodDays}
                    onChange={(e) => setFormData({ ...formData, votingPeriodDays: Number(e.target.value) })}
                    className="input w-full"
                    min={1}
                    max={30}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-governance-300 mb-1">Evidence Period (days)</label>
                  <input
                    type="number"
                    value={formData.evidencePeriodDays}
                    onChange={(e) => setFormData({ ...formData, evidencePeriodDays: Number(e.target.value) })}
                    className="input w-full"
                    min={1}
                    max={14}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Create & Sign</button>
              </div>
            </form>
          </>
        )}

        {step === 'signing' && (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 animate-spin text-accent mx-auto mb-4" />
            <h2 className="text-xl font-bold text-governance-100 mb-2">
              {isProposing ? 'Proposing Transaction...' : 'Preparing Transaction...'}
            </h2>
            <p className="text-governance-400">
              {isProposing ? 'Please sign the transaction in your wallet' : 'Encoding transaction data...'}
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-6">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h2 className="text-xl font-bold text-governance-100 mb-2">Transaction Proposed!</h2>
            <p className="text-governance-400 mb-6">
              Your transaction has been submitted to the Safe. Other signers can now approve it.
            </p>
            {safeTxHash && (
              <div className="mb-6 p-3 bg-governance-800 rounded-lg">
                <p className="text-xs text-governance-500 mb-1">Transaction Hash</p>
                <p className="text-sm font-mono text-governance-300 break-all">{safeTxHash}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1">Close</button>
              <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="btn-primary flex-1 flex items-center justify-center gap-2">
                View in Safe <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center py-6">
            <AlertCircle className="w-16 h-16 text-danger mx-auto mb-4" />
            <h2 className="text-xl font-bold text-governance-100 mb-2">Transaction Failed</h2>
            <p className="text-governance-400 mb-4">{errorMessage || 'An error occurred.'}</p>
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1">Close</button>
              <button onClick={() => setStep('form')} className="btn-primary flex-1">Try Again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
