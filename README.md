# Trustful Agents

A decentralized trust layer for AI agents built on ERC-8004. Providers deposit collateral and commit to terms & conditions. Clients can file claims through on-chain council governance for dispute resolution.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SMART CONTRACTS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  CORE                           DISPUTE RESOLUTION      ACCESS CONTROL      │
│  ├── CollateralVault.sol        ├── CouncilRegistry     └── TrustfulPausable│
│  ├── TermsRegistry.sol          ├── ClaimsManager                           │
│  └── TrustfulValidator.sol      └── RulingExecutor                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
             ┌──────────┐      ┌──────────┐      ┌──────────┐
             │ Subgraph │      │   API    │      │   SDK    │
             │ (indexer)│      │ (validation)    │(TypeScript)
             └──────────┘      └──────────┘      └──────────┘
                    │                 │                 │
                    └─────────────────┼─────────────────┘
                                      ▼
                    ┌─────────────────────────────────────┐
                    │            APPLICATIONS             │
                    ├──────────┬──────────┬──────────────┤
                    │ Provider │  Client  │   Council    │
                    │Dashboard │  Portal  │  Dashboard   │
                    └──────────┴──────────┴──────────────┘
```

## Project Structure

```
trustful-agents/
├── contracts/              # Solidity smart contracts (Foundry)
├── subgraph/               # The Graph indexer
├── api/                    # Validation response server
├── packages/
│   ├── sdk/                # TypeScript SDK
│   └── shared/             # Shared types, ABIs, constants
└── apps/
    ├── provider-dashboard/ # Provider: manage agents, collateral, T&C
    ├── client-portal/      # Client: discover agents, verify trust
    ├── claims-portal/      # Claimant: file & track claims
    └── council-dashboard/  # Council: review claims, vote
```

## Prerequisites

- Node.js >= 18
- pnpm >= 8
- Foundry (forge, cast, anvil)

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Build contracts

```bash
cd contracts
forge build
```

### 3. Run tests

```bash
cd contracts
forge test
```

### 4. Start local node

```bash
cd contracts
anvil
```

### 5. Deploy locally

```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Network
RPC_URL_BASE_SEPOLIA=https://sepolia.base.org
RPC_URL_BASE_MAINNET=https://mainnet.base.org

# Deployment
DEPLOYER_PRIVATE_KEY=0x...
USDC_ADDRESS=0x...

# API
VALIDATION_API_URL=https://trustful-agents.org/v1
IPFS_GATEWAY=https://ipfs.io/ipfs/

# Subgraph
SUBGRAPH_URL=https://api.thegraph.com/subgraphs/name/...
```

## Key Design Decisions

| Topic | Decision |
|-------|----------|
| Chain | Base (L2 on Ethereum) |
| Collateral Asset | USDC |
| ERC-8004 Integration | Validation Registry pattern |
| Council Governance | One-member-one-vote |
| T&C Storage | On-chain hash, off-chain content (IPFS) |
| Claim Deposits | Percentage of claimed amount (spam prevention) |

## Version History

| Version | Date | Description |
|---------|------|-------------|
| v1.1 | 2024-12-05 | Added claim deposits, payment binding, partial locking |
| v1.0 | 2024-12-04 | Initial architecture |

## License

MIT
