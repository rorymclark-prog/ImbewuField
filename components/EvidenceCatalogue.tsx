'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useDialogFocus } from '@/lib/use-dialog-focus';
import { EVIDENCE_CATALOGUE, EVIDENCE_GROUP_ICON, INDIGENOUS_EDIBLES } from '@/lib/evidence-catalogue';
import { getGroupCount, type EvidenceItem } from '@/lib/site-evidence';
import EvidenceSheet from './EvidenceSheet';
import type { EvidenceCatalogueGroup, EvidenceCatalogueItem } from '@/lib/evidence-catalogue';
import { useLanguage } from '@/lib/i18n';
import { useEscapeClose } from '@/lib/use-escape-close';

interface Props {
  siteId: string;
  onClose: () => void;
  onChanged: () => void;
}

export default function EvidenceCatalogue({ siteId, onClose, onChanged }: Props) {
  const { t } = useLanguage();
  const [activeSheet, setActiveSheet] = useState<{ group: EvidenceCatalogueGroup; item: EvidenceCatalogueItem } | null>(null);
  const [, forceUpdate] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, dialogRef);

  function handleChanged() {
    forceUpdate((n) => n + 1);
    onChanged();
  }

  // Close on Escape — matches every other bottom sheet in the app (AddSheet, ThemePanel, etc).
  useEscapeClose(true, onClose);

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('evidenceCatalogueTitle')}
          className="w-full max-w-2xl font-sans overflow-y-auto"
          style={{
            background: 'var(--bg-1)', borderRadius: '22px 22px 0 0',
            maxHeight: '92dvh', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
          }}
        >
          {/* Header */}
          <div style={{ padding: '20px 22px 0', position: 'sticky', top: 0, background: 'var(--bg-1)', zIndex: 2, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ font: '700 12px/1 var(--font-sans), sans-serif', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 7 }}>
                  {t('evidenceCatalogueTitle')}
                </div>
                <div style={{ font: '600 22px/1.1 var(--font-display), Georgia, serif', color: 'var(--text-primary)' }}>
                  {t('evidenceCatalogueHeading')}
                </div>
                <div style={{ font: '400 13.5px/1.5 var(--font-display), Georgia, serif', color: 'var(--text-secondary)', marginTop: 6, maxWidth: 460 }}>
                  {t('evidenceCatalogueIntro')}
                </div>
              </div>
              <button onClick={onClose} aria-label={t('evidenceSheetClose')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0, minWidth: 44, minHeight: 44, display: 'grid', placeItems: 'center' }}>
                <X size={22} />
              </button>
            </div>
          </div>

          {/* Catalogue groups */}
          <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {EVIDENCE_CATALOGUE.map((group) => {
              const count = getGroupCount(siteId, group.key);
              const GroupIcon = EVIDENCE_GROUP_ICON[group.key];
              return (
                <div key={group.key} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 17px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: group.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <GroupIcon size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ font: '600 15px/1 var(--font-sans), sans-serif', color: 'var(--text-primary)' }}>{group.label}</span>
                    </div>
                    {count > 0 && (
                      <span style={{ font: '600 12px/1 var(--font-sans), sans-serif', color: group.color, background: group.bg, padding: '4px 9px', borderRadius: 20 }}>
                        {count} {count === 1 ? t('reportItemSingular') : t('reportItemPlural')}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {group.items.map((item) => {
                      const itemKey = `${group.key}_${item.key}`;
                      const isInvasive = item.invasive;
                      const chipColor = isInvasive ? 'var(--orange)' : group.color;
                      const chipBg = isInvasive ? 'color-mix(in srgb, var(--orange) 14%, var(--bg-1))' : group.bg;
                      const chipBorder = isInvasive ? 'color-mix(in srgb, var(--orange) 30%, transparent)' : group.bg;
                      return (
                        <button
                          key={item.key}
                          onClick={() => setActiveSheet({ group, item })}
                          style={{
                            font: '500 12.5px/1 var(--font-sans), sans-serif',
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
            <div style={{ display: 'flex', gap: 14, background: 'var(--color-forest-800)', borderRadius: 14, padding: '18px 20px', alignItems: 'center' }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--color-forest-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--on-forest-800)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 9h6v6H9z" /><path d="M9 9 4.5 4.5M15 9l4.5-4.5M9 15l-4.5 4.5M15 15l4.5 4.5" />
                  <circle cx="4.5" cy="4.5" r="1.6" /><circle cx="19.5" cy="4.5" r="1.6" />
                  <circle cx="4.5" cy="19.5" r="1.6" /><circle cx="19.5" cy="19.5" r="1.6" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ font: '600 14.5px/1.2 var(--font-sans), sans-serif', color: 'var(--on-forest-800)' }}>{t('evidenceCatalogueDroneTitle')}</div>
                <div style={{ font: '400 13px/1.45 var(--font-display), Georgia, serif', color: 'color-mix(in srgb, var(--on-forest-800) 75%, transparent)', marginTop: 3, fontStyle: 'italic' }}>
                  {t('evidenceCatalogueDroneBody')}
                </div>
              </div>
              <span style={{ font: '600 12px/1 var(--font-sans), sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-forest-800)', background: 'var(--on-forest)', padding: '6px 12px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {t('evidenceCatalogueMentorOnly')}
              </span>
            </div>

            {/* Indigenous edibles reference */}
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ font: '400 14px/1.5 var(--font-display), Georgia, serif', color: 'var(--text-primary)', marginBottom: 14 }}>
                {t('evidenceCatalogueEdiblesHeading')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {INDIGENOUS_EDIBLES.map((sp, i) => (
                  <div key={sp.name} style={{
                    display: 'flex', alignItems: 'baseline', gap: 10,
                    paddingBottom: i < INDIGENOUS_EDIBLES.length - 1 ? 10 : 0,
                    borderBottom: i < INDIGENOUS_EDIBLES.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span style={{ font: '600 14.5px/1 var(--font-display), Georgia, serif', color: 'var(--text-primary)', flexShrink: 0, width: 110 }}>
                      {sp.name}
                      {sp.protected && <span style={{ font: '400 12px/1 var(--font-sans), sans-serif', color: 'var(--color-forest-700)', marginLeft: 4 }}>·{t('evidenceCatalogueEdiblesProtected')}</span>}
                    </span>
                    <span style={{ font: '400 12px/1 var(--font-sans), sans-serif', color: 'var(--text-muted)' }}>{sp.desc}</span>
                  </div>
                ))}
              </div>
              <div style={{ font: '400 13px/1.5 var(--font-display), Georgia, serif', color: 'var(--text-secondary)', marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                {t('evidenceCatalogueEdiblesFooter')}
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
