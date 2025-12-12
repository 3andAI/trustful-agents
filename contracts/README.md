# Trustful Agents - Smart Contracts

Solidity smart contracts for the Trustful Agents decentralized trust layer.

## Overview

| Contract | Description |
|----------|-------------|
| `CollateralVault` | Holds USDC collateral per agent with partial locking |
| `TermsRegistry` | Stores T&C versions with on-chain liability cap |
| `TrustfulValidator` | Issues/revokes ERC-8004 validations |
| `CouncilRegistry` | Manages councils and members |
| `ClaimsManager` | Claim lifecycle and voting |
| `RulingExecutor` | Executes compensations |
| `TrustfulPausable` | Emergency pause mechanism |

## Development

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)

### Install Dependencies

```bash
forge install foundry-rs/forge-std
forge install OpenZeppelin/openzeppelin-contracts
```

### Build

```bash
forge build
```

### Test

```bash
# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Run specific test
forge test --match-test testDeposit

# Run with gas reporting
forge test --gas-report

# Run coverage
forge coverage
```

### Format

```bash
forge fmt
```

### Deploy

There are three deployment scripts available:

| Script | Purpose |
|--------|---------|
| `DeployMVP.s.sol` | Deploy MVP only (CollateralVault, TermsRegistry, TrustfulValidator) |
| `DeployPhase1.s.sol` | Deploy all 6 Phase 1 contracts fresh |
| `UpgradeToPhase1.s.sol` | Upgrade existing MVP to Phase 1 (add 3 new contracts) |

#### Environment Setup

Create a `.env` file from the template:

```bash
cp .env.example .env
```

Required variables:
```bash
DEPLOYER_PRIVATE_KEY=your_private_key
RPC_URL=https://sepolia.base.org   # or your RPC endpoint
```

Optional variables:
```bash
USDC_ADDRESS=0x...                  # Use existing USDC (deploys mock if not set)
ERC8004_REGISTRY_ADDRESS=0x...      # Use existing registry (deploys mock if not set)
WITHDRAWAL_GRACE_PERIOD=604800      # 7 days in seconds (default)
MIN_COLLATERAL_AMOUNT=100000000     # 100 USDC in 6 decimals (default)
VALIDATION_BASE_URI=https://trustful.ai/v/
```

#### Option A: Fresh Phase 1 Deployment

Deploy all 6 contracts from scratch:

```bash
source .env

forge script script/DeployPhase1.s.sol:DeployPhase1 \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  -vvvv
```

#### Option B: Upgrade MVP to Phase 1

If you already have MVP contracts deployed (CollateralVault, TermsRegistry, TrustfulValidator), use the upgrade script to add CouncilRegistry, ClaimsManager, and RulingExecutor:

```bash
source .env

# Set existing MVP addresses
export USDC_ADDRESS=0x63d5a529eD8a8192E2201c0cea4469397efE30Ba
export ERC8004_REGISTRY_ADDRESS=0xb3B4b5042Fd3600404846671Ff5558719860b694
export COLLATERAL_VAULT_ADDRESS=0xDDC4eebCf1D6e62821A25Fa26B6Df021dcee11C4
export TERMS_REGISTRY_ADDRESS=0x5Ae03075290e284ee05Fa648843F0ce81fffFA5d
export TRUSTFUL_VALIDATOR_ADDRESS=0xe75817D8aADA91968AD492d583602Ec10B2569a6

forge script script/UpgradeToPhase1.s.sol:UpgradeToPhase1 \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  -vvvv
```

#### Post-Deployment: Create Default Council

After deploying Phase 1 contracts, create a default council for dispute resolution:

```bash
# Parameters: name, description, vertical, quorumPct, depositPct, votingPeriod, evidencePeriod
cast send <COUNCIL_REGISTRY_ADDRESS> \
  "createCouncil(string,string,string,uint256,uint256,uint256,uint256)" \
  "General" "Default council for AI agent disputes" "general" \
  5000 1000 604800 259200 \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY
```

Parameters explained:
- `quorumPercentage`: 5000 = 50%
- `claimDepositPercentage`: 1000 = 10%
- `votingPeriod`: 604800 = 7 days
- `evidencePeriod`: 259200 = 3 days

#### Local Testing

```bash
# Start local Anvil node
anvil &

# Deploy to local
forge script script/DeployPhase1.s.sol:DeployPhase1 \
  --rpc-url http://localhost:8545 \
  --broadcast
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │    ERC-8004     │  │      USDC       │  │    ERC-8004     │         │
│  │    Registry     │  │     Token       │  │  Validation     │         │
│  │   (Identity)    │  │   (Collateral)  │  │   Registry      │         │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘         │
│           │                    │                    │                   │
├───────────┼────────────────────┼────────────────────┼───────────────────┤
│           │                    │                    │                   │
│           ▼                    ▼                    ▼                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      TRUSTFUL AGENTS                             │   │
│  │                                                                  │   │
│  │  ┌──────────────────┐      ┌──────────────────┐                 │   │
│  │  │ CollateralVault  │◄────▶│  TermsRegistry   │                 │   │
│  │  │  - deposit()     │      │  - registerTerms │                 │   │
│  │  │  - withdraw()    │      │  - getActiveTerms│                 │   │
│  │  │  - lock/unlock   │      │  - councilId     │                 │   │
│  │  └────────┬─────────┘      └────────┬─────────┘                 │   │
│  │           │                         │                            │   │
│  │           │    ┌────────────────────┘                            │   │
│  │           │    │                                                 │   │
│  │           ▼    ▼                                                 │   │
│  │  ┌──────────────────┐      ┌──────────────────┐                 │   │
│  │  │  ClaimsManager   │◄────▶│ CouncilRegistry  │                 │   │
│  │  │  - fileClaim()   │      │  - createCouncil │                 │   │
│  │  │  - castVote()    │      │  - addMember()   │                 │   │
│  │  │  - closeVoting() │      │  - getCouncil()  │                 │   │
│  │  └────────┬─────────┘      └──────────────────┘                 │   │
│  │           │                                                      │   │
│  │           ▼                                                      │   │
│  │  ┌──────────────────┐      ┌──────────────────┐                 │   │
│  │  │  RulingExecutor  │      │TrustfulValidator │                 │   │
│  │  │  - executeRuling │      │  - isValidated() │                 │   │
│  │  │  - slash/return  │      │  - checkConditions│                │   │
│  │  └──────────────────┘      └──────────────────┘                 │   │
│  │                                                                  │   │
│  │  ┌──────────────────┐                                           │   │
│  │  │TrustfulPausable  │  (inherited by all contracts)             │   │
│  │  │  - pause/unpause │                                           │   │
│  │  └──────────────────┘                                           │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### Partial Locking (v1.1)
Claims lock only the requested amount from collateral, allowing multiple concurrent claims.

### Council Binding (v1.1)
Council is specified per T&C version, preventing "council shopping" by claimants.

### Claim Deposits (v1.1)
Claimants stake a percentage of claimed amount (spam prevention). Returned if approved, forfeited if rejected.

### Payment Binding (v1.1)
Claims must reference x402 payment receipt hash, ensuring compensation only for paid services.

## Security Considerations

- All external calls use checks-effects-interactions pattern
- Reentrancy guards on state-changing functions
- Access control via OpenZeppelin
- Withdrawal grace period prevents rug-pulls
- Multisig pause for emergencies
- ERC-8004 ownership verified for all provider actions

## License

MIT
