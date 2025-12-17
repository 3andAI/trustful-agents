import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
/**
 * Requires a valid session token in the Authorization header
 * Sets req.session with { address, sessionId }
 */
export declare function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
/**
 * Requires the authenticated user to be a Safe multisig owner
 * Must be used after requireAuth
 */
export declare function requireSafeOwner(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
/**
 * Optional authentication - sets req.session if valid token provided
 * Does not reject requests without tokens
 */
export declare function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.d.ts.map