# Keep the latest row per key

Notes behind [`content/sql/01-latest-row-per-key.mdx`](../../content/sql/01-latest-row-per-key.mdx).

## Sources

| Source | Checked |
|---|---|
| [DuckDB: QUALIFY clause](https://duckdb.org/docs/stable/sql/query_syntax/qualify) | pending review |
| [DuckDB: window functions](https://duckdb.org/docs/stable/sql/functions/window_functions) | pending review |
| [PostgreSQL: SELECT (DISTINCT ON)](https://www.postgresql.org/docs/current/sql-select.html) | pending review |
| [Snowflake: QUALIFY](https://docs.snowflake.com/en/sql-reference/constructs/qualify) | pending review |
| [BigQuery: QUALIFY clause](https://cloud.google.com/bigquery/docs/reference/standard-sql/query-syntax#qualify_clause) | pending review |

## Key claims

- `row_number()` numbers rows within a partition from 1, with no ties. Source: DuckDB window functions docs.
- `rank()` gives peers the same rank. Source: DuckDB window functions docs.
- `WHERE` is evaluated before window functions, so it can't filter on them. `QUALIFY` exists for that. Source: DuckDB QUALIFY docs.
- DuckDB supports `DISTINCT ON`. Source: DuckDB docs, SELECT clause. **[VERIFY]** add a link.
- Snowflake and BigQuery support `QUALIFY`. Sources: their docs above.
- Checked by CI: every behaviour the exercise depends on (duplicates removed by `row_number()` but not by `rank()`, `max()` per column mixing rows) is exercised by the wrong answers in `01-latest-row-per-key.exercises.ts`.

## Open questions

- **[VERIFY]** Does DuckDB document the order among peers in `row_number()` as undefined?
- **[VERIFY]** PostgreSQL: confirm `QUALIFY` is still unsupported in the current release.
- **[VERIFY]** BigQuery: older docs required a `WHERE`, `GROUP BY` or `HAVING` clause with `QUALIFY`. Is that still true?

## Dialect differences

See the table in the lesson.
