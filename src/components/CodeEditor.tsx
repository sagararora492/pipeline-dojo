import { useEffect, useRef } from 'react';
import { basicSetup, EditorView } from 'codemirror';
import { keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// Colours come from CSS variables so the editor follows the light and dark themes.
const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--syn-keyword)', fontWeight: '600' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--syn-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--syn-number)' },
  { tag: tags.comment, color: 'var(--muted)', fontStyle: 'italic' },
  { tag: [tags.typeName, tags.standard(tags.name)], color: 'var(--syn-type)' },
  { tag: [tags.operator, tags.punctuation], color: 'var(--muted)' },
]);

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Called on Ctrl/Cmd+Enter. */
  onSubmit?: () => void;
  label: string;
}

export function CodeEditor({ value, onChange, onSubmit, label }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);
  // Keep the latest callbacks without recreating the editor on every render.
  const callbacks = useRef({ onChange, onSubmit });
  callbacks.current = { onChange, onSubmit };

  useEffect(() => {
    view.current = new EditorView({
      parent: host.current!,
      doc: value,
      extensions: [
        basicSetup,
        // CodeMirror has no DuckDB dialect; PostgreSQL's keywords are the closest match.
        sql({ dialect: PostgreSQL }),
        syntaxHighlighting(highlight),
        EditorView.lineWrapping,
        Prec.highest(
          keymap.of([{ key: 'Mod-Enter', run: () => (callbacks.current.onSubmit?.(), true) }]),
        ),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) callbacks.current.onChange(u.state.doc.toString());
        }),
        EditorView.contentAttributes.of({ 'aria-label': label }),
      ],
    });
    return () => view.current?.destroy();
    // The editor owns its document after mount; `value` only seeds it.
  }, []);

  // Apply outside changes, such as "Reset", without fighting the user's typing.
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  return <div className="editor" ref={host} />;
}
