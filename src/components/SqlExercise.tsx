import { useEffect, useState, type ReactNode } from 'react';
import type { CheckResult } from '../engines/sql/check';
import type { ResultSet, SqlExercise as Exercise, SqlRunner } from '../engines/sql/types';
import { dedent } from '../app/dedent';
import { updateExercise, useProgress } from '../app/progress';
import { CodeEditor } from './CodeEditor';
import { ResultTable } from './ResultTable';

type Engine = { runner: SqlRunner; check: typeof import('../engines/sql/check') };

// Loaded on demand so pages without SQL exercises never download DuckDB.
let enginePromise: Promise<Engine> | undefined;
function loadEngine(): Promise<Engine> {
  enginePromise ??= Promise.all([import('../engines/sql/browser'), import('../engines/sql/check')])
    .then(async ([browser, check]) => ({ runner: await browser.getBrowserRunner(), check }))
    .catch((error) => {
      enginePromise = undefined;
      throw error;
    });
  return enginePromise;
}

type Output =
  | { kind: 'idle' }
  | { kind: 'busy'; label: string }
  | { kind: 'rows'; result: ResultSet }
  | { kind: 'check'; result: CheckResult }
  | { kind: 'error'; message: string };

export function SqlExercise({ exercise, children }: { exercise: Exercise; children: ReactNode }) {
  const saved = useProgress().exercises[exercise.id];
  const [sql, setSql] = useState(saved?.lastAnswer ?? exercise.starter);
  const [engine, setEngine] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [output, setOutput] = useState<Output>({ kind: 'idle' });
  const [hintsShown, setHintsShown] = useState(0);
  const [showSolution, setShowSolution] = useState(false);

  useEffect(() => {
    let live = true;
    loadEngine().then(
      () => live && setEngine('ready'),
      () => live && setEngine('failed'),
    );
    return () => {
      live = false;
    };
  }, []);

  const save = (value: string) => {
    setSql(value);
    updateExercise(exercise.id, { lastAnswer: value });
  };

  async function run() {
    setOutput({ kind: 'busy', label: 'Running…' });
    try {
      const { runner, check } = await loadEngine();
      setOutput({ kind: 'rows', result: await check.runInSandbox(runner, exercise, sql) });
    } catch (error) {
      setOutput({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }

  async function submit() {
    setOutput({ kind: 'busy', label: 'Checking…' });
    try {
      const { runner, check } = await loadEngine();
      const result = await check.checkSqlAnswer(runner, exercise, sql);
      if (result.status === 'correct' && !saved?.solvedAt) {
        updateExercise(exercise.id, { solvedAt: new Date().toISOString() });
      }
      setOutput({ kind: 'check', result });
    } catch (error) {
      setOutput({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }

  const busy = output.kind === 'busy' || engine !== 'ready';
  const hints = exercise.hints ?? [];

  return (
    <section className="exercise" aria-labelledby={`${exercise.id}-title`}>
      <header className="exercise-head">
        <h3 id={`${exercise.id}-title`}>{exercise.title}</h3>
        {saved?.solvedAt && <span className="solved">✓ Solved</span>}
      </header>
      <div className="exercise-prompt">{children}</div>

      <CodeEditor value={sql} onChange={save} onSubmit={submit} label={`SQL answer for ${exercise.title}`} />

      <div className="toolbar">
        <button type="button" onClick={run} disabled={busy}>Run</button>
        <button type="button" className="primary" onClick={submit} disabled={busy}>Check answer</button>
        <span className="kbd-hint">Ctrl/⌘ + Enter to check</span>
        <span className="spacer" />
        {hintsShown < hints.length && (
          <button type="button" className="ghost" onClick={() => setHintsShown((n) => n + 1)}>
            Hint {hintsShown + 1}/{hints.length}
          </button>
        )}
        <button type="button" className="ghost" onClick={() => save(exercise.starter)}>Reset</button>
      </div>

      <p className="engine-status" role="status">
        {engine === 'loading' && 'Starting DuckDB in your browser…'}
        {engine === 'failed' && 'DuckDB failed to start. Reload the page to try again.'}
      </p>

      {hintsShown > 0 && (
        <ol className="hints">
          {hints.slice(0, hintsShown).map((h) => <li key={h}>{h}</li>)}
        </ol>
      )}

      <div aria-live="polite">
        {output.kind === 'busy' && <p className="muted">{output.label}</p>}
        {output.kind === 'error' && <pre className="feedback feedback-error">{output.message}</pre>}
        {output.kind === 'rows' && <ResultTable result={output.result} caption="Your result" />}
        {output.kind === 'check' && <CheckFeedback result={output.result} />}
      </div>

      {(saved?.solvedAt || showSolution) ? (
        <details className="solution" open={showSolution}>
          <summary>Reference solution</summary>
          <pre><code>{dedent(exercise.reference)}</code></pre>
        </details>
      ) : (
        <button type="button" className="ghost reveal" onClick={() => setShowSolution(true)}>
          Show the solution
        </button>
      )}
    </section>
  );
}

function CheckFeedback({ result }: { result: CheckResult }) {
  if (result.status === 'error') return <pre className="feedback feedback-error">{result.message}</pre>;
  if (result.status === 'correct') {
    return (
      <>
        <p className="feedback feedback-correct">Correct. Your result matches the reference.</p>
        <ResultTable result={result.actual} caption="Your result" />
      </>
    );
  }
  return (
    <>
      <div className="feedback feedback-incorrect">
        <p>Not quite:</p>
        <ul>{result.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      </div>
      <div className="compare">
        <ResultTable result={result.actual} caption="Your result" />
        <ResultTable result={result.expected} caption="Expected" />
      </div>
    </>
  );
}
