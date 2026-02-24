# Trustful Agents: ERC-8004 Integration & Eth Sepolia Migration

## Context & Goal

Trustful Agents is a decentralized trust layer for AI agents. It currently runs on **Base Sepolia** with a mock ERC-8004 registry. We are migrating to **Ethereum Sepolia** to integrate with the real ERC-8004 registries deployed there.

This document covers **smart contract changes only**. It serves as the implementation guide for Claude Code to modify the existing Foundry-based contract codebase.

### Current State (Base Sepolia)
- Mock ERC-8004 registry at `0x454909C7551158e12a6a5192dEB359dDF067ec80` — a single ERC-721 contract that also handles agent minting (`mint`, `mintAuto`) and has built-in validation functions (`issueValidation`, `revokeValidation`, `isValidated`)
- All 6 core contracts deployed and operational (208+ tests passing)
- TrustfulValidator works in a self-contained pattern: agent owner calls `requestValidation(agentId)` directly on TrustfulValidator, which checks conditions and emits events internally
- No interaction with any external Validation Registry

### Target State (Eth Sepolia)
- Three separate ERC-8004 registries (official deployment, updated Jan 2026):
  - **Identity Registry**: `0x8004A818BFB912233c491871b3d84c89A494BD9e` — ERC-721 for agent identity (replaces our mock)
  - **Reputation Registry**: `0x8004B8FD1A363aa02fDC07635C0c5F94f6Af5B7E` — not used yet
  - **Validation Registry**: `0x8004CB39f29c09145F24Ad9dDe2A108C1A2cdfC5` — where validation requests/responses are recorded
- TrustfulValidator acts as a proper ERC-8004 validator that responds to validation requests via the Validation Registry
- Off-chain keeper/watcher triggers TrustfulValidator when validation requests arrive or when reevaluation is needed

---

## Part 1: TrustfulValidator — Major Rewrite

This is the core change. The contract must shift from a self-contained validation model to the ERC-8004 request/response pattern.

### 1.1 New ERC-8004 Validation Flow

The target flow (see `erc8004-validation-workflow.md` in repo):

```
1. Agent owner calls validationRequest(TrustfulValidator, agentId, requestURI, requestHash) 
   on the ERC-8004 Validation Registry
2. Validation Registry emits ValidationRequest event
3. Off-chain keeper detects event, calls TrustfulValidator.respondToRequest(requestHash)
4. TrustfulValidator:
   a. Reads request details from Validation Registry via getValidationStatus(requestHash) → gets agentId
   b. Verifies validatorAddress == address(this)
   c. Checks trust conditions (collateral, terms, council) — same logic as today
   d. Stores internal mapping: agentId → requestHash
   e. Calls validationRegistry.validationResponse(requestHash, score, responseURI, responseHash, tag) 
      on the Validation Registry
5. Validation Registry stores the response and emits ValidationResponse event
```

**Key ERC-8004 constraint**: The Validation Registry expects the response to come from the validator address specified in the original request. So `validationResponse()` must be called by the TrustfulValidator contract itself, not by an external EOA.

### 1.2 New State Variables

Add to TrustfulValidator:

```solidity
/// @notice The ERC-8004 Validation Registry
IValidationRegistry public validationRegistry;

/// @notice Active request hash per agent (agentId → requestHash)
/// Used for reevaluation: when conditions change, look up the requestHash to submit updated response
mapping(uint256 => bytes32) private _activeRequestHash;
```

Add governance setter:

```solidity
function setValidationRegistry(address registry_) external onlyGovernance {
    if (registry_ == address(0)) revert ZeroAddress();
    validationRegistry = IValidationRegistry(registry_);
}
```

### 1.3 Tag Constants & Mapping

Tags are compact, machine-readable status codes submitted with each `validationResponse`. They follow a namespaced, versioned scheme. Dynamic values (amounts, timestamps, addresses) are never in the tag — those go in the response payload at `responseUri`.

**If the Validation Registry `tag` parameter is `string`**, use the literal strings below. **If it is `bytes32`**, use `keccak256` hashed constants instead (see ABI caveat at end of section).

```solidity
// =========================================================================
// Tag Constants (string variant)
// =========================================================================

string constant TAG_VALID = "trustful.v1.valid";
string constant TAG_REVOKED_COLLATERAL = "trustful.v1.revoked.collateral_below_min";
string constant TAG_REVOKED_TERMS = "trustful.v1.revoked.terms_inactive";
string constant TAG_REVOKED_OWNER = "trustful.v1.revoked.owner_changed";
string constant TAG_REVOKED_COUNCIL = "trustful.v1.revoked.council_inactive";
string constant TAG_REVOKED_MANUAL = "trustful.v1.revoked.manual";

// =========================================================================
// Tag Constants (bytes32 variant — use if registry expects bytes32)
// =========================================================================

// bytes32 constant TAG_VALID = keccak256("trustful.v1.valid");
// bytes32 constant TAG_REVOKED_COLLATERAL = keccak256("trustful.v1.revoked.collateral_below_min");
// ... etc.
```

**Single source of truth**: Map `RevocationReason` → tag in one function. Also used by `reevaluate()` when conditions fail but no explicit revocation reason is set yet.

```solidity
/// @notice Map RevocationReason enum to ERC-8004 tag
function _reasonToTag(RevocationReason reason) internal pure returns (string memory) {
    if (reason == RevocationReason.CollateralBelowMinimum) return TAG_REVOKED_COLLATERAL;
    if (reason == RevocationReason.TermsNotRegistered) return TAG_REVOKED_TERMS;
    if (reason == RevocationReason.TermsInvalidated) return TAG_REVOKED_TERMS;
    if (reason == RevocationReason.OwnershipChanged) return TAG_REVOKED_OWNER;
    if (reason == RevocationReason.ManualRevocation) return TAG_REVOKED_MANUAL;
    if (reason == RevocationReason.EmergencyPause) return TAG_REVOKED_MANUAL;
    return TAG_VALID; // fallback (should not happen for revocations)
}

/// @notice Derive tag from failed conditions (when no explicit RevocationReason exists yet)
/// @dev Checks conditions in priority order — first failing condition determines the tag
function _conditionsToTag(ValidationConditions memory conditions) internal view returns (string memory) {
    if (!conditions.hasMinimumCollateral) return TAG_REVOKED_COLLATERAL;
    if (!conditions.hasActiveTerms) return TAG_REVOKED_TERMS;
    if (!conditions.isOwnerValid) return TAG_REVOKED_OWNER;
    if (enforceCouncilValidation && !conditions.councilIsActive) return TAG_REVOKED_COUNCIL;
    return TAG_VALID;
}
```

**Response URI payload schema**: The `responseUri` should resolve to a JSON document with at least:

```json
{
  "schemaVersion": "trustful-validation-response-v1",
  "agentId": 42,
  "score": 100,
  "tag": "trustful.v1.valid",
  "timestamp": "2026-02-12T12:00:00Z",
  "conditions": {
    "hasMinimumCollateral": true,
    "collateralAmount": "500000000",
    "minimumRequired": "100000000",
    "hasActiveTerms": true,
    "termsHash": "0xabc...",
    "isOwnerValid": true,
    "councilIsActive": true,
    "councilId": "0xdef..."
  },
  "trustfulValidator": "0x...",
  "identityRegistry": "0x8004A818BFB912233c491871b3d84c89A494BD9e"
}
```

This is served by the API at the `responseUri` endpoint. The on-chain `responseHash` should be the `keccak256` of this JSON payload (or a canonical subset). Clients can verify integrity by fetching the URI and comparing hashes.

### 1.4 New Interface: IValidationRegistry

Define a minimal interface for the ERC-8004 Validation Registry. **Important**: verify the exact function signatures against the deployed contract ABI at `0x8004CB39f29c09145F24Ad9dDe2A108C1A2cdfC5` on Eth Sepolia before finalizing. The interface below is based on the ERC-8004 spec:

```solidity
interface IValidationRegistry {
    /// @notice Submit a validation response
    /// @param requestHash The request hash from the original validationRequest
    /// @param response Score 0-100 (we use 100 = pass, 0 = fail)
    /// @param responseURI URI to off-chain evidence/audit
    /// @param responseHash Hash of the response data
    /// @param tag Custom categorization tag
    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseHash,
        string calldata tag
    ) external;

    /// @notice Get validation status for a request
    /// @param requestHash The request hash
    /// @return validatorAddress The validator that should respond
    /// @return agentId The agent being validated
    /// @return response The current response score
    /// @return responseHash The response data hash
    /// @return tag The categorization tag
    /// @return lastUpdate Timestamp of last update
    function getValidationStatus(bytes32 requestHash) external view returns (
        address validatorAddress,
        uint256 agentId,
        uint8 response,
        bytes32 responseHash,
        string memory tag,
        uint256 lastUpdate
    );
}
```

**NOTE**: The `tag` parameter type may be `bytes32` instead of `string` in the actual deployment. The `getValidationStatus` return signature may also differ slightly. Verify by calling the contract or fetching its ABI from Etherscan before implementation. If there are differences, adapt the interface accordingly.

### 1.5 Core Function: `respondToRequest(bytes32 requestHash)`

This is the new primary entry point, called by the keeper when a ValidationRequest event is detected.

```solidity
/// @notice Respond to an ERC-8004 validation request
/// @param requestHash The request hash from the Validation Registry
/// @dev Called by the off-chain keeper when a ValidationRequest event targets this contract
function respondToRequest(bytes32 requestHash) external nonReentrant {
    _requireConfigured();
    
    // 1. Read request details from Validation Registry
    (address validatorAddress, uint256 agentId, , , , ) = 
        validationRegistry.getValidationStatus(requestHash);
    
    // 2. Verify this request is for us
    if (validatorAddress != address(this)) revert NotAuthorized(msg.sender);
    
    // 3. Verify agent exists
    if (!_agentExists(agentId)) revert AgentNotFound(agentId);
    
    // 4. Check trust conditions
    ValidationConditions memory conditions = _checkConditions(agentId);
    bool passed = _allConditionsMet(conditions);
    
    // 5. Store internal mapping for future reevaluation
    _activeRequestHash[agentId] = requestHash;
    
    // 6. Update internal validation record
    ValidationRecord storage record = _validations[agentId];
    record.requestHash = requestHash;
    record.nonce += 1;
    if (passed) {
        record.issuedAt = block.timestamp;
        record.revokedAt = 0;
        record.revocationReason = RevocationReason.None;
    } else {
        record.revokedAt = block.timestamp;
    }
    
    // 7. Submit response to ERC-8004 Validation Registry
    uint8 score = passed ? 100 : 0;
    string memory responseUri = getResponseUri(agentId);
    bytes32 responseHash = keccak256(abi.encode(agentId, score, block.timestamp));
    
    string memory tag = passed ? TAG_VALID : _conditionsToTag(conditions);
    
    validationRegistry.validationResponse(
        requestHash,
        score,
        responseUri,
        responseHash,
        tag
    );
    
    // 8. Emit internal events
    if (passed) {
        emit ValidationIssued(agentId, requestHash, record.nonce, responseUri);
    }
    emit ValidationConditionsChanged(agentId, conditions);
}
```

**Access control note**: This function should be callable by anyone (the keeper is the expected caller, but making it permissionless means anyone can trigger the response if the keeper is down). The Validation Registry itself enforces that only the designated validator contract can submit responses.

### 1.6 Core Function: `reevaluate(uint256 agentId)`

Called when conditions change (collateral deposited/withdrawn, claim filed/rejected, etc.) to update the validation status on the ERC-8004 Validation Registry.

```solidity
/// @notice Re-evaluate validation for an agent and update the Validation Registry
/// @param agentId The ERC-8004 token ID
/// @dev Callable by anyone. The keeper calls this when collateral/claims/terms change.
/// @dev If no active request exists for this agent, this is a no-op.
/// @dev Per ERC-8004, validationResponse() can be called multiple times for the same requestHash.
function reevaluate(uint256 agentId) external nonReentrant {
    bytes32 requestHash = _activeRequestHash[agentId];
    
    // No active validation request for this agent — nothing to update
    if (requestHash == bytes32(0)) return;
    
    // Must have Validation Registry configured
    if (address(validationRegistry) == address(0)) return;
    
    // Check current conditions
    ValidationConditions memory conditions = _checkConditions(agentId);
    bool passed = _allConditionsMet(conditions);
    
    // Update internal record
    ValidationRecord storage record = _validations[agentId];
    bool wasValid = _isCurrentlyValid(record);
    
    if (passed && !wasValid) {
        // Conditions now met — restore validation
        record.issuedAt = block.timestamp;
        record.revokedAt = 0;
        record.revocationReason = RevocationReason.None;
        emit ValidationIssued(agentId, requestHash, record.nonce, getResponseUri(agentId));
    } else if (!passed && wasValid) {
        // Conditions no longer met — revoke
        RevocationReason reason = _determineRevocationReason(conditions);
        _revoke(agentId, record, reason);
    }
    
    // Submit updated response to ERC-8004 Validation Registry
    uint8 score = passed ? 100 : 0;
    string memory responseUri = getResponseUri(agentId);
    bytes32 responseHash = keccak256(abi.encode(agentId, score, block.timestamp));
    string memory tag = passed ? TAG_VALID : _conditionsToTag(conditions);
    
    validationRegistry.validationResponse(
        requestHash,
        score,
        responseUri,
        responseHash,
        tag
    );
    
    emit ValidationConditionsChanged(agentId, conditions);
}
```

Add helper to determine revocation reason from conditions:

```solidity
function _determineRevocationReason(ValidationConditions memory conditions)
    internal
    view
    returns (RevocationReason)
{
    if (!conditions.hasMinimumCollateral) return RevocationReason.CollateralBelowMinimum;
    if (!conditions.hasActiveTerms) return RevocationReason.TermsInvalidated;
    if (!conditions.isOwnerValid) return RevocationReason.OwnershipChanged;
    if (enforceCouncilValidation && !conditions.councilIsActive) return RevocationReason.TermsInvalidated;
    return RevocationReason.None;
}
```

### 1.7 Modify `revokeValidation(uint256 agentId)`

Must now also submit a zero-score response to the Validation Registry:

```solidity
function revokeValidation(uint256 agentId) external nonReentrant {
    address owner = _getAgentOwner(agentId);
    if (msg.sender != owner && msg.sender != governance) {
        revert NotAuthorized(msg.sender);
    }

    ValidationRecord storage record = _validations[agentId];
    if (!_isCurrentlyValid(record)) {
        revert NotValidated(agentId);
    }

    _revoke(agentId, record, RevocationReason.ManualRevocation);
    
    // Submit revocation to Validation Registry
    bytes32 requestHash = _activeRequestHash[agentId];
    if (requestHash != bytes32(0) && address(validationRegistry) != address(0)) {
        string memory responseUri = getResponseUri(agentId);
        bytes32 responseHash = keccak256(abi.encode(agentId, uint8(0), block.timestamp));
        
        validationRegistry.validationResponse(
            requestHash,
            0,  // score = 0 (revoked)
            responseUri,
            responseHash,
            TAG_REVOKED_MANUAL
        );
    }
}
```

### 1.8 Remove or Deprecate

- **Remove `requestValidation(uint256 agentId)`**: The agent owner no longer calls TrustfulValidator directly. They call `validationRequest()` on the ERC-8004 Validation Registry, which triggers the keeper → `respondToRequest` flow. Removing this function avoids confusion about the correct entry point.

- **Remove `computeRequestHash(uint256 agentId, uint256 nonce)`**: In the new model, the requestHash is created externally by the agent owner. TrustfulValidator receives it, doesn't compute it. This function would be misleading.

- **Modify `checkValidation(uint256 agentId)`**: This is now replaced by `reevaluate(uint256 agentId)`, which does the same condition checking but also writes back to the Validation Registry. Remove `checkValidation` to avoid having two overlapping functions.

### 1.9 Keep / Update `_requireConfigured()`

Add Validation Registry to the configuration check:

```solidity
function _requireConfigured() internal view {
    if (address(collateralVault) == address(0) 
        || address(termsRegistry) == address(0)
        || address(validationRegistry) == address(0)) {
        revert InvalidConfiguration();
    }
}
```

### 1.10 New View Function: `getActiveRequestHash(uint256 agentId)`

Expose the internal mapping for transparency:

```solidity
/// @notice Get the active ERC-8004 request hash for an agent
/// @param agentId The agent token ID
/// @return requestHash The active request hash (bytes32(0) if none)
function getActiveRequestHash(uint256 agentId) external view returns (bytes32) {
    return _activeRequestHash[agentId];
}
```

### 1.11 Update ITrustfulValidator Interface

The interface must reflect all the changes above:
- Add `respondToRequest(bytes32 requestHash)`
- Add `reevaluate(uint256 agentId)`
- Add `getActiveRequestHash(uint256 agentId) returns (bytes32)`
- Remove `requestValidation(uint256 agentId)`
- Remove `computeRequestHash(uint256 agentId, uint256 nonce)`
- Remove `checkValidation(uint256 agentId)`
- Keep all view functions: `isValidated`, `getValidationStatus`, `getValidationRecord`, `checkConditions`, `getResponseUri`, `getTrustInfo`
- Keep all admin setters + add `setValidationRegistry(address)`
- Keep all structs, enums, events

### 1.12 Constructor Change

The constructor currently takes `registry_` (the mock ERC-8004). This should now be the **Identity Registry** address (for agent ownership checks). The Validation Registry is set separately via the governance setter.

```solidity
constructor(
    address identityRegistry_,  // renamed for clarity
    address governance_,
    string memory baseUri_
) TrustfulPausable(governance_) {
    if (identityRegistry_ == address(0)) revert ZeroAddress();
    _REGISTRY = IERC8004Registry(identityRegistry_);
    validationBaseUri = baseUri_;
    minimumCollateral = DEFAULT_MIN_COLLATERAL;
}
```

---

## Part 2: IERC8004Registry Interface — No Logic Changes

The `IERC8004Registry` interface used by CollateralVault, TermsRegistry, ClaimsManager, and TrustfulValidator only calls `ownerOf(uint256)`. The real ERC-8004 Identity Registry is an ERC-721 that exposes `ownerOf`, so this interface is already compatible.

**No changes needed** to CollateralVault, TermsRegistry, ClaimsManager, or their local `IERC8004Registry` interface definitions. They just need to be deployed with the Identity Registry address (`0x8004A818BFB912233c491871b3d84c89A494BD9e`) instead of the mock.

**Note**: The mock ERC8004Registry also had `mint()` and `mintAuto()` for creating agents. In the real ERC-8004, agent registration happens via `register()` on the Identity Registry. This change only affects the frontend/provider dashboard, not the smart contracts (see Part 6 for UI impact notes).

---

## Part 3: Reevaluation Trigger Design

### Events That Should Trigger Reevaluation

The keeper/watcher must monitor these events and call `TrustfulValidator.reevaluate(agentId)`:

| Contract | Event | Why |
|---|---|---|
| CollateralVault | `Deposited(agentId, ...)` | Collateral increased — might now meet minimum |
| CollateralVault | `WithdrawalExecuted(agentId, ...)` | Collateral decreased — might drop below minimum |
| CollateralVault | `WithdrawalInitiated(agentId, ...)` | Pending withdrawal — risk signal (optional trigger) |
| CollateralVault | `CollateralLocked(agentId, claimId, ...)` | Available balance decreased due to claim |
| CollateralVault | `CollateralUnlocked(agentId, claimId, ...)` | Available balance restored after claim resolution |
| CollateralVault | `CollateralSlashed(agentId, claimId, ...)` | Collateral reduced by slashing |
| ClaimsManager | `ClaimFiled(claimId, agentId, ...)` | New claim locks collateral |
| ClaimsManager | `ClaimRejected(claimId)` | Claim rejected — collateral released |
| ClaimsManager | `ClaimExpired(claimId, ...)` | Claim expired — collateral released |
| RulingExecutor | `CollateralUnlocked(claimId, agentId, ...)` | Post-execution unlock |
| RulingExecutor | `ClaimExecuted(claimId, agentId, ...)` | Payout executed — collateral reduced |
| TermsRegistry | (any terms invalidation event) | Terms invalidated — validation should be revoked |

### Design Decision: Keeper-Based (No Contract Changes)

We use a **keeper-based approach**: TrustfulValidator.reevaluate(agentId) is a public function callable by anyone. The keeper watches the events above and calls it. No modifications to CollateralVault, ClaimsManager, or RulingExecutor are needed.

Benefits:
- No coupling between existing contracts and TrustfulValidator
- Keeper can batch reevaluations intelligently
- Anyone can call `reevaluate()` as a failsafe if keeper is down
- Avoids extra gas cost on every deposit/withdrawal

Trade-off:
- Slight latency between state change and Validation Registry update (typically one block)
- Keeper availability is important for real-time accuracy

The keeper implementation is out of scope for this smart contract task but is a required follow-up.

---

## Part 4: Network & Deployment Configuration

### 4.1 New Network Config File

Create `config/networks/eth-sepolia.json`:

```json
{
  "network": "eth-sepolia",
  "chainId": 11155111,
  "rpcUrl": "https://sepolia.infura.io/v3/${INFURA_KEY}",
  "blockExplorerUrl": "https://sepolia.etherscan.io",
  "startBlock": 0,

  "contracts": {
    "usdc": "<ETH_SEPOLIA_USDC_ADDRESS>",
    "identityRegistry": "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    "reputationRegistry": "0x8004B8FD1A363aa02fDC07635C0c5F94f6Af5B7E",
    "validationRegistry": "0x8004CB39f29c09145F24Ad9dDe2A108C1A2cdfC5",
    "collateralVault": "<TO_BE_DEPLOYED>",
    "termsRegistry": "<TO_BE_DEPLOYED>",
    "councilRegistry": "<TO_BE_DEPLOYED>",
    "trustfulValidator": "<TO_BE_DEPLOYED>",
    "claimsManager": "<TO_BE_DEPLOYED>",
    "rulingExecutor": "<TO_BE_DEPLOYED>"
  },

  "safe": {
    "address": "<ETH_SEPOLIA_SAFE_ADDRESS>",
    "txServiceUrl": "https://safe-transaction-sepolia.safe.global",
    "appUrl": "https://app.safe.global",
    "networkPrefix": "sep"
  },

  "services": {
    "apiUrl": "https://api.trustful-agents.ai",
    "subgraphUrl": "<ETH_SEPOLIA_SUBGRAPH_URL>",
    "subgraphVersion": "v2.0.0",
    "ipfsGateway": "https://gateway.pinata.cloud/ipfs"
  },

  "database": {
    "name": "trustful_governance_eth_sepolia",
    "port": 5432
  },

  "dashboardUrls": {
    "provider": "https://provider.trustful-agents.ai",
    "claimer": "https://claims.trustful-agents.ai",
    "council": "https://council.trustful-agents.ai",
    "governance": "https://governance.trustful-agents.ai"
  }
}
```

**Key differences from base-sepolia.json:**
- `erc8004Registry` is split into `identityRegistry`, `reputationRegistry`, `validationRegistry`
- `chainId` is `11155111` (Eth Sepolia)
- USDC address will be different (need to find Circle's Eth Sepolia USDC or deploy a mock)
- Safe needs to be deployed on Eth Sepolia
- Subgraph needs to be deployed for Eth Sepolia

**TODO**: Find USDC address on Eth Sepolia. Circle's official USDC on Eth Sepolia may or may not exist. If not, deploy a mock ERC20 for testing.

### 4.2 Update Config Scripts

The scripts in `config/scripts/` need updates to handle the split registry addresses.

**`generate-env.sh`** — Update the variable extraction to handle both old format (single `erc8004Registry`) and new format (split registries). Add:

```bash
# ERC-8004 Registries (new split format for eth-sepolia)
IDENTITY_REGISTRY=$(jq -r '.contracts.identityRegistry // .contracts.erc8004Registry // empty' "$NETWORK_FILE")
REPUTATION_REGISTRY=$(jq -r '.contracts.reputationRegistry // empty' "$NETWORK_FILE")
VALIDATION_REGISTRY=$(jq -r '.contracts.validationRegistry // empty' "$NETWORK_FILE")
```

And in the dashboard env output:
```bash
VITE_IDENTITY_REGISTRY_ADDRESS=$IDENTITY_REGISTRY
VITE_REPUTATION_REGISTRY_ADDRESS=$REPUTATION_REGISTRY
VITE_VALIDATION_REGISTRY_ADDRESS=$VALIDATION_REGISTRY
# Backward compatibility
VITE_ERC8004_REGISTRY_ADDRESS=$IDENTITY_REGISTRY
```

And in the API env output:
```bash
IDENTITY_REGISTRY_ADDRESS=$IDENTITY_REGISTRY
REPUTATION_REGISTRY_ADDRESS=$REPUTATION_REGISTRY
VALIDATION_REGISTRY_ADDRESS=$VALIDATION_REGISTRY
# Backward compatibility
ERC8004_REGISTRY_ADDRESS=$IDENTITY_REGISTRY
```

**`generate-ts.js`** — Update to handle the split registries in the TypeScript exports. The script already iterates over `config.contracts`, so new keys in the JSON will automatically become exports. But add explicit aliases for backward compatibility:

```javascript
// After the CONTRACTS export block, add:
ts += `
// ERC-8004 Registry Aliases
export const IDENTITY_REGISTRY_ADDRESS = CONTRACTS.identityRegistry ?? CONTRACTS.erc8004Registry;
export const VALIDATION_REGISTRY_ADDRESS = CONTRACTS.validationRegistry ?? '';
export const REPUTATION_REGISTRY_ADDRESS = CONTRACTS.reputationRegistry ?? '';
// Backward compatibility
export const ERC8004_REGISTRY_ADDRESS = IDENTITY_REGISTRY_ADDRESS;
`;
```

**`extract-abis.sh`** — Update the CONTRACTS map. The mock ERC8004Registry ABI entry should be replaced or supplemented:

```bash
# For eth-sepolia, we need the real Identity Registry ABI and Validation Registry ABI
# These should be fetched from Etherscan or the erc-8004-contracts repo
["IdentityRegistry"]="<path_to_identity_registry_abi>"
["ValidationRegistry"]="<path_to_validation_registry_abi>"
# Keep ERC8004Registry for backward compat with base-sepolia
["ERC8004Registry"]="ERC8004RegistryMock.sol/ERC8004RegistryMock.json"
```

Since the Identity Registry and Validation Registry are external contracts (not built by us), their ABIs should be fetched from Etherscan and placed in `config/abis/` manually or via a script.

**`generate-subgraph.sh`** — The subgraph template will need a new data source for the Validation Registry if we want to index ValidationRequest/ValidationResponse events. Add template variable:

```bash
VALIDATION_REGISTRY=$(read_json "data['contracts']['validationRegistry']")
```

And add the substitution:
```bash
-e "s/{{VALIDATION_REGISTRY}}/$VALIDATION_REGISTRY/g" \
```

### 4.3 Update `foundry.toml`

Add Eth Sepolia RPC and Etherscan config:

```toml
[rpc_endpoints]
localhost = "http://127.0.0.1:8545"
base_sepolia = "${RPC_URL_BASE_SEPOLIA}"
base_mainnet = "${RPC_URL_BASE_MAINNET}"
eth_sepolia = "${RPC_URL_ETH_SEPOLIA}"
eth_mainnet = "${RPC_URL_ETH_MAINNET}"

[etherscan]
base_sepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
base_mainnet = { key = "${BASESCAN_API_KEY}", url = "https://api.basescan.org/api" }
eth_sepolia = { key = "${ETHERSCAN_API_KEY}", url = "https://api-sepolia.etherscan.io/api" }
eth_mainnet = { key = "${ETHERSCAN_API_KEY}", url = "https://api.etherscan.io/api" }
```

### 4.4 Deployment Procedure (Lessons Learned from Base Sepolia)

> **⚠️ Critical: Use `forge create`, NOT `forge script`**
>
> A previous redeployment on Base Sepolia cost significant debugging time because `forge script` (e.g., `DeployPhase1.s.sol`) defaults `governance = deployer`, meaning the Safe multisig never gets governance control. Various workarounds (transfer functions, wrapper contracts, two-step patterns) were attempted and all rejected as unnecessary.
>
> The correct approach: **use `forge create` with `--constructor-args` to pass the Safe address directly at deploy time**. The deployer wallet pays the gas, but Safe becomes governance immediately — no transfer step needed.

#### Key Addresses for Eth Sepolia

| Resource | Address |
|----------|---------|
| Identity Registry (ERC-8004) | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Validation Registry (ERC-8004) | `0x8004CB39f29c09145F24Ad9dDe2A108C1A2cdfC5` |
| Reputation Registry (ERC-8004) | `0x8004B8FD1A363aa02fDC07635C0c5F94f6Af5B7E` |
| Safe Multisig (Governance) | `<ETH_SEPOLIA_SAFE_ADDRESS>` — must deploy first |
| USDC | `<ETH_SEPOLIA_USDC_ADDRESS>` — find Circle's or deploy mock |

#### Step 1: Prerequisites

1. Deploy a Safe multisig on Eth Sepolia (via safe.global UI)
2. Find or deploy USDC on Eth Sepolia
3. Set environment variables:

```bash
export RPC_URL_ETH_SEPOLIA="https://sepolia.infura.io/v3/<KEY>"
export DEPLOYER_PRIVATE_KEY="<KEY>"
export ETHERSCAN_API_KEY="<KEY>"
export SAFE_ADDRESS="<ETH_SEPOLIA_SAFE_ADDRESS>"
export USDC_ADDRESS="<ETH_SEPOLIA_USDC_ADDRESS>"
export IDENTITY_REGISTRY="0x8004A818BFB912233c491871b3d84c89A494BD9e"
export VALIDATION_REGISTRY="0x8004CB39f29c09145F24Ad9dDe2A108C1A2cdfC5"
```

#### Step 2: Deploy all 6 contracts

**Must run from the `contracts/` directory** — `forge create` resolves paths relative to project root.

Verify constructor signatures in the source code before deploying. The table below shows the **current** Base Sepolia signatures — the Eth Sepolia versions may differ after the TrustfulValidator rewrite:

| Contract | Constructor Args (in order) | Notes |
|----------|---------------------------|-------|
| `CollateralVault` | `governance_`, `usdc_`, `gracePeriod_`, `minCollateral_` | Verify exact order in source |
| `TermsRegistry` | `registry_`, `governance_` | `registry_` = Identity Registry |
| `CouncilRegistry` | `governance_` | |
| `TrustfulValidator` | `identityRegistry_`, `governance_`, `baseUri_` | Changed: renamed from `registry_` |
| `ClaimsManager` | `registry_`, `usdc_`, `governance_` | `registry_` = Identity Registry |
| `RulingExecutor` | `governance_` | |

**Deploy each contract individually:**

```bash
cd contracts/

# 1. CollateralVault
forge create src/core/CollateralVault.sol:CollateralVault \
  --rpc-url $RPC_URL_ETH_SEPOLIA \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --constructor-args \
    "$SAFE_ADDRESS" \
    "$USDC_ADDRESS" \
    "604800" \
    "100000000" \
  --verify --etherscan-api-key $ETHERSCAN_API_KEY \
  --broadcast
# Record: COLLATERAL_VAULT=0x...

# 2. TermsRegistry
forge create src/core/TermsRegistry.sol:TermsRegistry \
  --rpc-url $RPC_URL_ETH_SEPOLIA \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --constructor-args "$IDENTITY_REGISTRY" "$SAFE_ADDRESS" \
  --verify --etherscan-api-key $ETHERSCAN_API_KEY \
  --broadcast
# Record: TERMS_REGISTRY=0x...

# 3. CouncilRegistry
forge create src/core/CouncilRegistry.sol:CouncilRegistry \
  --rpc-url $RPC_URL_ETH_SEPOLIA \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --constructor-args "$SAFE_ADDRESS" \
  --verify --etherscan-api-key $ETHERSCAN_API_KEY \
  --broadcast
# Record: COUNCIL_REGISTRY=0x...

# 4. TrustfulValidator
forge create src/core/TrustfulValidator.sol:TrustfulValidator \
  --rpc-url $RPC_URL_ETH_SEPOLIA \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --constructor-args \
    "$IDENTITY_REGISTRY" \
    "$SAFE_ADDRESS" \
    "https://api.trustful-agents.ai/validation/" \
  --verify --etherscan-api-key $ETHERSCAN_API_KEY \
  --broadcast
# Record: TRUSTFUL_VALIDATOR=0x...

# 5. ClaimsManager
forge create src/core/ClaimsManager.sol:ClaimsManager \
  --rpc-url $RPC_URL_ETH_SEPOLIA \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --constructor-args "$IDENTITY_REGISTRY" "$USDC_ADDRESS" "$SAFE_ADDRESS" \
  --verify --etherscan-api-key $ETHERSCAN_API_KEY \
  --broadcast
# Record: CLAIMS_MANAGER=0x...

# 6. RulingExecutor
forge create src/core/RulingExecutor.sol:RulingExecutor \
  --rpc-url $RPC_URL_ETH_SEPOLIA \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --constructor-args "$SAFE_ADDRESS" \
  --verify --etherscan-api-key $ETHERSCAN_API_KEY \
  --broadcast
# Record: RULING_EXECUTOR=0x...
```

**⚠️ `forge create` does NOT auto-update any deployment JSON file.** Record each address manually as you go.

#### Step 3: Create deployment record

Create `deployments/11155111.json` (Eth Sepolia chain ID) with all deployed addresses:

```json
{
  "chainId": 11155111,
  "network": "Eth Sepolia",
  "deployedAt": "<ISO_TIMESTAMP>",
  "deployer": "<DEPLOYER_ADDRESS>",
  "safe": "<SAFE_ADDRESS>",
  "external": {
    "usdc": "<USDC_ADDRESS>",
    "identityRegistry": "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    "validationRegistry": "0x8004CB39f29c09145F24Ad9dDe2A108C1A2cdfC5",
    "reputationRegistry": "0x8004B8FD1A363aa02fDC07635C0c5F94f6Af5B7E"
  },
  "contracts": {
    "collateralVault": "0x...",
    "termsRegistry": "0x...",
    "councilRegistry": "0x...",
    "trustfulValidator": "0x...",
    "claimsManager": "0x...",
    "rulingExecutor": "0x..."
  }
}
```

#### Step 4: Wire contracts via Safe multisig

**Since Safe is governance from deployment, ALL wiring calls must go through the Safe UI** (propose tx → collect required sigs → execute). These cannot be done from the deployer EOA.

```
CollateralVault.setClaimsManager(CLAIMS_MANAGER)
CollateralVault.setTermsRegistry(TERMS_REGISTRY)

ClaimsManager.setCollateralVault(COLLATERAL_VAULT)
ClaimsManager.setTermsRegistry(TERMS_REGISTRY)
ClaimsManager.setCouncilRegistry(COUNCIL_REGISTRY)
ClaimsManager.setRulingExecutor(RULING_EXECUTOR)

RulingExecutor.setClaimsManager(CLAIMS_MANAGER)
RulingExecutor.setCollateralVault(COLLATERAL_VAULT)
RulingExecutor.setCouncilRegistry(COUNCIL_REGISTRY)

TrustfulValidator.setCollateralVault(COLLATERAL_VAULT)
TrustfulValidator.setTermsRegistry(TERMS_REGISTRY)
TrustfulValidator.setCouncilRegistry(COUNCIL_REGISTRY)
TrustfulValidator.setValidationRegistry(VALIDATION_REGISTRY)  ← NEW for Eth Sepolia
```

**Tip**: Batch these as a single Safe transaction batch if the Safe UI supports it, to save time on signature collection.

#### Step 5: Update downstream configuration

After deployment, update addresses in:
1. `config/networks/eth-sepolia.json` — fill in all `<TO_BE_DEPLOYED>` placeholders
2. Run `./config/scripts/generate.sh eth-sepolia` to regenerate all derived config
3. Update `contracts/deployments/11155111.json`

#### Common Pitfalls (from Base Sepolia experience)

1. **Must run from `contracts/` directory** — `forge create` resolves paths relative to project root
2. **Never use `forge script` for production deploys** — it defaults governance to deployer
3. **No auto-JSON update** — manually update deployment records after each `forge create`
4. **Wiring requires Safe** — all `onlyGovernance` calls must go through Safe UI with multisig signatures
5. **Verify constructor arg order** — check each contract's actual constructor signature in the source; governance position varies by contract
6. **Verify before wiring** — confirm each contract is verified on Etherscan before attempting Safe wiring, so the Safe UI can show decoded function calls

### 4.5 Update `.env.example`

Add Eth Sepolia environment variables:

```bash
# Eth Sepolia
RPC_URL_ETH_SEPOLIA=https://sepolia.infura.io/v3/<KEY>
ETHERSCAN_API_KEY=<KEY>
```

---

## Part 5: Test Updates

### 5.1 Mock Validation Registry for Tests

Create a `MockValidationRegistry` contract for testing that implements `IValidationRegistry`:

```solidity
// test/mocks/MockValidationRegistry.sol
contract MockValidationRegistry {
    struct Request {
        address validatorAddress;
        uint256 agentId;
        uint8 response;
        bytes32 responseHash;
        string tag;
        uint256 lastUpdate;
    }
    
    mapping(bytes32 => Request) public requests;
    
    // Simulate a validationRequest being filed
    function simulateRequest(
        bytes32 requestHash,
        address validatorAddress,
        uint256 agentId
    ) external {
        requests[requestHash] = Request({
            validatorAddress: validatorAddress,
            agentId: agentId,
            response: 0,
            responseHash: bytes32(0),
            tag: "",
            lastUpdate: block.timestamp
        });
    }
    
    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseHash,
        string calldata tag
    ) external {
        Request storage req = requests[requestHash];
        req.response = response;
        req.responseHash = responseHash;
        req.tag = tag;
        req.lastUpdate = block.timestamp;
    }
    
    function getValidationStatus(bytes32 requestHash) external view returns (
        address validatorAddress,
        uint256 agentId,
        uint8 response,
        bytes32 responseHash,
        string memory tag,
        uint256 lastUpdate
    ) {
        Request storage req = requests[requestHash];
        return (req.validatorAddress, req.agentId, req.response, req.responseHash, req.tag, req.lastUpdate);
    }
}
```

### 5.2 Update Existing Tests

All existing TrustfulValidator tests need updates:
- Replace calls to `requestValidation(agentId)` with the new flow: first `mockValidationRegistry.simulateRequest(hash, validatorAddr, agentId)`, then `validator.respondToRequest(hash)`
- Remove tests for `computeRequestHash` and `checkValidation`
- Add tests for `respondToRequest`, `reevaluate`, `revokeValidation` (with registry write)
- Test that `reevaluate` is a no-op when no active request exists
- Test that `reevaluate` correctly updates score when conditions change
- Test that revocation submits score=0 to the registry

### 5.3 New Test Cases

- `test_respondToRequest_success` — happy path
- `test_respondToRequest_wrongValidator` — request addressed to different validator
- `test_respondToRequest_conditionsNotMet` — responds with score=0
- `test_respondToRequest_storesActiveRequestHash` — mapping updated
- `test_reevaluate_noActiveRequest` — no-op
- `test_reevaluate_collateralDropped` — score changes from 100 to 0
- `test_reevaluate_collateralRestored` — score changes from 0 to 100
- `test_reevaluate_termsInvalidated` — revokes
- `test_revokeValidation_updatesRegistry` — score=0 submitted
- `test_respondToRequest_permissionless` — anyone can call it

---

## Part 6: Downstream Impact Notes (Not In Scope for Contract Work)

These are **not** part of the smart contract changes but must be addressed in subsequent work phases. Documenting here for awareness.

### 6.1 Provider Dashboard UI Changes

- **Agent Registration**: Currently calls `mockERC8004Registry.mintAuto()`. Must change to call `identityRegistry.register()` on the real ERC-8004 Identity Registry. The registration flow requires setting an `agentURI` (pointing to a registration JSON file) — this is new and requires IPFS upload of agent metadata.
- **Validation Request**: Currently calls `TrustfulValidator.requestValidation(agentId)`. Must change to call `validationRegistry.validationRequest(trustfulValidatorAddress, agentId, requestURI, requestHash)` on the ERC-8004 Validation Registry. The provider dashboard needs to construct the `requestURI` and `requestHash`.
- **Validation Status**: Can still read from TrustfulValidator's view functions, but should also show status from the Validation Registry for completeness.

### 6.2 Subgraph Changes

- New data source: ERC-8004 Validation Registry on Eth Sepolia
- Index `ValidationRequest` and `ValidationResponse` events
- Link validation status to existing agent entities

### 6.3 Governance API Changes

- Network configuration update
- New Safe multisig on Eth Sepolia
- Database potentially separate for Eth Sepolia

### 6.4 Config Package

- New `eth-sepolia.json` network file (see Part 4.1)
- Update all scripts for split registry support (see Part 4.2)
- New ABIs for Identity Registry and Validation Registry

---

## Summary of Contract File Changes

| File | Change Type | Description |
|---|---|---|
| `src/core/TrustfulValidator.sol` | **Major rewrite** | New `respondToRequest`, `reevaluate`, updated `revokeValidation`, removed `requestValidation`, `checkValidation`, `computeRequestHash`. New state: `validationRegistry`, `_activeRequestHash`. New interface `IValidationRegistry`. |
| `src/interfaces/ITrustfulValidator.sol` | **Major update** | New function signatures, removed old ones, new events if needed |
| `src/core/CollateralVault.sol` | **No changes** | Deploy with Identity Registry address |
| `src/core/TermsRegistry.sol` | **No changes** | Deploy with Identity Registry address |
| `src/core/CouncilRegistry.sol` | **No changes** | — |
| `src/core/ClaimsManager.sol` | **No changes** | Deploy with Identity Registry address |
| `src/core/RulingExecutor.sol` | **No changes** | — |
| `src/base/TrustfulPausable.sol` | **No changes** | — |
| `src/GovernanceMultisig.sol` | **No changes** | — |
| `test/TrustfulValidator.t.sol` | **Major update** | New mock, new test flows |
| `test/mocks/MockValidationRegistry.sol` | **New file** | Test mock for Validation Registry |
| `foundry.toml` | **Minor update** | Add eth_sepolia RPC and etherscan config |
| `deployments/11155111.json` | **New file** | Deployment record for Eth Sepolia (created manually after `forge create`) |

### Config file changes (separate repo / directory):

| File | Change Type | Description |
|---|---|---|
| `config/networks/eth-sepolia.json` | **New file** | Network configuration for Eth Sepolia |
| `config/scripts/generate-env.sh` | **Update** | Handle split registries, backward compat |
| `config/scripts/generate-ts.js` | **Update** | Handle split registries, new aliases |
| `config/scripts/extract-abis.sh` | **Update** | Add Identity/Validation Registry ABI entries |
| `config/scripts/generate-subgraph.sh` | **Update** | Add Validation Registry template variable |
| `config/abis/IdentityRegistry.json` | **New file** | ABI fetched from Etherscan |
| `config/abis/ValidationRegistry.json` | **New file** | ABI fetched from Etherscan |

---

## Implementation Order

1. **Verify Validation Registry interface** — Fetch ABI from `0x8004CB39f29c09145F24Ad9dDe2A108C1A2cdfC5` on Eth Sepolia via Etherscan. Confirm exact function signatures for `validationResponse()` and `getValidationStatus()`. Especially check whether `tag` is `string` or `bytes32`. Adapt `IValidationRegistry` interface and tag constants accordingly.
2. **Update ITrustfulValidator interface** — Add new functions, remove deprecated ones.
3. **Rewrite TrustfulValidator.sol** — Implement all changes from Part 1 (respondToRequest, reevaluate, tags, etc.).
4. **Create MockValidationRegistry** — For testing.
5. **Update/rewrite TrustfulValidator tests** — Ensure all new flows are tested.
6. **Run full test suite** — Ensure no regressions in other contracts.
7. **Update foundry.toml** — Add Eth Sepolia RPC and Etherscan config.
8. **Create eth-sepolia.json** — Network config (Part 4.1).
9. **Update config scripts** — Handle split registries (Part 4.2).
10. **Deploy Safe multisig** on Eth Sepolia via safe.global UI.
11. **Find/deploy USDC** on Eth Sepolia.
12. **Deploy contracts via `forge create`** — Follow Part 4.4 step-by-step. Use Safe as governance in constructor args. Record all addresses.
13. **Create deployment record** — `deployments/11155111.json`.
14. **Wire contracts via Safe** — All `onlyGovernance` setter calls through Safe UI.
15. **Run `generate.sh eth-sepolia`** — Regenerate all derived config.
16. **Verify contracts on Etherscan** — Should already be done via `--verify` flag during deploy, but confirm.

---

## Deployment Reminders (Eth Sepolia)

### USDC is real Circle USDC — no more minting

On Base Sepolia we used a mock ERC20 with a public `mint()` function. The provider dashboard has "Mint 100 USDC" buttons that call this. On Eth Sepolia, USDC is Circle's official `FiatTokenProxy` at `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` — **there is no public mint function**.

**Action items:**
- Dashboard "Mint USDC" buttons must be **removed or replaced** with a link to the [Circle Faucet](https://faucet.circle.com/) for Eth Sepolia.
- The Circle Faucet dispenses **20 USDC per request**. Users will need to visit the faucet manually.
- Any test scripts that call `usdc.mint()` will fail on Eth Sepolia. Update them to either skip minting or use a pre-funded wallet.

### Minimum collateral must be reduced for testing

The current `DEFAULT_MIN_COLLATERAL` is **100 USDC** (`100e6`). Since the Circle Faucet only gives 20 USDC per request, this makes testing impractical — a user would need 5 faucet requests just to meet the minimum.

**Action item:** When deploying to Eth Sepolia, set minimum collateral to **10 USDC** (`10e6`) via:
```
TrustfulValidator.setMinimumCollateral(10000000)  // 10 USDC — call via Safe
```
This must be done as a Safe multisig transaction during the wiring step (Step 14), since `setMinimumCollateral` is `onlyGovernance`.

Alternatively, pass a lower default in the constructor or change `DEFAULT_MIN_COLLATERAL` before deploying. But using the governance setter keeps the code unchanged and makes the decision explicit.
