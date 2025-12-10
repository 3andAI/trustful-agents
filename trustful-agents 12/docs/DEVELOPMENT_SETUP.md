# Development Environment Setup Guide

Complete setup instructions for developing Trustful Agents on Windows and macOS.

## Table of Contents

1. [Software Requirements Overview](#software-requirements-overview)
2. [macOS Setup](#macos-setup)
3. [Windows Setup](#windows-setup)
4. [Ubuntu Setup](#ubuntu-setup)
5. [Post-Installation Setup (All Systems)](#post-installation-setup-all-systems)
6. [IDE Configuration](#ide-configuration)
7. [Verification Checklist](#verification-checklist)
8. [Troubleshooting](#troubleshooting)

---

## Software Requirements Overview

| Category | Software | Version | Purpose |
|----------|----------|---------|---------|
| **Version Control** | Git | >= 2.40 | Source control |
| **Runtime** | Node.js | >= 18.0 (LTS) | JavaScript runtime |
| **Package Manager** | pnpm | >= 8.0 | Fast, disk-efficient package manager |
| **Smart Contracts** | Foundry | Latest | Solidity development toolkit |
| **Blockchain** | Foundry (anvil) | Latest | Local Ethereum node |
| **Indexer** | Graph CLI | >= 0.68 | Subgraph development |
| **IDE** | VS Code | Latest | Code editor |
| **Containers** | Docker Desktop | Latest | Optional: local Graph node |
| **API Testing** | curl / Postman | Latest | API testing |

### Optional but Recommended

| Software | Purpose |
|----------|---------|
| GitHub CLI (`gh`) | GitHub operations from terminal |
| jq | JSON processing in terminal |
| direnv | Automatic environment variable loading |

---

## macOS Setup

### Step 1: Install Homebrew (Package Manager)

Homebrew is the standard package manager for macOS. Open **Terminal** and run:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

After installation, follow the instructions to add Homebrew to your PATH. Typically:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

Verify installation:

```bash
brew --version
# Should output: Homebrew 4.x.x
```

### Step 2: Install Git

macOS comes with Git, but install the latest version:

```bash
brew install git
```

Configure Git:

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
git config --global init.defaultBranch main
```

Verify:

```bash
git --version
# Should output: git version 2.4x.x
```

### Step 3: Install Node.js via nvm

We recommend using nvm (Node Version Manager) for flexibility:

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Restart terminal or run:
source ~/.zshrc

# Install Node.js LTS
nvm install --lts
nvm use --lts
nvm alias default node
```

Verify:

```bash
node --version
# Should output: v20.x.x or v22.x.x

npm --version
# Should output: 10.x.x
```

### Step 4: Install pnpm

```bash
# Install pnpm globally
npm install -g pnpm

# Or via Homebrew
brew install pnpm
```

Verify:

```bash
pnpm --version
# Should output: 8.x.x or 9.x.x
```

### Step 5: Install Foundry

Foundry is the Solidity development toolkit (forge, cast, anvil, chisel):

```bash
# Install foundryup (Foundry installer)
curl -L https://foundry.paradigm.xyz | bash

# Restart terminal or run:
source ~/.zshrc

# Install Foundry
foundryup
```

Verify all tools:

```bash
forge --version
# Should output: forge 0.2.x

cast --version
# Should output: cast 0.2.x

anvil --version
# Should output: anvil 0.2.x
```

### Step 6: Install The Graph CLI

```bash
npm install -g @graphprotocol/graph-cli
```

Verify:

```bash
graph --version
# Should output: 0.68.x or higher
```

### Step 7: Install Docker Desktop (Optional)

Required only if you want to run a local Graph node.

1. Download from: https://www.docker.com/products/docker-desktop/
2. Open the .dmg file and drag Docker to Applications
3. Launch Docker Desktop and complete setup
4. Enable in Settings: "Use Docker Compose V2"

Verify:

```bash
docker --version
# Should output: Docker version 24.x.x

docker compose version
# Should output: Docker Compose version v2.x.x
```

### Step 8: Install VS Code

```bash
brew install --cask visual-studio-code
```

Or download from: https://code.visualstudio.com/

### Step 9: Install Additional Tools

```bash
# GitHub CLI (optional but recommended)
brew install gh

# jq for JSON processing (optional)
brew install jq

# direnv for automatic .env loading (optional)
brew install direnv
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
```

---

## Windows Setup

### Step 1: Install Windows Terminal (Recommended)

Windows Terminal provides a better command-line experience.

1. Open **Microsoft Store**
2. Search for "Windows Terminal"
3. Click **Install**

### Step 2: Install Git for Windows

1. Download from: https://git-scm.com/download/win
2. Run the installer with these recommended options:
   - Select "Git from the command line and also from 3rd-party software"
   - Select "Use Windows' default console window" (or Windows Terminal)
   - Select "Checkout as-is, commit Unix-style line endings"
   - Select "Use external OpenSSH"
   - Enable "Enable symbolic links"

3. Open **Windows Terminal** and configure Git:

```powershell
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
git config --global init.defaultBranch main
```

Verify:

```powershell
git --version
# Should output: git version 2.4x.x.windows.x
```

### Step 3: Install Node.js via nvm-windows

1. Download nvm-windows from: https://github.com/coreybutler/nvm-windows/releases
2. Download and run `nvm-setup.exe`
3. Follow the installation wizard

4. Open a **new** Windows Terminal (as Administrator for first install):

```powershell
# Install Node.js LTS
nvm install lts
nvm use lts
```

Verify:

```powershell
node --version
# Should output: v20.x.x or v22.x.x

npm --version
# Should output: 10.x.x
```

### Step 4: Install pnpm

```powershell
npm install -g pnpm
```

Verify:

```powershell
pnpm --version
# Should output: 8.x.x or 9.x.x
```

### Step 5: Install Foundry

Foundry installation on Windows requires WSL2 (Windows Subsystem for Linux) OR Git Bash.

#### Option A: Using Git Bash (Simpler)

1. Open **Git Bash** (installed with Git for Windows)

2. Run the Foundry installer:

```bash
curl -L https://foundry.paradigm.xyz | bash
```

3. Close and reopen Git Bash

4. Install Foundry:

```bash
foundryup
```

5. Verify (in Git Bash):

```bash
forge --version
cast --version
anvil --version
```

> **Note**: Foundry commands will only work in Git Bash, not in PowerShell/CMD.

#### Option B: Using WSL2 (Recommended for Heavy Development)

1. Open PowerShell as Administrator and install WSL2:

```powershell
wsl --install
```

2. Restart your computer

3. Open Ubuntu from Start Menu and complete initial setup (username/password)

4. Inside Ubuntu, install Foundry:

```bash
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup
```

5. Verify:

```bash
forge --version
cast --version
anvil --version
```

> **Tip**: With WSL2, you can access Windows files at `/mnt/c/Users/YourUsername/`

### Step 6: Install The Graph CLI

In Windows Terminal (PowerShell):

```powershell
npm install -g @graphprotocol/graph-cli
```

Verify:

```powershell
graph --version
# Should output: 0.68.x or higher
```

### Step 7: Install Docker Desktop (Optional)

1. Download from: https://www.docker.com/products/docker-desktop/
2. Run the installer
3. Enable WSL2 backend when prompted (recommended)
4. Restart your computer if prompted
5. Launch Docker Desktop and complete setup

Verify (in PowerShell):

```powershell
docker --version
docker compose version
```

### Step 8: Install VS Code

1. Download from: https://code.visualstudio.com/
2. Run the installer
3. Select "Add to PATH" during installation

### Step 9: Install Additional Tools (Optional)

```powershell
# GitHub CLI
winget install GitHub.cli

# Or download from: https://cli.github.com/
```

---

## Ubuntu Setup

Tested on Ubuntu 22.04 LTS and 24.04 LTS.

### Step 1: Update System Packages

Open **Terminal** and run:

```bash
sudo apt update && sudo apt upgrade -y
```

### Step 2: Install Essential Build Tools

```bash
sudo apt install -y build-essential curl wget git unzip
```

### Step 3: Install Git

Ubuntu includes Git, but ensure you have the latest version:

```bash
sudo add-apt-repository ppa:git-core/ppa -y
sudo apt update
sudo apt install -y git
```

Configure Git:

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
git config --global init.defaultBranch main
```

Verify:

```bash
git --version
# Should output: git version 2.4x.x
```

### Step 4: Install Node.js via nvm

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Load nvm (or restart terminal)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js LTS
nvm install --lts
nvm use --lts
nvm alias default node
```

Verify:

```bash
node --version
# Should output: v20.x.x or v22.x.x

npm --version
# Should output: 10.x.x
```

### Step 5: Install pnpm

```bash
npm install -g pnpm
```

Verify:

```bash
pnpm --version
# Should output: 8.x.x or 9.x.x
```

### Step 6: Install Foundry

```bash
# Install foundryup
curl -L https://foundry.paradigm.xyz | bash

# Load foundry (or restart terminal)
source ~/.bashrc

# Install Foundry
foundryup
```

#### Ubuntu 20.04 Only: If `foundryup` fails with glibc errors

The pre-built binaries require glibc 2.32+, but Ubuntu 20.04 has glibc 2.31. Build from source instead:

```bash
# 1. Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source ~/.cargo/env

# 2. Add Ubuntu Toolchain PPA and install GCC 11
sudo add-apt-repository ppa:ubuntu-toolchain-r/test -y
sudo apt update
sudo apt install -y gcc-11 g++-11

# 3. Set GCC 11 as the compiler
export CC=gcc-11
export CXX=g++-11

# 4. Build and install Foundry from source
cargo install --git https://github.com/foundry-rs/foundry --profile release forge cast anvil chisel
```

> **Note:** Building from source takes 15-30 minutes depending on your machine.

Verify:

```bash
forge --version
# Should output: forge 0.2.x

cast --version
# Should output: cast 0.2.x

anvil --version
# Should output: anvil 0.2.x
```

### Step 7: Install The Graph CLI

```bash
npm install -g @graphprotocol/graph-cli
```

Verify:

```bash
graph --version
# Should output: 0.68.x or higher
```

### Step 8: Install Docker (Optional)

Required only if you want to run a local Graph node.

```bash
# Remove old versions (if any)
sudo apt remove docker docker-engine docker.io containerd runc 2>/dev/null

# Install prerequisites
sudo apt install -y ca-certificates curl gnupg

# Add Docker's GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add your user to docker group (avoids needing sudo)
sudo usermod -aG docker $USER

# Apply group change (or log out and back in)
newgrp docker
```

Verify:

```bash
docker --version
# Should output: Docker version 24.x.x

docker compose version
# Should output: Docker Compose version v2.x.x
```

### Step 9: Install VS Code

#### Option A: Via Snap (simplest)

```bash
sudo snap install code --classic
```

#### Option B: Via apt repository

```bash
# Add Microsoft GPG key
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
sudo install -D -o root -g root -m 644 packages.microsoft.gpg /etc/apt/keyrings/packages.microsoft.gpg

# Add repository
sudo sh -c 'echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/keyrings/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list'

# Install
sudo apt update
sudo apt install -y code

# Cleanup
rm -f packages.microsoft.gpg
```

### Step 10: Install Additional Tools (Optional)

```bash
# GitHub CLI
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install -y gh

# jq for JSON processing
sudo apt install -y jq

# direnv for automatic .env loading
sudo apt install -y direnv
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
```

### Ubuntu-Specific Notes

#### If using Wayland (Ubuntu 22.04+)

VS Code should work out of the box. If you experience issues:

```bash
# Launch VS Code with Ozone platform flag
code --ozone-platform-hint=wayland
```

#### Firewall (ufw)

If you have ufw enabled and need to expose local services:

```bash
# Allow Anvil (local blockchain)
sudo ufw allow 8545/tcp

# Allow API server
sudo ufw allow 3001/tcp
```

#### Memory considerations for Foundry

For large test suites, you may need to increase file watch limits:

```bash
# Add to /etc/sysctl.conf
echo "fs.inotify.max_user_watches=524288" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

## Post-Installation Setup (All Systems)

### Clone the Repository

```bash
# Navigate to your projects directory
cd ~/projects  # or wherever you keep projects

# Clone the repo
git clone https://github.com/3andAI/trustful-agents.git
cd trustful-agents
```

### Install Project Dependencies

```bash
# Install all workspace dependencies
pnpm install
```

### Install Foundry Dependencies

```bash
cd contracts

# Install OpenZeppelin and forge-std
forge install foundry-rs/forge-std --no-commit
forge install OpenZeppelin/openzeppelin-contracts --no-commit

# Verify
forge build
```

### Configure Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your values
# (Use VS Code or your preferred editor)
code .env
```

Minimum required variables for local development:

```env
# Local development
RPC_URL_BASE_SEPOLIA=https://sepolia.base.org
CHAIN_ID=84532

# For deployment (get from your wallet)
DEPLOYER_PRIVATE_KEY=

# Base Sepolia USDC
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

### Start Local Development Node

```bash
# In the contracts directory, start Anvil
cd contracts
anvil

# This starts a local Ethereum node at http://localhost:8545
# Leave this terminal running
```

### Run Contract Tests

```bash
# In a new terminal
cd contracts
forge test
```

---

## IDE Configuration

### VS Code Extensions

Install these extensions for the best development experience:

#### Essential

| Extension | ID | Purpose |
|-----------|-----|---------|
| Solidity | JuanBlanco.solidity | Solidity syntax & linting |
| Prettier | esbenp.prettier-vscode | Code formatting |
| ESLint | dbaeumer.vscode-eslint | JavaScript/TypeScript linting |
| GitLens | eamodio.gitlens | Git integration |

#### Recommended

| Extension | ID | Purpose |
|-----------|-----|---------|
| Even Better TOML | tamasfe.even-better-toml | TOML file support (foundry.toml) |
| GraphQL | GraphQL.vscode-graphql | GraphQL syntax (subgraph) |
| Tailwind CSS IntelliSense | bradlc.vscode-tailwindcss | CSS utilities (frontends) |
| Error Lens | usernamehw.errorlens | Inline error display |
| Docker | ms-azuretools.vscode-docker | Docker support |

Install via command palette (Cmd/Ctrl + Shift + P):

```
ext install JuanBlanco.solidity
ext install esbenp.prettier-vscode
ext install dbaeumer.vscode-eslint
ext install eamodio.gitlens
ext install tamasfe.even-better-toml
ext install GraphQL.vscode-graphql
```

### VS Code Settings

Create or update `.vscode/settings.json` in the project root:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[solidity]": {
    "editor.defaultFormatter": "JuanBlanco.solidity"
  },
  "solidity.formatter": "forge",
  "solidity.packageDefaultDependenciesContractsDirectory": "src",
  "solidity.packageDefaultDependenciesDirectory": "lib",
  "solidity.compileUsingRemoteVersion": "v0.8.24",
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.associations": {
    "*.sol": "solidity"
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/contracts/lib": true,
    "**/contracts/out": true,
    "**/contracts/cache": true
  }
}
```

---

## Verification Checklist

Run these commands to verify your setup is complete:

```bash
# Version checks
echo "=== Version Check ==="
git --version
node --version
pnpm --version
forge --version
cast --version
anvil --version
graph --version

# Project setup check
echo "=== Project Check ==="
cd ~/projects/trustful-agents  # adjust path as needed
pnpm install
cd contracts && forge build && cd ..
echo "✅ All checks passed!"
```

Expected output (versions may vary):

```
=== Version Check ===
git version 2.43.0
v20.11.0
8.15.0
forge 0.2.0
cast 0.2.0
anvil 0.2.0
0.68.5
=== Project Check ===
✅ All checks passed!
```

---

## Troubleshooting

### macOS Issues

#### "command not found: forge"

Foundry not in PATH. Run:

```bash
source ~/.zshrc
# Or restart terminal
```

If still not working, add manually:

```bash
echo 'export PATH="$HOME/.foundry/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

#### Permission denied errors

```bash
sudo chown -R $(whoami) ~/.foundry
sudo chown -R $(whoami) ~/.nvm
```

### Windows Issues

#### "forge: command not found" in PowerShell

Foundry only works in Git Bash or WSL on Windows. Use Git Bash for Foundry commands.

#### WSL2 slow file access

If accessing files on Windows drive (`/mnt/c/`) is slow, clone the repo inside WSL:

```bash
# Inside WSL Ubuntu
cd ~
git clone https://github.com/3andAI/trustful-agents.git
```

#### Node/npm permission errors

Run PowerShell as Administrator, or use nvm which doesn't require admin.

### Ubuntu Issues

#### "forge: command not found"

Foundry not in PATH. Run:

```bash
source ~/.bashrc
# Or restart terminal
```

If still not working, add manually:

```bash
echo 'export PATH="$HOME/.foundry/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

#### Ubuntu 20.04: "GLIBC_2.32 not found" or "aws-lc-sys compiler bug"

Ubuntu 20.04 has glibc 2.31, but Foundry binaries need 2.32+. Build from source with GCC 11:

```bash
# Add toolchain PPA and install GCC 11
sudo add-apt-repository ppa:ubuntu-toolchain-r/test -y
sudo apt update
sudo apt install -y gcc-11 g++-11

# Build with GCC 11
export CC=gcc-11
export CXX=g++-11
cargo install --git https://github.com/foundry-rs/foundry --profile release forge cast anvil chisel
```

#### Permission denied on Docker

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Apply without logout
newgrp docker
```

#### "ENOSPC: System limit for number of file watchers reached"

```bash
# Increase inotify watches
echo "fs.inotify.max_user_watches=524288" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

#### Node.js/nvm not found after installation

```bash
# Reload nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Or add to ~/.bashrc permanently
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.bashrc
echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> ~/.bashrc
source ~/.bashrc
```

#### Snap VS Code can't access certain directories

If VS Code installed via Snap can't access files:

```bash
# Remove snap version
sudo snap remove code

# Install via apt instead (see Ubuntu Setup Step 9, Option B)
```

### General Issues

#### "Cannot find module" errors

```bash
# Clean install
rm -rf node_modules
pnpm install
```

#### Foundry compilation errors

```bash
# Clean and rebuild
cd contracts
forge clean
forge build
```

#### Graph CLI issues

```bash
# Reinstall
npm uninstall -g @graphprotocol/graph-cli
npm install -g @graphprotocol/graph-cli
```

---

## Quick Reference

### Daily Development Commands

```bash
# Start local node
cd contracts && anvil

# Run tests
cd contracts && forge test

# Build contracts
cd contracts && forge build

# Start API (in separate terminal)
cd api && pnpm dev

# Start frontend (in separate terminal)
cd apps/provider-dashboard && pnpm dev
```

### Useful Aliases

Add to your shell config (`~/.zshrc` or `~/.bashrc`):

```bash
alias ta="cd ~/projects/trustful-agents"
alias ta-node="cd ~/projects/trustful-agents/contracts && anvil"
alias ta-test="cd ~/projects/trustful-agents/contracts && forge test"
alias ta-build="cd ~/projects/trustful-agents/contracts && forge build"
```

---

## Next Steps

After completing setup:

1. Read `contracts/README.md` for smart contract development
2. Read `subgraph/README.md` for indexer development
3. Read `api/README.md` for API development
4. Start with implementing `CollateralVault.sol`

Questions? Open an issue on GitHub.
