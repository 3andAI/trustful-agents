import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits } from 'viem'
import { CONTRACTS, CollateralVaultAbi, MockUsdcAbi, USDC_DECIMALS } from '../config/contracts'
import type { CollateralAccount } from '../types'

/**
 * Hook for reading collateral account data
 */
export function useCollateralAccount(agentId: string | undefined) {
  const parsedId = agentId ? BigInt(agentId) : undefined

  const { data: account, isLoading, refetch } = useReadContract({
    address: CONTRACTS.collateralVault,
    abi: CollateralVaultAbi,
    functionName: 'getAccount',
    args: parsedId ? [parsedId] : undefined,
    query: { enabled: !!parsedId },
  })

  const { data: availableBalance } = useReadContract({
    address: CONTRACTS.collateralVault,
    abi: CollateralVaultAbi,
    functionName: 'getAvailableBalance',
    args: parsedId ? [parsedId] : undefined,
    query: { enabled: !!parsedId },
  })

  const collateralAccount = account as CollateralAccount | undefined

  return {
    account: collateralAccount,
    availableBalance: availableBalance as bigint | undefined,
    isLoading,
    refetch,
  }
}

/**
 * Hook for USDC balance and allowance
 */
export function useUsdcBalance() {
  const { address } = useAccount()

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.usdc,
    abi: MockUsdcAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.usdc,
    abi: MockUsdcAbi,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.collateralVault] : undefined,
    query: { enabled: !!address },
  })

  return {
    balance: balance as bigint | undefined,
    allowance: allowance as bigint | undefined,
    refetchBalance,
    refetchAllowance,
    refetch: () => {
      refetchBalance()
      refetchAllowance()
    },
  }
}

/**
 * Hook for approving USDC spending
 */
export function useApproveUsdc() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const approve = (amount: string) => {
    const parsedAmount = parseUnits(amount, USDC_DECIMALS)
    writeContract({
      address: CONTRACTS.usdc,
      abi: MockUsdcAbi,
      functionName: 'approve',
      args: [CONTRACTS.collateralVault, parsedAmount],
    })
  }

  return {
    approve,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  }
}

/**
 * Hook for depositing collateral
 */
export function useDeposit() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const deposit = (agentId: string, amount: string) => {
    const parsedAmount = parseUnits(amount, USDC_DECIMALS)
    writeContract({
      address: CONTRACTS.collateralVault,
      abi: CollateralVaultAbi,
      functionName: 'deposit',
      args: [BigInt(agentId), parsedAmount],
    })
  }

  return {
    deposit,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  }
}

/**
 * Hook for initiating withdrawal
 */
export function useInitiateWithdrawal() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const initiateWithdrawal = (agentId: string, amount: string) => {
    const parsedAmount = parseUnits(amount, USDC_DECIMALS)
    writeContract({
      address: CONTRACTS.collateralVault,
      abi: CollateralVaultAbi,
      functionName: 'initiateWithdrawal',
      args: [BigInt(agentId), parsedAmount],
    })
  }

  return {
    initiateWithdrawal,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  }
}

/**
 * Hook for executing withdrawal after grace period
 */
export function useExecuteWithdrawal() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const executeWithdrawal = (agentId: string) => {
    writeContract({
      address: CONTRACTS.collateralVault,
      abi: CollateralVaultAbi,
      functionName: 'executeWithdrawal',
      args: [BigInt(agentId)],
    })
  }

  return {
    executeWithdrawal,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  }
}

/**
 * Hook for canceling pending withdrawal
 */
export function useCancelWithdrawal() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const cancelWithdrawal = (agentId: string) => {
    writeContract({
      address: CONTRACTS.collateralVault,
      abi: CollateralVaultAbi,
      functionName: 'cancelWithdrawal',
      args: [BigInt(agentId)],
    })
  }

  return {
    cancelWithdrawal,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  }
}

/**
 * Hook for minting test USDC (testnet only)
 */
export function useMintTestUsdc() {
  const { address } = useAccount()
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const mint = (amount: string) => {
    if (!address) return
    const parsedAmount = parseUnits(amount, USDC_DECIMALS)
    writeContract({
      address: CONTRACTS.usdc,
      abi: MockUsdcAbi,
      functionName: 'mint',
      args: [address, parsedAmount],
    })
  }

  return {
    mint,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  }
}
