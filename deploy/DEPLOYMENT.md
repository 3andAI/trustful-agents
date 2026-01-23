# Trustful Agents - Deployment Guide

## Overview

This guide explains how to deploy all Trustful Agents applications on a single server with Nginx and PM2.

## Architecture

```
trustful-agents.ai              → Landing (port 3000)
governance.trustful-agents.ai   → Governance Dashboard (port 3001)
provider.trustful-agents.ai     → Provider Dashboard (port 3002)
council.trustful-agents.ai      → Councillor Dashboard (port 3003)
claims.trustful-agents.ai       → Claimer Dashboard (port 3004)
api.trustful-agents.ai          → Shared API (port 3010)
```

## Prerequisites

- Ubuntu/Debian server
- Node.js 18+ 
- Nginx
- PM2 (`npm install -g pm2`)
- Domain pointed to server IP

## Step 1: Cloudflare DNS Setup

Add these DNS records in Cloudflare (all proxied/orange cloud):

| Type | Name | Content |
|------|------|---------|
| A | @ | `<your-server-ip>` |
| A | www | `<your-server-ip>` |
| A | governance | `<your-server-ip>` |
| A | provider | `<your-server-ip>` |
| A | council | `<your-server-ip>` |
| A | claims | `<your-server-ip>` |
| A | api | `<your-server-ip>` |

In Cloudflare SSL/TLS settings:
- Set encryption mode to **Full** (or Full Strict if you have origin certs)

## Step 2: Install Nginx

```bash
sudo apt update
sudo apt install nginx -y
```

## Step 3: Configure Nginx

```bash
# Copy the config
sudo cp deploy/nginx/trustful-agents.conf /etc/nginx/sites-available/trustful-agents

# Enable it
sudo ln -s /etc/nginx/sites-available/trustful-agents /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## Step 4: Build All Applications

```bash
# Landing page (already static HTML, no build needed)

# Governance Dashboard
cd apps/governance-dashboard
npm install
npm run build

# Provider Dashboard  
cd ../provider-dashboard
npm install
npm run build

# Council Dashboard (if exists)
cd ../council-dashboard
npm install
npm run build

# Claimer Dashboard (if exists)
cd ../claimer-dashboard
npm install
npm run build

# API
cd ../governance-api
npm install
npm run build
```

## Step 5: Configure Environment Variables

Create `.env` files for each app that needs them:

**Provider Dashboard** (`apps/provider-dashboard/.env`):
```env
VITE_API_URL=https://api.trustful-agents.ai
VITE_PINATA_API_KEY=your_key
VITE_PINATA_SECRET_KEY=your_secret
```

**API** (`apps/governance-api/.env`):
```env
PORT=3010
DATABASE_URL=file:../data/trustful.db
NODE_ENV=production
```

After changing environment variables, rebuild the affected apps.

## Step 6: Start All Apps with PM2

```bash
# From project root
pm2 start ecosystem.config.js

# Save the process list (auto-start on reboot)
pm2 save
pm2 startup
```

## Step 7: Verify Deployment

```bash
# Check all processes are running
pm2 status

# Check logs
pm2 logs

# Test endpoints
curl http://localhost:3000  # Landing
curl http://localhost:3002  # Provider Dashboard
curl http://localhost:3010/health  # API
```

## Useful PM2 Commands

```bash
# View status
pm2 status

# View logs (all apps)
pm2 logs

# View logs (specific app)
pm2 logs provider-dashboard

# Restart all
pm2 restart all

# Restart specific app
pm2 restart provider-dashboard

# Stop all
pm2 stop all

# Reload with zero downtime
pm2 reload all
```

## Updating Applications

```bash
# 1. Pull latest code
git pull

# 2. Rebuild the changed app
cd apps/provider-dashboard
npm run build

# 3. Reload the app (zero downtime)
pm2 reload provider-dashboard
```

## Troubleshooting

### App not starting
```bash
pm2 logs <app-name>
```

### Nginx errors
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### Port already in use
```bash
# Find what's using the port
sudo lsof -i :3002

# Kill the process or change the port in ecosystem.config.js
```

### Cloudflare 522 errors
- Check if the app is running: `pm2 status`
- Check if nginx is running: `systemctl status nginx`
- Check firewall allows port 80: `sudo ufw status`

## Directory Structure

```
/home/user/trustful-agents/
├── ecosystem.config.js      # PM2 configuration
├── deploy/
│   └── nginx/
│       └── trustful-agents.conf
├── apps/
│   ├── landing/
│   │   ├── server.js
│   │   └── public/
│   │       └── index.html
│   ├── governance-dashboard/
│   │   ├── dist/
│   │   └── server.js
│   ├── provider-dashboard/
│   │   ├── dist/
│   │   └── server.js
│   ├── council-dashboard/
│   │   ├── dist/
│   │   └── server.js
│   ├── claimer-dashboard/
│   │   ├── dist/
│   │   └── server.js
│   └── governance-api/
│       └── dist/
└── data/
    └── trustful.db
```
