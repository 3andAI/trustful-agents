import { createConfig, http } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

// Contract addresses on Base Sepolia (v1.3)
export const CONTRACTS = {
  USDC: '0xd6897C4801c639Ff4eAaA31D7A5b4802613DB681',
  ERC8004_REGISTRY: '0x454909C7551158e12a6a5192dEB359dDF067ec80',
  COLLATERAL_VAULT: '0xC948389425061c2C960c034c1c9526E9E6f39ff9',
  TERMS_REGISTRY: '0xBDc5328D4442A1e893CD2b1F75d3F64a3e50f923',
  COUNCIL_REGISTRY: '0xAaA608c80168D90d77Ec5a7f72Fb939E7Add5C32',
  TRUSTFUL_VALIDATOR: '0x9628C1bD875C3378B14f0108b60B0b5739fE92E8',
  CLAIMS_MANAGER: import.meta.env.VITE_CLAIMS_MANAGER_ADDRESS || '0x7B0465DF41c3649f88A627cF06941469BE9C7a44',
  RULING_EXECUTOR: import.meta.env.VITE_RULING_EXECUTOR_ADDRESS || '0x2a49b1826810AefAfFf93eC9317A426BbF8DC11f',
} as const

export const USDC_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint8' }] }
] as const

// v1.3: fileClaim takes 3 params, getClaim returns 17-field struct (no evidenceHash/evidenceUri)
export const CLAIMS_MANAGER_ABI = [
  { name: 'ClaimFiled', type: 'event',
    inputs: [
      { name: 'claimId', type: 'uint256', indexed: true },
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'claimant', type: 'address', indexed: true },
      { name: 'claimedAmount', type: 'uint256', indexed: false },
      { name: 'claimantDeposit', type: 'uint256', indexed: false },
      { name: 'councilId', type: 'bytes32', indexed: false }
    ] },
  { name: 'fileClaim', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'claimedAmount', type: 'uint256' },
      { name: 'paymentReceiptHash', type: 'bytes32' }
    ],
    outputs: [{ name: 'claimId', type: 'uint256' }] },
  { name: 'cancelClaim', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'claimId', type: 'uint256' }], outputs: [] },
  { name: 'getClaim', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'claimId', type: 'uint256' }],
    outputs: [{ name: 'claim', type: 'tuple', components: [
      { name: 'claimId', type: 'uint256' },
      { name: 'agentId', type: 'uint256' },
      { name: 'claimant', type: 'address' },
      { name: 'claimedAmount', type: 'uint256' },
      { name: 'approvedAmount', type: 'uint256' },
      { name: 'paymentReceiptHash', type: 'bytes32' },
      { name: 'termsHashAtClaimTime', type: 'bytes32' },
      { name: 'termsVersionAtClaimTime', type: 'uint256' },
      { name: 'providerAtClaimTime', type: 'address' },
      { name: 'councilId', type: 'bytes32' },
      { name: 'claimantDeposit', type: 'uint256' },
      { name: 'lockedCollateral', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'filedAt', type: 'uint256' },
      { name: 'evidenceDeadline', type: 'uint256' },
      { name: 'votingDeadline', type: 'uint256' },
      { name: 'hadVotes', type: 'bool' }
    ]}] },
  { name: 'getClaimsByClaimant', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'claimant', type: 'address' }],
    outputs: [{ name: 'claimIds', type: 'uint256[]' }] },
  { name: 'getClaimsByAgent', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: 'claimIds', type: 'uint256[]' }] },
  { name: 'calculateRequiredDeposit', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'claimedAmount', type: 'uint256' }],
    outputs: [{ name: 'deposit', type: 'uint256' }] },
  { name: 'getVotingProgress', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'claimId', type: 'uint256' }],
    outputs: [{ name: 'progress', type: 'tuple', components: [
      { name: 'approveVotes', type: 'uint256' },
      { name: 'rejectVotes', type: 'uint256' },
      { name: 'abstainVotes', type: 'uint256' },
      { name: 'totalVotes', type: 'uint256' },
      { name: 'requiredQuorum', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'quorumReached', type: 'bool' }
    ]}] },
  { name: 'nextClaimId', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ name: 'nextId', type: 'uint256' }] }
] as const

export const ERC8004_REGISTRY_ABI = [
  { name: 'ownerOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }] },
  { name: 'getAgentUri', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ type: 'string' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint256' }] }
] as const

export const TERMS_REGISTRY_ABI = [
  { name: 'getActiveTerms', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: 'terms', type: 'tuple', components: [
      { name: 'agentId', type: 'uint256' },
      { name: 'version', type: 'uint256' },
      { name: 'contentHash', type: 'bytes32' },
      { name: 'contentUri', type: 'string' },
      { name: 'councilId', type: 'bytes32' },
      { name: 'registeredAt', type: 'uint256' },
      { name: 'isActive', type: 'bool' }
    ]}] }
] as const

export const COLLATERAL_VAULT_ABI = [
  { name: 'getAccount', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: 'account', type: 'tuple', components: [
      { name: 'agentId', type: 'uint256' },
      { name: 'balance', type: 'uint256' },
      { name: 'lockedAmount', type: 'uint256' },
      { name: 'withdrawalInitiatedAt', type: 'uint256' },
      { name: 'withdrawalAmount', type: 'uint256' }
    ]}] }
] as const

export const TRUSTFUL_VALIDATOR_ABI = [
  { name: 'isValidated', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'checkConditions', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [
      { name: 'hasCollateral', type: 'bool' },
      { name: 'hasTerms', type: 'bool' },
      { name: 'councilActive', type: 'bool' },
      { name: 'noWithdrawalPending', type: 'bool' }
    ] }
] as const

export const COUNCIL_REGISTRY_ABI = [
  { name: 'getCouncil', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'councilId', type: 'bytes32' }],
    outputs: [{ name: 'council', type: 'tuple', components: [
      { name: 'id', type: 'bytes32' },
      { name: 'name', type: 'string' },
      { name: 'vertical', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'quorumPercentage', type: 'uint256' },
      { name: 'votingPeriodDays', type: 'uint256' },
      { name: 'evidencePeriodDays', type: 'uint256' },
      { name: 'claimDepositPercentage', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
      { name: 'memberCount', type: 'uint256' },
      { name: 'createdAt', type: 'uint256' }
    ]}] }
] as const

export const config = createConfig({
  chains: [baseSepolia],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http('https://base-sepolia-rpc.publicnode.com', {
      batch: true, retryCount: 3, retryDelay: 1000
    })
  },
})

declare module 'wagmi' {
  interface Register { config: typeof config }
}
