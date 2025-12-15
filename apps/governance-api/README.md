# Trustful Agents Governance API

Backend service for the governance dashboard with SIWE authentication, Safe SDK integration, and AWS SES email notifications.

## Features

- **SIWE Authentication**: Sign-In with Ethereum for Safe multisig owners
- **Safe SDK Integration**: Propose, sign, and track governance transactions
- **Council Member Management**: Off-chain metadata for council members
- **Email Notifications**: AWS SES integration for governance alerts
- **Audit Logging**: Track all governance actions
- **Rate Limiting**: Protect against abuse

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Safe multisig deployed on Base/Base Sepolia
- AWS SES configured (for production emails)

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Setup Database

```bash
# Create database
createdb trustful_governance

# Run migrations
pnpm db:migrate
```

### 4. Start Development Server

```bash
pnpm dev
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/nonce` | Get SIWE nonce |
| POST | `/auth/login` | Login with SIWE signature |
| POST | `/auth/logout` | Invalidate session |
| GET | `/auth/me` | Get current user profile |
| PUT | `/auth/me` | Update profile |

### Councils

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/councils` | List active councils |
| GET | `/councils/:id` | Get council details |
| GET | `/councils/:id/members` | Get council members |
| POST | `/councils/:id/members` | Add member (+ metadata) |
| PUT | `/councils/:id/members/:addr` | Update member metadata |
| DELETE | `/councils/:id/members/:addr` | Remove member |

### Safe Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/safe/info` | Get Safe multisig info |
| GET | `/safe/pending` | List pending transactions |
| GET | `/safe/transactions/:hash` | Get transaction details |
| POST | `/safe/propose` | Log proposal intent |
| POST | `/safe/sign/:hash` | Log signature |
| POST | `/safe/execute/:hash` | Log execution |

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/agents/:id` | Get agent council assignment |
| POST | `/agents/:id/reassign` | Prepare reassignment |

## Database Schema

```sql
-- governance_signers: Safe multisig owners
-- council_members: Off-chain member metadata
-- sessions: SIWE authentication sessions
-- audit_log: All governance actions
-- email_queue: Pending email notifications
```

See `src/db/schema.sql` for full schema.

## Authentication Flow

1. Client requests nonce: `GET /auth/nonce`
2. Client signs SIWE message with wallet
3. Client submits to: `POST /auth/login`
4. API verifies:
   - Signature is valid
   - Signer is Safe owner
   - Nonce hasn't been used
5. API returns session token
6. Client includes token in `Authorization: Bearer <token>` header

## Safe Transaction Flow

The API doesn't hold private keys. Actual signing happens client-side:

1. Governance action initiated in dashboard
2. API prepares transaction data (`/agents/:id/reassign`, etc.)
3. Client uses Safe SDK to create and sign transaction
4. Client reports back to API for audit logging
5. Other signers notified via email
6. Transaction executed when threshold reached

## Email Templates

- `council_deletion_proposed` - Notify signers of deletion vote
- `council_deleted` - Confirm council deletion
- `council_deletion_rejected` - Deletion vote failed
- `member_added` - Welcome new council member
- `member_removed` - Notify removed member
- `vote_required` - Prompt signers to vote

## Production Deployment

### AWS Infrastructure

1. **RDS PostgreSQL**: Database
2. **ECS/Fargate or Lambda**: API hosting
3. **SES**: Email delivery
4. **Secrets Manager**: Environment secrets

### Environment Variables

Set via AWS Secrets Manager or ECS task definition:

```
DATABASE_URL=postgresql://...
SAFE_ADDRESS=0x...
AWS_REGION=eu-central-1
# ... etc
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["node", "dist/index.js"]
```

## Development

```bash
# Type checking
pnpm typecheck

# Run migrations
pnpm db:migrate

# Start dev server with hot reload
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Security Considerations

1. **SIWE Verification**: All requests validated against Safe owners
2. **Rate Limiting**: Prevent brute force and DoS
3. **Input Validation**: Zod schemas for all inputs
4. **SQL Injection**: Parameterized queries only
5. **CORS**: Restricted to dashboard origin
6. **Helmet**: Security headers enabled

## Phase 2 Roadmap

- [ ] Migration mode for agent reassignment with open claims
- [ ] WebSocket support for real-time updates
- [ ] Multi-chain support
- [ ] Council reputation metrics
