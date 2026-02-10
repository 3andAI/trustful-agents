#!/usr/bin/env bash
set -euo pipefail
# =============================================================================
# generate-subgraph.sh — Generate subgraph.yaml from template + network config
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$CONFIG_DIR")"
NETWORK="${1:-base-sepolia}"
NETWORK_FILE="$CONFIG_DIR/networks/${NETWORK}.json"
TEMPLATE="$PROJECT_ROOT/subgraph/subgraph.template.yaml"
OUTPUT="$CONFIG_DIR/generated/subgraph.yaml"

if [ ! -f "$NETWORK_FILE" ]; then
  echo "ERROR: Network config not found: $NETWORK_FILE"
  exit 1
fi

if [ ! -f "$TEMPLATE" ]; then
  echo "ERROR: Template not found: $TEMPLATE"
  exit 1
fi

# Read values from network JSON using python
read_json() {
  python3 -c "import json; data=json.load(open('$NETWORK_FILE')); print($1)"
}

NETWORK_NAME=$(read_json "data['network']")
START_BLOCK=$(read_json "data['startBlock']")
COLLATERAL_VAULT=$(read_json "data['contracts']['collateralVault']")
TERMS_REGISTRY=$(read_json "data['contracts']['termsRegistry']")
TRUSTFUL_VALIDATOR=$(read_json "data['contracts']['trustfulValidator']")
COUNCIL_REGISTRY=$(read_json "data['contracts']['councilRegistry']")
CLAIMS_MANAGER=$(read_json "data['contracts']['claimsManager']")
RULING_EXECUTOR=$(read_json "data['contracts']['rulingExecutor']")

# Generate subgraph.yaml from template
sed \
  -e "s/{{NETWORK}}/$NETWORK_NAME/g" \
  -e "s/{{START_BLOCK}}/$START_BLOCK/g" \
  -e "s/{{COLLATERAL_VAULT}}/$COLLATERAL_VAULT/g" \
  -e "s/{{TERMS_REGISTRY}}/$TERMS_REGISTRY/g" \
  -e "s/{{TRUSTFUL_VALIDATOR}}/$TRUSTFUL_VALIDATOR/g" \
  -e "s/{{COUNCIL_REGISTRY}}/$COUNCIL_REGISTRY/g" \
  -e "s/{{CLAIMS_MANAGER}}/$CLAIMS_MANAGER/g" \
  -e "s/{{RULING_EXECUTOR}}/$RULING_EXECUTOR/g" \
  "$TEMPLATE" > "$OUTPUT"

echo "Generated: $OUTPUT"
echo "  Network: $NETWORK_NAME"
echo "  Start block: $START_BLOCK"
