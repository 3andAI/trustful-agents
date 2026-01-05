# Trustful Agents Governance API Reference

## Version 1.0
## Base URL: `https://trustful-agents.ai/api` (production) or `http://localhost:3001` (development)

---

## Overview

The Governance API provides endpoints for managing the Trustful Agents governance system. All governance actions (council creation, member management) are executed via Safe multisig transactions.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Frontend (Governance Dashboard)                     │
│  - React + Vite + TailwindCSS                                               │
│  - MetaMask wallet integration via viem                                      │
│  - Direct Safe Transaction Service integration                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Backend (Governance API)                            │
│  - Express.js + TypeScript                                                   │
│  - SIWE authentication                                                       │
│  - PostgreSQL for metadata                                                   │
│  - Blockchain reads via viem                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
┌──────────────────────────────┐      ┌──────────────────────────────┐
│     Safe Transaction         │      │     Base Sepolia             │
│     Service API              │      │     Blockchain               │
│  - Transaction proposals     │      │  - CouncilRegistry           │
│  - Confirmation tracking     │      │  - Safe contract reads       │
└──────────────────────────────┘      └──────────────────────────────┘
```

### Authentication Flow

1. Client requests nonce from `/auth/nonce`
2. Client signs SIWE message with MetaMask
3. Client submits signed message to `/auth/login`
4. Server verifies signature and checks Safe ownership
5. Server returns JWT-like session token
6. Client includes token in `Authorization: Bearer <token>` header

---

## Authentication Endpoints

### GET /auth/nonce

Generate a nonce for SIWE authentication.

**Response:**
```json
{
  "nonce": "abc123xyz..."
}
```

---

### POST /auth/login

Authenticate with Sign-In with Ethereum (SIWE).

**Request Body:**
```json
{
  "message": "trustful-agents.ai wants you to sign in...",
  "signature": "0x..."
}
```

**Response (200):**
```json
{
  "token": "session-id-uuid",
  "address": "0x1234...5678",
  "expiresAt": "2025-01-06T00:00:00.000Z"
}
```

**Response (403):**
```json
{
  "error": "Access denied. Only Safe multisig owners can access the governance dashboard."
}
```

---

### POST /auth/logout

Invalidate the current session.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true
}
```

---

### GET /auth/me

Get current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "address": "0x1234...5678",
  "name": "Alice",
  "email": "alice@example.com",
  "isSafeSigner": true
}
```

---

## Council Endpoints

### GET /councils

List all councils from blockchain.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "councils": [
    {
      "councilId": "0xabc123...",
      "name": "General AI Council",
      "description": "Handles general AI agent disputes",
      "vertical": "general",
      "memberCount": 5,
      "quorumPercentage": 5100,
      "claimDepositPercentage": 1000,
      "votingPeriod": 604800,
      "evidencePeriod": 259200,
      "active": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "closedAt": null
    }
  ],
  "count": 1
}
```

---

### GET /councils/:councilId

Get a specific council.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "councilId": "0xabc123...",
  "name": "General AI Council",
  "description": "Handles general AI agent disputes",
  "vertical": "general",
  "memberCount": 5,
  "quorumPercentage": 5100,
  "claimDepositPercentage": 1000,
  "votingPeriod": 604800,
  "evidencePeriod": 259200,
  "active": true,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "closedAt": null
}
```

---

### GET /councils/:councilId/members

Get members of a council.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "members": [
    {
      "address": "0x1234...5678",
      "councilId": "0xabc123...",
      "joinedAt": "2025-01-01T00:00:00.000Z",
      "claimsVoted": 5,
      "active": true,
      "name": "Alice",
      "email": "alice@example.com",
      "description": "Senior arbitrator"
    }
  ],
  "count": 1
}
```

---

### POST /councils/propose-create

Generate encoded transaction data to create a new council.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Finance AI Council",
  "description": "Handles financial AI disputes",
  "vertical": "finance",
  "quorumPercentage": 5100,
  "claimDepositPercentage": 1000,
  "votingPeriodDays": 7,
  "evidencePeriodDays": 3
}
```

**Response:**
```json
{
  "transaction": {
    "to": "0x...",
    "data": "0x...",
    "value": "0",
    "description": "Create council: Finance AI Council"
  },
  "safeUrl": "https://app.safe.global/transactions/queue?safe=basesep:0x...",
  "message": "Transaction prepared. Sign with Safe multisig to execute."
}
```

---

### POST /councils/:councilId/propose-add-member

Generate encoded transaction data to add a member.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "memberAddress": "0xnewmember...",
  "name": "Bob",
  "email": "bob@example.com",
  "description": "New arbitrator"
}
```

**Response:**
```json
{
  "transaction": {
    "to": "0x...",
    "data": "0x...",
    "value": "0",
    "description": "Add member 0xnew... to council"
  },
  "safeUrl": "https://app.safe.global/transactions/queue?safe=basesep:0x...",
  "message": "Transaction prepared.",
  "memberMetadata": {
    "name": "Bob",
    "email": "bob@example.com",
    "description": "New arbitrator"
  }
}
```

---

### POST /councils/:councilId/propose-remove-member

Generate encoded transaction data to remove a member.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "memberAddress": "0xmember..."
}
```

**Response:** Same structure as propose-add-member.

---

### POST /councils/:councilId/propose-close

Generate encoded transaction data to close a council.

**Headers:** `Authorization: Bearer <token>`

**Response:** Same structure as propose-create.

---

### GET /councils/:councilId/can-close

Check if a council can be closed.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "canClose": true,
  "reason": "Council has no active claims or agents"
}
```

---

## Safe Endpoints

### GET /safe/info

Get Safe multisig information.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "address": "0x568A391C188e2aF11FA7550ACca170e085B00e7F",
  "threshold": 2,
  "owners": [
    "0x1234...5678",
    "0xabcd...efgh"
  ],
  "nonce": 5
}
```

---

## Pending Transactions Endpoints

### GET /pending

List all pending governance transactions.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "transactions": [
    {
      "safeTxHash": "0x...",
      "actionType": "create_council",
      "title": "Create Council: Finance AI Council",
      "description": "Create a new finance council with 51% quorum",
      "metadata": {
        "name": "Finance AI Council",
        "vertical": "finance"
      },
      "proposedBy": "0x1234...5678",
      "proposedAt": "2025-01-05T10:00:00.000Z",
      "status": "pending",
      "confirmations": 1,
      "confirmationsRequired": 2
    }
  ],
  "safeThreshold": 2,
  "safeOwners": 3
}
```

---

### GET /pending/:safeTxHash

Get a specific pending transaction.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "safeTxHash": "0x...",
  "actionType": "create_council",
  "title": "Create Council: Finance AI Council",
  "description": "Create a new finance council with 51% quorum",
  "metadata": {
    "name": "Finance AI Council",
    "vertical": "finance"
  },
  "proposedBy": "0x1234...5678",
  "proposedAt": "2025-01-05T10:00:00.000Z",
  "status": "pending"
}
```

---

### POST /pending

Store metadata for a new pending transaction.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "safeTxHash": "0x...",
  "actionType": "create_council",
  "title": "Create Council: Finance AI Council",
  "description": "Create a new finance council with 51% quorum",
  "metadata": {
    "name": "Finance AI Council",
    "vertical": "finance"
  }
}
```

**Response:**
```json
{
  "success": true,
  "safeTxHash": "0x..."
}
```

---

### POST /pending/sync

Synchronize pending transaction statuses with Safe API.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "checked": 5,
  "updated": 2
}
```

---

### DELETE /pending/:safeTxHash

Mark a transaction as rejected/cancelled.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true
}
```

---

## Action Types Reference

| Action Type | Description | Metadata Fields |
|-------------|-------------|-----------------|
| `create_council` | Create a new council | `name`, `vertical`, `quorumPercentage`, `votingPeriodDays` |
| `close_council` | Close an existing council | `councilId`, `councilName` |
| `add_member` | Add a member to a council | `councilId`, `councilName`, `memberAddress`, `memberName` |
| `remove_member` | Remove a member from a council | `councilId`, `councilName`, `memberAddress`, `memberName` |

---

## Error Responses

All endpoints may return these error responses:

**401 Unauthorized:**
```json
{
  "error": "Missing or invalid authorization header"
}
```

**403 Forbidden:**
```json
{
  "error": "Not a Safe multisig owner"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error"
}
```

---

## Environment Variables

### Backend (.env)

```bash
# Server
PORT=3001
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/trustful_governance

# Blockchain
CHAIN_ID=84532
RPC_URL=https://sepolia.base.org

# Contracts
COUNCIL_REGISTRY_ADDRESS=0x...
SAFE_ADDRESS=0x568A391C188e2aF11FA7550ACca170e085B00e7F

# CORS
CORS_ORIGIN=https://trustful-agents.ai

# Auth
SESSION_EXPIRY_HOURS=24
DOMAIN=trustful-agents.ai
```

---

## Rate Limits

- Safe Transaction Service: ~10 requests/minute (use contract reads when possible)
- Governance API: No hard limits, but respect reasonable usage

---

## SDK Usage Example

```typescript
import { getSafeInfo, proposeCreateCouncil, storePendingTransaction } from './api';

// 1. Get Safe info
const safe = await getSafeInfo();
console.log(`Safe threshold: ${safe.threshold}`);

// 2. Propose a council creation
const proposal = await proposeCreateCouncil({
  name: 'Finance AI Council',
  vertical: 'finance',
  quorumPercentage: 5100,
});

// 3. Sign with MetaMask and propose to Safe
// (handled by useSafeTransaction hook)

// 4. Store metadata
await storePendingTransaction({
  safeTxHash: '0x...',
  actionType: 'create_council',
  title: 'Create Council: Finance AI Council',
});
```
