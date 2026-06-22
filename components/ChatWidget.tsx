'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import ChatPanel from './ChatPanel';

/**
 * Global "farm assistant" — docked at the bottom of every page so help is
 * always one tap away. Pre-auth pages (gate/login) are excluded.
 */
export default function ChatWidget() {
  const pathname = usePathname() || '';
  const [open, setOpen] = useState(false);

  if (pathname.startsWith('/gate') || pathname.startsWith('/login')) return null;

  const lang = typeof window !== 'undefined' ? localStorage.getItem('permamap_lang') ?? undefined : undefined;

  return (
    <>
      {/* Launcher — bottom-left to avoid the map's bottom-right controls */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open farm assistant"
          className="fixed z-[60] bottom-4 left-4 flex items-center gap-2 px-4 py-3 rounded-full font-display font-semibold text-sm shadow-lg transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(72,168,100,0.95), rgba(56,140,80,0.9))',
            border: '1px solid rgba(72,168,100,0.6)',
            color: '#fff',
            boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
          }}
        >
          <span style={{ fontSize: 18 }}>💬</span>
          <span className="hidden sm:inline">Ask</span>
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-[60]" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            className="fixed z-[61] flex flex-col bottom-0 left-0 right-0 md:right-auto md:bottom-4 md:left-4 w-full md:w-[400px] rounded-t-2xl md:rounded-2xl overflow-hidden"
            style={{
              height: '82dvh', maxHeight: 720,
              background: 'var(--bg-1)',
              border: '1px solid var(--border-bright)',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header */}
            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="font-display font-semibold text-sm" style={{ color: 'var(--emerald-bright)' }}>🌿 Farm assistant</span>
              <div className="flex-1" />
              <button onClick={() => setOpen(false)} aria-label="Close"
                className="flex items-center justify-center rounded-lg"
                style={{ width: 32, height: 32, fontSize: 16, background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                ✕
              </button>
            </div>

            {/* Body — ChatPanel scrolls here, with its input sticky to the bottom */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
              <ChatPanel locationData={null} appLang={lang} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
