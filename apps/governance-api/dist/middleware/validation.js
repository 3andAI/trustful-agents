import { z, ZodError } from 'zod';
// ============================================================================
// Validation Middleware Factory
// ============================================================================
export function validateBody(schema) {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({
                    error: 'Validation error',
                    details: error.errors.map((e) => ({
                        field: e.path.join('.'),
                        message: e.message,
                    })),
                });
                return;
            }
            next(error);
        }
    };
}
export function validateQuery(schema) {
    return (req, res, next) => {
        try {
            req.query = schema.parse(req.query);
            next();
        }
        catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({
                    error: 'Validation error',
                    details: error.errors.map((e) => ({
                        field: e.path.join('.'),
                        message: e.message,
                    })),
                });
                return;
            }
            next(error);
        }
    };
}
export function validateParams(schema) {
    return (req, res, next) => {
        try {
            req.params = schema.parse(req.params);
            next();
        }
        catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({
                    error: 'Validation error',
                    details: error.errors.map((e) => ({
                        field: e.path.join('.'),
                        message: e.message,
                    })),
                });
                return;
            }
            next(error);
        }
    };
}
// ============================================================================
// Common Schemas
// ============================================================================
export const ethereumAddress = z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');
export const bytes32 = z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid bytes32 value');
export const paginationSchema = z.object({
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
});
// ============================================================================
// Request Schemas
// ============================================================================
export const loginSchema = z.object({
    message: z.string().min(1, 'Message is required'),
    signature: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid signature'),
});
export const updateProfileSchema = z.object({
    name: z.string().max(255).optional(),
    email: z.string().email().max(255).optional(),
});
export const addMemberSchema = z.object({
    address: ethereumAddress,
    name: z.string().max(255).optional(),
    description: z.string().max(1000).optional(),
    email: z.string().email().max(255).optional(),
});
export const updateMemberSchema = z.object({
    name: z.string().max(255).optional(),
    description: z.string().max(1000).optional(),
    email: z.string().email().max(255).optional(),
});
export const reassignAgentSchema = z.object({
    newCouncilId: bytes32,
});
export const proposeTransactionSchema = z.object({
    to: ethereumAddress,
    data: z.string().regex(/^0x[a-fA-F0-9]*$/, 'Invalid hex data'),
    value: z.string().regex(/^\d+$/, 'Invalid value').default('0'),
    description: z.string().max(500),
});
// ============================================================================
// Parameter Schemas
// ============================================================================
export const councilIdParamSchema = z.object({
    id: bytes32,
});
export const memberAddressParamSchema = z.object({
    id: bytes32,
    address: ethereumAddress,
});
export const agentIdParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});
export const safeTxHashParamSchema = z.object({
    safeTxHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
});
//# sourceMappingURL=validation.js.map