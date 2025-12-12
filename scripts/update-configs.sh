#!/bin/bash
#
# update-configs.sh
# Updates all configuration files after Phase 1 deployment
#
# Usage:
#   ./scripts/update-configs.sh <path-to-deployment-json>
#
# Example:
#   ./scripts/update-configs.sh contracts/deployments/84532.json
#

set -e

DEPLOYMENT_FILE=$1

if [ -z "$DEPLOYMENT_FILE" ]; then
    echo "Usage: ./scripts/update-configs.sh <path-to-deployment-json>"
    echo "Example: ./scripts/update-configs.sh contracts/deployments/84532.json"
    exit 1
fi

if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo "Error: Deployment file not found: $DEPLOYMENT_FILE"
    exit 1
fi

# Extract values from deployment JSON
CHAIN_ID=$(jq -r '.chainId' "$DEPLOYMENT_FILE")
USDC=$(jq -r '.usdc' "$DEPLOYMENT_FILE")
ERC8004_REGISTRY=$(jq -r '.erc8004Registry' "$DEPLOYMENT_FILE")
COLLATERAL_VAULT=$(jq -r '.collateralVault' "$DEPLOYMENT_FILE")
TERMS_REGISTRY=$(jq -r '.termsRegistry' "$DEPLOYMENT_FILE")
TRUSTFUL_VALIDATOR=$(jq -r '.trustfulValidator' "$DEPLOYMENT_FILE")
COUNCIL_REGISTRY=$(jq -r '.councilRegistry // "0x0000000000000000000000000000000000000000"' "$DEPLOYMENT_FILE")
CLAIMS_MANAGER=$(jq -r '.claimsManager // "0x0000000000000000000000000000000000000000"' "$DEPLOYMENT_FILE")
RULING_EXECUTOR=$(jq -r '.rulingExecutor // "0x0000000000000000000000000000000000000000"' "$DEPLOYMENT_FILE")
MOCK_USDC=$(jq -r '.mockUsdc // ""' "$DEPLOYMENT_FILE")
MOCK_ERC8004=$(jq -r '.mockErc8004Registry // ""' "$DEPLOYMENT_FILE")

echo "============================================"
echo "  Updating Trustful Agents Configurations"
echo "============================================"
echo ""
echo "Deployment file: $DEPLOYMENT_FILE"
echo "Chain ID: $CHAIN_ID"
echo ""
echo "Addresses:"
echo "  CollateralVault:    $COLLATERAL_VAULT"
echo "  TermsRegistry:      $TERMS_REGISTRY"
echo "  TrustfulValidator:  $TRUSTFUL_VALIDATOR"
echo "  CouncilRegistry:    $COUNCIL_REGISTRY"
echo "  ClaimsManager:      $CLAIMS_MANAGER"
echo "  RulingExecutor:     $RULING_EXECUTOR"
echo ""

# Determine network name for subgraph
if [ "$CHAIN_ID" = "84532" ]; then
    NETWORK="base-sepolia"
elif [ "$CHAIN_ID" = "8453" ]; then
    NETWORK="base"
else
    NETWORK="unknown"
fi

# =============================================================================
# Update SDK config.ts
# =============================================================================

echo "1. Updating SDK config (packages/sdk/src/config.ts)..."

SDK_CONFIG="packages/sdk/src/config.ts"

if [ -f "$SDK_CONFIG" ]; then
    if [ "$CHAIN_ID" = "84532" ]; then
        # Update BASE_SEPOLIA_CONFIG
        # Use temp file approach for cross-platform compatibility (macOS/Linux)
        sed "s|collateralVault: \"0x[a-fA-F0-9]*\"|collateralVault: \"$COLLATERAL_VAULT\"|g" "$SDK_CONFIG" > "$SDK_CONFIG.tmp" && mv "$SDK_CONFIG.tmp" "$SDK_CONFIG"
        sed "s|termsRegistry: \"0x[a-fA-F0-9]*\"|termsRegistry: \"$TERMS_REGISTRY\"|g" "$SDK_CONFIG" > "$SDK_CONFIG.tmp" && mv "$SDK_CONFIG.tmp" "$SDK_CONFIG"
        sed "s|trustfulValidator: \"0x[a-fA-F0-9]*\"|trustfulValidator: \"$TRUSTFUL_VALIDATOR\"|g" "$SDK_CONFIG" > "$SDK_CONFIG.tmp" && mv "$SDK_CONFIG.tmp" "$SDK_CONFIG"
        sed "s|councilRegistry: \"0x[a-fA-F0-9]*\"|councilRegistry: \"$COUNCIL_REGISTRY\"|g" "$SDK_CONFIG" > "$SDK_CONFIG.tmp" && mv "$SDK_CONFIG.tmp" "$SDK_CONFIG"
        sed "s|claimsManager: \"0x[a-fA-F0-9]*\"|claimsManager: \"$CLAIMS_MANAGER\"|g" "$SDK_CONFIG" > "$SDK_CONFIG.tmp" && mv "$SDK_CONFIG.tmp" "$SDK_CONFIG"
        sed "s|rulingExecutor: \"0x[a-fA-F0-9]*\"|rulingExecutor: \"$RULING_EXECUTOR\"|g" "$SDK_CONFIG" > "$SDK_CONFIG.tmp" && mv "$SDK_CONFIG.tmp" "$SDK_CONFIG"
        sed "s|erc8004Registry: \"0x[a-fA-F0-9]*\"|erc8004Registry: \"$ERC8004_REGISTRY\"|g" "$SDK_CONFIG" > "$SDK_CONFIG.tmp" && mv "$SDK_CONFIG.tmp" "$SDK_CONFIG"
        echo "   [OK] SDK config updated for Base Sepolia"
    fi
else
    echo "   [!] SDK config not found at $SDK_CONFIG"
fi

# =============================================================================
# Update Provider Dashboard contracts.ts
# =============================================================================

echo "2. Updating Provider Dashboard (apps/provider-dashboard/src/config/contracts.ts)..."

DASHBOARD_CONFIG="apps/provider-dashboard/src/config/contracts.ts"

if [ -f "$DASHBOARD_CONFIG" ]; then
    sed "s|collateralVault: '0x[a-fA-F0-9]*'|collateralVault: '$COLLATERAL_VAULT'|g" "$DASHBOARD_CONFIG" > "$DASHBOARD_CONFIG.tmp" && mv "$DASHBOARD_CONFIG.tmp" "$DASHBOARD_CONFIG"
    sed "s|termsRegistry: '0x[a-fA-F0-9]*'|termsRegistry: '$TERMS_REGISTRY'|g" "$DASHBOARD_CONFIG" > "$DASHBOARD_CONFIG.tmp" && mv "$DASHBOARD_CONFIG.tmp" "$DASHBOARD_CONFIG"
    sed "s|trustfulValidator: '0x[a-fA-F0-9]*'|trustfulValidator: '$TRUSTFUL_VALIDATOR'|g" "$DASHBOARD_CONFIG" > "$DASHBOARD_CONFIG.tmp" && mv "$DASHBOARD_CONFIG.tmp" "$DASHBOARD_CONFIG"
    
    # Add Phase 1 contracts if not present
    if ! grep -q "councilRegistry:" "$DASHBOARD_CONFIG"; then
        echo "   Adding Phase 1 contract addresses..."
        sed "/trustfulValidator:/a\\
  councilRegistry: '$COUNCIL_REGISTRY' as Address," "$DASHBOARD_CONFIG" > "$DASHBOARD_CONFIG.tmp" && mv "$DASHBOARD_CONFIG.tmp" "$DASHBOARD_CONFIG"
        sed "/councilRegistry:/a\\
  claimsManager: '$CLAIMS_MANAGER' as Address," "$DASHBOARD_CONFIG" > "$DASHBOARD_CONFIG.tmp" && mv "$DASHBOARD_CONFIG.tmp" "$DASHBOARD_CONFIG"
        sed "/claimsManager:/a\\
  rulingExecutor: '$RULING_EXECUTOR' as Address," "$DASHBOARD_CONFIG" > "$DASHBOARD_CONFIG.tmp" && mv "$DASHBOARD_CONFIG.tmp" "$DASHBOARD_CONFIG"
    else
        sed "s|councilRegistry: '0x[a-fA-F0-9]*'|councilRegistry: '$COUNCIL_REGISTRY'|g" "$DASHBOARD_CONFIG" > "$DASHBOARD_CONFIG.tmp" && mv "$DASHBOARD_CONFIG.tmp" "$DASHBOARD_CONFIG"
        sed "s|claimsManager: '0x[a-fA-F0-9]*'|claimsManager: '$CLAIMS_MANAGER'|g" "$DASHBOARD_CONFIG" > "$DASHBOARD_CONFIG.tmp" && mv "$DASHBOARD_CONFIG.tmp" "$DASHBOARD_CONFIG"
        sed "s|rulingExecutor: '0x[a-fA-F0-9]*'|rulingExecutor: '$RULING_EXECUTOR'|g" "$DASHBOARD_CONFIG" > "$DASHBOARD_CONFIG.tmp" && mv "$DASHBOARD_CONFIG.tmp" "$DASHBOARD_CONFIG"
    fi
    
    if [ -n "$MOCK_USDC" ] && [ "$MOCK_USDC" != "null" ]; then
        sed "s|mockUsdc: '0x[a-fA-F0-9]*'|mockUsdc: '$MOCK_USDC'|g" "$DASHBOARD_CONFIG" > "$DASHBOARD_CONFIG.tmp" && mv "$DASHBOARD_CONFIG.tmp" "$DASHBOARD_CONFIG"
    fi
    if [ -n "$MOCK_ERC8004" ] && [ "$MOCK_ERC8004" != "null" ]; then
        sed "s|mockErc8004Registry: '0x[a-fA-F0-9]*'|mockErc8004Registry: '$MOCK_ERC8004'|g" "$DASHBOARD_CONFIG" > "$DASHBOARD_CONFIG.tmp" && mv "$DASHBOARD_CONFIG.tmp" "$DASHBOARD_CONFIG"
    fi
    
    echo "   [OK] Provider Dashboard config updated"
else
    echo "   [!] Provider Dashboard config not found at $DASHBOARD_CONFIG"
fi

# =============================================================================
# Update Subgraph config
# =============================================================================

echo "3. Updating Subgraph (subgraph/subgraph.yaml)..."

SUBGRAPH_CONFIG="subgraph/subgraph.yaml"

if [ -f "$SUBGRAPH_CONFIG" ]; then
    # Create temporary file
    TMP_FILE=$(mktemp)
    
    awk -v cv="$COLLATERAL_VAULT" \
        -v tr="$TERMS_REGISTRY" \
        -v tv="$TRUSTFUL_VALIDATOR" \
        -v cr="$COUNCIL_REGISTRY" \
        -v cm="$CLAIMS_MANAGER" \
        -v re="$RULING_EXECUTOR" \
        '
    /name: CollateralVault/ { in_cv=1 }
    /name: TermsRegistry/ { in_cv=0; in_tr=1 }
    /name: TrustfulValidator/ { in_tr=0; in_tv=1 }
    /name: CouncilRegistry/ { in_tv=0; in_cr=1 }
    /name: ClaimsManager/ { in_cr=0; in_cm=1 }
    /name: RulingExecutor/ { in_cm=0; in_re=1 }
    
    /address:/ {
        if (in_cv) { gsub(/"0x[a-fA-F0-9]*"/, "\"" cv "\"") }
        if (in_tr) { gsub(/"0x[a-fA-F0-9]*"/, "\"" tr "\"") }
        if (in_tv) { gsub(/"0x[a-fA-F0-9]*"/, "\"" tv "\"") }
        if (in_cr) { gsub(/"0x[a-fA-F0-9]*"/, "\"" cr "\"") }
        if (in_cm) { gsub(/"0x[a-fA-F0-9]*"/, "\"" cm "\"") }
        if (in_re) { gsub(/"0x[a-fA-F0-9]*"/, "\"" re "\"") }
    }
    
    { print }
    ' "$SUBGRAPH_CONFIG" > "$TMP_FILE"
    
    mv "$TMP_FILE" "$SUBGRAPH_CONFIG"
    echo "   [OK] Subgraph config updated"
else
    echo "   [!] Subgraph config not found at $SUBGRAPH_CONFIG"
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
echo "============================================"
echo "  Configuration Update Complete"
echo "============================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Build and deploy the subgraph:"
echo "   cd subgraph"
echo "   graph codegen"
echo "   graph build"
echo "   graph deploy --studio trustful-agents"
echo ""
echo "2. Start the provider dashboard:"
echo "   cd apps/provider-dashboard"
echo "   npm run dev"
echo ""
echo "3. Create a default council for testing:"
echo "   cast send $COUNCIL_REGISTRY \\"
echo "     'createCouncil(string,string,string,uint256,uint256,uint256,uint256)' \\"
echo "     'General' 'Default council' 'general' 5000 1000 604800 259200 \\"
echo "     --rpc-url \$RPC_URL --private-key \$DEPLOYER_PRIVATE_KEY"
echo ""
