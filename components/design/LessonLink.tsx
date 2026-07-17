'use client';

// LessonLink — the one control that connects any surface in the app to its lesson. Drop
// <LessonLink id="element:jojo_2500" /> (or step:/feature:/zone:/line:/crops:/finances:/community:)
// next to anything; it opens the shared <LessonPanel> for that id in a bottom sheet. getLesson()
// is total, so the link is never dead even before real copy is written. This is the wiring Rory
// asked for: "anything we do on the app must connect to a lesson."

import { useState } from 'react';
import { BookOpen, X } from 'lucide-react';
import { getLesson } from '@/lib/lesson-registry';
import { LessonPanel } from './LessonPanel';

const GREEN = '#1F4D2B';

export default function LessonLink({
  id,
  label = 'Learn',
  tone = 'link',
}: {
  id: string;
  label?: string;
  /** 'link' = quiet inline text button; 'chip' = rounded outlined pill. */
  tone?: 'link' | 'chip';
}) {
  const [open, setOpen] = useState(false);

  const trigger =
    tone === 'chip'
      ? {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          minHeight: 32,
          padding: '4px 10px',
          borderRadius: 999,
          border: `1px solid ${GREEN}`,
          background: 'transparent',
          color: GREEN,
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
        }
      : {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          border: 'none',
          background: 'transparent',
          color: GREEN,
          fontSize: 11.5,
          fontWeight: 700,
          textDecoration: 'underline',
          cursor: 'pointer',
          padding: '2px 0',
        };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        style={trigger as React.CSSProperties}
      >
        <BookOpen size={13} /> {label}
      </button>

      {open && (
        <div
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
              background: '#FFFEFA',
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              padding: 14,
              boxShadow: '0 -6px 24px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <BookOpen size={16} color={GREEN} />
              <span style={{ fontWeight: 800, color: GREEN, fontSize: 12.5, letterSpacing: 0.4 }}>LESSON</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close lesson"
                style={{
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  border: 'none',
                  background: 'transparent',
                  color: GREEN,
                  cursor: 'pointer',
                  minHeight: 40,
                  minWidth: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>
            <LessonPanel lesson={getLesson(id)} />
          </div>
        </div>
      )}
    </>
  );
}
