// Placeholder pages for Phase 1
// These will be fully implemented in later phases

import { useParams } from 'react-router-dom'
import { Coins, FileText, AlertTriangle, Link2, Shield, Construction } from 'lucide-react'
import { Card } from '../components/ui'

function PlaceholderPage({ title, description, icon: Icon }: { 
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center mx-auto mb-4">
            <Icon className="w-8 h-8 text-surface-400" />
          </div>
          <h2 className="text-xl font-semibold text-surface-100 mb-2">{title}</h2>
          <p className="text-surface-400 max-w-md mx-auto">{description}</p>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-surface-500">
            <Construction className="w-4 h-4" />
            Coming in Phase 2
          </div>
        </div>
      </Card>
    </div>
  )
}

export function CollateralPage() {
  const { agentId } = useParams()
  return (
    <PlaceholderPage
      title="Collateral Management"
      description={`Deposit, withdraw, and manage collateral for Agent #${agentId}. Top up collateral, initiate withdrawals with grace period, and view balance history.`}
      icon={Coins}
    />
  )
}

export function TermsPage() {
  const { agentId } = useParams()
  return (
    <PlaceholderPage
      title="Terms & Conditions"
      description={`Register and update Terms & Conditions for Agent #${agentId}. Upload T&C document, select council, and verify content hash.`}
      icon={FileText}
    />
  )
}

export function ClaimsPage() {
  const { agentId } = useParams()
  return (
    <PlaceholderPage
      title="Claims"
      description={`View and manage claims against Agent #${agentId}. See pending claims, their status, and submit counter-evidence.`}
      icon={AlertTriangle}
    />
  )
}

export function IntegratePage() {
  const { agentId } = useParams()
  return (
    <PlaceholderPage
      title="A2A Integration"
      description={`Generate the Trustful extension for Agent #${agentId}'s Agent Card. Get API endpoint URL and integration instructions.`}
      icon={Link2}
    />
  )
}

export function CouncilsPage() {
  return (
    <PlaceholderPage
      title="Browse Councils"
      description="Explore available councils and their verticals. Learn about requirements, fee structures, and member counts."
      icon={Shield}
    />
  )
}
