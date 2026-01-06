import { Link } from 'react-router-dom'
import { Bot, Shield, Coins, AlertTriangle, Plus, ChevronRight } from 'lucide-react'
import { useAccount } from 'wagmi'
import { Card, CardTitle, StatCard, Button, Badge, LoadingState, EmptyState } from '../components/ui'
import { useAgents, useAgent } from '../hooks/useAgents'
import { formatUsdc, shortenAddress } from '../lib/utils'

export default function DashboardPage() {
  const { address } = useAccount()
  const { agents, isLoading, count } = useAgents()

  if (isLoading) {
    return <LoadingState message="Loading dashboard..." />
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Dashboard</h1>
          <p className="text-surface-400 mt-1">Welcome back, {address ? shortenAddress(address) : ''}</p>
        </div>
        <Link to="/agents/new">
          <Button leftIcon={<Plus className="w-4 h-4" />}>New Agent</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Agents" value={count} icon={<Bot className="w-5 h-5" />} />
        <StatCard label="Validated" value={0} subValue="agents" icon={<Shield className="w-5 h-5" />} />
        <StatCard label="Total Collateral" value="0" subValue="USDC" icon={<Coins className="w-5 h-5" />} />
        <StatCard label="Pending Claims" value={0} icon={<AlertTriangle className="w-5 h-5" />} />
      </div>

      {/* Agents List */}
      <Card padding="none">
        <div className="card-header flex items-center justify-between px-6 py-4 border-b border-surface-800">
          <CardTitle>My Agents</CardTitle>
          <Link to="/agents" className="text-sm text-accent hover:text-accent-light">View all</Link>
        </div>
        
        {agents.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Bot className="w-12 h-12" />}
              title="No agents yet"
              description="Create your first AI agent to get started."
              action={<Link to="/agents/new"><Button>Create Agent</Button></Link>}
            />
          </div>
        ) : (
          <div className="divide-y divide-surface-800">
            {agents.slice(0, 5).map((agent) => (
              <AgentRow key={agent.id.toString()} agentId={agent.id.toString()} />
            ))}
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/agents/new">
          <Card className="hover:border-surface-700 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Plus className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-medium text-surface-100">Create New Agent</h3>
                  <p className="text-sm text-surface-400">Mint a new ERC-8004 agent</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-surface-500" />
            </div>
          </Card>
        </Link>

        <Link to="/councils">
          <Card className="hover:border-surface-700 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-success" />
                </div>
                <div>
                  <h3 className="font-medium text-surface-100">Browse Councils</h3>
                  <p className="text-sm text-surface-400">Find the right council for your vertical</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-surface-500" />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  )
}

function AgentRow({ agentId }: { agentId: string }) {
  const { agent } = useAgent(agentId)
  const isValidated = agent?.validation?.isValid ?? false
  const collateral = agent?.collateral?.balance ?? BigInt(0)

  return (
    <Link
      to={`/agents/${agentId}`}
      className="flex items-center justify-between px-6 py-4 hover:bg-surface-800/50 transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-surface-800 flex items-center justify-center">
          <Bot className="w-5 h-5 text-surface-400" />
        </div>
        <div>
          <p className="font-medium text-surface-100">Agent #{agentId}</p>
          <p className="text-sm text-surface-500">{formatUsdc(collateral)} USDC</p>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <Badge variant={isValidated ? 'success' : 'neutral'}>
          {isValidated ? 'Validated' : 'Not Validated'}
        </Badge>
        <ChevronRight className="w-5 h-5 text-surface-500" />
      </div>
    </Link>
  )
}
