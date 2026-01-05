import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  Users,
  Plus,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  User,
  CheckCircle,
} from 'lucide-react';
import {
  getCouncil,
  getCouncilMembers,
  canCloseCouncil,
  proposeCloseCouncil,
  proposeAddMember,
  proposeRemoveMember,
  type CouncilMember,
} from '../lib/api';
import { useSafeTransaction } from '../hooks/useSafe';

type ModalStep = 'form' | 'signing' | 'success' | 'error';

export default function CouncilDetailPage() {
  const { councilId } = useParams<{ councilId: string }>();
  const navigate = useNavigate();
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<CouncilMember | null>(null);

  const { data: council, isLoading: councilLoading, error: councilError } = useQuery({
    queryKey: ['council', councilId],
    queryFn: () => getCouncil(councilId!),
    enabled: !!councilId,
  });

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['councilMembers', councilId],
    queryFn: () => getCouncilMembers(councilId!),
    enabled: !!councilId,
  });

  const { data: closeCheck } = useQuery({
    queryKey: ['canCloseCouncil', councilId],
    queryFn: () => canCloseCouncil(councilId!),
    enabled: !!councilId && !!council?.active,
  });

  const members = membersData?.members ?? [];

  if (councilLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (councilError || !council) {
    return (
      <div className="card p-6 text-center">
        <AlertCircle className="w-12 h-12 text-danger mx-auto mb-3" />
        <p className="text-governance-300">Council not found</p>
        <button onClick={() => navigate('/councils')} className="btn-secondary mt-4">
          Back to Councils
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/councils')}
          className="p-2 hover:bg-governance-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-governance-400" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-governance-100">{council.name}</h1>
            {council.active ? (
              <span className="badge-success">Active</span>
            ) : (
              <span className="badge-neutral">Closed</span>
            )}
          </div>
          <p className="text-governance-400 capitalize">{council.vertical}</p>
        </div>
        {council.active && (
          <button
            onClick={() => setShowDeleteModal(true)}
            className="btn-danger flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Close Council
          </button>
        )}
      </div>

      {/* Council Info */}
      <div className="card p-6">
        <h2 className="text-lg font-medium text-governance-100 mb-4">Council Details</h2>
        
        {council.description && (
          <p className="text-governance-300 mb-4">{council.description}</p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-governance-500">Members</p>
            <p className="text-xl font-bold text-governance-100">{council.memberCount}</p>
          </div>
          <div>
            <p className="text-sm text-governance-500">Quorum</p>
            <p className="text-xl font-bold text-governance-100">{council.quorumPercentage / 100}%</p>
          </div>
          <div>
            <p className="text-sm text-governance-500">Voting Period</p>
            <p className="text-xl font-bold text-governance-100">{council.votingPeriod / 86400} days</p>
          </div>
          <div>
            <p className="text-sm text-governance-500">Evidence Period</p>
            <p className="text-xl font-bold text-governance-100">{council.evidencePeriod / 86400} days</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-governance-700">
          <p className="text-xs text-governance-500">Council ID</p>
          <p className="font-mono text-sm text-governance-300 break-all">{council.councilId}</p>
        </div>
      </div>

      {/* Members */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-governance-100">Members</h2>
          {council.active && (
            <button
              onClick={() => setShowAddMemberModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Member
            </button>
          )}
        </div>

        {membersLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-governance-600 mx-auto mb-3" />
            <p className="text-governance-400">No members yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <MemberCard
                key={member.address}
                member={member}
                councilActive={council.active}
                onRemove={() => setMemberToRemove(member)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddMemberModal && (
        <AddMemberModal
          councilId={councilId!}
          councilName={council.name}
          onClose={() => setShowAddMemberModal(false)}
        />
      )}

      {showDeleteModal && (
        <DeleteCouncilModal
          councilId={councilId!}
          councilName={council.name}
          canClose={closeCheck?.canClose ?? false}
          closeReason={closeCheck?.reason ?? ''}
          onClose={() => setShowDeleteModal(false)}
        />
      )}

      {memberToRemove && (
        <RemoveMemberModal
          councilId={councilId!}
          councilName={council.name}
          member={memberToRemove}
          onClose={() => setMemberToRemove(null)}
        />
      )}
    </div>
  );
}

function MemberCard({
  member,
  councilActive,
  onRemove,
}: {
  member: CouncilMember;
  councilActive: boolean;
  onRemove: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    await navigator.clipboard.writeText(member.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between p-4 bg-governance-800/50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
          <User className="w-5 h-5 text-accent" />
        </div>
        <div>
          <p className="font-medium text-governance-100">
            {member.name || member.address.slice(0, 8) + '...' + member.address.slice(-6)}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-governance-400 font-mono">
              {member.address.slice(0, 10)}...{member.address.slice(-8)}
            </p>
            <button onClick={copyAddress} className="p-1 hover:bg-governance-700 rounded">
              {copied ? (
                <Check className="w-3 h-3 text-success" />
              ) : (
                <Copy className="w-3 h-3 text-governance-500" />
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm text-governance-300">{member.claimsVoted} claims voted</p>
          {member.joinedAt && (
            <p className="text-xs text-governance-500">
              Joined {new Date(member.joinedAt).toLocaleDateString()}
            </p>
          )}
        </div>
        {councilActive && (
          <button
            onClick={onRemove}
            className="p-2 hover:bg-danger/10 rounded-lg text-danger transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function AddMemberModal({
  councilId,
  councilName,
  onClose,
}: {
  councilId: string;
  councilName: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<ModalStep>('form');
  const [_safeTxHash, setSafeTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    memberAddress: '',
    name: '',
    email: '',
    description: '',
  });

  const { proposeTransaction, getSafeUrl, isProposing } = useSafeTransaction();

  const getEncodedTx = useMutation({
    mutationFn: () => proposeAddMember(councilId, formData),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('signing');
    setErrorMessage(null);

    try {
      const txResponse = await getEncodedTx.mutateAsync();
      
      const result = await proposeTransaction(
        {
          to: txResponse.transaction.to,
          data: txResponse.transaction.data,
          value: txResponse.transaction.value,
        },
        {
          actionType: 'add_member',
          title: `Add Member to ${councilName}`,
          description: formData.name 
            ? `Add ${formData.name} (${formData.memberAddress.slice(0, 8)}...) to the council`
            : `Add ${formData.memberAddress.slice(0, 8)}...${formData.memberAddress.slice(-6)} to the council`,
          metadata: {
            councilId,
            councilName,
            memberAddress: formData.memberAddress,
            memberName: formData.name || null,
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
      <div className="card p-6 w-full max-w-md">
        
        {step === 'form' && (
          <>
            <h2 className="text-xl font-bold text-governance-100 mb-4">Add Member</h2>
            <p className="text-sm text-governance-400 mb-4">Add a member to {councilName}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-governance-300 mb-1">
                  Address *
                </label>
                <input
                  type="text"
                  value={formData.memberAddress}
                  onChange={(e) => setFormData({ ...formData, memberAddress: e.target.value })}
                  className="input w-full font-mono"
                  placeholder="0x..."
                  pattern="^0x[a-fA-F0-9]{40}$"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-governance-300 mb-1">
                  Name (optional)
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-governance-300 mb-1">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input w-full"
                />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Add & Sign
                </button>
              </div>
            </form>
          </>
        )}

        {step === 'signing' && (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 animate-spin text-accent mx-auto mb-4" />
            <h2 className="text-xl font-bold text-governance-100 mb-2">
              {isProposing ? 'Proposing Transaction...' : 'Preparing...'}
            </h2>
            <p className="text-governance-400">
              {isProposing ? 'Please sign in your wallet' : 'Encoding transaction...'}
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-6">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h2 className="text-xl font-bold text-governance-100 mb-2">Transaction Proposed!</h2>
            <p className="text-governance-400 mb-6">
              Other signers can now approve it in Safe.
            </p>
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
            <h2 className="text-xl font-bold text-governance-100 mb-2">Failed</h2>
            <p className="text-governance-400 mb-4">{errorMessage}</p>
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

function RemoveMemberModal({
  councilId,
  councilName,
  member,
  onClose,
}: {
  councilId: string;
  councilName: string;
  member: CouncilMember;
  onClose: () => void;
}) {
  const [step, setStep] = useState<ModalStep>('form');
  const [_safeTxHash, setSafeTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { proposeTransaction, getSafeUrl, isProposing } = useSafeTransaction();

  const getEncodedTx = useMutation({
    mutationFn: () => proposeRemoveMember(councilId, member.address),
  });

  const handleSubmit = async () => {
    setStep('signing');
    setErrorMessage(null);

    try {
      const txResponse = await getEncodedTx.mutateAsync();
      
      const result = await proposeTransaction(
        {
          to: txResponse.transaction.to,
          data: txResponse.transaction.data,
          value: txResponse.transaction.value,
        },
        {
          actionType: 'remove_member',
          title: `Remove Member from ${councilName}`,
          description: member.name 
            ? `Remove ${member.name} (${member.address.slice(0, 8)}...) from the council`
            : `Remove ${member.address.slice(0, 8)}...${member.address.slice(-6)} from the council`,
          metadata: {
            councilId,
            councilName,
            memberAddress: member.address,
            memberName: member.name || null,
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
      <div className="card p-6 w-full max-w-md">
        
        {step === 'form' && (
          <>
            <h2 className="text-xl font-bold text-governance-100 mb-4">Remove Member</h2>
            <p className="text-governance-300 mb-4">
              Remove <strong>{member.name || member.address}</strong> from {councilName}?
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSubmit} className="btn-danger flex-1">Remove & Sign</button>
            </div>
          </>
        )}

        {step === 'signing' && (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 animate-spin text-accent mx-auto mb-4" />
            <h2 className="text-xl font-bold text-governance-100 mb-2">
              {isProposing ? 'Proposing...' : 'Preparing...'}
            </h2>
            <p className="text-governance-400">
              {isProposing ? 'Please sign in your wallet' : 'Encoding transaction...'}
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-6">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h2 className="text-xl font-bold text-governance-100 mb-2">Transaction Proposed!</h2>
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
            <h2 className="text-xl font-bold text-governance-100 mb-2">Failed</h2>
            <p className="text-governance-400 mb-4">{errorMessage}</p>
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

function DeleteCouncilModal({
  councilId,
  councilName,
  canClose,
  closeReason,
  onClose,
}: {
  councilId: string;
  councilName: string;
  canClose: boolean;
  closeReason: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<ModalStep>('form');
  const [_safeTxHash, setSafeTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { proposeTransaction, getSafeUrl, isProposing } = useSafeTransaction();

  const getEncodedTx = useMutation({
    mutationFn: () => proposeCloseCouncil(councilId),
  });

  const handleSubmit = async () => {
    setStep('signing');
    setErrorMessage(null);

    try {
      const txResponse = await getEncodedTx.mutateAsync();
      
      const result = await proposeTransaction(
        {
          to: txResponse.transaction.to,
          data: txResponse.transaction.data,
          value: txResponse.transaction.value,
        },
        {
          actionType: 'close_council',
          title: `Close Council: ${councilName}`,
          description: `Permanently close the ${councilName} council`,
          metadata: {
            councilId,
            councilName,
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
      <div className="card p-6 w-full max-w-md">
        
        {step === 'form' && (
          <>
            <h2 className="text-xl font-bold text-governance-100 mb-4">Close Council</h2>
            
            {!canClose ? (
              <>
                <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg mb-4">
                  <p className="text-warning text-sm">{closeReason || 'Council cannot be closed.'}</p>
                </div>
                <button onClick={onClose} className="btn-secondary w-full">Close</button>
              </>
            ) : (
              <>
                <p className="text-governance-300 mb-4">
                  Permanently close <strong>{councilName}</strong>? This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={handleSubmit} className="btn-danger flex-1">Close & Sign</button>
                </div>
              </>
            )}
          </>
        )}

        {step === 'signing' && (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 animate-spin text-accent mx-auto mb-4" />
            <h2 className="text-xl font-bold text-governance-100 mb-2">
              {isProposing ? 'Proposing...' : 'Preparing...'}
            </h2>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-6">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h2 className="text-xl font-bold text-governance-100 mb-2">Transaction Proposed!</h2>
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
            <h2 className="text-xl font-bold text-governance-100 mb-2">Failed</h2>
            <p className="text-governance-400 mb-4">{errorMessage}</p>
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
