import type { Session, GovernanceSigner } from '../types/index.js';
export declare function createNonce(): string;
export declare function validateNonce(nonce: string): boolean;
export interface VerifyResult {
    success: boolean;
    address?: string;
    error?: string;
}
export declare function verifySiweMessage(message: string, signature: string, expectedDomain: string, expectedChainId: number): Promise<VerifyResult>;
export declare function createSession(address: string, nonce: string): Promise<Session>;
export declare function getSession(sessionId: string): Promise<Session | null>;
export declare function deleteSession(sessionId: string): Promise<void>;
export declare function deleteAllSessionsForAddress(address: string): Promise<void>;
export declare function getGovernanceSigner(address: string): Promise<GovernanceSigner | null>;
export declare function upsertGovernanceSigner(address: string, name?: string, email?: string): Promise<GovernanceSigner>;
export declare function updateGovernanceSignerProfile(address: string, updates: {
    name?: string;
    email?: string;
}): Promise<GovernanceSigner | null>;
export declare function cleanupExpiredSessions(): Promise<number>;
//# sourceMappingURL=auth.d.ts.map