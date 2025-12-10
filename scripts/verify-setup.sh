#!/bin/bash
# =============================================================================
# Trustful Agents - Development Environment Verification Script
# =============================================================================
# Run this script to verify your development environment is correctly set up.
# Usage: ./scripts/verify-setup.sh
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=============================================="
echo "  Trustful Agents - Environment Verification"
echo "=============================================="
echo ""

ERRORS=0

check_command() {
    local cmd=$1
    local min_version=$2
    local name=${3:-$cmd}
    
    if command -v $cmd &> /dev/null; then
        version=$($cmd --version 2>&1 | head -n 1)
        echo -e "${GREEN}✓${NC} $name: $version"
    else
        echo -e "${RED}✗${NC} $name: NOT FOUND"
        ERRORS=$((ERRORS + 1))
    fi
}

echo "Checking required tools..."
echo "-------------------------------------------"

# Core tools
check_command git "2.40" "Git"
check_command node "18.0" "Node.js"
check_command pnpm "8.0" "pnpm"

# Foundry tools
check_command forge "0.2" "Forge (Foundry)"
check_command cast "0.2" "Cast (Foundry)"
check_command anvil "0.2" "Anvil (Foundry)"

# Graph CLI
check_command graph "0.60" "Graph CLI"

echo ""
echo "Checking optional tools..."
echo "-------------------------------------------"

# Optional tools
if command -v docker &> /dev/null; then
    version=$(docker --version 2>&1)
    echo -e "${GREEN}✓${NC} Docker: $version"
else
    echo -e "${YELLOW}○${NC} Docker: not installed (optional)"
fi

if command -v gh &> /dev/null; then
    version=$(gh --version 2>&1 | head -n 1)
    echo -e "${GREEN}✓${NC} GitHub CLI: $version"
else
    echo -e "${YELLOW}○${NC} GitHub CLI: not installed (optional)"
fi

if command -v code &> /dev/null; then
    version=$(code --version 2>&1 | head -n 1)
    echo -e "${GREEN}✓${NC} VS Code: $version"
else
    echo -e "${YELLOW}○${NC} VS Code: not installed (optional)"
fi

echo ""
echo "Checking project setup..."
echo "-------------------------------------------"

# Check if we're in the project directory
if [ -f "package.json" ] && grep -q "trustful-agents" package.json 2>/dev/null; then
    echo -e "${GREEN}✓${NC} In project directory"
else
    echo -e "${YELLOW}○${NC} Not in project directory (run from trustful-agents root)"
fi

# Check node_modules
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules exists"
else
    echo -e "${YELLOW}○${NC} node_modules not found (run: pnpm install)"
fi

# Check Foundry lib
if [ -d "contracts/lib/forge-std" ]; then
    echo -e "${GREEN}✓${NC} Foundry dependencies installed"
else
    echo -e "${YELLOW}○${NC} Foundry deps not found (run: cd contracts && forge install)"
fi

# Check .env
if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC} .env file exists"
else
    echo -e "${YELLOW}○${NC} .env not found (copy from .env.example)"
fi

echo ""
echo "=============================================="

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}All required tools are installed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. cd trustful-agents"
    echo "  2. pnpm install"
    echo "  3. cd contracts && forge install"
    echo "  4. cp .env.example .env"
    echo "  5. forge build"
else
    echo -e "${RED}$ERRORS required tool(s) missing!${NC}"
    echo ""
    echo "Please install missing tools. See docs/DEVELOPMENT_SETUP.md"
    exit 1
fi

echo "=============================================="
