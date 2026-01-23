import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Bot,
  FileText,
  ExternalLink,
  CheckCircle,
  XCircle,
  MinusCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { 
  useClaim, 
  useClaimVotes, 
  useMyVote, 
  useVote, 
  useFinalizeClaim,
  useTransactionStatus,
} from '../hooks/useClaims';
import { formatUSDC, getTimeRemaining, formatAddress, getStatusBadge } from '../lib/api';
import ClaimConversation from '../components/ClaimConversation';

const API_BASE = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_URL || 'https://api.trustful-agents.ai');

// Vote enum values
const VOTE = {
  NONE: 0,
  APPROVE: 1,
  REJECT: 2,
  ABSTAIN: 3,
};

export default function ClaimDetailPage() {
  const { claimId } = useParams<{ claimId: string }>();
  const navigate = useNavigate();
  const { address } = useWallet();

  const { data: claim, isLoading, error, refetch } = useClaim(claimId);
  const { data: votesData, refetch: refetchVotes } = useClaimVotes(claimId);
  const { data: myVoteData, refetch: refetchMyVote } = useMyVote(claimId, address);

  const votes = votesData?.votes ?? [];
  const myVote = myVoteData?.vote;
  const hasVoted = myVoteData?.hasVoted ?? false;

  // Voting state
  const [selectedVote, setSelectedVote] = useState<number | null>(null);
  const [reasoning, setReasoning] = useState('');
  const [showVoteForm, setShowVoteForm] = useState(false);

  // Transaction state
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const voteMutation = useVote();
  const finalizeMutation = useFinalizeClaim();
  const { isLoading: txPending, isSuccess: txSuccess } = useTransactionStatus(txHash);

  // Copy state
  const [copied, setCopied] = useState<string | null>(null);

  // Claim description state (from API metadata)
  const [claimDescription, setClaimDescription] = useState<string | null>(null);

  // Fetch claim metadata (description)
  useEffect(() => {
    if (claimId) {
      fetch(`${API_BASE}/claims/${claimId}/metadata`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.description) {
            setClaimDescription(data.description);
          }
        })
        .catch(err => console.error('Failed to fetch claim metadata:', err));
    }
  }, [claimId]);

  // Initialize vote form with existing vote
  useEffect(() => {
    if (myVote && !showVoteForm) {
      setSelectedVote(myVote.voteCode);
      setReasoning(myVote.reasoning);
    }
  }, [myVote, showVoteForm]);

  // Refetch after successful transaction
  useEffect(() => {
    if (txSuccess) {
      refetch();
      refetchVotes();
      refetchMyVote();
      setShowVoteForm(false);
      setTxHash(undefined);
    }
  }, [txSuccess, refetch, refetchVotes, refetchMyVote]);

  const handleVote = async () => {
    if (!claimId || !address || selectedVote === null || !claim) return;

    try {
      const result = await voteMutation.mutateAsync({
        claimId,
        vote: selectedVote,
        // Always approve the full claimed amount - no custom amount
        approvedAmount: selectedVote === VOTE.APPROVE ? claim.claimedAmount : '0',
        reasoning,
        voterAddress: address,
      });
      setTxHash(result.hash);
    } catch (error) {
      console.error('Vote failed:', error);
    }
  };

  const handleFinalize = async () => {
    if (!claimId) return;

    try {
      const result = await finalizeMutation.mutateAsync(claimId);
      setTxHash(result.hash);
    } catch (error) {
      console.error('Finalize failed:', error);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-council" />
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="card p-6 text-center">
        <AlertCircle className="w-12 h-12 text-danger mx-auto mb-3" />
        <p className="text-governance-300">Claim not found</p>
        <button onClick={() => navigate('/claims')} className="btn-secondary mt-4">
          Back to Claims
        </button>
      </div>
    );
  }

  const deadline = new Date(claim.votingDeadline);
  const hoursLeft = (deadline.getTime() - Date.now()) / (1000 * 60 * 60);
  const isUrgent = hoursLeft > 0 && hoursLeft < 24;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/claims')}
          className="p-2 hover:bg-governance-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-governance-400" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-governance-100">Claim #{claim.claimId}</h1>
            <span className={getStatusBadge(claim.status)}>{claim.status}</span>
            {hasVoted && <span className="badge-success">Voted</span>}
          </div>
          <p className="text-governance-400">Agent #{claim.agentId}</p>
        </div>
        <button
          onClick={() => {
            refetch();
            refetchVotes();
            refetchMyVote();
          }}
          className="btn-ghost"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Transaction Pending */}
      {txPending && (
        <div className="card p-4 border-council/50 bg-council/5">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-council" />
            <span className="text-council">Transaction pending...</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Claim Details */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-governance-100 mb-4">Claim Details</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-governance-500">Claimed Amount</p>
                <p className="text-xl font-bold text-governance-100">
                  {formatUSDC(claim.claimedAmount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-governance-500">Claimant Deposit</p>
                <p className="text-xl font-bold text-governance-100">
                  {formatUSDC(claim.claimantDeposit)}
                </p>
              </div>
              <div>
                <p className="text-sm text-governance-500">Locked Collateral</p>
                <p className="text-xl font-bold text-governance-100">
                  {formatUSDC(claim.lockedCollateral)}
                </p>
              </div>
              <div>
                <p className="text-sm text-governance-500">Filed At</p>
                <p className="text-governance-100">
                  {new Date(claim.filedAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-governance-800">
              {/* Claimant */}
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-governance-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-governance-500">Claimant</p>
                  <div className="flex items-center gap-2">
                    <code className="text-governance-100 font-mono text-sm">
                      {claim.claimant}
                    </code>
                    <button
                      onClick={() => copyToClipboard(claim.claimant, 'claimant')}
                      className="p-1 hover:bg-governance-800 rounded"
                    >
                      {copied === 'claimant' ? (
                        <Check className="w-4 h-4 text-accent" />
                      ) : (
                        <Copy className="w-4 h-4 text-governance-500" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Provider */}
              <div className="flex items-start gap-3">
                <Bot className="w-5 h-5 text-governance-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-governance-500">Agent Provider (at claim time)</p>
                  <div className="flex items-center gap-2">
                    <code className="text-governance-100 font-mono text-sm">
                      {claim.providerAtClaimTime}
                    </code>
                    <button
                      onClick={() => copyToClipboard(claim.providerAtClaimTime, 'provider')}
                      className="p-1 hover:bg-governance-800 rounded"
                    >
                      {copied === 'provider' ? (
                        <Check className="w-4 h-4 text-accent" />
                      ) : (
                        <Copy className="w-4 h-4 text-governance-500" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Evidence */}
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-governance-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-governance-500">Evidence</p>
                  {claim.evidenceUri ? (
                    <a
                      href={claim.evidenceUri.startsWith('ipfs://') 
                        ? `https://gateway.pinata.cloud/ipfs/${claim.evidenceUri.replace('ipfs://', '')}`
                        : claim.evidenceUri
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-council hover:text-council-light flex items-center gap-1"
                    >
                      View Evidence <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <span className="text-governance-500">No evidence URI provided</span>
                  )}
                  {claim.evidenceHash && (
                    <p className="text-xs text-governance-500 font-mono mt-1">
                      Hash: {claim.evidenceHash.slice(0, 20)}...
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Voting Section */}
          {claim.canVote && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-governance-100 mb-4">
                {hasVoted ? 'Change Your Vote' : 'Cast Your Vote'}
              </h2>

              {!showVoteForm && hasVoted ? (
                <div className="space-y-4">
                  <div className="p-4 bg-governance-800/50 rounded-lg">
                    <p className="text-sm text-governance-500 mb-2">Your current vote</p>
                    <div className="flex items-center gap-3">
                      {myVote?.voteCode === VOTE.APPROVE && (
                        <>
                          <CheckCircle className="w-6 h-6 text-accent" />
                          <span className="text-accent font-medium">Approve</span>
                        </>
                      )}
                      {myVote?.voteCode === VOTE.REJECT && (
                        <>
                          <XCircle className="w-6 h-6 text-danger" />
                          <span className="text-danger font-medium">Reject</span>
                        </>
                      )}
                      {myVote?.voteCode === VOTE.ABSTAIN && (
                        <>
                          <MinusCircle className="w-6 h-6 text-governance-400" />
                          <span className="text-governance-400 font-medium">Abstain</span>
                        </>
                      )}
                    </div>
                    {myVote?.reasoning && (
                      <p className="text-sm text-governance-400 mt-2">
                        "{myVote.reasoning}"
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowVoteForm(true)}
                    className="btn-secondary w-full"
                  >
                    Change Vote
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Vote Buttons */}
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setSelectedVote(VOTE.APPROVE)}
                      className={`vote-btn-approve ${selectedVote === VOTE.APPROVE ? 'active' : ''}`}
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => setSelectedVote(VOTE.REJECT)}
                      className={`vote-btn-reject ${selectedVote === VOTE.REJECT ? 'active' : ''}`}
                    >
                      <XCircle className="w-5 h-5" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => setSelectedVote(VOTE.ABSTAIN)}
                      className={`vote-btn-abstain ${selectedVote === VOTE.ABSTAIN ? 'active' : ''}`}
                    >
                      <MinusCircle className="w-5 h-5" />
                      <span>Abstain</span>
                    </button>
                  </div>

                  {/* Reasoning */}
                  <div>
                    <label className="block text-sm text-governance-400 mb-2">
                      Reasoning (optional)
                    </label>
                    <textarea
                      value={reasoning}
                      onChange={(e) => setReasoning(e.target.value)}
                      placeholder="Why are you voting this way?"
                      rows={3}
                      className="input resize-none"
                    />
                  </div>

                  {/* Submit */}
                  <div className="flex gap-3">
                    {showVoteForm && hasVoted && (
                      <button
                        onClick={() => setShowVoteForm(false)}
                        className="btn-secondary flex-1"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={handleVote}
                      disabled={selectedVote === null || voteMutation.isPending || txPending}
                      className="btn-primary flex-1"
                    >
                      {voteMutation.isPending || txPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          {txPending ? 'Confirming...' : 'Submitting...'}
                        </>
                      ) : hasVoted ? (
                        'Change Vote'
                      ) : (
                        'Submit Vote'
                      )}
                    </button>
                  </div>

                  {voteMutation.error && (
                    <p className="text-danger text-sm">
                      {voteMutation.error.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Finalize Button */}
          {claim.canFinalize && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-governance-100 mb-2">Finalize Claim</h2>
              <p className="text-governance-400 text-sm mb-4">
                The voting period has ended. Anyone can finalize this claim to execute the ruling.
              </p>
              <button
                onClick={handleFinalize}
                disabled={finalizeMutation.isPending || txPending}
                className="btn-primary w-full"
              >
                {finalizeMutation.isPending || txPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Finalizing...
                  </>
                ) : (
                  'Finalize Claim'
                )}
              </button>
            </div>
          )}

          {/* All Votes */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-governance-100 mb-4">
              Votes ({votes.length})
            </h2>
            {votes.length === 0 ? (
              <p className="text-governance-500 text-center py-6">No votes yet</p>
            ) : (
              <div className="space-y-3">
                {votes.map((vote) => (
                  <div
                    key={vote.voter}
                    className="p-4 bg-governance-800/50 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {vote.voteCode === VOTE.APPROVE && (
                          <CheckCircle className="w-5 h-5 text-accent" />
                        )}
                        {vote.voteCode === VOTE.REJECT && (
                          <XCircle className="w-5 h-5 text-danger" />
                        )}
                        {vote.voteCode === VOTE.ABSTAIN && (
                          <MinusCircle className="w-5 h-5 text-governance-400" />
                        )}
                        <div>
                          <p className="font-mono text-sm text-governance-100">
                            {formatAddress(vote.voter)}
                            {vote.voter.toLowerCase() === address?.toLowerCase() && (
                              <span className="text-council ml-2">(you)</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm text-governance-500">
                        {new Date(vote.votedAt).toLocaleDateString()}
                        {vote.lastChangedAt && (
                          <p className="text-xs">(changed)</p>
                        )}
                      </div>
                    </div>
                    {vote.reasoning && (
                      <p className="text-sm text-governance-400 mt-2 pl-8">
                        "{vote.reasoning}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Conversation */}
          <ClaimConversation
            claimId={claimId!}
            currentUserAddress={address}
            isEvidencePeriod={claim.isInEvidencePeriod}
            claimantAddress={claim.claimant}
            providerAddress={claim.providerAtClaimTime}
            filedAt={claim.filedAt ? Math.floor(new Date(claim.filedAt).getTime() / 1000) : undefined}
            initialDescription={claimDescription}
            onMessagePosted={() => {
              refetch();
              refetchVotes();
            }}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Voting Progress */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-governance-100 mb-4">Voting Progress</h3>
            
            {claim.votingProgress && (
              <>
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-governance-400">Approve</span>
                    <span className="text-accent">{claim.votingProgress.approveVotes}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-governance-400">Reject</span>
                    <span className="text-danger">{claim.votingProgress.rejectVotes}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-governance-400">Abstain</span>
                    <span className="text-governance-300">{claim.votingProgress.abstainVotes}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-governance-800">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-governance-400">Total Votes</span>
                    <span className="text-governance-100">
                      {claim.votingProgress.totalVotes} / {claim.votingProgress.requiredQuorum}
                    </span>
                  </div>
                  <div className="h-2 bg-governance-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        claim.votingProgress.quorumReached ? 'bg-accent' : 'bg-council'
                      }`}
                      style={{
                        width: `${Math.min(100, (Number(claim.votingProgress.totalVotes) / Number(claim.votingProgress.requiredQuorum)) * 100)}%`,
                      }}
                    />
                  </div>
                  {claim.votingProgress.quorumReached ? (
                    <p className="text-accent text-xs mt-2">Quorum reached!</p>
                  ) : (
                    <p className="text-governance-500 text-xs mt-2">
                      {Number(claim.votingProgress.requiredQuorum) - Number(claim.votingProgress.totalVotes)} more votes needed
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Timeline */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-governance-100 mb-4">Timeline</h3>
            
            <div className="space-y-0">
              <div className="timeline-item">
                <div className="timeline-dot complete" />
                <p className="text-sm font-medium text-governance-100">Filed</p>
                <p className="text-xs text-governance-500">
                  {new Date(claim.filedAt).toLocaleString()}
                </p>
              </div>
              
              <div className="timeline-item">
                <div className={`timeline-dot ${!claim.isInEvidencePeriod ? 'complete' : 'active'}`} />
                <p className="text-sm font-medium text-governance-100">Evidence Period</p>
                <p className="text-xs text-governance-500">
                  {claim.isInEvidencePeriod
                    ? `Ends ${getTimeRemaining(claim.evidenceDeadline)}`
                    : `Ended ${new Date(claim.evidenceDeadline).toLocaleString()}`
                  }
                </p>
              </div>
              
              <div className="timeline-item">
                <div className={`timeline-dot ${
                  claim.canVote ? 'active' : claim.canFinalize || claim.statusCode > 2 ? 'complete' : ''
                }`} />
                <p className="text-sm font-medium text-governance-100">Voting Period</p>
                <p className={`text-xs ${isUrgent ? 'text-danger' : 'text-governance-500'}`}>
                  {claim.canVote
                    ? `Ends ${getTimeRemaining(claim.votingDeadline)}`
                    : `Ended ${new Date(claim.votingDeadline).toLocaleString()}`
                  }
                </p>
              </div>
              
              <div className="timeline-item">
                <div className={`timeline-dot ${claim.statusCode >= 3 ? 'complete' : ''}`} />
                <p className="text-sm font-medium text-governance-100">Resolution</p>
                <p className="text-xs text-governance-500">
                  {claim.statusCode >= 3 ? claim.status : 'Pending'}
                </p>
              </div>
            </div>
          </div>

          {/* Deposit Info */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-governance-100 mb-4">Deposit Distribution</h3>
            <p className="text-sm text-governance-400 mb-3">
              The claimant's deposit of {formatUSDC(claim.claimantDeposit)} will be distributed to council members who voted.
            </p>
            <div className="p-3 bg-governance-800/50 rounded-lg text-xs text-governance-500">
              <p>• Only members who vote receive a share</p>
              <p>• Abstaining excludes you from the share</p>
              <p>• Share is split equally among voters</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
