/**
 * USDC utility functions
 * USDC has 6 decimals
 */

const USDC_DECIMALS = 6;
const USDC_MULTIPLIER = BigInt(10 ** USDC_DECIMALS);

/**
 * Parse a human-readable USDC amount to base units (6 decimals)
 * @param amount Human-readable amount (e.g., "100.50")
 * @returns BigInt in base units (e.g., 100500000n)
 */
export function parseUSDC(amount: string | number): bigint {
  const [whole, decimal = ""] = String(amount).split(".");
  const paddedDecimal = decimal.padEnd(USDC_DECIMALS, "0").slice(0, USDC_DECIMALS);
  return BigInt(whole + paddedDecimal);
}

/**
 * Format USDC base units to human-readable string
 * @param amount BigInt in base units
 * @param decimals Number of decimal places to show (default: 2)
 * @returns Formatted string (e.g., "100.50")
 */
export function formatUSDC(amount: bigint, decimals: number = 2): string {
  const str = amount.toString().padStart(USDC_DECIMALS + 1, "0");
  const whole = str.slice(0, -USDC_DECIMALS) || "0";
  const decimal = str.slice(-USDC_DECIMALS);
  
  if (decimals === 0) {
    return whole;
  }
  
  return `${whole}.${decimal.slice(0, decimals)}`;
}

/**
 * Format USDC with currency symbol
 * @param amount BigInt in base units
 * @returns Formatted string with $ symbol (e.g., "$100.50")
 */
export function formatUSDCWithSymbol(amount: bigint): string {
  return `$${formatUSDC(amount)}`;
}
