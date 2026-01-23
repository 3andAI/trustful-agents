import { queryOne, queryMany, query } from '../db/index.js';

// ============================================================================
// Types
// ============================================================================

export interface AgentMetadata {
  agent_id: string;
  owner_address: string;
  name: string;
  description: string | null;
  capabilities: string[] | null;
  website_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAgentInput {
  agentId: string;
  ownerAddress: string;
  name: string;
  description?: string;
  capabilities?: string[];
  websiteUrl?: string;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  capabilities?: string[];
  websiteUrl?: string;
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Get agent metadata by ID
 */
export async function getAgentMetadata(agentId: string): Promise<AgentMetadata | null> {
  return queryOne<AgentMetadata>(
    `SELECT agent_id, owner_address, name, description, capabilities, website_url, created_at, updated_at
     FROM agents
     WHERE agent_id = $1`,
    [agentId]
  );
}

/**
 * Get all agents for an owner
 */
export async function getAgentsByOwner(ownerAddress: string): Promise<AgentMetadata[]> {
  return queryMany<AgentMetadata>(
    `SELECT agent_id, owner_address, name, description, capabilities, website_url, created_at, updated_at
     FROM agents
     WHERE LOWER(owner_address) = LOWER($1)
     ORDER BY created_at DESC`,
    [ownerAddress]
  );
}

/**
 * Create new agent metadata
 */
export async function createAgentMetadata(input: CreateAgentInput): Promise<AgentMetadata> {
  const result = await queryOne<AgentMetadata>(
    `INSERT INTO agents (agent_id, owner_address, name, description, capabilities, website_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING agent_id, owner_address, name, description, capabilities, website_url, created_at, updated_at`,
    [
      input.agentId,
      input.ownerAddress.toLowerCase(),
      input.name,
      input.description || null,
      input.capabilities || null,
      input.websiteUrl || null,
    ]
  );
  
  if (!result) {
    throw new Error('Failed to create agent metadata');
  }
  
  return result;
}

/**
 * Update agent metadata
 */
export async function updateAgentMetadata(
  agentId: string,
  ownerAddress: string,
  input: UpdateAgentInput
): Promise<AgentMetadata | null> {
  // Build dynamic update query
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(input.name);
  }
  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(input.description || null);
  }
  if (input.capabilities !== undefined) {
    updates.push(`capabilities = $${paramIndex++}`);
    values.push(input.capabilities || null);
  }
  if (input.websiteUrl !== undefined) {
    updates.push(`website_url = $${paramIndex++}`);
    values.push(input.websiteUrl || null);
  }

  if (updates.length === 0) {
    return getAgentMetadata(agentId);
  }

  values.push(agentId);
  values.push(ownerAddress.toLowerCase());

  return queryOne<AgentMetadata>(
    `UPDATE agents
     SET ${updates.join(', ')}
     WHERE agent_id = $${paramIndex++} AND LOWER(owner_address) = LOWER($${paramIndex})
     RETURNING agent_id, owner_address, name, description, capabilities, website_url, created_at, updated_at`,
    values
  );
}

/**
 * Delete agent metadata
 */
export async function deleteAgentMetadata(agentId: string, ownerAddress: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM agents WHERE agent_id = $1 AND LOWER(owner_address) = LOWER($2)`,
    [agentId, ownerAddress]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Check if agent metadata exists
 */
export async function agentMetadataExists(agentId: string): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM agents WHERE agent_id = $1) as exists`,
    [agentId]
  );
  return result?.exists ?? false;
}

/**
 * Get all agents (for council assignment lookup)
 */
export async function getAllAgents(): Promise<AgentMetadata[]> {
  return queryMany<AgentMetadata>(
    `SELECT agent_id, owner_address, name, description, capabilities, website_url, created_at, updated_at
     FROM agents
     ORDER BY agent_id ASC`
  );
}
