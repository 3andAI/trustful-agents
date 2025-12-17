import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  X,
  Loader2,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { getCouncils, getProposals, createCouncilProposal, type Council } from '../lib/api';

// Vertical options
const VERTICALS = [
  'DeFi',
  'Gaming',
  'Social',
  'Infrastructure',
  'NFT',
  'DAO',
  'General',
  'Other',
];

function CreateCouncilModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [vertical, setVertical] = useState('');

  const mutation = useMutation({
    mutationFn: () => createCouncilProposal({ name, description, vertical }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['pendingProposals'] });
      onClose();
      setName('');
      setDescription('');
      setVertical('');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg card p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-governance-100">
            Propose New Council
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-governance-400 hover:text-governance-100 hover:bg-governance-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-governance-300 mb-2">
              Council Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., DeFi Protocol Council"
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-governance-300 mb-2">
              Vertical
            </label>
            <select
              value={vertical}
              onChange={(e) => setVertical(e.target.value)}
              className="input"
              required
            >
              <option value="">Select a vertical...</option>
              {VERTICALS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-governance-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose and scope of this council..."
              className="input min-h-[120px] resize-none"
              required
            />
          </div>

          {mutation.error && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-danger" />
              <p className="text-sm text-danger">
                {mutation.error instanceof Error ? mutation.error.message : 'Failed to create proposal'}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-governance-800">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={mutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center gap-2"
              disabled={mutation.isPending || !name || !description || !vertical}
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Propose Council
            </button>
          </div>
        </form>

        <p className="text-xs text-governance-500 mt-4">
          This will create a proposal that requires approval from the governance multisig.
          The voting period is 7 days.
        </p>
      </div>
    </div>
  );
}

function CouncilCard({ council }: { council: Council }) {
  return (
    <Link
      to={`/councils/${council.councilId}`}
      className="card p-6 hover:border-accent/30 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-governance-800/50 rounded-lg">
            <Building2 className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-governance-100 group-hover:text-accent transition-colors">
              {council.name}
            </h3>
            <span className="text-xs text-governance-500">{council.vertical}</span>
          </div>
        </div>
        {council.active ? (
          <span className="badge badge-success">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Active
          </span>
        ) : (
          <span className="badge badge-neutral">
            <XCircle className="w-3 h-3 mr-1" />
            Closed
          </span>
        )}
      </div>

      <p className="text-sm text-governance-400 mt-4 line-clamp-2">
        {council.description}
      </p>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-governance-800">
        <div className="flex items-center gap-4 text-sm text-governance-400">
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {council.memberCount} members
          </span>
          <span>{council.quorumPercentage}% quorum</span>
        </div>
        <ArrowRight className="w-4 h-4 text-governance-500 group-hover:text-accent group-hover:translate-x-1 transition-all" />
      </div>
    </Link>
  );
}

function PendingCouncilCard({ proposal }: { proposal: { id: string; councilName: string | null; councilVertical: string | null; votesAye: number; threshold: number; expiresAt: string } }) {
  return (
    <Link
      to="/proposals"
      className="card p-6 border-warning/30 hover:border-warning/50 transition-all duration-200"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-warning/10 rounded-lg">
            <Clock className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h3 className="font-semibold text-governance-100">
              {proposal.councilName || 'New Council'}
            </h3>
            <span className="text-xs text-governance-500">
              {proposal.councilVertical || 'Pending'}
            </span>
          </div>
        </div>
        <span className="badge badge-warning">
          <Clock className="w-3 h-3 mr-1" />
          Vote Required
        </span>
      </div>

      <div className="mt-4 pt-4 border-t border-governance-800">
        <div className="flex items-center justify-between text-sm">
          <span className="text-governance-400">
            {proposal.votesAye} / {proposal.threshold} votes
          </span>
          <span className="text-accent">Cast your vote →</span>
        </div>
      </div>
    </Link>
  );
}

export default function CouncilsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: councils, isLoading: councilsLoading } = useQuery({
    queryKey: ['councils'],
    queryFn: getCouncils,
  });

  const { data: pendingProposals } = useQuery({
    queryKey: ['proposals', 'pending', 'create_council'],
    queryFn: () => getProposals({ status: 'pending', type: 'create_council' }),
  });

  const filteredCouncils = councils?.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.vertical.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const activeCouncils = filteredCouncils.filter((c) => c.active);
  const closedCouncils = filteredCouncils.filter((c) => !c.active);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-governance-100">Councils</h1>
          <p className="text-governance-400 mt-1">
            Manage arbitration councils for agent disputes
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Council
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-governance-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search councils..."
          className="input pl-12"
        />
      </div>

      {/* Pending councils */}
      {pendingProposals && pendingProposals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-governance-100 flex items-center gap-2">
            <Clock className="w-5 h-5 text-warning" />
            Pending Approval ({pendingProposals.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pendingProposals.map((proposal) => (
              <PendingCouncilCard key={proposal.id} proposal={proposal} />
            ))}
          </div>
        </div>
      )}

      {/* Active councils */}
      {councilsLoading ? (
        <div className="text-center py-12 text-governance-400">
          <Loader2 className="w-8 h-8 mx-auto animate-spin mb-2" />
          Loading councils...
        </div>
      ) : activeCouncils.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-governance-100">
            Active Councils ({activeCouncils.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeCouncils.map((council) => (
              <CouncilCard key={council.councilId} council={council} />
            ))}
          </div>
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Building2 className="w-12 h-12 mx-auto text-governance-600 mb-4" />
          <h3 className="text-lg font-medium text-governance-300">No councils yet</h3>
          <p className="text-governance-500 mt-1">
            Create the first council to get started
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn-primary mt-4"
          >
            Create Council
          </button>
        </div>
      )}

      {/* Closed councils */}
      {closedCouncils.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-governance-300">
            Closed Councils ({closedCouncils.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 opacity-60">
            {closedCouncils.map((council) => (
              <CouncilCard key={council.councilId} council={council} />
            ))}
          </div>
        </div>
      )}

      {/* Create modal */}
      <CreateCouncilModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
