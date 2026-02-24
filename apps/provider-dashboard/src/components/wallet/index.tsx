import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { Wallet, LogOut, AlertTriangle, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { shortenAddress, cn, getAddressUrl } from '../../lib/utils'
import { CHAIN_ID } from '../../config/contracts'
import { Button } from '../ui'

// =============================================================================
// Connect Button
// =============================================================================

export function ConnectButton({ className }: { className?: string }) {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const [showDropdown, setShowDropdown] = useState(false)

  const isWrongNetwork = isConnected && chainId !== CHAIN_ID

  if (!isConnected) {
    return (
      <div className="relative">
        <Button
          variant="primary"
          onClick={() => setShowDropdown(!showDropdown)}
          loading={isPending}
          leftIcon={<Wallet className="w-4 h-4" />}
          className={className}
        >
          Connect Wallet
        </Button>
        
        {showDropdown && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
            <div className="absolute right-0 mt-2 w-56 bg-surface-900 border border-surface-700 rounded-xl shadow-xl z-50 overflow-hidden">
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => { connect({ connector }); setShowDropdown(false) }}
                  className="w-full px-4 py-3 text-left text-surface-200 hover:bg-surface-800 transition-colors flex items-center gap-3"
                >
                  <Wallet className="w-5 h-5 text-surface-400" />
                  {connector.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  if (isWrongNetwork) {
    return (
      <Button
        variant="danger"
        onClick={() => switchChain({ chainId: CHAIN_ID })}
        leftIcon={<AlertTriangle className="w-4 h-4" />}
        className={className}
      >
        Switch Network
      </Button>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={cn(
          'flex items-center gap-3 px-4 py-2 rounded-lg',
          'bg-surface-800 hover:bg-surface-700 transition-colors border border-surface-700',
          className
        )}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center text-xs font-mono text-white">
          {address?.slice(2, 4)}
        </div>
        <span className="text-sm font-mono text-surface-200">{shortenAddress(address!)}</span>
        <ChevronDown className="w-4 h-4 text-surface-400" />
      </button>
      
      {showDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          <div className="absolute right-0 mt-2 w-56 bg-surface-900 border border-surface-700 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-800">
              <p className="text-xs text-surface-500">Connected to</p>
              <p className="text-sm font-mono text-surface-200">{shortenAddress(address!, 6)}</p>
            </div>
            <a
              href={getAddressUrl(address!)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-4 py-3 text-left text-surface-300 hover:bg-surface-800 transition-colors flex items-center gap-3 text-sm"
            >
              View on Explorer
            </a>
            <button
              onClick={() => { disconnect(); setShowDropdown(false) }}
              className="w-full px-4 py-3 text-left text-danger hover:bg-surface-800 transition-colors flex items-center gap-3 text-sm"
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// =============================================================================
// Wallet Status (for sidebar)
// =============================================================================

export function WalletStatus({ className }: { className?: string }) {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  
  const isWrongNetwork = isConnected && chainId !== CHAIN_ID

  if (!isConnected) return null

  return (
    <div className={cn('flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-800/50', className)}>
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center text-xs font-mono text-white">
        {address?.slice(2, 4)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-100 truncate">
          {isWrongNetwork ? 'Wrong Network' : 'Connected'}
        </p>
        <p className="text-xs text-surface-500 font-mono">{shortenAddress(address!)}</p>
      </div>
      <button
        onClick={() => disconnect()}
        className="p-2 text-surface-400 hover:text-surface-100 hover:bg-surface-700 rounded-lg transition-colors"
        title="Disconnect"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  )
}

// =============================================================================
// Connect Prompt (full page)
// =============================================================================

export function ConnectPrompt() {
  const { connect, connectors, isPending } = useConnect()

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center mx-auto mb-6">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          
          <h1 className="text-2xl font-bold text-surface-100 mb-2">Connect Your Wallet</h1>
          <p className="text-surface-400 mb-8">
            Connect your wallet to manage your AI agents on the Trustful network.
          </p>
          
          <div className="space-y-3">
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => connect({ connector })}
                disabled={isPending}
                className={cn(
                  'w-full px-4 py-3 rounded-lg font-medium transition-all duration-200',
                  'bg-surface-800 hover:bg-surface-700 text-surface-100',
                  'border border-surface-700 hover:border-surface-600',
                  'flex items-center justify-center gap-3',
                  isPending && 'opacity-50 cursor-wait'
                )}
              >
                <Wallet className="w-5 h-5" />
                {connector.name}
              </button>
            ))}
          </div>
          
          <p className="text-sm text-surface-500 mt-6">Make sure you're on the correct network</p>
        </div>
      </div>
    </div>
  )
}
