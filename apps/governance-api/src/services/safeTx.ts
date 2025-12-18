import { encodeFunctionData, type Address, type Hex } from 'viem';
import crypto from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

const CHAIN_ID = parseInt(process.env.CHAIN_ID || '84532');
const SAFE_ADDRESS = process.env.SAFE_ADDRESS as Address;
const COUNCIL_REGISTRY_ADDRESS = process.env.COUNCIL_REGISTRY_ADDRESS as Address;

// Safe Transaction Service URLs
const SAFE_TX_SERVICE_URL = CHAIN_ID === 8453
  ? 'https://safe-transaction-base.safe.global'
  : 'https://safe-transaction-base-sepolia.safe.global';

const SAFE_APP_URL = CHAIN_ID === 8453
  ? 'https://app.safe.global/home?safe=base:'
  : 'https://app.safe.global/home?safe=basesep:';

// ============================================================================
// CouncilRegistry ABI (write functions for encoding)
// ============================================================================

const councilRegistryABI = [
  {
    type: 'function',
    name: 'createCouncil',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'vertical', type: 'string' },
      { name: 'quorumPercentage', type: 'uint256' },
      { name: 'claimDepositPercentage', type: 'uint256' },
      { name: 'votingPeriod', type: 'uint256' },
      { name: 'evidencePeriod', type: 'uint256' },
    ],
    outputs: [{ name: 'councilId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'closeCouncil',
    inputs: [{ name: 'councilId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'addMember',
    inputs: [
      { name: 'councilId', type: 'bytes32' },
      { name: 'member', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'removeMember',
    inputs: [
      { name: 'councilId', type: 'bytes32' },
      { name: 'member', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// ============================================================================
// Types
// ============================================================================

export interface SafeTransaction {
  to: Address;
  value: string;
  data: Hex;
  operation: number; // 0 = Call, 1 = DelegateCall
  safeTxGas: string;
  baseGas: string;
  gasPrice: string;
  gasToken: Address;
  refundReceiver: Address;
  nonce: number;
}

export interface ProposedTransaction {
  safeTxHash: string;
  safeAppUrl: string;
  transactionData: {
    to: Address;
    data: Hex;
    value: string;
  };
}

export interface CreateCouncilParams {
  name: string;
  description: string;
  vertical: string;
  quorumPercentage: number; // basis points (e.g., 5000 = 50%)
  claimDepositPercentage: number; // basis points
  votingPeriodDays: number;
  evidencePeriodDays: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateSafeTxHash(): string {
  return '0x' + crypto.randomBytes(32).toString('hex');
}

async function getSafeNonce(): Promise<number> {
  try {
    const response = await fetch(`${SAFE_TX_SERVICE_URL}/api/v1/safes/${SAFE_ADDRESS}/`);
    if (!response.ok) {
      throw new Error(`Failed to fetch Safe info: ${response.status}`);
    }
    const data = await response.json();
    return data.nonce;
  } catch (error) {
    console.error('Failed to get Safe nonce:', error);
    return 0;
  }
}

// ============================================================================
// Transaction Encoding Functions
// ============================================================================

export function encodeCreateCouncil(params: CreateCouncilParams): Hex {
  const votingPeriod = BigInt(params.votingPeriodDays * 24 * 60 * 60);
  const evidencePeriod = BigInt(params.evidencePeriodDays * 24 * 60 * 60);

  return encodeFunctionData({
    abi: councilRegistryABI,
    functionName: 'createCouncil',
    args: [
      params.name,
      params.description,
      params.vertical,
      BigInt(params.quorumPercentage),
      BigInt(params.claimDepositPercentage),
      votingPeriod,
      evidencePeriod,
    ],
  });
}

export function encodeCloseCouncil(councilId: Hex): Hex {
  return encodeFunctionData({
    abi: councilRegistryABI,
    functionName: 'closeCouncil',
    args: [councilId],
  });
}

export function encodeAddMember(councilId: Hex, memberAddress: Address): Hex {
  return encodeFunctionData({
    abi: councilRegistryABI,
    functionName: 'addMember',
    args: [councilId, memberAddress],
  });
}

export function encodeRemoveMember(councilId: Hex, memberAddress: Address): Hex {
  return encodeFunctionData({
    abi: councilRegistryABI,
    functionName: 'removeMember',
    args: [councilId, memberAddress],
  });
}

// ============================================================================
// Transaction Data Generation (for Safe UI)
// ============================================================================

export function generateCreateCouncilTxData(params: CreateCouncilParams): {
  to: Address;
  data: Hex;
  value: string;
  description: string;
} {
  return {
    to: COUNCIL_REGISTRY_ADDRESS,
    data: encodeCreateCouncil(params),
    value: '0',
    description: `Create council: ${params.name} (${params.vertical})`,
  };
}

export function generateCloseCouncilTxData(councilId: Hex, councilName: string): {
  to: Address;
  data: Hex;
  value: string;
  description: string;
} {
  return {
    to: COUNCIL_REGISTRY_ADDRESS,
    data: encodeCloseCouncil(councilId),
    value: '0',
    description: `Close council: ${councilName}`,
  };
}

export function generateAddMemberTxData(
  councilId: Hex,
  councilName: string,
  memberAddress: Address
): {
  to: Address;
  data: Hex;
  value: string;
  description: string;
} {
  return {
    to: COUNCIL_REGISTRY_ADDRESS,
    data: encodeAddMember(councilId, memberAddress),
    value: '0',
    description: `Add member ${memberAddress} to council: ${councilName}`,
  };
}

export function generateRemoveMemberTxData(
  councilId: Hex,
  councilName: string,
  memberAddress: Address
): {
  to: Address;
  data: Hex;
  value: string;
  description: string;
} {
  return {
    to: COUNCIL_REGISTRY_ADDRESS,
    data: encodeRemoveMember(councilId, memberAddress),
    value: '0',
    description: `Remove member ${memberAddress} from council: ${councilName}`,
  };
}

// ============================================================================
// Safe App URL Generation
// ============================================================================

export function getSafeAppTransactionUrl(txData: { to: Address; data: Hex; value: string }): string {
  // Generate URL that opens Safe with pre-filled transaction
  const baseUrl = `${SAFE_APP_URL}${SAFE_ADDRESS}`;
  
  // For new transaction, use the transaction builder or queue
  // The Safe web app will handle the transaction creation
  return `${baseUrl}/transactions/queue`;
}

export function getSafeNewTransactionUrl(): string {
  return `${SAFE_APP_URL}${SAFE_ADDRESS}/transactions/queue`;
}

// ============================================================================
// Pending Transactions Check
// ============================================================================

export async function getPendingSafeTransactions(): Promise<{
  count: number;
  results: Array<{
    safeTxHash: string;
    to: Address;
    value: string;
    data: Hex | null;
    confirmations: Array<{ owner: Address }>;
    confirmationsRequired: number;
  }>;
}> {
  try {
    const response = await fetch(
      `${SAFE_TX_SERVICE_URL}/api/v1/safes/${SAFE_ADDRESS}/multisig-transactions/?executed=false&trusted=true`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch pending transactions: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to get pending Safe transactions:', error);
    return { count: 0, results: [] };
  }
}

export async function getSafeTransactionBySafeTxHash(safeTxHash: string): Promise<{
  safeTxHash: string;
  to: Address;
  value: string;
  data: Hex | null;
  confirmations: Array<{ owner: Address }>;
  confirmationsRequired: number;
  isExecuted: boolean;
} | null> {
  try {
    const response = await fetch(
      `${SAFE_TX_SERVICE_URL}/api/v1/multisig-transactions/${safeTxHash}/`
    );
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to get Safe transaction:', error);
    return null;
  }
}

// ============================================================================
// Exports
// ============================================================================

export { SAFE_ADDRESS, SAFE_TX_SERVICE_URL, SAFE_APP_URL, COUNCIL_REGISTRY_ADDRESS };
