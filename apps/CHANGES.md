# Claimer Dashboard Fixes Summary

## Files Modified

### 1. `src/index.css`
- Updated body background to `bg-surface-950` with gradient effects (matching provider dashboard)
- Added `btn-ghost` button style
- Added focus ring styles to all buttons
- Added `label` and `input-error` styles
- Added `badge-primary` style
- Updated card styling to use `bg-surface-900/80 backdrop-blur-sm`

### 2. `src/components/Layout.tsx`
- Changed logo link from internal `/` to external `https://trustful-agents.ai`
- Removed "My Claims" navigation link (merged into Dashboard)

### 3. `src/App.tsx`
- Removed MyClaims route (merged into Dashboard)

### 4. `src/lib/api.ts`
- Added `parseClaimStatus()` function to handle:
  - Numbers (e.g., `0`, `1`, `2`)
  - Numeric strings (e.g., `"0"`, `"1"`, `"2"`)
  - Word strings (e.g., `"Filed"`, `"EvidenceClosed"`)
- Added `parseDeadline()` function for safe deadline parsing (handles strings, numbers, bigints, null)
- Added `AgentMetadata` interface
- Added `fetchAgentMetadata()` function to fetch agent names from governance API
- Added `fetchAgentMetadataBatch()` for batch fetching
- Added `getAgentDisplayName()` helper for fallback display names
- Added in-memory cache for agent metadata
- Updated `ipfsToHttp()` to only convert valid IPFS CIDs (Qm..., bafy...)

### 5. `src/pages/Dashboard.tsx`
- **COMPLETELY REWRITTEN** - Now includes full MyClaims functionality
- Shows 4 stat cards: Active Claims, Approved, Rejected, Total Received
- Includes filter buttons: All, Active, Approved, Rejected
- Lists all claims with agent names, council names, timer, amounts
- Uses `useReadContracts` for efficient batch reading of claims
- Proper stats calculation from on-chain data

### 6. `src/pages/MyClaims.tsx`
- **DELETED** - Functionality merged into Dashboard

### 7. `src/pages/AgentLookup.tsx`
- Always reads owner from contract for provider address display
- Provider address now shows for ALL agents (not just those with names)
- Search placeholder changed to "Search by Agent ID or name…"

### 8. `src/pages/ClaimDetail.tsx`
- "Back to Claims" → "Back to Dashboard" with link to "/"
- Added agent number next to name in header: `{agentName} (#{agentId})`
- Added agent number in Claim Details grid
- Added subgraph council lookup as fallback
- Added subgraph agent data for collateral fallback
- Evidence "View" link only shows for valid IPFS/HTTP URLs

### 9. `src/pages/FileClaim.tsx`
- **COMPLETELY REWRITTEN** with agent lookup integrated:
  - Step 1: Browse validated agents (like Lookup Agent page)
  - Shows agent cards with name, ID, provider, council, available collateral, claims
  - Step 2: Claim Amount
    - Shows available collateral prominently
    - Prevents claiming more than available
    - Shows validation error if amount exceeds available
  - Step 3: Evidence
    - "Evidence File *" label (added asterisk)
    - Description is required
    - Proper evidence hash generation
    - No fake IPFS URLs - uses `hash://` prefix for local files
  - Step 4: Review with all claim details
  - Step 5: Submit with USDC approval flow
- Redirects to Dashboard (not deleted /claims) after success
- Back button goes to Dashboard

---

## Bug Fixes Summary

1. **Dashboard "NaNm" display** - Fixed with `parseDeadline()` function
2. **Stats showing 0** - Fixed by `parseClaimStatus()` handling numeric strings
3. **"Evidence Period" vs "Voting Open" inconsistency** - Fixed by enhanced `parseClaimStatus()`
4. **Missing agent/council names** - Added metadata fetching throughout
5. **ClaimDetail "Unknown" council** - Added subgraph fallback lookup
6. **ClaimDetail wrong collateral** - Added safe BigInt conversion with fallback
7. **Agent cards missing provider address** - Always read from contract
8. **Wrong IPFS URLs** - Fixed `ipfsToHttp()` to validate CIDs
9. **FileClaim bugs** - Complete rewrite with proper agent selection
10. **Black screen after claim** - Fixed redirect to Dashboard

---

## API Dependency

The fixes rely on the governance API endpoint:
```
GET https://api.trustful-agents.ai/provider/agents/{agentId}
```

Returns:
```json
{
  "agent_id": "50",
  "owner_address": "0x...",
  "name": "Agent Name",
  "description": "...",
  "capabilities": [],
  "website_url": null
}
```

Note: 404 errors for non-existent agents are expected and handled gracefully.

---

## How to Deploy

1. Extract all files from this zip to your claimer-dashboard project
2. Run `npm install` (if needed)
3. Rebuild: `npm run build`
4. Deploy the new `dist/` folder
