import { readdirSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { checkSqlAnswer } from '../src/engines/sql/check';
import type { SqlExercise, SqlRunner } from '../src/engines/sql/types';
import { createNodeRunner } from './helpers/duckdb-node';

const contentDir = path.resolve(__dirname, '../content');
const files = readdirSync(contentDir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.exercises.ts'));

const modules = await Promise.all(
  files.map(async (f) => ({
    file: f,
    exercises: Object.values(((await import(path.join(contentDir, f))) as { exercises: Record<string, SqlExercise> }).exercises),
  })),
);
const all = modules.flatMap((m) => m.exercises.map((exercise) => ({ file: m.file, exercise })));

let runner: SqlRunner;
let engineVersion: string;
beforeAll(async () => {
  runner = await createNodeRunner();
  engineVersion = (await runner.query('SELECT version()')).rows[0]![0]!;
});

it('exercise ids are unique', () => {
  const ids = all.map((e) => e.exercise.id);
  expect(new Set(ids).size).toBe(ids.length);
});

describe.each(all.map((e) => [e.exercise.id, e] as const))('%s', (_, { exercise }) => {
  it('has at least one known-wrong answer', () => {
    expect(exercise.wrongAnswers.length).toBeGreaterThan(0);
  });

  it('accepts the reference solution', async () => {
    const result = await checkSqlAnswer(runner, exercise, exercise.reference);
    expect(result.status, JSON.stringify(result)).toBe('correct');
  });

  it('returns a non-empty reference result', async () => {
    const result = await checkSqlAnswer(runner, exercise, exercise.reference);
    expect(result.status === 'correct' && result.actual.rows.length).toBeGreaterThan(0);
  });

  it.each(exercise.wrongAnswers.map((w) => [w.why, w] as const))('rejects: %s', async (_, wrong) => {
    const result = await checkSqlAnswer(runner, exercise, wrong.sql);
    // A wrong answer must be valid SQL that returns the wrong rows. A syntax
    // error would pass this test without proving the checker catches anything.
    expect(result.status, JSON.stringify(result)).toBe('incorrect');
  });

  it('does not accept the starter code', async () => {
    const result = await checkSqlAnswer(runner, exercise, exercise.starter);
    expect(result.status).not.toBe('correct');
  });
});

describe('verified_against', () => {
  it('names the DuckDB version CI runs', async () => {
    const { readFileSync } = await import('node:fs');
    const lessons = new Set(modules.map((m) => m.file.replace(/\.exercises\.ts$/, '.mdx')));
    for (const lesson of lessons) {
      const text = readFileSync(path.join(contentDir, lesson), 'utf8');
      const declared = /^\s+duckdb:\s*(\S+)/m.exec(text)?.[1];
      expect(`v${declared}`, `${lesson} says duckdb ${declared}; CI runs ${engineVersion}`).toBe(engineVersion);
    }
  });
});
