import { useState, useEffect, useCallback } from 'react'
import { 
  MessageSquare, Reply, Upload, Send, Loader2, FileText, Download,
  User, Bot, Shield, ChevronDown, ChevronRight
} from 'lucide-react'
import { hashFile, fileToBase64DataUri, canDisplayInline, MAX_EVIDENCE_SIZE } from '../lib/api'

export type AuthorRole = 'claimer' | 'provider' | 'council'

export interface ClaimMessage {
  id: string; claim_id: string; parent_id: string | null; author_address: string;
  author_role: AuthorRole; content: string; evidence_hash: string | null;
  evidence_data: string | null; evidence_filename: string | null;
  evidence_mimetype: string | null; evidence_size: number | null;
  created_at: string; replies: ClaimMessage[];
}

interface ConversationProps {
  claimId: string; currentUserAddress?: string; currentUserRole?: AuthorRole | null;
  isEvidencePeriod: boolean; claimantAddress: string; providerAddress: string;
  filedAt?: number; initialDescription?: string | null; onMessagePosted?: () => void;
}

const API_BASE = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_URL || 'https://api.trustful-agents.ai')

// Support both 'council' (v1.3) and 'councilor' (v1.2 legacy)
type AuthorRoleWithLegacy = AuthorRole | 'councilor'

const roleConfig: Record<AuthorRoleWithLegacy, { color: string; bgColor: string; icon: typeof User; label: string }> = {
  claimer: { color: 'text-claimer', bgColor: 'bg-claimer/20', icon: User, label: 'Claimer' },
  provider: { color: 'text-accent', bgColor: 'bg-accent/20', icon: Bot, label: 'Provider' },
  council: { color: 'text-council', bgColor: 'bg-council/20', icon: Shield, label: 'Council' },
  councilor: { color: 'text-council', bgColor: 'bg-council/20', icon: Shield, label: 'Council' }  // legacy
}

const defaultRoleConfig = { color: 'text-surface-400', bgColor: 'bg-surface-700', icon: User, label: 'Unknown' }

export default function ClaimConversation({
  claimId, currentUserAddress, currentUserRole, isEvidencePeriod,
  claimantAddress, filedAt, initialDescription, onMessagePosted
}: ConversationProps) {
  const [messages, setMessages] = useState<ClaimMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [posting, setPosting] = useState(false)

  const descriptionMessage: ClaimMessage | null = initialDescription ? {
    id: 'initial-description', claim_id: claimId, parent_id: null,
    author_address: claimantAddress, author_role: 'claimer', content: initialDescription,
    evidence_hash: null, evidence_data: null, evidence_filename: null,
    evidence_mimetype: null, evidence_size: null,
    created_at: filedAt ? new Date(filedAt * 1000).toISOString() : new Date().toISOString(),
    replies: []
  } : null

  const allMessages = descriptionMessage ? [descriptionMessage, ...messages] : messages

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/claims/${claimId}/messages`)
      if (!res.ok) throw new Error('Failed to fetch messages')
      const data = await res.json()
      setMessages(data.messages || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching messages:', err)
      setError('Failed to load conversation')
    } finally { setLoading(false) }
  }, [claimId])

  useEffect(() => {
    fetchMessages()
    if (isEvidencePeriod) {
      const interval = setInterval(fetchMessages, 30000)
      return () => clearInterval(interval)
    }
  }, [fetchMessages, isEvidencePeriod])

  const handleSubmit = async () => {
    if (!content.trim() || !currentUserAddress || !currentUserRole) return
    setPosting(true); setError(null)
    try {
      let evidencePayload: any = {}
      if (evidenceFile && currentUserRole !== 'council') {
        if (evidenceFile.size > MAX_EVIDENCE_SIZE) {
          setError(`File too large. Maximum size is ${MAX_EVIDENCE_SIZE / 1024}KB`)
          setPosting(false); return
        }
        evidencePayload = {
          evidenceHash: await hashFile(evidenceFile),
          evidenceData: await fileToBase64DataUri(evidenceFile),
          evidenceFilename: evidenceFile.name,
          evidenceMimetype: evidenceFile.type,
          evidenceSize: evidenceFile.size
        }
      }
      const res = await fetch(`${API_BASE}/claims/${claimId}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorAddress: currentUserAddress, authorRole: currentUserRole,
          content: content.trim(), parentId: replyingTo, ...evidencePayload
        })
      })
      if (!res.ok) { const errData = await res.json(); throw new Error(errData.error || 'Failed to post message') }
      setContent(''); setEvidenceFile(null); setReplyingTo(null)
      await fetchMessages(); onMessagePosted?.()
    } catch (err) {
      console.error('Error posting message:', err)
      setError(err instanceof Error ? err.message : 'Failed to post message')
    } finally { setPosting(false) }
  }

  const canPost = currentUserRole && isEvidencePeriod
  const canAttachEvidence = currentUserRole && currentUserRole !== 'council'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" /> Discussion
        </h3>
        {!isEvidencePeriod && (
          <span className="text-xs text-surface-500 bg-surface-800 px-2 py-1 rounded">
            Evidence period ended - Read only
          </span>
        )}
      </div>

      {error && <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-claimer animate-spin" />
        </div>
      ) : (
        <>
          {allMessages.length === 0 ? (
            <div className="text-center py-8 text-surface-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No messages yet</p>
              {canPost && <p className="text-sm mt-1">Start the conversation below</p>}
            </div>
          ) : (
            <div className="space-y-3">
              {allMessages.map(message => (
                <MessageThread key={message.id} message={message} claimantAddress={claimantAddress}
                  onReply={canPost && message.id !== 'initial-description' ? setReplyingTo : undefined}
                  isInitialDescription={message.id === 'initial-description'} depth={0} />
              ))}
            </div>
          )}

          {canPost && (
            <div className="border-t border-surface-700 pt-4 mt-4">
              {replyingTo && (
                <div className="flex items-center gap-2 mb-2 text-sm text-surface-400">
                  <Reply className="w-4 h-4" /><span>Replying to message</span>
                  <button onClick={() => setReplyingTo(null)} className="text-claimer hover:text-claimer-light">Cancel</button>
                </div>
              )}
              <div className="space-y-3">
                <textarea value={content} onChange={(e) => setContent(e.target.value)}
                  placeholder={currentUserRole === 'council' ? "Add a comment or question..." : "Add a response or submit evidence..."}
                  className="input w-full min-h-[80px] resize-none" disabled={posting} />
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {canAttachEvidence && (
                      <label className="btn btn-secondary text-sm cursor-pointer">
                        <Upload className="w-4 h-4 mr-1" />
                        {evidenceFile ? evidenceFile.name : 'Attach Evidence'}
                        <input type="file" className="hidden" onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)} disabled={posting} />
                      </label>
                    )}
                    {evidenceFile && <button onClick={() => setEvidenceFile(null)} className="text-surface-400 hover:text-surface-100 text-sm">Remove</button>}
                  </div>
                  <button onClick={handleSubmit} disabled={!content.trim() || posting} className="btn btn-primary">
                    {posting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Posting...</> : <><Send className="w-4 h-4 mr-2" />Post</>}
                  </button>
                </div>
                {evidenceFile && evidenceFile.size > MAX_EVIDENCE_SIZE && (
                  <p className="text-danger text-sm">File too large ({(evidenceFile.size / 1024).toFixed(1)}KB). Maximum is {MAX_EVIDENCE_SIZE / 1024}KB.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MessageThread({ message, claimantAddress, onReply, isInitialDescription, depth }: {
  message: ClaimMessage; claimantAddress: string; onReply?: (id: string) => void;
  isInitialDescription?: boolean; depth: number;
}) {
  const [expanded, setExpanded] = useState(true)
  const config = roleConfig[message.author_role as AuthorRoleWithLegacy] || defaultRoleConfig
  const Icon = config.icon
  const hasReplies = message.replies && message.replies.length > 0

  const getDisplayName = () => {
    if (message.author_role === 'claimer') return 'Claimer'
    if (message.author_role === 'provider') return 'Provider'
    return `Council ${message.author_address.slice(0, 6)}...${message.author_address.slice(-4)}`
  }

  const handleDownload = () => {
    if (!message.evidence_data || !message.evidence_filename) return
    const link = document.createElement('a')
    link.href = message.evidence_data
    link.download = message.evidence_filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className={`${depth > 0 ? 'ml-6 border-l-2 border-surface-700 pl-4' : ''}`}>
      <div className={`p-4 rounded-lg border transition-colors ${
        isInitialDescription ? 'bg-claimer/10 border-claimer/30' : 'bg-surface-800/50 border-surface-700 hover:border-surface-600'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${config.color}`} />
            </div>
            <div>
              <span className={`font-medium ${config.color}`}>{getDisplayName()}</span>
              {isInitialDescription && <span className="ml-2 text-xs bg-claimer/20 text-claimer px-2 py-0.5 rounded">Initial Claim</span>}
              <span className="text-surface-500 text-xs ml-2">{new Date(message.created_at).toLocaleString()}</span>
            </div>
          </div>
          {onReply && <button onClick={() => onReply(message.id)} className="text-surface-400 hover:text-surface-100 p-1" title="Reply"><Reply className="w-4 h-4" /></button>}
        </div>
        <p className="text-surface-200 whitespace-pre-wrap">{message.content}</p>
        {message.evidence_data && (
          <div className="mt-3 p-3 bg-surface-900 rounded border border-surface-700">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-claimer" />
              <span className="text-sm text-surface-300">{message.evidence_filename || 'Evidence file'}</span>
              {message.evidence_size && <span className="text-xs text-surface-500">({(message.evidence_size / 1024).toFixed(1)}KB)</span>}
              <button onClick={handleDownload} className="text-claimer hover:text-claimer-light ml-auto flex items-center gap-1 text-sm">
                <Download className="w-3 h-3" /> Download
              </button>
            </div>
            {canDisplayInline(message.evidence_mimetype) && (
              <img src={message.evidence_data} alt={message.evidence_filename || 'Evidence'} className="max-w-full max-h-48 rounded border border-surface-700 mt-2" />
            )}
          </div>
        )}
      </div>
      {hasReplies && (
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-sm text-surface-400 hover:text-surface-100 mt-2 ml-2">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {message.replies.length} {message.replies.length === 1 ? 'reply' : 'replies'}
        </button>
      )}
      {hasReplies && expanded && (
        <div className="mt-2 space-y-2">
          {message.replies.map(reply => (
            <MessageThread key={reply.id} message={reply} claimantAddress={claimantAddress}
              onReply={onReply} isInitialDescription={false} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
