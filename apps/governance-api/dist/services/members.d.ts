import type { CouncilMember, AuditAction } from '../types/index.js';
export declare function getCouncilMember(councilId: string, address: string): Promise<CouncilMember | null>;
export declare function getCouncilMembers(councilId: string): Promise<CouncilMember[]>;
export declare function getMembersByAddress(address: string): Promise<CouncilMember[]>;
export declare function createCouncilMember(councilId: string, address: string, name?: string, description?: string, email?: string): Promise<CouncilMember>;
export declare function updateCouncilMember(councilId: string, address: string, updates: {
    name?: string;
    description?: string;
    email?: string;
}): Promise<CouncilMember | null>;
export declare function deleteCouncilMember(councilId: string, address: string): Promise<boolean>;
export declare function deleteAllCouncilMembers(councilId: string): Promise<number>;
export declare function logAuditEvent(action: AuditAction, actorAddress: string, targetType: 'council' | 'member' | 'agent' | 'safe_tx', targetId: string, metadata?: Record<string, unknown>): Promise<void>;
export declare function getAuditLogs(filters?: {
    action?: AuditAction;
    actorAddress?: string;
    targetType?: string;
    targetId?: string;
    limit?: number;
    offset?: number;
}): Promise<Array<{
    id: number;
    action: AuditAction;
    actor_address: string;
    target_type: string;
    target_id: string;
    metadata: Record<string, unknown>;
    created_at: Date;
}>>;
//# sourceMappingURL=members.d.ts.map