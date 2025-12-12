/**
 * RPC Data Provider
 * 
 * Reads data directly from contracts via RPC calls.
 * Suitable for testnet and simple queries.
 * 
 * Limitations:
 * - No efficient filtering (must fetch all then filter client-side)
 * - No aggregations (must compute client-side)
 * - Multiple RPC calls for list queries
 * 
 * For production with complex queries, use SubgraphDataProvider.
 */

import { createPublicClient, http, type PublicClient } from 'viem';
import { baseSepolia, base } from 'viem/chains';
import type {
  DataProvider,
  DataProviderConfig,
  ClaimListQuery,
  ClaimListItem,
  AgentListQuery,
  AgentListItem,
  CouncilMemberQuery,
  CouncilMemberItem,
  VoteListQuery,
  VoteItem,
} from './index';
import { ClaimsManagerAbi, CouncilRegistryAbi, CollateralVaultAbi, TrustfulValidatorAbi } from '../contracts';

export class RpcDataProvider implements DataProvider {
  mode: 'rpc' = 'rpc';
  private client: PublicClient;
  private contracts: NonNullable<DataProviderConfig['contracts']>;

  constructor(config: DataProviderConfig) {
    if (!config.contracts) {
      throw new Error('RpcDataProvider requires contracts config');
    }
    
    this.contracts = config.contracts;
    
    // Determine chain from contract addresses or default to testnet
    const chain = config.rpcUrl?.includes('mainnet') ? base : baseSepolia;
    
    this.client = createPublicClient({
      chain,
      transport: http(config.rpcUrl),
    });
  }

  /**
   * Get claims matching query
   * 
   * Note: RPC mode fetches claims by agent, then filters client-side.
   * This is inefficient for broad queries - use subgraph for production.
   */
  async getClaims(query: ClaimListQuery): Promise<ClaimListItem[]> {
    // RPC limitation: must have agentId to query
    if (!query.agentId) {
      console.warn('RpcDataProvider.getClaims: No agentId provided. Returning empty array. Use subgraph for broad queries.');
      return [];
    }

    // Get claim IDs for this agent
    const claimIds = await this.client.readContract({
      address: this.contracts.claimsManager,
      abi: ClaimsManagerAbi,
      functionName: 'getClaimsByAgent',
      args: [query.agentId],
    }) as bigint[];

    // Fetch each claim
    const claims: ClaimListItem[] = [];
    for (const claimId of claimIds) {
      const claim = await this.client.readContract({
        address: this.contracts.claimsManager,
        abi: ClaimsManagerAbi,
        functionName: 'getClaim',
        args: [claimId],
      }) as any;

      claims.push({
        claimId: claim.claimId,
        agentId: claim.agentId,
        claimant: claim.claimant,
        claimedAmount: claim.claimedAmount,
        approvedAmount: claim.approvedAmount,
        status: claim.status,
        filedAt: claim.filedAt,
        evidenceDeadline: claim.evidenceDeadline,
        votingDeadline: claim.votingDeadline,
        councilId: claim.councilId,
      });
    }

    // Apply filters
    let filtered = claims;
    
    if (query.claimant) {
      filtered = filtered.filter(c => c.claimant.toLowerCase() === query.claimant!.toLowerCase());
    }
    
    if (query.councilId) {
      filtered = filtered.filter(c => c.councilId === query.councilId);
    }
    
    if (query.status) {
      const statusMap: Record<string, number> = {
        'Filed': 0,
        'Evidence': 1,
        'Voting': 2,
        'Approved': 3,
        'Rejected': 4,
        'Executed': 5,
        'Cancelled': 6,
      };
      filtered = filtered.filter(c => c.status === statusMap[query.status!]);
    }

    // Sort
    if (query.orderBy) {
      filtered.sort((a, b) => {
        const aVal = a[query.orderBy!];
        const bVal = b[query.orderBy!];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return query.orderDirection === 'desc' ? -cmp : cmp;
      });
    }

    // Paginate
    const skip = query.skip ?? 0;
    const first = query.first ?? 100;
    return filtered.slice(skip, skip + first);
  }

  async getClaimCount(query: Omit<ClaimListQuery, 'first' | 'skip' | 'orderBy' | 'orderDirection'>): Promise<number> {
    const claims = await this.getClaims({ ...query, first: 10000 });
    return claims.length;
  }

  /**
   * Get agents matching query
   * 
   * Note: RPC mode cannot enumerate all agents efficiently.
   * This returns empty for broad queries - use subgraph for production.
   */
  async getAgents(_query: AgentListQuery): Promise<AgentListItem[]> {
    console.warn('RpcDataProvider.getAgents: Cannot enumerate agents via RPC. Use subgraph for this query.');
    return [];
  }

  /**
   * Get council members
   */
  async getCouncilMembers(query: CouncilMemberQuery): Promise<CouncilMemberItem[]> {
    // Get member list from council
    const members = await this.client.readContract({
      address: this.contracts.councilRegistry,
      abi: CouncilRegistryAbi,
      functionName: 'getCouncilMembers',
      args: [query.councilId],
    }) as `0x${string}`[];

    const result: CouncilMemberItem[] = [];
    
    for (const address of members) {
      const memberData = await this.client.readContract({
        address: this.contracts.councilRegistry,
        abi: CouncilRegistryAbi,
        functionName: 'getMember',
        args: [query.councilId, address],
      }) as any;

      // Filter by active if requested
      if (query.activeOnly && !memberData.active) {
        continue;
      }

      result.push({
        address,
        councilId: query.councilId,
        joinedAt: memberData.joinedAt,
        active: memberData.active,
        claimsVoted: Number(memberData.claimsVoted),
      });
    }

    return result;
  }

  /**
   * Get votes
   * 
   * Note: RPC mode requires claimId to query votes.
   */
  async getVotes(query: VoteListQuery): Promise<VoteItem[]> {
    if (!query.claimId) {
      console.warn('RpcDataProvider.getVotes: No claimId provided. Use subgraph for voter-based queries.');
      return [];
    }

    // Get voters for this claim
    const voters = await this.client.readContract({
      address: this.contracts.claimsManager,
      abi: ClaimsManagerAbi,
      functionName: 'getClaimVoters',
      args: [query.claimId],
    }) as `0x${string}`[];

    const votes: VoteItem[] = [];
    
    for (const voter of voters) {
      // Filter by voter if specified
      if (query.voter && voter.toLowerCase() !== query.voter.toLowerCase()) {
        continue;
      }

      const vote = await this.client.readContract({
        address: this.contracts.claimsManager,
        abi: ClaimsManagerAbi,
        functionName: 'getVote',
        args: [query.claimId, voter],
      }) as any;

      votes.push({
        claimId: query.claimId,
        voter,
        vote: vote.vote,
        approvedAmount: vote.approvedAmount,
        reasoning: vote.reasoning,
        votedAt: vote.votedAt,
      });
    }

    return votes;
  }

  /**
   * Get protocol-wide stats
   * 
   * Note: Very limited in RPC mode - no way to enumerate all agents.
   */
  async getProtocolStats(): Promise<{
    totalAgents: number;
    validatedAgents: number;
    totalCollateral: bigint;
    totalClaims: number;
    totalPaidOut: bigint;
  }> {
    console.warn('RpcDataProvider.getProtocolStats: Limited data available via RPC. Use subgraph for accurate stats.');
    
    // Return placeholder - RPC cannot efficiently compute these
    return {
      totalAgents: 0,
      validatedAgents: 0,
      totalCollateral: 0n,
      totalClaims: 0,
      totalPaidOut: 0n,
    };
  }
}
