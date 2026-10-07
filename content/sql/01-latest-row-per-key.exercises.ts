import { defineSqlExercises } from '../../src/engines/sql/types';

const setup = `
CREATE TABLE order_changes (
  order_id   INTEGER,
  status     VARCHAR,
  amount     DECIMAL(8, 2),
  updated_at TIMESTAMP
);

INSERT INTO order_changes VALUES
  (1, 'placed',    40.00, TIMESTAMP '2024-05-01 09:00:00'),
  (1, 'shipped',   40.00, TIMESTAMP '2024-05-02 14:30:00'),
  (1, 'cancelled', 40.00, TIMESTAMP '2024-05-03 08:15:00'),
  (2, 'placed',    15.50, TIMESTAMP '2024-05-01 10:00:00'),
  (2, 'placed',    18.00, TIMESTAMP '2024-05-01 10:05:00'),
  -- The same change delivered twice, as at-least-once pipelines do.
  (2, 'placed',    18.00, TIMESTAMP '2024-05-01 10:05:00'),
  (3, 'placed',    99.99, TIMESTAMP '2024-05-04 16:45:00');
`;

export const exercises = defineSqlExercises({
  'sql-latest-order-state': {
    title: 'Current state of each order',
    setup,
    starter: `SELECT *\nFROM order_changes\n-- keep only the latest change for each order_id\n`,
    reference: `
      SELECT order_id, status, amount, updated_at
      FROM order_changes
      QUALIFY row_number() OVER (PARTITION BY order_id ORDER BY updated_at DESC) = 1`,
    hints: [
      'Number the changes within each order, newest first. Which window function does that?',
      'row_number() OVER (PARTITION BY order_id ORDER BY updated_at DESC) gives the newest change the number 1.',
      'Filter on the window function with QUALIFY, or compute it in a subquery and filter in the outer WHERE.',
    ],
    wrongAnswers: [
      {
        why: 'MAX on each column mixes values from different rows: max(status) is "shipped" for order 1, not its latest status.',
        sql: `SELECT order_id, max(status), max(amount), max(updated_at) FROM order_changes GROUP BY order_id`,
      },
      {
        why: 'DISTINCT removes the duplicate delivery but keeps every older change.',
        sql: `SELECT DISTINCT * FROM order_changes`,
      },
      {
        why: 'Ascending order keeps the first change instead of the latest.',
        sql: `SELECT * FROM order_changes QUALIFY row_number() OVER (PARTITION BY order_id ORDER BY updated_at) = 1`,
      },
      {
        why: 'Without PARTITION BY there is one ranking for the whole table, so only one row survives.',
        sql: `SELECT * FROM order_changes QUALIFY row_number() OVER (ORDER BY updated_at DESC) = 1`,
      },
      {
        why: 'rank() gives both copies of the duplicated latest change rank 1, so order 2 appears twice.',
        sql: `SELECT * FROM order_changes QUALIFY rank() OVER (PARTITION BY order_id ORDER BY updated_at DESC) = 1`,
      },
    ],
  },
});
