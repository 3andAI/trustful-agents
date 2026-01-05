# GitHub Sync Update

## Problem

Your GitHub repository is in a **broken state** - it imports files that don't exist:

1. `apps/governance-dashboard/src/App.tsx` imports `PendingVotesPage` → File missing
2. `apps/governance-dashboard/src/pages/Councils.tsx` imports `useSafeTransaction` → File missing  
3. `apps/governance-api/src/index.ts` imports `pendingRoutes` → File missing
4. Database migration `003_pending_transactions.sql` → File missing

## Files to Add

Extract this zip to your repository root:

```
apps/
├── governance-api/
│   └── src/
│       ├── routes/
│       │   └── pending.ts          ← NEW: Pending transactions API
│       └── db/
│           └── migrations/
│               └── 003_pending_transactions.sql  ← NEW: DB migration
└── governance-dashboard/
    └── src/
        ├── hooks/
        │   └── useSafe.ts          ← NEW: Safe SDK integration hook
        └── pages/
            └── PendingVotes.tsx    ← NEW: Pending votes page

docs/
├── ARCHITECTURE-v1.3.md            ← NEW: Updated architecture doc
└── API_REFERENCE.md                ← NEW: API documentation
```

## After Adding Files

1. Run database migration:
```bash
psql -d trustful_governance -f apps/governance-api/src/db/migrations/003_pending_transactions.sql
```

2. Rebuild backend:
```bash
cd apps/governance-api
npm run build
pm2 restart governance-api
```

3. Rebuild frontend:
```bash
cd apps/governance-dashboard
npm run build
```

4. Commit to GitHub:
```bash
git add .
git commit -m "Add missing files: pending transactions, Safe SDK integration, docs"
git push
```

## What These Files Do

### pending.ts
REST API endpoints for storing and retrieving transaction metadata:
- `GET /pending` - List pending transactions with confirmation counts
- `POST /pending` - Store transaction metadata after proposing
- `POST /pending/sync` - Sync statuses with Safe Transaction Service

### useSafe.ts
React hook for Safe multisig integration:
- Reads nonce from Safe contract (avoids API rate limits)
- Signs transactions with MetaMask
- Proposes directly to Safe Transaction Service
- Stores metadata in our database

### PendingVotes.tsx
Page showing pending governance transactions:
- Human-readable descriptions of what each transaction does
- Progress bars showing confirmation status
- "Vote in Safe" buttons linking to Safe UI

### ARCHITECTURE-v1.3.md
Updated architecture documentation reflecting:
- Blockchain-first dashboard architecture
- Safe SDK integration decisions
- Pending transactions metadata system
- Deployment architecture

### API_REFERENCE.md
Complete API documentation for developers:
- All endpoints with request/response examples
- Authentication flow
- Error responses
