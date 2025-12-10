import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Address,
  type Chain,
} from "viem";
import { baseSepolia, base } from "viem/chains";
import { type TrustfulConfig, DEFAULT_CONFIG, getChainConfig } from "./config";
import {
  CollateralVaultAbi,
  TermsRegistryAbi,
  TrustfulValidatorAbi,
  CouncilRegistryAbi,
  ClaimsManagerAbi,
} from "./contracts";
import type {
  CollateralAccount,
  TermsVersion,
  ValidationRecord,
  ValidationConditions,
  Claim,
  ClaimStats,
  Council,
  TrustInfo,
} from "./types";

export interface TrustfulClient {
  // Read functions
  isValidated(agentId: bigint): Promise<boolean>;
  getValidationRecord(agentId: bigint): Promise<ValidationRecord>;
  checkConditions(agentId: bigint): Promise<ValidationConditions>;
  getTrustInfo(agentId: bigint): Promise<TrustInfo>;

  getCollateralAccount(agentId: bigint): Promise<CollateralAccount>;
  getAvailableBalance(agentId: bigint): Promise<bigint>;

  getActiveTerms(agentId: bigint): Promise<{ terms: TermsVersion; version: bigint }>;
  getMaxPayoutPerClaim(agentId: bigint): Promise<bigint>;

  getClaim(claimId: bigint): Promise<Claim>;
  getClaimsByAgent(agentId: bigint): Promise<bigint[]>;
  getClaimStats(agentId: bigint): Promise<ClaimStats>;
  calculateRequiredDeposit(agentId: bigint, claimAmount: bigint): Promise<bigint>;

  getCouncil(councilId: `0x${string}`): Promise<Council>;
  isCouncilMember(councilId: `0x${string}`, address: Address): Promise<boolean>;

  // Write functions (require wallet)
  deposit(agentId: bigint, amount: bigint): Promise<`0x${string}`>;
  initiateWithdrawal(agentId: bigint, amount: bigint): Promise<`0x${string}`>;
  cancelWithdrawal(agentId: bigint): Promise<`0x${string}`>;
  executeWithdrawal(agentId: bigint): Promise<`0x${string}`>;

  registerTerms(
    agentId: bigint,
    contentHash: `0x${string}`,
    contentUri: string,
    maxPayoutPerClaim: bigint,
    councilId: `0x${string}`
  ): Promise<`0x${string}`>;

  fileClaim(
    agentId: bigint,
    claimedAmount: bigint,
    evidenceHash: `0x${string}`,
    evidenceUri: string,
    paymentReceiptHash: `0x${string}`
  ): Promise<`0x${string}`>;

  castVote(
    claimId: bigint,
    vote: 1 | 2 | 3, // Approve | Reject | Abstain
    approvedAmount: bigint,
    reasoning: string
  ): Promise<`0x${string}`>;

  // Configuration
  config: TrustfulConfig;
  publicClient: PublicClient;
  walletClient?: WalletClient;
}

export function createTrustfulClient(
  config: Partial<TrustfulConfig> & { rpcUrl?: string; privateKey?: `0x${string}` } = {}
): TrustfulClient {
  const chainId = config.chainId ?? DEFAULT_CONFIG.chainId;
  const chainConfig = getChainConfig(chainId);

  const fullConfig: TrustfulConfig = {
    ...DEFAULT_CONFIG,
    ...chainConfig,
    ...config,
  };

  const chain: Chain = chainId === 8453 ? base : baseSepolia;

  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });

  let walletClient: WalletClient | undefined;
  // Wallet client setup would go here if privateKey provided

  return {
    config: fullConfig,
    publicClient,
    walletClient,

    // =========================================================================
    // Validation
    // =========================================================================

    async isValidated(agentId: bigint): Promise<boolean> {
      return publicClient.readContract({
        address: fullConfig.contracts.trustfulValidator,
        abi: TrustfulValidatorAbi,
        functionName: "isValidated",
        args: [agentId],
      }) as Promise<boolean>;
    },

    async getValidationRecord(agentId: bigint): Promise<ValidationRecord> {
      const result = await publicClient.readContract({
        address: fullConfig.contracts.trustfulValidator,
        abi: TrustfulValidatorAbi,
        functionName: "getValidationRecord",
        args: [agentId],
      });
      return result as ValidationRecord;
    },

    async checkConditions(agentId: bigint): Promise<ValidationConditions> {
      const result = await publicClient.readContract({
        address: fullConfig.contracts.trustfulValidator,
        abi: TrustfulValidatorAbi,
        functionName: "checkConditions",
        args: [agentId],
      });
      return result as ValidationConditions;
    },

    async getTrustInfo(agentId: bigint): Promise<TrustInfo> {
      const result = await publicClient.readContract({
        address: fullConfig.contracts.trustfulValidator,
        abi: TrustfulValidatorAbi,
        functionName: "getTrustInfo",
        args: [agentId],
      });
      const [collateralAmount, maxPayoutPerClaim, councilId, isValid] = result as [
        bigint,
        bigint,
        `0x${string}`,
        boolean
      ];
      return { collateralAmount, maxPayoutPerClaim, councilId, isValid };
    },

    // =========================================================================
    // Collateral
    // =========================================================================

    async getCollateralAccount(agentId: bigint): Promise<CollateralAccount> {
      const result = await publicClient.readContract({
        address: fullConfig.contracts.collateralVault,
        abi: CollateralVaultAbi,
        functionName: "getAccount",
        args: [agentId],
      });
      return result as CollateralAccount;
    },

    async getAvailableBalance(agentId: bigint): Promise<bigint> {
      return publicClient.readContract({
        address: fullConfig.contracts.collateralVault,
        abi: CollateralVaultAbi,
        functionName: "getAvailableBalance",
        args: [agentId],
      }) as Promise<bigint>;
    },

    // =========================================================================
    // Terms
    // =========================================================================

    async getActiveTerms(agentId: bigint): Promise<{ terms: TermsVersion; version: bigint }> {
      const result = await publicClient.readContract({
        address: fullConfig.contracts.termsRegistry,
        abi: TermsRegistryAbi,
        functionName: "getActiveTerms",
        args: [agentId],
      });
      const [terms, version] = result as [TermsVersion, bigint];
      return { terms, version };
    },

    async getMaxPayoutPerClaim(agentId: bigint): Promise<bigint> {
      return publicClient.readContract({
        address: fullConfig.contracts.termsRegistry,
        abi: TermsRegistryAbi,
        functionName: "getMaxPayoutPerClaim",
        args: [agentId],
      }) as Promise<bigint>;
    },

    // =========================================================================
    // Claims
    // =========================================================================

    async getClaim(claimId: bigint): Promise<Claim> {
      const result = await publicClient.readContract({
        address: fullConfig.contracts.claimsManager,
        abi: ClaimsManagerAbi,
        functionName: "getClaim",
        args: [claimId],
      });
      return result as Claim;
    },

    async getClaimsByAgent(agentId: bigint): Promise<bigint[]> {
      const result = await publicClient.readContract({
        address: fullConfig.contracts.claimsManager,
        abi: ClaimsManagerAbi,
        functionName: "getClaimsByAgent",
        args: [agentId],
      });
      return result as bigint[];
    },

    async getClaimStats(agentId: bigint): Promise<ClaimStats> {
      const result = await publicClient.readContract({
        address: fullConfig.contracts.claimsManager,
        abi: ClaimsManagerAbi,
        functionName: "getClaimStats",
        args: [agentId],
      });
      return result as ClaimStats;
    },

    async calculateRequiredDeposit(agentId: bigint, claimAmount: bigint): Promise<bigint> {
      return publicClient.readContract({
        address: fullConfig.contracts.claimsManager,
        abi: ClaimsManagerAbi,
        functionName: "calculateRequiredDeposit",
        args: [agentId, claimAmount],
      }) as Promise<bigint>;
    },

    // =========================================================================
    // Council
    // =========================================================================

    async getCouncil(councilId: `0x${string}`): Promise<Council> {
      const result = await publicClient.readContract({
        address: fullConfig.contracts.councilRegistry,
        abi: CouncilRegistryAbi,
        functionName: "getCouncil",
        args: [councilId],
      });
      return result as Council;
    },

    async isCouncilMember(councilId: `0x${string}`, address: Address): Promise<boolean> {
      return publicClient.readContract({
        address: fullConfig.contracts.councilRegistry,
        abi: CouncilRegistryAbi,
        functionName: "isActiveMember",
        args: [councilId, address],
      }) as Promise<boolean>;
    },

    // =========================================================================
    // Write Functions (stubs - need wallet)
    // =========================================================================

    async deposit(_agentId: bigint, _amount: bigint): Promise<`0x${string}`> {
      throw new Error("Wallet client not configured");
    },

    async initiateWithdrawal(_agentId: bigint, _amount: bigint): Promise<`0x${string}`> {
      throw new Error("Wallet client not configured");
    },

    async cancelWithdrawal(_agentId: bigint): Promise<`0x${string}`> {
      throw new Error("Wallet client not configured");
    },

    async executeWithdrawal(_agentId: bigint): Promise<`0x${string}`> {
      throw new Error("Wallet client not configured");
    },

    async registerTerms(
      _agentId: bigint,
      _contentHash: `0x${string}`,
      _contentUri: string,
      _maxPayoutPerClaim: bigint,
      _councilId: `0x${string}`
    ): Promise<`0x${string}`> {
      throw new Error("Wallet client not configured");
    },

    async fileClaim(
      _agentId: bigint,
      _claimedAmount: bigint,
      _evidenceHash: `0x${string}`,
      _evidenceUri: string,
      _paymentReceiptHash: `0x${string}`
    ): Promise<`0x${string}`> {
      throw new Error("Wallet client not configured");
    },

    async castVote(
      _claimId: bigint,
      _vote: 1 | 2 | 3,
      _approvedAmount: bigint,
      _reasoning: string
    ): Promise<`0x${string}`> {
      throw new Error("Wallet client not configured");
    },
  };
}
