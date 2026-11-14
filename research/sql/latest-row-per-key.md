# Keep the latest row per key

Notes behind [`content/sql/01-latest-row-per-key.mdx`](../../content/sql/01-latest-row-per-key.mdx).

## Sources

All checked 2026-10-07.

| Source | Version |
|---|---|
| [DuckDB: QUALIFY clause](https://duckdb.org/docs/current/sql/query_syntax/qualify.html) | current release docs |
| [DuckDB: window functions](https://duckdb.org/docs/current/sql/functions/window_functions.html) | current release docs |
| [DuckDB: DISTINCT ON](https://duckdb.org/docs/current/sql/query_syntax/select.html#distinct-on-clause) | current release docs |
| [PostgreSQL: SELECT](https://www.postgresql.org/docs/current/sql-select.html) | 18.6 |
| [Snowflake: QUALIFY](https://docs.snowflake.com/en/sql-reference/constructs/qualify) | undated |
| [BigQuery: QUALIFY clause](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/query-syntax#qualify_clause) | last updated 2026-10-05 |

The old `duckdb.org/docs/stable/...` and `cloud.google.com/bigquery/...` URLs now redirect, so the lesson uses the new ones.

## Key claims

- **`row_number()`** is "the number of the current row within the partition, counting from 1". **`rank()`** is "the rank of the current row with gaps; same as `row_number` of its first peer". Source: DuckDB window functions.
- **`QUALIFY`** "is used to filter the results of WINDOW functions", the way `HAVING` filters aggregates. Source: DuckDB QUALIFY.
- **Tied rows:** the DuckDB window docs say nothing about which tied row comes first. The lesson says that the docs make no promise, rather than claiming the order is "undefined".
- **`DISTINCT ON`** in DuckDB returns "the first row that is encountered as per the ORDER BY criteria". Without `ORDER BY`, the row "is not defined". PostgreSQL says the first row "is unpredictable unless ORDER BY is used". Sources: DuckDB SELECT and PostgreSQL SELECT.
- **PostgreSQL 18.6** has no `QUALIFY`: the SELECT synopsis has `WHERE`, `GROUP BY`, `HAVING` and `WINDOW`, but no `QUALIFY`. It lists `DISTINCT ON` as "an extension of the SQL standard".
- **Snowflake:** `QUALIFY` "requires at least one window function" in the SELECT list or the QUALIFY predicate.
- **BigQuery:** "A window function is required to be present in the QUALIFY clause or the SELECT list." There is no longer any requirement for a `WHERE`, `GROUP BY` or `HAVING` clause.
- **Checked by CI:** every behaviour the exercise depends on is covered by the wrong answers in `01-latest-row-per-key.exercises.ts`: `row_number()` removes the duplicate delivery but `rank()` doesn't, `max()` on each column mixes values from different rows, and matching rows to `max(updated_at)` per key keeps both copies of a duplicated latest change.

## Review (2026-11-02)

- Added the "match the max timestamp" wrong answer and a paragraph about it. It's the most common hand-written alternative to `row_number()`, and it has the same failure as `rank()`. No new source is needed: it follows from `=` matching every row with that value, and CI checks it.
- The exercise data has no tie between two *different* rows, on purpose. Without a tie-breaker the result would be nondeterministic and the checker couldn't grade it reliably. The lesson covers that case in prose instead.

## Resolved questions

- ~~Does DuckDB document tie order for `row_number()`?~~ No. The lesson was reworded to match.
- ~~Is `QUALIFY` still unsupported in PostgreSQL?~~ Yes, as of 18.6.
- ~~Does BigQuery still require `WHERE`, `GROUP BY` or `HAVING` with `QUALIFY`?~~ No.
