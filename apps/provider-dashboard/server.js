import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 80;

// Serve static files from dist with correct MIME types
app.use(express.static(join(__dirname, 'dist'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// SPA fallback - serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         Trustful Agents Provider Dashboard                   ║
╠══════════════════════════════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(53)}║
║  URL: http://localhost:${PORT.toString().padEnd(43)}║
╚══════════════════════════════════════════════════════════════╝
`);
});
