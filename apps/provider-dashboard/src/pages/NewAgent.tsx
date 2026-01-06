import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { Bot, Plus, Download, ArrowRight, Check } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, Button, Input, Alert, Tabs } from '../components/ui'
import { CONTRACTS, Erc8004RegistryAbi } from '../config/contracts'
import { useAgentOwner } from '../hooks/useAgents'

type Tab = 'mint' | 'import'

export default function NewAgentPage() {
  const [activeTab, setActiveTab] = useState<Tab>('mint')

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-100">Add Agent</h1>
        <p className="text-surface-400 mt-1">Mint a new ERC-8004 agent or import an existing one.</p>
      </div>

      <Tabs
        tabs={[
          { id: 'mint', label: 'Mint New Agent' },
          { id: 'import', label: 'Import Existing' },
        ]}
        activeTab={activeTab}
        onChange={(tab) => setActiveTab(tab as Tab)}
      />

      {activeTab === 'mint' ? <MintAgentForm /> : <ImportAgentForm />}
    </div>
  )
}

function MintAgentForm() {
  const navigate = useNavigate()
  const { address } = useAccount()
  const [mintedId, setMintedId] = useState<bigint | null>(null)
  const [expectedId, setExpectedId] = useState<bigint | null>(null)
  
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const { data: nextTokenId } = useReadContract({
    address: CONTRACTS.erc8004Registry,
    abi: Erc8004RegistryAbi,
    functionName: 'nextTokenId',
  })

  useEffect(() => {
    if (isSuccess && expectedId !== null) {
      setMintedId(expectedId)
    }
  }, [isSuccess, expectedId])

  const handleMint = () => {
    if (!address || nextTokenId === undefined) return
    // Capture the ID BEFORE minting
    setExpectedId(nextTokenId)
    writeContract({
      address: CONTRACTS.erc8004Registry,
      abi: Erc8004RegistryAbi,
      functionName: 'mintAuto',
      args: [address],
    })
  }

  if (mintedId !== null) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-success" />
          </div>
          <h3 className="text-xl font-semibold text-surface-100 mb-2">Agent Created!</h3>
          <p className="text-surface-400 mb-6">Your new agent has been minted with ID #{mintedId.toString()}</p>
          <Button onClick={() => navigate(`/agents/${mintedId}`)}>
            Go to Agent <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <Plus className="w-5 h-5 text-accent" />
          </div>
          <div>
            <CardTitle>Mint New Agent</CardTitle>
            <CardDescription>Create a new ERC-8004 agent on Base Sepolia</CardDescription>
          </div>
        </div>
      </CardHeader>

      <div className="mt-6 space-y-6">
        <div className="p-4 bg-surface-800/50 rounded-lg">
          <p className="text-sm text-surface-400 mb-2">Preview</p>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
              <Bot className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="font-medium text-surface-100">Agent #{nextTokenId?.toString() ?? '...'}</p>
              <p className="text-sm text-surface-500">
                Owner: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '...'}
              </p>
            </div>
          </div>
        </div>

        <Alert variant="info">
          Minting creates an ERC-721 token in the ERC-8004 Identity Registry.
          You can then deposit collateral and register terms to get validated.
        </Alert>

        {writeError && (
          <Alert variant="danger" title="Transaction Failed">
            {writeError.message}
          </Alert>
        )}

        <Button onClick={handleMint} loading={isPending || isConfirming} className="w-full" size="lg">
          {isPending ? 'Confirm in wallet...' : isConfirming ? 'Minting...' : 'Mint Agent'}
        </Button>
      </div>
    </Card>
  )
}

function ImportAgentForm() {
  const navigate = useNavigate()
  const { address } = useAccount()
  const [agentId, setAgentId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { owner, isLoading, exists } = useAgentOwner(agentId || undefined)
  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase()

  const handleImport = () => {
    if (!agentId) { setError('Please enter an agent ID'); return }
    if (!exists) { setError('Agent does not exist'); return }
    if (!isOwner) { setError('You do not own this agent'); return }
    navigate(`/agents/${agentId}`)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
            <Download className="w-5 h-5 text-success" />
          </div>
          <div>
            <CardTitle>Import Existing Agent</CardTitle>
            <CardDescription>Add an agent you already own</CardDescription>
          </div>
        </div>
      </CardHeader>

      <div className="mt-6 space-y-6">
        <Input
          label="Agent ID"
          placeholder="Enter agent token ID"
          value={agentId}
          onChange={(e) => { setAgentId(e.target.value); setError(null) }}
          error={error || undefined}
          hint="The ERC-721 token ID of your agent"
        />

        {agentId && !isLoading && exists && (
          <div className="p-4 bg-surface-800/50 rounded-lg">
            <p className="text-sm text-surface-400 mb-2">Agent Found</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-surface-100">Agent #{agentId}</p>
                  <p className="text-sm text-surface-500">
                    Owner: {owner ? `${owner.slice(0, 6)}...${owner.slice(-4)}` : '...'}
                  </p>
                </div>
              </div>
              {isOwner ? (
                <span className="text-success text-sm flex items-center gap-1"><Check className="w-4 h-4" /> You own this</span>
              ) : (
                <span className="text-danger text-sm">Not your agent</span>
              )}
            </div>
          </div>
        )}

        <Button
          onClick={handleImport}
          disabled={!agentId || isLoading || !isOwner}
          loading={isLoading}
          className="w-full"
          size="lg"
        >
          Import Agent
        </Button>
      </div>
    </Card>
  )
}
