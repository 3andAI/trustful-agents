import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Building2,
  Plus,
  Users,
  Activity,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Search,
} from 'lucide-react';
import { getCouncils, proposeCreateCouncil, getSafeInfo, type Council, type ProposeResponse } from '../lib/api';

// Vertical options
const VERTICALS = [
  { value: 'defi', label: 'DeFi' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'legal', label: 'Legal' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'general', label: 'General' },
];

export default function CouncilsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [txResult, setTxResult] = useState<ProposeResponse | null>(null);

  const { data: councilsData, isLoading, error } = useQuery({
    queryKey: ['councils'],
    queryFn: getCouncils,
  });

  const { data: safeInfo } = useQuery({
    queryKey: ['safeInfo'],
    queryFn: getSafeInfo,
  });

  const councils = councilsData?.councils ?? [];
  
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
          <h1 className="text-2xl font-bold text-governance-100">Councils</h1>
          <p className="text-governance-400 mt-1">
            Manage validation councils on-chain
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-governance-500" />
        <input
          type="text"
          placeholder="Search councils..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input pl-10 w-full max-w-md"
        />
      </div>

      {/* Info Banner */}
      <div className="card p-4 bg-accent/5 border-accent/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-accent mt-0.5" />
          <div>
            <p className="text-sm text-governance-200">
              Councils are stored on-chain. Creating, closing, or modifying councils requires a Safe multisig transaction.
            </p>
            <p className="text-xs text-governance-400 mt-1">
              Safe threshold: {safeInfo?.threshold ?? '-'} of {safeInfo?.owners?.length ?? '-'} owners
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
          <p className="text-governance-300">Failed to load councils</p>
          <p className="text-sm text-governance-500 mt-1">{(error as Error).message}</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && councils.length === 0 && (
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
      {!isLoading && filteredCouncils.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCouncils.map((council) => (
            <CouncilCard key={council.councilId} council={council} />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateCouncilModal
          onClose={() => {
            setShowCreateModal(false);
            setTxResult(null);
          }}
          onSuccess={(result) => {
            setTxResult(result);
          }}
          txResult={txResult}
        />
      )}

      {/* Transaction Result Modal */}
      {txResult && !showCreateModal && (
        <TransactionResultModal
          result={txResult}
          onClose={() => setTxResult(null)}
        />
      )}
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

function CreateCouncilModal({
  onClose,
  onSuccess,
  txResult,
}: {
  onClose: () => void;
  onSuccess: (result: ProposeResponse) => void;
  txResult: ProposeResponse | null;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    vertical: 'general',
    quorumPercentage: 5000,
    claimDepositPercentage: 1000,
    votingPeriodDays: 7,
    evidencePeriodDays: 3,
  });
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: proposeCreateCouncil,
    onSuccess: (data) => {
      onSuccess(data);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {!txResult ? (
          <>
            <h2 className="text-xl font-bold text-governance-100 mb-4">
              Create Council
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-governance-300 mb-1">
                  Name *
                </label>
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
                <label className="block text-sm font-medium text-governance-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input w-full"
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-governance-300 mb-1">
                  Vertical *
                </label>
                <select
                  value={formData.vertical}
                  onChange={(e) => setFormData({ ...formData, vertical: e.target.value })}
                  className="input w-full"
                >
                  {VERTICALS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-governance-300 mb-1">
                    Quorum %
                  </label>
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
                  <label className="block text-sm font-medium text-governance-300 mb-1">
                    Deposit %
                  </label>
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
                  <label className="block text-sm font-medium text-governance-300 mb-1">
                    Voting Period (days)
                  </label>
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
                  <label className="block text-sm font-medium text-governance-300 mb-1">
                    Evidence Period (days)
                  </label>
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

              {mutation.error && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-sm text-danger">
                  {(mutation.error as Error).message}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Generate Transaction
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-governance-100 mb-4">
              Transaction Ready
            </h2>
            <div className="space-y-4">
              <p className="text-sm text-governance-300">
                Copy the transaction data below and create a new transaction in Safe.
              </p>

              <div>
                <label className="block text-sm font-medium text-governance-400 mb-1">To</label>
                <div className="font-mono text-sm bg-governance-800 p-2 rounded break-all text-governance-200">
                  {txResult.transaction.to}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-governance-400 mb-1">Data</label>
                <div className="relative">
                  <div className="font-mono text-xs bg-governance-800 p-2 rounded break-all text-governance-200 max-h-32 overflow-y-auto">
                    {txResult.transaction.data}
                  </div>
                  <button
                    onClick={() => copyToClipboard(txResult.transaction.data)}
                    className="absolute top-2 right-2 p-1 hover:bg-governance-700 rounded"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4 text-governance-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-governance-400 mb-1">Value</label>
                <div className="font-mono text-sm bg-governance-800 p-2 rounded text-governance-200">
                  {txResult.transaction.value} ETH
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="btn-secondary flex-1">
                  Close
                </button>
                <a
                  href={txResult.safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  Open Safe
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TransactionResultModal({
  result,
  onClose,
}: {
  result: ProposeResponse;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="card p-6 w-full max-w-lg">
        <h2 className="text-xl font-bold text-governance-100 mb-4">
          Transaction Ready
        </h2>
        <div className="space-y-4">
          <p className="text-sm text-governance-300">{result.message}</p>

          <div>
            <label className="block text-sm font-medium text-governance-400 mb-1">To</label>
            <div className="font-mono text-sm bg-governance-800 p-2 rounded break-all text-governance-200">
              {result.transaction.to}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-governance-400 mb-1">Data</label>
            <div className="relative">
              <div className="font-mono text-xs bg-governance-800 p-2 rounded break-all text-governance-200 max-h-32 overflow-y-auto">
                {result.transaction.data}
              </div>
              <button
                onClick={() => copyToClipboard(result.transaction.data)}
                className="absolute top-2 right-2 p-1 hover:bg-governance-700 rounded"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4 text-governance-400" />
                )}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">
              Close
            </button>
            <a
              href={result.safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              Open Safe
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
