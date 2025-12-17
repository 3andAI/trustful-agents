import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Wallet, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  const { isConnected, address, isConnecting, connect } = useWallet();
  const { isAuthenticated, isLoading, error, login } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      console.error('Failed to connect:', err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo and title */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent-dark mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-governance-100">
            Trustful Agents
          </h1>
          <p className="text-governance-400 mt-2">Governance Dashboard</p>
        </div>

        {/* Login card */}
        <div className="card p-8 animate-slide-up">
          <div className="space-y-6">
            {/* Step indicator */}
            <div className="flex items-center gap-4">
              <div
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                  ${isConnected ? 'bg-accent text-white' : 'bg-governance-800 text-governance-400'}
                `}
              >
                1
              </div>
              <div className="flex-1 h-px bg-governance-700" />
              <div
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                  ${isAuthenticated ? 'bg-accent text-white' : 'bg-governance-800 text-governance-400'}
                `}
              >
                2
              </div>
            </div>

            {/* Connection status */}
            {!isConnected ? (
              <div className="space-y-4">
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-governance-100">
                    Connect Wallet
                  </h2>
                  <p className="text-sm text-governance-400 mt-1">
                    Connect your wallet to access the governance dashboard
                  </p>
                </div>

                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {isConnecting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Wallet className="w-5 h-5" />
                  )}
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Connected address */}
                <div className="p-4 bg-governance-800/50 rounded-lg border border-governance-700">
                  <p className="text-xs text-governance-400 mb-1">Connected as</p>
                  <p className="font-mono text-sm text-governance-100 break-all">
                    {address}
                  </p>
                </div>

                <div className="text-center">
                  <h2 className="text-lg font-semibold text-governance-100">
                    Sign In
                  </h2>
                  <p className="text-sm text-governance-400 mt-1">
                    Sign a message to verify your identity
                  </p>
                </div>

                {/* Error message */}
                {error && (
                  <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-danger font-medium">
                        Authentication Failed
                      </p>
                      <p className="text-xs text-danger/80 mt-1">{error}</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={login}
                  disabled={isLoading}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-5 h-5" />
                  )}
                  {isLoading ? 'Signing in...' : 'Sign In with Ethereum'}
                </button>
              </div>
            )}

            {/* Info text */}
            <p className="text-xs text-governance-500 text-center">
              Only Safe multisig owners can access this dashboard.
              <br />
              Your signature will not cost any gas.
            </p>
          </div>
        </div>

        {/* Network badge */}
        <div className="mt-6 text-center">
          <span className="inline-flex items-center gap-2 text-xs text-governance-500">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            Base Sepolia Testnet
          </span>
        </div>
      </div>
    </div>
  );
}
