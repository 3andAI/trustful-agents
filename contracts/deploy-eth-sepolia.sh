#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# deploy-eth-sepolia.sh — Deploy Trustful Agents contracts to Eth Sepolia
#
# Usage: cd contracts && bash deploy-eth-sepolia.sh
#
# Deploys one contract at a time. After each deployment, records the address
# and proceeds to the next. Run from the contracts/ directory.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../config/.env.secrets"
source "$SCRIPT_DIR/.env"

# Known addresses
SAFE_ADDRESS="0x568A391C188e2aF11FA7550ACca170e085B00e7F"
USDC_ADDRESS="0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
IDENTITY_REGISTRY="0x8004A818BFB912233c491871b3d84c89A494BD9e"
VALIDATION_REGISTRY="0x8004CB39f29c09145F24Ad9dDe2A108C1A2cdfC5"

COMMON_ARGS="--rpc-url $RPC_URL_ETH_SEPOLIA --private-key $DEPLOYER_PRIVATE_KEY --verify --etherscan-api-key $ETHERSCAN_API_KEY --broadcast"

echo "============================================================================="
echo "Deploying Trustful Agents to Eth Sepolia (chainId: 11155111)"
echo "Governance (Safe): $SAFE_ADDRESS"
echo "USDC:              $USDC_ADDRESS"
echo "Identity Registry: $IDENTITY_REGISTRY"
echo "============================================================================="
echo ""

# ---------------------------------------------------------------------------
# 1. CollateralVault(usdc_, registry_, governance_, gracePeriod_)
# ---------------------------------------------------------------------------
echo ">>> 1/6 Deploying CollateralVault..."
forge create src/core/CollateralVault.sol:CollateralVault \
  $COMMON_ARGS \
  --constructor-args \
    "$USDC_ADDRESS" \
    "$IDENTITY_REGISTRY" \
    "$SAFE_ADDRESS" \
    "604800"

echo ""
read -p "Enter CollateralVault address: " COLLATERAL_VAULT
echo "  Recorded: $COLLATERAL_VAULT"
echo ""

# ---------------------------------------------------------------------------
# 2. TermsRegistry(registry_, governance_)
# ---------------------------------------------------------------------------
echo ">>> 2/6 Deploying TermsRegistry..."
forge create src/core/TermsRegistry.sol:TermsRegistry \
  $COMMON_ARGS \
  --constructor-args \
    "$IDENTITY_REGISTRY" \
    "$SAFE_ADDRESS"

echo ""
read -p "Enter TermsRegistry address: " TERMS_REGISTRY
echo "  Recorded: $TERMS_REGISTRY"
echo ""

# ---------------------------------------------------------------------------
# 3. CouncilRegistry(governance_)
# ---------------------------------------------------------------------------
echo ">>> 3/6 Deploying CouncilRegistry..."
forge create src/core/CouncilRegistry.sol:CouncilRegistry \
  $COMMON_ARGS \
  --constructor-args \
    "$SAFE_ADDRESS"

echo ""
read -p "Enter CouncilRegistry address: " COUNCIL_REGISTRY
echo "  Recorded: $COUNCIL_REGISTRY"
echo ""

# ---------------------------------------------------------------------------
# 4. TrustfulValidator(identityRegistry_, governance_, baseUri_)
# ---------------------------------------------------------------------------
echo ">>> 4/6 Deploying TrustfulValidator..."
forge create src/core/TrustfulValidator.sol:TrustfulValidator \
  $COMMON_ARGS \
  --constructor-args \
    "$IDENTITY_REGISTRY" \
    "$SAFE_ADDRESS" \
    "https://api.trustful-agents.ai/validation/"

echo ""
read -p "Enter TrustfulValidator address: " TRUSTFUL_VALIDATOR
echo "  Recorded: $TRUSTFUL_VALIDATOR"
echo ""

# ---------------------------------------------------------------------------
# 5. ClaimsManager(usdc_, registry_, governance_)
# ---------------------------------------------------------------------------
echo ">>> 5/6 Deploying ClaimsManager..."
forge create src/core/ClaimsManager.sol:ClaimsManager \
  $COMMON_ARGS \
  --constructor-args \
    "$USDC_ADDRESS" \
    "$IDENTITY_REGISTRY" \
    "$SAFE_ADDRESS"

echo ""
read -p "Enter ClaimsManager address: " CLAIMS_MANAGER
echo "  Recorded: $CLAIMS_MANAGER"
echo ""

# ---------------------------------------------------------------------------
# 6. RulingExecutor(usdc_, governance_)
# ---------------------------------------------------------------------------
echo ">>> 6/6 Deploying RulingExecutor..."
forge create src/core/RulingExecutor.sol:RulingExecutor \
  $COMMON_ARGS \
  --constructor-args \
    "$USDC_ADDRESS" \
    "$SAFE_ADDRESS"

echo ""
read -p "Enter RulingExecutor address: " RULING_EXECUTOR
echo "  Recorded: $RULING_EXECUTOR"
echo ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo "============================================================================="
echo "DEPLOYMENT COMPLETE"
echo "============================================================================="
echo ""
echo "CollateralVault:    $COLLATERAL_VAULT"
echo "TermsRegistry:      $TERMS_REGISTRY"
echo "CouncilRegistry:    $COUNCIL_REGISTRY"
echo "TrustfulValidator:  $TRUSTFUL_VALIDATOR"
echo "ClaimsManager:      $CLAIMS_MANAGER"
echo "RulingExecutor:     $RULING_EXECUTOR"
echo ""
echo "Next steps:"
echo "  1. Update config/networks/eth-sepolia.json with the addresses above"
echo "  2. Wire contracts via Safe multisig (see migration doc Step 14)"
echo "  3. Run: bash config/scripts/generate.sh eth-sepolia"
echo ""
echo "Wiring calls needed (via Safe):"
echo "  CollateralVault.setClaimsManager($CLAIMS_MANAGER)"
echo "  CollateralVault.setTermsRegistry($TERMS_REGISTRY)"
echo "  ClaimsManager.setCollateralVault($COLLATERAL_VAULT)"
echo "  ClaimsManager.setTermsRegistry($TERMS_REGISTRY)"
echo "  ClaimsManager.setCouncilRegistry($COUNCIL_REGISTRY)"
echo "  ClaimsManager.setRulingExecutor($RULING_EXECUTOR)"
echo "  RulingExecutor.setClaimsManager($CLAIMS_MANAGER)"
echo "  RulingExecutor.setCollateralVault($COLLATERAL_VAULT)"
echo "  RulingExecutor.setCouncilRegistry($COUNCIL_REGISTRY)"
echo "  TrustfulValidator.setCollateralVault($COLLATERAL_VAULT)"
echo "  TrustfulValidator.setTermsRegistry($TERMS_REGISTRY)"
echo "  TrustfulValidator.setCouncilRegistry($COUNCIL_REGISTRY)"
echo "  TrustfulValidator.setValidationRegistry($VALIDATION_REGISTRY)"
echo "  TrustfulValidator.setMinimumCollateral(10000000)  # 10 USDC for testing"
