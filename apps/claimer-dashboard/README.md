# Claimer Dashboard

File and track claims against AI agents on the Trustful network.

## Features

- **Dashboard**: Overview of your claims with stats
- **File Claim**: Step-by-step wizard to file a claim against an agent
- **My Claims**: View and filter all your claims
- **Agent Lookup**: Search agents and view their trust status
- **Claim Detail**: Track claim progress, evidence, voting status

## Prerequisites

- Node.js 18+
- Deployed ClaimsManager contract
- Governance API running

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```env
# API URL (no port for production)
VITE_API_URL=https://api.trustful-agents.ai

# Contract Addresses
VITE_CLAIMS_MANAGER_ADDRESS=0x4826E3745cb63f91ED9d24Ff67a06aC200e1156b
VITE_RULING_EXECUTOR_ADDRESS=0x567f98221858C46dc93F2bF76400C85442d2cf68

# Server config
PORT=3004
API_URL=http://localhost:3001
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Production

```bash
npm install
npm run build
npm start
```

Or with PM2:

```bash
pm2 start server.js --name claimer-dashboard
```

## Nginx Configuration

```nginx
server {
    listen 80;
    server_name claims.trustful-agents.ai;
    
    location / {
        proxy_pass http://127.0.0.1:3004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## User Stories Implemented

| ID | Story | Status |
|----|-------|--------|
| CL-01 | File a claim with evidence | ✅ |
| CL-02 | Know required deposit amount | ✅ |
| CL-03 | Submit additional evidence | ⚠️ UI ready |
| CL-04 | Track claim status | ✅ |
| CL-07 | Cancel claim | ✅ |

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- wagmi/viem
- React Query
- React Router
