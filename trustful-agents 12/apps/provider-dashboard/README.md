# Provider Dashboard

Dashboard for AI agent providers to manage their trust credentials.

## Features

- **Agent Management**: View and manage registered agents
- **Collateral Management**: Deposit/withdraw USDC collateral
- **T&C Management**: Register and update Terms & Conditions
- **Validation Status**: Request and monitor validation status
- **Claims Overview**: View claims filed against agents
- **Counter-Evidence**: Submit evidence to dispute claims

## Setup

```bash
pnpm install
pnpm dev
```

## Environment Variables

```bash
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_SUBGRAPH_URL=...
```

## Tech Stack

- Next.js 14 (App Router)
- wagmi + viem
- TailwindCSS
- @trustful-agents/sdk
