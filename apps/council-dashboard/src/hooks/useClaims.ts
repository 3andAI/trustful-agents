import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import {
  getClaims,
  getClaim,
  getClaimVotes,
  getMyVote,
  getMemberCouncils,
  getMemberPendingClaims,
  prepareVoteTransaction,
  prepareFinalizeTransaction,
} from '../lib/api';

// ============================================================================
// Claims Queries
// ============================================================================

export function useClaims(params?: {
  councilId?: string;
  status?: string;
  claimant?: string;
  agentId?: string;
  pending?: boolean;
}) {
  return useQuery({
    queryKey: ['claims', params],
    queryFn: () => getClaims(params),
    staleTime: 30000, // Data is fresh for 30 seconds
    refetchInterval: 60000, // Refetch every 60 seconds (reduced from 30)
  });
}

export function useClaim(claimId: string | undefined) {
  return useQuery({
    queryKey: ['claim', claimId],
    queryFn: () => getClaim(claimId!),
    enabled: !!claimId,
    staleTime: 10000, // Data is fresh for 10 seconds
    refetchInterval: 30000, // Refetch every 30 seconds (reduced from 10)
  });
}

export function useClaimVotes(claimId: string | undefined) {
  return useQuery({
    queryKey: ['claimVotes', claimId],
    queryFn: () => getClaimVotes(claimId!),
    enabled: !!claimId,
    staleTime: 15000,
    refetchInterval: 30000, // Reduced from 15
  });
}

export function useMyVote(claimId: string | undefined, address: string | undefined) {
  return useQuery({
    queryKey: ['myVote', claimId, address],
    queryFn: () => getMyVote(claimId!, address!),
    enabled: !!claimId && !!address,
    staleTime: 10000,
    refetchInterval: 30000, // Reduced from 10
  });
}

// ============================================================================
// Member Queries
// ============================================================================

export function useMemberCouncils(address: string | undefined) {
  return useQuery({
    queryKey: ['memberCouncils', address],
    queryFn: () => getMemberCouncils(address!),
    enabled: !!address,
    staleTime: 60000, // Council membership rarely changes
    refetchInterval: 120000, // Refetch every 2 minutes
  });
}

export function useMemberPendingClaims(address: string | undefined) {
  return useQuery({
    queryKey: ['memberPendingClaims', address],
    queryFn: () => getMemberPendingClaims(address!),
    enabled: !!address,
    staleTime: 30000,
    refetchInterval: 60000, // Reduced from 30
  });
}

// ============================================================================
// Voting Mutation
// ============================================================================

export function useVote() {
  const queryClient = useQueryClient();
  const { sendTransactionAsync } = useSendTransaction();

  return useMutation({
    mutationFn: async ({
      claimId,
      vote,
      approvedAmount,
      reasoning,
      voterAddress,
    }: {
      claimId: string;
      vote: number;
      approvedAmount?: string;
      reasoning?: string;
      voterAddress: string;
    }) => {
      // Get transaction data from API
      const { transaction, isChangeVote, message } = await prepareVoteTransaction(claimId, {
        vote,
        approvedAmount,
        reasoning,
        voterAddress,
      });

      // Send transaction
      const hash = await sendTransactionAsync({
        to: transaction.to as `0x${string}`,
        data: transaction.data as `0x${string}`,
        value: BigInt(transaction.value),
      });

      return { hash, isChangeVote, message };
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['claim', variables.claimId] });
      queryClient.invalidateQueries({ queryKey: ['claimVotes', variables.claimId] });
      queryClient.invalidateQueries({ queryKey: ['myVote', variables.claimId] });
      queryClient.invalidateQueries({ queryKey: ['memberPendingClaims'] });
    },
  });
}

// ============================================================================
// Finalize Mutation
// ============================================================================

export function useFinalizeClaim() {
  const queryClient = useQueryClient();
  const { sendTransactionAsync } = useSendTransaction();

  return useMutation({
    mutationFn: async (claimId: string) => {
      const { transaction, message } = await prepareFinalizeTransaction(claimId);

      const hash = await sendTransactionAsync({
        to: transaction.to as `0x${string}`,
        data: transaction.data as `0x${string}`,
        value: BigInt(transaction.value),
      });

      return { hash, message };
    },
    onSuccess: (_, claimId) => {
      queryClient.invalidateQueries({ queryKey: ['claim', claimId] });
      queryClient.invalidateQueries({ queryKey: ['claims'] });
      queryClient.invalidateQueries({ queryKey: ['memberPendingClaims'] });
    },
  });
}

// ============================================================================
// Transaction Receipt Hook
// ============================================================================

export function useTransactionStatus(hash: `0x${string}` | undefined) {
  return useWaitForTransactionReceipt({
    hash,
    confirmations: 1,
  });
}
