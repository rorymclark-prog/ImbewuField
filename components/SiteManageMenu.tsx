'use client';

// The site-report header's "⋯" menu — where a beginner naturally looks to rename,
// set-as-main, or delete the site they're viewing (instead of hunting through the map's
// "Find your land" tools box). Self-contained: calls savePlace/deletePlace/setMainSiteId,
// which all fire 'permamap-places-changed', so the report, map and home refresh reactively.

import { useState, useEffect, useRef } from 'react';
import { MoreVertical, Pencil, Star, Trash2, Check } from 'lucide-react';
import { savePlace, deletePlace, setMainSiteId, getMainSiteId, type SavedPlace } from '@/lib/saved-places';
import { useLanguage } from '@/lib/i18n';

const GOLD = '#C07A1E';
const FOREST = '#1F4D2B';
const INK = '#20190F';
const MUTED = '#5C5040';
const BORDER = '#E2D8C4';
const DANGER = '#C0531E';

export default function SiteManageMenu({ place }: { place: SavedPlace }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'menu' | 'rename' | 'confirm'>('menu');
  const [name, setName] = useState(place.name);
  const [isMain, setIsMain] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Keep the input in sync with the place name, but never clobber what the user is
  // actively typing (e.g. a cross-device rename landing mid-edit).
  useEffect(() => { if (mode !== 'rename') setName(place.name); }, [place.name, mode]);
  useEffect(() => { if (open) setIsMain(getMainSiteId() === place.id); }, [open, place.id]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const id = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() { setOpen(false); setMode('menu'); }
  function doRename() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== place.name) savePlace({ ...place, name: trimmed });
    close();
  }
  function doSetMain() { setMainSiteId(place.id); close(); }
  function doDelete() { deletePlace(place.id); close(); }

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
    minHeight: 44, padding: '0 12px', borderRadius: 9, border: 'none', background: 'transparent',
    cursor: 'pointer', fontSize: 14, fontFamily: 'var(--font-display)', color: INK,
  };
  const btnPrimary: React.CSSProperties = {
    flex: 1, minHeight: 40, borderRadius: 9, border: 'none', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    background: FOREST, color: '#F7F2E9', fontSize: 13.5, fontWeight: 600,
  };
  const btnGhost: React.CSSProperties = {
    minHeight: 40, padding: '0 12px', borderRadius: 9, border: `1px solid ${BORDER}`, cursor: 'pointer',
    background: '#FFFEFA', color: MUTED, fontSize: 13.5, fontWeight: 600,
  };

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('manageSite')}
        aria-expanded={open}
        style={{
          width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: open ? 'rgba(31,77,43,0.08)' : 'transparent', border: `1px solid ${open ? BORDER : 'transparent'}`,
          color: MUTED, cursor: 'pointer',
        }}
      >
        <MoreVertical size={18} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 6, zIndex: 60, width: 232,
            background: '#FFFEFA', border: `1px solid ${BORDER}`, borderRadius: 12,
            boxShadow: '0 10px 30px rgba(32,25,15,0.18)', padding: 6,
          }}
        >
          {mode === 'menu' && (
            <>
              <button type="button" style={rowStyle} onClick={() => setMode('rename')}>
                <Pencil size={16} style={{ color: MUTED, flexShrink: 0 }} /> {t('renameSite')}
              </button>
              <button type="button" style={{ ...rowStyle, cursor: isMain ? 'default' : 'pointer' }} onClick={isMain ? undefined : doSetMain} disabled={isMain}>
                <Star size={16} style={{ color: isMain ? GOLD : MUTED, flexShrink: 0, fill: isMain ? GOLD : 'none' }} />
                <span style={{ color: isMain ? MUTED : INK }}>{isMain ? t('mainSiteAlready') : t('setMainSite')}</span>
                {isMain && <Check size={15} style={{ color: GOLD, marginLeft: 'auto' }} />}
              </button>
              <button type="button" style={{ ...rowStyle, color: DANGER }} onClick={() => setMode('confirm')}>
                <Trash2 size={16} style={{ color: DANGER, flexShrink: 0 }} /> {t('deleteSite')}
              </button>
            </>
          )}

          {mode === 'rename' && (
            <div style={{ padding: 6 }}>
              <input
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') doRename(); }}
                aria-label={t('renameSite')}
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 14, color: INK, outline: 'none', fontFamily: 'var(--font-display)' }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button type="button" style={btnPrimary} onClick={doRename}><Check size={14} /> {t('saveBtn')}</button>
                <button type="button" style={btnGhost} onClick={() => setMode('menu')}>{t('cancelBtn')}</button>
              </div>
            </div>
          )}

          {mode === 'confirm' && (
            <div style={{ padding: 8 }}>
              <div style={{ fontSize: 13.5, color: INK, marginBottom: 10, lineHeight: 1.4, fontFamily: 'var(--font-display)' }}>{t('deleteSiteConfirm')}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" style={{ ...btnPrimary, background: DANGER }} onClick={doDelete}><Trash2 size={14} /> {t('deleteSite')}</button>
                <button type="button" style={btnGhost} onClick={() => setMode('menu')}>{t('cancelBtn')}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
