/**
 * Pinata IPFS Service
 * Uploads files to IPFS via Pinata API
 */

// Read from environment variables (set in .env or at build time)
const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY || ''
const PINATA_SECRET_KEY = import.meta.env.VITE_PINATA_SECRET_KEY || ''
const PINATA_API_URL = 'https://api.pinata.cloud'

// Check if Pinata is configured
export const isPinataConfigured = (): boolean => {
  return !!PINATA_API_KEY && !!PINATA_SECRET_KEY
}

interface PinataResponse {
  IpfsHash: string
  PinSize: number
  Timestamp: string
}

/**
 * Upload a file to IPFS via Pinata
 */
export async function uploadToIPFS(file: File): Promise<{ hash: string; uri: string }> {
  if (!isPinataConfigured()) {
    throw new Error('Pinata API keys not configured. Set VITE_PINATA_API_KEY and VITE_PINATA_SECRET_KEY in .env file.')
  }

  const formData = new FormData()
  formData.append('file', file)

  // Add metadata
  const metadata = JSON.stringify({
    name: file.name,
    keyvalues: {
      type: 'terms-and-conditions',
      timestamp: Date.now().toString(),
    },
  })
  formData.append('pinataMetadata', metadata)

  const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
    method: 'POST',
    headers: {
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_SECRET_KEY,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to upload to IPFS: ${error}`)
  }

  const data: PinataResponse = await response.json()
  
  return {
    hash: data.IpfsHash,
    uri: `ipfs://${data.IpfsHash}`,
  }
}

/**
 * Upload JSON data to IPFS via Pinata
 */
export async function uploadJSONToIPFS(
  data: Record<string, unknown>,
  name: string
): Promise<{ hash: string; uri: string }> {
  const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_SECRET_KEY,
    },
    body: JSON.stringify({
      pinataContent: data,
      pinataMetadata: {
        name,
        keyvalues: {
          type: 'terms-and-conditions',
          timestamp: Date.now().toString(),
        },
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to upload to IPFS: ${error}`)
  }

  const result: PinataResponse = await response.json()
  
  return {
    hash: result.IpfsHash,
    uri: `ipfs://${result.IpfsHash}`,
  }
}

/**
 * Get gateway URL for IPFS content
 * Uses multiple gateways for reliability
 */
export function getIPFSGatewayUrl(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    const hash = uri.replace('ipfs://', '')
    // Use ipfs.io which is more reliable than Pinata's public gateway
    return `https://ipfs.io/ipfs/${hash}`
  }
  return uri
}

/**
 * Get alternative gateway URLs for IPFS content
 */
export function getIPFSGatewayUrls(uri: string): string[] {
  if (uri.startsWith('ipfs://')) {
    const hash = uri.replace('ipfs://', '')
    return [
      `https://ipfs.io/ipfs/${hash}`,
      `https://cloudflare-ipfs.com/ipfs/${hash}`,
      `https://gateway.pinata.cloud/ipfs/${hash}`,
      `https://dweb.link/ipfs/${hash}`,
    ]
  }
  return [uri]
}

/**
 * Test Pinata connection
 */
export async function testPinataConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${PINATA_API_URL}/data/testAuthentication`, {
      headers: {
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET_KEY,
      },
    })
    return response.ok
  } catch {
    return false
  }
}
