# Council Dashboard

Council Dashboard for Trustful Agents - allows council members to review claims and vote on disputes.

## Features

- **Claim Queue**: View all pending claims assigned to your councils
- **Claim Detail**: Review evidence and claim details
- **Voting**: Cast votes (Approve/Reject/Abstain) with optional reasoning
- **Vote Changing**: Update your vote during the voting period
- **Voting History**: Track your past votes and outcomes

## User Stories Implemented

| ID | Story | Status |
|----|-------|--------|
| CM-01 | See claims assigned to my council | ✅ Done |
| CM-02 | Review claim evidence | ✅ Done |
| CM-03 | Cast vote (approve/reject with amount) | ✅ Done |
| CM-04 | See voting deadline | ✅ Done |
| CM-05 | See other members' votes | ✅ Done |
| CM-06 | See my share of forfeited deposits | ⚠️ Partial (needs subgraph) |
| CM-07 | See my voting history | ⚠️ Partial (needs subgraph) |
| CM-08 | Get notified of new claims | ❌ Not Done |
| CM-09 | Abstain from voting | ✅ Done |
| CM-11 | Change vote during voting period | ✅ Done |

## Prerequisites

- Node.js 18+
- pnpm or npm
- MetaMask or compatible wallet
- Access to Base Sepolia testnet

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# The app will be available at http://localhost:5173
# API requests are proxied to http://localhost:3001
```

## Production Build

```bash
# Build the app
pnpm build

# Preview the build
pnpm preview

# Or run with server.js
PORT=3000 API_URL=http://localhost:3001 node server.js
```

## Environment Variables

Create a `.env` file based on `.env.example`:

```env
VITE_API_URL=https://api.trustful-agents.ai:3001
VITE_WALLETCONNECT_PROJECT_ID=your-project-id
VITE_CLAIMS_MANAGER_ADDRESS=0x...
VITE_RULING_EXECUTOR_ADDRESS=0x...
```

## API Extension

This dashboard requires the governance-api to be extended with claims endpoints. See `api-extension/claims.ts` for the routes to add.

### Required API Endpoints

- `GET /claims` - List claims with filters
- `GET /claims/:id` - Get claim details
- `GET /claims/:id/votes` - Get votes for a claim
- `GET /claims/:id/my-vote` - Check if user has voted
- `POST /claims/:id/vote` - Prepare vote transaction
- `POST /claims/:id/finalize` - Prepare finalize transaction
- `GET /claims/members/:address/councils` - Get member's councils
- `GET /claims/members/:address/pending-claims` - Get pending claims for member

### Database Migration

Run `api-extension/migrations/004_claims_metadata.sql` to add claims tables.

## Architecture

```
council-dashboard/
├── src/
│   ├── components/     # React components
│   │   └── Layout.tsx  # Main layout with sidebar
│   ├── config/
│   │   └── wagmi.ts    # Wallet configuration
│   ├── hooks/
│   │   ├── useWallet.ts   # Wallet connection hook
│   │   └── useClaims.ts   # Claims data hooks
│   ├── lib/
│   │   └── api.ts      # API client
│   └── pages/
│       ├── Connect.tsx      # Wallet connection page
│       ├── Dashboard.tsx    # Main dashboard
│       ├── Claims.tsx       # Claims queue
│       ├── ClaimDetail.tsx  # Claim detail with voting
│       └── History.tsx      # Voting history
├── public/             # Static assets
├── server.js           # Production server
└── vite.config.ts      # Vite configuration
```

## Contract Integration

The dashboard interacts with these contracts:

- **ClaimsManager**: File claims, submit evidence, vote, finalize
- **CouncilRegistry**: Check council membership
- **CollateralVault**: View collateral balances

## Deployment

### With pm2

```bash
# Build first
pnpm build

# Start with pm2
pm2 start ecosystem.config.js --only council-dashboard
```

### Ecosystem config entry

```javascript
{
  name: 'council-dashboard',
  script: 'server.js',
  cwd: './apps/council-dashboard',
  env: {
    PORT: 3002,
    API_URL: 'http://localhost:3001'
  }
}
```

### Nginx config

```nginx
server {
    server_name council.trustful-agents.ai;
    
    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Future Improvements

1. **Subgraph Integration**: Full voting history and deposit earnings tracking
2. **Email Notifications**: Alert council members of new claims
3. **Evidence Viewer**: In-app IPFS document viewer
4. **Batch Voting**: Vote on multiple claims at once
5. **Mobile App**: Native mobile experience
