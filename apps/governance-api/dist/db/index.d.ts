import pg, { QueryResultRow } from 'pg';
export declare const pool: import("pg").Pool;
export declare const db: import("pg").Pool;
export declare function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<pg.QueryResult<T>>;
export declare function queryOne<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<T | null>;
export declare function queryMany<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<T[]>;
export declare function transaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T>;
export declare function runMigrations(): Promise<void>;
export declare function healthCheck(): Promise<boolean>;
export declare function closePool(): Promise<void>;
//# sourceMappingURL=index.d.ts.map