/**
 * Subgraph Data Provider
 * 
 * Reads data from The Graph's indexed subgraph.
 * Suitable for mainnet and complex queries.
 * 
 * Advantages over RPC:
 * - Efficient filtering and pagination
 * - Aggregations computed by indexer
 * - Single request for complex queries
 * - Historical data access
 * 
 * Prerequisites:
 * 1. Deploy subgraph to The Graph Studio
 * 2. Get your subgraph URL
 * 3. Configure: createDataProvider({ mode: 'subgraph', subgraphUrl: '...' })
 */

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

export class SubgraphDataProvider implements DataProvider {
  mode: 'subgraph' = 'subgraph';
  private url: string;

  constructor(config: DataProviderConfig) {
    if (!config.subgraphUrl) {
      throw new Error('SubgraphDataProvider requires subgraphUrl config');
    }
    this.url = config.subgraphUrl;
  }

  private async query<T>(query: string, variables?: Record<string, any>): Promise<T> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Subgraph query failed: ${response.statusText}`);
    }

    const json = await response.json();
    
    if (json.errors) {
      throw new Error(`Subgraph query error: ${json.errors[0].message}`);
    }

    return json.data;
  }

  async getClaims(query: ClaimListQuery): Promise<ClaimListItem[]> {
    const where: string[] = [];
    
    if (query.agentId !== undefined) {
      where.push(`agentId: "${query.agentId}"`);
    }
    if (query.claimant) {
      where.push(`claimant: "${query.claimant.toLowerCase()}"`);
    }
    if (query.councilId) {
      where.push(`councilId: "${query.councilId}"`);
    }
    if (query.status) {
      where.push(`status: ${query.status}`);
    }

    const orderBy = query.orderBy ?? 'filedAt';
    const orderDirection = query.orderDirection ?? 'desc';
    const first = query.first ?? 100;
    const skip = query.skip ?? 0;

    const gql = `
      query GetClaims($first: Int!, $skip: Int!) {
        claims(
          first: $first
          skip: $skip
          orderBy: ${orderBy}
          orderDirection: ${orderDirection}
          ${where.length > 0 ? `where: { ${where.join(', ')} }` : ''}
        ) {
          claimId
          agentId
          claimant
          claimedAmount
          approvedAmount
          status
          filedAt
          evidenceDeadline
          votingDeadline
          councilId
        }
      }
    `;

    const data = await this.query<{ claims: any[] }>(gql, { first, skip });

    return data.claims.map(c => ({
      claimId: BigInt(c.claimId),
      agentId: BigInt(c.agentId),
      claimant: c.claimant as `0x${string}`,
      claimedAmount: BigInt(c.claimedAmount),
      approvedAmount: BigInt(c.approvedAmount),
      status: c.status,
      filedAt: BigInt(c.filedAt),
      evidenceDeadline: BigInt(c.evidenceDeadline),
      votingDeadline: BigInt(c.votingDeadline),
      councilId: c.councilId as `0x${string}`,
    }));
  }

  async getClaimCount(query: Omit<ClaimListQuery, 'first' | 'skip' | 'orderBy' | 'orderDirection'>): Promise<number> {
    const where: string[] = [];
    
    if (query.agentId !== undefined) {
      where.push(`agentId: "${query.agentId}"`);
    }
    if (query.claimant) {
      where.push(`claimant: "${query.claimant.toLowerCase()}"`);
    }
    if (query.councilId) {
      where.push(`councilId: "${query.councilId}"`);
    }
    if (query.status) {
      where.push(`status: ${query.status}`);
    }

    // The Graph doesn't have a count, so we fetch IDs only
    const gql = `
      query CountClaims {
        claims(
          first: 10000
          ${where.length > 0 ? `where: { ${where.join(', ')} }` : ''}
        ) {
          claimId
        }
      }
    `;

    const data = await this.query<{ claims: any[] }>(gql);
    return data.claims.length;
  }

  async getAgents(query: AgentListQuery): Promise<AgentListItem[]> {
    const where: string[] = [];
    
    if (query.isValidated !== undefined) {
      where.push(`isValidated: ${query.isValidated}`);
    }
    if (query.hasActiveTerms !== undefined) {
      where.push(`hasActiveTerms: ${query.hasActiveTerms}`);
    }
    if (query.minCollateral !== undefined) {
      where.push(`collateralBalance_gte: "${query.minCollateral}"`);
    }

    const first = query.first ?? 100;
    const skip = query.skip ?? 0;

    const gql = `
      query GetAgents($first: Int!, $skip: Int!) {
        agents(
          first: $first
          skip: $skip
          orderBy: collateralBalance
          orderDirection: desc
          ${where.length > 0 ? `where: { ${where.join(', ')} }` : ''}
        ) {
          agentId
          owner
          collateralBalance
          isValidated
          hasActiveTerms
          totalClaims
          pendingClaims
        }
      }
    `;

    const data = await this.query<{ agents: any[] }>(gql, { first, skip });

    return data.agents.map(a => ({
      agentId: BigInt(a.agentId),
      owner: a.owner as `0x${string}`,
      collateralBalance: BigInt(a.collateralBalance),
      isValidated: a.isValidated,
      hasActiveTerms: a.hasActiveTerms,
      totalClaims: a.totalClaims,
      pendingClaims: a.pendingClaims,
    }));
  }

  async getCouncilMembers(query: CouncilMemberQuery): Promise<CouncilMemberItem[]> {
    const where: string[] = [`councilId: "${query.councilId}"`];
    
    if (query.activeOnly) {
      where.push('active: true');
    }

    const gql = `
      query GetCouncilMembers {
        councilMembers(
          first: 1000
          where: { ${where.join(', ')} }
        ) {
          address
          councilId
          joinedAt
          active
          claimsVoted
        }
      }
    `;

    const data = await this.query<{ councilMembers: any[] }>(gql);

    return data.councilMembers.map(m => ({
      address: m.address as `0x${string}`,
      councilId: m.councilId as `0x${string}`,
      joinedAt: BigInt(m.joinedAt),
      active: m.active,
      claimsVoted: m.claimsVoted,
    }));
  }

  async getVotes(query: VoteListQuery): Promise<VoteItem[]> {
    const where: string[] = [];
    
    if (query.claimId !== undefined) {
      where.push(`claimId: "${query.claimId}"`);
    }
    if (query.voter) {
      where.push(`voter: "${query.voter.toLowerCase()}"`);
    }
    if (query.councilId) {
      where.push(`councilId: "${query.councilId}"`);
    }

    const gql = `
      query GetVotes {
        votes(
          first: 1000
          orderBy: votedAt
          orderDirection: desc
          ${where.length > 0 ? `where: { ${where.join(', ')} }` : ''}
        ) {
          claimId
          voter
          vote
          approvedAmount
          reasoning
          votedAt
        }
      }
    `;

    const data = await this.query<{ votes: any[] }>(gql);

    return data.votes.map(v => ({
      claimId: BigInt(v.claimId),
      voter: v.voter as `0x${string}`,
      vote: v.vote,
      approvedAmount: BigInt(v.approvedAmount),
      reasoning: v.reasoning,
      votedAt: BigInt(v.votedAt),
    }));
  }

  async getProtocolStats(): Promise<{
    totalAgents: number;
    validatedAgents: number;
    totalCollateral: bigint;
    totalClaims: number;
    totalPaidOut: bigint;
  }> {
    const gql = `
      query GetProtocolStats {
        protocolStats(id: "1") {
          totalAgents
          validatedAgents
          totalCollateral
          totalClaims
          totalPaidOut
        }
      }
    `;

    const data = await this.query<{ protocolStats: any }>(gql);
    const stats = data.protocolStats;

    return {
      totalAgents: stats?.totalAgents ?? 0,
      validatedAgents: stats?.validatedAgents ?? 0,
      totalCollateral: BigInt(stats?.totalCollateral ?? '0'),
      totalClaims: stats?.totalClaims ?? 0,
      totalPaidOut: BigInt(stats?.totalPaidOut ?? '0'),
    };
  }
}
