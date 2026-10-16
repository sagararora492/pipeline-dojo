import * as duckdb from '@duckdb/duckdb-wasm';
// Bundled by Vite and served from this site, never from a CDN, so a clone
// works offline.
import mvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import { toResultSet } from './arrow';
import type { SqlRunner } from './types';

// Absolute URLs, because the worker below runs from a blob: URL, which
// relative paths can't be resolved against.
const absolute = (url: string) => new URL(url, document.baseURI).href;

const bundles: duckdb.DuckDBBundles = {
  mvp: { mainModule: absolute(mvpWasm), mainWorker: absolute(mvpWorker) },
  eh: { mainModule: absolute(ehWasm), mainWorker: absolute(ehWorker) },
};

/**
 * Start the worker from a blob: URL that imports the real worker script.
 *
 * A worker started from its own URL takes its Content Security Policy from
 * that file's response headers, and GitHub Pages sends none, so learner SQL
 * such as read_text('https://…') could reach any site. A blob: worker
 * inherits this page's policy instead (set in vite.config.ts), so its
 * connect-src 'self' applies to DuckDB's own network requests.
 */
function createWorker(scriptUrl: string): { worker: Worker; release: () => void } {
  const source = `importScripts(${JSON.stringify(scriptUrl)});`;
  const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  return { worker: new Worker(blobUrl), release: () => URL.revokeObjectURL(blobUrl) };
}

async function start(): Promise<SqlRunner> {
  const bundle = await duckdb.selectBundle(bundles);
  const { worker, release } = createWorker(bundle.mainWorker!);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker).finally(release);
  const conn = await db.connect();

  // Send statements to the worker one at a time. Whole sandboxes are
  // serialised separately, in check.ts.
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
