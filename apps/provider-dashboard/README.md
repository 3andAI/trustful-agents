# Provider Dashboard

A minimal dashboard for AI agent providers to register and validate their agents on the Trustful Agents protocol.

## Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure contract addresses:**
   
   Edit `src/config/contracts.ts` and update the contract addresses with your deployed contracts on Base Sepolia:
   
   ```typescript
   export const CONTRACTS = {
     mockUsdc: '0x...',
     mockErc8004Registry: '0x...',
     collateralVault: '0x...',
     termsRegistry: '0x...',
     trustfulValidator: '0x...',
   }
   ```

3. **Run the development server:**
   ```bash
   pnpm dev
   ```

4. **Open http://localhost:5173** in your browser

## Provider Flow

The dashboard guides providers through these steps:

1. **Connect Wallet** - Connect with MetaMask or other injected wallet on Base Sepolia
2. **Mint Agent** - Create an ERC-8004 agent NFT (test registry)
3. **Deposit Collateral** - Mint test USDC, approve, and deposit to CollateralVault
4. **Register T&C** - Register Terms & Conditions with content hash and IPFS URI
5. **Request Validation** - Call TrustfulValidator to validate the agent

## Tech Stack

- **Vite** - Fast build tool
- **React 18** - UI framework
- **wagmi v2** - React hooks for Ethereum
- **viem** - TypeScript Ethereum library
- **TailwindCSS** - Utility-first CSS
- **TanStack Query** - Data fetching and caching

## Contract Integration

The dashboard interacts with these contracts:

| Contract | Purpose |
|----------|---------|
| MockUSDC | Test ERC20 token with mint function |
| MockERC8004Registry | Test agent registry (ERC-721) |
| CollateralVault | USDC deposits with 7-day withdrawal grace period |
| TermsRegistry | T&C registration with content hash |
| TrustfulValidator | Validates agents when all conditions met |

## Network

**Base Sepolia** (Chain ID: 84532)
- RPC: https://sepolia.base.org
- Explorer: https://sepolia.basescan.org

Get testnet ETH from https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

## Notes

- The dashboard uses placeholder values for T&C content - in production, you'd upload to IPFS first
- Council ID is set to zero (null) for MVP - councils aren't enforced
- Minimum collateral is typically 100 USDC (set during contract deployment)
