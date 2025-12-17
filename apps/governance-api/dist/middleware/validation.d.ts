import type { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
export declare function validateBody<T>(schema: ZodSchema<T>): (req: Request, res: Response, next: NextFunction) => void;
export declare function validateQuery<T>(schema: ZodSchema<T>): (req: Request, res: Response, next: NextFunction) => void;
export declare function validateParams<T>(schema: ZodSchema<T>): (req: Request, res: Response, next: NextFunction) => void;
export declare const ethereumAddress: z.ZodString;
export declare const bytes32: z.ZodString;
export declare const paginationSchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    offset: number;
}, {
    limit?: number | undefined;
    offset?: number | undefined;
}>;
export declare const loginSchema: z.ZodObject<{
    message: z.ZodString;
    signature: z.ZodString;
}, "strip", z.ZodTypeAny, {
    signature: string;
    message: string;
}, {
    signature: string;
    message: string;
}>;
export declare const updateProfileSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    email?: string | undefined;
}, {
    name?: string | undefined;
    email?: string | undefined;
}>;
export declare const addMemberSchema: z.ZodObject<{
    address: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    address: string;
    name?: string | undefined;
    description?: string | undefined;
    email?: string | undefined;
}, {
    address: string;
    name?: string | undefined;
    description?: string | undefined;
    email?: string | undefined;
}>;
export declare const updateMemberSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
    email?: string | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
    email?: string | undefined;
}>;
export declare const reassignAgentSchema: z.ZodObject<{
    newCouncilId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    newCouncilId: string;
}, {
    newCouncilId: string;
}>;
export declare const proposeTransactionSchema: z.ZodObject<{
    to: z.ZodString;
    data: z.ZodString;
    value: z.ZodDefault<z.ZodString>;
    description: z.ZodString;
}, "strip", z.ZodTypeAny, {
    to: string;
    value: string;
    data: string;
    description: string;
}, {
    to: string;
    data: string;
    description: string;
    value?: string | undefined;
}>;
export declare const councilIdParamSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const memberAddressParamSchema: z.ZodObject<{
    id: z.ZodString;
    address: z.ZodString;
}, "strip", z.ZodTypeAny, {
    address: string;
    id: string;
}, {
    address: string;
    id: string;
}>;
export declare const agentIdParamSchema: z.ZodObject<{
    id: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: number;
}, {
    id: number;
}>;
export declare const safeTxHashParamSchema: z.ZodObject<{
    safeTxHash: z.ZodString;
}, "strip", z.ZodTypeAny, {
    safeTxHash: string;
}, {
    safeTxHash: string;
}>;
//# sourceMappingURL=validation.d.ts.map