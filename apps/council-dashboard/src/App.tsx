import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { useWallet } from './hooks/useWallet';
import Layout from './components/Layout';
import { Loader2 } from 'lucide-react';

// Lazy load pages - they'll be loaded on demand
const ConnectPage = lazy(() => import('./pages/Connect'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const ClaimsPage = lazy(() => import('./pages/Claims'));
const ClaimDetailPage = lazy(() => import('./pages/ClaimDetail'));
const HistoryPage = lazy(() => import('./pages/History'));

// Loading fallback for lazy components
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-council" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isConnected, isConnecting } = useWallet();

  if (isConnecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-governance-400">Connecting wallet...</div>
      </div>
    );
  }

  if (!isConnected) {
    return <Navigate to="/connect" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/connect" element={<ConnectPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="claims" element={<ClaimsPage />} />
            <Route path="claims/:claimId" element={<ClaimDetailPage />} />
            <Route path="history" element={<HistoryPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
