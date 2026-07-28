'use client';

// LessonPanel — the shared renderer for one teaching lesson (title · body · principle · tip · a
// link into the full course). Extracted from DesignWizard so BOTH the wizard's "Why this step?"
// expander and the app-wide <LessonLink> use exactly the same presentation. Accepts any
// StepLesson-shaped object (incl. the registry's MicroLesson, which adds an optional `draft` flag).

import Link from 'next/link';
import { Sprout, Lightbulb } from 'lucide-react';
import type { StepLesson } from '@/lib/design-lessons';
import SpeakButton from '@/components/SpeakButton';
import { useLanguage } from '@/lib/i18n';

const GREEN = '#1F4D2B';
const DARK = '#0B120B';

export function LessonPanel({ lesson }: { lesson: StepLesson & { draft?: boolean } }) {
  const { t } = useLanguage();
  const narration = `${lesson.title}. ${lesson.body} ${lesson.principle} ${lesson.tip}`;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: 'rgba(31,77,43,0.06)',
        borderRadius: 12,
        padding: '12px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: DARK }}>{lesson.title}</div>
        <SpeakButton text={narration} englishText={narration} size={16} color={GREEN} />
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5, color: DARK }}>{lesson.body}</div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <Sprout size={13} color={GREEN} style={{ flexShrink: 0, marginTop: 3 }} />
        <div style={{ fontSize: 12.5, lineHeight: 1.4, color: DARK }}>
          <span
            style={{
              display: 'block',
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
              color: GREEN,
            }}
          >
            {t('designLessonPrinciple')}
          </span>
          {lesson.principle}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <Lightbulb size={13} color={GREEN} style={{ flexShrink: 0, marginTop: 3 }} />
        <div style={{ fontSize: 12.5, lineHeight: 1.4, color: DARK }}>
          <span
            style={{
              display: 'block',
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
              color: GREEN,
            }}
          >
            {t('designLessonTryThis')}
          </span>
          {lesson.tip}
        </div>
      </div>
      {lesson.courseModuleId && (
        <Link
          href={`/student?module=${lesson.courseModuleId}`}
          style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 700, color: GREEN, textDecoration: 'underline' }}
        >
          {t('designLessonCourse')}
        </Link>
      )}
      {lesson.draft && (
        <div style={{ fontSize: 10.5, color: 'rgba(11,18,11,0.5)', fontStyle: 'italic' }}>
          {t('designLessonDraft')}
        </div>
      )}
    </div>
  );
}
