# Trustful Agents Subgraph - Deployment Guide

## Overview

This subgraph indexes all Trustful Agents smart contracts on Base Sepolia:
- **CollateralVault** - Agent collateral deposits, withdrawals, locking
- **TermsRegistry** - Terms & Conditions versioning
- **CouncilRegistry** - Council and member management
- **TrustfulValidator** - Agent validation status
- **ClaimsManager** - Claims lifecycle (filing, voting, resolution)
- **RulingExecutor** - Claim execution and deposit distribution

## Contract Addresses (Base Sepolia)

| Contract | Address |
|----------|---------|
| CollateralVault | `0xDDC4eebCf1D6e62821A25Fa26B6Df021dcee11C4` |
| TermsRegistry | `0x5Ae03075290e284ee05Fa648843F0ce81fffFA5d` |
| CouncilRegistry | `0x54996FAE14f35C32EfA2F0f92237e9B924a93F66` |
| TrustfulValidator | `0xe75817D8aADA91968AD492d583602Ec10B2569a6` |
| ClaimsManager | `0x4826E3745cb63f91ED9d24Ff67a06aC200e1156b` |
| RulingExecutor | `0x567f98221858C46dc93F2bF76400C85442d2cf68` |

## Prerequisites

1. Node.js 18+ installed
2. Graph CLI installed globally: `npm install -g @graphprotocol/graph-cli`
3. Account on [The Graph Studio](https://thegraph.com/studio/)

## Deployment Steps

### Step 1: Install Dependencies

```bash
cd subgraph
npm install
```

### Step 2: Generate Types

```bash
npm run codegen
```

### Step 3: Build

```bash
npm run build
```

### Step 4: Create Subgraph on The Graph Studio

1. Go to https://thegraph.com/studio/
2. Connect your wallet
3. Click "Create a Subgraph"
4. Name it `trustful-agents` (or your preferred name)
5. Select "Base Sepolia" as the network
6. Copy your **Deploy Key** from the dashboard

### Step 5: Authenticate

```bash
graph auth --studio YOUR_DEPLOY_KEY
```

### Step 6: Deploy

```bash
graph deploy --studio trustful-agents
```

When prompted:
- **Version Label**: Use semantic versioning like `v0.1.0`

## Post-Deployment

### Get Your Subgraph URL

After deployment, your subgraph URL will be:
```
https://api.studio.thegraph.com/query/YOUR_SUBGRAPH_ID/trustful-agents/v0.1.0
```

### Verify Indexing

Check the Studio dashboard to monitor:
- Syncing progress
- Block height
- Any indexing errors

## Example Queries

### Search Agents by ID
```graphql
query GetAgent($id: ID!) {
  agent(id: $id) {
    id
    owner
    collateralBalance
    lockedCollateral
    availableCollateral
    isValidated
    activeTermsVersion
    activeTermsUri
    councilId
    totalClaims
    approvedClaims
    rejectedClaims
  }
}
```

### List All Agents with Collateral
```graphql
query ListAgents($minCollateral: BigInt) {
  agents(
    where: { collateralBalance_gte: $minCollateral }
    orderBy: collateralBalance
    orderDirection: desc
    first: 100
  ) {
    id
    collateralBalance
    isValidated
    owner
  }
}
```

### Get Agent Terms History
```graphql
query AgentTermsHistory($agentId: ID!) {
  agent(id: $agentId) {
    id
    termsVersions(orderBy: version, orderDirection: desc) {
      version
      contentUri
      councilId
      isActive
      registeredAt
    }
  }
}
```

### Get Claims for Council
```graphql
query CouncilClaims($councilId: ID!) {
  claims(
    where: { council: $councilId, status_not: Executed }
    orderBy: filedAt
    orderDirection: desc
  ) {
    id
    claimant
    claimedAmount
    status
    filedAt
    votingDeadline
    approveVotes
    rejectVotes
    totalVotes
  }
}
```

### Protocol Statistics
```graphql
query ProtocolStats {
  protocolStats(id: "global") {
    totalAgents
    validatedAgents
    totalCollateral
    lockedCollateral
    totalClaims
    pendingClaims
    approvedClaims
    rejectedClaims
    totalCompensationPaid
  }
}
```

## Updating the Subgraph

When you need to update:

1. Make changes to schema or mappings
2. Run `npm run codegen` (if schema changed)
3. Run `npm run build`
4. Deploy with a new version:
   ```bash
   graph deploy --studio trustful-agents
   # Enter new version like v0.2.0
   ```

## Start Block Configuration

The current `startBlock` is set to `19000000`. If your contracts were deployed after this block, you can find the actual deployment block to speed up initial indexing:

1. Look up each contract on [BaseScan Sepolia](https://sepolia.basescan.org/)
2. Find the "Contract Creation" transaction
3. Use that block number in `subgraph.yaml`

## Troubleshooting

### Indexing Errors
- Check the Studio dashboard for detailed error logs
- Common issues: ABI mismatches, event signature changes

### Slow Syncing
- Reduce `startBlock` to closer to actual deployment
- Check if there are any handler errors causing retries

### Query Errors
- Ensure entity IDs match expected format
- Agent IDs are hex strings of the NFT token ID
- Council IDs are hex strings of bytes32

## Support

- The Graph Discord: https://discord.gg/graphprotocol
- Trustful Agents Issues: (your repo)
