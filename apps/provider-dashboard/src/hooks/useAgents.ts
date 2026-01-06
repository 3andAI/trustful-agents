import { useMemo } from 'react'
import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { CONTRACTS, Erc8004RegistryAbi, CollateralVaultAbi, TrustfulValidatorAbi } from '../config/contracts'
import type { Agent, AgentWithDetails, CollateralAccount, ValidationConditions } from '../types'

/**
 * Hook to fetch all agents owned by the connected wallet
 */
export function useAgents() {
  const { address } = useAccount()

  // Get the user's balance (how many agents they own)
  const { data: balance, isLoading: balanceLoading, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.erc8004Registry,
    abi: Erc8004RegistryAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // Get the next token ID to know the range of existing tokens
  const { data: nextTokenId } = useReadContract({
    address: CONTRACTS.erc8004Registry,
    abi: Erc8004RegistryAbi,
    functionName: 'nextTokenId',
  })

  const agentCount = balance ? Number(balance) : 0
  const maxTokenId = nextTokenId ? Number(nextTokenId) : 0

  // Build contracts to check ownerOf for all existing tokens
  const ownerContracts = useMemo(() => {
    if (!address || maxTokenId === 0) return []
    return Array.from({ length: maxTokenId }, (_, index) => ({
      address: CONTRACTS.erc8004Registry,
      abi: Erc8004RegistryAbi,
      functionName: 'ownerOf' as const,
      args: [BigInt(index)],
    }))
  }, [address, maxTokenId])

  const { 
    data: ownerResults, 
    isLoading: ownersLoading, 
    refetch: refetchOwners 
  } = useReadContracts({
    contracts: ownerContracts,
    query: { 
      enabled: !!address && ownerContracts.length > 0,
    },
  })

  // Filter to find agents owned by the current user
  const agents: Agent[] = useMemo(() => {
    if (!ownerResults || !address) return []
    
    const result: Agent[] = []
    for (let i = 0; i < ownerResults.length; i++) {
      const ownerResult = ownerResults[i]
      if (ownerResult.status === 'success' && ownerResult.result) {
        const owner = ownerResult.result as string
        if (owner.toLowerCase() === address.toLowerCase()) {
          result.push({ id: BigInt(i), owner: address })
        }
      }
    }
    return result
  }, [ownerResults, address])

  const refetch = async () => {
    await refetchBalance()
    await refetchOwners()
  }

  return {
    agents,
    isLoading: balanceLoading || (ownerContracts.length > 0 && ownersLoading),
    count: agentCount,
    refetch,
  }
}

/**
 * Hook to fetch a single agent with all its details
 */
export function useAgent(agentId: string | undefined) {
  const parsedId = agentId ? BigInt(agentId) : undefined

  const { data: owner, isLoading: ownerLoading } = useReadContract({
    address: CONTRACTS.erc8004Registry,
    abi: Erc8004RegistryAbi,
    functionName: 'ownerOf',
    args: parsedId ? [parsedId] : undefined,
    query: { enabled: !!parsedId },
  })

  const { data: collateralAccount, isLoading: collateralLoading } = useReadContract({
    address: CONTRACTS.collateralVault,
    abi: CollateralVaultAbi,
    functionName: 'getAccount',
    args: parsedId ? [parsedId] : undefined,
    query: { enabled: !!parsedId },
  })

  const { data: isValidated, isLoading: validationLoading } = useReadContract({
    address: CONTRACTS.trustfulValidator,
    abi: TrustfulValidatorAbi,
    functionName: 'isValidated',
    args: parsedId ? [parsedId] : undefined,
    query: { enabled: !!parsedId },
  })

  const { data: conditions } = useReadContract({
    address: CONTRACTS.trustfulValidator,
    abi: TrustfulValidatorAbi,
    functionName: 'checkConditions',
    args: parsedId ? [parsedId] : undefined,
    query: { enabled: !!parsedId },
  })

  const account = collateralAccount as CollateralAccount | undefined
  const agent: AgentWithDetails | null = parsedId && owner ? {
    id: parsedId,
    owner: owner as `0x${string}`,
    collateral: account ? {
      balance: account.balance,
      lockedAmount: account.lockedAmount,
      withdrawalPending: account.withdrawalInitiatedAt > BigInt(0),
      withdrawalAmount: account.withdrawalAmount,
      withdrawalInitiatedAt: account.withdrawalInitiatedAt,
    } : undefined,
    validation: {
      isValid: isValidated ?? false,
    },
  } : null

  return {
    agent,
    conditions: conditions as ValidationConditions | undefined,
    isLoading: ownerLoading || collateralLoading || validationLoading,
    exists: !!owner,
  }
}

/**
 * Hook to check if an agent exists and who owns it
 */
export function useAgentOwner(agentId: string | undefined) {
  const parsedId = agentId ? BigInt(agentId) : undefined

  const { data: owner, isLoading, error } = useReadContract({
    address: CONTRACTS.erc8004Registry,
    abi: Erc8004RegistryAbi,
    functionName: 'ownerOf',
    args: parsedId ? [parsedId] : undefined,
    query: { enabled: !!parsedId },
  })

  return {
    owner: owner as `0x${string}` | undefined,
    isLoading,
    exists: !error && !!owner,
  }
}
