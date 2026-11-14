# Recursive CTEs

Notes behind [`content/sql/08-recursive-ctes.mdx`](../../content/sql/08-recursive-ctes.mdx).

## Sources

All checked 2026-11-14.

| Source | Version |
|---|---|
| [PostgreSQL: 7.8 WITH queries](https://www.postgresql.org/docs/current/queries-with.html) | 18.7 |
| [DuckDB: WITH clause](https://duckdb.org/docs/2.0/sql/query_syntax/with.html) | DuckDB 2.0 docs (the pinned engine is 1.4.3) |
| [Snowflake: WITH](https://docs.snowflake.com/en/sql-reference/constructs/with) | undated |
| [BigQuery: work with recursive CTEs](https://docs.cloud.google.com/bigquery/docs/recursive-ctes) | undated |

## Key claims

- **Shape.** PostgreSQL 7.8.2: "The general form of a recursive `WITH` query is always a *non-recursive term*, then `UNION` (or `UNION ALL`), then a *recursive term*, where only the recursive term can contain a reference to the query's own output."
- **Evaluation.** PostgreSQL: evaluate the non-recursive term and place the rows in a working table; "So long as the working table is not empty", evaluate the recursive term "substituting the current contents of the working table for the recursive self-reference", then replace the working table with the new rows.
- **`UNION` removes duplicates across rounds.** PostgreSQL: "For `UNION` (but not `UNION ALL`), discard duplicate rows and rows that duplicate any previous result row."
- **Termination.** PostgreSQL: "it is important to be sure that the recursive part of the query will eventually return no tuples, or else the query will loop indefinitely. Sometimes, using `UNION` instead of `UNION ALL` can accomplish this by discarding rows that duplicate previous output rows." And on a query with a depth column: "just changing `UNION ALL` to `UNION` would not eliminate the looping." DuckDB: "the query must be formulated in a way that ensures termination, otherwise, it may run into an infinite loop", and "if the graph has cycles, the query must perform cycle detection to prevent infinite loops."
- **DuckDB.** "`WITH RECURSIVE` allows the definition of CTEs which can refer to themselves." The page also documents `USING KEY`, which the lesson doesn't cover.
- **Snowflake.** "The keyword `RECURSIVE` is optional." "Make sure to use `UNION ALL`, not `UNION`, in a recursive CTE." A runaway query ends only when it succeeds, exceeds `STATEMENT_TIMEOUT_IN_SECONDS`, or is cancelled.
- **BigQuery.** "A recursive CTE includes a base term, a union operator, and a recursive term." "For BigQuery, the iteration limit is 500 iterations."

## Checked on the pinned engine (DuckDB v1.4.3, duckdb-wasm 1.32.0)

| Query | Result |
|---|---|
| Downstream of `raw_customers` with a depth column and `UNION ALL` | stg_customers 1; dim_customers 2; fct_orders 2; rpt_revenue 3 (twice) |
| Same without depth, with `UNION` | four tables, rpt_revenue once |
| Downstream of `raw_orders` with depth, `UNION ALL` | stg_orders 1; fct_orders 2; rpt_revenue 2 and 3 |
| A recursive CTE written without the `RECURSIVE` keyword | Catalog Error: the CTE can't see itself |
| A two-node cycle (a → b, b → a) with `UNION` and no depth column | finishes, returning a and b |

## Design notes

- The graph has a diamond (rpt_revenue via fct_orders and via dim_customers, both 3 steps from raw_customers) for the `UNION` versus `UNION ALL` exercise, and a shortcut edge (stg_orders → rpt_revenue) so rpt_revenue is 2 and 3 steps from raw_orders for the depth exercise.
- The exercise graph has no cycles. A wrong answer that loops forever can't be a known-wrong answer, because the test needs it to return rows. Cycles are covered in prose only.

## Open questions

- **[VERIFY]** Does BigQuery accept `UNION DISTINCT` in a recursive CTE? Its guide uses `UNION ALL` in every example but doesn't state a restriction.
