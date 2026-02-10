import { Router } from 'express';
import type { Request, Response } from 'express';
import { SiweMessage } from 'siwe';
import type { AuthenticatedRequest } from '../types/index.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { loginSchema, updateProfileSchema } from '../middleware/validation.js';
import {
  createNonce,
  verifySiweMessage,
  createSession,
  deleteSession,
  getGovernanceSigner,
  upsertGovernanceSigner,
  updateGovernanceSignerProfile,
} from '../services/auth.js';
import { isSafeOwner } from '../services/safe.js';

const router = Router();

// ============================================================================
// Configuration
// ============================================================================

import { CHAIN_ID, DOMAIN } from '../config/index.js';

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /auth/nonce
 * Get a nonce for SIWE message
 */
router.get('/nonce', (_req: Request, res: Response) => {
  try {
    const nonce = createNonce();
    res.json({ nonce });
  } catch (error) {
    console.error('Nonce generation error:', error);
    res.status(500).json({ error: 'Failed to generate nonce' });
  }
});

/**
 * POST /auth/login
 * Verify SIWE message and create session
 */
router.post(
  '/login',
  validateBody(loginSchema),
  async (req: Request, res: Response) => {
    try {
      const { message, signature } = req.body;
      
      // Verify SIWE message
      const result = await verifySiweMessage(message, signature, DOMAIN, CHAIN_ID);
      
      if (!result.success || !result.address) {
        res.status(401).json({ error: result.error || 'Authentication failed' });
        return;
      }
      
      // Check if user is a Safe owner (required for governance)
      const isOwner = await isSafeOwner(result.address);
      if (!isOwner) {
        res.status(403).json({ 
          error: 'Access denied. Only Safe multisig owners can access the governance dashboard.',
        });
        return;
      }
      
      // Create/update signer record
      await upsertGovernanceSigner(result.address);
      
      // Extract nonce from SIWE message for session
      const siweMessage = new SiweMessage(message);
      
      // Create session
      const session = await createSession(result.address, siweMessage.nonce);
      
      res.json({
        token: session.id,
        address: result.address,
        expiresAt: session.expires_at.toISOString(),
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

/**
 * POST /auth/logout
 * Invalidate current session
 */
router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.session) {
      await deleteSession(req.session.sessionId);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * GET /auth/me
 * Get current user profile
 */
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.session) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    const signer = await getGovernanceSigner(req.session.address);
    const isOwner = await isSafeOwner(req.session.address);
    
    res.json({
      address: req.session.address,
      name: signer?.name ?? null,
      email: signer?.email ?? null,
      isSafeSigner: isOwner,
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * PUT /auth/me
 * Update current user profile
 */
router.put(
  '/me',
  requireAuth,
  validateBody(updateProfileSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.session) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      
      const { name, email } = req.body;
      
      const updated = await updateGovernanceSignerProfile(req.session.address, {
        name,
        email,
      });
      
      if (!updated) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }
      
      res.json({
        address: updated.address,
        name: updated.name,
        email: updated.email,
      });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

export default router;
