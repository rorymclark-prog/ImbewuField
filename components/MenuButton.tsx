'use client';

// The burger. Rory: "lets have a burger menu option on every screen."
//
// It used to exist on three (/home, /farmer, /facilitator/crops), each with its
// own useState, its own <button>, and its own size — 34px, 36px and 38px, all
// three below the 44px touch floor this app holds itself to (see the note in
// BackButton.tsx), and all three painted with hardcoded '#E2D8C4'/'rgba(32,25,15,.06)'
// hexes, so the control stayed a light chip in dark mode. Everywhere else a
// farmer who had navigated in had no way to the menu at all: no drawer, no
// links, only Back.
//
// So this is deliberately shaped like SettingsButton — self-contained, owns its
// own open state and renders the drawer itself, drop it into a header and the
// screen has a menu. One implementation means the next new screen inherits the
// touch target and the theme tokens instead of re-deriving them.
//
// tests/menu-button-coverage.test.ts is the part that keeps the promise true:
// it fails if an app page grows a <header> without one of these in it.

import { useState } from 'react';
import { Menu } from 'lucide-react';
import NavDrawer from './NavDrawer';

export default function MenuButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        title="Menu"
        className="flex-shrink-0 flex items-center justify-center rounded-full transition-all"
        style={{
          // Tokens, not hexes — the lesson SettingsButton already carries: a control
          // dropped into a dozen page headers is exactly the one that must follow
          // the theme, or dark mode has a bright chip in the corner of every screen.
          width: 44,
          height: 44,
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
        }}
      >
        <Menu size={18} strokeWidth={1.7} />
      </button>
      <NavDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
