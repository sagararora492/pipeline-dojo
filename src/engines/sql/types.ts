/** A query result with every value rendered as DuckDB's own VARCHAR cast. */
export interface ResultSet {
  columns: string[];
  rows: (string | null)[][];
}

/**
 * The minimum the checker needs from a DuckDB connection. The browser
 * implements it with the async worker API and the tests with the blocking
 * Node API, so both run the same engine build.
 */
export interface SqlRunner {
  /** Run one or more statements and discard any results. */
  exec(sql: string): Promise<void>;
  /** Run a single query and return its rows. */
  query(sql: string): Promise<ResultSet>;
}

export interface WrongAnswer {
  sql: string;
  /** Why this answer is wrong. Shown in the test report, not to learners. */
  why: string;
}

export interface SqlExercise {
  id: string;
  title: string;
  /** Statements that create and fill the exercise tables. */
  setup: string;
  /** Initial editor contents. */
  starter: string;
  /** A query known to produce the correct result. */
  reference: string;
  /** Answers that look plausible but must be rejected. At least one. */
  wrongAnswers: WrongAnswer[];
  /** Compare rows in order. Only set this when the task asks for an ORDER BY. */
  ordered?: boolean;
  /** Also require the learner's column names to match the reference. */
  checkColumnNames?: boolean;
  hints?: string[];
}

export function defineSqlExercises<const T extends Record<string, Omit<SqlExercise, 'id'>>>(
  exercises: T,
): { [K in keyof T]: SqlExercise } {
  return Object.fromEntries(
    Object.entries(exercises).map(([id, ex]) => [id, { id, ...ex }]),
  ) as { [K in keyof T]: SqlExercise };
}
