import { Navigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { ConnectPrompt } from '../components/wallet'
import { LoadingState } from '../components/ui'
import { useAgents } from '../hooks/useAgents'

/**
 * Landing page - handles mode detection
 * - Not connected → Show connect prompt
 * - No agents → Redirect to new agent page
 * - Has agents → Redirect to dashboard
 */
export default function LandingPage() {
  const { isConnected } = useAccount()
  const { agents, isLoading } = useAgents()

  if (!isConnected) {
    return <ConnectPrompt />
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState message="Loading your agents..." />
      </div>
    )
  }

  if (agents.length === 0) {
    return <Navigate to="/agents/new" replace />
  }

  return <Navigate to="/dashboard" replace />
}
