import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Scale, Wallet, ExternalLink } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';

export default function ConnectPage() {
  const navigate = useNavigate();
  const { isConnected, isConnecting, connect, connectError } = useWallet();

  useEffect(() => {
    if (isConnected) {
      navigate('/', { replace: true });
    }
  }, [isConnected, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-council/20 mb-4">
            <Scale className="w-10 h-10 text-council" />
          </div>
          <h1 className="text-3xl font-bold text-governance-100 mb-2">Council Dashboard</h1>
          <p className="text-governance-400">Review claims and vote on disputes</p>
        </div>

        {/* Connect Card */}
        <div className="card p-6 space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-governance-100 mb-2">
              Connect Your Wallet
            </h2>
            <p className="text-governance-400 text-sm">
              Connect your wallet to access the council dashboard. You must be an active council member to vote on claims.
            </p>
          </div>

          {connectError && (
            <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg">
              <p className="text-danger text-sm">{connectError.message}</p>
            </div>
          )}

          <button
            onClick={connect}
            disabled={isConnecting}
            className="w-full btn-primary flex items-center justify-center gap-3 py-4"
          >
            {isConnecting ? (
              <>
                <div className="w-5 h-5 border-2 border-governance-900 border-t-transparent rounded-full animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Wallet className="w-5 h-5" />
                <span>Connect Wallet</span>
              </>
            )}
          </button>

          <div className="pt-4 border-t border-governance-800">
            <p className="text-xs text-governance-500 text-center mb-3">
              Council members earn a share of forfeited deposits when they vote on claims.
            </p>
            <div className="flex items-center justify-center gap-4 text-xs">
              <a
                href="https://trustful-agents.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-council hover:text-council-light flex items-center gap-1"
              >
                Learn More <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-governance-700">•</span>
              <a
                href="https://docs.trustful-agents.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-council hover:text-council-light flex items-center gap-1"
              >
                Documentation <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-governance-600 text-xs mt-6">
          Powered by ERC-8004 • Eth Sepolia Testnet
        </p>
      </div>
    </div>
  );
}
