#!/usr/bin/env bash
set -euo pipefail
# =============================================================================
# extract-abis.sh — Extract full ABIs from Foundry build artifacts
#
# Copies the complete ABI (including functions, not just events) from each
# contract's Foundry output into config/abis/. This ensures viem can infer
# correct types for readContract and encodeFunctionData.
#
# Prerequisites:
#   cd contracts && forge build    (must be run first)
#
# Usage: ./config/scripts/extract-abis.sh
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$CONFIG_DIR")"
ABIS_DIR="$CONFIG_DIR/abis"
FOUNDRY_OUT="$PROJECT_ROOT/contracts/out"

# Contract output name -> "SolFile.sol/ArtifactName.json" mapping
# Format: [OutputName]="SolFile.sol/ArtifactName.json"
declare -A CONTRACTS=(
  ["ClaimsManager"]="ClaimsManager.sol/ClaimsManager.json"
  ["CollateralVault"]="CollateralVault.sol/CollateralVault.json"
  ["CouncilRegistry"]="CouncilRegistry.sol/CouncilRegistry.json"
  ["RulingExecutor"]="RulingExecutor.sol/RulingExecutor.json"
  ["TermsRegistry"]="TermsRegistry.sol/TermsRegistry.json"
  ["TrustfulValidator"]="TrustfulValidator.sol/TrustfulValidator.json"
  # Mocks have different artifact names
  ["USDC"]="ERC20Mock.sol/ERC20Mock.json"
  ["ERC8004Registry"]="ERC8004RegistryMock.sol/ERC8004RegistryMock.json"
)

echo "Extracting ABIs from Foundry artifacts..."
echo "  Source: $FOUNDRY_OUT"
echo "  Target: $ABIS_DIR"
echo ""

if [ ! -d "$FOUNDRY_OUT" ]; then
  echo "ERROR: Foundry output not found at $FOUNDRY_OUT"
  echo "       Run 'cd contracts && forge build' first."
  exit 1
fi

mkdir -p "$ABIS_DIR"

EXTRACTED=0
FAILED=0

for OUTPUT_NAME in "${!CONTRACTS[@]}"; do
  ARTIFACT_PATH="${CONTRACTS[$OUTPUT_NAME]}"
  ARTIFACT="$FOUNDRY_OUT/$ARTIFACT_PATH"
  
  if [ ! -f "$ARTIFACT" ]; then
    echo "  WARNING: $ARTIFACT not found, skipping $OUTPUT_NAME"
    FAILED=$((FAILED + 1))
    continue
  fi
  
  # Extract just the 'abi' array from the Foundry artifact
  python3 -c "
import json, sys
data = json.load(open('$ARTIFACT'))
abi = data.get('abi', [])
json.dump(abi, open('$ABIS_DIR/$OUTPUT_NAME.json', 'w'), indent=2)
funcs = [e['name'] for e in abi if e.get('type') == 'function']
events = [e['name'] for e in abi if e.get('type') == 'event']
print(f'  {len(funcs)} functions, {len(events)} events')
" && echo "  ✓ $OUTPUT_NAME" || { echo "  ✗ $OUTPUT_NAME (extraction failed)"; FAILED=$((FAILED + 1)); continue; }
  
  EXTRACTED=$((EXTRACTED + 1))
done

echo ""
echo "Done: $EXTRACTED extracted, $FAILED failed"

if [ $FAILED -gt 0 ]; then
  echo "WARNING: Some ABIs could not be extracted. Check paths above."
  exit 0  # Warn but continue so generate.sh completes
fi
