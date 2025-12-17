import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const { Pool } = pg;
// ============================================================================
// Database Pool
// ============================================================================
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
// Log connection errors
pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
});
export const db = pool;
// ============================================================================
// Query Helpers
// ============================================================================
export async function query(text, params) {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
        console.log('Executed query', { text: text.substring(0, 100), duration, rows: result.rowCount });
    }
    return result;
}
export async function queryOne(text, params) {
    const result = await query(text, params);
    return result.rows[0] ?? null;
}
export async function queryMany(text, params) {
    const result = await query(text, params);
    return result.rows;
}
// ============================================================================
// Transaction Helper
// ============================================================================
export async function transaction(callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
// ============================================================================
// Migration Runner
// ============================================================================
export async function runMigrations() {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    console.log('Running database migrations...');
    try {
        await pool.query(schema);
        console.log('Database migrations completed successfully');
    }
    catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
}
// ============================================================================
// Health Check
// ============================================================================
export async function healthCheck() {
    try {
        await pool.query('SELECT 1');
        return true;
    }
    catch {
        return false;
    }
}
// ============================================================================
// Graceful Shutdown
// ============================================================================
export async function closePool() {
    await pool.end();
}
//# sourceMappingURL=index.js.map