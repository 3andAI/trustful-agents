import { Router } from 'express';
import type { Request, Response } from 'express';
import { formatUnits } from 'viem';
import { getAgentMetadata } from '../services/agents.js';
import {
  CONTRACTS,
  CHAIN_ID,
  API_URL,
  DASHBOARD_URLS,
  publicClient,
  TrustfulValidatorAbi,
  CollateralVaultAbi,
  TermsRegistryAbi,
} from '../config/index.js';

const router = Router();

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /v1/agents/:agentId/agent-card.json
 * A2A Protocol Agent Card format
 * This is what tokenURI should point to
 */
router.get('/agents/:agentId/agent-card.json', async (req: Request, res: Response) => {
  const { agentId } = req.params;

  try {
    console.log(`Fetching agent card for agent ${agentId}`);
    console.log(`Using collateral vault: ${CONTRACTS.collateralVault}`);
    
    // Fetch metadata from DB and chain data in parallel
    const [metadata, isValidated, validation, collateral, terms] = await Promise.all([
      getAgentMetadata(agentId),
      publicClient.readContract({
        address: CONTRACTS.trustfulValidator,
        abi: TrustfulValidatorAbi,
        functionName: 'isValidated',
        args: [BigInt(agentId)],
      }),
      publicClient.readContract({
        address: CONTRACTS.trustfulValidator,
        abi: TrustfulValidatorAbi,
        functionName: 'getValidationRecord',
        args: [BigInt(agentId)],
      }).catch((err) => { console.log('getValidationRecord error:', err); return null; }),
      publicClient.readContract({
        address: CONTRACTS.collateralVault,
        abi: CollateralVaultAbi,
        functionName: 'getAccount',
        args: [BigInt(agentId)],
      }).catch((err) => { console.log('getAccount error:', err); return null; }),
      publicClient.readContract({
        address: CONTRACTS.termsRegistry,
        abi: TermsRegistryAbi,
        functionName: 'getActiveTerms',
        args: [BigInt(agentId)],
      }).catch((err) => { console.log('getActiveTerms error:', err); return null; }),
    ]);

    console.log(`Agent ${agentId} collateral result:`, collateral);
    console.log(`Agent ${agentId} balance:`, collateral ? collateral.balance.toString() : 'null');

    // Determine validation status
    let trustStatus: 'valid' | 'invalid' | 'revoked' = 'invalid';
    if (isValidated) {
      trustStatus = 'valid';
    } else if (validation && validation.revokedAt > 0n) {
      trustStatus = 'revoked';
    }

    // Use DB metadata or fallback to generated values
    const agentName = metadata?.name ?? `Trustful Agent #${agentId}`;
    const agentDescription = metadata?.description ?? 
      `AI Agent registered on Trustful Agents protocol with ${collateral ? formatUnits(collateral.balance, 6) : '0'} USDC collateral`;

    // Build A2A Agent Card format
    const agentCard = {
      // Standard A2A Agent Card fields
      name: agentName,
      description: agentDescription,
      image: `${API_URL}/v1/agents/${agentId}/image.svg`,
      
      // External URLs
      external_url: `${DASHBOARD_URLS.provider}/agents/${agentId}`,
      
      // Standard NFT attributes
      attributes: [
        {
          trait_type: 'Validation Status',
          value: trustStatus,
        },
        {
          trait_type: 'Collateral (USDC)',
          value: collateral ? formatUnits(collateral.balance, 6) : '0',
        },
        {
          trait_type: 'Chain',
          value: 'Eth Sepolia',
        },
        {
          trait_type: 'Validator',
          value: CONTRACTS.trustfulValidator,
        },
        // Add capabilities as attributes if present
        ...(metadata?.capabilities?.map(cap => ({
          trait_type: 'Capability',
          value: cap,
        })) ?? []),
      ],
      
      // Trustful extension (A2A compatible)
      extensions: {
        trustful: {
          version: '1.0',
          validatorAddress: CONTRACTS.trustfulValidator,
          chainId: CHAIN_ID,
          collateral: collateral ? {
            amount: formatUnits(collateral.balance, 6),
            asset: 'USDC',
            vaultAddress: CONTRACTS.collateralVault,
            withdrawalPending: collateral.withdrawalInitiatedAt > 0n,
          } : null,
          terms: terms && terms.active ? {
            hash: terms.contentHash,
            uri: terms.contentUri,
            councilId: terms.councilId,
          } : null,
          validation: {
            status: trustStatus,
            issuedAt: validation && validation.issuedAt > 0n 
              ? new Date(Number(validation.issuedAt) * 1000).toISOString() 
              : null,
          },
          verificationUrl: `${API_URL}/v1/agents/${agentId}/validation.json`,
          // Include website if present
          ...(metadata?.website_url ? { websiteUrl: metadata.website_url } : {}),
        },
      },
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(agentCard);
  } catch (error) {
    console.error(`Error fetching agent card for agent ${agentId}:`, error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch agent card',
    });
  }
});

/**
 * GET /v1/agents/:agentId/image.svg
 * Dynamic SVG badge for the agent
 */
router.get('/agents/:agentId/image.svg', async (req: Request, res: Response) => {
  const { agentId } = req.params;

  try {
    const [metadata, isValidated, collateral] = await Promise.all([
      getAgentMetadata(agentId),
      publicClient.readContract({
        address: CONTRACTS.trustfulValidator,
        abi: TrustfulValidatorAbi,
        functionName: 'isValidated',
        args: [BigInt(agentId)],
      }),
      publicClient.readContract({
        address: CONTRACTS.collateralVault,
        abi: CollateralVaultAbi,
        functionName: 'getAccount',
        args: [BigInt(agentId)],
      }).catch(() => null),
    ]);

    const agentName = metadata?.name ?? `Agent #${agentId}`;
    // Truncate long names for SVG display
    const displayName = agentName.length > 20 ? agentName.substring(0, 18) + '...' : agentName;
    
    const collateralAmount = collateral ? formatUnits(collateral.balance, 6) : '0';
    const statusColor = isValidated ? '#22c55e' : '#ef4444';
    const statusText = isValidated ? 'VALIDATED' : 'NOT VALIDATED';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a0f"/>
      <stop offset="100%" style="stop-color:#12121a"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <rect x="20" y="20" width="360" height="360" rx="20" fill="#1a1a24" stroke="#334155" stroke-width="2"/>
  
  <!-- Logo -->
  <circle cx="200" cy="100" r="40" fill="#3b82f6" opacity="0.2"/>
  <text x="200" y="115" font-family="Arial" font-size="40" fill="#3b82f6" text-anchor="middle">🤖</text>
  
  <!-- Agent Name -->
  <text x="200" y="180" font-family="Arial" font-size="24" font-weight="bold" fill="#f8fafc" text-anchor="middle">${displayName}</text>
  
  <!-- Status Badge -->
  <rect x="120" y="200" width="160" height="36" rx="18" fill="${statusColor}" opacity="0.2"/>
  <circle cx="145" cy="218" r="6" fill="${statusColor}"/>
  <text x="200" y="224" font-family="Arial" font-size="14" font-weight="bold" fill="${statusColor}" text-anchor="middle">${statusText}</text>
  
  <!-- Collateral -->
  <text x="200" y="280" font-family="Arial" font-size="14" fill="#94a3b8" text-anchor="middle">Collateral</text>
  <text x="200" y="310" font-family="Arial" font-size="28" font-weight="bold" fill="#f8fafc" text-anchor="middle">${collateralAmount} USDC</text>
  
  <!-- Footer -->
  <text x="200" y="360" font-family="Arial" font-size="12" fill="#64748b" text-anchor="middle">Trustful Agents · Eth Sepolia</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.send(svg);
  } catch (error) {
    console.error(`Error generating image for agent ${agentId}:`, error);
    res.status(500).send('Error generating image');
  }
});

/**
 * GET /v1/agents/:agentId/validation.json
 * ERC-8004 validation response
 */
router.get('/agents/:agentId/validation.json', async (req: Request, res: Response) => {
  const { agentId } = req.params;

  try {
    const isValidated = await publicClient.readContract({
      address: CONTRACTS.trustfulValidator,
      abi: TrustfulValidatorAbi,
      functionName: 'isValidated',
      args: [BigInt(agentId)],
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=60');
    
    res.json({
      agentId,
      isValidated,
      validatorAddress: CONTRACTS.trustfulValidator,
      chainId: CHAIN_ID,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Error fetching validation for agent ${agentId}:`, error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch validation response',
    });
  }
});

/**
 * GET /v1/agents/:agentId/trust-info.json
 * Detailed trust info for A2A Agent Card extension
 */
router.get('/agents/:agentId/trust-info.json', async (req: Request, res: Response) => {
  const { agentId } = req.params;

  try {
    // Fetch all data in parallel
    const [isValidated, validation, collateral, terms] = await Promise.all([
      publicClient.readContract({
        address: CONTRACTS.trustfulValidator,
        abi: TrustfulValidatorAbi,
        functionName: 'isValidated',
        args: [BigInt(agentId)],
      }),
      publicClient.readContract({
        address: CONTRACTS.trustfulValidator,
        abi: TrustfulValidatorAbi,
        functionName: 'getValidationRecord',
        args: [BigInt(agentId)],
      }).catch(() => null),
      publicClient.readContract({
        address: CONTRACTS.collateralVault,
        abi: CollateralVaultAbi,
        functionName: 'getAccount',
        args: [BigInt(agentId)],
      }).catch(() => null),
      publicClient.readContract({
        address: CONTRACTS.termsRegistry,
        abi: TermsRegistryAbi,
        functionName: 'getActiveTerms',
        args: [BigInt(agentId)],
      }).catch(() => null),
    ]);

    // Determine validation status
    let status: 'valid' | 'invalid' | 'revoked' = 'invalid';
    if (isValidated) {
      status = 'valid';
    } else if (validation && validation.revokedAt > 0n) {
      status = 'revoked';
    }

    const trustInfo = {
      version: '1.0',
      agentId,
      validatorAddress: CONTRACTS.trustfulValidator,
      chainId: CHAIN_ID,
      collateral: collateral ? {
        amount: formatUnits(collateral.balance, 6),
        asset: 'USDC',
        vaultAddress: CONTRACTS.collateralVault,
        withdrawalPending: collateral.withdrawalInitiatedAt > 0n,
      } : null,
      terms: terms && terms.active ? {
        hash: terms.contentHash,
        uri: terms.contentUri,
        councilId: terms.councilId,
        registeredAt: new Date(Number(terms.registeredAt) * 1000).toISOString(),
      } : null,
      validation: {
        status,
        issuedAt: validation && validation.issuedAt > 0n 
          ? new Date(Number(validation.issuedAt) * 1000).toISOString() 
          : null,
        requestHash: validation?.requestHash || null,
      },
      claims: {
        total: 0,
        approved: 0,
        pending: 0,
      },
      timestamp: new Date().toISOString(),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(trustInfo);
  } catch (error) {
    console.error(`Error fetching trust info for agent ${agentId}:`, error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch trust info',
    });
  }
});

/**
 * GET /v1/health
 * API health check
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

export default router;
