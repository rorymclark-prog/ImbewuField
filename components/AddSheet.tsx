'use client';

// Shared "+ Add" bottom sheet — one mental model on both surfaces (spec §2.2). Opens the
// same catalog ("What do you want to add?") on the farmer map and in the Design Studio.
// The caller's onPick executes what the surface owns and deep-links the rest, so a row the
// current surface can't run shows an honest "Opens Studio" / "Opens map" chip instead of a
// go-arrow — a low-literacy farmer must never tap "Lawn" and silently context-switch.

import { useEffect, useState } from 'react';
import { useSheetDismiss } from '@/lib/sheet-dismiss';
import { ArrowRight, X } from 'lucide-react';
import SpeakButton from '@/components/SpeakButton';
import { useLanguage, translate } from '@/lib/i18n';
import {
  ADD_ACTIONS, ADD_GROUP_ORDER, ADD_GROUP_LABEL_KEYS, runsOnSurface,
  type AddAction,
} from '@/lib/add-actions';

export interface AddSheetProps {
  open: boolean;
  surface: 'map' | 'studio';
  onClose: () => void;
  onPick: (action: AddAction) => void;   // caller executes or deep-links
}

const FOREST = '#1F4D2B';
const INK = '#20190F';
const INK_MUTED = '#7A6E58';
const OCHRE = '#C07A1E';

export default function AddSheet({ open, surface, onClose, onPick }: AddSheetProps) {
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Hydration-safe: paint nothing new on the server / before mount.
  // ABOVE THE EARLY RETURN. Hooks cannot be called conditionally — placing this after the
  // `return null` below made React throw "rendered more hooks than during the previous render"
  // the instant the sheet opened, so it never appeared at all. Caught by opening it.
  //
  // The grabber was aria-hidden decoration: it looked like the handle every phone user knows and
  // did nothing. It now drags the sheet closed. Rory: "I want to be able to drag any of those top
  // closing buttons in the modals and it closes."
  const drag = useSheetDismiss(onClose, open);

  if (!mounted || !open) return null;

  const otherChipKey = surface === 'map' ? 'addOpensStudioChip' : 'addOpensMapChip';


  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" aria-modal="true" role="dialog">
      {/* Scrim */}
      <button
        aria-label={t('addSheetClose')}
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.38)', backdropFilter: 'blur(2px)', border: 'none', cursor: 'pointer' }}
      />

      {/* Sheet — u-anim-sheet gives it the shared sheet-rise entrance (this sheet is
          bottom-anchored at every breakpoint, so no desktop scale-settle variant). */}
      <div
        className="relative flex flex-col overflow-hidden u-anim-sheet"
        style={{
          background: '#F7F2E4',
          borderRadius: '20px 20px 0 0',
          borderTop: '1px solid #E2D8C4',
          boxShadow: '0 -6px 30px rgba(32,25,15,0.22)',
          maxHeight: '86dvh',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          transform: drag.dragY ? `translateY(${drag.dragY}px)` : undefined,
          transition: drag.dragging ? 'none' : 'transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* A real control now, not decoration: 44px of vertical target around the 4px bar, so it
            can be grabbed by a thumb rather than only by a mouse. touchAction none hands us the
            vertical gesture instead of letting the browser scroll the sheet. */}
        <button
          {...drag.handlers}
          type="button"
          data-sheet-grabber=""
          aria-label={`${t('addSheetClose')} — drag down or tap`}
          className="flex-shrink-0 w-full flex items-center justify-center"
          style={{ height: 22, background: 'transparent', border: 'none', cursor: 'grab', touchAction: 'none' }}
        >
          <span className="u-sheet-grabber" style={{ margin: 0 }} aria-hidden="true" />
        </button>

        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-2 px-5 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(226,216,196,0.7)' }}>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-display truncate" style={{ fontSize: 19, fontWeight: 700, color: INK, margin: 0 }}>
                {t('addSheetTitle')}
              </h2>
              <SpeakButton text={t('addSheetTitle')} englishText={translate('en', 'addSheetTitle')} color={FOREST} />
            </div>
            <p className="font-sans" style={{ fontSize: 13, color: INK_MUTED, margin: '2px 0 0' }}>
              {t('addSheetSub')}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t('addSheetClose')}
            className="flex items-center justify-center flex-shrink-0 rounded-full active:scale-95 transition-all"
            style={{ width: 44, height: 44, background: 'rgba(32,25,15,0.06)', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}
          >
            <X size={19} />
          </button>
        </div>

        {/* Grouped rows — scrolls inside the sheet */}
        <div className="flex-1 overflow-y-auto px-3 py-3" style={{ overscrollBehavior: 'contain' }}>
          {ADD_GROUP_ORDER.map((group) => {
            const actions = ADD_ACTIONS.filter((a) => a.group === group);
            if (actions.length === 0) return null;
            return (
              <div key={group} className="mb-3">
                <div
                  className="font-sans px-2 mb-1.5"
                  style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: INK_MUTED }}
                >
                  {t(ADD_GROUP_LABEL_KEYS[group])}
                </div>
                <div className="flex flex-col gap-1">
                  {actions.map((action) => {
                    const executable = runsOnSurface(action, surface);
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.id}
                        onClick={() => onPick(action)}
                        className="w-full flex items-center gap-3 text-left active:scale-[0.99] transition-all"
                        style={{
                          minHeight: 56,
                          padding: '8px 12px',
                          borderRadius: 14,
                          background: '#FFFEFA',
                          border: '1px solid #E7DECB',
                          cursor: 'pointer',
                        }}
                      >
                        <span
                          className="flex items-center justify-center flex-shrink-0 rounded-xl"
                          style={{ width: 40, height: 40, background: 'rgba(31,77,43,0.09)', color: FOREST }}
                        >
                          <Icon size={20} strokeWidth={1.8} />
                        </span>
                        <span className="flex flex-col min-w-0 flex-1">
                          <span className="font-sans truncate" style={{ fontSize: 15, fontWeight: 600, color: INK, lineHeight: 1.2 }}>
                            {t(action.labelKey)}
                          </span>
                          <span className="font-sans" style={{ fontSize: 12.5, color: INK_MUTED, lineHeight: 1.3 }}>
                            {t(action.hintKey)}
                          </span>
                        </span>
                        {executable ? (
                          <ArrowRight size={18} className="flex-shrink-0" style={{ color: '#B8A98A' }} />
                        ) : (
                          <span
                            className="font-sans flex-shrink-0 whitespace-nowrap"
                            style={{
                              fontSize: 12, fontWeight: 700, letterSpacing: '0.03em',
                              color: OCHRE, background: 'rgba(192,122,30,0.12)',
                              borderRadius: 6, padding: '3px 7px',
                            }}
                          >
                            {t(otherChipKey)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
