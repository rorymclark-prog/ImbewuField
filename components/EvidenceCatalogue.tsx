'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { EVIDENCE_CATALOGUE, INDIGENOUS_EDIBLES } from '@/lib/evidence-catalogue';
import { getGroupCount, type EvidenceItem } from '@/lib/site-evidence';
import EvidenceSheet from './EvidenceSheet';
import type { EvidenceCatalogueGroup, EvidenceCatalogueItem } from '@/lib/evidence-catalogue';

interface Props {
  siteId: string;
  onClose: () => void;
  onChanged: () => void;
}

export default function EvidenceCatalogue({ siteId, onClose, onChanged }: Props) {
  const [activeSheet, setActiveSheet] = useState<{ group: EvidenceCatalogueGroup; item: EvidenceCatalogueItem } | null>(null);
  const [, forceUpdate] = useState(0);

  function handleChanged() {
    forceUpdate((n) => n + 1);
    onChanged();
  }

  // Close on Escape — matches every other bottom sheet in the app (AddSheet, ThemePanel, etc).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Evidence library"
          className="w-full max-w-2xl font-sans overflow-y-auto"
          style={{
            background: '#FBF8F1', borderRadius: '22px 22px 0 0',
            maxHeight: '92dvh', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
          }}
        >
          {/* Header */}
          <div style={{ padding: '20px 22px 0', position: 'sticky', top: 0, background: '#FBF8F1', zIndex: 2, borderBottom: '1px solid #EFE7D6', paddingBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ font: '700 11px/1 system-ui, sans-serif', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#B07A1E', marginBottom: 7 }}>
                  Evidence library
                </div>
                <div style={{ font: '600 22px/1.1 Newsreader, Georgia, serif', color: '#2D2519' }}>
                  The more the land tells us, the better the plan
                </div>
                <div style={{ font: '400 13.5px/1.5 Newsreader, Georgia, serif', color: '#4A4030', marginTop: 6, maxWidth: 460 }}>
                  A good site report works down the <em>scale of permanence</em> — water first, then structures & access, soil, living things, and animal systems.
                </div>
              </div>
              <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#8A7C62', flexShrink: 0 }}>
                <X size={22} />
              </button>
            </div>
          </div>

          {/* Catalogue groups */}
          <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {EVIDENCE_CATALOGUE.map((group) => {
              const count = getGroupCount(siteId, group.key);
              return (
                <div key={group.key} style={{ background: '#fff', border: '1px solid #EBE3D2', borderRadius: 14, padding: '16px 17px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: group.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>
                      {GROUP_ICON[group.key]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ font: '600 15px/1 system-ui, sans-serif', color: '#2D2519' }}>{group.label}</span>
                    </div>
                    {count > 0 && (
                      <span style={{ font: '600 11px/1 system-ui, sans-serif', color: group.color, background: group.bg, padding: '4px 9px', borderRadius: 20 }}>
                        {count} {count === 1 ? 'item' : 'items'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {group.items.map((item) => {
                      const itemKey = `${group.key}_${item.key}`;
                      const isInvasive = item.invasive;
                      const chipColor = isInvasive ? '#B05A3C' : group.color;
                      const chipBg = isInvasive ? '#F4E2DA' : group.bg;
                      const chipBorder = isInvasive ? '#E6C9BC' : group.bg;
                      return (
                        <button
                          key={item.key}
                          onClick={() => setActiveSheet({ group, item })}
                          style={{
                            font: '500 12.5px/1 system-ui, sans-serif',
                            color: chipColor, background: chipBg,
                            border: `1px solid ${chipBorder}`,
                            borderRadius: 8, padding: '7px 11px',
                            cursor: 'pointer',
                          }}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Drone / aerial — mentor only */}
            <div style={{ display: 'flex', gap: 14, background: '#274D2C', borderRadius: 14, padding: '18px 20px', alignItems: 'center' }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: '#3C6B3F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CDEBB6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 9h6v6H9z" /><path d="M9 9 4.5 4.5M15 9l4.5-4.5M9 15l-4.5 4.5M15 15l4.5 4.5" />
                  <circle cx="4.5" cy="4.5" r="1.6" /><circle cx="19.5" cy="4.5" r="1.6" />
                  <circle cx="4.5" cy="19.5" r="1.6" /><circle cx="19.5" cy="19.5" r="1.6" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ font: '600 14.5px/1.2 system-ui, sans-serif', color: '#EAF2E2' }}>Drone & aerial — captured by a mentor</div>
                <div style={{ font: '400 13px/1.45 Newsreader, Georgia, serif', color: '#B9D2B0', marginTop: 3, fontStyle: 'italic' }}>
                  When a mentor visits, their drone shots drop straight onto this site — a true overhead to design over, plus before/after records for funders.
                </div>
              </div>
              <span style={{ font: '600 10.5px/1 system-ui, sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#274D2C', background: '#CDEBB6', padding: '6px 12px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>
                Mentor only
              </span>
            </div>

            {/* Indigenous edibles reference */}
            <div style={{ background: '#F7F4EC', border: '1px solid #E6DDC9', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ font: '400 14px/1.5 Newsreader, Georgia, serif', color: '#2D2519', marginBottom: 14 }}>
                Existing indigenous trees are <strong>free yield and free shade</strong> — Lima keeps them in the design instead of clearing them.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {INDIGENOUS_EDIBLES.map((sp, i) => (
                  <div key={sp.name} style={{
                    display: 'flex', alignItems: 'baseline', gap: 10,
                    paddingBottom: i < INDIGENOUS_EDIBLES.length - 1 ? 10 : 0,
                    borderBottom: i < INDIGENOUS_EDIBLES.length - 1 ? '1px solid #EFE7D6' : 'none',
                  }}>
                    <span style={{ font: '600 14.5px/1 Newsreader, Georgia, serif', color: '#2D2519', flexShrink: 0, width: 110 }}>
                      {sp.name}
                      {sp.protected && <span style={{ font: '400 10px/1 system-ui, sans-serif', color: '#3C6B3F', marginLeft: 4 }}>·protected</span>}
                    </span>
                    <span style={{ font: '400 12px/1 system-ui, sans-serif', color: '#8A7C62' }}>{sp.desc}</span>
                  </div>
                ))}
              </div>
              <div style={{ font: '400 13px/1.5 Newsreader, Georgia, serif', color: '#6B5D44', marginTop: 14, borderTop: '1px solid #EFE7D6', paddingTop: 12 }}>
                Don't see yours? Snap it — Lima logs the unknown and a botanist or mentor can confirm it later.
              </div>
            </div>
          </div>
        </div>
      </div>

      {activeSheet && (
        <EvidenceSheet
          siteId={siteId}
          group={activeSheet.group}
          item={activeSheet.item}
          onClose={() => setActiveSheet(null)}
          onChanged={handleChanged}
        />
      )}
    </>
  );
}

const GROUP_ICON: Record<string, string> = {
  water: '💧',
  structures: '🏠',
  soil: '🌱',
  trees: '🌿',
  animals: '🐓',
  energy: '⚡',
  land_legal: '📄',
};
