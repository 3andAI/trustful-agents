import SafeApiKitModule from '@safe-global/api-kit';
import SafeModule from '@safe-global/protocol-kit';
import {
  MetaTransactionData,
  OperationType,
} from '@safe-global/types-kit';
import { createPublicClient, http, type Address, getAddress } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import type { SafeInfo, SafeTransactionResponse } from '../types/index.js';

// Type workaround for default exports
const SafeApiKit = SafeApiKitModule as unknown as new (config: { chainId: bigint; txServiceUrl: string }) => {
  proposeTransaction(params: {
    safeAddress: string;
    safeTransactionData: any;
    safeTxHash: string;
    senderAddress: string;
    senderSignature: string;
  }): Promise<void>;
  getTransaction(hash: string): Promise<any>;
  confirmTransaction(hash: string, signature: string): Promise<void>;
};

const Safe = SafeModule as unknown as {
  init(config: { provider: string; signer: string; safeAddress: string }): Promise<{
    createTransaction(params: { transactions: MetaTransactionData[] }): Promise<any>;
    signTransaction(tx: any): Promise<any>;
    getTransactionHash(tx: any): Promise<string>;
    signHash(hash: string): Promise<{ data: string }>;
  }>;
};

// Type alias for SafeApiKit instance
type SafeApiKitInstance = InstanceType<typeof SafeApiKit>;

// ============================================================================
// Configuration
// ============================================================================

const CHAIN_ID = parseInt(process.env.CHAIN_ID || '84532');
const SAFE_ADDRESS = process.env.SAFE_ADDRESS as Address;
const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';

// ============================================================================
// Safe Contract ABI (minimal for reading owners/threshold)
// ============================================================================

const SAFE_ABI = [
  {
    name: 'getOwners',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    name: 'getThreshold',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'nonce',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// ============================================================================
// Clients
// ============================================================================

let apiKit: SafeApiKitInstance | null = null;

// Cache for Safe info (avoids API rate limits)
let cachedSafeInfo: SafeInfo | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Safe Transaction Service URLs (without trailing slash)
const SAFE_TX_SERVICE_URLS: Record<number, string> = {
  8453: 'https://safe-transaction-base.safe.global',
  84532: 'https://safe-transaction-base-sepolia.safe.global',
};

function getApiKit(): SafeApiKitInstance {
  if (!apiKit) {
    const txServiceUrl = SAFE_TX_SERVICE_URLS[CHAIN_ID];
    if (!txServiceUrl) {
      throw new Error(`No Safe Transaction Service URL for chain ${CHAIN_ID}`);
    }
    
    apiKit = new SafeApiKit({
      chainId: BigInt(CHAIN_ID),
      txServiceUrl,
    });
  }
  return apiKit;
}

function getViemClient() {
  const chain = CHAIN_ID === 8453 ? base : baseSepolia;
  return createPublicClient({
    chain,
    transport: http(RPC_URL),
  });
}

// ============================================================================
// Safe Info - Read from Contract (no API calls)
// ============================================================================

export async function getSafeInfo(): Promise<SafeInfo> {
  // Return cached if valid
  if (cachedSafeInfo && (Date.now() - cacheTime) < CACHE_TTL) {
    return cachedSafeInfo;
  }

  // Validate SAFE_ADDRESS is configured
  if (!SAFE_ADDRESS) {
    throw new Error('SAFE_ADDRESS environment variable is not configured');
  }

  const client = getViemClient();

  try {
    // Read directly from Safe contract (no API rate limits)
    const [owners, threshold, nonce] = await Promise.all([
      client.readContract({
        address: SAFE_ADDRESS,
        abi: SAFE_ABI,
        functionName: 'getOwners',
      }),
      client.readContract({
        address: SAFE_ADDRESS,
        abi: SAFE_ABI,
        functionName: 'getThreshold',
      }),
      client.readContract({
        address: SAFE_ADDRESS,
        abi: SAFE_ABI,
        functionName: 'nonce',
      }),
    ]);

    const info: SafeInfo = {
      address: getAddress(SAFE_ADDRESS),
      threshold: Number(threshold),
      owners: owners.map((o) => getAddress(o)),
      nonce: Number(nonce),
    };

    // Cache the result
    cachedSafeInfo = info;
    cacheTime = Date.now();

    return info;
  } catch (rpcError) {
    console.error('RPC call to Safe contract failed:', rpcError);
    
    // Fallback to Safe Transaction Service API
    console.log('Falling back to Safe Transaction Service API...');
    try {
      const txServiceUrl = SAFE_TX_SERVICE_URLS[CHAIN_ID];
      const response = await fetch(`${txServiceUrl}/api/v1/safes/${SAFE_ADDRESS}/`, {
        headers: { 'Accept': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error(`Safe API returned ${response.status}`);
      }
      
      const data = await response.json() as {
        address: string;
        threshold: number;
        owners: string[];
        nonce: number;
      };
      
      const info: SafeInfo = {
        address: getAddress(data.address),
        threshold: data.threshold,
        owners: data.owners.map((o) => getAddress(o)),
        nonce: data.nonce,
      };
      
      // Cache the result
      cachedSafeInfo = info;
      cacheTime = Date.now();
      
      return info;
    } catch (apiError) {
      console.error('Safe API fallback also failed:', apiError);
      throw new Error(`Could not fetch Safe info: RPC and API both failed. RPC error: ${rpcError}`);
    }
  }
}

export async function getSafeOwners(): Promise<string[]> {
  const info = await getSafeInfo();
  return info.owners.map((o) => o.toLowerCase());
}

export async function isSafeOwner(address: string): Promise<boolean> {
  const owners = await getSafeOwners();
  return owners.includes(address.toLowerCase());
}

// ============================================================================
// Transaction Management
// ============================================================================

export async function getPendingTransactions(): Promise<SafeTransactionResponse[]> {
  const txServiceUrl = SAFE_TX_SERVICE_URLS[CHAIN_ID];
  const url = `${txServiceUrl}/api/v1/safes/${SAFE_ADDRESS}/multisig-transactions/?executed=false&nonce__gte=0`;
  
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: { 'Accept': 'application/json' },
  });
  
  if (!response.ok) {
    throw new Error(`Safe API error: ${response.status}`);
  }
  
  const data = await response.json() as { results?: unknown[] };
  
  return ((data.results || []) as any[]).map((tx) => ({
    safeTxHash: tx.safeTxHash,
    to: tx.to,
    data: tx.data || '0x',
    value: tx.value,
    operation: tx.operation,
    nonce: tx.nonce,
    confirmations: tx.confirmations?.length || 0,
    confirmationsRequired: tx.confirmationsRequired,
    isExecuted: tx.isExecuted,
    proposer: tx.proposer || '',
    description: parseTransactionDescription(tx.to, tx.data || '0x'),
  }));
}

export async function getTransaction(safeTxHash: string): Promise<SafeTransactionResponse | null> {
  try {
    const txServiceUrl = SAFE_TX_SERVICE_URLS[CHAIN_ID];
    const url = `${txServiceUrl}/api/v1/multisig-transactions/${safeTxHash}/`;
    
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      return null;
    }
    
    const tx = await response.json() as any;
    
    return {
      safeTxHash: tx.safeTxHash,
      to: tx.to,
      data: tx.data || '0x',
      value: tx.value,
      operation: tx.operation,
      nonce: tx.nonce,
      confirmations: tx.confirmations?.length || 0,
      confirmationsRequired: tx.confirmationsRequired,
      isExecuted: tx.isExecuted,
      proposer: tx.proposer || '',
      description: parseTransactionDescription(tx.to, tx.data || '0x'),
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Transaction Proposal
// ============================================================================

export interface ProposeTransactionParams {
  to: Address;
  data: `0x${string}`;
  value?: string;
  signerPrivateKey?: `0x${string}`; // Optional: for server-side signing
  signerAddress: Address; // The proposer's address
}

export async function proposeTransaction(
  params: ProposeTransactionParams
): Promise<string> {
  const { to, data, value = '0', signerAddress } = params;
  
  const kit = getApiKit();
  
  // Create transaction data
  const safeTransactionData: MetaTransactionData = {
    to,
    data,
    value,
    operation: OperationType.Call,
  };
  
  // If we have a private key, we can sign server-side
  // Otherwise, return unsigned transaction for client-side signing
  if (params.signerPrivateKey) {
    // Initialize Safe with signer (protocol-kit v6)
    const protocolKit = await Safe.init({
      provider: RPC_URL,
      signer: params.signerPrivateKey,
      safeAddress: SAFE_ADDRESS,
    });
    
    // Create transaction
    const safeTransaction = await protocolKit.createTransaction({
      transactions: [safeTransactionData],
    });
    
    // Sign transaction
    const signedTransaction = await protocolKit.signTransaction(safeTransaction);
    
    // Get transaction hash
    const safeTxHash = await protocolKit.getTransactionHash(signedTransaction);
    
    // Get signature for the signer
    const signerSignature = signedTransaction.getSignature(signerAddress.toLowerCase());
    
    // Propose to Safe Transaction Service
    await kit.proposeTransaction({
      safeAddress: SAFE_ADDRESS,
      safeTransactionData: signedTransaction.data,
      safeTxHash,
      senderAddress: signerAddress,
      senderSignature: signerSignature?.data || '',
    });
    
    return safeTxHash;
  }
  
  // For client-side signing, we need to return the transaction data
  // The client will sign and submit
  throw new Error('Client-side signing not yet implemented - provide signerPrivateKey');
}

// ============================================================================
// Transaction Signing
// ============================================================================

export async function signTransaction(
  safeTxHash: string,
  signerPrivateKey: `0x${string}`,
  signerAddress: Address
): Promise<void> {
  const kit = getApiKit();
  
  // Get the transaction
  const tx = await kit.getTransaction(safeTxHash);
  
  // Initialize Safe with signer
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    signer: signerPrivateKey,
    safeAddress: SAFE_ADDRESS,
  });
  
  // Create Safe transaction from existing data
  const safeTransaction = await protocolKit.createTransaction({
    transactions: [{
      to: tx.to,
      data: tx.data || '0x',
      value: tx.value,
      operation: tx.operation as OperationType,
    }],
  });
  
  // Sign the hash
  const signature = await protocolKit.signHash(safeTxHash);
  
  // Submit confirmation
  await kit.confirmTransaction(safeTxHash, signature.data);
}

// ============================================================================
// Transaction Helpers
// ============================================================================

// Known function selectors for governance actions
const FUNCTION_SELECTORS: Record<string, string> = {
  '0x3d91a2a1': 'createCouncil',
  '0x8456cb59': 'closeCouncil', 
  '0x0d8e6e2c': 'addMember',
  '0x0b1ca49a': 'removeMember',
  '0x7f6d4b4a': 'reassignAgentCouncil',
  '0x5c975abb': 'pause',
  '0x3f4ba83a': 'unpause',
};

function parseTransactionDescription(to: string, data: string): string {
  if (data.length < 10) return 'Unknown transaction';
  
  const selector = data.slice(0, 10);
  const functionName = FUNCTION_SELECTORS[selector];
  
  if (functionName) {
    return `${functionName} on ${to.slice(0, 10)}...`;
  }
  
  return `Call to ${to.slice(0, 10)}...`;
}

// ============================================================================
// Governance Contract Helpers
// ============================================================================

export function encodeCreateCouncil(
  name: string,
  description: string,
  vertical: string,
  quorumPercentage: number,
  claimDepositPercentage: number,
  votingPeriod: number,
  evidencePeriod: number
): `0x${string}` {
  // ABI encode createCouncil call
  // createCouncil(string,string,string,uint256,uint256,uint256,uint256)
  const client = getViemClient();
  // We'd need the full ABI here - simplified for now
  // In production, import the actual ABI from the SDK
  return '0x' as `0x${string}`;
}

export function encodeAddMember(councilId: `0x${string}`, member: Address): `0x${string}` {
  // ABI encode addMember call
  return '0x' as `0x${string}`;
}

export function encodeRemoveMember(councilId: `0x${string}`, member: Address): `0x${string}` {
  // ABI encode removeMember call  
  return '0x' as `0x${string}`;
}

export function encodeReassignAgent(agentId: bigint, newCouncilId: `0x${string}`): `0x${string}` {
  // ABI encode reassignAgentCouncil call
  return '0x' as `0x${string}`;
}

// ============================================================================
// Health Check
// ============================================================================

export async function healthCheck(): Promise<boolean> {
  try {
    await getSafeInfo();
    return true;
  } catch {
    return false;
  }
}
