'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sprout, X } from 'lucide-react';
import ChatPanel from './ChatPanel';

/**
 * Lima — the almanac field guide persona. Docked at the bottom of every page
 * so help is always one tap away. Pre-auth pages (gate/login) are excluded.
 * "Lima" means "to cultivate" in Nguni languages.
 */
export default function ChatWidget() {
  const pathname = usePathname() || '';
  const [open, setOpen] = useState(false);

  // Skip on auth pages and home (which has LimaBar)
  if (pathname.startsWith('/gate') || pathname.startsWith('/login') || pathname.startsWith('/home')) return null;

  const lang = typeof window !== 'undefined' ? localStorage.getItem('permamap_lang') ?? undefined : undefined;

  return (
    <>
      {/* Launcher FAB — bottom-left to avoid the map's bottom-right controls */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Lima, your field guide"
          className="fixed z-[60] bottom-[72px] left-4 flex items-center justify-center rounded-full w-14 h-14 shadow-lg transition-all"
          style={{
            backgroundColor: '#1F4D2B',
            boxShadow: '0 4px 16px rgba(32,25,15,0.20)',
          }}
        >
          <Sprout size={22} className="text-white" strokeWidth={1.75} />
        </button>
      )}

      {open && (
        <>
          <div
            className="fixed inset-0 z-[60]"
            style={{ background: 'rgba(226,216,196,0.5)', backdropFilter: 'blur(2px)' }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed z-[61] flex flex-col bottom-0 left-0 right-0 md:right-auto md:bottom-4 md:left-4 w-full md:w-[400px] rounded-t-2xl md:rounded-2xl overflow-hidden"
            style={{
              height: '82dvh',
              maxHeight: 720,
              background: '#FBF6EC',
              border: '1px solid #E2D8C4',
              boxShadow: '0 -4px 24px rgba(32,25,15,0.12)',
            }}
          >
            {/* Header */}
            <div
              className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-white"
              style={{ borderBottom: '1px solid #E2D8C4' }}
            >
              <div
                className="flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ backgroundColor: '#1F4D2B', width: 36, height: 36 }}
              >
                <Sprout size={20} className="text-white" strokeWidth={1.75} />
              </div>
              <div className="flex flex-col">
                <span
                  className="font-display italic font-semibold text-base leading-tight"
                  style={{ color: '#20190F' }}
                >
                  Lima
                </span>
                <span
                  className="text-xs leading-tight"
                  style={{ color: '#5C5040' }}
                >
                  Field Guide · ImbewuField
                </span>
              </div>
              <div className="flex-1" />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex items-center justify-center rounded-lg"
                style={{
                  width: 32,
                  height: 32,
                  background: '#F0E9D9',
                  border: '1px solid #E2D8C4',
                  color: '#5C5040',
                }}
              >
                <X size={16} />
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
