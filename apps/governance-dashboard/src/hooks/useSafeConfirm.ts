import { useState, useCallback, useEffect } from 'react';
import { 
  createPublicClient, 
  createWalletClient, 
  custom, 
  http,
  type Address,
  type Hex,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import { useWallet } from './useWallet';
import { getSafeInfo } from '../lib/api';

// Safe Transaction Service URL
const SAFE_TX_SERVICE_URL = 'https://safe-transaction-base-sepolia.safe.global';

// Safe contract ABI for execution and nonce
const SAFE_ABI = [
  {
    name: 'execTransaction',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: 'signatures', type: 'bytes' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'payable',
  },
  {
    name: 'nonce',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// Types
export interface SafePendingTransaction {
  safeTxHash: string;
  to: Address;
  value: string;
  data: Hex;
  operation: number;
  safeTxGas: number;
  baseGas: number;
  gasPrice: string;
  gasToken: Address;
  refundReceiver: Address;
  nonce: number;
  confirmations: Array<{
    owner: Address;
    signature: Hex;
    signatureType: string;
  }>;
  confirmationsRequired: number;
  isExecuted: boolean;
  proposer: Address;
  submissionDate: string;
}

export function useSafeConfirm() {
  const { address } = useWallet();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [safeAddress, setSafeAddress] = useState<string | null>(null);
  const [safeOwners, setSafeOwners] = useState<string[]>([]);

  // Fetch Safe info on mount
  useEffect(() => {
    getSafeInfo()
      .then((info) => {
        setSafeAddress(info.address);
        setSafeOwners(info.owners);
      })
      .catch((err) => console.error('Failed to fetch Safe info:', err));
  }, []);

  // Check if connected wallet is a Safe owner
  const isOwner = useCallback(() => {
    if (!address || safeOwners.length === 0) return false;
    return safeOwners.some(owner => owner.toLowerCase() === address.toLowerCase());
  }, [address, safeOwners]);

  // Check if connected wallet has already signed a transaction
  const hasAlreadySigned = useCallback((tx: SafePendingTransaction) => {
    if (!address) return false;
    return tx.confirmations.some(
      conf => conf.owner.toLowerCase() === address.toLowerCase()
    );
  }, [address]);

  // Fetch current on-chain nonce from Safe contract
  const fetchOnChainNonce = useCallback(async (): Promise<number | null> => {
    if (!safeAddress) return null;

    try {
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });

      const nonce = await publicClient.readContract({
        address: safeAddress as Address,
        abi: SAFE_ABI,
        functionName: 'nonce',
      });

      return Number(nonce);
    } catch (err) {
      console.error('Failed to fetch on-chain nonce:', err);
      return null;
    }
  }, [safeAddress]);

  // Fetch pending transactions from Safe API (filtered by on-chain nonce)
  const fetchPendingTransactions = useCallback(async (): Promise<SafePendingTransaction[]> => {
    if (!safeAddress) return [];

    try {
      // Get current on-chain nonce
      const onChainNonce = await fetchOnChainNonce();
      
      const response = await fetch(
        `${SAFE_TX_SERVICE_URL}/api/v1/safes/${safeAddress}/multisig-transactions/?executed=false&limit=50`,
        { headers: { 'Accept': 'application/json' } }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const data = await response.json() as { results: SafePendingTransaction[] };
      const allTxs = data.results || [];
      
      // Filter out transactions with nonce below current on-chain nonce (these can never be executed)
      if (onChainNonce !== null) {
        return allTxs.filter(tx => tx.nonce >= onChainNonce);
      }
      
      return allTxs;
    } catch (err) {
      console.error('Failed to fetch pending transactions:', err);
      return [];
    }
  }, [safeAddress, fetchOnChainNonce]);

  // Add confirmation (co-sign) to an existing transaction
  const confirmTransaction = useCallback(
    async (safeTxHash: string): Promise<{ success: boolean; error?: string }> => {
      if (!address) {
        return { success: false, error: 'Wallet not connected' };
      }

      if (!safeAddress) {
        return { success: false, error: 'Safe address not loaded' };
      }

      if (!window.ethereum) {
        return { success: false, error: 'No wallet provider found' };
      }

      setIsConfirming(true);
      setError(null);

      try {
        // Create wallet client for signing
        const walletClient = createWalletClient({
          chain: baseSepolia,
          transport: custom(window.ethereum),
          account: address as Address,
        });

        // Sign the safeTxHash (same method as original proposer)
        const signature = await walletClient.signMessage({
          account: address as Address,
          message: { raw: safeTxHash as Hex },
        });

        // Adjust signature for Safe format (add 4 to v for eth_sign)
        const adjustedSignature = adjustSignatureForSafe(signature);

        // Submit confirmation to Safe Transaction Service
        const response = await fetch(
          `${SAFE_TX_SERVICE_URL}/api/v1/multisig-transactions/${safeTxHash}/confirmations/`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              signature: adjustedSignature,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || errorData.detail || `API error: ${response.status}`);
        }

        setIsConfirming(false);
        return { success: true };
      } catch (err) {
        console.error('Confirmation error:', err);
        let errorMessage = 'Failed to confirm transaction';
        
        if (err instanceof Error) {
          if (err.message.includes('User rejected') || err.message.includes('user rejected')) {
            errorMessage = 'Signature was rejected in wallet.';
          } else {
            errorMessage = err.message;
          }
        }
        
        setError(errorMessage);
        setIsConfirming(false);
        return { success: false, error: errorMessage };
      }
    },
    [address, safeAddress]
  );

  // Execute a transaction that has enough confirmations
  const executeTransaction = useCallback(
    async (tx: SafePendingTransaction): Promise<{ success: boolean; txHash?: string; error?: string }> => {
      if (!address) {
        return { success: false, error: 'Wallet not connected' };
      }

      if (!safeAddress) {
        return { success: false, error: 'Safe address not loaded' };
      }

      if (!window.ethereum) {
        return { success: false, error: 'No wallet provider found' };
      }

      if (tx.confirmations.length < tx.confirmationsRequired) {
        return { success: false, error: `Need ${tx.confirmationsRequired} signatures, have ${tx.confirmations.length}` };
      }

      setIsExecuting(true);
      setError(null);

      try {
        // Create clients
        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http(),
        });

        const walletClient = createWalletClient({
          chain: baseSepolia,
          transport: custom(window.ethereum),
          account: address as Address,
        });

        // Sort confirmations by owner address (Safe requires this)
        const sortedConfirmations = [...tx.confirmations].sort((a, b) =>
          a.owner.toLowerCase().localeCompare(b.owner.toLowerCase())
        );

        // Concatenate signatures
        const signatures = sortedConfirmations
          .map(conf => conf.signature.slice(2)) // Remove 0x prefix
          .join('');

        // Execute the transaction
        const { request } = await publicClient.simulateContract({
          address: safeAddress as Address,
          abi: SAFE_ABI,
          functionName: 'execTransaction',
          args: [
            tx.to,
            BigInt(tx.value),
            tx.data,
            tx.operation,
            BigInt(tx.safeTxGas),
            BigInt(tx.baseGas),
            BigInt(tx.gasPrice),
            tx.gasToken,
            tx.refundReceiver,
            `0x${signatures}` as Hex,
          ],
          account: address as Address,
        });

        const txHash = await walletClient.writeContract(request);

        // Wait for confirmation
        await publicClient.waitForTransactionReceipt({ hash: txHash });

        setIsExecuting(false);
        return { success: true, txHash };
      } catch (err) {
        console.error('Execution error:', err);
        let errorMessage = 'Failed to execute transaction';
        
        if (err instanceof Error) {
          if (err.message.includes('User rejected') || err.message.includes('user rejected')) {
            errorMessage = 'Transaction was rejected in wallet.';
          } else if (err.message.includes('GS013')) {
            errorMessage = 'Invalid signatures. The transaction may have been modified.';
          } else if (err.message.includes('GS025')) {
            errorMessage = 'Not enough gas provided for execution.';
          } else {
            errorMessage = err.message;
          }
        }
        
        setError(errorMessage);
        setIsExecuting(false);
        return { success: false, error: errorMessage };
      }
    },
    [address, safeAddress]
  );

  return {
    confirmTransaction,
    executeTransaction,
    fetchPendingTransactions,
    fetchOnChainNonce,
    isOwner,
    hasAlreadySigned,
    isConfirming,
    isExecuting,
    error,
    safeAddress,
    safeOwners,
    connectedAddress: address,
  };
}

// Adjust signature for Safe's expected format
// eth_sign returns signature with v = 27/28, Safe expects v = 31/32 for eth_sign
function adjustSignatureForSafe(signature: Hex): Hex {
  const r = signature.slice(0, 66);
  const s = '0x' + signature.slice(66, 130);
  let v = parseInt(signature.slice(130, 132), 16);
  
  // Add 4 to v for eth_sign signatures (Safe convention)
  v += 4;
  
  return (r + s.slice(2) + v.toString(16).padStart(2, '0')) as Hex;
}
