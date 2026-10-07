# Joins that change row counts

Notes behind [`content/sql/02-joins-that-change-row-counts.mdx`](../../content/sql/02-joins-that-change-row-counts.mdx).

## Sources

All checked 2026-10-07.

| Source | Version |
|---|---|
| [PostgreSQL: table expressions, joined tables](https://www.postgresql.org/docs/current/queries-table-expressions.html) | 18.6 |
| [PostgreSQL: subquery expressions (EXISTS, NOT IN)](https://www.postgresql.org/docs/current/functions-subquery.html) | 18.6 |
| [PostgreSQL: row and array comparisons (NOT IN with a value list)](https://www.postgresql.org/docs/current/functions-comparisons.html) | 18.6 |
| [DuckDB: FROM and JOIN clauses (semi and anti joins)](https://duckdb.org/docs/current/sql/query_syntax/from.html#semi-and-anti-joins) | current release docs |
| [DuckDB: aggregate functions](https://duckdb.org/docs/current/sql/functions/aggregates.html) | current release docs |
| [BigQuery: IN operator](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/operators#in_operators) | last updated 2026-10-05 |
| [Snowflake: [ NOT ] IN](https://docs.snowflake.com/en/sql-reference/functions/in) | undated |

## Key claims

- **Inner join:** "For each row R1 of T1, the joined table has a row for each row in T2 that satisfies the join condition with R1." So a left row that matches n rows appears n times (fan-out). Source: PostgreSQL table expressions.
- **`count(arg)`** "returns the number of rows where arg is not NULL". `count(*)` counts rows. Source: DuckDB aggregates.
- **`NOT IN`** with a subquery: "if there are no equal right-hand values and at least one right-hand row yields null, the result of the NOT IN construct will be null, not true." Source: PostgreSQL subquery expressions, 9.24.3.
- **`NOT IN` with a value list** "is a shorthand notation for expression <> value1 AND expression <> value2 AND …", with the same NULL rule as the subquery form. So `1 NOT IN (1, 2, NULL)` is FALSE, because `1 <> 1` is FALSE. Source: PostgreSQL 9.25.2.
- **`EXISTS`** is true if the subquery returns at least one row. Only whether rows exist matters, not what they contain. Source: PostgreSQL 9.24.1.
- **DuckDB anti joins:** "Anti joins provide the same logic as the NOT IN operator, except anti joins ignore NULL values from the right table." Also, "the result will never have more rows than the left hand side table." Source: DuckDB FROM clause.
- **BigQuery** matches PostgreSQL: "NOT IN returns FALSE if an equal value is found, TRUE if an equal value is excluded, otherwise NULL."
- **Snowflake:** the docs say "NOT IN comparisons with NULL also return NULL if any value in the list is NULL", and show `1 NOT IN (1, 2, NULL)` returning NULL. Standard SQL logic (and DuckDB, below) gives FALSE. Inside `WHERE`, NULL and FALSE both drop the row, so the result of an anti-join filter is the same either way. The lesson says only what the Snowflake docs say, without explaining why.

## Checked on the pinned engine (DuckDB v1.4.3, duckdb-wasm 1.32.0)

Probe with `c(id) = {1, 2, 3}` and `o(cid) = {1, 1, NULL}`:

| Query | Result |
|---|---|
| `1 NOT IN (1, 2, NULL)` | `false` |
| `3 NOT IN (1, 2, NULL)` | `NULL` |
| `WHERE id NOT IN (SELECT cid FROM o)` | no rows |
| `NOT EXISTS`, `ANTI JOIN` and `LEFT JOIN ... WHERE o.cid IS NULL` | 2, 3 |
| `SEMI JOIN` | 1 (once, even though 1 matches twice) |
| `count(*)` of `c JOIN o` | 2 (fan-out: id 1 matches two rows) |

The exercises in `02-joins-that-change-row-counts.exercises.ts` encode these behaviours as known-wrong answers, so CI re-checks them on every engine upgrade.

## Open questions

None.
