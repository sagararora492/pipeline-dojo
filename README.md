# pipeline-dojo

An interactive, hands-on guide to data engineering.

Read a short lesson, then practise straight away: write SQL against realistic
datasets, solve Python exercises, step through the algorithms behind data systems,
and design data models. Your answers are checked automatically. Everything runs in
your browser, with no accounts, servers or API keys.

> **Status:** early development. The skeleton works end to end with one sample SQL
> lesson. The plan is in [CLAUDE.md](CLAUDE.md).

## Tracks

- **SQL**: joins, window functions, CTEs, deduplication, slowly changing dimensions
- **Python for data engineering**: parsing, generators, file I/O, pandas
- **DSA for data engineers**: partitioning, external sorting, heaps, Bloom filters,
  HyperLogLog, B-trees and LSM trees
- **Data modelling**: star schemas, grain, SCD types, Data Vault
- **Rust**: ownership, iterators, error handling, a small ETL tool

## Accuracy

Every lesson lists its sources and the engine versions it was checked against, and
shows its review status (`draft`, `reviewed` or `verified`). CI runs every
exercise's reference solution, plus known-wrong answers that must be rejected.

## Getting started

Requires Node.js 24 (see `.nvmrc`).

```bash
git clone https://github.com/sagararora492/pipeline-dojo.git
cd pipeline-dojo
npm install
npm run dev
```

After `npm install`, the site works offline. DuckDB's WebAssembly build is served
by the site itself, not from a CDN.

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Validate lesson frontmatter and run every exercise's reference and known-wrong answers on DuckDB-WASM |
| `npm run test:e2e` | Build the site and solve a sample exercise in Chromium with outside network blocked (run `npx playwright install chromium` once first) |
| `npm run build` | Typecheck and build to `dist/` |

## Adding a lesson

1. Write research notes in `research/<track>/<topic>.md`, with sources.
2. Add `content/<track>/NN-slug.mdx`. Its frontmatter needs `title`, `summary`,
   `track`, `order`, `prerequisites`, `estimated_minutes`, `status`, `sources` and
   `verified_against`. `npm test` reports any that are missing.
3. Put SQL exercises in `content/<track>/NN-slug.exercises.ts`, each with a
   `reference` solution and at least one `wrongAnswers` entry. Embed them in the
   lesson with `<SqlExercise exercise={...}>prompt</SqlExercise>`.

See [`content/sql/01-latest-row-per-key.mdx`](content/sql/01-latest-row-per-key.mdx)
for a complete example.
