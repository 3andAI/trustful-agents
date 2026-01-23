import { useParams, Link } from 'react-router-dom'
import { AlertTriangle, Clock, ArrowLeft, ChevronRight, DollarSign, User } from 'lucide-react'
import { Card, Badge, Button, LoadingState, EmptyState } from '../components/ui'
import { useAgentClaims, ClaimStatus, getStatusLabel, getStatusVariant, getEvidenceTimeRemaining } from '../hooks/useClaims'
import { formatUsdc, formatTimestamp } from '../lib/utils'

export default function ClaimsPage() {
  const { agentId } = useParams<{ agentId: string }>()
  const { claims, isLoading, error, pendingCount, totalCount } = useAgentClaims(agentId)

  if (isLoading) {
    return <LoadingState message="Loading claims..." />
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/agents/${agentId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-surface-100">Claims</h1>
            <p className="text-surface-400 mt-1">
              Agent #{agentId} • {totalCount} total, {pendingCount} pending
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <div className="flex items-center gap-3 text-danger">
            <AlertTriangle className="w-5 h-5" />
            <span>Failed to load claims: {error.message}</span>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!error && claims.length === 0 && (
        <Card>
          <EmptyState
            icon={<AlertTriangle className="w-12 h-12" />}
            title="No Claims"
            description="This agent has no claims filed against it yet."
          />
        </Card>
      )}

      {/* Claims List */}
      {claims.length > 0 && (
        <div className="space-y-4">
          {claims.map((claim) => {
            const evidenceRemaining = getEvidenceTimeRemaining(claim)
            const isEvidenceOpen = claim.status === ClaimStatus.Filed && evidenceRemaining.total > 0

            return (
              <Link key={claim.id.toString()} to={`/agents/${agentId}/claims/${claim.id.toString()}`}>
                <Card className="hover:border-surface-600 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6 text-warning" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-surface-100">
                            Claim #{claim.id.toString()}
                          </h3>
                          <Badge variant={getStatusVariant(claim.status)}>
                            {getStatusLabel(claim.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-surface-400">
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {formatUsdc(claim.claimedAmount)} USDC claimed
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {claim.claimant.slice(0, 6)}...{claim.claimant.slice(-4)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Filed {formatTimestamp(claim.filedAt, { relative: true })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {isEvidenceOpen && (
                        <div className="text-right">
                          <p className="text-xs text-surface-500">Evidence closes in</p>
                          <p className="text-sm font-medium text-warning">
                            {evidenceRemaining.days > 0 && `${evidenceRemaining.days}d `}
                            {evidenceRemaining.hours}h {evidenceRemaining.minutes}m
                          </p>
                        </div>
                      )}
                      <ChevronRight className="w-5 h-5 text-surface-500" />
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
