import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3004;
const API_URL = process.env.API_URL || 'http://localhost:3001';

// Proxy API requests in development
app.use('/api', createProxyMiddleware({
  target: API_URL,
  changeOrigin: true,
  pathRewrite: { '^/api': '' },
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           Claimer Dashboard                                  ║
╠══════════════════════════════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(52)}║
║  API:  ${API_URL.padEnd(52)}║
╚══════════════════════════════════════════════════════════════╝
  `);
});
