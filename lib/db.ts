import { Pool, type PoolClient, type QueryResult } from 'pg';

/**
 * PostgreSQL client singleton with connection pooling.
 * Reuses the same pool across hot reloads in Next.js dev mode.
 * Connects to DATABASE_URL from environment.
 */

const globalForDb = globalThis as unknown as {
  pgPool: Pool | undefined;
};

const pool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pgPool = pool;
}

/**
 * PostgreSQL database access layer.
 *
 * Usage:
 *   const result = await db.query('SELECT * FROM rooms WHERE room_id = $1', [roomId]);
 *   const rows = result.rows;
 *
 * Transaction usage:
 *   const total = await db.withTransaction(async (client) => {
 *     await client.query('UPDATE rooms SET status = $1 WHERE room_id = $2', ['live', id]);
 *     await client.query('INSERT INTO room_events ...');
 *     return 'ok';
 *   });
 */
export const db = {
  /** Execute a parameterised SQL query against the pool. */
  query: <T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> => {
    return pool.query<T>(sql, params);
  },

  /** Get a raw pool client — caller MUST call client.release(). */
  getClient: (): Promise<PoolClient> => {
    return pool.connect();
  },

  /**
   * Run a function inside a database transaction.
   * Automatically calls BEGIN, COMMIT on success, ROLLBACK on error.
   * Returns whatever the callback returns.
   */
  withTransaction: async <T>(
    fn: (client: PoolClient) => Promise<T>
  ): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  pool,
};
