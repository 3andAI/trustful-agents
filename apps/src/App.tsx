import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import Layout from './components/Layout'
import Connect from './pages/Connect'
import Dashboard from './pages/Dashboard'
import FileClaim from './pages/FileClaim'
import ClaimDetail from './pages/ClaimDetail'
import AgentLookup from './pages/AgentLookup'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount()
  if (!isConnected) {
    return <Navigate to="/connect" replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/connect" element={<Connect />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/file" element={<FileClaim />} />
                  <Route path="/agent/search" element={<AgentLookup />} />
                  <Route path="/agent/:agentId" element={<AgentLookup />} />
                  <Route path="/claims/:claimId" element={<ClaimDetail />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
