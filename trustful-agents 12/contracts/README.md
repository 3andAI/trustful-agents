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

```bash
# Local (anvil)
anvil &
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast

# Base Sepolia
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL_BASE_SEPOLIA \
  --broadcast \
  --verify

# Base Mainnet
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL_BASE_MAINNET \
  --broadcast \
  --verify
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
