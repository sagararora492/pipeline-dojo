import { defineSqlExercises } from '../../src/engines/sql/types';

const setup = `
CREATE TABLE sales (
  order_id INTEGER,
  region   VARCHAR,          -- NULL when the region couldn't be resolved
  channel  VARCHAR,
  status   VARCHAR,          -- 'paid' or 'refunded'
  amount   DECIMAL(8, 2)
);

INSERT INTO sales VALUES
  (1, 'EU',   'web',   'paid',     100.00),
  (2, 'EU',   'web',   'paid',      50.00),
  (3, 'EU',   'store', 'paid',      70.00),
  (4, 'EU',   'web',   'refunded',  40.00),
  (5, 'US',   'web',   'paid',     200.00),
  (6, 'US',   'store', 'refunded',  30.00),
  (7, 'APAC', 'store', 'refunded',  25.00),
  (8, NULL,   'web',   'paid',      10.00);
`;

export const exercises = defineSqlExercises({
  'sql-paid-revenue-and-refunds': {
    title: 'Paid revenue and refunds per region',
    setup,
    starter: `SELECT region,
       sum(amount) AS paid_revenue,
       count(*) AS refunded_orders
FROM sales
GROUP BY region
`,
    reference: `
      SELECT region,
             coalesce(sum(amount) FILTER (WHERE status = 'paid'), 0) AS paid_revenue,
             count(*) FILTER (WHERE status = 'refunded') AS refunded_orders
      FROM sales
      GROUP BY region`,
    hints: [
      'Each column needs a different set of rows, so a single WHERE clause can’t work. Filter inside each aggregate instead.',
      'sum(amount) FILTER (WHERE status = \'paid\') sums only the paid rows of each group.',
      'APAC has no paid orders, so its filtered sum is NULL. Wrap it in coalesce(…, 0).',
    ],
    wrongAnswers: [
      {
        why: 'A WHERE clause removes the refunded rows before grouping, so refunded_orders counts paid orders and APAC disappears.',
        sql: `SELECT region, sum(amount), count(*) FILTER (WHERE status = 'refunded')
              FROM sales WHERE status = 'paid' GROUP BY region`,
      },
      {
        why: 'count() counts every non-NULL value, and 0 isn’t NULL, so ELSE 0 counts every row: EU shows 4 refunds.',
        sql: `SELECT region, coalesce(sum(amount) FILTER (WHERE status = 'paid'), 0),
                     count(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END)
              FROM sales GROUP BY region`,
      },
      {
        why: 'Without coalesce, APAC’s paid revenue is NULL instead of 0.00.',
        sql: `SELECT region, sum(amount) FILTER (WHERE status = 'paid'), count(*) FILTER (WHERE status = 'refunded')
              FROM sales GROUP BY region`,
      },
      {
        why: 'Dropping the NULL region loses the 10.00 of paid sales whose region is unknown.',
        sql: `SELECT region, coalesce(sum(amount) FILTER (WHERE status = 'paid'), 0), count(*) FILTER (WHERE status = 'refunded')
              FROM sales WHERE region IS NOT NULL GROUP BY region`,
      },
    ],
  },

  'sql-revenue-rollup': {
    title: 'Revenue with subtotals and a grand total',
    setup,
    starter: `SELECT region, channel, sum(amount) AS revenue
FROM sales
WHERE status = 'paid'
GROUP BY region, channel
`,
    reference: `
      SELECT region,
             channel,
             sum(amount) AS revenue,
             CASE grouping(region, channel)
               WHEN 0 THEN 'detail'
               WHEN 1 THEN 'region'
               ELSE 'total'
             END AS level
      FROM sales
      WHERE status = 'paid'
      GROUP BY ROLLUP (region, channel)`,
    hints: [
      'GROUP BY ROLLUP (region, channel) adds a subtotal row per region and one grand-total row.',
      'Two rows come out as (NULL, NULL). One is the subtotal for sales with no region, the other is the grand total. Checking for NULL can’t tell them apart.',
      'grouping(region, channel) is 0 for detail rows, 1 when only channel is rolled up, and 3 when both are.',
    ],
    wrongAnswers: [
      {
        why: 'Labelling rows by checking for NULL marks the unknown-region subtotal as a second grand total.',
        sql: `SELECT region, channel, sum(amount),
                     CASE WHEN region IS NULL AND channel IS NULL THEN 'total'
                          WHEN channel IS NULL THEN 'region' ELSE 'detail' END
              FROM sales WHERE status = 'paid' GROUP BY ROLLUP (region, channel)`,
      },
      {
        why: 'CUBE also adds per-channel subtotals, which weren’t asked for.',
        sql: `SELECT region, channel, sum(amount),
                     CASE grouping(region, channel) WHEN 0 THEN 'detail' WHEN 1 THEN 'region' ELSE 'total' END
              FROM sales WHERE status = 'paid' GROUP BY CUBE (region, channel)`,
      },
      {
        why: 'ROLLUP (channel, region) builds subtotals per channel instead of per region.',
        sql: `SELECT region, channel, sum(amount),
                     CASE grouping(region, channel) WHEN 0 THEN 'detail' WHEN 2 THEN 'region' ELSE 'total' END
              FROM sales WHERE status = 'paid' GROUP BY ROLLUP (channel, region)`,
      },
      {
        why: 'These grouping sets skip the per-region subtotals.',
        sql: `SELECT region, channel, sum(amount),
                     CASE grouping(region, channel) WHEN 0 THEN 'detail' WHEN 1 THEN 'region' ELSE 'total' END
              FROM sales WHERE status = 'paid' GROUP BY GROUPING SETS ((region, channel), ())`,
      },
    ],
  },
});
