// Placeholder pages for Phase 1
// These will be fully implemented in later phases

import { AlertTriangle, Shield, Construction, Users, Clock, Percent } from 'lucide-react'
import { Card } from '../components/ui'
import { useActiveCouncils } from '../hooks/useTerms'

function PlaceholderPage({ title, description, icon: Icon, phase = 'Phase 2' }: { 
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  phase?: string
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center mx-auto mb-4">
            <Icon className="w-8 h-8 text-surface-400" />
          </div>
          <h2 className="text-xl font-semibold text-surface-100 mb-2">{title}</h2>
          <p className="text-surface-400 max-w-md mx-auto">{description}</p>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-surface-500">
            <Construction className="w-4 h-4" />
            Coming in {phase}
          </div>
        </div>
      </Card>
    </div>
  )
}

export function CouncilsPage() {
  const { councils, isLoading, error } = useActiveCouncils()

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-100">Councils</h1>
        <p className="text-surface-400 mt-1">
          Browse available councils for dispute resolution
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <Card>
          <div className="flex items-center justify-center py-12">
            <div className="spinner" />
            <span className="ml-3 text-surface-400">Loading councils from blockchain...</span>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-danger mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-surface-100 mb-2">Failed to Load Councils</h2>
            <p className="text-surface-400 max-w-md mx-auto">
              {error.message}
            </p>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && councils.length === 0 && (
        <Card>
          <div className="text-center py-12">
            <Shield className="w-12 h-12 text-surface-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-surface-100 mb-2">No Active Councils</h2>
            <p className="text-surface-400 max-w-md mx-auto">
              There are no active councils on-chain yet. Councils are created through the Governance Dashboard.
            </p>
          </div>
        </Card>
      )}

      {/* Councils Grid */}
      {!isLoading && councils.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {councils.map((council) => (
            <Card key={council.councilId} className="hover:border-surface-700 transition-colors">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-surface-100 text-lg">{council.name}</h3>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-accent/10 text-accent text-xs rounded-full">
                    {council.vertical}
                  </span>
                </div>

                {council.description && (
                  <p className="text-sm text-surface-400 line-clamp-2">
                    {council.description}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-surface-800">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-surface-500 mb-1">
                      <Users className="w-3 h-3" />
                    </div>
                    <p className="text-sm font-medium text-surface-200">
                      {council.memberCount.toString()}
                    </p>
                    <p className="text-xs text-surface-500">Members</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-surface-500 mb-1">
                      <Percent className="w-3 h-3" />
                    </div>
                    <p className="text-sm font-medium text-surface-200">
                      {Number(council.quorumPercentage) / 100}%
                    </p>
                    <p className="text-xs text-surface-500">Quorum</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-surface-500 mb-1">
                      <Clock className="w-3 h-3" />
                    </div>
                    <p className="text-sm font-medium text-surface-200">
                      {Math.floor(Number(council.votingPeriod) / 86400)}d
                    </p>
                    <p className="text-xs text-surface-500">Voting</p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
