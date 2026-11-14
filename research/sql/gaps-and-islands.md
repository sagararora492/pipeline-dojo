# Gaps and islands

Notes behind [`content/sql/05-gaps-and-islands.mdx`](../../content/sql/05-gaps-and-islands.mdx).

## Sources

All checked 2026-11-14.

| Source | Version |
|---|---|
| [DuckDB: date functions](https://duckdb.org/docs/2.0/sql/functions/date.html) | DuckDB 2.0 docs (the pinned engine is 1.4.3; see "Checked on the pinned engine") |
| [DuckDB: timestamp functions](https://duckdb.org/docs/2.0/sql/functions/timestamp) | DuckDB 2.0 docs |
| [PostgreSQL: 9.9 date/time functions and operators](https://www.postgresql.org/docs/current/functions-datetime.html) | 18.7 |
| [Snowflake: DATEADD](https://docs.snowflake.com/en/sql-reference/functions/dateadd) | undated |
| [Snowflake: DATEDIFF](https://docs.snowflake.com/en/sql-reference/functions/datediff) | undated |
| [BigQuery: date functions](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/date_functions) | undated |
| [BigQuery: timestamp functions](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/timestamp_functions) | undated |

The two techniques themselves (date minus row number; a running sum of session-start flags) are not taken from a source. They follow from arithmetic, and every step is checked on the pinned engine below and by the exercises' wrong answers.

## Key claims

- **DuckDB date arithmetic.** The date operator table lists `+` as "addition of days (integers)", `DATE '1992-03-22' + 5` → `1992-03-27`, and `-` as "subtraction of `DATE`s", giving `5`. It has no row for subtracting an integer from a date. The lesson's `d - n` claim rests on the engine check below, not on the docs.
- **DuckDB timestamp subtraction.** `TIMESTAMP '1992-03-27' - TIMESTAMP '1992-03-22'` → `5 days` (an interval).
- **DuckDB `date_diff`.** "The signed number of part boundaries between starttimestamp and endtimestamp". `date_sub` is "The signed length of the interval between starttimestamp and endtimestamp, truncated to whole multiples of part."
- **PostgreSQL.** `date - integer → date`, "Subtract a number of days from a date". `timestamp - timestamp → interval`.
- **Snowflake.** `DATEADD( <date_or_time_part>, <value>, <date_or_time_expr> )`; to subtract, pass a negative value. `DATEDIFF`: "Difference calculations compare the specified date or time part, not the complete date or time" and "Smaller units are not used, so values are not rounded."
- **BigQuery.** `DATE_SUB(date_expression, INTERVAL step_size step_unit)`. `TIMESTAMP_DIFF(end_timestamp, start_timestamp, granularity)` returns INT64, and "Decimals are always truncated rather than rounded."

## Checked on the pinned engine (DuckDB v1.4.3, duckdb-wasm 1.32.0)

| Query | Result |
|---|---|
| `DATE '2024-07-03' - 3` | `2024-06-30`, type `DATE` |
| `login_date - row_number() OVER (…)` with no cast | Binder Error: no function matches `-(DATE, BIGINT)` |
| `login_date - CAST(row_number() OVER (ORDER BY login_date) AS INTEGER)` for user 1's distinct days | 2024-06-30 for 07-01 to 07-03, 2024-07-02 for 07-06 and 07-07 |
| `event_at - lag(event_at)` for 09:40:00 → 10:10:40 | `00:30:40` |
| `date_diff('minute', …)` for the same pair | 30 |
| `date_sub('minute', …)` for the same pair | 30 |
| `date_diff('second', …)` for the same pair | 1840 |
| Session-start flags for user 1's five events | 1, 0, 0, 1, 0 |

The exercises in `05-gaps-and-islands.exercises.ts` encode these behaviours as known-wrong answers.

## Design notes

- The login data has a duplicate day for user 1, so skipping the dedup step splits a streak, and `dense_rank()` with `count(*)` over-counts it.
- The events data has one gap of exactly 30 minutes (stays in the session, catches `>=`) and one of 30 minutes 40 seconds (starts a session, catches whole-minute comparisons).
- User 2's events sit between user 1's in time, so leaving out `PARTITION BY` gives wrong sessions for both users.
- The sessionize reference uses a `ROWS` frame, as lesson 04 teaches. The data has no two events at the same time for one user, so the default frame would give the same result here.

## Open questions

- The Snowflake and BigQuery rows of the dialect table come from the docs only. They have not been run on those engines.
