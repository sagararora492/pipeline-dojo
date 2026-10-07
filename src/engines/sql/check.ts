import type { ResultSet, SqlExercise, SqlRunner } from './types';

export type CheckResult =
  | { status: 'correct'; actual: ResultSet }
  | { status: 'incorrect'; actual: ResultSet; expected: ResultSet; reasons: string[] }
  | { status: 'error'; message: string };

const SAMPLE_ROWS = 3;

/** Remove comments and string or identifier literals, keeping everything else. */
function stripLiteralsAndComments(sql: string): string {
  return sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:[^']|'')*'|"(?:[^"]|"")*"/g, ' ');
}

/**
 * Reject empty input and multiple statements. Trailing semicolons and
 * comments are fine. The query is returned on its own line so that a trailing
 * line comment can't swallow anything appended after it.
 */
export function normaliseQuery(sql: string): string {
  const code = stripLiteralsAndComments(sql).trim().replace(/;[\s;]*$/, '');
  if (code.trim() === '') throw new Error('Write a query first.');
  if (code.includes(';')) throw new Error('Submit a single query. Remove everything after the first semicolon.');
  return `\n${sql.trim()}\n`;
}

let databaseCounter = 0;
const locks = new WeakMap<SqlRunner, Promise<unknown>>();

/**
 * A sandbox switches the connection's current database with USE, so two
 * sandboxes on one connection must never interleave. Queue them per runner.
 */
function exclusive<T>(runner: SqlRunner, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(runner) ?? Promise.resolve();
  const next = previous.then(task, task);
  locks.set(runner, next.catch(() => undefined));
  return next;
}

/**
 * Run `sql` in a fresh in-memory database built from the exercise setup, so
 * one attempt can never change the data another attempt sees.
 */
export function runInSandbox(runner: SqlRunner, exercise: SqlExercise, sql: string): Promise<ResultSet> {
  return exclusive(runner, () => runInSandboxNow(runner, exercise, sql));
}

async function runInSandboxNow(runner: SqlRunner, exercise: SqlExercise, sql: string): Promise<ResultSet> {
  const name = `sandbox_${++databaseCounter}`;
  await runner.exec(`ATTACH ':memory:' AS ${name}; USE ${name};`);
  try {
    await runner.exec(exercise.setup);
    await runner.exec(`CREATE TEMP VIEW __answer AS ${normaliseQuery(sql)}`);
    // Casting to VARCHAR gives one canonical text form per value, using
    // DuckDB's own formatting, so DECIMAL, DATE and LIST values compare
    // without decoding Arrow types in JS. A projection over a view keeps the
    // view's row order; the ordered-exercise tests guard that assumption.
    const result = await runner.query('SELECT COLUMNS(*)::VARCHAR FROM __answer');
    const types = await runner.query('DESCRIBE __answer');
    return { columns: types.rows.map((r) => r[0] ?? ''), rows: result.rows };
  } finally {
    await runner.exec(`USE memory; DROP VIEW IF EXISTS temp.__answer; DETACH ${name};`);
  }
}

const rowKey = (row: (string | null)[]) => JSON.stringify(row);

function formatRow(row: (string | null)[]) {
  return `(${row.map((v) => (v === null ? 'NULL' : v)).join(', ')})`;
}

/** Compare two results and explain every difference a learner can act on. */
export function compareResults(
  expected: ResultSet,
  actual: ResultSet,
  options: { ordered?: boolean; checkColumnNames?: boolean } = {},
): string[] {
  const reasons: string[] = [];

  if (expected.columns.length !== actual.columns.length) {
    reasons.push(
      `Expected ${expected.columns.length} column(s) (${expected.columns.join(', ')}) but got ${actual.columns.length} (${actual.columns.join(', ')}).`,
    );
    return reasons;
  }
  if (options.checkColumnNames) {
    const lower = (cols: string[]) => cols.map((c) => c.toLowerCase());
    if (rowKey(lower(expected.columns)) !== rowKey(lower(actual.columns))) {
      reasons.push(`Expected columns named ${expected.columns.join(', ')} but got ${actual.columns.join(', ')}.`);
    }
  }
  if (expected.rows.length !== actual.rows.length) {
    reasons.push(`Expected ${expected.rows.length} row(s) but got ${actual.rows.length}.`);
  }

  // Multiset difference: duplicates matter, so count rows instead of using a Set.
  const counts = new Map<string, number>();
  for (const row of expected.rows) counts.set(rowKey(row), (counts.get(rowKey(row)) ?? 0) + 1);
  const extra: (string | null)[][] = [];
  for (const row of actual.rows) {
    const n = counts.get(rowKey(row)) ?? 0;
    if (n > 0) counts.set(rowKey(row), n - 1);
    else extra.push(row);
  }
  const missing = expected.rows.filter((row) => {
    const n = counts.get(rowKey(row)) ?? 0;
    if (n > 0) {
      counts.set(rowKey(row), n - 1);
      return true;
    }
    return false;
  });

  if (missing.length > 0) {
    reasons.push(
      `${missing.length} expected row(s) are missing, for example ${missing.slice(0, SAMPLE_ROWS).map(formatRow).join(', ')}.`,
    );
  }
  if (extra.length > 0) {
    reasons.push(
      `${extra.length} row(s) shouldn't be there, for example ${extra.slice(0, SAMPLE_ROWS).map(formatRow).join(', ')}.`,
    );
  }

  if (reasons.length === 0 && options.ordered) {
    const firstDiff = expected.rows.findIndex((row, i) => rowKey(row) !== rowKey(actual.rows[i] ?? []));
    if (firstDiff !== -1) {
      reasons.push(`The rows are right but the order isn't. Row ${firstDiff + 1} should be ${formatRow(expected.rows[firstDiff] ?? [])}.`);
    }
  }
  return reasons;
}

const expectedCache = new WeakMap<SqlExercise, ResultSet>();

export async function checkSqlAnswer(
  runner: SqlRunner,
  exercise: SqlExercise,
  sql: string,
): Promise<CheckResult> {
  let actual: ResultSet;
  try {
    actual = await runInSandbox(runner, exercise, sql);
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
  let expected = expectedCache.get(exercise);
  if (!expected) {
    expected = await runInSandbox(runner, exercise, exercise.reference);
    expectedCache.set(exercise, expected);
  }
  const reasons = compareResults(expected, actual, exercise);
  return reasons.length === 0
    ? { status: 'correct', actual }
    : { status: 'incorrect', actual, expected, reasons };
}
