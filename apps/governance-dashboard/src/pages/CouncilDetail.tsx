import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Users,
  Plus,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle2,
  UserPlus,
  UserMinus,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  getCouncil,
  getCouncilMembers,
  getProposals,
  addMemberProposal,
  removeMemberProposal,
  deleteCouncilProposal,
  type CouncilMember,
} from '../lib/api';

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function AddMemberModal({
  isOpen,
  onClose,
  councilId,
}: {
  isOpen: boolean;
  onClose: () => void;
  councilId: string;
}) {
  const queryClient = useQueryClient();
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      addMemberProposal({
        councilId,
        address,
        name: name || undefined,
        description: description || undefined,
        email: email || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['pendingProposals'] });
      onClose();
      setAddress('');
      setName('');
      setDescription('');
      setEmail('');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg card p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-governance-100">
            Propose New Member
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
              Wallet Address *
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x..."
              className="input font-mono"
              pattern="^0x[a-fA-F0-9]{40}$"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-governance-300 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-governance-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the member's expertise..."
              className="input min-h-[80px] resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-governance-300 mb-2">
              Email (for notifications)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@example.com"
              className="input"
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
              disabled={mutation.isPending || !address}
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Propose Member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RemoveMemberModal({
  isOpen,
  onClose,
  councilId,
  member,
}: {
  isOpen: boolean;
  onClose: () => void;
  councilId: string;
  member: CouncilMember | null;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => removeMemberProposal({ councilId, address: member!.address }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['pendingProposals'] });
      onClose();
    },
  });

  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md card p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-governance-100">
            Propose Member Removal
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-governance-400 hover:text-governance-100 hover:bg-governance-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg mb-6">
          <p className="text-sm text-governance-200">
            You are about to propose removing:
          </p>
          <p className="text-lg font-semibold text-governance-100 mt-2">
            {member.name || shortenAddress(member.address)}
          </p>
          <p className="text-xs text-governance-400 font-mono mt-1">
            {member.address}
          </p>
        </div>

        {mutation.error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-danger" />
            <p className="text-sm text-danger">
              {mutation.error instanceof Error ? mutation.error.message : 'Failed to create proposal'}
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={mutation.isPending}
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            className="btn-danger flex items-center gap-2"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserMinus className="w-4 h-4" />
            )}
            Propose Removal
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteCouncilModal({
  isOpen,
  onClose,
  councilId,
  councilName,
}: {
  isOpen: boolean;
  onClose: () => void;
  councilId: string;
  councilName: string;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: () => deleteCouncilProposal(councilId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['pendingProposals'] });
      onClose();
      navigate('/proposals');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md card p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-governance-100">
            Propose Council Deletion
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-governance-400 hover:text-governance-100 hover:bg-governance-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg mb-6">
          <p className="text-sm text-governance-200">
            You are about to propose deleting:
          </p>
          <p className="text-lg font-semibold text-governance-100 mt-2">
            {councilName}
          </p>
          <p className="text-xs text-governance-400 mt-2">
            This action cannot be undone. All members will be expelled.
          </p>
        </div>

        {mutation.error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-danger" />
            <p className="text-sm text-danger">
              {mutation.error instanceof Error ? mutation.error.message : 'Failed to create proposal'}
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={mutation.isPending}
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            className="btn-danger flex items-center gap-2"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Propose Deletion
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberCard({
  member,
  onRemove,
}: {
  member: CouncilMember;
  onRemove: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(member.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-governance-600 to-governance-700 flex items-center justify-center text-sm font-mono">
        {member.address.slice(2, 4)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-governance-100 truncate">
            {member.name || 'Unknown'}
          </h4>
          {member.active && (
            <span className="badge badge-success text-xs">Active</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs font-mono text-governance-400">
            {shortenAddress(member.address)}
          </span>
          <button
            onClick={copyAddress}
            className="p-1 text-governance-500 hover:text-governance-300"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
          <a
            href={`https://sepolia.basescan.org/address/${member.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-governance-500 hover:text-governance-300"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        {member.description && (
          <p className="text-xs text-governance-500 mt-1 line-clamp-1">
            {member.description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-governance-500">
          {member.claimsVoted} votes
        </span>
        <button
          onClick={onRemove}
          className="p-2 text-governance-400 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
          title="Remove member"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function CouncilDetailPage() {
  const { councilId } = useParams<{ councilId: string }>();
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<CouncilMember | null>(null);

  const { data: council, isLoading: councilLoading } = useQuery({
    queryKey: ['council', councilId],
    queryFn: () => getCouncil(councilId!),
    enabled: !!councilId,
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['councilMembers', councilId],
    queryFn: () => getCouncilMembers(councilId!),
    enabled: !!councilId,
  });

  const { data: pendingProposals } = useQuery({
    queryKey: ['proposals', 'pending', councilId],
    queryFn: () => getProposals({ status: 'pending', councilId }),
    enabled: !!councilId,
  });

  const pendingMembers = pendingProposals?.filter((p) => p.type === 'add_member') || [];
  const pendingRemovals = pendingProposals?.filter((p) => p.type === 'remove_member') || [];

  if (councilLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-governance-400" />
      </div>
    );
  }

  if (!council) {
    return (
      <div className="text-center py-12">
        <p className="text-governance-400">Council not found</p>
        <Link to="/councils" className="btn-secondary mt-4">
          Back to Councils
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to="/councils"
            className="inline-flex items-center gap-2 text-governance-400 hover:text-governance-100 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Councils
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-governance-100">
              {council.name}
            </h1>
            {council.active ? (
              <span className="badge badge-success">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Active
              </span>
            ) : (
              <span className="badge badge-neutral">Closed</span>
            )}
          </div>
          <p className="text-governance-400 mt-2">{council.description}</p>
        </div>
        {council.active && (
          <button
            onClick={() => setIsDeleteOpen(true)}
            className="btn-ghost text-danger hover:bg-danger/10"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Council
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-governance-400">Vertical</p>
          <p className="text-lg font-semibold text-governance-100 mt-1">
            {council.vertical}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-governance-400">Members</p>
          <p className="text-lg font-semibold text-governance-100 mt-1">
            {council.memberCount}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-governance-400">Quorum</p>
          <p className="text-lg font-semibold text-governance-100 mt-1">
            {council.quorumPercentage}%
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-governance-400">Created</p>
          <p className="text-lg font-semibold text-governance-100 mt-1">
            {format(new Date(council.createdAt * 1000), 'MMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Pending member proposals */}
      {(pendingMembers.length > 0 || pendingRemovals.length > 0) && (
        <div className="card">
          <div className="p-4 border-b border-governance-800">
            <h2 className="text-lg font-semibold text-governance-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-warning" />
              Pending Member Changes
            </h2>
          </div>
          <div className="divide-y divide-governance-800">
            {pendingMembers.map((p) => (
              <div key={p.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserPlus className="w-5 h-5 text-accent" />
                  <div>
                    <p className="text-governance-100">
                      {p.memberName || shortenAddress(p.memberAddress || '')}
                    </p>
                    <p className="text-xs text-governance-500">
                      Proposed {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <Link to="/proposals" className="badge badge-warning">
                  Vote Required
                </Link>
              </div>
            ))}
            {pendingRemovals.map((p) => (
              <div key={p.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserMinus className="w-5 h-5 text-danger" />
                  <div>
                    <p className="text-governance-100">
                      Removing {shortenAddress(p.memberAddress || '')}
                    </p>
                    <p className="text-xs text-governance-500">
                      Proposed {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <Link to="/proposals" className="badge badge-warning">
                  Vote Required
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members list */}
      <div className="card">
        <div className="p-4 border-b border-governance-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-governance-100 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Council Members ({members?.length || 0})
          </h2>
          {council.active && (
            <button
              onClick={() => setIsAddMemberOpen(true)}
              className="btn-primary text-sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Member
            </button>
          )}
        </div>

        {membersLoading ? (
          <div className="p-8 text-center text-governance-400">
            <Loader2 className="w-6 h-6 mx-auto animate-spin" />
          </div>
        ) : members && members.length > 0 ? (
          <div className="p-4 space-y-3">
            {members.map((member) => (
              <MemberCard
                key={member.address}
                member={member}
                onRemove={() => setMemberToRemove(member)}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-governance-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No members yet</p>
            {council.active && (
              <button
                onClick={() => setIsAddMemberOpen(true)}
                className="btn-primary mt-4"
              >
                Add First Member
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <AddMemberModal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        councilId={councilId!}
      />

      <RemoveMemberModal
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        councilId={councilId!}
        member={memberToRemove}
      />

      <DeleteCouncilModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        councilId={councilId!}
        councilName={council.name}
      />
    </div>
  );
}
