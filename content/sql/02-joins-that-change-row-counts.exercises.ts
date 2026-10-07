import { defineSqlExercises } from '../../src/engines/sql/types';

const setup = `
CREATE TABLE customers (
  customer_id INTEGER,
  name        VARCHAR
);

CREATE TABLE orders (
  order_id    INTEGER,
  customer_id INTEGER,       -- NULL for guest checkouts
  order_total DECIMAL(8, 2)
);

CREATE TABLE shipments (
  order_id   INTEGER,
  shipped_at DATE
);

INSERT INTO customers VALUES (1, 'Ana'), (2, 'Ben'), (3, 'Cy'), (4, 'Dee');

INSERT INTO orders VALUES
  (101, 1,    50.00),
  (102, 1,    30.00),
  (103, 2,    20.00),
  (104, NULL, 15.00);

-- Order 101 was split across two shipments; order 103 hasn't shipped.
INSERT INTO shipments VALUES
  (101, DATE '2024-06-01'),
  (101, DATE '2024-06-03'),
  (102, DATE '2024-06-02'),
  (104, DATE '2024-06-02');
`;

export const exercises = defineSqlExercises({
  'sql-order-value-and-shipments': {
    title: 'Order value and shipments per customer',
    setup,
    starter: `SELECT o.customer_id, sum(o.order_total) AS total_value, count(s.order_id) AS shipment_count
FROM orders AS o
LEFT JOIN shipments AS s ON s.order_id = o.order_id
GROUP BY o.customer_id
`,
    reference: `
      WITH shipments_per_order AS (
        SELECT order_id, count(*) AS shipments
        FROM shipments
        GROUP BY order_id
      )
      SELECT o.customer_id,
             sum(o.order_total) AS total_value,
             coalesce(sum(s.shipments), 0) AS shipment_count
      FROM orders AS o
      LEFT JOIN shipments_per_order AS s ON s.order_id = o.order_id
      WHERE o.customer_id IS NOT NULL
      GROUP BY o.customer_id`,
    hints: [
      'Run the starter query. Compare customer 1’s total_value with the sum of their orders in the orders table.',
      'Order 101 has two shipments, so the join repeats it twice and its total is counted twice.',
      'Count shipments per order first, in a CTE or subquery, so the join matches at most one row per order.',
    ],
    wrongAnswers: [
      {
        why: 'Joining before summing repeats order 101 once per shipment, so customer 1 totals 130.00 instead of 80.00.',
        sql: `SELECT o.customer_id, sum(o.order_total), count(s.order_id)
              FROM orders o LEFT JOIN shipments s ON s.order_id = o.order_id
              WHERE o.customer_id IS NOT NULL GROUP BY o.customer_id`,
      },
      {
        why: 'An inner join drops customer 2, whose only order hasn’t shipped.',
        sql: `WITH sp AS (SELECT order_id, count(*) AS n FROM shipments GROUP BY order_id)
              SELECT o.customer_id, sum(o.order_total), sum(sp.n)
              FROM orders o JOIN sp ON sp.order_id = o.order_id
              WHERE o.customer_id IS NOT NULL GROUP BY o.customer_id`,
      },
      {
        why: 'count(*) counts the NULL-extended row from the left join, so customer 2 shows 1 shipment instead of 0.',
        sql: `SELECT o.customer_id, sum(DISTINCT o.order_total), count(*)
              FROM orders o LEFT JOIN shipments s ON s.order_id = o.order_id
              WHERE o.customer_id IS NOT NULL GROUP BY o.customer_id`,
      },
      {
        why: 'Without filtering, the guest order forms its own group with a NULL customer_id.',
        sql: `WITH sp AS (SELECT order_id, count(*) AS n FROM shipments GROUP BY order_id)
              SELECT o.customer_id, sum(o.order_total), coalesce(sum(sp.n), 0)
              FROM orders o LEFT JOIN sp ON sp.order_id = o.order_id
              GROUP BY o.customer_id`,
      },
    ],
  },

  'sql-customers-without-orders': {
    title: 'Customers who have never ordered',
    setup,
    starter: `SELECT customer_id, name
FROM customers
WHERE customer_id NOT IN (SELECT customer_id FROM orders)
`,
    reference: `
      SELECT c.customer_id, c.name
      FROM customers AS c
      WHERE NOT EXISTS (
        SELECT 1 FROM orders AS o WHERE o.customer_id = c.customer_id
      )`,
    hints: [
      'The starter query returns no rows. Look at the customer_id values in orders: one of them is NULL.',
      'x NOT IN (…, NULL) is never TRUE. It is either FALSE or NULL, and WHERE drops both.',
      'Use NOT EXISTS with a correlated subquery, or a LEFT JOIN that keeps the rows where the join found nothing.',
    ],
    wrongAnswers: [
      {
        why: 'NOT IN against a column containing NULL is never TRUE, so no rows come back.',
        sql: `SELECT customer_id, name FROM customers WHERE customer_id NOT IN (SELECT customer_id FROM orders)`,
      },
      {
        why: 'An inner join finds the customers who have ordered, the opposite of what was asked.',
        sql: `SELECT DISTINCT c.customer_id, c.name FROM customers c JOIN orders o ON o.customer_id = c.customer_id`,
      },
      {
        why: 'Filtering the left join on a column that is never NULL, instead of on the joined table, keeps every customer, and repeats Ana.',
        sql: `SELECT c.customer_id, c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.customer_id
              WHERE c.customer_id IS NOT NULL`,
      },
    ],
  },
});
