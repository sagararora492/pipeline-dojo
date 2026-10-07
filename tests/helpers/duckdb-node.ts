import { createRequire } from 'node:module';
import path from 'node:path';
import { toResultSet } from '../../src/engines/sql/arrow';
import type { SqlRunner } from '../../src/engines/sql/types';

const require = createRequire(import.meta.url);
// The blocking Node build of the same @duckdb/duckdb-wasm package the browser
// loads, so CI checks exercises against the exact engine learners use.
const duckdb = require('@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs') as typeof import('@duckdb/duckdb-wasm/blocking');
const dist = path.dirname(require.resolve('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm'));

export async function createNodeRunner(): Promise<SqlRunner> {
  const db = await duckdb.createDuckDB(
    {
      mvp: { mainModule: path.join(dist, 'duckdb-mvp.wasm'), mainWorker: path.join(dist, 'duckdb-node-mvp.worker.cjs') },
      eh: { mainModule: path.join(dist, 'duckdb-eh.wasm'), mainWorker: path.join(dist, 'duckdb-node-eh.worker.cjs') },
    },
    new duckdb.VoidLogger(),
    duckdb.NODE_RUNTIME,
  );
  await db.instantiate();
  const conn = db.connect();
  return {
    exec: async (sql) => void conn.query(sql),
    query: async (sql) => toResultSet(conn.query(sql)),
  };
}
