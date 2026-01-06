import { useParams, Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { Bot, Shield, Coins, FileText, AlertTriangle, ChevronRight, ExternalLink } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, Badge, Button, StatCard, LoadingState, Alert } from '../components/ui'
import { useAgent } from '../hooks/useAgents'
import { formatUsdc, getAddressUrl } from '../lib/utils'
import { CONTRACTS } from '../config/contracts'

export default function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>()
  const { address } = useAccount()
  const { agent, conditions, isLoading, exists } = useAgent(agentId)

  if (isLoading) {
    return <LoadingState message="Loading agent details..." />
  }

  if (!exists) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <Bot className="w-16 h-16 text-surface-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-surface-100 mb-2">Agent Not Found</h2>
        <p className="text-surface-400 mb-6">Agent #{agentId} does not exist.</p>
        <Link to="/agents"><Button variant="secondary">Back to Agents</Button></Link>
      </div>
    )
  }

  const isOwner = address && agent?.owner && address.toLowerCase() === agent.owner.toLowerCase()
  const isValidated = agent?.validation?.isValid ?? false
  const collateralBalance = agent?.collateral?.balance ?? BigInt(0)
  const lockedAmount = agent?.collateral?.lockedAmount ?? BigInt(0)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
            <Bot className="w-7 h-7 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-100">Agent #{agentId}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={isValidated ? 'success' : 'neutral'}>
                {isValidated ? 'Validated' : 'Not Validated'}
              </Badge>
              {isOwner && <Badge variant="primary">Owner</Badge>}
            </div>
          </div>
        </div>
        
        <a href={getAddressUrl(CONTRACTS.erc8004Registry)} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm">
            <ExternalLink className="w-4 h-4 mr-2" /> View on Explorer
          </Button>
        </a>
      </div>

      {!isOwner && (
        <Alert variant="warning" title="View Only">
          You are viewing an agent you don't own. You cannot make changes.
        </Alert>
      )}

      {/* Validation Status */}
      <ValidationStatusCard isValidated={isValidated} conditions={conditions} />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Collateral" value={`${formatUsdc(collateralBalance)} USDC`} icon={<Coins className="w-5 h-5" />} />
        <StatCard label="Available" value={`${formatUsdc(collateralBalance - lockedAmount)} USDC`} subValue="after locks" icon={<Coins className="w-5 h-5" />} />
        <StatCard label="Terms Version" value={conditions?.hasActiveTerms ? '1' : 'None'} icon={<FileText className="w-5 h-5" />} />
        <StatCard label="Pending Claims" value={0} icon={<AlertTriangle className="w-5 h-5" />} />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to={`/agents/${agentId}/collateral`}>
          <Card className="hover:border-surface-700 transition-colors h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Coins className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-medium text-surface-100">Manage Collateral</h3>
                  <p className="text-sm text-surface-400">Deposit or withdraw USDC</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-surface-500" />
            </div>
          </Card>
        </Link>

        <Link to={`/agents/${agentId}/terms`}>
          <Card className="hover:border-surface-700 transition-colors h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-success" />
                </div>
                <div>
                  <h3 className="font-medium text-surface-100">Terms & Conditions</h3>
                  <p className="text-sm text-surface-400">Register or update T&C</p>
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

function ValidationStatusCard({ 
  isValidated, 
  conditions 
}: { 
  isValidated: boolean
  conditions?: { hasMinimumCollateral: boolean; hasActiveTerms: boolean; isOwnerValid: boolean; councilIsActive: boolean }
}) {
  const allMet = conditions && Object.values(conditions).every(Boolean)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isValidated ? 'bg-success/10' : 'bg-surface-800'}`}>
              <Shield className={`w-5 h-5 ${isValidated ? 'text-success' : 'text-surface-400'}`} />
            </div>
            <div>
              <CardTitle>Validation Status</CardTitle>
              <CardDescription>
                {isValidated ? 'Your agent is validated and discoverable' : allMet ? 'All conditions met' : 'Complete the following to get validated'}
              </CardDescription>
            </div>
          </div>
          <Badge variant={isValidated ? 'success' : allMet ? 'warning' : 'neutral'}>
            {isValidated ? 'Valid' : allMet ? 'Pending' : 'Not Valid'}
          </Badge>
        </div>
      </CardHeader>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <ConditionItem label="Minimum Collateral" met={conditions?.hasMinimumCollateral ?? false} hint="Deposit at least 100 USDC" />
        <ConditionItem label="Active Terms" met={conditions?.hasActiveTerms ?? false} hint="Register your T&C document" />
        <ConditionItem label="Owner Valid" met={conditions?.isOwnerValid ?? false} hint="Ownership verified" />
        <ConditionItem label="Council Active" met={conditions?.councilIsActive ?? false} hint="Selected council must be active" />
      </div>
    </Card>
  )
}

function ConditionItem({ label, met, hint }: { label: string; met: boolean; hint?: string }) {
  return (
    <div className={`p-3 rounded-lg ${met ? 'bg-success/10' : 'bg-surface-800/50'}`}>
      <div className="flex items-center gap-2">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${met ? 'bg-success text-white' : 'bg-surface-700 text-surface-400'}`}>
          {met ? '✓' : '○'}
        </div>
        <span className={`font-medium ${met ? 'text-success-light' : 'text-surface-300'}`}>{label}</span>
      </div>
      {hint && !met && <p className="text-xs text-surface-500 mt-1 ml-7">{hint}</p>}
    </div>
  )
}
