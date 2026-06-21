'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type ThemeName = 'earth' | 'slate';
export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeCtx {
  theme: ThemeName;
  mode: ThemeMode;
  textScale: number;
  setTheme: (t: ThemeName) => void;
  setMode: (m: ThemeMode) => void;
  setTextScale: (n: number) => void;
}

const Ctx = createContext<ThemeCtx>({
  theme: 'earth', mode: 'system', textScale: 1,
  setTheme: () => {}, setMode: () => {}, setTextScale: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('earth');
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [textScale, setTextScaleState] = useState<number>(1);

  // Load from localStorage on mount
  useEffect(() => {
    const t = localStorage.getItem('fp-theme') as ThemeName | null;
    const m = localStorage.getItem('fp-mode') as ThemeMode | null;
    const s = parseFloat(localStorage.getItem('fp-textscale') || '');
    if (t === 'earth' || t === 'slate') setThemeState(t);
    if (m === 'light' || m === 'dark' || m === 'system') setModeState(m);
    if (s >= 1 && s <= 1.4) setTextScaleState(s);
  }, []);

  // Apply text/UI scale. The app sizes fonts in px, so a root font-size bump won't
  // reach them — `zoom` scales the whole UI uniformly (text + controls), which is what
  // "make it bigger" means here. Supported in Chrome & Safari 17+.
  useEffect(() => {
    document.documentElement.style.zoom = String(textScale);
  }, [textScale]);

  // Apply to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = mode === 'dark' || (mode === 'system' && prefersDark);
    root.classList.toggle('dark', isDark);
  }, [theme, mode]);

  // Also listen for OS dark mode changes when in 'system' mode
  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  const setTheme = (t: ThemeName) => {
    setThemeState(t);
    localStorage.setItem('fp-theme', t);
  };
  const setMode = (m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem('fp-mode', m);
  };
  const setTextScale = (n: number) => {
    setTextScaleState(n);
    localStorage.setItem('fp-textscale', String(n));
  };

  return <Ctx.Provider value={{ theme, mode, textScale, setTheme, setMode, setTextScale }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}
