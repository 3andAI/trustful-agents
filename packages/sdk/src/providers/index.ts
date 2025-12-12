/**
 * Data Provider Abstraction
 * 
 * Allows switching between:
 * - RPC: Direct contract reads (testnet, simple queries)
 * - Subgraph: GraphQL queries via The Graph (mainnet, complex queries)
 * 
 * Usage:
 *   const provider = createDataProvider({ mode: 'rpc', ... });
 *   const claims = await provider.getClaimsByAgent(agentId);
 * 
 * Switch to subgraph for mainnet:
 *   const provider = createDataProvider({ mode: 'subgraph', subgraphUrl: '...' });
 */

export type DataProviderMode = 'rpc' | 'subgraph';

export interface DataProviderConfig {
  mode: DataProviderMode;
  // RPC mode config
  rpcUrl?: string;
  contracts?: {
    collateralVault: `0x${string}`;
    termsRegistry: `0x${string}`;
    trustfulValidator: `0x${string}`;
    councilRegistry: `0x${string}`;
    claimsManager: `0x${string}`;
    rulingExecutor: `0x${string}`;
  };
  // Subgraph mode config
  subgraphUrl?: string;
}

/**
 * Query types for complex/aggregated data that benefit from indexing
 */
export interface ClaimListQuery {
  agentId?: bigint;
  claimant?: `0x${string}`;
  councilId?: `0x${string}`;
  status?: 'Filed' | 'Evidence' | 'Voting' | 'Approved' | 'Rejected' | 'Executed' | 'Cancelled';
  first?: number;
  skip?: number;
  orderBy?: 'filedAt' | 'claimedAmount';
  orderDirection?: 'asc' | 'desc';
}

export interface AgentListQuery {
  isValidated?: boolean;
  hasActiveTerms?: boolean;
  minCollateral?: bigint;
  first?: number;
  skip?: number;
}

export interface CouncilMemberQuery {
  councilId: `0x${string}`;
  activeOnly?: boolean;
}

export interface VoteListQuery {
  claimId?: bigint;
  voter?: `0x${string}`;
  councilId?: `0x${string}`;
}

/**
 * Result types
 */
export interface ClaimListItem {
  claimId: bigint;
  agentId: bigint;
  claimant: `0x${string}`;
  claimedAmount: bigint;
  approvedAmount: bigint;
  status: number;
  filedAt: bigint;
  evidenceDeadline: bigint;
  votingDeadline: bigint;
  councilId: `0x${string}`;
}

export interface AgentListItem {
  agentId: bigint;
  owner: `0x${string}`;
  collateralBalance: bigint;
  isValidated: boolean;
  hasActiveTerms: boolean;
  totalClaims: number;
  pendingClaims: number;
}

export interface CouncilMemberItem {
  address: `0x${string}`;
  councilId: `0x${string}`;
  joinedAt: bigint;
  active: boolean;
  claimsVoted: number;
}

export interface VoteItem {
  claimId: bigint;
  voter: `0x${string}`;
  vote: number;
  approvedAmount: bigint;
  reasoning: string;
  votedAt: bigint;
}

/**
 * Data Provider Interface
 * 
 * Methods that benefit from indexing (lists, aggregations, filters)
 * For simple single-entity reads, use the TrustfulClient directly
 */
export interface DataProvider {
  mode: DataProviderMode;
  
  // Claims queries
  getClaims(query: ClaimListQuery): Promise<ClaimListItem[]>;
  getClaimCount(query: Omit<ClaimListQuery, 'first' | 'skip' | 'orderBy' | 'orderDirection'>): Promise<number>;
  
  // Agent queries  
  getAgents(query: AgentListQuery): Promise<AgentListItem[]>;
  
  // Council queries
  getCouncilMembers(query: CouncilMemberQuery): Promise<CouncilMemberItem[]>;
  
  // Vote queries
  getVotes(query: VoteListQuery): Promise<VoteItem[]>;
  
  // Protocol stats
  getProtocolStats(): Promise<{
    totalAgents: number;
    validatedAgents: number;
    totalCollateral: bigint;
    totalClaims: number;
    totalPaidOut: bigint;
  }>;
}

export { RpcDataProvider } from './rpc';
export { SubgraphDataProvider } from './subgraph';
export { createDataProvider } from './factory';
