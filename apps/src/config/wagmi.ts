import { createConfig, http } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

// Contract addresses on Base Sepolia
export const CONTRACTS = {
  USDC: '0x63d5a529eD8a8192E2201c0cea4469397efE30Ba',
  ERC8004_REGISTRY: '0xb3B4b5042Fd3600404846671Ff5558719860b694',
  COLLATERAL_VAULT: '0xDDC4eebCf1D6e62821A25Fa26B6Df021dcee11C4',
  TERMS_REGISTRY: '0x5Ae03075290e284ee05Fa648843F0ce81fffFA5d',
  COUNCIL_REGISTRY: '0x54996FAE14f35C32EfA2F0f92237e9B924a93F66',
  TRUSTFUL_VALIDATOR: '0xe75817D8aADA91968AD492d583602Ec10B2569a6',
  // These need to be added once deployed
  CLAIMS_MANAGER: import.meta.env.VITE_CLAIMS_MANAGER_ADDRESS || '0x4826E3745cb63f91ED9d24Ff67a06aC200e1156b',
  RULING_EXECUTOR: import.meta.env.VITE_RULING_EXECUTOR_ADDRESS || '0x567f98221858C46dc93F2bF76400C85442d2cf68',
} as const

// ABI for USDC (ERC20)
export const USDC_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }]
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }]
  }
] as const

// ClaimsManager ABI (key functions)
export const CLAIMS_MANAGER_ABI = [
  // File claim
  {
    name: 'fileClaim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'claimedAmount', type: 'uint256' },
      { name: 'evidenceHash', type: 'bytes32' },
      { name: 'evidenceUri', type: 'string' },
      { name: 'paymentReceiptHash', type: 'bytes32' }
    ],
    outputs: [{ name: 'claimId', type: 'uint256' }]
  },
  // Submit additional evidence
  {
    name: 'submitAdditionalEvidence',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'claimId', type: 'uint256' },
      { name: 'evidenceHash', type: 'bytes32' },
      { name: 'evidenceUri', type: 'string' }
    ],
    outputs: []
  },
  // Cancel claim
  {
    name: 'cancelClaim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'claimId', type: 'uint256' }],
    outputs: []
  },
  // Get claim
  {
    name: 'getClaim',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'claimId', type: 'uint256' }],
    outputs: [{
      name: 'claim',
      type: 'tuple',
      components: [
        { name: 'claimId', type: 'uint256' },
        { name: 'agentId', type: 'uint256' },
        { name: 'claimant', type: 'address' },
        { name: 'claimedAmount', type: 'uint256' },
        { name: 'approvedAmount', type: 'uint256' },
        { name: 'evidenceHash', type: 'bytes32' },
        { name: 'evidenceUri', type: 'string' },
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
      ]
    }]
  },
  // Get claims by claimant
  {
    name: 'getClaimsByClaimant',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'claimant', type: 'address' }],
    outputs: [{ name: 'claimIds', type: 'uint256[]' }]
  },
  // Get claims by agent
  {
    name: 'getClaimsByAgent',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: 'claimIds', type: 'uint256[]' }]
  },
  // Calculate required deposit
  {
    name: 'calculateRequiredDeposit',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'claimedAmount', type: 'uint256' }
    ],
    outputs: [{ name: 'deposit', type: 'uint256' }]
  },
  // Get voting progress
  {
    name: 'getVotingProgress',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'claimId', type: 'uint256' }],
    outputs: [{
      name: 'progress',
      type: 'tuple',
      components: [
        { name: 'approveVotes', type: 'uint256' },
        { name: 'rejectVotes', type: 'uint256' },
        { name: 'abstainVotes', type: 'uint256' },
        { name: 'totalVotes', type: 'uint256' },
        { name: 'requiredQuorum', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'quorumReached', type: 'bool' }
      ]
    }]
  },
  // Next claim ID
  {
    name: 'nextClaimId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'nextId', type: 'uint256' }]
  }
] as const

// ERC8004 Registry ABI (for agent info)
export const ERC8004_REGISTRY_ABI = [
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }]
  },
  {
    name: 'getAgentUri',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ type: 'string' }]
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  }
] as const

// Terms Registry ABI
export const TERMS_REGISTRY_ABI = [
  {
    name: 'getActiveTerms',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{
      name: 'terms',
      type: 'tuple',
      components: [
        { name: 'agentId', type: 'uint256' },
        { name: 'version', type: 'uint256' },
        { name: 'contentHash', type: 'bytes32' },
        { name: 'contentUri', type: 'string' },
        { name: 'councilId', type: 'bytes32' },
        { name: 'registeredAt', type: 'uint256' },
        { name: 'isActive', type: 'bool' }
      ]
    }]
  }
] as const

// Collateral Vault ABI
export const COLLATERAL_VAULT_ABI = [
  {
    name: 'getAccount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{
      name: 'account',
      type: 'tuple',
      components: [
        { name: 'agentId', type: 'uint256' },
        { name: 'balance', type: 'uint256' },
        { name: 'lockedAmount', type: 'uint256' },
        { name: 'withdrawalInitiatedAt', type: 'uint256' },
        { name: 'withdrawalAmount', type: 'uint256' }
      ]
    }]
  }
] as const

// Trustful Validator ABI
export const TRUSTFUL_VALIDATOR_ABI = [
  {
    name: 'isValidated',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ type: 'bool' }]
  },
  {
    name: 'checkConditions',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [
      { name: 'hasCollateral', type: 'bool' },
      { name: 'hasTerms', type: 'bool' },
      { name: 'councilActive', type: 'bool' },
      { name: 'noWithdrawalPending', type: 'bool' }
    ]
  }
] as const

// Council Registry ABI
export const COUNCIL_REGISTRY_ABI = [
  {
    name: 'getCouncil',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'councilId', type: 'bytes32' }],
    outputs: [{
      name: 'council',
      type: 'tuple',
      components: [
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
      ]
    }]
  }
] as const

export const config = createConfig({
  chains: [baseSepolia],
  connectors: [
    injected(),
  ],
  transports: {
    [baseSepolia.id]: http()
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
