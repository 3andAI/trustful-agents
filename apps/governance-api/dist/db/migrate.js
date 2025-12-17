import 'dotenv/config';
import { runMigrations, closePool } from './index.js';
async function main() {
    try {
        await runMigrations();
        console.log('✓ Migrations completed');
        process.exit(0);
    }
    catch (error) {
        console.error('✗ Migration failed:', error);
        process.exit(1);
    }
    finally {
        await closePool();
    }
}
main();
//# sourceMappingURL=migrate.js.map