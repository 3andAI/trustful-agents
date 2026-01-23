import { keccak256, toBytes } from 'viem'
import { USDC_DECIMALS, GRACE_PERIOD_SECONDS, BLOCK_EXPLORER_URL } from '../config/contracts'

/**
 * Hash Terms & Conditions content
 */
export function hashTermsContent(content: string): `0x${string}` {
  return keccak256(toBytes(content))
}

/**
 * Format USDC amount (6 decimals) for display
 */
export function formatUsdc(amount: bigint, options?: { compact?: boolean }): string {
  const divisor = BigInt(10 ** USDC_DECIMALS)
  const whole = amount / divisor
  const fraction = amount % divisor
  
  if (options?.compact && whole >= BigInt(1000)) {
    const num = Number(whole)
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  }
  
  if (fraction === BigInt(0)) {
    return whole.toLocaleString()
  }
  
  const fractionStr = fraction.toString().padStart(USDC_DECIMALS, '0').replace(/0+$/, '')
  return `${whole.toLocaleString()}.${fractionStr}`
}

/**
 * Parse USDC amount from string to bigint (6 decimals)
 */
export function parseUsdc(amount: string): bigint {
  const cleaned = amount.replace(/[,\s]/g, '')
  const parts = cleaned.split('.')
  const whole = BigInt(parts[0] || '0')
  
  if (parts.length === 1) {
    return whole * BigInt(10 ** USDC_DECIMALS)
  }
  
  const fractionStr = (parts[1] || '').padEnd(USDC_DECIMALS, '0').slice(0, USDC_DECIMALS)
  const fraction = BigInt(fractionStr)
  
  return whole * BigInt(10 ** USDC_DECIMALS) + fraction
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

/**
 * Shorten hash/bytes32 for display
 */
export function shortenHash(hash: string, chars = 6): string {
  if (hash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    return '0x0...0'
  }
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`
}

/**
 * Format timestamp to readable date in UTC
 */
export function formatTimestamp(timestamp: bigint, options?: { relative?: boolean }): string {
  if (timestamp === BigInt(0)) return 'Never'
  
  const date = new Date(Number(timestamp) * 1000)
  
  if (options?.relative) {
    const now = Date.now()
    const diff = date.getTime() - now
    const absDiff = Math.abs(diff)
    
    if (absDiff < 60000) return 'Just now'
    
    const minutes = Math.floor(absDiff / 60000)
    const hours = Math.floor(absDiff / 3600000)
    const days = Math.floor(absDiff / 86400000)
    
    if (diff > 0) {
      if (days > 0) return `in ${days}d`
      if (hours > 0) return `in ${hours}h`
      return `in ${minutes}m`
    } else {
      if (days > 0) return `${days}d ago`
      if (hours > 0) return `${hours}h ago`
      return `${minutes}m ago`
    }
  }
  
  // Format in UTC
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
}

/**
 * Calculate withdrawal executable timestamp
 */
export function getWithdrawalExecutableAt(initiatedAt: bigint): bigint {
  if (initiatedAt === BigInt(0)) return BigInt(0)
  return initiatedAt + BigInt(GRACE_PERIOD_SECONDS)
}

/**
 * Check if withdrawal can be executed
 */
export function canExecuteWithdrawal(initiatedAt: bigint): boolean {
  if (initiatedAt === BigInt(0)) return false
  const executableAt = getWithdrawalExecutableAt(initiatedAt)
  return BigInt(Math.floor(Date.now() / 1000)) >= executableAt
}

/**
 * Get time remaining for withdrawal grace period
 */
export function getWithdrawalTimeRemaining(initiatedAt: bigint): {
  days: number
  hours: number
  minutes: number
  total: number
} {
  if (initiatedAt === BigInt(0)) {
    return { days: 0, hours: 0, minutes: 0, total: 0 }
  }
  
  const executableAt = getWithdrawalExecutableAt(initiatedAt)
  const now = BigInt(Math.floor(Date.now() / 1000))
  
  if (now >= executableAt) {
    return { days: 0, hours: 0, minutes: 0, total: 0 }
  }
  
  const remaining = Number(executableAt - now)
  const days = Math.floor(remaining / 86400)
  const hours = Math.floor((remaining % 86400) / 3600)
  const minutes = Math.floor((remaining % 3600) / 60)
  
  return { days, hours, minutes, total: remaining }
}

/**
 * Format time remaining as readable string
 */
export function formatTimeRemaining(time: { days: number; hours: number; minutes: number; total: number }): string {
  if (time.total === 0) return 'Ready'
  
  const parts: string[] = []
  if (time.days > 0) parts.push(`${time.days}d`)
  if (time.hours > 0) parts.push(`${time.hours}h`)
  if (time.minutes > 0 || parts.length === 0) parts.push(`${time.minutes}m`)
  
  return parts.join(' ')
}

/**
 * Get block explorer URL for address
 */
export function getAddressUrl(address: string): string {
  return `${BLOCK_EXPLORER_URL}/address/${address}`
}

/**
 * Get block explorer URL for transaction
 */
export function getTxUrl(txHash: string): string {
  return `${BLOCK_EXPLORER_URL}/tx/${txHash}`
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Class name utility
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Revocation reason to human readable string
 */
export function revocationReasonToString(reason: number): string {
  const reasons: Record<number, string> = {
    0: 'None',
    1: 'Collateral Below Minimum',
    2: 'Terms Not Registered',
    3: 'Terms Invalidated',
    4: 'Ownership Changed',
    5: 'Manual Revocation',
    6: 'Emergency Pause',
  }
  return reasons[reason] || 'Unknown'
}
