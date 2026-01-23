import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { 
  getAgent, 
  getAgentClaims,
  fromHexId,
  type SubgraphAgent,
  type SubgraphClaim
} from '../lib/subgraph'

/**
 * Hook to fetch a single agent with claims data from subgraph
 */
export function useAgentFromSubgraph(agentId: string | undefined) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['agentSubgraph', agentId],
    queryFn: () => getAgent(agentId!),
    enabled: !!agentId,
    refetchInterval: 15000,
    staleTime: 5000,
  })

  return {
    agent: data,
    isLoading,
    error,
    refetch,
  }
}

/**
 * Hook to fetch claims for an agent from subgraph
 * More efficient than API for basic claim listing
 */
export function useAgentClaimsFromSubgraph(agentId: string | undefined) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['agentClaimsSubgraph', agentId],
    queryFn: () => getAgentClaims(agentId!, 100, 0),
    enabled: !!agentId,
    refetchInterval: 30000,
    staleTime: 10000,
  })

  const claims = data || []
  
  // Count pending claims (Filed status)
  const pendingCount = claims.filter(c => c.status === 'Filed').length
  
  return {
    claims,
    pendingCount,
    totalCount: claims.length,
    isLoading,
    error,
    refetch,
  }
}

// Re-export types for convenience
export type { SubgraphAgent, SubgraphClaim }
