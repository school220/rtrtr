import { Pool, PoolClient } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import { config } from '../config.js';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
}

let pgPool: Pool | null = null;
let pgliteInstance: PGlite | null = null;

export async function getDb(): Promise<DbClient> {
  if (config.databaseUrl && !config.databaseUrl.startsWith('pglite://') && !config.databaseUrl.startsWith('memory://')) {
    if (!pgPool) {
      const isLocal = config.databaseUrl.includes('localhost') || 
                      config.databaseUrl.includes('127.0.0.1') || 
                      config.databaseUrl.includes('sslmode=disable') ||
                      process.env.PGSSLMODE === 'disable';
      const ssl = isLocal ? undefined : { rejectUnauthorized: false };

      pgPool = new Pool({
        connectionString: config.databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        ssl,
      });

      pgPool.on('error', (err) => {
        console.error('⚠️ Unexpected idle PostgreSQL client error:', err.message);
      });
    }
    return {
      async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
        const res = await pgPool!.query(sql, params);
        return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
      },
      async exec(sql: string): Promise<void> {
        await pgPool!.query(sql);
      },
    };
  }

  // Fallback to PGlite (embedded Postgres engine)
  if (!pgliteInstance) {
    if (config.databaseUrl === 'memory://') {
      pgliteInstance = new PGlite();
    } else {
      const dataDir = path.resolve(process.cwd(), '.pgdata');
      pgliteInstance = new PGlite(dataDir);
    }
  }

  return {
    async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
      const res = await pgliteInstance!.query(sql, params);
      return { rows: res.rows as T[], rowCount: res.affectedRows ?? res.rows.length };
    },
    async exec(sql: string): Promise<void> {
      await pgliteInstance!.exec(sql);
    },
  };
}

export async function withTransaction<T>(callback: (client: DbClient) => Promise<T>): Promise<T> {
  if (config.databaseUrl && !config.databaseUrl.startsWith('pglite://') && !config.databaseUrl.startsWith('memory://')) {
    if (!pgPool) {
      await getDb();
    }
    const client: PoolClient = await pgPool!.connect();
    try {
      await client.query('BEGIN');
      const wrapped: DbClient = {
        async query<R = any>(sql: string, params?: any[]): Promise<QueryResult<R>> {
          const res = await client.query(sql, params);
          return { rows: res.rows as R[], rowCount: res.rowCount ?? res.rows.length };
        },
        async exec(sql: string): Promise<void> {
          await client.query(sql);
        },
      };
      const result = await callback(wrapped);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // PGlite transaction
  const db = await getDb();
  if (pgliteInstance) {
    return await pgliteInstance.transaction(async (tx) => {
      const wrapped: DbClient = {
        async query<R = any>(sql: string, params?: any[]): Promise<QueryResult<R>> {
          const res = await tx.query(sql, params);
          return { rows: res.rows as R[], rowCount: res.affectedRows ?? res.rows.length };
        },
        async exec(sql: string): Promise<void> {
          await tx.exec(sql);
        },
      };
      return await callback(wrapped);
    });
  }

  // Default fallback
  return await callback(db);
}

export async function closeDb(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  if (pgliteInstance) {
    await pgliteInstance.close();
    pgliteInstance = null;
  }
}
