import type { TrackId } from './schema';

export interface Track {
  id: TrackId;
  title: string;
  blurb: string;
  engine: string;
}

export const TRACKS: Track[] = [
  { id: 'sql', title: 'SQL', engine: 'DuckDB in your browser', blurb: 'Joins, window functions, CTEs, deduplication, gaps and islands, and slowly changing dimensions.' },
  { id: 'python', title: 'Python for data engineering', engine: 'Pyodide in your browser', blurb: 'Parsing, generators, file I/O, pandas, and data-cleaning functions.' },
  { id: 'modelling', title: 'Data modelling', engine: 'Schema builder + DuckDB', blurb: 'Star schemas, choosing the grain, SCD types 1, 2 and 6, and Data Vault.' },
  { id: 'dsa', title: 'DSA for data engineers', engine: 'Pyodide + visualizers', blurb: 'Hash partitioning, external sort, heaps, Bloom filters, HyperLogLog, B-trees and LSM trees.' },
  { id: 'rust', title: 'Rust', engine: 'Puzzles + Rust Playground', blurb: 'Ownership and borrowing, iterators, error handling, and a small ETL tool.' },
];

export const trackById = (id: string) => TRACKS.find((t) => t.id === id);
