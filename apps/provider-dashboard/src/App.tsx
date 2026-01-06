import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAccount, useChainId } from 'wagmi'
import { CHAIN_ID } from './config/contracts'
import { ConnectPrompt } from './components/wallet'
import Layout from './components/layout/Layout'
import LandingPage from './pages/Landing'
import DashboardPage from './pages/Dashboard'
import AgentsPage from './pages/Agents'
import NewAgentPage from './pages/NewAgent'
import AgentDetailPage from './pages/AgentDetail'
import { CollateralPage, TermsPage, ClaimsPage, IntegratePage, CouncilsPage } from './pages/Placeholders'
import { Button, Alert } from './components/ui'
import { AlertTriangle } from 'lucide-react'

/**
 * Protected route wrapper
 * - Redirects to connect prompt if not connected
 * - Shows network switch prompt if wrong chain
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  
  if (!isConnected) {
    return <ConnectPrompt />
  }
  
  if (chainId !== CHAIN_ID) {
    return <NetworkSwitchPrompt />
  }
  
  return <>{children}</>
}

function NetworkSwitchPrompt() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-warning/20 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-warning" />
          </div>
          <h1 className="text-2xl font-bold text-surface-100 mb-2">Wrong Network</h1>
          <p className="text-surface-400 mb-6">
            Please switch to Base Sepolia testnet to use the Provider Dashboard.
          </p>
          <Alert variant="info" className="text-left mb-6">
            Chain ID: 84532
          </Alert>
          <Button variant="primary" className="w-full">
            Switch Network
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing - handles mode detection */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Protected routes with layout */}
        <Route element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route path="/dashboard" element={<DashboardPage />} />
          
          {/* Agents */}
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/agents/new" element={<NewAgentPage />} />
          <Route path="/agents/:agentId" element={<AgentDetailPage />} />
          <Route path="/agents/:agentId/collateral" element={<CollateralPage />} />
          <Route path="/agents/:agentId/terms" element={<TermsPage />} />
          <Route path="/agents/:agentId/claims" element={<ClaimsPage />} />
          <Route path="/agents/:agentId/integrate" element={<IntegratePage />} />
          
          {/* Councils */}
          <Route path="/councils" element={<CouncilsPage />} />
        </Route>
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
