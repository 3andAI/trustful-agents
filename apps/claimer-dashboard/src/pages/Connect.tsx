import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount, useConnect } from 'wagmi'
import { FileText, Wallet, AlertCircle } from 'lucide-react'

export default function Connect() {
  const navigate = useNavigate()
  const { isConnected } = useAccount()
  const { connect, connectors, isPending, error } = useConnect()

  useEffect(() => {
    if (isConnected) {
      navigate('/')
    }
  }, [isConnected, navigate])

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="card p-8 text-center">
          {/* Logo */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-claimer to-claimer-dark flex items-center justify-center mx-auto mb-6">
            <FileText className="w-10 h-10 text-white" />
          </div>
          
          <h1 className="text-2xl font-bold text-surface-100 mb-2">
            Trustful Claims
          </h1>
          <p className="text-surface-400 mb-8">
            Connect your wallet to file and track claims against AI agents.
          </p>

          {/* Connect Buttons */}
          <div className="space-y-3">
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => connect({ connector })}
                disabled={isPending}
                className="w-full px-4 py-3 rounded-lg font-medium transition-all duration-200
                  bg-surface-800 hover:bg-surface-700 text-surface-100
                  border border-surface-700 hover:border-surface-600
                  flex items-center justify-center gap-3
                  disabled:opacity-50 disabled:cursor-wait"
              >
                <Wallet className="w-5 h-5" />
                {connector.name}
              </button>
            ))}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-6 p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
              <p className="text-sm text-danger text-left">
                {error.message}
              </p>
            </div>
          )}

          <p className="text-sm text-surface-500 mt-6">
            Make sure you're connected to Base Sepolia testnet
          </p>

          {/* Info */}
          <div className="mt-8 pt-6 border-t border-surface-700">
            <p className="text-xs text-surface-500">
              By connecting, you agree to the Trustful Agents terms of service.
              Claims require a deposit that may be forfeited if rejected.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
