import { createPublicClient, http, type Address, type Hex } from 'viem';
import { base, baseSepolia } from 'viem/chains';

// ============================================================================
// Configuration
// ============================================================================

const CHAIN_ID = parseInt(process.env.CHAIN_ID || '84532');
const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
const COUNCIL_REGISTRY_ADDRESS = process.env.COUNCIL_REGISTRY_ADDRESS as Address;

// ============================================================================
// Client
// ============================================================================

const chain = CHAIN_ID === 8453 ? base : baseSepolia;

export const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL),
});

// ============================================================================
// CouncilRegistry ABI (read functions only)
// ============================================================================

const councilRegistryABI = [
  {
    type: 'function',
    name: 'getCouncil',
    inputs: [{ name: 'councilId', type: 'bytes32' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'councilId', type: 'bytes32' },
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'vertical', type: 'string' },
        { name: 'memberCount', type: 'uint256' },
        { name: 'quorumPercentage', type: 'uint256' },
        { name: 'claimDepositPercentage', type: 'uint256' },
        { name: 'votingPeriod', type: 'uint256' },
        { name: 'evidencePeriod', type: 'uint256' },
        { name: 'active', type: 'bool' },
        { name: 'createdAt', type: 'uint256' },
        { name: 'closedAt', type: 'uint256' },
      ],
    }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getActiveCouncils',
    inputs: [],
    outputs: [{ name: 'councilIds', type: 'bytes32[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCouncilMembers',
    inputs: [{ name: 'councilId', type: 'bytes32' }],
    outputs: [{ name: 'members', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMember',
    inputs: [
      { name: 'councilId', type: 'bytes32' },
      { name: 'member', type: 'address' },
    ],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'member', type: 'address' },
        { name: 'councilId', type: 'bytes32' },
        { name: 'joinedAt', type: 'uint256' },
        { name: 'claimsVoted', type: 'uint256' },
        { name: 'active', type: 'bool' },
      ],
    }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'councilStatus',
    inputs: [{ name: 'councilId', type: 'bytes32' }],
    outputs: [
      { name: 'exists', type: 'bool' },
      { name: 'active', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isCouncilClosed',
    inputs: [{ name: 'councilId', type: 'bytes32' }],
    outputs: [{ name: 'isClosed', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'canCloseCouncil',
    inputs: [{ name: 'councilId', type: 'bytes32' }],
    outputs: [
      { name: 'canClose', type: 'bool' },
      { name: 'reason', type: 'string' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCouncilsByVertical',
    inputs: [{ name: 'vertical', type: 'string' }],
    outputs: [{ name: 'councilIds', type: 'bytes32[]' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'CouncilCreated',
    inputs: [
      { name: 'councilId', type: 'bytes32', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'vertical', type: 'string', indexed: false },
      { name: 'quorumPercentage', type: 'uint256', indexed: false },
      { name: 'claimDepositPercentage', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CouncilClosed',
    inputs: [
      { name: 'councilId', type: 'bytes32', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MemberAdded',
    inputs: [
      { name: 'councilId', type: 'bytes32', indexed: true },
      { name: 'member', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'MemberRemoved',
    inputs: [
      { name: 'councilId', type: 'bytes32', indexed: true },
      { name: 'member', type: 'address', indexed: true },
    ],
  },
] as const;

// ============================================================================
// Types
// ============================================================================

export interface OnChainCouncil {
  councilId: Hex;
  name: string;
  description: string;
  vertical: string;
  memberCount: bigint;
  quorumPercentage: bigint;
  claimDepositPercentage: bigint;
  votingPeriod: bigint;
  evidencePeriod: bigint;
  active: boolean;
  createdAt: bigint;
  closedAt: bigint;
}

export interface OnChainMember {
  member: Address;
  councilId: Hex;
  joinedAt: bigint;
  claimsVoted: bigint;
  active: boolean;
}

// ============================================================================
// Council Functions
// ============================================================================

export async function getActiveCouncilIds(): Promise<Hex[]> {
  if (!COUNCIL_REGISTRY_ADDRESS) {
    console.warn('COUNCIL_REGISTRY_ADDRESS not set');
    return [];
  }

  try {
    const councilIds = await publicClient.readContract({
      address: COUNCIL_REGISTRY_ADDRESS,
      abi: councilRegistryABI,
      functionName: 'getActiveCouncils',
    });
    return councilIds as Hex[];
  } catch (error) {
    console.error('Failed to fetch active councils:', error);
    return [];
  }
}

export async function getCouncil(councilId: Hex): Promise<OnChainCouncil | null> {
  if (!COUNCIL_REGISTRY_ADDRESS) {
    console.warn('COUNCIL_REGISTRY_ADDRESS not set');
    return null;
  }

  try {
    const council = await publicClient.readContract({
      address: COUNCIL_REGISTRY_ADDRESS,
      abi: councilRegistryABI,
      functionName: 'getCouncil',
      args: [councilId],
    });
    return council as OnChainCouncil;
  } catch (error) {
    console.error('Failed to fetch council:', error);
    return null;
  }
}

export async function getAllCouncils(): Promise<OnChainCouncil[]> {
  const councilIds = await getActiveCouncilIds();
  const councils: OnChainCouncil[] = [];

  for (const councilId of councilIds) {
    const council = await getCouncil(councilId);
    if (council) {
      councils.push(council);
    }
  }

  return councils;
}

export async function getCouncilMembers(councilId: Hex): Promise<Address[]> {
  if (!COUNCIL_REGISTRY_ADDRESS) {
    console.warn('COUNCIL_REGISTRY_ADDRESS not set');
    return [];
  }

  try {
    const members = await publicClient.readContract({
      address: COUNCIL_REGISTRY_ADDRESS,
      abi: councilRegistryABI,
      functionName: 'getCouncilMembers',
      args: [councilId],
    });
    return members as Address[];
  } catch (error) {
    console.error('Failed to fetch council members:', error);
    return [];
  }
}

export async function getMember(councilId: Hex, memberAddress: Address): Promise<OnChainMember | null> {
  if (!COUNCIL_REGISTRY_ADDRESS) {
    console.warn('COUNCIL_REGISTRY_ADDRESS not set');
    return null;
  }

  try {
    const member = await publicClient.readContract({
      address: COUNCIL_REGISTRY_ADDRESS,
      abi: councilRegistryABI,
      functionName: 'getMember',
      args: [councilId, memberAddress],
    });
    return member as OnChainMember;
  } catch (error) {
    console.error('Failed to fetch member:', error);
    return null;
  }
}

export async function getCouncilStatus(councilId: Hex): Promise<{ exists: boolean; active: boolean }> {
  if (!COUNCIL_REGISTRY_ADDRESS) {
    return { exists: false, active: false };
  }

  try {
    const [exists, active] = await publicClient.readContract({
      address: COUNCIL_REGISTRY_ADDRESS,
      abi: councilRegistryABI,
      functionName: 'councilStatus',
      args: [councilId],
    });
    return { exists, active };
  } catch (error) {
    console.error('Failed to fetch council status:', error);
    return { exists: false, active: false };
  }
}

export async function canCloseCouncil(councilId: Hex): Promise<{ canClose: boolean; reason: string }> {
  if (!COUNCIL_REGISTRY_ADDRESS) {
    return { canClose: false, reason: 'COUNCIL_REGISTRY_ADDRESS not set' };
  }

  try {
    const [canClose, reason] = await publicClient.readContract({
      address: COUNCIL_REGISTRY_ADDRESS,
      abi: councilRegistryABI,
      functionName: 'canCloseCouncil',
      args: [councilId],
    });
    return { canClose, reason };
  } catch (error) {
    console.error('Failed to check if council can close:', error);
    return { canClose: false, reason: 'Failed to check' };
  }
}

// ============================================================================
// Event Fetching (for historical data)
// ============================================================================

export async function getCouncilCreatedEvents(fromBlock?: bigint) {
  if (!COUNCIL_REGISTRY_ADDRESS) {
    return [];
  }

  try {
    const logs = await publicClient.getLogs({
      address: COUNCIL_REGISTRY_ADDRESS,
      event: {
        type: 'event',
        name: 'CouncilCreated',
        inputs: [
          { name: 'councilId', type: 'bytes32', indexed: true },
          { name: 'name', type: 'string', indexed: false },
          { name: 'vertical', type: 'string', indexed: false },
          { name: 'quorumPercentage', type: 'uint256', indexed: false },
          { name: 'claimDepositPercentage', type: 'uint256', indexed: false },
        ],
      },
      fromBlock: fromBlock ?? 'earliest',
      toBlock: 'latest',
    });
    return logs;
  } catch (error) {
    console.error('Failed to fetch CouncilCreated events:', error);
    return [];
  }
}

// ============================================================================
// Exports
// ============================================================================

export { COUNCIL_REGISTRY_ADDRESS, CHAIN_ID, RPC_URL };
