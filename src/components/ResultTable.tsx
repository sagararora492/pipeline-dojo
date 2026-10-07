import type { ResultSet } from '../engines/sql/types';

const MAX_ROWS = 100;

export function ResultTable({ result, caption }: { result: ResultSet; caption: string }) {
  const shown = result.rows.slice(0, MAX_ROWS);
  return (
    <div className="result-wrap">
      <table className="result">
        <caption>
          {caption} · {result.rows.length} row{result.rows.length === 1 ? '' : 's'}
          {result.rows.length > MAX_ROWS && `, first ${MAX_ROWS} shown`}
        </caption>
        <thead>
          <tr>{result.columns.map((c, i) => <th key={i} scope="col">{c}</th>)}</tr>
        </thead>
        <tbody>
          {shown.map((row, r) => (
            <tr key={r}>
              {row.map((v, c) => <td key={c} className={v === null ? 'null' : undefined}>{v ?? 'NULL'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
