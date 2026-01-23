import { useAccount, useConnect, useDisconnect, useSwitchChain, useSignMessage } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'

export function useWallet() {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { signMessageAsync } = useSignMessage()

  const isWrongNetwork = isConnected && chain?.id !== baseSepolia.id

  const switchToBaseSepolia = () => {
    switchChain({ chainId: baseSepolia.id })
  }

  const signMessage = async (message: string) => {
    return signMessageAsync({ message })
  }

  return {
    address,
    isConnected,
    isConnecting,
    isWrongNetwork,
    chain,
    connectors,
    connect,
    disconnect,
    switchToBaseSepolia,
    signMessage,
    baseSepolia
  }
}
