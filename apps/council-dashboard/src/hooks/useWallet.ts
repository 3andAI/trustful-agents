import { useAccount, useConnect, useDisconnect, useSignMessage, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

export function useWallet() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChain } = useSwitchChain();

  const isWrongNetwork = isConnected && chain?.id !== baseSepolia.id;

  const connectWallet = async () => {
    // Use injected wallet (MetaMask) by default
    const injected = connectors.find(c => c.id === 'injected');
    if (injected) {
      connect({ connector: injected });
    } else if (connectors.length > 0) {
      connect({ connector: connectors[0] });
    }
  };

  const signMessage = async (message: string): Promise<string> => {
    return signMessageAsync({ message });
  };

  const switchToBaseSepolia = () => {
    switchChain({ chainId: baseSepolia.id });
  };

  return {
    address,
    isConnected,
    isConnecting,
    isWrongNetwork,
    chain,
    chainId: chain?.id,
    connectError,
    connectors,
    connect: connectWallet,
    disconnect,
    signMessage,
    switchToBaseSepolia,
  };
}
