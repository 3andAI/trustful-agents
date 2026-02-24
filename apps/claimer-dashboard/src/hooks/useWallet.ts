import { useAccount, useConnect, useDisconnect, useSwitchChain, useSignMessage } from 'wagmi'
import { CHAIN_ID } from '../config/contracts'

export function useWallet() {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { signMessageAsync } = useSignMessage()

  const isWrongNetwork = isConnected && chain?.id !== CHAIN_ID

  const switchToCorrectNetwork = () => {
    switchChain({ chainId: CHAIN_ID })
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
    switchToCorrectNetwork,
    switchToBaseSepolia: switchToCorrectNetwork,
    signMessage,
  }
}
