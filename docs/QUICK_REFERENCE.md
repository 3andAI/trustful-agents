# Development Setup - Quick Reference

## Required Software

| Tool | macOS | Windows | Ubuntu |
|------|-------|---------|--------|
| Git | `brew install git` | https://git-scm.com/download/win | `sudo apt install git` |
| Node.js | `nvm install --lts` | nvm-windows + `nvm install lts` | `nvm install --lts` |
| pnpm | `npm install -g pnpm` | `npm install -g pnpm` | `npm install -g pnpm` |
| Foundry | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` | Use Git Bash or WSL2 | Same as macOS |
| Graph CLI | `npm install -g @graphprotocol/graph-cli` | Same | Same |

## Platform-Specific Prerequisites

**macOS:**
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Ubuntu:**
```bash
sudo apt update && sudo apt install -y build-essential curl wget git unzip
```

**Windows:**
- Install Git Bash (comes with Git for Windows)
- Use Git Bash for Foundry commands (not PowerShell)

## First-Time Setup

```bash
# 1. Clone repo
git clone https://github.com/3andAI/trustful-agents.git
cd trustful-agents

# 2. Install dependencies
pnpm install

# 3. Install Foundry deps
cd contracts
forge install foundry-rs/forge-std --no-commit
forge install OpenZeppelin/openzeppelin-contracts --no-commit

# 4. Setup environment
cd ..
cp .env.example .env
# Edit .env with your values

# 5. Verify
forge build
```

## Daily Commands

```bash
# Start local blockchain
cd contracts && anvil

# Run tests
forge test

# Run specific test
forge test --match-test testDeposit -vvv

# Build contracts
forge build

# Start API
cd api && pnpm dev

# Generate subgraph types
cd subgraph && pnpm codegen
```

## Verification

```bash
# Check all tools
./scripts/verify-setup.sh

# Or manually
git --version && node --version && pnpm --version && forge --version
```

## Troubleshooting

| Issue | Platform | Solution |
|-------|----------|----------|
| `forge: command not found` | All | `source ~/.bashrc` or `source ~/.zshrc`, restart terminal |
| `forge: command not found` | Windows | Use Git Bash, not PowerShell |
| GLIBC_2.32 not found | Ubuntu 20.04 | Build from source with GCC 11 (see below) |
| Permission errors (macOS) | macOS | `sudo chown -R $(whoami) ~/.foundry` |
| Docker permission denied | Ubuntu | `sudo usermod -aG docker $USER && newgrp docker` |
| ENOSPC file watchers | Ubuntu | `echo "fs.inotify.max_user_watches=524288" \| sudo tee -a /etc/sysctl.conf && sudo sysctl -p` |
| Module not found | All | `rm -rf node_modules && pnpm install` |

### Ubuntu 20.04: Foundry from Source

```bash
sudo add-apt-repository ppa:ubuntu-toolchain-r/test -y
sudo apt update && sudo apt install -y gcc-11 g++-11
export CC=gcc-11 CXX=g++-11
cargo install --git https://github.com/foundry-rs/foundry --profile release forge cast anvil chisel
```

## Links

- [Full Setup Guide](./DEVELOPMENT_SETUP.md)
- [Foundry Book](https://book.getfoundry.sh/)
- [The Graph Docs](https://thegraph.com/docs/)
- [Base Docs](https://docs.base.org/)
