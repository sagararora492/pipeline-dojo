# Turn changes into history (SCD type 2)

Notes behind [`content/sql/06-history-tables-scd2.mdx`](../../content/sql/06-history-tables-scd2.mdx).

## Sources

All checked 2026-11-14.

| Source | Version |
|---|---|
| [Kimball Group: Type 2, add new row](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/type-2/) | undated |
| [PostgreSQL: 9.22 window functions](https://www.postgresql.org/docs/current/functions-window.html) | 18.7 |
| [PostgreSQL: 9.2 comparison functions and operators](https://www.postgresql.org/docs/current/functions-comparison.html) | 18.7 |
| [DuckDB: window functions](https://duckdb.org/docs/2.0/sql/functions/window_functions) | DuckDB 2.0 docs (the pinned engine is 1.4.3) |
| [Snowflake: LEAD](https://docs.snowflake.com/en/sql-reference/functions/lead) | undated |
| [BigQuery: navigation functions](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/navigation_functions) | undated |

## Key claims

- **Type 2.** Kimball: "Slowly changing dimension type 2 changes add a new row in the dimension with the updated attribute values." The page recommends at least three additional columns: "1) row effective date or date/time stamp; 2) row expiration date or date/time stamp; and 3) current row indicator." The lesson names them `valid_from`, `valid_to` and `is_current`. Kimball also assigns a new surrogate key to each row; the lesson doesn't cover surrogate keys, which belong in the data modelling track.
- **`lead`.** PostgreSQL: returns the value "at the row that is *offset* rows after the current row within the partition; if there is no such row, instead returns *default*", and "If omitted, *offset* defaults to 1 and *default* to `NULL`." Snowflake `LEAD`: offset "Default is 1", default "Default is NULL". BigQuery `LEAD`: "the default value is `1`", and `default_expression` "defaults to NULL".
- **`BETWEEN`.** PostgreSQL: `a BETWEEN x AND y` "is equivalent to" `a >= x AND a <= y`, and "`BETWEEN` treats the endpoint values as included in the range."

## Checked on the pinned engine (DuckDB v1.4.3, duckdb-wasm 1.32.0)

| Query | Result |
|---|---|
| `lead(changed_on) OVER (PARTITION BY customer_id ORDER BY changed_on)` | the next change date, NULL on each customer's latest row |
| `DATE '2024-07-01' < CAST(NULL AS DATE)` | NULL |
| Self-join of the built history looking for overlapping ranges per customer | no rows |
| As-of 2024-03-01 with `BETWEEN valid_from AND coalesce(valid_to, DATE '9999-12-31')` | customer 1 appears twice (free and pro) |

## Design notes

- The half-open convention (`valid_from` included, `valid_to` excluded) is a design choice, not something a source prescribes. The lesson states it as the convention this history table uses. It follows from building `valid_to` with `lead()`: the end of one version equals the start of the next.
- 2024-03-01 was chosen for the as-of exercise because customer 1 changes plan on that day, so inclusive ranges return two rows.
- Customer 4 has a single, still-current version that started before 2024-03-01, so forgetting the NULL case drops a customer.
- NULL versus a far-future end date is presented as a team convention, with no recommendation.

## Open questions

None.
