'use client';

// Lightweight local progress store for the guitar studio.
// Kept in localStorage — no account or network needed to learn.

import { useCallback, useEffect, useState } from 'react';

export type GuitarProgress = {
  completedLessons: string[];
  /** ISO dates (yyyy-mm-dd) on which the learner logged practice. */
  practiceDays: string[];
};

const KEY = 'imbewu-guitar-progress';
const EMPTY: GuitarProgress = { completedLessons: [], practiceDays: [] };

function load(): GuitarProgress {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      completedLessons: Array.isArray(parsed.completedLessons) ? parsed.completedLessons : [],
      practiceDays: Array.isArray(parsed.practiceDays) ? parsed.practiceDays : [],
    };
  } catch {
    return EMPTY;
  }
}

function save(p: GuitarProgress) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage full or blocked — progress just won't persist */
  }
}

function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Consecutive practice days ending today or yesterday. */
export function streakOf(days: string[]): number {
  const set = new Set(days);
  let streak = 0;
  const cursor = new Date();
  if (!set.has(todayISO())) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const day = String(cursor.getDate()).padStart(2, '0');
    if (!set.has(`${cursor.getFullYear()}-${m}-${day}`)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function useGuitarProgress() {
  const [progress, setProgress] = useState<GuitarProgress>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setProgress(load());
    setHydrated(true);
  }, []);

  const update = useCallback((fn: (p: GuitarProgress) => GuitarProgress) => {
    setProgress((prev) => {
      const next = fn(prev);
      save(next);
      return next;
    });
  }, []);

  const toggleLesson = useCallback(
    (id: string) =>
      update((p) => ({
        ...p,
        completedLessons: p.completedLessons.includes(id)
          ? p.completedLessons.filter((l) => l !== id)
          : [...p.completedLessons, id],
      })),
    [update],
  );

  const logPracticeToday = useCallback(
    () =>
      update((p) =>
        p.practiceDays.includes(todayISO())
          ? p
          : { ...p, practiceDays: [...p.practiceDays, todayISO()] },
      ),
    [update],
  );

  return {
    hydrated,
    completedLessons: progress.completedLessons,
    practiceDays: progress.practiceDays,
    practicedToday: progress.practiceDays.includes(todayISO()),
    streak: streakOf(progress.practiceDays),
    toggleLesson,
    logPracticeToday,
  };
}
