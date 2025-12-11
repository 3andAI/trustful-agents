import { keccak256, toBytes } from 'viem'

/**
 * Hash Terms & Conditions content
 * The content hash should match what's stored on IPFS
 */
export function hashTermsContent(content: string): `0x${string}` {
  return keccak256(toBytes(content))
}

/**
 * Format USDC amount (6 decimals) for display
 */
export function formatUsdc(amount: bigint): string {
  const divisor = BigInt(1e6)
  const whole = amount / divisor
  const fraction = amount % divisor
  
  if (fraction === BigInt(0)) {
    return whole.toString()
  }
  
  const fractionStr = fraction.toString().padStart(6, '0').replace(/0+$/, '')
  return `${whole}.${fractionStr}`
}

/**
 * Parse USDC amount from string to bigint (6 decimals)
 */
export function parseUsdc(amount: string): bigint {
  const parts = amount.split('.')
  const whole = BigInt(parts[0] || '0')
  
  if (parts.length === 1) {
    return whole * BigInt(1e6)
  }
  
  const fractionStr = (parts[1] || '').padEnd(6, '0').slice(0, 6)
  const fraction = BigInt(fractionStr)
  
  return whole * BigInt(1e6) + fraction
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * Format timestamp to readable date
 */
export function formatTimestamp(timestamp: bigint): string {
  if (timestamp === BigInt(0)) return 'Never'
  return new Date(Number(timestamp) * 1000).toLocaleString()
}
