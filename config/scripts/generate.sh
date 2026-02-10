#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# generate.sh — Master config generator
#
# Generates all derived config files from the network JSON:
#   - config/generated/contracts.ts   (TypeScript exports for all apps)
#   - config/generated/env.dashboard  (.env for Vite frontends)
#   - config/generated/env.api        (.env for governance-api)
#   - config/generated/subgraph.yaml  (The Graph manifest)
#
# Usage: ./config/scripts/generate.sh [network]
#        Default network: base-sepolia
#
# After running, verify with:
#   ls -la config/generated/
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$(dirname "$SCRIPT_DIR")"
NETWORK="${1:-base-sepolia}"
NETWORK_FILE="$CONFIG_DIR/networks/${NETWORK}.json"

echo "============================================"
echo "  Trustful Agents Config Generator"
echo "  Network: $NETWORK"
echo "============================================"
echo ""

if [ ! -f "$NETWORK_FILE" ]; then
  echo "ERROR: Network config not found: $NETWORK_FILE"
  echo ""
  echo "Available networks:"
  ls "$CONFIG_DIR/networks/" | sed 's/.json$//'
  exit 1
fi

# Step 0: Extract ABIs from Foundry artifacts (if available)
FOUNDRY_OUT="$(dirname "$CONFIG_DIR")/contracts/out"
if [ -d "$FOUNDRY_OUT" ]; then
  echo "[0/4] Extracting ABIs from Foundry artifacts..."
  bash "$SCRIPT_DIR/extract-abis.sh"
  echo ""
else
  echo "[0/4] Skipping ABI extraction (no Foundry output at $FOUNDRY_OUT)"
  echo "      Using existing ABIs in config/abis/"
  echo ""
fi

# Step 1: Generate TypeScript config
echo "[1/4] Generating contracts.ts..."
node "$SCRIPT_DIR/generate-ts.js" "$NETWORK"
echo ""

# Step 2: Generate .env files
echo "[2/4] Generating .env files..."
bash "$SCRIPT_DIR/generate-env.sh" "$NETWORK"
echo ""

# Step 3: Generate subgraph manifest
echo "[3/4] Generating subgraph.yaml..."
bash "$SCRIPT_DIR/generate-subgraph.sh" "$NETWORK"
echo ""

# Summary
echo "============================================"
echo "  All config generated successfully!"
echo "============================================"
echo ""
echo "Generated files:"
ls -la "$CONFIG_DIR/generated/"
echo ""
echo "Next steps:"
echo "  1. If contracts changed: cd contracts && forge build"
echo "  2. Symlink .env files:   ln -sf ../../config/generated/env.dashboard apps/<dashboard>/.env"
echo "  3. Symlink contracts:    ln -sf ../../../config/generated/contracts.ts apps/<dashboard>/src/config/contracts.ts"
echo "  4. Build & test each app"
