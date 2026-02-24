# Eth Sepolia Migration — Server Deployment Steps

## What's Already Done (in this tarball)

### Config
- ✅ Created `config/networks/eth-sepolia.json` with all deployed contract addresses
- ✅ Generated `config/generated/contracts.ts` for Eth Sepolia (chainId: 11155111)
- ✅ Generated `config/generated/env.dashboard` and `env.api`
- ✅ Generated `config/generated/subgraph.yaml` (network: `sepolia`)
- ✅ Updated `apps/governance-api/src/config/contracts.ts` with new generated config

### App Chain Support
- ✅ All 4 dashboards updated: wagmi/viem chain selection now supports `sepolia` (11155111)
- ✅ Governance API updated: chain selection supports `sepolia`
- ✅ Fixed hardcoded `84532` chain IDs → use `CHAIN_ID` from config
- ✅ Fixed hardcoded Safe TX service URLs → use `SAFE_TX_SERVICE_URL` from config
- ✅ Fixed hardcoded contract addresses in `councils-v2.ts` → use `CONTRACTS` from config
- ✅ Updated all "Base Sepolia" UI text → "Eth Sepolia"

### Subgraph
- ✅ `subgraph/subgraph.yaml` updated (symlink to generated) — network: `sepolia`, Eth Sepolia addresses
- ✅ Added `deploy:eth-sepolia` script to subgraph `package.json`

---

## Steps to Complete on Server

### 1. Extract Tarball
```bash
cd ~/ta
# Back up current state
cp -r trustful-agents trustful-agents.bak-$(date +%Y%m%d)
# Extract new code
tar xzf trustful_tar.gz
```

### 2. Update TrustfulValidator ABI (IMPORTANT)
The ABI in `config/abis/TrustfulValidator.json` is from the **old** contract before the rewrite. It still has `requestValidation()` which was removed, and is missing `respondToRequest()`, `reevaluate()`, etc.

The subgraph works fine (event signatures unchanged), but the apps will have stale type info.

```bash
cd ~/ta/trustful-agents/contracts
forge build
cd ..
bash config/scripts/extract-abis.sh
# Then regenerate:
bash config/scripts/generate.sh eth-sepolia
```

### 3. Update startBlock in eth-sepolia.json
The `startBlock` is set to `7700000` as a placeholder. Find the actual deployment block:
```bash
# Check the first contract deployment tx on Etherscan
# https://sepolia.etherscan.io/address/0xba911c9AE66a4a6671e5964A95Af91Ba65b4493F
# Use the block number from the "Contract Creation" transaction
```
Then update `config/networks/eth-sepolia.json` → `"startBlock"` and re-run:
```bash
bash config/scripts/generate.sh eth-sepolia
```

### 4. Create Subgraph on The Graph Studio
1. Go to https://thegraph.com/studio/
2. Create new subgraph: **trustful-agents-eth-sepolia**
3. Select network: **Ethereum Sepolia**
4. Note the slug name (it's in the deploy command)

### 5. Deploy Subgraph
```bash
cd ~/ta/trustful-agents/subgraph

# Authenticate (if not already)
graph auth --studio <YOUR_DEPLOY_KEY>

# Codegen and build
graph codegen
graph build

# Deploy (use the slug from step 4)
graph deploy --studio trustful-agents-eth-sepolia
# Enter version: v0.1.0
```

**Known build warnings** (safe to ignore):
- `WARNING AS201: Conversion from type 'usize' to 'i32'` in claims-manager.ts

### 6. Update Subgraph URL
After deploying, update the subgraph URL in `config/networks/eth-sepolia.json`:
```json
"subgraphUrl": "https://api.studio.thegraph.com/query/YOUR_ID/trustful-agents-eth-sepolia/version/latest"
```
Then regenerate:
```bash
bash config/scripts/generate.sh eth-sepolia
```

### 7. Build and Deploy Governance API
```bash
cd ~/ta/trustful-agents/apps/governance-api

# Copy updated contracts.ts (already done in tarball, but verify)
cp ../../config/generated/contracts.ts src/config/contracts.ts

# Install deps and build
npm install
npx tsc

# Restart
pm2 restart governance-api
```

### 8. Build and Deploy Dashboards
```bash
cd ~/ta/trustful-agents

# Install workspace deps
pnpm install

# Build each dashboard
cd apps/provider-dashboard && pnpm build && cd ../..
cd apps/claimer-dashboard && pnpm build && cd ../..
cd apps/council-dashboard && pnpm build && cd ../..
cd apps/governance-dashboard && pnpm build && cd ../..

# Deploy (copy dist/ to nginx-served directories or restart PM2)
```

### 9. Database Setup (if new DB)
If using a separate database for Eth Sepolia:
```bash
# The config specifies: trustful_governance_eth_sepolia
# Create it:
docker exec -i trustful-postgres psql -U postgres -c "CREATE DATABASE trustful_governance_eth_sepolia;"
# Run migrations/init
bash config/scripts/init-db.sh eth-sepolia
```

---

## Known Runtime Issues (Not Blocking Compilation)

### Provider Dashboard — `requestValidation()` removed
The `useRequestValidation` hook in `apps/provider-dashboard/src/hooks/useAgents.ts` calls:
```typescript
functionName: 'requestValidation',
```
This function was **removed** from TrustfulValidator in the ERC-8004 rewrite. On Eth Sepolia, validation requests go through the **Validation Registry**, not directly through TrustfulValidator.

**Fix needed**: Update provider flow to call `validationRegistry.validationRequest(...)` instead. This is a larger UI change — not a config issue.

### Provider Dashboard — `mintAuto()` doesn't exist on real Identity Registry
The `NewAgent` page calls `mintAuto()` on `erc8004Registry`. The real ERC-8004 Identity Registry uses `register()` with different parameters.

**Fix needed**: Update agent creation flow for the real Identity Registry interface.

### Provider Dashboard — `nextTokenId()` may not exist
The `useAgents` hook uses `nextTokenId()` to enumerate agents. The real Identity Registry may not have this function.

**Fix needed**: Use a different enumeration strategy (events, subgraph query, or ERC-721 Enumerable).

---

## Files Changed Summary

### New files:
- `config/networks/eth-sepolia.json`

### Updated config/generated (auto-generated):
- `config/generated/contracts.ts`
- `config/generated/env.dashboard`
- `config/generated/env.api`
- `config/generated/subgraph.yaml`

### Updated app chain support:
- `apps/provider-dashboard/src/config/wagmi.ts` — added sepolia chain
- `apps/claimer-dashboard/src/config/wagmi.ts` — added sepolia chain
- `apps/council-dashboard/src/config/wagmi.ts` — added sepolia chain
- `apps/governance-dashboard/src/config/contracts.ts` — added sepolia chain
- `governance-api/src/config/index.ts` — added sepolia chain
- `apps/governance-api/src/config/index.ts` — added sepolia chain

### Fixed hardcoded references:
- `apps/claimer-dashboard/src/components/Layout.tsx` — chain ID check
- `apps/claimer-dashboard/src/hooks/useWallet.ts` — chain ID + switch
- `apps/council-dashboard/src/hooks/useWallet.ts` — chain ID + switch
- `apps/governance-dashboard/src/hooks/useSafe.ts` — Safe TX URL
- `apps/governance-dashboard/src/hooks/useSafeConfirm.ts` — Safe TX URL
- `apps/governance-api/src/routes/councils-v2.ts` — chain + addresses
- `apps/provider-dashboard/src/App.tsx` — chain ID display
- `apps/provider-dashboard/src/pages/IntegratePage.tsx` — chain text + snippet

### Updated UI text (Base Sepolia → Eth Sepolia):
- Provider dashboard: wallet, collateral, integrate, new agent pages
- Claimer dashboard: layout, connect
- Council dashboard: layout, connect
- Governance dashboard: login
- Governance API: validation SVG
