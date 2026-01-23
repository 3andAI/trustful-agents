import { Link } from 'react-router-dom'
import { Bot, Shield, Coins, AlertTriangle, Plus, ChevronRight, Search } from 'lucide-react'
import { useAccount } from 'wagmi'
import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, StatCard, Button, Badge, LoadingState, EmptyState } from '../components/ui'
import { useAgents } from '../hooks/useAgents'
import { formatUsdc, shortenAddress } from '../lib/utils'
import { getAgentsByIds, fromHexId, type SubgraphAgent } from '../lib/subgraph'
import { API_BASE_URL } from '../config/contracts'

export default function DashboardPage() {
  const { address } = useAccount()
  const { agents, isLoading: agentsLoading } = useAgents()
  const [searchQuery, setSearchQuery] = useState('')

  // Get agent IDs for subgraph query
  const agentIds = useMemo(() => agents.map(a => a.id.toString()), [agents])
  
  // ONE subgraph query to get all agent data (claims, validation, collateral)
  const { data: subgraphAgents, isLoading: subgraphLoading } = useQuery({
    queryKey: ['agentsBatch', agentIds.join(',')],
    queryFn: () => getAgentsByIds(agentIds),
    enabled: agentIds.length > 0,
    staleTime: 30000, // Cache for 30 seconds
    refetchInterval: 60000, // Refetch every minute
  })

  // Create lookup map from subgraph data
  const agentDataMap = useMemo(() => {
    const map: Record<string, SubgraphAgent> = {}
    if (subgraphAgents) {
      for (const agent of subgraphAgents) {
        const numericId = fromHexId(agent.id)
        map[numericId] = agent
      }
    }
    return map
  }, [subgraphAgents])

  // Calculate stats from subgraph data
  const stats = useMemo(() => {
    const result = {
      totalAgents: agents.length,
      validatedAgents: 0,
      totalCollateral: BigInt(0),
      totalPendingClaims: 0,
    }
    
    for (const agentId of agentIds) {
      const data = agentDataMap[agentId]
      if (data) {
        if (data.isValidated) result.validatedAgents++
        result.totalCollateral += BigInt(data.collateralBalance || '0')
        result.totalPendingClaims += data.pendingClaims || 0
      }
    }
    
    return result
  }, [agents, agentIds, agentDataMap])

  // Filter agents by search
  const filteredAgents = agents.filter((agent) =>
    agent.id.toString().includes(searchQuery)
  )

  if (agentsLoading) {
    return <LoadingState message="Loading dashboard..." />
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
        <StatCard 
          label="Total Agents" 
          value={stats.totalAgents} 
          icon={<Bot className="w-5 h-5" />} 
        />
        <StatCard 
          label="Validated" 
          value={subgraphLoading ? '...' : stats.validatedAgents} 
          subValue="agents" 
          icon={<Shield className="w-5 h-5" />} 
        />
        <StatCard 
          label="Total Collateral" 
          value={subgraphLoading ? '...' : formatUsdc(stats.totalCollateral)} 
          subValue="USDC" 
          icon={<Coins className="w-5 h-5" />} 
        />
        <StatCard 
          label="Pending Claims" 
          value={subgraphLoading ? '...' : stats.totalPendingClaims} 
          icon={<AlertTriangle className="w-5 h-5" />} 
        />
      </div>

      {/* Search */}
      {agents.length > 0 && (
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

      {/* Agents Grid */}
      {filteredAgents.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bot className="w-12 h-12" />}
            title={agents.length === 0 ? 'No agents yet' : 'No agents found'}
            description={agents.length === 0 ? 'Create your first AI agent to get started.' : 'Try adjusting your search.'}
            action={agents.length === 0 ? <Link to="/agents/new"><Button>Create Agent</Button></Link> : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => (
            <AgentCard 
              key={agent.id.toString()} 
              agentId={agent.id.toString()} 
              subgraphData={agentDataMap[agent.id.toString()]}
            />
          ))}
        </div>
      )}

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

// Agent card - receives subgraph data from parent (no extra queries!)
function AgentCard({ agentId, subgraphData }: { agentId: string; subgraphData?: SubgraphAgent }) {
  const [agentName, setAgentName] = useState<string | null>(null)
  
  // Get data from subgraph (passed from parent)
  const isValidated = subgraphData?.isValidated ?? false
  const collateral = subgraphData ? BigInt(subgraphData.collateralBalance || '0') : BigInt(0)
  const pendingClaims = subgraphData?.pendingClaims ?? 0
  const totalClaims = subgraphData?.totalClaims ?? 0

  // Only ONE API call per card - just for the name
  useEffect(() => {
    fetch(API_BASE_URL + '/provider/agents/' + agentId)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.name) setAgentName(data.name)
      })
      .catch(() => {})
  }, [agentId])

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
                <h3 className="font-semibold text-surface-100">
                  {agentName || `Agent #${agentId}`}
                </h3>
                {agentName && (
                  <p className="text-xs text-surface-500">#{agentId}</p>
                )}
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
                <p className="text-sm font-medium text-surface-200">
                  {pendingClaims > 0 ? (
                    <span className="text-warning">{pendingClaims} pending</span>
                  ) : (
                    `${totalClaims} total`
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
