import { useState, type ChangeEvent } from 'react';
import { exportProgress, importProgress, resetProgress, useProgress } from '../progress';

export function ProgressPage() {
  const progress = useProgress();
  const [message, setMessage] = useState('');
  const solved = Object.values(progress.exercises).filter((e) => e.solvedAt).length;

  function download() {
    const url = URL.createObjectURL(new Blob([exportProgress()], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'pipeline-dojo-progress.json' });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      importProgress(await file.text());
      setMessage('Progress imported.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import failed.');
    }
    e.target.value = '';
  }

  return (
    <>
      <h1>Your progress</h1>
      <p className="lede">
        You've solved {solved} exercise{solved === 1 ? '' : 's'}. Progress is stored in this
        browser only. Export it to move it to another device.
      </p>
      <div className="toolbar">
        <button type="button" onClick={download}>Export progress</button>
        <label className="button">
          Import progress
          <input type="file" accept="application/json,.json" onChange={upload} hidden />
        </label>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            if (confirm('Clear all progress on this device?')) {
              resetProgress();
              setMessage('Progress cleared.');
            }
          }}
        >
          Clear progress
        </button>
      </div>
      <p role="status">{message}</p>
    </>
  );
}
