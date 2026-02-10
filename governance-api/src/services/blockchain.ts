import { type Address, type Hex } from 'viem';
import {
  CHAIN_ID,
  RPC_URL,
  COUNCIL_REGISTRY_ADDRESS,
  CouncilRegistryAbi,
  publicClient,
} from '../config/index.js';

// Re-export publicClient for consumers that import from here
export { publicClient };

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
      address: COUNCIL_REGISTRY_ADDRESS as Address,
      abi: CouncilRegistryAbi,
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
      address: COUNCIL_REGISTRY_ADDRESS as Address,
      abi: CouncilRegistryAbi,
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
      address: COUNCIL_REGISTRY_ADDRESS as Address,
      abi: CouncilRegistryAbi,
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
      address: COUNCIL_REGISTRY_ADDRESS as Address,
      abi: CouncilRegistryAbi,
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
      address: COUNCIL_REGISTRY_ADDRESS as Address,
      abi: CouncilRegistryAbi,
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
      address: COUNCIL_REGISTRY_ADDRESS as Address,
      abi: CouncilRegistryAbi,
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
      address: COUNCIL_REGISTRY_ADDRESS as Address,
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
// Re-exports for backward compatibility
// ============================================================================

export { COUNCIL_REGISTRY_ADDRESS, CHAIN_ID, RPC_URL };
