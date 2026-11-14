import { defineSqlExercises } from '../../src/engines/sql/types';

const changesSetup = `
CREATE TABLE plan_changes (
  customer_id INTEGER,
  plan        VARCHAR,
  changed_on  DATE
);

INSERT INTO plan_changes VALUES
  (1, 'free', DATE '2024-01-10'),
  (1, 'pro',  DATE '2024-03-01'),
  (1, 'team', DATE '2024-06-15'),
  (2, 'pro',  DATE '2024-02-20'),
  (2, 'free', DATE '2024-05-05'),
  (3, 'team', DATE '2024-04-01'),
  (4, 'team', DATE '2024-01-05');
`;

// The history table the first exercise builds, used as the input of the second.
const historySetup = `
CREATE TABLE customer_plan_history (
  customer_id INTEGER,
  plan        VARCHAR,
  valid_from  DATE,
  valid_to    DATE,          -- NULL while the row is current
  is_current  BOOLEAN
);

INSERT INTO customer_plan_history VALUES
  (1, 'free', DATE '2024-01-10', DATE '2024-03-01', false),
  (1, 'pro',  DATE '2024-03-01', DATE '2024-06-15', false),
  (1, 'team', DATE '2024-06-15', NULL,              true),
  (2, 'pro',  DATE '2024-02-20', DATE '2024-05-05', false),
  (2, 'free', DATE '2024-05-05', NULL,              true),
  (3, 'team', DATE '2024-04-01', NULL,              true),
  (4, 'team', DATE '2024-01-05', NULL,              true);
`;

export const exercises = defineSqlExercises({
  'sql-build-plan-history': {
    title: 'Build the history table',
    setup: changesSetup,
    starter: `SELECT customer_id,
       plan,
       changed_on AS valid_from
FROM plan_changes
-- add valid_to and is_current
`,
    reference: `
      SELECT customer_id,
             plan,
             changed_on AS valid_from,
             lead(changed_on) OVER (PARTITION BY customer_id ORDER BY changed_on) AS valid_to,
             lead(changed_on) OVER (PARTITION BY customer_id ORDER BY changed_on) IS NULL AS is_current
      FROM plan_changes`,
    hints: [
      'A version stops being valid on the day the customer’s next version starts.',
      'lead(changed_on) OVER (PARTITION BY customer_id ORDER BY changed_on) returns the next change date, or NULL when there isn’t one.',
      'The current version is the one with no next change, so is_current is true exactly when valid_to is NULL.',
    ],
    wrongAnswers: [
      {
        why: 'lag() returns the previous change date, so each version “ends” before it starts.',
        sql: `SELECT customer_id, plan, changed_on,
                     lag(changed_on) OVER (PARTITION BY customer_id ORDER BY changed_on),
                     lead(changed_on) OVER (PARTITION BY customer_id ORDER BY changed_on) IS NULL
              FROM plan_changes`,
      },
      {
        why: 'Without PARTITION BY, a version is closed by the next change of any customer.',
        sql: `SELECT customer_id, plan, changed_on,
                     lead(changed_on) OVER (ORDER BY changed_on),
                     lead(changed_on) OVER (ORDER BY changed_on) IS NULL
              FROM plan_changes`,
      },
      {
        why: 'Numbering from the oldest change marks each customer’s first version as current instead of the latest.',
        sql: `SELECT customer_id, plan, changed_on,
                     lead(changed_on) OVER (PARTITION BY customer_id ORDER BY changed_on),
                     row_number() OVER (PARTITION BY customer_id ORDER BY changed_on) = 1
              FROM plan_changes`,
      },
    ],
  },

  'sql-plan-as-of-date': {
    title: 'Each customer’s plan on a given day',
    setup: historySetup,
    starter: `SELECT customer_id, plan
FROM customer_plan_history
WHERE is_current
`,
    reference: `
      SELECT customer_id, plan
      FROM customer_plan_history
      WHERE valid_from <= DATE '2024-03-01'
        AND (valid_to > DATE '2024-03-01' OR valid_to IS NULL)`,
    hints: [
      'The starter returns today’s plans. You want the version that was valid on 2024-03-01.',
      'A version is valid from valid_from up to, but not including, valid_to. Customer 1 changed plan on 2024-03-01 itself.',
      'Current versions have a NULL valid_to. A comparison with NULL isn’t true, so handle that case with OR valid_to IS NULL.',
    ],
    wrongAnswers: [
      {
        why: 'is_current returns today’s plan, not the plan on 2024-03-01.',
        sql: `SELECT customer_id, plan FROM customer_plan_history WHERE is_current`,
      },
      {
        why: 'BETWEEN includes both ends, so on the change date 2024-03-01 customer 1 matches the old version and the new one.',
        sql: `SELECT customer_id, plan FROM customer_plan_history
              WHERE DATE '2024-03-01' BETWEEN valid_from AND coalesce(valid_to, DATE '9999-12-31')`,
      },
      {
        why: 'valid_to > … is NULL for current rows, so customer 4, whose only version is still current, disappears.',
        sql: `SELECT customer_id, plan FROM customer_plan_history
              WHERE valid_from <= DATE '2024-03-01' AND valid_to > DATE '2024-03-01'`,
      },
    ],
  },
});
