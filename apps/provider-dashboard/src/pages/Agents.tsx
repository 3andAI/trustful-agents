import { Link } from 'react-router-dom'
import { Bot, Plus, Shield, Coins, ChevronRight, Search } from 'lucide-react'
import { useState } from 'react'
import { Card, Button, Badge, LoadingState, EmptyState } from '../components/ui'
import { useAgents, useAgent } from '../hooks/useAgents'
import { formatUsdc } from '../lib/utils'

export default function AgentsPage() {
  const { agents, isLoading, count } = useAgents()
  const [searchQuery, setSearchQuery] = useState('')

  const filteredAgents = agents.filter((agent) =>
    agent.id.toString().includes(searchQuery)
  )

  if (isLoading) {
    return <LoadingState message="Loading agents..." />
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">My Agents</h1>
          <p className="text-surface-400 mt-1">{count} agent{count !== 1 ? 's' : ''} registered</p>
        </div>
        <Link to="/agents/new">
          <Button leftIcon={<Plus className="w-4 h-4" />}>New Agent</Button>
        </Link>
      </div>

      {/* Search */}
      {count > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
          <input
            type="text"
            placeholder="Search by Agent ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>
      )}

      {/* Grid */}
      {filteredAgents.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bot className="w-12 h-12" />}
            title={count === 0 ? 'No agents yet' : 'No agents found'}
            description={count === 0 ? 'Create your first AI agent to get started.' : 'Try adjusting your search.'}
            action={count === 0 ? <Link to="/agents/new"><Button>Create Agent</Button></Link> : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => (
            <AgentCard key={agent.id.toString()} agentId={agent.id.toString()} />
          ))}
        </div>
      )}
    </div>
  )
}

function AgentCard({ agentId }: { agentId: string }) {
  const { agent } = useAgent(agentId)
  const isValidated = agent?.validation?.isValid ?? false
  const collateral = agent?.collateral?.balance ?? BigInt(0)

  return (
    <Link to={`/agents/${agentId}`}>
      <Card className="hover:border-surface-700 transition-all duration-200 hover:shadow-lg">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
                <Bot className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-surface-100">Agent #{agentId}</h3>
                <Badge variant={isValidated ? 'success' : 'neutral'} className="mt-1">
                  {isValidated ? 'Validated' : 'Not Validated'}
                </Badge>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-surface-500" />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-surface-800">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-surface-500" />
              <div>
                <p className="text-xs text-surface-500">Collateral</p>
                <p className="text-sm font-medium text-surface-200">{formatUsdc(collateral)} USDC</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-surface-500" />
              <div>
                <p className="text-xs text-surface-500">Claims</p>
                <p className="text-sm font-medium text-surface-200">0 pending</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
