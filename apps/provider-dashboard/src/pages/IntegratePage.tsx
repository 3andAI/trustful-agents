import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { 
  ArrowLeft, 
  Link2, 
  Copy, 
  Check, 
  ExternalLink,
  Code,
  Globe,
  Shield,
  AlertCircle,
  FileJson,
  Download,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, Button, Badge, Alert } from '../components/ui'
import { useAgent, useAgentOwner } from '../hooks/useAgents'
import { useAgentTerms, useCouncil } from '../hooks/useTerms'
import { formatUsdc, copyToClipboard } from '../lib/utils'
import { CONTRACTS, API_BASE_URL, CHAIN_ID, BLOCK_EXPLORER_URL } from '../config/contracts'
import type { TrustfulExtension } from '../types'

export default function IntegratePage() {
  const { agentId } = useParams<{ agentId: string }>()
  const { address } = useAccount()

  const { agent, conditions, isLoading } = useAgent(agentId)
  const { owner } = useAgentOwner(agentId)
  const { terms } = useAgentTerms(agentId)
  const { council } = useCouncil(terms?.councilId)

  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase()
  const isValidated = agent?.validation?.isValid ?? false

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-surface-100">Agent not found</h2>
        <Link to="/dashboard" className="text-accent hover:underline mt-2 block">
          Back to dashboard
        </Link>
      </div>
    )
  }

  // Build the TrustfulExtension object
  const trustfulExtension: TrustfulExtension = {
    version: '1.0',
    validatorAddress: CONTRACTS.trustfulValidator,
    collateral: {
      amount: formatUsdc(agent.collateral?.balance ?? BigInt(0)),
      asset: 'USDC',
      withdrawalPending: agent.collateral?.withdrawalPending ?? false,
    },
    terms: {
      hash: terms?.contentHash ?? '0x0',
      uri: terms?.contentUri ?? '',
      councilId: terms?.councilId ?? '0x0',
    },
    validation: {
      status: isValidated ? 'valid' : 'invalid',
      issuedAt: agent.validation?.issuedAt ? new Date(Number(agent.validation.issuedAt) * 1000).toISOString() : undefined,
    },
    claims: {
      total: 0,
      approved: 0,
      pending: 0,
    },
  }

  // API endpoints
  const validationEndpoint = `${API_BASE_URL}/v1/agents/${agentId}/validation.json`
  const trustInfoEndpoint = `${API_BASE_URL}/v1/agents/${agentId}/trust-info.json`
  const agentCardEndpoint = `${API_BASE_URL}/v1/agents/${agentId}/agent-card.json`
  const imageEndpoint = `${API_BASE_URL}/v1/agents/${agentId}/image.svg`

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to={`/agents/${agentId}`}
          className="p-2 rounded-lg bg-surface-800 hover:bg-surface-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-surface-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-surface-100">A2A Integration</h1>
          <p className="text-surface-400">Agent #{agentId}</p>
        </div>
      </div>

      {/* Validation Status */}
      {!isValidated && (
        <Alert variant="warning" title="Agent Not Validated">
          This agent must be validated before it can be integrated with A2A Protocol.
          Complete all validation requirements first.
        </Alert>
      )}

      {/* Quick Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="text-center">
          <Shield className={`w-8 h-8 mx-auto mb-2 ${isValidated ? 'text-success' : 'text-surface-500'}`} />
          <p className="text-sm text-surface-400">Status</p>
          <p className={`font-semibold ${isValidated ? 'text-success' : 'text-surface-300'}`}>
            {isValidated ? 'Validated' : 'Not Validated'}
          </p>
        </Card>
        <Card className="text-center">
          <Globe className="w-8 h-8 mx-auto mb-2 text-accent" />
          <p className="text-sm text-surface-400">Network</p>
          <p className="font-semibold text-surface-100">Eth Sepolia</p>
        </Card>
        <Card className="text-center">
          <Link2 className="w-8 h-8 mx-auto mb-2 text-accent" />
          <p className="text-sm text-surface-400">Council</p>
          <p className="font-semibold text-surface-100">{council?.name || 'Not assigned'}</p>
        </Card>
      </div>

      {/* API Endpoints */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Globe className="w-5 h-5 text-accent" />
            </div>
            <div>
              <CardTitle>API Endpoints</CardTitle>
              <CardDescription>Use these endpoints to query agent trust data</CardDescription>
            </div>
          </div>
        </CardHeader>

        <div className="mt-4 space-y-4">
          <EndpointRow 
            label="Agent Card (tokenURI target)"
            url={agentCardEndpoint}
            description="A2A-compatible Agent Card metadata (NFT standard format)"
            showDownload={true}
          />
          <EndpointRow 
            label="Agent Image"
            url={imageEndpoint}
            description="Dynamic SVG badge showing validation status"
          />
          <EndpointRow 
            label="Validation Response (ERC-8004)"
            url={validationEndpoint}
            description="Returns the ERC-8004 validation status"
          />
          <EndpointRow 
            label="Trust Info (detailed)"
            url={trustInfoEndpoint}
            description="Returns detailed trust info for integrations"
          />
        </div>
      </Card>

      {/* Trustful Extension JSON */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <FileJson className="w-5 h-5 text-success" />
              </div>
              <div>
                <CardTitle>Trustful Extension</CardTitle>
                <CardDescription>Add this to your Agent Card's extensions</CardDescription>
              </div>
            </div>
            <CopyButton text={JSON.stringify({ trustful: trustfulExtension }, null, 2)} />
          </div>
        </CardHeader>

        <div className="mt-4">
          <pre className="bg-surface-900 rounded-lg p-4 overflow-x-auto text-sm">
            <code className="text-surface-300">
              {JSON.stringify({ trustful: trustfulExtension }, null, 2)}
            </code>
          </pre>
        </div>
      </Card>

      {/* Integration Code */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Code className="w-5 h-5 text-accent" />
            </div>
            <div>
              <CardTitle>Integration Examples</CardTitle>
              <CardDescription>Code snippets for verifying agent trust</CardDescription>
            </div>
          </div>
        </CardHeader>

        <div className="mt-4 space-y-6">
          {/* JavaScript Example */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-surface-200">JavaScript / TypeScript</h4>
              <CopyButton text={jsCodeSnippet(agentId!, validationEndpoint)} />
            </div>
            <pre className="bg-surface-900 rounded-lg p-4 overflow-x-auto text-sm">
              <code className="text-surface-300">
                {jsCodeSnippet(agentId!, validationEndpoint)}
              </code>
            </pre>
          </div>

          {/* On-chain Verification */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-surface-200">On-Chain Verification (Solidity)</h4>
              <CopyButton text={soliditySnippet()} />
            </div>
            <pre className="bg-surface-900 rounded-lg p-4 overflow-x-auto text-sm">
              <code className="text-surface-300">
                {soliditySnippet()}
              </code>
            </pre>
          </div>

          {/* Direct Contract Call */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-surface-200">Direct Contract Query (viem)</h4>
              <CopyButton text={viemSnippet(agentId!)} />
            </div>
            <pre className="bg-surface-900 rounded-lg p-4 overflow-x-auto text-sm">
              <code className="text-surface-300">
                {viemSnippet(agentId!)}
              </code>
            </pre>
          </div>
        </div>
      </Card>

      {/* Contract Addresses */}
      <Card>
        <CardHeader>
          <CardTitle>Contract Addresses</CardTitle>
          <CardDescription>Eth Sepolia (Chain ID: {CHAIN_ID})</CardDescription>
        </CardHeader>

        <div className="mt-4 space-y-3">
          <ContractRow label="TrustfulValidator" address={CONTRACTS.trustfulValidator} />
          <ContractRow label="CollateralVault" address={CONTRACTS.collateralVault} />
          <ContractRow label="TermsRegistry" address={CONTRACTS.termsRegistry} />
          <ContractRow label="CouncilRegistry" address={CONTRACTS.councilRegistry} />
          <ContractRow label="ERC-8004 Registry" address={CONTRACTS.erc8004Registry} />
        </div>
      </Card>
    </div>
  )
}

// =============================================================================
// Helper Components
// =============================================================================

function EndpointRow({ label, url, description, showDownload = false }: { label: string; url: string; description: string; showDownload?: boolean }) {
  const handleDownload = async () => {
    try {
      const response = await fetch(url)
      const data = await response.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = url.split('/').pop() || 'agent-card.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  return (
    <div className="p-4 rounded-lg bg-surface-800/50">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-surface-200">{label}</p>
          <p className="text-xs text-surface-500 mt-0.5">{description}</p>
          <code className="block mt-2 text-sm text-accent break-all">{url}</code>
        </div>
        <div className="flex items-center gap-2">
          <CopyButton text={url} />
          {showDownload && (
            <Button variant="ghost" size="sm" onClick={handleDownload} title="Download">
              <Download className="w-4 h-4" />
            </Button>
          )}
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </a>
        </div>
      </div>
    </div>
  )
}

function ContractRow({ label, address }: { label: string; address: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-surface-800/50">
      <div>
        <p className="text-sm text-surface-400">{label}</p>
        <code className="text-sm text-surface-200 font-mono">{address}</code>
      </div>
      <div className="flex items-center gap-2">
        <CopyButton text={address} />
        <a href={`${BLOCK_EXPLORER_URL}/address/${address}`} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm">
            <ExternalLink className="w-4 h-4" />
          </Button>
        </a>
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy}>
      {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
    </Button>
  )
}

// =============================================================================
// Code Snippets
// =============================================================================

function jsCodeSnippet(agentId: string, endpoint: string): string {
  return `// Check if an agent is validated
async function isAgentTrusted(agentId: string): Promise<boolean> {
  const response = await fetch(
    '${endpoint}'
  );
  
  if (!response.ok) return false;
  
  const data = await response.json();
  return data.validation?.status === 'valid';
}

// Usage
const trusted = await isAgentTrusted('${agentId}');
console.log('Agent is trusted:', trusted);`
}

function soliditySnippet(): string {
  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITrustfulValidator {
    function isValidated(uint256 agentId) external view returns (bool);
}

contract MyContract {
    ITrustfulValidator public validator;
    
    constructor(address _validator) {
        validator = ITrustfulValidator(_validator);
    }
    
    function requireTrustedAgent(uint256 agentId) internal view {
        require(
            validator.isValidated(agentId),
            "Agent not validated"
        );
    }
}`
}

function viemSnippet(agentId: string): string {
  return `import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

const client = createPublicClient({
  chain: sepolia,
  transport: http(),
});

const isValidated = await client.readContract({
  address: '${CONTRACTS.trustfulValidator}',
  abi: [{
    type: 'function',
    name: 'isValidated',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  }],
  functionName: 'isValidated',
  args: [${agentId}n],
});

console.log('Agent ${agentId} validated:', isValidated);`
}
