# Trustful Agents Architecture Specification

## Version 1.3
## Date: 2025-01-06

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-04 | Initial architecture with 7 contracts |
| 1.1 | 2025-12-05 | Added claim deposits, payment binding, council binding, partial locking |
| 1.2 | 2025-12-09 | Deposit distribution to voters, governance role, maxPayoutPerClaim off-chain, vote change |
| 1.3 | 2025-01-06 | Governance Dashboard implementation, Safe SDK integration, Pending Votes system |

---

## Table of Contents

1. Executive Summary
2. Requirements
3. Assumptions & Constraints
4. Actors & Roles
5. Architectural Decisions
6. System Components
7. Governance Dashboard Architecture
8. Data Flows
9. API Reference
10. Off-Chain Components
11. Security Considerations
12. Deployment Architecture
13. Open Items & Future Work

---

## 1. Executive Summary

Trustful Agents is a decentralized trust layer for AI agents registered via ERC-8004. It enables agent providers to demonstrate accountability by depositing collateral and committing to terms & conditions. Clients who suffer damages from agent misbehavior can file claims that are adjudicated by on-chain governance councils.

### Key Capabilities

- Collateral deposits in USDC as trust signal
- On-chain T&C commitment with content hash verification
- Claim deposits for economic spam prevention
- Payment binding via x402 receipt hashes (hybrid: supports non-x402 payments via evidence)
- Council-based dispute resolution with unbiased incentives
- Automatic ERC-8004 validation with explicit conditions
- Integration with A2A Protocol for agent discovery
- Governance via Safe multisig for council management

### v1.3 Highlights

- **Governance Dashboard:** Web application for Safe multisig owners to manage councils
- **Safe SDK Integration:** Direct transaction proposals via Safe Transaction Service
- **Pending Votes System:** Track and vote on pending governance transactions with human-readable context
- **Blockchain-First Architecture:** Council data read directly from CouncilRegistry contract

---

## 2. Requirements

### 2.1 Functional Requirements

| ID | Requirement | Priority | Version |
|----|-------------|----------|---------|
| FR-01 | Providers can deposit USDC collateral per agent | Must | 1.0 |
| FR-02 | Providers can register and update T&C with content hash | Must | 1.0 |
| FR-03 | Providers can withdraw collateral with grace period | Must | 1.0 |
| FR-04 | Clients can verify agent validation status | Must | 1.0 |
| FR-05 | Claimants can file claims with evidence and deposit | Must | 1.0 |
| FR-06 | Council members can vote on claims with approved amount | Must | 1.0 |
| FR-07 | Approved claims trigger compensation from collateral | Must | 1.0 |
| FR-08 | System issues/revokes ERC-8004 validations automatically | Must | 1.0 |
| FR-09 | Claimants must provide deposit (% of claimed amount) | Must | 1.1 |
| FR-10 | Claims must reference payment proof for eligibility | Should | 1.1 |
| FR-11 | Council determined by agent's terms, not claimant choice | Must | 1.1 |
| FR-12 | Partial collateral locking when insufficient funds | Should | 1.1 |
| FR-13 | Claimant deposits distributed to voting council members (all outcomes) | Must | 1.2 |
| FR-14 | Governance can create/close councils | Must | 1.2 |
| FR-15 | Governance can reassign agents to different councils | Must | 1.2 |
| FR-16 | Council members can change votes during voting period | Should | 1.2 |
| FR-17 | Expired claims with no votes return deposit to claimant | Must | 1.2 |
| FR-18 | Safe owners can propose governance actions via dashboard | Must | 1.3 |
| FR-19 | Safe owners can view and vote on pending transactions | Must | 1.3 |
| FR-20 | Pending transactions show human-readable descriptions | Must | 1.3 |

---

## 3. Assumptions & Constraints

### 3.1 Assumptions

| ID | Assumption |
|----|------------|
| A-01 | ERC-8004 Identity Registry is deployed and operational |
| A-02 | USDC is the collateral and payment asset |
| A-03 | x402 protocol is available for payment metadata (but not required) |
| A-04 | IPFS/Filecoin available for T&C and evidence storage |
| A-05 | Council members are trusted parties appointed by governance |
| A-06 | Providers own their agents via ERC-8004 (ERC-721 ownership) |
| A-07 | Governance operates via Safe multisig |
| A-08 | Safe Transaction Service is available for Base Sepolia/Base |

### 3.2 Constraints

| ID | Constraint |
|----|------------|
| C-01 | Single chain deployment (Base) initially |
| C-02 | No cross-chain collateral or claims |
| C-03 | One council per agent (determined by terms or governance) |
| C-04 | No appeal mechanism (final ruling) |
| C-05 | No vote delegation |
| C-06 | Safe Transaction Service rate limits (~10 req/min) |

---

## 4. Actors & Roles

### 4.1 Provider
The owner of an ERC-8004 agent who establishes trust through collateral and terms.

### 4.2 Client
A user or agent that discovers and uses trustworthy agents.

### 4.3 Claimant
A client who has suffered damages and seeks compensation.

### 4.4 Council Member
A trusted party appointed to evaluate claims within a specific vertical.

### 4.5 Governance (Safe Multisig)
Centralized administrative role operated via Safe multisig.

**Capabilities:**
- Create new councils via Governance Dashboard
- Close councils (if no agents/claims linked)
- Reassign agents to different councils
- Add/remove council members
- Pause system in emergencies

**Access:** Only Safe multisig owners can access the Governance Dashboard.

---

## 5. Architectural Decisions

### AD-08: Blockchain-First Dashboard [v1.3 NEW]

**Decision:** Governance Dashboard reads council data from CouncilRegistry contract, not from database.

**Rationale:** 
- Blockchain is single source of truth
- Avoids sync issues between DB and chain
- Reduces API complexity
- Database only stores metadata (names, emails) not governance state

**Status:** Implemented in v1.3

---

### AD-09: Safe SDK Integration [v1.3 NEW]

**Decision:** Frontend proposes transactions directly to Safe Transaction Service, bypassing backend for signing.

**Rationale:**
- Users sign with MetaMask in browser
- No private keys on backend
- Direct integration avoids middleware complexity
- Rate limits managed by reading nonce from contract, not API

**Implementation:**
```
Frontend → useSafeTransaction hook → Safe Transaction Service
                ↓
           MetaMask signs
```

**Status:** Implemented in v1.3

---

### AD-10: Pending Transactions Metadata [v1.3 NEW]

**Decision:** Store human-readable metadata for pending Safe transactions in PostgreSQL.

**Rationale:**
- Safe Transaction Service only stores raw transaction data
- Users need to understand what they're voting on
- Metadata includes: action type, title, description, related entities

**Status:** Implemented in v1.3

---

## 6. System Components

### 6.1 Smart Contracts (On-Chain)

| Contract | Description |
|----------|-------------|
| CollateralVault | Manages USDC deposits per agent |
| TermsRegistry | Stores T&C hashes and council binding |
| CouncilRegistry | Manages councils and members |
| ClaimsManager | Handles claim lifecycle |
| RulingExecutor | Executes approved claims |
| TrustfulValidator | Issues ERC-8004 validations |

### 6.2 Backend Services (Off-Chain)

| Service | Description |
|---------|-------------|
| Governance API | REST API for dashboard |
| Safe Service | Reads from Safe contract |
| Blockchain Service | Reads from CouncilRegistry |
| Auth Service | SIWE authentication |
| Email Service | Notifications (optional) |

### 6.3 Frontend Applications

| Application | Description |
|-------------|-------------|
| Governance Dashboard | Safe owner interface for council management |
| Provider Dashboard | Agent registration and collateral management |
| Council Dashboard | Claim voting interface (future) |
| Claims Portal | Claimant interface (future) |

---

## 7. Governance Dashboard Architecture

### 7.1 Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Governance Dashboard (React)                          │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Login     │  │  Dashboard  │  │  Councils   │  │  Pending    │        │
│  │   (SIWE)    │  │  (Stats)    │  │  (CRUD)     │  │  Votes      │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    useSafeTransaction Hook                          │   │
│  │  - Reads nonce from Safe contract (no API)                          │   │
│  │  - Computes transaction hash on-chain                               │   │
│  │  - Signs with MetaMask                                              │   │
│  │  - Proposes to Safe Transaction Service                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Governance API (Express)                            │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │    Auth     │  │  Councils   │  │    Safe     │  │  Pending    │        │
│  │  /auth/*    │  │ /councils/* │  │  /safe/*    │  │ /pending/*  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Services Layer                                 │   │
│  │  - blockchain.ts: Read CouncilRegistry via RPC                      │   │
│  │  - safe.ts: Read Safe info from contract (cached)                   │   │
│  │  - safeTx.ts: Encode governance transactions                        │   │
│  │  - auth.ts: SIWE verification and sessions                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                                   │
                    ▼                                   ▼
      ┌──────────────────────────┐      ┌──────────────────────────┐
      │       PostgreSQL         │      │     Base Sepolia         │
      │  - Sessions              │      │  - CouncilRegistry       │
      │  - Member metadata       │      │  - Safe contract         │
      │  - Pending tx metadata   │      │  - USDC                  │
      └──────────────────────────┘      └──────────────────────────┘
```

### 7.2 Authentication Flow

```
1. User clicks "Connect Wallet"
2. MetaMask prompts for account selection
3. Frontend requests nonce from /auth/nonce
4. Frontend constructs SIWE message
5. MetaMask prompts for signature
6. Frontend POSTs to /auth/login with message + signature
7. Backend verifies signature
8. Backend checks if address is Safe owner (reads from Safe contract)
9. Backend creates session, returns token
10. Frontend stores token in localStorage
```

### 7.3 Transaction Proposal Flow

```
1. User fills form (e.g., Create Council)
2. Frontend POSTs to /councils/propose-create
3. Backend encodes transaction data using CouncilRegistry ABI
4. Backend returns { to, data, value }
5. Frontend calls useSafeTransaction.proposeTransaction()
6. Hook reads nonce from Safe contract (no API call)
7. Hook computes safeTxHash on-chain
8. MetaMask prompts for signature
9. User signs
10. Hook POSTs to Safe Transaction Service
11. Hook stores metadata via /pending endpoint
12. Success screen shows with link to Safe UI
```

### 7.4 Database Schema

```sql
-- Sessions for authentication
CREATE TABLE sessions (
  id VARCHAR(36) PRIMARY KEY,
  address VARCHAR(42) NOT NULL,
  nonce VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Member metadata (not stored on-chain)
CREATE TABLE council_member_metadata (
  council_id VARCHAR(66) NOT NULL,
  member_address VARCHAR(42) NOT NULL,
  name VARCHAR(200),
  email VARCHAR(200),
  description TEXT,
  PRIMARY KEY (council_id, member_address)
);

-- Pending transaction metadata
CREATE TABLE pending_transactions (
  safe_tx_hash VARCHAR(66) PRIMARY KEY,
  action_type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  proposed_by VARCHAR(42) NOT NULL,
  proposed_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending',
  executed_at TIMESTAMPTZ
);
```

---

## 8. Data Flows

### 8.1 Council Creation

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  User    │────▶│  Dashboard  │────▶│ Governance   │────▶│ Safe TX     │
│          │     │             │     │ API          │     │ Service     │
└──────────┘     └─────────────┘     └──────────────┘     └─────────────┘
     │                 │                    │                    │
     │  1. Fill form   │                    │                    │
     │─────────────────▶                    │                    │
     │                 │  2. Get encoded tx │                    │
     │                 │───────────────────▶│                    │
     │                 │◀───────────────────│                    │
     │                 │  3. Read nonce     │                    │
     │                 │──────────────────────────────────▶ Safe Contract
     │                 │◀──────────────────────────────────
     │  4. Sign prompt │                    │                    │
     │◀────────────────│                    │                    │
     │  5. Signature   │                    │                    │
     │─────────────────▶                    │                    │
     │                 │  6. Propose tx     │                    │
     │                 │───────────────────────────────────────▶│
     │                 │◀───────────────────────────────────────│
     │                 │  7. Store metadata │                    │
     │                 │───────────────────▶│                    │
     │  8. Success     │◀───────────────────│                    │
     │◀────────────────│                    │                    │
```

### 8.2 Pending Vote Flow

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Owner 2 │────▶│  Pending    │────▶│ Governance   │────▶│ Safe TX     │
│          │     │  Votes Page │     │ API          │     │ Service     │
└──────────┘     └─────────────┘     └──────────────┘     └─────────────┘
     │                 │                    │                    │
     │  1. View list   │                    │                    │
     │─────────────────▶                    │                    │
     │                 │  2. GET /pending   │                    │
     │                 │───────────────────▶│                    │
     │                 │                    │  3. Get confirms   │
     │                 │                    │───────────────────▶│
     │                 │◀───────────────────│◀───────────────────│
     │  4. Show txs    │                    │                    │
     │◀────────────────│                    │                    │
     │                 │                    │                    │
     │  5. Click Vote  │                    │                    │
     │─────────────────▶                    │                    │
     │                 │  6. Open Safe UI   │                    │
     │────────────────────────────────────────────────────────▶ │
     │  7. Sign in Safe│                    │                    │
     │───────────────────────────────────────────────────────▶  │
```

---

## 9. API Reference

See [API_REFERENCE.md](./API_REFERENCE.md) for complete endpoint documentation.

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /auth/nonce | Get SIWE nonce |
| POST | /auth/login | Authenticate with SIWE |
| GET | /councils | List all councils |
| POST | /councils/propose-create | Encode council creation tx |
| POST | /councils/:id/propose-add-member | Encode add member tx |
| GET | /safe/info | Get Safe address and threshold |
| GET | /pending | List pending transactions |
| POST | /pending | Store transaction metadata |

---

## 10. Off-Chain Components

### 10.1 Environment Configuration

```bash
# Backend
DATABASE_URL=postgresql://...
CHAIN_ID=84532
RPC_URL=https://sepolia.base.org
COUNCIL_REGISTRY_ADDRESS=0x...
SAFE_ADDRESS=0x568A391C188e2aF11FA7550ACca170e085B00e7F
CORS_ORIGIN=https://trustful-agents.ai
```

### 10.2 External Dependencies

| Service | URL | Purpose |
|---------|-----|---------|
| Safe Transaction Service | safe-transaction-base-sepolia.safe.global | Transaction proposals |
| Base Sepolia RPC | sepolia.base.org | Blockchain reads |
| Safe Web App | app.safe.global | User voting interface |

---

## 11. Security Considerations

### 11.1 Access Control

| Function | Access |
|----------|--------|
| Dashboard login | Safe multisig owners only |
| Council creation | Safe multisig (2/3 threshold) |
| Member management | Safe multisig |
| View councils | Authenticated users |

### 11.2 Rate Limiting Strategy

| Service | Limit | Mitigation |
|---------|-------|------------|
| Safe API | ~10/min | Read nonce from contract |
| Safe API | ~10/min | Cache Safe info for 5 minutes |
| Safe API | ~10/min | Batch transaction fetches |

---

## 12. Deployment Architecture

### 12.1 Production Setup

```
┌─────────────────────────────────────────────────────────────────┐
│                      AWS t3.micro                                │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │   Nginx          │  │   PM2            │                     │
│  │   (Reverse Proxy)│  │   governance-api │                     │
│  │   + Static Files │  │   (Node.js)      │                     │
│  └────────┬─────────┘  └────────┬─────────┘                     │
│           │                     │                                │
│           ▼                     ▼                                │
│  ┌──────────────────────────────────────────┐                   │
│  │              Docker                       │                   │
│  │   ┌─────────────────────────────────┐    │                   │
│  │   │        PostgreSQL               │    │                   │
│  │   │        (trustful_governance)    │    │                   │
│  │   └─────────────────────────────────┘    │                   │
│  └──────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    trustful-agents.ai
```

### 12.2 Deployment Commands

```bash
# Backend
cd apps/governance-api
npm run build
pm2 restart governance-api

# Frontend (built assets served by Nginx)
cd apps/governance-dashboard
npm run build
# dist/ served as static files

# Database migrations
psql -d trustful_governance -f src/db/migrations/003_pending_transactions.sql
```

---

## 13. Open Items & Future Work

### 13.1 Completed in v1.3

- [x] Governance Dashboard with SIWE login
- [x] Council CRUD via Safe multisig
- [x] Safe SDK integration (no backend signing)
- [x] Pending votes with human-readable context
- [x] Rate limit mitigation (contract reads)

### 13.2 Future Enhancements

- [ ] Council Dashboard for claim voting
- [ ] Claims Portal for claimants
- [ ] Email notifications for pending votes
- [ ] Mobile-responsive dashboard
- [ ] Mainnet deployment
- [ ] Subgraph for historical data

---

## Appendix A: Contract Addresses (Base Sepolia)

| Contract | Address |
|----------|---------|
| CouncilRegistry | See deployments/84532.json |
| Safe Multisig | 0x568A391C188e2aF11FA7550ACca170e085B00e7F |
| USDC | 0x036CbD53842c5426634e7929541eC2318f3dCF7e |

---

## Appendix B: Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, TailwindCSS, viem, TanStack Query |
| Backend | Node.js, Express, TypeScript, pg |
| Database | PostgreSQL 14 |
| Blockchain | Solidity 0.8.20, Foundry |
| Infrastructure | AWS EC2, Docker, PM2, Nginx |
| Authentication | SIWE (Sign-In with Ethereum) |
| Multisig | Safe (formerly Gnosis Safe) |
