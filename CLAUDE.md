# pipeline-dojo

An interactive, hands-on guide to data engineering. Learners read a short lesson,
then write SQL, Python or a data model, and get checked automatically. Everything
runs in the browser. There is no backend, no account and no API key.

**Status:** M0 is merged and deployed to GitHub Pages. M1 (the SQL track) is in
progress on `feat/m1-sql-track`; lessons 01–03 are drafted.

## Goals, in priority order

1. **Accuracy.** Learners will trust this content, so every claim and every exercise
   has to be checked (see "Accuracy rules"). If accuracy and speed conflict,
   accuracy wins.
2. **Clone and learn.** `git clone` → `npm install` → `npm run dev` must work offline
   after install, with no keys and no extra services.
3. **Portfolio showcase.** The code and the research trail should be easy to follow
   and show good engineering. The showcase page will go at
   https://sagararora492.github.io/projects/pipeline-dojo/ (repo
   `sagararora492/sagararora492.github.io`, local `../sagararora492.github.io`).

## Decisions already made

- **Stack:** Vite + React + TypeScript. Lessons are MDX, so interactive components
  can be embedded in them. The code editor is CodeMirror 6.
- **SQL engine:** DuckDB-WASM. **Python engine:** Pyodide. Both run in Web Workers
  and load only on lessons that need them.
- **Self-host the WASM and runtime files** (copy them from node_modules at build
  time). Never load them from a CDN, so a clone works offline.
- **Progress** is stored in localStorage, with JSON export and import. There are no
  accounts in v1.
- **Node:** version pinned in `.nvmrc` (24, the LTS). The user manages Node with fnm.
- **Tests:** Vitest for the checkers and content validation; Playwright for one
  smoke test per track.
- **Deployment:** GitHub Pages for this repo, built by GitHub Actions. Set Vite's
  `base` so the site works under `/pipeline-dojo/`.

## Tracks and how each is checked

| Track | Exercises | Engine and checker |
|---|---|---|
| SQL | Joins, window functions, CTEs, deduplication, gaps-and-islands, SCD queries | DuckDB-WASM. The learner's result set is compared with a reference query's result. Row order is ignored unless the exercise requires it. |
| Python for DE | Parsing, generators, file I/O, pandas, data-cleaning functions | Pyodide, with hidden assert-based tests |
| DSA for DE | Hash partitioning, external merge sort, top-k with heaps, Bloom filters, HyperLogLog, consistent hashing, B-trees vs LSM trees | Pyodide tests plus step-through visualizers |
| Data modelling | Star schemas, choosing the grain, SCD types 1, 2 and 6, 3NF vs Data Vault vs wide tables | Interactive schema builder. A checker validates the grain, keys and SCD columns, and learners can then query their model in DuckDB. |
| Rust | Ownership and borrowing, iterators, errors, a small CSV/ETL tool | No in-browser compiler. Use predict-the-output questions, borrow-checker puzzles, and an optional link to the Rust Playground. |

Later tracks: orchestration (a DAG simulator showing retries, backfills and
idempotency), streaming (partitions, offsets, watermarks), Parquet internals,
Spark shuffles and skew, and data quality.

## Accuracy rules (required)

- **Lesson frontmatter** must include `track`, `order`, `prerequisites`,
  `estimated_minutes`, `status` (`draft` | `reviewed` | `verified`), `sources`
  (prefer primary sources: official docs, Kimball, the original papers) and
  `verified_against` (e.g. `duckdb: 1.x`, `python: 3.12 (pyodide 0.x)`, `rust: 1.x`).
  CI rejects lessons that are missing these fields.
- **Every exercise** includes a reference solution that must pass, and at least one
  known-wrong answer that must fail. CI runs both on the same engine versions the
  browser uses.
- **Pin engine versions exactly.** If DuckDB-WASM or Pyodide is upgraded, re-run
  every exercise and update `verified_against`.
- **SQL lessons** point out where DuckDB differs from Postgres, Snowflake and
  BigQuery.
- **No uncited facts.** Mark anything uncertain `[VERIFY]` in drafts. A lesson can't
  move to `verified` while any `[VERIFY]` remains.
- The site shows each lesson's status as a badge.

## Writing content together

The user and Claude research each topic together:

1. Gather notes and links in `research/<track>/<topic>.md`. Both add findings there.
2. Claude drafts the lesson from the notes and marks any uncertain claim `[VERIFY]`.
3. The user reviews and challenges the draft, and Claude makes the fixes. The
   lesson then moves to `reviewed`.
4. When CI passes and no `[VERIFY]` remains, it moves to `verified`.

Don't present unverified material as fact. When something is unsure, say so and
cite a source.

## Planned layout

```text
src/
  engines/        # duckdb + pyodide workers, checkers
  components/     # editor, exercise blocks, visualizers, schema builder
  app/            # routing, track pages, progress storage
content/<track>/NN-slug.mdx
content/<track>/NN-slug.exercises.ts   # exercises, run by tests/exercises.test.ts
datasets/         # small seed CSV/Parquet files, with their origin documented
research/<track>/ # shared research notes
tests/
```

## Milestones

- **M0 – Skeleton:** Vite app, routing, track pages, MDX lesson renderer,
  frontmatter validation, progress storage, one sample SQL exercise working from
  start to finish on DuckDB-WASM, CI that runs reference and wrong-answer checks,
  and the Pages deploy.
- **M1 – SQL track** (8–10 lessons). M0 + M1 is the first version worth demoing.
- **M2 – Python** · **M3 – Data modelling** · **M4 – DSA for DE** · **M5 – Rust** ·
  **M6 – Polish** (search, progress dashboard, mobile layout, accessibility, the
  portfolio page).

## How the SQL checker works

- Each attempt runs in a fresh `ATTACH ':memory:'` database built from the
  exercise's `setup`, so attempts can't affect each other.
- The answer is wrapped in a temp view and every column is cast to `VARCHAR`,
  so values compare in DuckDB's own text form (no Arrow decoding in JS).
- Results are compared as multisets (duplicates count). Row order is checked only
  when `ordered: true`, and column names only when `checkColumnNames: true`.
- Tests use the blocking Node build of the same `@duckdb/duckdb-wasm` package
  (`tests/helpers/duckdb-node.ts`). `tests/exercises.test.ts` also checks that
  each lesson's `verified_against.duckdb` matches the engine's `version()`.
- The engine version is pinned exactly in `package.json`. DuckDB-WASM 1.32.0
  ships DuckDB v1.4.3.

## Conventions

- The user makes every commit. Claude leaves changes uncommitted, and doesn't
  push, even when fixing CI.
- Start each piece of work on a `feat/` branch cut from the latest `main`.
- Open PRs against `main`; CI must pass before merging.
- Don't push, create GitHub repos or change GitHub settings without the user's
  go-ahead.
