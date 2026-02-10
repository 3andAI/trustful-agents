# Trustful Agents — Configuration Update Guide

Last updated: 2026-02-06

This guide covers how to update the centralized configuration system after common changes like contract redeployments, network migrations, or service updates.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Quick Reference Commands](#quick-reference-commands)
3. [Scenario: Redeploy Smart Contracts](#scenario-redeploy-smart-contracts)
4. [Scenario: Switch Networks](#scenario-switch-networks)
5. [Scenario: Update Service URLs](#scenario-update-service-urls)
6. [Scenario: Update ABIs After Contract Changes](#scenario-update-abis-after-contract-changes)
7. [Scenario: Add a New Contract](#scenario-add-a-new-contract)
8. [Scenario: Update Subgraph](#scenario-update-subgraph)
9. [Troubleshooting](#troubleshooting)
10. [File Locations Reference](#file-locations-reference)

---

## Architecture Overview

```
config/
├── networks/base-sepolia.json    # SOURCE OF TRUTH for addresses, URLs, settings
├── abis/*.json                   # Full ABIs extracted from Foundry
├── scripts/
│   ├── generate.sh               # Master generator (runs all steps)
│   ├── extract-abis.sh           # Extracts ABIs from contracts/out/
│   ├── generate-ts.js            # Generates contracts.ts
│   ├── generate-env.sh           # Generates .env files
│   └── generate-subgraph.sh      # Generates subgraph.yaml
└── generated/                    # OUTPUT (gitignored)
    ├── contracts.ts              # TypeScript config for all apps
    ├── env.dashboard             # Vite env vars
    ├── env.api                   # API env vars
    └── subgraph.yaml             # The Graph manifest
```

**Data flow:**
1. Edit `config/networks/base-sepolia.json` (or run `forge` for new ABIs)
2. Run `config/scripts/generate.sh`
3. Rebuild apps: `npm run build`
4. Deploy

---

## Quick Reference Commands

```bash
# Full regenerate (after any config change)
cd ~/trustful-agents
bash config/scripts/generate.sh base-sepolia

# Rebuild all apps
cd apps/governance-api && npm run build && cd ../..
cd apps/provider-dashboard && npm run build && cd ../..
cd apps/claimer-dashboard && npm run build && cd ../..
cd apps/council-dashboard && npm run build && cd ../..
cd apps/governance-dashboard && npm run build && cd ../..

# Quick verification
grep -c '"type": "function"' config/generated/contracts.ts  # Should be 250+
grep "claimsManager" config/generated/contracts.ts | head -1

# Deploy
pm2 restart all
```

---

## Scenario: Redeploy Smart Contracts

After running `forge script` to deploy new contracts:

### Step 1: Update network config with new addresses

```bash
nano ~/trustful-agents/config/networks/base-sepolia.json
```

Update the `contracts` section with new addresses:
```json
{
  "contracts": {
    "usdc": "0x...",
    "erc8004Registry": "0x...",
    "collateralVault": "0xNEW_ADDRESS",
    "termsRegistry": "0xNEW_ADDRESS",
    ...
  },
  "startBlock": 12345678   // Update to deployment block!
}
```

### Step 2: Extract new ABIs (if contract code changed)

```bash
cd ~/trustful-agents/contracts
forge build

cd ~/trustful-agents
bash config/scripts/extract-abis.sh
```

### Step 3: Regenerate all config

```bash
bash config/scripts/generate.sh base-sepolia
```

### Step 4: Rebuild and deploy

```bash
# Build all apps
cd apps/governance-api && npm run build && cd ../..
cd apps/provider-dashboard && npm run build && cd ../..
cd apps/claimer-dashboard && npm run build && cd ../..
cd apps/council-dashboard && npm run build && cd ../..
cd apps/governance-dashboard && npm run build && cd ../..

# Copy to server and restart
pm2 restart all
```

### Step 5: Verify

```bash
# Check a dashboard is using new address
grep "0xNEW_ADDRESS" apps/provider-dashboard/dist/assets/*.js

# Test API
curl -s https://api.trustful-agents.ai/health | jq .

# Test a contract read (replace with actual agent ID)
curl -s https://api.trustful-agents.ai/validation/1 | jq .
```

---

## Scenario: Switch Networks

To switch from Base Sepolia to Base Mainnet:

### Step 1: Create mainnet config

```bash
cp ~/trustful-agents/config/networks/base-sepolia.json \
   ~/trustful-agents/config/networks/base-mainnet.json
```

### Step 2: Edit the new config

```bash
nano ~/trustful-agents/config/networks/base-mainnet.json
```

Update:
```json
{
  "network": "base",
  "chainId": 8453,
  "rpcUrl": "https://mainnet.base.org",
  "blockExplorerUrl": "https://basescan.org",
  "startBlock": <DEPLOYMENT_BLOCK>,
  
  "contracts": {
    // All new mainnet addresses
  },
  
  "safe": {
    "address": "0x...",
    "txServiceUrl": "https://safe-transaction-base.safe.global",
    "networkPrefix": "base"
  },
  
  "services": {
    "apiUrl": "https://api.trustful-agents.ai",
    "subgraphUrl": "https://api.studio.thegraph.com/query/.../mainnet/v1.0.0"
  }
}
```

### Step 3: Generate for mainnet

```bash
bash config/scripts/generate.sh base-mainnet
```

### Step 4: Rebuild all apps

Same as above.

### Verification

```bash
# Check chain ID in generated config
grep "CHAIN_ID" config/generated/contracts.ts
# Should show: export const CHAIN_ID: number = 8453;
```

---

## Scenario: Update Service URLs

To update API URL, Subgraph URL, IPFS gateway, etc.:

### Step 1: Edit network config

```bash
nano ~/trustful-agents/config/networks/base-sepolia.json
```

Update the `services` section:
```json
{
  "services": {
    "apiUrl": "https://new-api.trustful-agents.ai",
    "subgraphUrl": "https://api.studio.thegraph.com/query/.../v1.4.0",
    "subgraphVersion": "v1.4.0",
    "ipfsGateway": "https://new-gateway.pinata.cloud/ipfs"
  }
}
```

### Step 2: Regenerate and rebuild

```bash
bash config/scripts/generate.sh base-sepolia

# Rebuild dashboards (they bake URLs at build time)
cd apps/provider-dashboard && npm run build && cd ../..
cd apps/claimer-dashboard && npm run build && cd ../..
cd apps/council-dashboard && npm run build && cd ../..
cd apps/governance-dashboard && npm run build && cd ../..
```

### Verification

```bash
grep "subgraphUrl\|apiUrl" config/generated/contracts.ts
```

---

## Scenario: Update ABIs After Contract Changes

When contract functions/events change but addresses stay the same:

### Step 1: Rebuild contracts

```bash
cd ~/trustful-agents/contracts
forge build
```

### Step 2: Re-extract ABIs

```bash
cd ~/trustful-agents
bash config/scripts/extract-abis.sh
```

Expected output:
```
Extracting ABIs from Foundry artifacts...
  56 functions, 15 events
  ✓ CouncilRegistry
  30 functions, 10 events
  ✓ RulingExecutor
  ...
Done: 8 extracted, 0 failed
```

### Step 3: Regenerate TypeScript

```bash
bash config/scripts/generate.sh base-sepolia
```

### Step 4: Check for breaking changes

```bash
# Try building governance-api first (strictest types)
cd apps/governance-api && npm run build
```

If there are errors like `Property 'X' does not exist on type 'never'`:
- A function was removed or renamed
- Check the error location and update the code to use the new function name

### Step 5: Rebuild all and deploy

---

## Scenario: Add a New Contract

### Step 1: Add to network config

```bash
nano ~/trustful-agents/config/networks/base-sepolia.json
```

Add to `contracts` section:
```json
{
  "contracts": {
    ...existing...,
    "newContract": "0xNEW_CONTRACT_ADDRESS"
  }
}
```

### Step 2: Add ABI mapping

```bash
nano ~/trustful-agents/config/scripts/extract-abis.sh
```

Add to the `CONTRACTS` array:
```bash
declare -A CONTRACTS=(
  ...existing...,
  ["NewContract"]="NewContract.sol/NewContract.json"
)
```

### Step 3: Extract and regenerate

```bash
cd ~/trustful-agents/contracts && forge build && cd ..
bash config/scripts/generate.sh base-sepolia
```

### Step 4: Use in apps

```typescript
// In any app:
import { 
  CONTRACTS, 
  NewContractAbi 
} from '../../../../config/generated/contracts';

// Use it
const result = await publicClient.readContract({
  address: CONTRACTS.newContract,
  abi: NewContractAbi,
  functionName: 'someFunction',
});
```

---

## Scenario: Update Subgraph

After changing the subgraph (new events, handlers, etc.):

### Step 1: Edit the template (NOT subgraph.yaml)

```bash
nano ~/trustful-agents/subgraph/subgraph.template.yaml
```

Add new event handlers, entities, etc.

### Step 2: Regenerate

```bash
bash config/scripts/generate-subgraph.sh base-sepolia
```

### Step 3: Test locally

```bash
cd ~/trustful-agents/subgraph
graph codegen && graph build
```

### Step 4: Deploy to The Graph

```bash
graph deploy --studio trustful-agents
```

### Step 5: Update subgraph URL in config

```bash
nano ~/trustful-agents/config/networks/base-sepolia.json
# Update services.subgraphUrl and services.subgraphVersion
```

Then regenerate and rebuild dashboards.

**Note:** Subgraph ABIs are kept separate in `subgraph/abis/` because they need historical event signatures that may differ from current contract ABIs.

---

## Troubleshooting

### "Property 'X' does not exist on type 'never'"

**Cause:** ABI doesn't have the function you're trying to call.

**Fix:**
```bash
# Check if function exists in ABI
grep "functionName" config/abis/ContractName.json

# Re-extract ABIs if needed
cd contracts && forge build && cd ..
bash config/scripts/extract-abis.sh
bash config/scripts/generate.sh base-sepolia
```

### "90 errors" after regenerating

**Cause:** ABIs only have events, not functions.

**Fix:** The `extract-abis.sh` script probably failed silently. Check:
```bash
grep -c '"type": "function"' config/abis/CouncilRegistry.json
# Should be 50+, not 0
```

If 0, re-run extraction:
```bash
cd contracts && forge build && cd ..
bash config/scripts/extract-abis.sh
```

### Dashboard shows old data after config change

**Cause:** Config is baked in at build time.

**Fix:** Rebuild the dashboard:
```bash
cd apps/provider-dashboard && npm run build
# Then redeploy
```

### Subgraph won't build: "Event X not in ABI"

**Cause:** Contract changed and removed an event that subgraph still references.

**Fix:** Either:
1. Keep old event-only ABIs in `subgraph/abis/` (current setup)
2. Update `subgraph.template.yaml` to remove the obsolete event handler

### Chain type errors in wagmi

**Cause:** TypeScript can't narrow the chain type.

**Fix:** Use explicit `Chain` type:
```typescript
import { type Chain } from 'viem/chains';
const chain: Chain = CHAIN_ID === 8453 ? base : baseSepolia;
```

---

## File Locations Reference

| Purpose | Location |
|---------|----------|
| Network config (addresses, URLs) | `config/networks/base-sepolia.json` |
| Full ABIs | `config/abis/*.json` |
| Generated TypeScript | `config/generated/contracts.ts` |
| Generated subgraph manifest | `config/generated/subgraph.yaml` |
| Subgraph template | `subgraph/subgraph.template.yaml` |
| Subgraph ABIs (events only) | `subgraph/abis/*.json` |
| API secrets | `apps/governance-api/.env.local` |
| Contract deployment keys | `contracts/.env` |

### Generator Scripts

| Script | What it does |
|--------|--------------|
| `generate.sh` | Master script, runs all below |
| `extract-abis.sh` | Foundry → `config/abis/` |
| `generate-ts.js` | JSON + ABIs → `contracts.ts` |
| `generate-env.sh` | JSON → `.env` files |
| `generate-subgraph.sh` | Template → `subgraph.yaml` |

---

## Checklist: After Any Config Change

- [ ] Edit source of truth (`config/networks/*.json` or contracts)
- [ ] Run `bash config/scripts/generate.sh base-sepolia`
- [ ] Build governance-api: `cd apps/governance-api && npm run build`
- [ ] Build dashboards (all 4)
- [ ] Copy `dist/` directories to server
- [ ] Copy `governance-api/.env.local` if secrets changed
- [ ] Restart PM2: `pm2 restart all`
- [ ] Smoke test each app
