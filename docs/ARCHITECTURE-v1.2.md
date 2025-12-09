# Trustful Agents Architecture Specification

## Version 1.2
## Date: 2025-12-09

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-04 | Initial architecture with 7 contracts |
| 1.1 | 2025-12-05 | Added claim deposits, payment binding, council binding, partial locking |
| 1.2 | 2025-12-09 | Deposit distribution to voters, governance role, maxPayoutPerClaim off-chain, vote change |

---

## Table of Contents

1. Executive Summary
2. Requirements
3. Assumptions & Constraints
4. Actors & Roles
5. Architectural Decisions
6. System Components
7. Contract Interfaces
8. Data Flows
9. Economic Model
10. Off-Chain Components
11. Security Considerations
12. Open Items & Future Work

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
- Governance via multisig for council management

### v1.2 Highlights

- **Unbiased deposit distribution:** Claimant deposits always go to voting council members regardless of outcome (eliminates approval/rejection bias)
- **Off-chain maxPayoutPerClaim:** Liability cap lives in T&C document, not on-chain (avoids sync issues)
- **Governance functions:** Council close, agent reassignment, member management
- **Vote modification:** Council members can change votes during voting period

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

### 2.2 Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-01 | Gas-efficient operations for high-frequency interactions | Should |
| NFR-02 | Upgradeable contracts via proxy pattern | Should |
| NFR-03 | Event emissions for off-chain indexing | Must |
| NFR-04 | Pausable in emergency situations | Must |
| NFR-05 | Compatible with Base blockchain | Must |

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
| A-07 | Governance operates via multisig (e.g., Gnosis Safe) |

### 3.2 Constraints

| ID | Constraint |
|----|------------|
| C-01 | Single chain deployment (Base) initially |
| C-02 | No cross-chain collateral or claims |
| C-03 | One council per agent (determined by terms or governance) |
| C-04 | No appeal mechanism (final ruling) |
| C-05 | No vote delegation |

---

## 4. Actors & Roles

### 4.1 Provider

The owner of an ERC-8004 agent who establishes trust through collateral and terms.

**Capabilities:**
- Deposit/withdraw collateral
- Register/update T&C
- View validation status
- View pending claims
- Submit counter-evidence

### 4.2 Client

A user or agent that discovers and uses trustworthy agents.

**Capabilities:**
- Verify agent validation status
- View collateral amount
- Read T&C before using agent
- Check withdrawal pending status (risk signal)

### 4.3 Claimant

A client who has suffered damages and seeks compensation.

**Capabilities:**
- File claims with evidence and deposit
- Submit additional evidence
- Track claim status
- Cancel claims (deposit forfeited)
- Receive compensation if approved

### 4.4 Council Member

A trusted party appointed to evaluate claims within a specific vertical.

**Capabilities:**
- View claims assigned to council
- Review evidence
- Cast votes with approved amount
- Change votes during voting period
- Receive portion of claimant deposits

### 4.5 Governance (Multisig)

Centralized administrative role operated via multisig.

**Capabilities:**
- Create new councils
- Close councils (if no agents/claims linked)
- Reassign agents to different councils
- Add/remove council members
- Pause system in emergencies

---

## 5. Architectural Decisions

### AD-01: Collateral Per Agent (Not Per Provider)

**Decision:** Each agent has its own collateral account.

**Rationale:** Isolates risk between agents. One agent's claims don't drain collateral for other agents.

**Status:** Unchanged from v1.0

---

### AD-02: Council Binding via Terms

**Decision:** Council is bound to agent via T&C registration. Governance can override.

**Rationale:** Provider selects appropriate vertical; governance can correct misassignment.

**Status:** Enhanced in v1.2 with `reassignAgentCouncil()`

---

### AD-03: One Member One Vote

**Decision:** Each council member gets one vote, regardless of stake.

**Rationale:** Simplicity for MVP. Stake-weighted voting deferred to future version.

**Status:** Unchanged from v1.0

---

### AD-04: Grace Period for Withdrawals

**Decision:** Collateral withdrawals require grace period (e.g., 7 days).

**Rationale:** Prevents front-running (withdrawing before claim is filed).

**Status:** Unchanged from v1.0

---

### AD-05: Claim Deposits Required

**Decision:** Claimants must deposit percentage of claimed amount.

**Rationale:** Prevents spam claims; creates economic cost for frivolous claims.

**Status:** Unchanged from v1.1

---

### AD-06: Deposit Distribution to Voters Only [v1.2 CHANGE]

**Decision:** Claimant deposits are ALWAYS distributed to voting council members, regardless of claim outcome.

**Rationale:** Eliminates bias. If deposits were returned on approval, councils would be incentivized to approve. By distributing to voters regardless of outcome, councils have no financial preference for approve/reject.

**Exception:** If voting period expires with zero votes, deposit returns to claimant (protects against inactive councils).

**Previous (v1.1):** Deposits refunded to claimant on approval, forfeited to council on rejection.

---

### AD-07: maxPayoutPerClaim Off-Chain [v1.2 CHANGE]

**Decision:** The maximum payout per claim is stored in the T&C document (off-chain), not in contract storage.

**Rationale:** 
- Avoids sync issues when T&C is updated
- T&C document is the source of truth
- Council verifies from document at claim time
- Reduces on-chain storage costs

**Previous (v1.1):** maxPayoutPerClaim stored in TermsConfig struct on-chain.

**Implementation:** 
- T&C JSON schema requires `maxPayoutPerClaim` field
- Council reads from T&C document during claim evaluation
- Evidence package includes T&C snapshot with hash verification

---

### AD-08: Governance via Multisig [v1.2 NEW]

**Decision:** All governance actions require multisig confirmation.

**Rationale:**
- No single point of failure
- Transparent decision-making
- Can upgrade to DAO in future

**Implementation:** Deploy Gnosis Safe, set as `governance` address in contracts.

---

### AD-09: Vote Changes Overwrite [v1.2 NEW]

**Decision:** When a council member changes their vote, only the final vote counts.

**Rationale:**
- Simplicity in median calculation
- Reduces storage (no vote history per claim)
- Members can correct mistakes

**Implementation:** `changeVote()` overwrites previous VoteRecord.

---

### AD-10: Permissionless Claim Finalization [v1.2 NEW]

**Decision:** Anyone can call `finalizeClaim()` after voting deadline.

**Rationale:**
- No dependency on specific party to trigger resolution
- Enables automation via keepers/bots
- Protects claimants from stalled claims

**Implementation:** `finalizeClaim()` checks deadline, processes result, handles deposits.

---

### AD-11: Hybrid Payment Recognition

**Decision:** Support x402 payment metadata when available, but accept evidence-based proof for any payment method.

**Rationale:**
- x402 provides structured proof when used
- Cannot mandate x402 for all agent interactions
- Council evaluates payment proof validity

**Implementation:**
- `paymentReceiptHash` in Claim struct (optional)
- Evidence package includes payment proof
- Council guidelines for acceptable proofs

---

### AD-12: No Appeal Mechanism

**Decision:** Council rulings are final. No appeal process.

**Rationale:** Simplicity for MVP. Appeals add complexity and delay resolution.

**Status:** Confirmed in v1.2 (explicitly removed from consideration)

---

### AD-13: No Vote Delegation

**Decision:** Council members cannot delegate votes.

**Rationale:** Simplicity for MVP. Delegation adds complexity around responsibility.

**Status:** Confirmed in v1.2 (explicitly removed from consideration)

---

## 6. System Components

### 6.1 Contract Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CONTRACTS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CORE                                                                       │
│  ├── CollateralVault.sol        Holds USDC per agent                        │
│  ├── TermsRegistry.sol          Stores T&C versions per agent               │
│  └── TrustfulValidator.sol      Issues/revokes ERC-8004 validations         │
│                                                                             │
│  DISPUTE RESOLUTION                                                         │
│  ├── CouncilRegistry.sol        Manages councils and members [v1.2]         │
│  ├── ClaimsManager.sol          Claim lifecycle and voting [v1.2]           │
│  └── RulingExecutor.sol         Executes compensations [v1.2]               │
│                                                                             │
│  ACCESS CONTROL                                                             │
│  └── TrustfulPausable.sol       Multisig emergency pause                    │
│                                                                             │
│  EXTERNAL                                                                   │
│  ├── ERC-8004 Registry          Agent identity and validation               │
│  ├── USDC                       Collateral and payment asset                │
│  └── Gnosis Safe                Governance multisig                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Contract Relationships

```
┌──────────────┐     owns      ┌──────────────┐
│   Provider   │──────────────▶│  ERC-8004    │
└──────────────┘               │   Agent      │
       │                       └──────────────┘
       │ deposits                     │
       ▼                              │ agentId
┌──────────────┐               ┌──────────────┐
│  Collateral  │◀──────────────│    Terms     │
│    Vault     │               │   Registry   │
└──────────────┘               └──────────────┘
       │                              │
       │ locks/unlocks               │ councilId
       ▼                              ▼
┌──────────────┐               ┌──────────────┐
│    Claims    │──────────────▶│   Council    │
│   Manager    │   assigned    │   Registry   │
└──────────────┘               └──────────────┘
       │                              │
       │ approved                     │ members
       ▼                              ▼
┌──────────────┐               ┌──────────────┐
│    Ruling    │──────────────▶│   Council    │
│   Executor   │  distributes  │   Members    │
└──────────────┘    deposits   └──────────────┘
```

---

## 7. Contract Interfaces

### 7.1 ICollateralVault

Holds USDC collateral per agent. Anyone can deposit, only owner can withdraw.

**Structs:**
```solidity
struct CollateralAccount {
    uint256 totalDeposited;
    uint256 lockedAmount;
    uint256 withdrawalInitiatedAt;    // 0 = no pending withdrawal
    uint256 pendingWithdrawalAmount;
    uint256 pendingClaimCount;
}
```

**Key Functions:**
| Function | Access | Description |
|----------|--------|-------------|
| `deposit(agentId, amount)` | Anyone | Deposit USDC for agent |
| `initiateWithdrawal(agentId, amount)` | Owner | Start withdrawal with grace period |
| `cancelWithdrawal(agentId)` | Owner | Cancel pending withdrawal |
| `executeWithdrawal(agentId)` | Owner | Complete withdrawal after grace period |
| `lock(agentId, claimId, amount)` | ClaimsManager | Lock collateral for claim |
| `unlock(agentId, claimId, amount)` | ClaimsManager | Unlock after rejection |
| `compensate(agentId, claimId, recipient, amount)` | RulingExecutor | Transfer compensation |
| `getAccount(agentId)` | View | Get account details |
| `getAvailableBalance(agentId)` | View | Get unlocked balance |

---

### 7.2 ITermsRegistry

Stores T&C versions per agent. Only owner can register. Old T&C remains valid for prior uses.

**Structs:**
```solidity
struct TermsVersion {
    uint256 version;
    bytes32 contentHash;
    string contentUri;
    uint256 effectiveFrom;
    uint256 effectiveUntil;     // 0 = current
    bytes32 councilId;          // Assigned council
}
```

**Note:** `maxPayoutPerClaim` is NOT stored on-chain. It lives in the T&C document.

**Key Functions:**
| Function | Access | Description |
|----------|--------|-------------|
| `registerTerms(agentId, hash, uri, councilId)` | Owner | Register initial T&C |
| `updateTerms(agentId, hash, uri)` | Owner | Update T&C (council unchanged) |
| `invalidateTerms(agentId)` | Validator | Invalidate on ownership change |
| `getActiveTerms(agentId)` | View | Get current T&C |
| `getTermsAtTime(agentId, timestamp)` | View | Get T&C at specific time |
| `getTermsHistory(agentId)` | View | Get all T&C versions |

---

### 7.3 ITrustfulValidator

Issues/revokes ERC-8004 validations reactively when conditions change.

**Structs:**
```solidity
struct ValidationConditions {
    bool hasCollateral;
    bool hasActiveTerms;
    bool ownershipValid;
    bool allConditionsMet;
}

enum RevocationReason {
    None,
    CollateralDepleted,
    TermsInvalidated,
    OwnershipChanged,
    ManualRevocation
}
```

**Key Functions:**
| Function | Access | Description |
|----------|--------|-------------|
| `checkAndUpdateValidation(agentId)` | Anyone | Evaluate and update validation |
| `evaluateConditions(agentId)` | View | Check all validation conditions |
| `isValidated(agentId)` | View | Simple validation check |
| `getValidationStatus(agentId)` | View | Detailed status with reason |
| `getTrustInfo(agentId)` | View | Get full trust information |

**Events:**
```solidity
event ValidationIssued(uint256 indexed agentId, bytes32 requestHash);
event ValidationRevoked(uint256 indexed agentId, bytes32 requestHash, RevocationReason reason);
```

---

### 7.4 ICouncilRegistry [v1.2 UPDATED]

Manages councils and members. Governance controls creation/closure.

**Structs:**
```solidity
struct Council {
    bytes32 councilId;
    string name;
    string description;           // [v1.2] Added
    string vertical;
    bool active;
    uint256 createdAt;
    uint256 closedAt;             // [v1.2] Added (0 = not closed)
    address[] members;
    uint256 votingPeriod;
    uint256 evidencePeriod;
    uint256 claimDepositPercentage;  // Basis points (e.g., 500 = 5%)
    uint256 councilFeePercentage;
    address feeRecipient;
}
```

**Key Functions:**
| Function | Access | Description |
|----------|--------|-------------|
| `createCouncil(...)` | Governance | Create new council |
| `closeCouncil(councilId)` | Governance | Close council (pre-checks required) [v1.2] |
| `addMember(councilId, member)` | Governance | Add council member |
| `removeMember(councilId, member)` | Governance | Remove council member |
| `reassignAgentCouncil(agentId, newCouncilId)` | Governance | Override agent's council [v1.2] |
| `getCouncil(councilId)` | View | Get council details |
| `getActiveCouncils()` | View | List active councils |
| `isMember(councilId, member)` | View | Check membership |
| `canCloseCouncil(councilId)` | View | Check if closure is allowed [v1.2] |

**Council Close Pre-Checks [v1.2]:**
```solidity
function closeCouncil(bytes32 councilId) external onlyGovernance {
    require(getAgentCountByCouncil(councilId) == 0, "Agents still assigned");
    require(getPendingClaimsByCouncil(councilId) == 0, "Claims pending");
    // Expel all members
    // Mark council as closed
}
```

---

### 7.5 IClaimsManager [v1.2 UPDATED]

Manages claim lifecycle and voting.

**Structs:**
```solidity
struct Claim {
    bytes32 claimId;
    uint256 agentId;
    address claimant;
    
    // Payment binding
    bytes32 paymentReceiptHash;     // Optional x402 receipt hash
    
    // Evidence
    bytes32 evidenceHash;
    string evidenceUri;
    
    // Amounts
    uint256 claimedAmount;
    uint256 lockedAmount;           // May be less than claimed
    uint256 approvedAmount;         // Set by council (median)
    uint256 claimantDeposit;        // Deposit paid by claimant
    
    // Context snapshot
    bytes32 councilId;
    address providerAtClaimTime;
    bytes32 termsHashAtClaimTime;
    
    // Status
    ClaimStatus status;
    uint256 filedAt;
    uint256 evidenceDeadline;
    uint256 votingDeadline;
    uint256 resolvedAt;
    
    // Voting
    uint256 approvalsCount;
    uint256 rejectionsCount;
}

struct VoteRecord {
    address voter;
    Vote vote;
    uint256 approvedAmount;     // Only relevant if vote = Approve
    uint256 votedAt;
    string reasonUri;
}

enum ClaimStatus {
    Filed,
    EvidenceComplete,
    Voting,
    Approved,
    Rejected,
    Executed,
    Expired,
    Cancelled
}

enum Vote { None, Approve, Reject }
```

**Key Functions:**
| Function | Access | Description |
|----------|--------|-------------|
| `fileClaim(agentId, claimedAmount, evidenceHash, evidenceUri, paymentReceiptHash)` | Anyone | File new claim with deposit |
| `submitAdditionalEvidence(claimId, hash, uri)` | Claimant | Add evidence before voting |
| `submitCounterEvidence(claimId, hash, uri)` | Provider | Submit counter-evidence |
| `startVoting(claimId)` | Anyone | Start voting after evidence period |
| `castVote(claimId, vote, approvedAmount, reasonUri)` | Council Member | Cast vote |
| `changeVote(claimId, vote, approvedAmount, reasonUri)` | Council Member | Change existing vote [v1.2] |
| `finalizeClaim(claimId)` | Anyone | Finalize after voting deadline |
| `cancelClaim(claimId)` | Claimant | Cancel before voting (deposit forfeited) |
| `getClaim(claimId)` | View | Get claim details |
| `getVotes(claimId)` | View | Get all votes |
| `getVotersForClaim(claimId)` | View | Get addresses of voters [v1.2] |
| `getClaimsByAgent(agentId)` | View | Get claims for agent |
| `getClaimsByCouncil(councilId)` | View | Get claims for council |
| `getVotingProgress(claimId)` | View | Get vote counts and deadline |
| `calculateRequiredDeposit(claimedAmount, councilId)` | View | Calculate deposit needed |

---

### 7.6 IRulingExecutor [v1.2 MAJOR UPDATE]

Executes approved rulings and distributes deposits.

**Structs:**
```solidity
struct Execution {
    bytes32 claimId;
    uint256 agentId;
    address claimant;
    
    // Compensation
    uint256 approvedAmount;
    uint256 effectivePayout;        // After caps
    uint256 councilFee;
    uint256 claimantReceives;
    
    // Deposit distribution [v1.2]
    uint256 depositAmount;
    address[] depositRecipients;    // Voting council members
    uint256 depositPerVoter;
    
    uint256 executedAt;
}
```

**Key Functions:**
| Function | Access | Description |
|----------|--------|-------------|
| `executeApprovedClaim(claimId)` | Anyone | Execute compensation + distribute deposit |
| `executeRejectedClaim(claimId)` | Anyone | Distribute deposit to voters |
| `executeExpiredClaim(claimId)` | Anyone | Handle expired claim [v1.2] |
| `calculatePayoutBreakdown(claimId)` | View | Preview payout calculation |

**Deposit Distribution Logic [v1.2]:**
```solidity
function _distributeDepositToVoters(bytes32 claimId) internal {
    Claim memory claim = claimsManager.getClaim(claimId);
    address[] memory voters = claimsManager.getVotersForClaim(claimId);
    
    if (voters.length == 0) {
        // No votes cast - return to claimant
        USDC.transfer(claim.claimant, claim.claimantDeposit);
        emit DepositReturned(claimId, claim.claimant, claim.claimantDeposit);
    } else {
        // Distribute to voters
        uint256 perVoter = claim.claimantDeposit / voters.length;
        uint256 remainder = claim.claimantDeposit % voters.length;
        
        for (uint i = 0; i < voters.length; i++) {
            uint256 amount = perVoter + (i == 0 ? remainder : 0);
            USDC.transfer(voters[i], amount);
        }
        emit DepositDistributed(claimId, voters.length, claim.claimantDeposit);
    }
}
```

---

### 7.7 ITrustfulPausable

Emergency pause mechanism controlled by governance multisig.

**Key Functions:**
| Function | Access | Description |
|----------|--------|-------------|
| `pause(reason)` | Governance | Pause all operations |
| `unpause()` | Governance | Resume operations |
| `isPaused()` | View | Check pause status |

---

## 8. Data Flows

### 8.1 Agent Onboarding

```
1. Provider registers agent in ERC-8004 → agentId
2. Provider calls registerTerms(agentId, hash, uri, councilId)
3. TermsRegistry stores T&C, notifies TrustfulValidator
4. Provider calls deposit(agentId, amount) on CollateralVault
5. CollateralVault accepts deposit, notifies TrustfulValidator
6. TrustfulValidator checks conditions:
   - hasCollateral: ✓
   - hasActiveTerms: ✓
   - ownershipValid: ✓
7. TrustfulValidator issues validation via ERC-8004
8. Agent is now discoverable as Trustful-validated
```

### 8.2 Client Verification

```
1. Client queries ERC-8004: getAgentValidations(agentId)
2. Client checks validator == TRUSTFUL_VALIDATOR
3. Client calls getTrustInfo(agentId) for live data:
   - Collateral amount
   - T&C hash and URI
   - Withdrawal pending status
   - Council assignment
4. Client fetches T&C from IPFS, reviews terms including maxPayoutPerClaim
5. Client decides whether to use agent
```

### 8.3 Claim Resolution [v1.2 UPDATED]

```
1. Claimant prepares evidence package (includes payment proof)
2. Claimant calls fileClaim() with deposit
3. ClaimsManager:
   - Snapshots provider, termsHash at claim time
   - Locks collateral (up to available amount)
   - Transfers deposit from claimant
4. Evidence period: both parties can submit evidence
5. Anyone calls startVoting() after evidence deadline
6. Council members review evidence and T&C (including maxPayoutPerClaim)
7. Council members call castVote(approve/reject, amount)
   - Members can changeVote() during voting period
8. Anyone calls finalizeClaim() after voting deadline
9. ClaimsManager calculates result:
   - If approved: median of approved amounts
   - If rejected: no compensation
   - If expired (no votes): special handling
10. RulingExecutor processes:
    - If approved: transfer compensation, distribute deposit to voters
    - If rejected: unlock collateral, distribute deposit to voters
    - If expired (no votes): unlock collateral, return deposit to claimant
```

### 8.4 Deposit Distribution Matrix [v1.2]

| Outcome | Claimant Deposit | Provider Collateral |
|---------|-----------------|---------------------|
| Approved | → Voting council members | → Claimant (compensation) |
| Rejected | → Voting council members | Unlocked (no transfer) |
| Cancelled | → Voting council members | Unlocked (no transfer) |
| Expired (votes cast) | → Voting council members | Unlocked (no transfer) |
| Expired (no votes) | → Returned to claimant | Unlocked (no transfer) |

---

## 9. Economic Model

### 9.1 Collateral Economics

- **Asset:** USDC (stable, predictable)
- **Minimum:** None enforced (market decides)
- **Locking:** Partial locking if collateral < claimed amount
- **Grace Period:** Configurable (e.g., 7 days for withdrawals)

### 9.2 Claim Deposits [v1.2 UPDATED]

- **Calculation:** `claimDepositPercentage * claimedAmount / 10000`
- **Example:** 5% deposit on 10,000 USDC claim = 500 USDC
- **Distribution:** Always to voting council members (except expired with no votes)

**Incentive Alignment:**

| Actor | Incentive |
|-------|-----------|
| Council members | Vote to receive deposit share; no bias toward approve/reject |
| Claimants | Only file legitimate claims (deposit always lost unless council inactive) |
| Providers | Protected from frivolous claims by deposit requirement |

### 9.3 Council Fees

- **Fee:** Percentage of approved payout (e.g., 5%)
- **Recipient:** Council's feeRecipient address
- **Calculation:** `councilFeePercentage * effectivePayout / 10000`

### 9.4 Payout Caps

Effective payout = min(approvedAmount, lockedAmount, maxPayoutPerClaim)

Where:
- `approvedAmount`: Median of council approval votes
- `lockedAmount`: Amount locked in CollateralVault at claim time
- `maxPayoutPerClaim`: From T&C document (off-chain, verified by council)

---

## 10. Off-Chain Components

### 10.1 T&C Document Schema

```json
{
  "$schema": "https://trustful-agents.org/schemas/terms/v1.2",
  "version": "1.2",
  "agentId": "123",
  "provider": {
    "name": "Acme AI",
    "address": "0x..."
  },
  "terms": {
    "serviceDescription": "...",
    "limitations": ["..."],
    "maxPayoutPerClaim": "5000000000",  // 5000 USDC (6 decimals)
    "coveredDamages": ["..."],
    "excludedDamages": ["..."]
  },
  "legal": {
    "jurisdiction": "...",
    "governingLaw": "..."
  },
  "signature": {
    "hash": "0x...",
    "timestamp": "2025-12-09T00:00:00Z"
  }
}
```

### 10.2 Evidence Package Schema

```json
{
  "$schema": "https://trustful-agents.org/schemas/evidence/v1.2",
  "claimId": "0x...",
  "paymentProof": {
    "type": "x402|crypto|fiat|other",
    "x402Receipt": "...",
    "transactionHash": "0x...",
    "amount": "100.00",
    "timestamp": "2025-12-09T10:00:00Z"
  },
  "termsSnapshot": {
    "hash": "0x...",
    "uri": "ipfs://...",
    "maxPayoutPerClaim": "5000000000"
  },
  "incident": {
    "description": "...",
    "timestamp": "2025-12-09T09:00:00Z",
    "logs": ["..."]
  },
  "damages": {
    "description": "...",
    "amount": "1000000000",
    "evidence": ["ipfs://..."]
  }
}
```

### 10.3 A2A Agent Card Extension

```json
{
  "trustful": {
    "version": "1.2",
    "validatorAddress": "0x...",
    "collateral": {
      "amount": "10000000000",
      "asset": "USDC",
      "withdrawalPending": false
    },
    "terms": {
      "hash": "0x...",
      "uri": "ipfs://...",
      "councilId": "0x..."
    },
    "validation": {
      "status": "valid",
      "issuedAt": "2025-12-01T00:00:00Z"
    },
    "claims": {
      "total": 2,
      "approved": 0,
      "pending": 1
    }
  }
}
```

### 10.4 Subgraph/Indexer

Required indexed data:
- Agent validation status changes
- Collateral deposits/withdrawals
- T&C registrations
- Claim lifecycle events
- Vote records
- Council membership changes

---

## 11. Security Considerations

### 11.1 Access Control

| Function | Access |
|----------|--------|
| Collateral deposit | Anyone |
| Collateral withdraw | Agent owner |
| T&C registration | Agent owner |
| Claim filing | Anyone |
| Voting | Council members |
| Claim execution | Anyone (permissionless) |
| Council management | Governance multisig |
| Pause | Governance multisig |

### 11.2 Attack Vectors & Mitigations

| Attack | Mitigation |
|--------|------------|
| Front-running withdrawal | Grace period |
| Spam claims | Deposit requirement |
| Council collusion | Unbiased deposit distribution |
| Sybil attacks on council | Governance-controlled membership |
| T&C version gaming | Hash binding at claim time |

### 11.3 Validation Conditions

Validation requires ALL conditions:
- `hasCollateral`: Available balance > 0
- `hasActiveTerms`: Non-invalidated T&C exists
- `ownershipValid`: Current owner matches owner at validation time

---

## 12. Open Items & Future Work

### 12.1 Implementation Phase

- [ ] Deploy contracts to Base testnet
- [ ] Implement subgraph for indexing
- [ ] Build provider dashboard
- [ ] Build claimant interface
- [ ] Build council member interface
- [ ] Integrate with ERC-8004 reference implementation

### 12.2 Future Enhancements (Out of Scope for v1.2)

- Multi-chain deployment
- Stake-weighted voting
- Council reputation scores
- Automated evidence validation
- Integration with additional payment protocols
- DAO governance upgrade

---

## Appendix A: Event Reference

### CollateralVault Events
```solidity
event Deposited(uint256 indexed agentId, address indexed depositor, uint256 amount);
event WithdrawalInitiated(uint256 indexed agentId, uint256 amount, uint256 executeAfter);
event WithdrawalCancelled(uint256 indexed agentId);
event WithdrawalExecuted(uint256 indexed agentId, uint256 amount);
event CollateralLocked(uint256 indexed agentId, bytes32 indexed claimId, uint256 amount);
event CollateralUnlocked(uint256 indexed agentId, bytes32 indexed claimId, uint256 amount);
event CompensationPaid(uint256 indexed agentId, bytes32 indexed claimId, address recipient, uint256 amount);
```

### TermsRegistry Events
```solidity
event TermsRegistered(uint256 indexed agentId, uint256 version, bytes32 contentHash, bytes32 councilId);
event TermsUpdated(uint256 indexed agentId, uint256 version, bytes32 contentHash);
event TermsInvalidated(uint256 indexed agentId);
```

### TrustfulValidator Events
```solidity
event ValidationIssued(uint256 indexed agentId, bytes32 requestHash);
event ValidationRevoked(uint256 indexed agentId, bytes32 requestHash, RevocationReason reason);
```

### CouncilRegistry Events
```solidity
event CouncilCreated(bytes32 indexed councilId, string name, string vertical);
event CouncilClosed(bytes32 indexed councilId);
event MemberAdded(bytes32 indexed councilId, address indexed member);
event MemberRemoved(bytes32 indexed councilId, address indexed member);
event AgentCouncilReassigned(uint256 indexed agentId, bytes32 indexed oldCouncilId, bytes32 indexed newCouncilId);
```

### ClaimsManager Events
```solidity
event ClaimFiled(bytes32 indexed claimId, uint256 indexed agentId, address indexed claimant, uint256 claimedAmount, uint256 depositAmount);
event EvidenceSubmitted(bytes32 indexed claimId, address indexed submitter, bytes32 evidenceHash);
event VotingStarted(bytes32 indexed claimId, uint256 votingDeadline);
event VoteCast(bytes32 indexed claimId, address indexed voter, Vote vote, uint256 approvedAmount);
event VoteChanged(bytes32 indexed claimId, address indexed voter, Vote newVote, uint256 newApprovedAmount);
event ClaimApproved(bytes32 indexed claimId, uint256 approvedAmount);
event ClaimRejected(bytes32 indexed claimId);
event ClaimCancelled(bytes32 indexed claimId);
event ClaimExpired(bytes32 indexed claimId, bool hadVotes);
```

### RulingExecutor Events
```solidity
event RulingExecuted(bytes32 indexed claimId, address indexed claimant, uint256 compensation, uint256 councilFee);
event DepositDistributed(bytes32 indexed claimId, uint256 voterCount, uint256 totalAmount);
event DepositReturned(bytes32 indexed claimId, address indexed claimant, uint256 amount);
```

---

## Appendix B: Governance Functions Summary

| Function | Contract | Description |
|----------|----------|-------------|
| `createCouncil(...)` | CouncilRegistry | Create new council |
| `closeCouncil(councilId)` | CouncilRegistry | Close council |
| `addMember(councilId, member)` | CouncilRegistry | Add member |
| `removeMember(councilId, member)` | CouncilRegistry | Remove member |
| `reassignAgentCouncil(agentId, councilId)` | CouncilRegistry | Override council |
| `pause(reason)` | TrustfulPausable | Emergency pause |
| `unpause()` | TrustfulPausable | Resume operations |

All governance functions require multisig confirmation.
