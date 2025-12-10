import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { getValidationResponse } from "../services/validation";

/**
 * Validation Response Routes
 *
 * These endpoints serve the ERC-8004 validation responses.
 * The URL pattern is deterministic: /v1/agents/{agentId}/validation.json
 */
export async function validationRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  // Get validation response for an agent
  // URL pattern: GET /v1/agents/{agentId}/validation.json
  fastify.get<{
    Params: { agentId: string };
  }>("/agents/:agentId/validation.json", async (request, reply) => {
    const { agentId } = request.params;

    try {
      const response = await getValidationResponse(agentId);

      if (!response) {
        return reply.status(404).send({
          error: "not_found",
          message: `No validation found for agent ${agentId}`,
        });
      }

      return reply
        .header("Content-Type", "application/json")
        .header("Cache-Control", "public, max-age=60")
        .send(response);
    } catch (error) {
      fastify.log.error(error, `Error fetching validation for agent ${agentId}`);
      return reply.status(500).send({
        error: "internal_error",
        message: "Failed to fetch validation response",
      });
    }
  });

  // Get trust info for A2A Agent Card extension
  // URL pattern: GET /v1/agents/{agentId}/trust-info.json
  fastify.get<{
    Params: { agentId: string };
  }>("/agents/:agentId/trust-info.json", async (request, reply) => {
    const { agentId } = request.params;

    try {
      const trustInfo = await getTrustInfo(agentId);

      if (!trustInfo) {
        return reply.status(404).send({
          error: "not_found",
          message: `No trust info found for agent ${agentId}`,
        });
      }

      return reply
        .header("Content-Type", "application/json")
        .header("Cache-Control", "public, max-age=60")
        .send(trustInfo);
    } catch (error) {
      fastify.log.error(error, `Error fetching trust info for agent ${agentId}`);
      return reply.status(500).send({
        error: "internal_error",
        message: "Failed to fetch trust info",
      });
    }
  });

  // List all validated agents (with pagination)
  fastify.get<{
    Querystring: { limit?: string; offset?: string; minCollateral?: string };
  }>("/agents", async (request, reply) => {
    const limit = Math.min(parseInt(request.query.limit || "20", 10), 100);
    const offset = parseInt(request.query.offset || "0", 10);
    const minCollateral = request.query.minCollateral
      ? BigInt(request.query.minCollateral)
      : undefined;

    try {
      const agents = await listValidatedAgents({ limit, offset, minCollateral });

      return reply.send({
        agents,
        pagination: {
          limit,
          offset,
          total: agents.length,
        },
      });
    } catch (error) {
      fastify.log.error(error, "Error listing agents");
      return reply.status(500).send({
        error: "internal_error",
        message: "Failed to list agents",
      });
    }
  });
}

// Placeholder implementations - will be connected to subgraph/contracts
async function getTrustInfo(agentId: string): Promise<TrustInfo | null> {
  // TODO: Query subgraph or contracts
  console.log(`Getting trust info for agent ${agentId}`);
  return null;
}

async function listValidatedAgents(_params: {
  limit: number;
  offset: number;
  minCollateral?: bigint;
}): Promise<AgentSummary[]> {
  // TODO: Query subgraph
  return [];
}

// Types
interface TrustInfo {
  version: string;
  agentId: string;
  validatorAddress: string;
  collateral: {
    amount: string;
    asset: string;
    vaultAddress: string;
  };
  terms: {
    hash: string;
    uri: string;
    maxPayoutPerClaim: string;
    councilId: string;
  };
  validation: {
    status: "valid" | "invalid" | "revoked";
    issuedAt: string;
    requestHash: string;
  };
  claims: {
    total: number;
    approved: number;
    pending: number;
  };
}

interface AgentSummary {
  agentId: string;
  owner: string;
  collateralAmount: string;
  isValidated: boolean;
  pendingClaims: number;
}
