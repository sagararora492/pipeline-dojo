# Point-in-time joins

Notes behind [`content/sql/07-point-in-time-joins.mdx`](../../content/sql/07-point-in-time-joins.mdx).

## Sources

All checked 2026-11-14.

| Source | Version |
|---|---|
| [Kimball Group: Type 2, add new row](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/type-2/) | undated |
| [PostgreSQL: 9.2 comparison functions and operators](https://www.postgresql.org/docs/current/functions-comparison.html) | 18.7 |
| [DuckDB: AsOf join](https://duckdb.org/docs/2.0/guides/sql_features/asof_join.html) | DuckDB 2.0 docs (the pinned engine is 1.4.3) |
| [Snowflake: ASOF JOIN](https://docs.snowflake.com/en/sql-reference/constructs/asof-join) | undated |

## Key claims

- **Why the fact must find its own version.** Kimball: when a type 2 change creates a row, "a new primary surrogate key is assigned and used as a foreign key in all fact tables from the moment of the update until a subsequent change creates a new dimension key and updated dimension row." The lesson reaches the same result with a date-range join instead of a stored surrogate key.
- **`BETWEEN`** includes both ends (PostgreSQL 9.2; see the lesson 06 notes).
- **DuckDB as-of join.** The guide's example is `ASOF JOIN prices p ON h.ticker = p.ticker AND h.when >= p.when`, which finds "the most recent price before the holding's timestamp". With a plain `ASOF JOIN`, rows without a match "don't appear in the output"; `ASOF LEFT JOIN` gives "`NULL` prices and values instead of dropping left side rows."
- **Snowflake as-of join.** It "combines rows from two tables based on timestamp values that follow each other, precede each other, or match exactly." Syntax: `FROM <left_table> ASOF JOIN <right_table> MATCH_CONDITION ( <left_table.timecol> <comparison_operator> <right_table.timecol> ) [ ON … | USING … ]`. The operator "must be one of the following: `>=`, `<=`, `>`, `<`." "When there is no match for a row in the left table, the columns from the right table are null-padded."

## Checked on the pinned engine (DuckDB v1.4.3, duckdb-wasm 1.32.0)

| Query | Result |
|---|---|
| Range join (`>=`, `<`, `OR valid_to IS NULL`) as a `LEFT JOIN` | invoices 1–6 → free, pro, team, pro, free, NULL |
| `ASOF LEFT JOIN … AND i.invoiced_on >= h.valid_from` | the same six rows |
| `BETWEEN valid_from AND coalesce(valid_to, DATE '9999-12-31')` | invoice 2 matches free and pro |
| Revenue by plan at invoice time | free 60.00, pro 70.00, team 30.00, NULL 80.00 (total 240.00) |
| A history with a gap (pro from 2024-01-01 to 2024-02-01, team from 2024-05-01) and an invoice on 2024-03-15 | `ASOF LEFT JOIN` returns pro; the range join returns NULL |

## Design notes

- Invoice 2 is dated on a change date (catches inclusive ranges). Invoices 3 and 5 fall in current versions (catch the missing NULL branch). Invoice 6 predates the customer's first version (catches inner joins and range tests in `WHERE`).
- The amounts are chosen so that every wrong answer changes at least one group's total, and no two groups share a total.

## Open questions

- **[VERIFY]** The range join has not been run on Snowflake or BigQuery.
