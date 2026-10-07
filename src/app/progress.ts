import { useSyncExternalStore } from 'react';
import { z } from 'zod';

const STORAGE_KEY = 'pipeline-dojo:progress';

const exerciseProgress = z.object({
  solvedAt: z.string().optional(),
  lastAnswer: z.string().optional(),
});

export const progressSchema = z.object({
  version: z.literal(1),
  exercises: z.record(z.string(), exerciseProgress),
});

export type Progress = z.infer<typeof progressSchema>;
export type ExerciseProgress = z.infer<typeof exerciseProgress>;

const empty = (): Progress => ({ version: 1, exercises: {} });

function read(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? progressSchema.safeParse(JSON.parse(raw)) : undefined;
    return parsed?.success ? parsed.data : empty();
  } catch {
    // Storage can be blocked, for example in private windows. Progress then
    // lasts for this page load only.
    return empty();
  }
}

let current = read();
const listeners = new Set<() => void>();

function write(next: Progress) {
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // See read().
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      current = read();
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export const useProgress = () => useSyncExternalStore(subscribe, () => current);

export function updateExercise(id: string, patch: ExerciseProgress) {
  write({ ...current, exercises: { ...current.exercises, [id]: { ...current.exercises[id], ...patch } } });
}

export function exportProgress(): string {
  return JSON.stringify(current, null, 2);
}

/** Replace progress with an exported file. Throws if the file isn't valid. */
export function importProgress(json: string) {
  const parsed = progressSchema.safeParse(JSON.parse(json));
  if (!parsed.success) throw new Error('This file isn’t a pipeline-dojo progress export.');
  write(parsed.data);
}

export function resetProgress() {
  write(empty());
}
