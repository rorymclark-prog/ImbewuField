'use client';

// LessonLink — the one control that connects any surface in the app to its lesson. Drop
// <LessonLink id="element:jojo_2500" /> (or step:/feature:/zone:/line:/crops:/finances:/community:)
// next to anything; it opens the shared <LessonPanel> for that id in a bottom sheet. getLesson()
// is total, so the link is never dead even before real copy is written. This is the wiring Rory
// asked for: "anything we do on the app must connect to a lesson."

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, X } from 'lucide-react';
import { getLesson } from '@/lib/lesson-registry';
import { useLanguage } from '@/lib/i18n';
import { useDialogFocus } from '@/lib/use-dialog-focus';
import { LessonPanel } from './LessonPanel';

const GREEN = 'var(--color-forest-800)'; // text, icon and border on the page ground: follows the theme (leaf in dark)

export default function LessonLink({
  id,
  label,
  tone = 'link',
}: {
  id: string;
  label?: string;
  /** 'menu' keeps the control readable against either drawer theme. */
  tone?: 'link' | 'chip' | 'menu';
}) {
  const { t } = useLanguage();
  const resolvedLabel = label ?? t('designLearn');
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, dialogRef);
  // Captured and stopped here so Escape closes only the lesson, not the drawer it was opened from.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  const trigger =
    tone === 'chip' || tone === 'menu'
      ? {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          minHeight: 44,
          padding: '4px 10px',
          borderRadius: 999,
          // w20-24: 'chip' matches the header Settings pill (bg-1 fill, hairline border, primary ink).
          border: '1px solid var(--border)',
          background: tone === 'chip' ? 'var(--bg-1)' : 'transparent',
          color: 'var(--text-primary)',
          fontSize: 12,
          fontWeight: tone === 'chip' ? 500 : 700,
          cursor: 'pointer',
        }
      : {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          border: 'none',
          minHeight: 44,
          background: 'transparent',
          color: GREEN,
          fontSize: 12,
          fontWeight: 700,
          textDecoration: 'underline',
          cursor: 'pointer',
          padding: '2px 0',
        };

  return (
    <>
      <button
        data-header-secondary
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        style={trigger as React.CSSProperties}
      >
        <BookOpen size={13} /> {resolvedLabel}
      </button>

      {open && createPortal(
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(11,18,11,0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 460,
              maxHeight: '82vh',
              overflowY: 'auto',
              background: 'var(--bg-1)',
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              padding: 14,
              boxShadow: '0 -6px 24px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <BookOpen size={16} color={GREEN} />
              <span style={{ fontWeight: 800, color: GREEN, fontSize: 12.5, letterSpacing: 0.4 }}>{t('designLessonHeading')}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('designLessonClose')}
                style={{
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  border: 'none',
                  background: 'transparent',
                  color: GREEN,
                  cursor: 'pointer',
                  minHeight: 44,
                  minWidth: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>
            <LessonPanel lesson={getLesson(id)} />
          </div>
        </div>, document.body
      )}
    </>
  );
}
