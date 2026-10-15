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

/**
 * Make a DuckDB error message read well for a learner.
 *
 * - DuckDB 1.4.3 prints the "LINE n: … ^" context twice for parser errors, so
 *   drop any block that repeats the one before it.
 * - `lineOffset` lines of wrapper SQL come before the learner's query, so
 *   shift line numbers back by that much, moving the caret by however many
 *   characters the shorter number frees up.
 */
export function cleanErrorMessage(message: string, lineOffset = 0): string {
  const blocks = message.split('\n\n').filter((block, i, all) => i === 0 || block !== all[i - 1]);
  return blocks
    .join('\n\n')
    .replace(/^LINE (\d+): (.*)\n( *)\^/gm, (_, line: string, text: string, indent: string) => {
      const shifted = String(Math.max(1, Number(line) - lineOffset));
      const caretIndent = indent.slice(line.length - shifted.length);
      return `LINE ${shifted}: ${text}\n${caretIndent}^`;
    });
}

/** "1 row", "3 rows". */
function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** Introduce sample rows: all of them after a colon, or a few "for example". */
function listRows(rows: (string | null)[][]): string {
  const shown = rows.slice(0, SAMPLE_ROWS).map(formatRow).join(', ');
  return rows.length <= SAMPLE_ROWS ? `: ${shown}.` : `, for example ${shown}.`;
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
    const query = normaliseQuery(sql);
    try {
      await runner.exec(`CREATE TEMP VIEW __answer AS ${query}`);
    } catch (error) {
      // normaliseQuery puts the query on line 2, after the CREATE VIEW line.
      throw new Error(cleanErrorMessage(error instanceof Error ? error.message : String(error), 1));
    }
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
      `Expected ${plural(expected.columns.length, 'column')} (${expected.columns.join(', ')}) but got ${actual.columns.length} (${actual.columns.join(', ')}).`,
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
    reasons.push(`Expected ${plural(expected.rows.length, 'row')} but got ${actual.rows.length}.`);
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
    const verb = missing.length === 1 ? 'is' : 'are';
    reasons.push(`${plural(missing.length, 'expected row')} ${verb} missing${listRows(missing)}`);
  }
  if (extra.length > 0) {
    reasons.push(`${plural(extra.length, 'row')} shouldn't be there${listRows(extra)}`);
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
