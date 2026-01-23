import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core
          if (id.includes('node_modules/react') || 
              id.includes('node_modules/react-dom') || 
              id.includes('node_modules/react-router')) {
            return 'react-vendor'
          }
          
          // Web3/wallet libraries (largest)
          if (id.includes('node_modules/wagmi') || 
              id.includes('node_modules/viem') ||
              id.includes('node_modules/@wagmi') ||
              id.includes('node_modules/@reown') ||
              id.includes('node_modules/@walletconnect') ||
              id.includes('node_modules/@tanstack')) {
            return 'web3-vendor'
          }
          
          // UI components
          if (id.includes('node_modules/lucide-react')) {
            return 'ui-vendor'
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
