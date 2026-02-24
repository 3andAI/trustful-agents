import { useAccount, useConnect, useDisconnect, useSignMessage, useSwitchChain } from 'wagmi';
import { CHAIN_ID } from '../config/contracts';

export function useWallet() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChain } = useSwitchChain();

  const isWrongNetwork = isConnected && chain?.id !== CHAIN_ID;

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

  const switchToCorrectNetwork = () => {
    switchChain({ chainId: CHAIN_ID });
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
    switchToCorrectNetwork,
    // Backward compat alias
    switchToBaseSepolia: switchToCorrectNetwork,
  };
}
