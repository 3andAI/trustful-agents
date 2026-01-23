import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAccount, useChainId } from 'wagmi'
import { Suspense, lazy } from 'react'
import { CHAIN_ID } from './config/contracts'
import { ConnectPrompt } from './components/wallet'
import Layout from './components/layout/Layout'
import { Button, Alert, LoadingState } from './components/ui'
import { AlertTriangle } from 'lucide-react'

// Lazy load pages - they'll be loaded on demand
const LandingPage = lazy(() => import('./pages/Landing'))
const DashboardPage = lazy(() => import('./pages/Dashboard'))
const NewAgentPage = lazy(() => import('./pages/NewAgent'))
const AgentDetailPage = lazy(() => import('./pages/AgentDetail'))
const CollateralPage = lazy(() => import('./pages/CollateralPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const IntegratePage = lazy(() => import('./pages/IntegratePage'))
const ClaimsPage = lazy(() => import('./pages/ClaimsPage'))
const ClaimDetailPage = lazy(() => import('./pages/ClaimDetailPage'))
const CouncilsPage = lazy(() => import('./pages/Placeholders').then(m => ({ default: m.CouncilsPage })))

// Loading fallback for lazy components
function PageLoader() {
  return <LoadingState message="Loading..." />
}

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
      <Suspense fallback={<PageLoader />}>
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
            
            {/* Redirect old /agents to dashboard */}
            <Route path="/agents" element={<Navigate to="/dashboard" replace />} />
            
            {/* Agent routes */}
            <Route path="/agents/new" element={<NewAgentPage />} />
            <Route path="/agents/:agentId" element={<AgentDetailPage />} />
            <Route path="/agents/:agentId/collateral" element={<CollateralPage />} />
            <Route path="/agents/:agentId/terms" element={<TermsPage />} />
            <Route path="/agents/:agentId/claims" element={<ClaimsPage />} />
            <Route path="/agents/:agentId/claims/:claimId" element={<ClaimDetailPage />} />
            <Route path="/agents/:agentId/integrate" element={<IntegratePage />} />
            
            {/* Councils */}
            <Route path="/councils" element={<CouncilsPage />} />
          </Route>
          
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
