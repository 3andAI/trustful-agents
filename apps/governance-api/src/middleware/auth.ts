import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { getSession } from '../services/auth.js';
import { isSafeOwner } from '../services/safe.js';

// ============================================================================
// Authentication Middleware
// ============================================================================

/**
 * Requires a valid session token in the Authorization header
 * Sets req.session with { address, sessionId }
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }
    
    const token = authHeader.slice(7); // Remove 'Bearer '
    
    const session = await getSession(token);
    
    if (!session) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }
    
    req.session = {
      address: session.address,
      sessionId: session.id,
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Requires the authenticated user to be a Safe multisig owner
 * Must be used after requireAuth
 */
export async function requireSafeOwner(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.session) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    const isOwner = await isSafeOwner(req.session.address);
    
    if (!isOwner) {
      res.status(403).json({ error: 'Not a Safe multisig owner' });
      return;
    }
    
    next();
  } catch (error) {
    console.error('Safe owner check error:', error);
    res.status(500).json({ error: 'Authorization error' });
  }
}

/**
 * Optional authentication - sets req.session if valid token provided
 * Does not reject requests without tokens
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const session = await getSession(token);
      
      if (session) {
        req.session = {
          address: session.address,
          sessionId: session.id,
        };
      }
    }
    
    next();
  } catch (error) {
    // Don't fail on optional auth errors
    console.error('Optional auth error:', error);
    next();
  }
}
