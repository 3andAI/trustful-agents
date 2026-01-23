import { useState, useEffect, useCallback } from 'react'
import { 
  MessageSquare, 
  Reply, 
  Upload, 
  Send, 
  Loader2,
  FileText,
  ExternalLink,
  User,
  Bot,
  Shield,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { API_BASE_URL } from '../config/contracts'
import { shortenAddress } from '../lib/utils'

// Types
export type AuthorRole = 'claimer' | 'provider' | 'councilor'

export interface ClaimMessage {
  id: string
  claim_id: string
  parent_id: string | null
  author_address: string
  author_role: AuthorRole
  content: string
  evidence_hash: string | null
  evidence_uri: string | null
  evidence_filename: string | null
  evidence_size: number | null
  created_at: string
  replies: ClaimMessage[]
}

interface ConversationProps {
  claimId: string
  currentUserAddress?: string
  currentUserRole?: AuthorRole | null // null if user has no role in this claim
  isEvidencePeriod: boolean
  claimantAddress: string
  providerAddress: string
  filedAt?: number // timestamp when claim was filed
  initialDescription?: string | null // the claim description (shown as first message)
  onMessagePosted?: () => void
}

const MAX_FILE_SIZE = 10240 // 10KB

// Role colors and icons
const roleConfig: Record<AuthorRole, { color: string; bgColor: string; icon: typeof User; label: string }> = {
  claimer: { color: 'text-warning', bgColor: 'bg-warning/20', icon: User, label: 'Claimer' },
  provider: { color: 'text-accent', bgColor: 'bg-accent/20', icon: Bot, label: 'Provider' },
  councilor: { color: 'text-cyan-400', bgColor: 'bg-cyan-400/20', icon: Shield, label: 'Council' }
}

// Convert IPFS URI to HTTP URL
function ipfsToHttp(uri: string | null | undefined): string | null {
  if (!uri) return null
  if (uri.startsWith('ipfs://')) {
    const hash = uri.replace('ipfs://', '')
    return `https://gateway.pinata.cloud/ipfs/${hash}`
  }
  return uri
}

// Hash file using keccak256
async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const { keccak256 } = await import('viem')
  return keccak256(new Uint8Array(buffer))
}

// Upload file to IPFS via Pinata (direct)
async function uploadToIPFS(file: File): Promise<{ hash: string; uri: string } | null> {
  const pinataApiKey = import.meta.env.VITE_PINATA_API_KEY
  const pinataSecretKey = import.meta.env.VITE_PINATA_SECRET_KEY
  
  if (!pinataApiKey || !pinataSecretKey) {
    console.error('VITE_PINATA_API_KEY or VITE_PINATA_SECRET_KEY not configured')
    return null
  }
  
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    // Add metadata
    const metadata = JSON.stringify({
      name: file.name,
      keyvalues: {
        type: 'evidence',
        timestamp: Date.now().toString()
      }
    })
    formData.append('pinataMetadata', metadata)

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'pinata_api_key': pinataApiKey,
        'pinata_secret_api_key': pinataSecretKey
      },
      body: formData,
    })

    if (!response.ok) {
      console.error('Pinata upload failed:', await response.text())
      return null
    }

    const data = await response.json()
    const cid = data.IpfsHash
    return {
      hash: cid,
      uri: `ipfs://${cid}`,
    }
  } catch (error) {
    console.error('IPFS upload error:', error)
    return null
  }
}

export default function ClaimConversation({
  claimId,
  currentUserAddress,
  currentUserRole,
  isEvidencePeriod,
  claimantAddress,
  providerAddress,
  filedAt,
  initialDescription,
  onMessagePosted
}: ConversationProps) {
  const [messages, setMessages] = useState<ClaimMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Composer state
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [posting, setPosting] = useState(false)

  // Create a "virtual" first message from the description
  const descriptionMessage: ClaimMessage | null = initialDescription ? {
    id: 'initial-description',
    claim_id: claimId,
    parent_id: null,
    author_address: claimantAddress,
    author_role: 'claimer',
    content: initialDescription,
    evidence_hash: null,
    evidence_uri: null,
    evidence_filename: null,
    evidence_size: null,
    created_at: filedAt ? new Date(filedAt * 1000).toISOString() : new Date().toISOString(),
    replies: []
  } : null

  // Combine description with fetched messages
  const allMessages = descriptionMessage 
    ? [descriptionMessage, ...messages]
    : messages

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/claims/${claimId}/messages`)
      if (!res.ok) throw new Error('Failed to fetch messages')
      const data = await res.json()
      setMessages(data.messages || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching messages:', err)
      setError('Failed to load conversation')
    } finally {
      setLoading(false)
    }
  }, [claimId])

  useEffect(() => {
    fetchMessages()
    
    // Auto-refresh every 30 seconds during evidence period
    if (isEvidencePeriod) {
      const interval = setInterval(fetchMessages, 30000)
      return () => clearInterval(interval)
    }
  }, [fetchMessages, isEvidencePeriod])

  const handleSubmit = async () => {
    if (!content.trim() || !currentUserAddress || !currentUserRole) return
    
    setPosting(true)
    
    try {
      let evidenceData: { hash?: string; uri?: string; filename?: string; size?: number } = {}
      
      // Upload evidence if provided (only for claimer/provider)
      if (evidenceFile && currentUserRole !== 'councilor') {
        setUploading(true)
        
        // Check file size
        if (evidenceFile.size > MAX_FILE_SIZE) {
          setError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024}KB`)
          setUploading(false)
          setPosting(false)
          return
        }
        
        const hash = await hashFile(evidenceFile)
        const ipfsResult = await uploadToIPFS(evidenceFile)
        
        if (ipfsResult) {
          evidenceData = {
            hash,
            uri: ipfsResult.uri,
            filename: evidenceFile.name,
            size: evidenceFile.size
          }
        }
        setUploading(false)
      }
      
      const res = await fetch(`${API_BASE_URL}/claims/${claimId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorAddress: currentUserAddress,
          authorRole: currentUserRole,
          content: content.trim(),
          parentId: replyingTo,
          evidenceHash: evidenceData.hash,
          evidenceUri: evidenceData.uri,
          evidenceFilename: evidenceData.filename,
          evidenceSize: evidenceData.size
        })
      })
      
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to post message')
      }
      
      // Clear form and refresh
      setContent('')
      setEvidenceFile(null)
      setReplyingTo(null)
      setError(null)
      await fetchMessages()
      onMessagePosted?.()
      
    } catch (err) {
      console.error('Error posting message:', err)
      setError(err instanceof Error ? err.message : 'Failed to post message')
    } finally {
      setPosting(false)
      setUploading(false)
    }
  }

  const canPost = currentUserRole && isEvidencePeriod
  const canAttachEvidence = canPost && currentUserRole !== 'councilor'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Discussion
        </h2>
        {!isEvidencePeriod && (
          <span className="text-xs bg-surface-800 text-surface-400 px-2 py-1 rounded">
            Read Only - Evidence period closed
          </span>
        )}
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
      ) : (
        <>
          {/* Messages */}
          {allMessages.length === 0 ? (
            <div className="text-center py-8 text-surface-500">
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

          {/* Composer */}
          {canPost && (
            <div className="border-t border-surface-700 pt-4 mt-4">
              {replyingTo && (
                <div className="flex items-center gap-2 mb-2 text-sm text-surface-400">
                  <Reply className="w-4 h-4" />
                  <span>Replying to message</span>
                  <button 
                    onClick={() => setReplyingTo(null)}
                    className="text-accent hover:text-accent/80"
                  >
                    Cancel
                  </button>
                </div>
              )}
              
              <div className="space-y-3">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    currentUserRole === 'councilor' 
                      ? "Add a comment or question..." 
                      : "Add a response or submit evidence..."
                  }
                  className="input w-full min-h-[80px] resize-none"
                  disabled={posting}
                />
                
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {canAttachEvidence && (
                      <label className="btn btn-secondary text-sm cursor-pointer">
                        <Upload className="w-4 h-4 mr-1" />
                        {evidenceFile ? evidenceFile.name : 'Attach Evidence'}
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                          disabled={posting}
                        />
                      </label>
                    )}
                    {evidenceFile && (
                      <button 
                        onClick={() => setEvidenceFile(null)}
                        className="text-surface-400 hover:text-surface-100 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  
                  <button
                    onClick={handleSubmit}
                    disabled={!content.trim() || posting || uploading}
                    className="btn btn-primary"
                  >
                    {posting || uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {uploading ? 'Uploading...' : 'Posting...'}
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Post
                      </>
                    )}
                  </button>
                </div>
                
                {evidenceFile && evidenceFile.size > MAX_FILE_SIZE && (
                  <p className="text-danger text-sm">
                    File too large ({(evidenceFile.size / 1024).toFixed(1)}KB). Maximum is {MAX_FILE_SIZE / 1024}KB.
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
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
  message: ClaimMessage
  claimantAddress: string
  providerAddress: string
  onReply?: (id: string) => void
  isInitialDescription?: boolean
  depth: number
}) {
  const [expanded, setExpanded] = useState(true)
  const config = roleConfig[message.author_role]
  const Icon = config.icon
  
  const hasReplies = message.replies && message.replies.length > 0
  
  // Determine display name
  const getDisplayName = () => {
    if (message.author_role === 'claimer') return 'Claimer'
    if (message.author_role === 'provider') return 'Provider'
    return `Councilor ${shortenAddress(message.author_address)}`
  }

  return (
    <div className={`${depth > 0 ? 'ml-6 border-l-2 border-surface-700 pl-4' : ''}`}>
      <div className={`p-4 rounded-lg border transition-colors ${
        isInitialDescription 
          ? 'bg-warning/10 border-warning/30' 
          : 'bg-surface-800/50 border-surface-700 hover:border-surface-600'
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
                <span className="ml-2 text-xs bg-warning/20 text-warning px-2 py-0.5 rounded">
                  Initial Claim
                </span>
              )}
              <span className="text-surface-500 text-xs ml-2">
                {new Date(message.created_at).toLocaleString()}
              </span>
            </div>
          </div>
          
          {onReply && (
            <button 
              onClick={() => onReply(message.id)}
              className="text-surface-400 hover:text-surface-100 p-1"
              title="Reply"
            >
              <Reply className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Content */}
        <p className="text-surface-200 whitespace-pre-wrap">{message.content}</p>
        
        {/* Evidence attachment */}
        {message.evidence_uri && (
          <div className="mt-3 p-3 bg-surface-900 rounded border border-surface-700">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              <span className="text-sm text-surface-300">
                {message.evidence_filename || 'Evidence file'}
              </span>
              {message.evidence_size && (
                <span className="text-xs text-surface-500">
                  ({(message.evidence_size / 1024).toFixed(1)}KB)
                </span>
              )}
              {ipfsToHttp(message.evidence_uri) && (
                <a
                  href={ipfsToHttp(message.evidence_uri)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-accent/80 ml-auto flex items-center gap-1 text-sm"
                >
                  View <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Replies toggle */}
      {hasReplies && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm text-surface-400 hover:text-surface-100 mt-2 ml-2"
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
  )
}
