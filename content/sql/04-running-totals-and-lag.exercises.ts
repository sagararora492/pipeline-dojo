import { defineSqlExercises } from '../../src/engines/sql/types';

const setup = `
CREATE TABLE payments (
  payment_id INTEGER,
  account_id VARCHAR,
  paid_on    DATE,
  amount     DECIMAL(8, 2)
);

INSERT INTO payments VALUES
  (1, 'A', DATE '2024-07-01', 100.00),
  -- Two payments on the same day: a tie in paid_on.
  (2, 'A', DATE '2024-07-03',  40.00),
  (3, 'A', DATE '2024-07-03',  60.00),
  (4, 'A', DATE '2024-07-05',  25.00),
  (5, 'B', DATE '2024-07-02', 500.00),
  (6, 'B', DATE '2024-07-04', 250.00);
`;

export const exercises = defineSqlExercises({
  'sql-running-total-per-account': {
    title: 'Running total per account',
    setup,
    starter: `SELECT payment_id, account_id, amount,
       sum(amount) OVER (PARTITION BY account_id ORDER BY paid_on) AS running_total
FROM payments
`,
    reference: `
      SELECT payment_id, account_id, amount,
             sum(amount) OVER (
               PARTITION BY account_id
               ORDER BY paid_on, payment_id
               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
             ) AS running_total
      FROM payments`,
    hints: [
      'Run the starter query and compare the running_total of payments 2 and 3. They were paid on the same day.',
      'With ORDER BY and no frame, the sum covers the current row and every row tied with it. Payments 2 and 3 are tied on paid_on.',
      'Add payment_id to the ORDER BY so no two rows tie, and say ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW so the frame stops at the current row.',
    ],
    wrongAnswers: [
      {
        why: 'The default RANGE frame includes peers, so payments 2 and 3 (same paid_on) both show 200.00.',
        sql: `SELECT payment_id, account_id, amount,
                     sum(amount) OVER (PARTITION BY account_id ORDER BY paid_on)
              FROM payments`,
      },
      {
        why: 'Without PARTITION BY the total runs across both accounts.',
        sql: `SELECT payment_id, account_id, amount,
                     sum(amount) OVER (ORDER BY paid_on, payment_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
              FROM payments`,
      },
      {
        why: 'Without ORDER BY the frame is the whole partition, so every row shows its account total.',
        sql: `SELECT payment_id, account_id, amount,
                     sum(amount) OVER (PARTITION BY account_id)
              FROM payments`,
      },
      {
        why: 'Descending order accumulates from the newest payment backwards.',
        sql: `SELECT payment_id, account_id, amount,
                     sum(amount) OVER (PARTITION BY account_id ORDER BY paid_on DESC, payment_id DESC
                                       ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
              FROM payments`,
      },
    ],
  },

  'sql-daily-change-per-account': {
    title: 'Change from the previous payment day',
    setup,
    starter: `SELECT account_id, paid_on,
       sum(amount) AS day_total
FROM payments
GROUP BY account_id, paid_on
-- add change_from_previous: day_total minus the account's previous day_total
`,
    reference: `
      SELECT account_id, paid_on,
             sum(amount) AS day_total,
             sum(amount) - lag(sum(amount)) OVER (PARTITION BY account_id ORDER BY paid_on) AS change_from_previous
      FROM payments
      GROUP BY account_id, paid_on`,
    hints: [
      'lag(x) OVER (PARTITION BY … ORDER BY …) returns x from the previous row of the same partition.',
      'Window functions run after GROUP BY, so you can take the lag of an aggregate: lag(sum(amount)) OVER (…).',
      'Leave the first day of each account as NULL. There is no previous day, which is different from a change of 0.',
    ],
    wrongAnswers: [
      {
        why: 'Without PARTITION BY, account B’s first day is compared with account A’s previous day.',
        sql: `SELECT account_id, paid_on, sum(amount),
                     sum(amount) - lag(sum(amount)) OVER (ORDER BY paid_on)
              FROM payments GROUP BY account_id, paid_on`,
      },
      {
        why: 'Without GROUP BY there is one row per payment, not one per day, and the two payments on 2024-07-03 are compared with each other.',
        sql: `SELECT account_id, paid_on, amount,
                     amount - lag(amount) OVER (PARTITION BY account_id ORDER BY paid_on, payment_id)
              FROM payments`,
      },
      {
        why: 'lead() looks at the next day instead of the previous one.',
        sql: `SELECT account_id, paid_on, sum(amount),
                     sum(amount) - lead(sum(amount)) OVER (PARTITION BY account_id ORDER BY paid_on)
              FROM payments GROUP BY account_id, paid_on`,
      },
      {
        why: 'A default of 0 turns "no previous day" into a change equal to the whole first day’s total.',
        sql: `SELECT account_id, paid_on, sum(amount),
                     sum(amount) - lag(sum(amount), 1, 0) OVER (PARTITION BY account_id ORDER BY paid_on)
              FROM payments GROUP BY account_id, paid_on`,
      },
      {
        why: 'coalesce(…, 0) makes the first day look like a real change of 0.00, the same as account A on 2024-07-03.',
        sql: `SELECT account_id, paid_on, sum(amount),
                     coalesce(sum(amount) - lag(sum(amount)) OVER (PARTITION BY account_id ORDER BY paid_on), 0)
              FROM payments GROUP BY account_id, paid_on`,
      },
    ],
  },
});
