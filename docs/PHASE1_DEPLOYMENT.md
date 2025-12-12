# Phase 1 Deployment Guide

This guide covers deploying all 6 Phase 1 contracts to Base Sepolia testnet.

## Current Status

**Existing MVP Deployment (Base Sepolia - 84532):**
| Contract | Address |
|----------|---------|
| Mock USDC | `0x63d5a529eD8a8192E2201c0cea4469397efE30Ba` |
| Mock ERC-8004 Registry | `0xb3B4b5042Fd3600404846671Ff5558719860b694` |
| CollateralVault | `0xDDC4eebCf1D6e62821A25Fa26B6Df021dcee11C4` |
| TermsRegistry | `0x5Ae03075290e284ee05Fa648843F0ce81fffFA5d` |
| TrustfulValidator | `0xe75817D8aADA91968AD492d583602Ec10B2569a6` |

**Phase 1 Contracts (to deploy):**
| Contract | Status |
|----------|--------|
| CouncilRegistry | ⏳ Pending |
| ClaimsManager | ⏳ Pending |
| RulingExecutor | ⏳ Pending |

---

## Deployment Options

### Option A: Upgrade Existing MVP (Recommended)

Use this if you already have MVP contracts deployed and want to add Phase 1 contracts.

### Option B: Fresh Phase 1 Deployment

Use this to deploy all 6 contracts from scratch.

---

## Option A: Upgrade MVP to Phase 1

### Prerequisites

1. **Foundry installed**: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
2. **Environment configured**:
   ```bash
   cd contracts
   cp .env.example .env
   ```

### Step 1: Configure Environment

Edit `.env` with your deployment details:

```bash
# Required
export DEPLOYER_PRIVATE_KEY=<your-private-key>
export RPC_URL=https://sepolia.base.org

# Existing MVP addresses (from 84532.json)
export USDC_ADDRESS=0x63d5a529eD8a8192E2201c0cea4469397efE30Ba
export ERC8004_REGISTRY_ADDRESS=0xb3B4b5042Fd3600404846671Ff5558719860b694
export COLLATERAL_VAULT_ADDRESS=0xDDC4eebCf1D6e62821A25Fa26B6Df021dcee11C4
export TERMS_REGISTRY_ADDRESS=0x5Ae03075290e284ee05Fa648843F0ce81fffFA5d
export TRUSTFUL_VALIDATOR_ADDRESS=0xe75817D8aADA91968AD492d583602Ec10B2569a6

# For verification (optional)
export BASESCAN_API_KEY=<your-basescan-api-key>
```

### Step 2: Install Dependencies

```bash
cd contracts
forge install
```

### Step 3: Verify Tests Pass

```bash
forge test -vvv
```

Expected: `208/208 tests passed`

### Step 4: Deploy Phase 1 Contracts

```bash
source .env

forge script script/UpgradeToPhase1.s.sol:UpgradeToPhase1 \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  -vvvv
```

This will:
1. Deploy CouncilRegistry, ClaimsManager, RulingExecutor
2. Wire CollateralVault → ClaimsManager, RulingExecutor
3. Wire TermsRegistry → CouncilRegistry
4. Wire all new contracts to each other
5. Update `deployments/84532.json`

### Step 5: Verify Deployment

Check Basescan for your deployed contracts:
- https://sepolia.basescan.org/address/<COUNCIL_REGISTRY>
- https://sepolia.basescan.org/address/<CLAIMS_MANAGER>
- https://sepolia.basescan.org/address/<RULING_EXECUTOR>

### Step 6: Update Configuration Files

```bash
cd ..  # Back to repo root
./scripts/update-configs.sh contracts/deployments/84532.json
```

### Step 7: Create Default Council

A council is required for the dispute resolution flow:

```bash
cast send <COUNCIL_REGISTRY_ADDRESS> \
  "createCouncil(string,string,string,uint256,uint256,uint256,uint256)" \
  "General" "Default council for AI agent disputes" "general" \
  5000 1000 604800 259200 \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY
```

Parameters:
- `name`: "General"
- `description`: "Default council for AI agent disputes"
- `vertical`: "general"
- `quorumPercentage`: 5000 (50%)
- `claimDepositPercentage`: 1000 (10%)
- `votingPeriod`: 604800 (7 days)
- `evidencePeriod`: 259200 (3 days)

### Step 8: Add Council Members

```bash
# Get the council ID from the createCouncil transaction logs
COUNCIL_ID=$(cast logs --from-block <DEPLOY_BLOCK> --to-block latest \
  --address <COUNCIL_REGISTRY> \
  'CouncilCreated(bytes32,string,string,uint256,uint256)' \
  --rpc-url $RPC_URL | jq -r '.[0].topics[1]')

# Add members
cast send <COUNCIL_REGISTRY_ADDRESS> \
  "addMember(bytes32,address)" $COUNCIL_ID <MEMBER_ADDRESS> \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY
```

---

## Option B: Fresh Phase 1 Deployment

### Step 1: Configure Environment

```bash
cd contracts
cp .env.example .env
```

Edit `.env`:
```bash
export DEPLOYER_PRIVATE_KEY=<your-private-key>
export RPC_URL=https://sepolia.base.org

# Leave these empty to deploy fresh mocks
# export USDC_ADDRESS=
# export ERC8004_REGISTRY_ADDRESS=

# Optional configuration
export WITHDRAWAL_GRACE_PERIOD=604800  # 7 days
export MIN_COLLATERAL_AMOUNT=100000000 # 100 USDC
export VALIDATION_BASE_URI=https://trustful.ai/v/
```

### Step 2: Deploy All Contracts

```bash
source .env

forge script script/DeployPhase1.s.sol:DeployPhase1 \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  -vvvv
```

---

## Post-Deployment: Subgraph Setup

### Step 1: Update Subgraph Config

The `update-configs.sh` script updates `subgraph/subgraph.yaml` with deployed addresses.

### Step 2: Generate Types

```bash
cd subgraph
npm install
npm run codegen
```

### Step 3: Build Subgraph

```bash
npm run build
```

### Step 4: Deploy to The Graph Studio

1. Go to https://thegraph.com/studio/
2. Create a new subgraph named "trustful-agents"
3. Authenticate: `graph auth --studio <DEPLOY_KEY>`
4. Deploy: `graph deploy --studio trustful-agents`

---

## Post-Deployment: Provider Dashboard

The provider dashboard is pre-configured to work with deployed contracts.

### Start Development Server

```bash
cd apps/provider-dashboard
npm install
npm run dev
```

Open http://localhost:5173

### Testing the Flow

1. **Connect Wallet**: Connect to Base Sepolia
2. **Get Test USDC**: The dashboard has a "Mint Test USDC" button
3. **Get Test Agent**: The dashboard has a "Mint Test Agent" button
4. **Complete 5-Step Flow**:
   - Step 1: Approve USDC
   - Step 2: Deposit Collateral
   - Step 3: Register T&C
   - Step 4: Request Validation
   - Step 5: Verify Status

---

## Contract Interaction Reference

### CollateralVault

```bash
# Deposit collateral (requires USDC approval first)
cast send $COLLATERAL_VAULT \
  "deposit(uint256,uint256)" <AGENT_ID> <AMOUNT> \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY

# Check balance
cast call $COLLATERAL_VAULT \
  "getAccount(uint256)" <AGENT_ID> \
  --rpc-url $RPC_URL
```

### TermsRegistry

```bash
# Register terms
cast send $TERMS_REGISTRY \
  "registerTerms(uint256,bytes32,string,bytes32)" \
  <AGENT_ID> <CONTENT_HASH> <CONTENT_URI> <COUNCIL_ID> \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

### TrustfulValidator

```bash
# Request validation
cast send $TRUSTFUL_VALIDATOR \
  "requestValidation(uint256)" <AGENT_ID> \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY

# Check validation status
cast call $TRUSTFUL_VALIDATOR \
  "isValidated(uint256)" <AGENT_ID> \
  --rpc-url $RPC_URL
```

### ClaimsManager (Phase 1)

```bash
# File a claim (requires USDC deposit approval)
cast send $CLAIMS_MANAGER \
  "fileClaim(uint256,uint256,bytes32,string,bytes32)" \
  <AGENT_ID> <AMOUNT> <EVIDENCE_HASH> <EVIDENCE_URI> <PAYMENT_HASH> \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY

# Cast a vote (council members only)
cast send $CLAIMS_MANAGER \
  "castVote(uint256,uint8,uint256,string)" \
  <CLAIM_ID> <VOTE> <APPROVED_AMOUNT> <REASONING> \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

### RulingExecutor (Phase 1)

```bash
# Execute approved claim
cast send $RULING_EXECUTOR \
  "executeApprovedClaim(uint256)" <CLAIM_ID> \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY

# Execute rejected claim
cast send $RULING_EXECUTOR \
  "executeRejectedClaim(uint256)" <CLAIM_ID> \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

---

## Troubleshooting

### "Insufficient allowance"
Make sure USDC is approved for the target contract:
```bash
cast send $USDC "approve(address,uint256)" $CONTRACT $AMOUNT \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

### "AgentNotFound"
The agent ID must exist in the ERC-8004 registry. Mint a test agent:
```bash
cast send $ERC8004_REGISTRY "mint(address,uint256)" $YOUR_ADDRESS $AGENT_ID \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

### "NotAgentOwner"
The caller must be the owner of the agent in the ERC-8004 registry.

### "CouncilNotFound"
A council must be created before registering terms that reference it.

### Gas estimation failed
Try adding `--gas-limit 500000` to your cast commands.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Phase 1 Contract Architecture                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐           │
│  │    USDC     │     │  ERC-8004   │     │  TrustfulValidator  │           │
│  │   (Mock)    │     │  Registry   │     │   (issues trust)    │           │
│  └──────┬──────┘     └──────┬──────┘     └──────────┬──────────┘           │
│         │                   │                       │                        │
│         ▼                   ▼                       ▼                        │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │                     CollateralVault                          │           │
│  │  • Holds USDC per agent                                      │           │
│  │  • Locks collateral for claims                               │◄──────┐   │
│  │  • Slashes to claimants                                      │       │   │
│  └──────────────────────────┬───────────────────────────────────┘       │   │
│                             │                                           │   │
│                             ▼                                           │   │
│  ┌─────────────────────────────────────────────────────────────┐        │   │
│  │                      TermsRegistry                          │        │   │
│  │  • Stores T&C versions per agent                            │        │   │
│  │  • Binds agents to councils                                 │        │   │
│  └──────────────────────────┬──────────────────────────────────┘        │   │
│                             │                                           │   │
│         ┌───────────────────┼───────────────────────┐                   │   │
│         ▼                   ▼                       ▼                   │   │
│  ┌─────────────┐     ┌─────────────┐        ┌─────────────┐             │   │
│  │  Council    │     │   Claims    │        │   Ruling    │             │   │
│  │  Registry   │◄───▶│   Manager   │───────▶│  Executor   │─────────────┘   │
│  │             │     │             │        │             │                 │
│  │ • Councils  │     │ • File      │        │ • Execute   │                 │
│  │ • Members   │     │ • Vote      │        │ • Slash     │                 │
│  │ • Quorums   │     │ • Close     │        │ • Distribute│                 │
│  └─────────────┘     └─────────────┘        └─────────────┘                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Contract Wiring Summary

After Phase 1 deployment, contracts are wired as follows:

| Contract | References |
|----------|-----------|
| **CollateralVault** | → ClaimsManager, RulingExecutor |
| **TermsRegistry** | → TrustfulValidator, CouncilRegistry |
| **TrustfulValidator** | → CollateralVault, TermsRegistry |
| **CouncilRegistry** | → TermsRegistry, ClaimsManager |
| **ClaimsManager** | → CollateralVault, TermsRegistry, CouncilRegistry, RulingExecutor |
| **RulingExecutor** | → ClaimsManager, CollateralVault, CouncilRegistry |
