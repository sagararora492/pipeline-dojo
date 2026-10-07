import type { ResultSet } from './types';

/** The small slice of an Arrow table the runners read. */
interface ArrowLike {
  numRows: number;
  numCols: number;
  schema: { fields: { name: string }[] };
  getChildAt(index: number): { get(row: number): unknown } | null;
}

/**
 * Convert a result whose columns were all cast to VARCHAR. Anything else is a
 * bug in the caller, so fail loudly instead of guessing a text form. Columns
 * are read by position because a result can repeat a column name.
 */
export function toResultSet(table: ArrowLike): ResultSet {
  const columns = Array.from({ length: table.numCols }, (_, i) => table.getChildAt(i));
  const rows = Array.from({ length: table.numRows }, (_, r) =>
    columns.map((column) => {
      const v = column?.get(r);
      if (v === null || v === undefined) return null;
      if (typeof v !== 'string') throw new Error(`Expected a VARCHAR value, got ${typeof v}`);
      return v;
    }),
  );
  return { columns: table.schema.fields.map((f) => f.name), rows };
}
