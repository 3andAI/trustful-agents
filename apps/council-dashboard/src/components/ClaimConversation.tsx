import { useState, useEffect, useCallback } from 'react';
import { 
  MessageSquare, 
  Reply, 
  Send, 
  Loader2,
  FileText,
  Download,
  User,
  Bot,
  Shield,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { formatAddress, canDisplayInline } from '../lib/api';

const API_BASE = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_URL || 'https://api.trustful-agents.ai');

// Types - v1.3: support both 'council' and 'councilor' (legacy)
export type AuthorRole = 'claimer' | 'provider' | 'council';
type AuthorRoleWithLegacy = AuthorRole | 'councilor';

export interface ClaimMessage {
  id: string;
  claim_id: string;
  parent_id: string | null;
  author_address: string;
  author_role: AuthorRole | 'councilor';  // support legacy
  content: string;
  evidence_hash: string | null;
  // v1.3: DB-stored evidence
  evidence_data: string | null;
  evidence_filename: string | null;
  evidence_mimetype: string | null;
  evidence_size: number | null;
  created_at: string;
  replies: ClaimMessage[];
}

interface ConversationProps {
  claimId: string;
  currentUserAddress?: string;
  isEvidencePeriod: boolean;
  claimantAddress: string;
  providerAddress: string;
  filedAt?: number;
  initialDescription?: string | null;
  onMessagePosted?: () => void;
}

// Role colors and icons - adapted for council dashboard theme
// Support both 'council' (v1.3) and 'councilor' (v1.2 legacy)
const roleConfig: Record<AuthorRoleWithLegacy, { color: string; bgColor: string; icon: typeof User; label: string }> = {
  claimer: { color: 'text-amber-400', bgColor: 'bg-amber-400/20', icon: User, label: 'Claimer' },
  provider: { color: 'text-blue-400', bgColor: 'bg-blue-400/20', icon: Bot, label: 'Provider' },
  council: { color: 'text-council', bgColor: 'bg-council/20', icon: Shield, label: 'Council' },
  councilor: { color: 'text-council', bgColor: 'bg-council/20', icon: Shield, label: 'Council' }  // legacy
};

const defaultRoleConfig = { color: 'text-governance-400', bgColor: 'bg-governance-700', icon: User, label: 'Unknown' };

export default function ClaimConversation({
  claimId,
  currentUserAddress,
  isEvidencePeriod,
  claimantAddress,
  providerAddress,
  filedAt,
  initialDescription,
  onMessagePosted
}: ConversationProps) {
  const [messages, setMessages] = useState<ClaimMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Composer state
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);

  // Create a "virtual" first message from the description
  const descriptionMessage: ClaimMessage | null = initialDescription ? {
    id: 'initial-description',
    claim_id: claimId,
    parent_id: null,
    author_address: claimantAddress,
    author_role: 'claimer',
    content: initialDescription,
    evidence_hash: null,
    evidence_data: null,
    evidence_filename: null,
    evidence_mimetype: null,
    evidence_size: null,
    created_at: filedAt ? new Date(filedAt * 1000).toISOString() : new Date().toISOString(),
    replies: []
  } : null;

  // Combine description with fetched messages
  const allMessages = descriptionMessage 
    ? [descriptionMessage, ...messages]
    : messages;

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/claims/${claimId}/messages`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();
      setMessages(data.messages || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    fetchMessages();
    
    // Auto-refresh every 30 seconds during evidence period
    if (isEvidencePeriod) {
      const interval = setInterval(fetchMessages, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchMessages, isEvidencePeriod]);

  const handleSubmit = async () => {
    if (!content.trim() || !currentUserAddress) return;
    
    setPosting(true);
    
    try {
      const res = await fetch(`${API_BASE}/claims/${claimId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorAddress: currentUserAddress,
          authorRole: 'councilor', // v1.3: use 'council' instead of 'councilor'
          content: content.trim(),
          parentId: replyingTo,
          // Council members cannot attach evidence
        })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to post message');
      }
      
      // Clear form and refresh
      setContent('');
      setReplyingTo(null);
      setError(null);
      await fetchMessages();
      onMessagePosted?.();
      
    } catch (err) {
      console.error('Error posting message:', err);
      setError(err instanceof Error ? err.message : 'Failed to post message');
    } finally {
      setPosting(false);
    }
  };

  const canPost = currentUserAddress && isEvidencePeriod;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-governance-100 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Discussion
        </h2>
        {!isEvidencePeriod && (
          <span className="text-xs bg-governance-800 text-governance-400 px-2 py-1 rounded">
            Read Only - Evidence period closed
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-council animate-spin" />
        </div>
      ) : (
        <>
          {/* Messages */}
          {allMessages.length === 0 ? (
            <div className="text-center py-8 text-governance-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No messages yet</p>
              {canPost && (
                <p className="text-sm mt-1">Start the conversation below</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {allMessages.map(message => (
                <MessageThread 
                  key={message.id} 
                  message={message}
                  claimantAddress={claimantAddress}
                  providerAddress={providerAddress}
                  onReply={canPost && message.id !== 'initial-description' ? setReplyingTo : undefined}
                  isInitialDescription={message.id === 'initial-description'}
                  depth={0}
                />
              ))}
            </div>
          )}

          {/* Composer - councilors can only comment, no evidence upload */}
          {canPost && (
            <div className="border-t border-governance-800 pt-4 mt-4">
              {replyingTo && (
                <div className="flex items-center gap-2 mb-2 text-sm text-governance-400">
                  <Reply className="w-4 h-4" />
                  <span>Replying to message</span>
                  <button 
                    onClick={() => setReplyingTo(null)}
                    className="text-council hover:text-council/80"
                  >
                    Cancel
                  </button>
                </div>
              )}
              
              <div className="space-y-3">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Add a comment or question as a council member..."
                  className="w-full min-h-[80px] resize-none bg-governance-800 border border-governance-700 rounded-lg px-4 py-3 text-governance-100 placeholder-governance-500 focus:outline-none focus:ring-2 focus:ring-council/50 focus:border-council"
                  disabled={posting}
                />
                
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs text-governance-500">
                    Posting as council member
                  </p>
                  
                  <button
                    onClick={handleSubmit}
                    disabled={!content.trim() || posting}
                    className="btn-primary"
                  >
                    {posting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Posting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Post
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Single message component with recursive replies
function MessageThread({ 
  message, 
  claimantAddress,
  providerAddress,
  onReply,
  isInitialDescription,
  depth 
}: { 
  message: ClaimMessage;
  claimantAddress: string;
  providerAddress: string;
  onReply?: (id: string) => void;
  isInitialDescription?: boolean;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const config = roleConfig[message.author_role as AuthorRoleWithLegacy] || defaultRoleConfig;
  const Icon = config.icon;
  
  const hasReplies = message.replies && message.replies.length > 0;
  
  // Determine display name
  const getDisplayName = () => {
    if (message.author_role === 'claimer') return 'Claimer';
    if (message.author_role === 'provider') return 'Provider';
    return `Council ${formatAddress(message.author_address)}`;
  };

  // Handle evidence download
  const handleDownload = () => {
    if (!message.evidence_data || !message.evidence_filename) return;
    const link = document.createElement('a');
    link.href = message.evidence_data;
    link.download = message.evidence_filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`${depth > 0 ? 'ml-6 border-l-2 border-governance-700 pl-4' : ''}`}>
      <div className={`p-4 rounded-lg border transition-colors ${
        isInitialDescription 
          ? 'bg-amber-400/10 border-amber-400/30' 
          : 'bg-governance-800/50 border-governance-700 hover:border-governance-600'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${config.color}`} />
            </div>
            <div>
              <span className={`font-medium ${config.color}`}>{getDisplayName()}</span>
              {isInitialDescription && (
                <span className="ml-2 text-xs bg-amber-400/20 text-amber-400 px-2 py-0.5 rounded">
                  Initial Claim
                </span>
              )}
              <span className="text-governance-500 text-xs ml-2">
                {new Date(message.created_at).toLocaleString()}
              </span>
            </div>
          </div>
          
          {onReply && (
            <button 
              onClick={() => onReply(message.id)}
              className="text-governance-400 hover:text-governance-100 p-1"
              title="Reply"
            >
              <Reply className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Content */}
        <p className="text-governance-200 whitespace-pre-wrap">{message.content}</p>
        
        {/* Evidence attachment - v1.3: DB-stored */}
        {message.evidence_data && (
          <div className="mt-3 p-3 bg-governance-900 rounded border border-governance-700">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-council" />
              <span className="text-sm text-governance-300">
                {message.evidence_filename || 'Evidence file'}
              </span>
              {message.evidence_size && (
                <span className="text-xs text-governance-500">
                  ({(message.evidence_size / 1024).toFixed(1)}KB)
                </span>
              )}
              <button
                onClick={handleDownload}
                className="text-council hover:text-council/80 ml-auto flex items-center gap-1 text-sm"
              >
                <Download className="w-3 h-3" /> Download
              </button>
            </div>
            {canDisplayInline(message.evidence_mimetype) && (
              <img 
                src={message.evidence_data} 
                alt={message.evidence_filename || 'Evidence'} 
                className="max-w-full max-h-48 rounded border border-governance-700 mt-2" 
              />
            )}
          </div>
        )}
      </div>
      
      {/* Replies toggle */}
      {hasReplies && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm text-governance-400 hover:text-governance-100 mt-2 ml-2"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {message.replies.length} {message.replies.length === 1 ? 'reply' : 'replies'}
        </button>
      )}
      
      {/* Nested replies */}
      {hasReplies && expanded && (
        <div className="mt-2 space-y-2">
          {message.replies.map(reply => (
            <MessageThread
              key={reply.id}
              message={reply}
              claimantAddress={claimantAddress}
              providerAddress={providerAddress}
              onReply={onReply}
              isInitialDescription={false}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
