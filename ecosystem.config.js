// PM2 Ecosystem Configuration
// Run with: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    // ==========================================================================
    // Landing Page
    // ==========================================================================
    {
      name: 'landing',
      cwd: './apps/landing',
      script: 'server.js',
      env: {
        PORT: 3000,
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
    },

    // ==========================================================================
    // Governance API + Dashboard (serves both API and frontend)
    // ==========================================================================
    {
      name: 'governance',
      cwd: './apps/governance-api',
      script: 'dist/index.js',
      env: {
        PORT: 3001,
        NODE_ENV: 'production',
        // Add other env vars as needed
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
    },

    // ==========================================================================
    // Provider Dashboard
    // ==========================================================================
    {
      name: 'provider-dashboard',
      cwd: './apps/provider-dashboard',
      script: 'server.js',
      env: {
        PORT: 3002,
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
    },

    // ==========================================================================
    // Councillor Dashboard
    // ==========================================================================
    {
      name: 'council-dashboard',
      cwd: './apps/council-dashboard',
      script: 'server.js',
      env: {
        PORT: 3003,
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
    },

    // ==========================================================================
    // Claimer Dashboard
    // ==========================================================================
    {
      name: 'claimer-dashboard',
      cwd: './apps/claimer-dashboard',
      script: 'server.js',
      env: {
        PORT: 3004,
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
    },
  ],
};
