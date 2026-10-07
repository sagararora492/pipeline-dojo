import { beforeAll, describe, expect, it } from 'vitest';
import { checkSqlAnswer, compareResults, normaliseQuery, runInSandbox } from '../src/engines/sql/check';
import type { SqlExercise, SqlRunner } from '../src/engines/sql/types';
import { createNodeRunner } from './helpers/duckdb-node';

let runner: SqlRunner;
beforeAll(async () => {
  runner = await createNodeRunner();
});

const exercise: SqlExercise = {
  id: 'test',
  title: 'test',
  setup: `CREATE TABLE t (id INTEGER, amount DECIMAL(6, 2), d DATE, tags VARCHAR[]);
          INSERT INTO t VALUES (1, 2.50, DATE '2024-01-02', ['a']), (2, NULL, NULL, []), (3, 1.00, DATE '2024-03-04', ['b', 'c']);`,
  starter: '',
  reference: 'SELECT id, amount FROM t ORDER BY id',
  wrongAnswers: [],
};

describe('normaliseQuery', () => {
  it('accepts trailing semicolons and comments', () => {
    expect(() => normaliseQuery('select 1; -- done')).not.toThrow();
    expect(() => normaliseQuery("select ';' as s;;")).not.toThrow();
  });
  it('rejects empty input and multiple statements', () => {
    expect(() => normaliseQuery('  -- nothing\n')).toThrow(/Write a query/);
    expect(() => normaliseQuery('select 1; drop table t')).toThrow(/single query/);
  });
});

describe('runInSandbox', () => {
  it('renders values as DuckDB text, keeping NULLs', async () => {
    const r = await runInSandbox(runner, exercise, 'SELECT * FROM t ORDER BY id');
    expect(r.columns).toEqual(['id', 'amount', 'd', 'tags']);
    expect(r.rows).toEqual([
      ['1', '2.50', '2024-01-02', '[a]'],
      ['2', null, null, '[]'],
      ['3', '1.00', '2024-03-04', '[b, c]'],
    ]);
  });

  it('keeps ORDER BY order through the VARCHAR projection', async () => {
    const r = await runInSandbox(runner, exercise, 'SELECT id FROM t ORDER BY id DESC');
    expect(r.rows.map((row) => row[0])).toEqual(['3', '2', '1']);
  });

  it('isolates attempts from each other', async () => {
    await expect(runInSandbox(runner, exercise, 'SELECT * FROM t')).resolves.toBeDefined();
    // A failed attempt can't leave state behind for the next one.
    await expect(runInSandbox(runner, exercise, 'SELECT * FROM missing_table')).rejects.toThrow();
    const r = await runInSandbox(runner, exercise, 'SELECT count(*) FROM t');
    expect(r.rows).toEqual([['3']]);
  });

  it('handles repeated column names', async () => {
    const r = await runInSandbox(runner, exercise, 'SELECT id, id FROM t WHERE id = 1');
    expect(r.rows).toEqual([['1', '1']]);
  });
});

describe('compareResults', () => {
  const expected = { columns: ['a'], rows: [['1'], ['1'], ['2']] };
  it('ignores order by default but counts duplicates', () => {
    expect(compareResults(expected, { columns: ['x'], rows: [['2'], ['1'], ['1']] })).toEqual([]);
    expect(compareResults(expected, { columns: ['x'], rows: [['2'], ['1']] })).not.toEqual([]);
    expect(compareResults(expected, { columns: ['x'], rows: [['2'], ['2'], ['1']] })).not.toEqual([]);
  });
  it('checks order when asked', () => {
    const reasons = compareResults(expected, { columns: ['a'], rows: [['2'], ['1'], ['1']] }, { ordered: true });
    expect(reasons.join()).toMatch(/order/);
  });
  it('checks column names only when asked', () => {
    const actual = { columns: ['b'], rows: expected.rows };
    expect(compareResults(expected, actual)).toEqual([]);
    expect(compareResults(expected, actual, { checkColumnNames: true })).not.toEqual([]);
  });
});

describe('checkSqlAnswer', () => {
  it('accepts the reference and reports SQL errors', async () => {
    expect((await checkSqlAnswer(runner, exercise, exercise.reference)).status).toBe('correct');
    const error = await checkSqlAnswer(runner, exercise, 'SELEC 1');
    expect(error.status).toBe('error');
  });
});
