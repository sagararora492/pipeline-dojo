# Conditional aggregation and rollups

Notes behind [`content/sql/03-conditional-aggregation-and-rollups.mdx`](../../content/sql/03-conditional-aggregation-and-rollups.mdx).

## Sources

All checked 2026-10-07.

| Source | Version |
|---|---|
| [DuckDB: FILTER clause](https://duckdb.org/docs/current/sql/query_syntax/filter.html) | current release docs |
| [DuckDB: GROUPING SETS, ROLLUP and CUBE](https://duckdb.org/docs/current/sql/query_syntax/grouping_sets.html) | current release docs |
| [PostgreSQL: aggregate expressions (FILTER)](https://www.postgresql.org/docs/current/sql-expressions.html#SYNTAX-AGGREGATES) | 18.6 |
| [PostgreSQL: GROUPING SETS, CUBE and ROLLUP](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-GROUPING-SETS) | 18.6 |
| [BigQuery: aggregate function calls](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/aggregate-function-calls) | last updated 2026-10-05 |
| [BigQuery: GROUPING function](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/aggregate_functions#grouping) | last updated 2026-10-05 |
| [BigQuery: GROUP BY GROUPING SETS, ROLLUP, CUBE](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/query-syntax#group_by_grouping_sets) | last updated 2026-10-05 |
| [Snowflake: GROUP BY GROUPING SETS](https://docs.snowflake.com/en/sql-reference/constructs/group-by-grouping-sets) | undated |
| [Snowflake Migration Accelerator: Spark SQL GROUP BY](https://docs.snowflake.com/en/migrations/sma-docs/translation-reference/spark-sql/spark-sql-dml/select/group-by) | undated |

## Key claims

- **`FILTER`** feeds an aggregate only the rows that pass its condition. DuckDB: it filters rows "in the same way that a WHERE clause filters rows, but localized to the specific aggregate function". PostgreSQL: "only the input rows for which the filter_clause evaluates to true are fed to the aggregate function".
- **`FILTER` vs `CASE WHEN`:** DuckDB's docs say the two aren't always equivalent. For `list` and `array_agg`, `CASE WHEN` keeps NULLs in the result while `FILTER` removes them.
- **`ROLLUP (e1, e2, …)`** is equivalent to grouping sets of "all prefixes of the list including the empty list". **`CUBE`** gives "all of its possible subsets (i.e., the power set)". Source: PostgreSQL 7.2.4. DuckDB's docs give the same expansions, n+1 sets for ROLLUP and 2^n for CUBE.
- **Grouped-out columns are NULL:** "References to the grouping columns or expressions are replaced by null values in result rows for grouping sets in which those columns do not appear." Source: PostgreSQL 7.2.4.
- **`GROUPING()`** with several arguments returns a bitmask in which "the first bit corresponds to the last expression", per DuckDB's description of `GROUPING_ID()`. BigQuery's `GROUPING(x)` "returns 1" if x is aggregated (not grouped), otherwise 0.
- **BigQuery** has no `FILTER` clause. It filters inside the call instead: `function_name( … [ WHERE where_expression ] … )`, with the example `AVG(inches WHERE season IN ('spring', 'summer'))`. It also supports `GROUP BY GROUPING SETS`, `ROLLUP` and `CUBE`, each with its own section in the query syntax reference.
- **Snowflake** documents `GROUP BY GROUPING SETS` and links to its `ROLLUP` and `CUBE` pages. Its migration guide translates Spark's `sum(quantity) FILTER (WHERE …)` to `SUM(CASE WHEN … THEN quantity ELSE NULL END)`. **[VERIFY]** That suggests Snowflake has no native `FILTER` clause, but no Snowflake page says so outright.

## Checked on the pinned engine (DuckDB v1.4.3, duckdb-wasm 1.32.0)

Dataset: the `sales` table in `03-conditional-aggregation-and-rollups.exercises.ts`.

| Query | Result |
|---|---|
| `count(*) FILTER (WHERE false)` | `0` |
| `sum(amount) FILTER (WHERE false)` | `NULL` |
| `coalesce(sum(amount) FILTER (WHERE false), 0)` on DECIMAL(8, 2) | `0.00` (stays DECIMAL) |
| `count(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END)` for EU | `4`: counts every row, because 0 isn't NULL |
| `sum(CASE WHEN status = 'paid' THEN amount END)` for APAC (no paid rows) | `NULL` |
| `GROUP BY ROLLUP (region, channel)` | 8 rows. Includes **two** `(NULL, NULL)` rows: the unknown-region subtotal (10.00) and the grand total (430.00) |
| `grouping(region, channel)` | 0 for detail rows, 1 for region subtotals, 3 for the grand total |
| `GROUP BY CUBE (region, channel)` | adds per-channel subtotals `(NULL, store)` and `(NULL, web)` |

The exercise wrong answers encode these results, so CI re-checks them when the engine is upgraded.

## Open questions

- **[VERIFY]** Does Snowflake support `FILTER (WHERE …)` on aggregates? Look for an explicit statement in the Snowflake SQL reference.
