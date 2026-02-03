#!/bin/bash
# =============================================================================
# Deploy Trustful Agents - Correct Governance Setup
# =============================================================================
#
# Only CouncilRegistry needs Safe as governance (for createCouncil, addMember, etc.)
# All other contracts use deployer as governance (just for one-time wiring).
#
# =============================================================================

# Don't exit on error - we want to see what fails
# set -e

# =============================================================================
# Configuration
# =============================================================================

RPC_URL="${RPC_URL_BASE_SEPOLIA:?Set RPC_URL_BASE_SEPOLIA}"
PRIVATE_KEY="${DEPLOYER_PRIVATE_KEY:?Set DEPLOYER_PRIVATE_KEY}"
ETHERSCAN_API_KEY="${BASESCAN_API_KEY:?Set BASESCAN_API_KEY}"

# Safe Multisig - Only for CouncilRegistry
SAFE_ADDRESS="0x568A391C188e2aF11FA7550ACca170e085B00e7F"

# Get deployer address
DEPLOYER=$(cast wallet address --private-key "$PRIVATE_KEY")

# External dependencies
USDC_ADDRESS="${USDC_ADDRESS:-}"
ERC8004_REGISTRY="${ERC8004_REGISTRY_ADDRESS:-}"

# Config
WITHDRAWAL_GRACE_PERIOD="${WITHDRAWAL_GRACE_PERIOD:-604800}"
MIN_COLLATERAL="${MIN_COLLATERAL_AMOUNT:-100000000}"
VALIDATION_BASE_URI="${VALIDATION_BASE_URI:-https://trustful.ai/v/}"

echo "==========================================="
echo "  Trustful Agents Deployment"
echo "==========================================="
echo ""
echo "Deployer: $DEPLOYER"
echo "Safe (for CouncilRegistry): $SAFE_ADDRESS"
echo ""

# =============================================================================
# Deploy Mocks if needed
# =============================================================================

if [ -z "$USDC_ADDRESS" ]; then
    echo "Deploying Mock USDC..."
    USDC_OUTPUT=$(forge create test/mocks/ERC20Mock.sol:ERC20Mock \
        --broadcast \
        --rpc-url "$RPC_URL" \
        --private-key "$PRIVATE_KEY" \
        --constructor-args "USD Coin (Mock)" "USDC" 6 \
        2>&1)
    echo "$USDC_OUTPUT"
    USDC_ADDRESS=$(echo "$USDC_OUTPUT" | grep -i "deployed to" | awk '{print $NF}')
    echo "  Mock USDC: $USDC_ADDRESS"
else
    echo "Using existing USDC: $USDC_ADDRESS"
fi

if [ -z "$ERC8004_REGISTRY" ]; then
    echo "Deploying Mock ERC-8004 Registry..."
    REGISTRY_OUTPUT=$(forge create test/mocks/ERC8004RegistryMock.sol:ERC8004RegistryMock \
        --broadcast \
        --rpc-url "$RPC_URL" \
        --private-key "$PRIVATE_KEY" \
        2>&1)
    echo "$REGISTRY_OUTPUT"
    ERC8004_REGISTRY=$(echo "$REGISTRY_OUTPUT" | grep -i "deployed to" | awk '{print $NF}')
    echo "  Mock ERC-8004 Registry: $ERC8004_REGISTRY"
else
    echo "Using existing ERC-8004 Registry: $ERC8004_REGISTRY"
fi

echo ""

# =============================================================================
# Deploy Core Contracts
# =============================================================================

echo "Deploying contracts..."
echo ""

# 1. CollateralVault (deployer governance)
echo "1/6 CollateralVault (governance: deployer)..."
VAULT_OUTPUT=$(forge create src/core/CollateralVault.sol:CollateralVault \
    --broadcast \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --constructor-args "$USDC_ADDRESS" "$ERC8004_REGISTRY" "$DEPLOYER" "$WITHDRAWAL_GRACE_PERIOD" \
    --verify --etherscan-api-key "$ETHERSCAN_API_KEY" \
    2>&1)
echo "$VAULT_OUTPUT"
COLLATERAL_VAULT=$(echo "$VAULT_OUTPUT" | grep -i "deployed to" | awk '{print $NF}')
echo "    $COLLATERAL_VAULT"
sleep 5

# 2. TermsRegistry (deployer governance)
echo "2/6 TermsRegistry (governance: deployer)..."
TERMS_OUTPUT=$(forge create src/core/TermsRegistry.sol:TermsRegistry \
    --broadcast \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --constructor-args "$ERC8004_REGISTRY" "$DEPLOYER" \
    --verify --etherscan-api-key "$ETHERSCAN_API_KEY" \
    2>&1)
echo "$TERMS_OUTPUT"
TERMS_REGISTRY=$(echo "$TERMS_OUTPUT" | grep -i "deployed to" | awk '{print $NF}')
echo "    $TERMS_REGISTRY"
sleep 5

# 3. TrustfulValidator (deployer governance)
echo "3/6 TrustfulValidator (governance: deployer)..."
VALIDATOR_OUTPUT=$(forge create src/core/TrustfulValidator.sol:TrustfulValidator \
    --broadcast \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --constructor-args "$ERC8004_REGISTRY" "$DEPLOYER" "$VALIDATION_BASE_URI" \
    --verify --etherscan-api-key "$ETHERSCAN_API_KEY" \
    2>&1)
echo "$VALIDATOR_OUTPUT"
TRUSTFUL_VALIDATOR=$(echo "$VALIDATOR_OUTPUT" | grep -i "deployed to" | awk '{print $NF}')
echo "    $TRUSTFUL_VALIDATOR"
sleep 5

# 4. CouncilRegistry (SAFE governance - for ongoing operations!)
echo "4/6 CouncilRegistry (governance: SAFE)..."
COUNCIL_OUTPUT=$(forge create src/core/CouncilRegistry.sol:CouncilRegistry \
    --broadcast \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --constructor-args "$SAFE_ADDRESS" \
    --verify --etherscan-api-key "$ETHERSCAN_API_KEY" \
    2>&1)
echo "$COUNCIL_OUTPUT"
COUNCIL_REGISTRY=$(echo "$COUNCIL_OUTPUT" | grep -i "deployed to" | awk '{print $NF}')
echo "    $COUNCIL_REGISTRY"
sleep 5

# 5. ClaimsManager (deployer governance)
echo "5/6 ClaimsManager (governance: deployer)..."
CLAIMS_OUTPUT=$(forge create src/core/ClaimsManager.sol:ClaimsManager \
    --broadcast \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --constructor-args "$USDC_ADDRESS" "$ERC8004_REGISTRY" "$DEPLOYER" \
    --verify --etherscan-api-key "$ETHERSCAN_API_KEY" \
    2>&1)
echo "$CLAIMS_OUTPUT"
CLAIMS_MANAGER=$(echo "$CLAIMS_OUTPUT" | grep -i "deployed to" | awk '{print $NF}')
echo "    $CLAIMS_MANAGER"
sleep 5

# 6. RulingExecutor (deployer governance)
echo "6/6 RulingExecutor (governance: deployer)..."
EXECUTOR_OUTPUT=$(forge create src/core/RulingExecutor.sol:RulingExecutor \
    --broadcast \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --constructor-args "$USDC_ADDRESS" "$DEPLOYER" \
    --verify --etherscan-api-key "$ETHERSCAN_API_KEY" \
    2>&1)
echo "$EXECUTOR_OUTPUT"
RULING_EXECUTOR=$(echo "$EXECUTOR_OUTPUT" | grep -i "deployed to" | awk '{print $NF}')
echo "    $RULING_EXECUTOR"
sleep 5

echo ""

# =============================================================================
# Wire Contracts (deployer can wire all except CouncilRegistry)
# =============================================================================

echo "Wiring contracts..."
echo ""

# Check all addresses are set
if [ -z "$COLLATERAL_VAULT" ] || [ -z "$TERMS_REGISTRY" ] || [ -z "$TRUSTFUL_VALIDATOR" ] || \
   [ -z "$COUNCIL_REGISTRY" ] || [ -z "$CLAIMS_MANAGER" ] || [ -z "$RULING_EXECUTOR" ]; then
    echo "ERROR: Some contracts failed to deploy. Cannot wire."
    echo "  CollateralVault:   ${COLLATERAL_VAULT:-MISSING}"
    echo "  TermsRegistry:     ${TERMS_REGISTRY:-MISSING}"
    echo "  TrustfulValidator: ${TRUSTFUL_VALIDATOR:-MISSING}"
    echo "  CouncilRegistry:   ${COUNCIL_REGISTRY:-MISSING}"
    echo "  ClaimsManager:     ${CLAIMS_MANAGER:-MISSING}"
    echo "  RulingExecutor:    ${RULING_EXECUTOR:-MISSING}"
    echo ""
    echo "Please redeploy the missing contracts manually."
    exit 1
fi

# TrustfulValidator
echo "Wiring TrustfulValidator..."
cast send "$TRUSTFUL_VALIDATOR" "setCollateralVault(address)" "$COLLATERAL_VAULT" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
sleep 3
cast send "$TRUSTFUL_VALIDATOR" "setTermsRegistry(address)" "$TERMS_REGISTRY" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
sleep 3
cast send "$TRUSTFUL_VALIDATOR" "setMinimumCollateral(uint256)" "$MIN_COLLATERAL" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
sleep 3
echo "  Done"

# TermsRegistry
echo "Wiring TermsRegistry..."
cast send "$TERMS_REGISTRY" "setTrustfulValidator(address)" "$TRUSTFUL_VALIDATOR" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
sleep 3
cast send "$TERMS_REGISTRY" "setCouncilRegistry(address)" "$COUNCIL_REGISTRY" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
sleep 3
echo "  Done"

# CollateralVault
echo "Wiring CollateralVault..."
cast send "$COLLATERAL_VAULT" "setClaimsManager(address)" "$CLAIMS_MANAGER" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
sleep 3
cast send "$COLLATERAL_VAULT" "setRulingExecutor(address)" "$RULING_EXECUTOR" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
sleep 3
echo "  Done"

# ClaimsManager
echo "Wiring ClaimsManager..."
cast send "$CLAIMS_MANAGER" "setCollateralVault(address)" "$COLLATERAL_VAULT" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
sleep 3
cast send "$CLAIMS_MANAGER" "setTermsRegistry(address)" "$TERMS_REGISTRY" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
sleep 3
cast send "$CLAIMS_MANAGER" "setCouncilRegistry(address)" "$COUNCIL_REGISTRY" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
sleep 3
cast send "$CLAIMS_MANAGER" "setRulingExecutor(address)" "$RULING_EXECUTOR" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
sleep 3
echo "  Done"

# RulingExecutor
echo "Wiring RulingExecutor..."
cast send "$RULING_EXECUTOR" "setClaimsManager(address)" "$CLAIMS_MANAGER" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
sleep 3
cast send "$RULING_EXECUTOR" "setCollateralVault(address)" "$COLLATERAL_VAULT" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
sleep 3
cast send "$RULING_EXECUTOR" "setCouncilRegistry(address)" "$COUNCIL_REGISTRY" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
sleep 3
echo "  Done"

echo ""

# =============================================================================
# CouncilRegistry wiring (must go through Safe!)
# =============================================================================

echo "==========================================="
echo "  CouncilRegistry Wiring - Via Safe"
echo "==========================================="
echo ""
echo "CouncilRegistry has Safe as governance."
echo "Submit these 2 transactions through Safe:"
echo ""
echo "1. setTermsRegistry($TERMS_REGISTRY)"
echo "   To: $COUNCIL_REGISTRY"
echo "   Data: $(cast calldata "setTermsRegistry(address)" "$TERMS_REGISTRY")"
echo ""
echo "2. setClaimsManager($CLAIMS_MANAGER)"
echo "   To: $COUNCIL_REGISTRY"
echo "   Data: $(cast calldata "setClaimsManager(address)" "$CLAIMS_MANAGER")"
echo ""

# =============================================================================
# Summary
# =============================================================================

echo "==========================================="
echo "  Deployment Complete!"
echo "==========================================="
echo ""
echo "External:"
echo "  USDC:              $USDC_ADDRESS"
echo "  ERC-8004 Registry: $ERC8004_REGISTRY"
echo ""
echo "Contracts (governance):"
echo "  CollateralVault:   $COLLATERAL_VAULT (deployer)"
echo "  TermsRegistry:     $TERMS_REGISTRY (deployer)"
echo "  TrustfulValidator: $TRUSTFUL_VALIDATOR (deployer)"
echo "  CouncilRegistry:   $COUNCIL_REGISTRY (SAFE)"
echo "  ClaimsManager:     $CLAIMS_MANAGER (deployer)"
echo "  RulingExecutor:    $RULING_EXECUTOR (deployer)"
echo ""
echo "Wiring Status:"
echo "  - All contracts except CouncilRegistry: WIRED ✓"
echo "  - CouncilRegistry: Submit 2 txs via Safe (see above)"
echo ""

# Save deployment
DEPLOYMENT_FILE="deployments/84532-$(date +%Y%m%d-%H%M%S).json"
mkdir -p deployments

cat > "$DEPLOYMENT_FILE" << EOF
{
  "chainId": 84532,
  "network": "Base Sepolia",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployer": "$DEPLOYER",
  "safe": "$SAFE_ADDRESS",
  "external": {
    "usdc": "$USDC_ADDRESS",
    "erc8004Registry": "$ERC8004_REGISTRY"
  },
  "contracts": {
    "collateralVault": "$COLLATERAL_VAULT",
    "termsRegistry": "$TERMS_REGISTRY",
    "trustfulValidator": "$TRUSTFUL_VALIDATOR",
    "councilRegistry": "$COUNCIL_REGISTRY",
    "claimsManager": "$CLAIMS_MANAGER",
    "rulingExecutor": "$RULING_EXECUTOR"
  }
}
EOF

echo "Saved to: $DEPLOYMENT_FILE"
