import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useReadContracts } from 'wagmi'
import { keccak256, toBytes } from 'viem'
import { CONTRACTS, TermsRegistryAbi, CouncilRegistryAbi } from '../config/contracts'

export interface Terms {
  contentHash: `0x${string}`
  contentUri: string
  councilId: `0x${string}`
  registeredAt: bigint
  active: boolean
}

export interface Council {
  councilId: `0x${string}`
  name: string
  description: string
  vertical: string
  memberCount: bigint
  quorumPercentage: bigint
  claimDepositPercentage: bigint
  votingPeriod: bigint
  evidencePeriod: bigint
  active: boolean
  createdAt: bigint
  closedAt: bigint
}

/**
 * Hook for reading agent's current terms
 */
export function useAgentTerms(agentId: string | undefined) {
  const parsedId = agentId ? BigInt(agentId) : undefined

  const { data, isLoading, refetch } = useReadContract({
    address: CONTRACTS.termsRegistry,
    abi: TermsRegistryAbi,
    functionName: 'getActiveTerms',
    args: parsedId ? [parsedId] : undefined,
    query: { enabled: !!parsedId },
  })

  const { data: hasTerms } = useReadContract({
    address: CONTRACTS.termsRegistry,
    abi: TermsRegistryAbi,
    functionName: 'hasActiveTerms',
    args: parsedId ? [parsedId] : undefined,
    query: { enabled: !!parsedId },
  })

  // data is [terms, version]
  const termsData = data as [Terms, bigint] | undefined
  const terms = termsData?.[0]
  const version = termsData?.[1]

  return {
    terms: hasTerms ? terms : undefined,
    version: hasTerms ? version : undefined,
    hasTerms: hasTerms as boolean | undefined,
    isLoading,
    refetch,
  }
}

/**
 * Hook for reading agent's terms history (all versions)
 */
export function useTermsHistory(agentId: string | undefined) {
  const parsedId = agentId ? BigInt(agentId) : undefined

  const { data: historyData, isLoading: historyLoading } = useReadContract({
    address: CONTRACTS.termsRegistry,
    abi: TermsRegistryAbi,
    functionName: 'getTermsHistory',
    args: parsedId ? [parsedId] : undefined,
    query: { enabled: !!parsedId },
  })

  const { data: configData, isLoading: configLoading } = useReadContract({
    address: CONTRACTS.termsRegistry,
    abi: TermsRegistryAbi,
    functionName: 'getTermsConfig',
    args: parsedId ? [parsedId] : undefined,
    query: { enabled: !!parsedId },
  })

  const history = historyData as Terms[] | undefined
  const config = configData as { activeVersion: bigint; versionCount: bigint } | undefined

  return {
    history: history ?? [],
    activeVersion: config?.activeVersion,
    versionCount: config?.versionCount,
    isLoading: historyLoading || configLoading,
  }
}

/**
 * Hook for registering new terms
 */
export function useRegisterTerms() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const registerTerms = (
    agentId: string,
    contentHash: `0x${string}`,
    contentUri: string,
    councilId: `0x${string}`
  ) => {
    writeContract({
      address: CONTRACTS.termsRegistry,
      abi: TermsRegistryAbi,
      functionName: 'registerTerms',
      args: [BigInt(agentId), contentHash, contentUri, councilId],
    })
  }

  return {
    registerTerms,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  }
}

/**
 * Hook for getting list of active councils
 */
export function useActiveCouncils() {
  // First get the list of active council IDs
  const { data: councilIds, isLoading: idsLoading, error: idsError } = useReadContract({
    address: CONTRACTS.councilRegistry,
    abi: CouncilRegistryAbi,
    functionName: 'getActiveCouncils',
  })

  // Then fetch details for each council
  const ids = councilIds as `0x${string}`[] | undefined
  
  const councilContracts = ids?.map((id) => ({
    address: CONTRACTS.councilRegistry,
    abi: CouncilRegistryAbi,
    functionName: 'getCouncil' as const,
    args: [id] as const,
  })) ?? []

  const { data: councilsData, isLoading: councilsLoading } = useReadContracts({
    contracts: councilContracts,
    query: { enabled: !!ids && ids.length > 0 },
  })

  const councils: Council[] = councilsData
    ?.map((result, index) => {
      if (result.status === 'success' && result.result) {
        const c = result.result as Council
        return {
          ...c,
          councilId: ids![index],
        }
      }
      return null
    })
    .filter((c): c is Council => c !== null && c.active) ?? []

  return {
    councils,
    councilIds: ids,
    isLoading: idsLoading || councilsLoading,
    error: idsError,
  }
}

/**
 * Hook for getting a single council
 */
export function useCouncil(councilId: `0x${string}` | undefined) {
  const { data, isLoading } = useReadContract({
    address: CONTRACTS.councilRegistry,
    abi: CouncilRegistryAbi,
    functionName: 'getCouncil',
    args: councilId ? [councilId] : undefined,
    query: { enabled: !!councilId && councilId !== '0x0000000000000000000000000000000000000000000000000000000000000000' },
  })

  return {
    council: data as Council | undefined,
    isLoading,
  }
}

/**
 * Hash content for terms registration
 */
export function hashContent(content: string): `0x${string}` {
  return keccak256(toBytes(content))
}

/**
 * Hash file content for terms registration
 */
export async function hashFileContent(file: File): Promise<`0x${string}`> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  return keccak256(bytes)
}
