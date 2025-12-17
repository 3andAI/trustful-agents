import type { EmailQueueItem, EmailTemplate } from '../types/index.js';
export declare function queueEmail(recipientEmail: string, template: EmailTemplate, variables: Record<string, string>, scheduledAt?: Date): Promise<EmailQueueItem>;
export declare function getPendingEmails(limit?: number): Promise<EmailQueueItem[]>;
export declare function markEmailSent(id: number): Promise<void>;
export declare function markEmailFailed(id: number, error: string): Promise<void>;
export declare function sendEmail(to: string, template: EmailTemplate, variables: Record<string, string>): Promise<boolean>;
export declare function processEmailQueue(): Promise<number>;
export declare function notifyAllSigners(template: EmailTemplate, variables: Record<string, string>, excludeAddress?: string): Promise<number>;
export declare function notifyCouncilMembers(councilId: string, template: EmailTemplate, variables: Record<string, string>, excludeAddress?: string): Promise<number>;
export declare function healthCheck(): Promise<boolean>;
//# sourceMappingURL=email.d.ts.map