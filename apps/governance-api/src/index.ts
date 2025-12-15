import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { db, healthCheck as dbHealthCheck, closePool } from './db/index.js';
import { healthCheck as safeHealthCheck } from './services/safe.js';
import { processEmailQueue } from './services/email.js';
import { cleanupExpiredSessions } from './services/auth.js';

import authRoutes from './routes/auth.js';
import councilRoutes from './routes/councils.js';
import safeRoutes from './routes/safe.js';
import agentRoutes from './routes/agents.js';

// ============================================================================
// Configuration
// ============================================================================

const PORT = parseInt(process.env.PORT || '3001');
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// ============================================================================
// Express App
// ============================================================================

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: CORS_ORIGIN.split(','),
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Auth endpoints have stricter rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts.' },
});

// Body parsing
app.use(express.json({ limit: '1mb' }));

// ============================================================================
// Routes
// ============================================================================

// Health check
app.get('/health', async (_req, res) => {
  const dbOk = await dbHealthCheck();
  const safeOk = await safeHealthCheck();
  
  const status = dbOk && safeOk ? 'healthy' : 'degraded';
  const statusCode = dbOk ? 200 : 503;
  
  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk ? 'ok' : 'error',
      safe: safeOk ? 'ok' : 'error',
    },
  });
});

// API routes
app.use('/auth', authLimiter, authRoutes);
app.use('/councils', councilRoutes);
app.use('/safe', safeRoutes);
app.use('/agents', agentRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ============================================================================
// Background Tasks
// ============================================================================

let emailQueueInterval: NodeJS.Timeout | null = null;
let sessionCleanupInterval: NodeJS.Timeout | null = null;

function startBackgroundTasks() {
  // Process email queue every 30 seconds
  emailQueueInterval = setInterval(async () => {
    try {
      const sent = await processEmailQueue();
      if (sent > 0) {
        console.log(`Processed ${sent} emails`);
      }
    } catch (error) {
      console.error('Email queue error:', error);
    }
  }, 30 * 1000);
  
  // Cleanup expired sessions every 5 minutes
  sessionCleanupInterval = setInterval(async () => {
    try {
      const cleaned = await cleanupExpiredSessions();
      if (cleaned > 0) {
        console.log(`Cleaned up ${cleaned} expired sessions`);
      }
    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  }, 5 * 60 * 1000);
  
  console.log('Background tasks started');
}

function stopBackgroundTasks() {
  if (emailQueueInterval) {
    clearInterval(emailQueueInterval);
    emailQueueInterval = null;
  }
  if (sessionCleanupInterval) {
    clearInterval(sessionCleanupInterval);
    sessionCleanupInterval = null;
  }
  console.log('Background tasks stopped');
}

// ============================================================================
// Server Lifecycle
// ============================================================================

const server = app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         Trustful Agents Governance API                       ║
╠══════════════════════════════════════════════════════════════╣
║  Environment: ${NODE_ENV.padEnd(45)}║
║  Port: ${PORT.toString().padEnd(52)}║
║  CORS Origin: ${CORS_ORIGIN.substring(0, 44).padEnd(45)}║
╚══════════════════════════════════════════════════════════════╝
  `);
  
  startBackgroundTasks();
});

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  stopBackgroundTasks();
  
  server.close(async () => {
    console.log('HTTP server closed');
    
    await closePool();
    console.log('Database pool closed');
    
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
