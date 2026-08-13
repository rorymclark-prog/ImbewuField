'use client';

import { useState, useEffect, useRef } from 'react';
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
  // Hide the FAB while the map is in boundary-draw mode (the draw bar owns the
  // bottom-left corner). The farmer map broadcasts this via a window event.
  const [drawing, setDrawing] = useState(false);
  useEffect(() => {
    const h = (e: Event) => setDrawing(!!(e as CustomEvent).detail);
    window.addEventListener('imbewu-drawing', h);
    return () => window.removeEventListener('imbewu-drawing', h);
  }, []);

  // Draggable launcher: no single fixed corner is free on every page (map
  // controls own bottom-right, palettes/nav own the others), so let the user
  // park Lima wherever suits their screen. Position persists per device; a tap
  // (movement under the drag threshold) still opens Lima.
  const FAB_SIZE = 56;
  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean; lx: number; ly: number } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('imbewu_lima_fab_pos');
      if (!raw) return;
      const p = JSON.parse(raw);
      if (typeof p?.x !== 'number' || typeof p?.y !== 'number') return;
      // Clamp a saved position back into view in case the viewport shrank.
      const x = Math.max(8, Math.min(window.innerWidth - FAB_SIZE - 8, p.x));
      const y = Math.max(8, Math.min(window.innerHeight - FAB_SIZE - 8, p.y));
      setFabPos({ x, y });
    } catch { /* ignore */ }
  }, []);

  function onFabPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: e.clientX - rect.left, oy: e.clientY - rect.top, moved: false, lx: rect.left, ly: rect.top };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }
  function onFabPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return;
    d.moved = true;
    const x = Math.max(8, Math.min(window.innerWidth - FAB_SIZE - 8, e.clientX - d.ox));
    const y = Math.max(8, Math.min(window.innerHeight - FAB_SIZE - 8, e.clientY - d.oy));
    d.lx = x; d.ly = y;
    setFabPos({ x, y });
  }
  function onFabPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (!d) return;
    if (!d.moved) { setOpen(true); return; } // it was a tap, not a drag → open Lima
    try { localStorage.setItem('imbewu_lima_fab_pos', JSON.stringify({ x: d.lx, y: d.ly })); } catch { /* ignore */ }
  }

  // Skip on auth pages, home (which has LimaBar), and the Design Studio (its
  // bottom-docked tool palette owns the bottom-left corner — the FAB covered Select).
  if (
    pathname.startsWith('/gate') || pathname.startsWith('/login') ||
    pathname.startsWith('/home') || pathname.startsWith('/design')
  ) return null;

  // WHERE THE FAB PARKS WHEN NOBODY HAS MOVED IT.
  //
  // /home and /design opt out of this widget entirely, above, because something else owns the
  // bottom-left corner there. /farmer cannot opt out — the map is exactly where a farmer needs
  // Lima — but it DOES put a "+ Add" pill in that corner, added under the comment "LimaBar is not
  // mounted on /farmer, so bottom-left is free". True of LimaBar, false of this FAB, which has
  // been sitting on top of Add ever since. Rory, 12 Aug: "look at all the buttons that are
  // covering each other sort those out".
  //
  // That pill sits at calc(60px + safe-area + 36px) — 96px up — and stands about 41px tall, so it
  // reaches ~137px. 188px clears it with a thumb's width to spare. Only below lg, because the
  // pill is lg:hidden and the desktop corner really is free.
  const FAB_DEFAULT_POS = pathname.startsWith('/farmer')
    ? 'bottom-[188px] left-4 lg:bottom-[100px] lg:left-4'
    : 'bottom-[130px] left-4 lg:bottom-[100px] lg:left-4';

  const lang = typeof window !== 'undefined' ? localStorage.getItem('permamap_lang') ?? undefined : undefined;

  return (
    <>
      {/* Launcher FAB — draggable; defaults bottom-left, remembers where you park it */}
      {!open && !drawing && (
        <button
          onPointerDown={onFabPointerDown}
          onPointerMove={onFabPointerMove}
          onPointerUp={onFabPointerUp}
          aria-label="Open Lima, your field guide — drag to move"
          title="Tap to ask Lima · drag to move"
          className={`no-print fixed z-[60] flex items-center justify-center rounded-full w-14 h-14 ${fabPos ? '' : FAB_DEFAULT_POS}`}
          style={{
            background: 'linear-gradient(135deg, var(--brand-light), var(--brand-strong))',
            // Soft glow ring — Lima's "2026 AI presence" (spec §6, adapted to green).
            boxShadow: '0 0 0 6px rgba(31,77,43,0.12), 0 8px 24px rgba(31,77,43,0.30)',
            touchAction: 'none',
            cursor: 'grab',
            ...(fabPos ? { left: fabPos.x, top: fabPos.y } : {}),
          }}
        >
          <Sprout size={22} className="text-white" strokeWidth={1.75} />
        </button>
      )}

      {open && (
        <>
          <div
            className="no-print fixed inset-0 z-[60]"
            style={{ background: 'rgba(226,216,196,0.5)', backdropFilter: 'blur(2px)' }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="no-print u-glass u-anim-sheet fixed z-[61] flex flex-col bottom-0 left-0 right-0 md:right-auto md:bottom-4 md:left-4 w-full md:w-[400px] rounded-t-2xl md:rounded-2xl overflow-hidden"
            style={{
              // .u-glass supplies the warm cream glass background + border + blur
              // (with an @supports solid fallback for low-end Android). .u-anim-sheet
              // gives the settle entrance. Only the warm shadow is left inline.
              height: '82dvh',
              maxHeight: 720,
              boxShadow: '0 -4px 24px rgba(32,25,15,0.12)',
            }}
          >
            {/* Header */}
            <div
              className="flex-shrink-0 flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,254,250,0.55)' }}
            >
              <div
                className="flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--brand-light), var(--brand-strong))', width: 36, height: 36 }}
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
