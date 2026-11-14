import { defineSqlExercises } from '../../src/engines/sql/types';

// customer_plan_history is the table built in lesson 06.
const setup = `
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

CREATE TABLE invoices (
  invoice_id  INTEGER,
  customer_id INTEGER,
  invoiced_on DATE,
  amount      DECIMAL(8, 2)
);

INSERT INTO invoices VALUES
  (1, 1, DATE '2024-02-01', 10.00),
  -- Invoiced on the day customer 1 moved from free to pro.
  (2, 1, DATE '2024-03-01', 25.00),
  (3, 1, DATE '2024-07-01', 30.00),
  (4, 2, DATE '2024-03-15', 45.00),
  (5, 2, DATE '2024-06-01', 50.00),
  -- Before customer 3's first history row.
  (6, 3, DATE '2024-03-10', 80.00);
`;

export const exercises = defineSqlExercises({
  'sql-plan-at-invoice-time': {
    title: 'The plan each invoice was issued under',
    setup,
    starter: `SELECT i.invoice_id, i.customer_id, h.plan AS plan_at_invoice
FROM invoices AS i
LEFT JOIN customer_plan_history AS h
  ON h.customer_id = i.customer_id AND h.is_current
`,
    reference: `
      SELECT i.invoice_id, i.customer_id, h.plan AS plan_at_invoice
      FROM invoices AS i
      LEFT JOIN customer_plan_history AS h
        ON h.customer_id = i.customer_id
       AND i.invoiced_on >= h.valid_from
       AND (i.invoiced_on < h.valid_to OR h.valid_to IS NULL)`,
    hints: [
      'The starter joins every invoice to the customer’s current plan. Invoice 1 was issued while customer 1 was on the free plan.',
      'Join on the customer and on the date range: invoiced_on >= valid_from AND invoiced_on < valid_to.',
      'Current versions have a NULL valid_to, so add OR h.valid_to IS NULL. Keep all the conditions in ON so the LEFT JOIN still returns invoice 6.',
    ],
    wrongAnswers: [
      {
        why: 'Joining to the current row gives every invoice today’s plan, so invoices 1 and 2 show team.',
        sql: `SELECT i.invoice_id, i.customer_id, h.plan FROM invoices i
              LEFT JOIN customer_plan_history h ON h.customer_id = i.customer_id AND h.is_current`,
      },
      {
        why: 'BETWEEN includes both ends, so invoice 2, issued on a change date, matches two versions and appears twice.',
        sql: `SELECT i.invoice_id, i.customer_id, h.plan FROM invoices i
              LEFT JOIN customer_plan_history h ON h.customer_id = i.customer_id
               AND i.invoiced_on BETWEEN h.valid_from AND coalesce(h.valid_to, DATE '9999-12-31')`,
      },
      {
        why: 'invoiced_on < valid_to is NULL for current rows, so invoices 3 and 5 find no version and show a NULL plan.',
        sql: `SELECT i.invoice_id, i.customer_id, h.plan FROM invoices i
              LEFT JOIN customer_plan_history h ON h.customer_id = i.customer_id
               AND i.invoiced_on >= h.valid_from AND i.invoiced_on < h.valid_to`,
      },
      {
        why: 'Range conditions in WHERE are applied after the LEFT JOIN, so invoice 6, which has no matching version, is removed.',
        sql: `SELECT i.invoice_id, i.customer_id, h.plan FROM invoices i
              LEFT JOIN customer_plan_history h ON h.customer_id = i.customer_id
              WHERE i.invoiced_on >= h.valid_from AND (i.invoiced_on < h.valid_to OR h.valid_to IS NULL)`,
      },
      {
        why: 'Joining on the customer alone matches every version, so invoices repeat once per version.',
        sql: `SELECT i.invoice_id, i.customer_id, h.plan FROM invoices i
              LEFT JOIN customer_plan_history h ON h.customer_id = i.customer_id`,
      },
    ],
  },

  'sql-revenue-by-plan-at-invoice': {
    title: 'Revenue by the plan at invoice time',
    setup,
    starter: `SELECT h.plan AS plan_at_invoice, sum(i.amount) AS revenue
FROM invoices AS i
LEFT JOIN customer_plan_history AS h
  ON h.customer_id = i.customer_id AND h.is_current
GROUP BY h.plan
`,
    reference: `
      SELECT h.plan AS plan_at_invoice, sum(i.amount) AS revenue
      FROM invoices AS i
      LEFT JOIN customer_plan_history AS h
        ON h.customer_id = i.customer_id
       AND i.invoiced_on >= h.valid_from
       AND (i.invoiced_on < h.valid_to OR h.valid_to IS NULL)
      GROUP BY h.plan`,
    hints: [
      'Reuse the point-in-time join from the previous exercise, then group by the plan.',
      'The invoices total 240.00. If your revenue column adds up to more, an invoice matched more than one version.',
      'Invoice 6 has no matching version. Keep it, in a group with a NULL plan.',
    ],
    wrongAnswers: [
      {
        why: 'Grouping by the current plan moves old invoices to today’s plan: team shows 145.00 instead of 30.00.',
        sql: `SELECT h.plan, sum(i.amount) FROM invoices i
              LEFT JOIN customer_plan_history h ON h.customer_id = i.customer_id AND h.is_current
              GROUP BY h.plan`,
      },
      {
        why: 'BETWEEN matches invoice 2 to two versions, so its 25.00 is counted under free and under pro.',
        sql: `SELECT h.plan, sum(i.amount) FROM invoices i
              LEFT JOIN customer_plan_history h ON h.customer_id = i.customer_id
               AND i.invoiced_on BETWEEN h.valid_from AND coalesce(h.valid_to, DATE '9999-12-31')
              GROUP BY h.plan`,
      },
      {
        why: 'An inner join drops invoice 6, so its 80.00 is missing from the result.',
        sql: `SELECT h.plan, sum(i.amount) FROM invoices i
              JOIN customer_plan_history h ON h.customer_id = i.customer_id
               AND i.invoiced_on >= h.valid_from AND (i.invoiced_on < h.valid_to OR h.valid_to IS NULL)
              GROUP BY h.plan`,
      },
    ],
  },
});
