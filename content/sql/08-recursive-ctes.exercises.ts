import { defineSqlExercises } from '../../src/engines/sql/types';

const setup = `
CREATE TABLE dependencies (
  upstream_table   VARCHAR,
  downstream_table VARCHAR
);

INSERT INTO dependencies VALUES
  ('raw_orders',    'stg_orders'),
  ('raw_customers', 'stg_customers'),
  ('stg_orders',    'fct_orders'),
  ('stg_customers', 'fct_orders'),
  ('stg_customers', 'dim_customers'),
  ('fct_orders',    'rpt_revenue'),
  ('dim_customers', 'rpt_revenue'),
  -- A shortcut: the report also reads the staging table directly.
  ('stg_orders',    'rpt_revenue');
`;

export const exercises = defineSqlExercises({
  'sql-downstream-tables': {
    title: 'Everything downstream of a table',
    setup,
    starter: `SELECT downstream_table AS table_name
FROM dependencies
WHERE upstream_table = 'raw_customers'
`,
    reference: `
      WITH RECURSIVE reachable(table_name) AS (
        SELECT downstream_table
        FROM dependencies
        WHERE upstream_table = 'raw_customers'
        UNION
        SELECT d.downstream_table
        FROM dependencies AS d
        JOIN reachable AS r ON d.upstream_table = r.table_name
      )
      SELECT table_name FROM reachable`,
    hints: [
      'The starter finds only the tables one step away. A recursive CTE repeats that step from each table it finds.',
      'Start with the direct children of raw_customers. In the recursive part, join dependencies to the CTE itself to find the children of everything found so far.',
      'rpt_revenue can be reached through fct_orders and through dim_customers. Use UNION, not UNION ALL, so it’s returned once.',
    ],
    wrongAnswers: [
      {
        why: 'UNION ALL keeps one row per path, and rpt_revenue is reached by two paths, so it appears twice.',
        sql: `WITH RECURSIVE reachable(table_name) AS (
                SELECT downstream_table FROM dependencies WHERE upstream_table = 'raw_customers'
                UNION ALL
                SELECT d.downstream_table FROM dependencies d JOIN reachable r ON d.upstream_table = r.table_name)
              SELECT table_name FROM reachable`,
      },
      {
        why: 'Without recursion only the direct children come back.',
        sql: `SELECT downstream_table FROM dependencies WHERE upstream_table = 'raw_customers'`,
      },
      {
        why: 'Starting from the table itself includes raw_customers in its own downstream list.',
        sql: `WITH RECURSIVE reachable(table_name) AS (
                SELECT 'raw_customers'
                UNION
                SELECT d.downstream_table FROM dependencies d JOIN reachable r ON d.upstream_table = r.table_name)
              SELECT table_name FROM reachable`,
      },
      {
        why: 'Joining on the downstream column walks the graph backwards, towards the sources.',
        sql: `WITH RECURSIVE reachable(table_name) AS (
                SELECT downstream_table FROM dependencies WHERE upstream_table = 'raw_customers'
                UNION
                SELECT d.upstream_table FROM dependencies d JOIN reachable r ON d.downstream_table = r.table_name)
              SELECT table_name FROM reachable`,
      },
    ],
  },

  'sql-downstream-depth': {
    title: 'How many steps downstream',
    setup,
    starter: `WITH RECURSIVE reachable(table_name, depth) AS (
  SELECT downstream_table, 1
  FROM dependencies
  WHERE upstream_table = 'raw_orders'
  UNION ALL
  SELECT d.downstream_table, r.depth + 1
  FROM dependencies AS d
  JOIN reachable AS r ON d.upstream_table = r.table_name
)
SELECT table_name, depth
FROM reachable
`,
    reference: `
      WITH RECURSIVE reachable(table_name, depth) AS (
        SELECT downstream_table, 1
        FROM dependencies
        WHERE upstream_table = 'raw_orders'
        UNION ALL
        SELECT d.downstream_table, r.depth + 1
        FROM dependencies AS d
        JOIN reachable AS r ON d.upstream_table = r.table_name
      )
      SELECT table_name, min(depth) AS depth
      FROM reachable
      GROUP BY table_name`,
    hints: [
      'Run the starter. rpt_revenue appears twice, because it can be reached in 2 steps and in 3.',
      'Changing UNION ALL to UNION doesn’t help here: (rpt_revenue, 2) and (rpt_revenue, 3) are different rows.',
      'Keep one row per table in the final SELECT, with the smallest depth.',
    ],
    wrongAnswers: [
      {
        why: 'One row per path: rpt_revenue appears at depth 2 and at depth 3.',
        sql: `WITH RECURSIVE reachable(table_name, depth) AS (
                SELECT downstream_table, 1 FROM dependencies WHERE upstream_table = 'raw_orders'
                UNION ALL
                SELECT d.downstream_table, r.depth + 1 FROM dependencies d JOIN reachable r ON d.upstream_table = r.table_name)
              SELECT table_name, depth FROM reachable`,
      },
      {
        why: 'UNION only removes rows that are identical in every column, and the two rpt_revenue rows differ in depth.',
        sql: `WITH RECURSIVE reachable(table_name, depth) AS (
                SELECT downstream_table, 1 FROM dependencies WHERE upstream_table = 'raw_orders'
                UNION
                SELECT d.downstream_table, r.depth + 1 FROM dependencies d JOIN reachable r ON d.upstream_table = r.table_name)
              SELECT table_name, depth FROM reachable`,
      },
      {
        why: 'max(depth) reports the longest path to rpt_revenue, 3 steps, instead of the shortest.',
        sql: `WITH RECURSIVE reachable(table_name, depth) AS (
                SELECT downstream_table, 1 FROM dependencies WHERE upstream_table = 'raw_orders'
                UNION ALL
                SELECT d.downstream_table, r.depth + 1 FROM dependencies d JOIN reachable r ON d.upstream_table = r.table_name)
              SELECT table_name, max(depth) FROM reachable GROUP BY table_name`,
      },
      {
        why: 'Starting the count at 0 makes every depth one too small.',
        sql: `WITH RECURSIVE reachable(table_name, depth) AS (
                SELECT downstream_table, 0 FROM dependencies WHERE upstream_table = 'raw_orders'
                UNION ALL
                SELECT d.downstream_table, r.depth + 1 FROM dependencies d JOIN reachable r ON d.upstream_table = r.table_name)
              SELECT table_name, min(depth) FROM reachable GROUP BY table_name`,
      },
    ],
  },
});
