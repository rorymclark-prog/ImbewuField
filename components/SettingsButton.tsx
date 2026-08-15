'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';
import ThemePanel from './ThemePanel';

/**
 * Self-contained settings control: a gear icon that opens the appearance/settings
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
          // Tokens, not the '#FFFEFA'/'#E2D8C4'/'#20190F' this used to carry: dropped into a
          // dozen-plus page headers, so it stayed a bright light pill in dark mode — the button
          // that opens the dark-mode toggle was itself the one control ignoring it.
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
        }}
      >
        <Settings size={13} strokeWidth={1.7} />
        <span className="hidden sm:inline">Settings</span>
      </button>
      <ThemePanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
