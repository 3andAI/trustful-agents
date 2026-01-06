import { type Address } from 'viem'

// =============================================================================
// Chain Configuration
// =============================================================================

export const CHAIN_ID = 84532 // Base Sepolia
export const BLOCK_EXPLORER_URL = 'https://sepolia.basescan.org'

// =============================================================================
// Contract Addresses - Base Sepolia
// =============================================================================

export const CONTRACTS = {
  usdc: '0x63d5a529eD8a8192E2201c0cea4469397efE30Ba' as Address,
  erc8004Registry: '0xb3B4b5042Fd3600404846671Ff5558719860b694' as Address,
  collateralVault: '0xDDC4eebCf1D6e62821A25Fa26B6Df021dcee11C4' as Address,
  termsRegistry: '0x5Ae03075290e284ee05Fa648843F0ce81fffFA5d' as Address,
  councilRegistry: '0x54996FAE14f35C32EfA2F0f92237e9B924a93F66' as Address,
  trustfulValidator: '0xe75817D8aADA91968AD492d583602Ec10B2569a6' as Address,
} as const

// =============================================================================
// Constants
// =============================================================================

export const USDC_DECIMALS = 6
export const GRACE_PERIOD_DAYS = 7
export const GRACE_PERIOD_SECONDS = GRACE_PERIOD_DAYS * 24 * 60 * 60
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.trustful-agents.ai'

// Check if contracts are configured
export const isConfigured = CONTRACTS.usdc !== '0x0000000000000000000000000000000000000000'

// =============================================================================
// ABIs
// =============================================================================

export const MockUsdcAbi = [
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
] as const

export const Erc8004RegistryAbi = [
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'mintAuto',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nextTokenId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // ERC721Enumerable
  {
    type: 'function',
    name: 'tokenOfOwnerByIndex',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

// Backwards compatibility alias
export const MockErc8004RegistryAbi = Erc8004RegistryAbi

export const CollateralVaultAbi = [
  {
    type: 'function',
    name: 'deposit',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getAccount',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [
      {
        name: 'account',
        type: 'tuple',
        components: [
          { name: 'balance', type: 'uint256' },
          { name: 'lockedAmount', type: 'uint256' },
          { name: 'withdrawalInitiatedAt', type: 'uint256' },
          { name: 'withdrawalAmount', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAvailableBalance',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: 'available', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

export const TermsRegistryAbi = [
  {
    type: 'function',
    name: 'registerTerms',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'contentHash', type: 'bytes32' },
      { name: 'contentUri', type: 'string' },
      { name: 'councilId', type: 'bytes32' },
    ],
    outputs: [{ name: 'version', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getActiveTerms',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [
      {
        name: 'terms',
        type: 'tuple',
        components: [
          { name: 'contentHash', type: 'bytes32' },
          { name: 'contentUri', type: 'string' },
          { name: 'councilId', type: 'bytes32' },
          { name: 'registeredAt', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
      },
      { name: 'version', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasActiveTerms',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const

export const TrustfulValidatorAbi = [
  {
    type: 'function',
    name: 'requestValidation',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: 'requestHash', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isValidated',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: 'isValid', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'checkConditions',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [
      {
        name: 'conditions',
        type: 'tuple',
        components: [
          { name: 'hasMinimumCollateral', type: 'bool' },
          { name: 'hasActiveTerms', type: 'bool' },
          { name: 'isOwnerValid', type: 'bool' },
          { name: 'councilIsActive', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getValidationRecord',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [
      {
        name: 'record',
        type: 'tuple',
        components: [
          { name: 'requestHash', type: 'bytes32' },
          { name: 'issuedAt', type: 'uint256' },
          { name: 'revokedAt', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'revocationReason', type: 'uint8' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'minimumCollateral',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const
