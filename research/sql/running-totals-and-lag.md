# Running totals and the previous row

Notes behind [`content/sql/04-running-totals-and-lag.mdx`](../../content/sql/04-running-totals-and-lag.mdx).

## Sources

All checked 2026-11-14.

| Source | Version |
|---|---|
| [DuckDB: window functions](https://duckdb.org/docs/2.0/sql/functions/window_functions) | DuckDB 2.0 docs (the pinned engine is 1.4.3; see "Checked on the pinned engine") |
| [PostgreSQL: 4.2.8 window function calls](https://www.postgresql.org/docs/current/sql-expressions.html) | 18.7 |
| [PostgreSQL: 3.5 tutorial, window functions](https://www.postgresql.org/docs/current/tutorial-window.html) | 18.7 |
| [PostgreSQL: 9.22 window functions](https://www.postgresql.org/docs/current/functions-window.html) | 18.7 |
| [Snowflake: window function syntax and usage](https://docs.snowflake.com/en/sql-reference/functions-window-syntax) | undated |
| [Snowflake: LAG](https://docs.snowflake.com/en/sql-reference/functions/lag) | undated |
| [BigQuery: window function calls](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/window-function-calls) | undated |
| [BigQuery: navigation functions](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/navigation_functions) | undated |

## Key claims

- **Default frame.** DuckDB: the default is "`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` when an `ORDER BY` clause is present" and "unbounded (i.e., the entire partition) when no `ORDER BY` clause is present". PostgreSQL 4.2.8: "The default framing option is `RANGE UNBOUNDED PRECEDING`, which is the same as `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. With `ORDER BY`, this sets the frame to be all rows from the partition start up through the current row's last `ORDER BY` peer."
- **Peers.** PostgreSQL 9.22: "Rows that are not distinct when considering only the `ORDER BY` columns are said to be *peers*."
- **`CURRENT ROW` by mode.** DuckDB: it "means the current row and all its peers when `RANGE` or `GROUP` framing are used", "but it means only the current row when `ROWS` framing is used". PostgreSQL 4.2.8: "In `ROWS` mode, `CURRENT ROW` simply means the current row."
- **Running sum with duplicates.** PostgreSQL tutorial, on `sum(salary) OVER (ORDER BY salary)`: "the sum is taken from the first (lowest) salary up through the current one, including any duplicates of the current one".
- **`lag` and `lead`.** PostgreSQL 9.22: `lag` returns the value "at the row that is *offset* rows before the current row within the partition; if there is no such row, instead returns *default*", and "If omitted, *offset* defaults to 1 and *default* to `NULL`." DuckDB documents the same defaults.
- **Order of evaluation.** PostgreSQL tutorial: window functions "logically execute after the processing of" `GROUP BY`, `HAVING` and `WHERE`, and "window functions execute after non-window aggregate functions. This means it is valid to include an aggregate function call in the arguments of a window function, but not vice versa."
- **Snowflake.** For functions such as COUNT, MAX, MIN and SUM, with `ORDER BY` and no frame, "the default is the following window frame (in accordance with the ANSI standard)": `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. `FIRST_VALUE`, `LAST_VALUE` and `NTH_VALUE` default to the entire window instead, which the page says "does not comply" with the standard. `LAG`: offset "Default is 1", default value "Default is NULL"; the syntax shows `ORDER BY` as a required part of `OVER`.
- **BigQuery.** With `ORDER BY` and no frame clause, "the following window frame clause is used by default: `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`". `ROWS` "Computes the window frame based on physical offsets from the current row"; `RANGE` uses "a logical range of rows around the current row". `LAG`: offset "the default value is `1`", and `default_expression` "defaults to NULL".

## Checked on the pinned engine (DuckDB v1.4.3, duckdb-wasm 1.32.0)

On the lesson's `payments` table:

| Query | Result |
|---|---|
| `sum(amount) OVER (PARTITION BY account_id ORDER BY paid_on)` for account A | 100.00, 200.00, 200.00, 225.00 (payments 2 and 3 share 200.00) |
| Same with `ORDER BY paid_on, payment_id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` | 100.00, 140.00, 200.00, 225.00 |
| `ORDER BY paid_on, payment_id` with no frame | 100.00, 140.00, 200.00, 225.00 |
| `sum(amount) OVER (PARTITION BY account_id)` | 225.00 on every A row, 750.00 on every B row |
| `lag(sum(amount)) OVER (PARTITION BY account_id ORDER BY paid_on)` with `GROUP BY account_id, paid_on` | NULL on each account's first day |

The exercises in `04-running-totals-and-lag.exercises.ts` encode these behaviours as known-wrong answers.

## Design notes

- The running-total exercise asks for the order `paid_on, payment_id`. A `ROWS` frame ordered by `paid_on` alone is nondeterministic for payments 2 and 3, so the checker can't grade it reliably. The lesson explains why both the tie-breaker and the frame matter.
- Account A's total on 2024-07-03 equals its total on 2024-07-01, so its real change is 0.00. That is what makes `coalesce(…, 0)` on the first day a wrong answer the data can show.

## Open questions

- **[VERIFY]** The Snowflake and BigQuery pages give the default frame but don't describe in words how `RANGE … CURRENT ROW` treats tied rows. Find an explicit statement, or run the query on each.
- The Snowflake page contradicts itself in one place: an example calls `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` "the default window frame", while the usage note names `RANGE`. The lesson follows the usage note.
