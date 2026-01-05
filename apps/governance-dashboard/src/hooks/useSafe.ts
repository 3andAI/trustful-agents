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
import { getSafeInfo, storePendingTransaction } from '../lib/api';

// Safe Transaction Service URL
const SAFE_TX_SERVICE_URL = 'https://safe-transaction-base-sepolia.safe.global';

// Safe contract ABI (minimal for nonce)
const SAFE_ABI = [
  {
    name: 'nonce',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'getTransactionHash',
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
      { name: 'nonce', type: 'uint256' },
    ],
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'view',
  },
] as const;

// Types
export interface TransactionData {
  to: string;
  data: string;
  value: string;
}

export interface TransactionMetadata {
  actionType: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ProposeResult {
  success: boolean;
  safeTxHash?: string;
  error?: string;
}

export function useSafeTransaction() {
  const { address } = useWallet();
  const [isProposing, setIsProposing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [safeAddress, setSafeAddress] = useState<string | null>(null);

  // Fetch Safe address from our backend API on mount
  useEffect(() => {
    getSafeInfo()
      .then((info) => setSafeAddress(info.address))
      .catch((err) => console.error('Failed to fetch Safe info:', err));
  }, []);

  const proposeTransaction = useCallback(
    async (txData: TransactionData, metadata?: TransactionMetadata): Promise<ProposeResult> => {
      if (!address) {
        return { success: false, error: 'Wallet not connected' };
      }

      if (!safeAddress) {
        return { success: false, error: 'Safe address not loaded. Please refresh the page.' };
      }

      if (!window.ethereum) {
        return { success: false, error: 'No wallet provider found' };
      }

      setIsProposing(true);
      setError(null);

      try {
        // Create viem clients
        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http(),
        });

        const walletClient = createWalletClient({
          chain: baseSepolia,
          transport: custom(window.ethereum),
          account: address as Address,
        });

        // Get nonce directly from Safe contract (no API call)
        const nonce = await publicClient.readContract({
          address: safeAddress as Address,
          abi: SAFE_ABI,
          functionName: 'nonce',
        });

        // Prepare Safe transaction data
        const safeTxData = {
          to: txData.to as Address,
          value: BigInt(txData.value || '0'),
          data: txData.data as Hex,
          operation: 0, // Call
          safeTxGas: 0n,
          baseGas: 0n,
          gasPrice: 0n,
          gasToken: '0x0000000000000000000000000000000000000000' as Address,
          refundReceiver: '0x0000000000000000000000000000000000000000' as Address,
          nonce: nonce,
        };

        // Get transaction hash from Safe contract (no API call)
        const safeTxHash = await publicClient.readContract({
          address: safeAddress as Address,
          abi: SAFE_ABI,
          functionName: 'getTransactionHash',
          args: [
            safeTxData.to,
            safeTxData.value,
            safeTxData.data,
            safeTxData.operation,
            safeTxData.safeTxGas,
            safeTxData.baseGas,
            safeTxData.gasPrice,
            safeTxData.gasToken,
            safeTxData.refundReceiver,
            safeTxData.nonce,
          ],
        });

        // Sign the transaction hash with user's wallet
        const signature = await walletClient.signMessage({
          account: address as Address,
          message: { raw: safeTxHash },
        });

        // Adjust signature for Safe format (add 4 to v for eth_sign)
        const adjustedSignature = adjustSignatureForSafe(signature);

        // Propose to Safe Transaction Service (single API call)
        const response = await fetch(
          `${SAFE_TX_SERVICE_URL}/api/v1/safes/${safeAddress}/multisig-transactions/`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: safeTxData.to,
              value: safeTxData.value.toString(),
              data: safeTxData.data,
              operation: safeTxData.operation,
              safeTxGas: safeTxData.safeTxGas.toString(),
              baseGas: safeTxData.baseGas.toString(),
              gasPrice: safeTxData.gasPrice.toString(),
              gasToken: safeTxData.gasToken,
              refundReceiver: safeTxData.refundReceiver,
              nonce: Number(safeTxData.nonce),
              contractTransactionHash: safeTxHash,
              sender: address,
              signature: adjustedSignature,
              origin: 'Trustful Agents Governance',
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || errorData.detail || `API error: ${response.status}`);
        }

        // Store transaction metadata in our database for other signers to see
        if (metadata) {
          try {
            await storePendingTransaction({
              safeTxHash,
              actionType: metadata.actionType,
              title: metadata.title,
              description: metadata.description,
              metadata: metadata.metadata,
            });
          } catch (err) {
            console.warn('Failed to store transaction metadata:', err);
            // Don't fail the whole operation if metadata storage fails
          }
        }

        setIsProposing(false);
        return { success: true, safeTxHash };
      } catch (err) {
        console.error('Safe transaction error:', err);
        let errorMessage = 'Failed to propose transaction';
        
        if (err instanceof Error) {
          if (err.message.includes('User rejected') || err.message.includes('user rejected')) {
            errorMessage = 'Transaction was rejected in wallet.';
          } else if (err.message.includes('429') || err.message.includes('Too Many Requests')) {
            errorMessage = 'Rate limited. Please wait a moment and try again.';
          } else {
            errorMessage = err.message;
          }
        }
        
        setError(errorMessage);
        setIsProposing(false);
        return { success: false, error: errorMessage };
      }
    },
    [address, safeAddress]
  );

  const getSafeUrl = useCallback(() => {
    return `https://app.safe.global/transactions/queue?safe=basesep:${safeAddress}`;
  }, [safeAddress]);

  return {
    proposeTransaction,
    getSafeUrl,
    isProposing,
    error,
    safeAddress,
    isReady: !!safeAddress,
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
