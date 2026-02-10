import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { createWalletClient, custom, getAddress, type WalletClient, type Address } from 'viem';
import { chain } from '../config/contracts';

// Helper to checksum address
const toChecksumAddress = (addr: string): Address => getAddress(addr);

interface WalletContextType {
  address: Address | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  walletClient: WalletClient | null;
  signMessage: (message: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);

  const isConnected = !!address;

  // Check if already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window === 'undefined' || !window.ethereum) return;

      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
        if (accounts.length > 0) {
          setAddress(toChecksumAddress(accounts[0]));
          const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' }) as string;
          setChainId(parseInt(chainIdHex, 16));
          
          const client = createWalletClient({
            chain: chain,
            transport: custom(window.ethereum),
          });
          setWalletClient(client);
        }
      } catch (error) {
        console.error('Failed to check connection:', error);
      }
    };

    checkConnection();
  }, []);

  // Listen for account/chain changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const addrs = accounts as string[];
      if (addrs.length === 0) {
        setAddress(null);
        setWalletClient(null);
      } else {
        setAddress(toChecksumAddress(addrs[0]));
      }
    };

    const handleChainChanged = (chainIdHex: unknown) => {
      setChainId(parseInt(chainIdHex as string, 16));
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('No wallet found. Please install MetaMask.');
    }

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      }) as string[];
      
      if (accounts.length > 0) {
        setAddress(toChecksumAddress(accounts[0]));
        
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' }) as string;
        setChainId(parseInt(chainIdHex, 16));

        const client = createWalletClient({
          chain: chain,
          transport: custom(window.ethereum),
        });
        setWalletClient(client);
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setWalletClient(null);
  }, []);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!walletClient || !address) {
      throw new Error('Wallet not connected');
    }
    return walletClient.signMessage({ account: address, message });
  }, [walletClient, address]);

  return (
    <WalletContext.Provider
      value={{
        address,
        chainId,
        isConnected,
        isConnecting,
        connect,
        disconnect,
        walletClient,
        signMessage,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

// Type declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}
