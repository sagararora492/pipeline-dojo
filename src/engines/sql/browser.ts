import * as duckdb from '@duckdb/duckdb-wasm';
// Bundled by Vite and served from this site, never from a CDN, so a clone
// works offline.
import mvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import { toResultSet } from './arrow';
import type { SqlRunner } from './types';

const bundles: duckdb.DuckDBBundles = {
  mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
  eh: { mainModule: ehWasm, mainWorker: ehWorker },
};

async function start(): Promise<SqlRunner> {
  const bundle = await duckdb.selectBundle(bundles);
  const worker = new Worker(bundle.mainWorker!);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  const conn = await db.connect();

  // The worker runs one query at a time per connection, so chain calls to
  // keep a check's statements from interleaving with another check's.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task);
    queue = next.catch(() => undefined);
    return next;
  };

  return {
    exec: (sql) => serial(async () => void (await conn.query(sql))),
    query: (sql) => serial(async () => toResultSet(await conn.query(sql))),
  };
}

let runner: Promise<SqlRunner> | undefined;

/** Start DuckDB on first use and share one instance across the page. */
export function getBrowserRunner(): Promise<SqlRunner> {
  runner ??= start().catch((error) => {
    runner = undefined;
    throw error;
  });
  return runner;
}
