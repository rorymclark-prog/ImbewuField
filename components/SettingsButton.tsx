'use client';

import { useState } from 'react';
import ThemePanel from './ThemePanel';

/**
 * Self-contained settings control: a ⚙ gear that opens the appearance/settings
 * panel. Drop into any page header — it manages its own open state and renders
 * the panel, so every page gets the settings section without extra wiring.
 */
export default function SettingsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Settings"
        title="Settings"
        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-display transition-all"
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1 }}>⚙</span>
        <span className="hidden sm:inline">Settings</span>
      </button>
      <ThemePanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
