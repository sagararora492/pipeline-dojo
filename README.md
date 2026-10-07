# pipeline-dojo

An interactive, hands-on guide to data engineering.

Read a short lesson, then practise straight away: write SQL against realistic
datasets, solve Python exercises, step through the algorithms behind data systems,
and design data models. Your answers are checked automatically. Everything runs in
your browser, with no accounts, servers or API keys.

> **Status:** early development. The plan is in [CLAUDE.md](CLAUDE.md).

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

Requires Node.js 24 (see `.nvmrc`). Setup steps will be added once the app is
scaffolded:

```bash
git clone https://github.com/sagararora492/pipeline-dojo.git
cd pipeline-dojo
npm install
npm run dev
```
