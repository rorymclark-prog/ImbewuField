'use client';

import { useLanguage } from '@/lib/i18n';
import FinanceText from './FinanceText';

/**
 * Renders `zu` in place of `en` when the app language is isiZulu and a draft exists for this
 * exact English string (lib/course-finance-i18n.ts pairs each draft to its live English source).
 * Unreviewed by a fluent isiZulu speaker — see FinanceZuBadge, shown once per lesson rather than
 * once per string, matching the studentZuluLessonDraftBadge convention used elsewhere in Study.
 */
export function FinanceZuText({ en, zu }: { en: string; zu: string | null }) {
  const { lang } = useLanguage();
  if (lang === 'zu' && zu) return <span lang="zu">{zu}</span>;
  return <span lang={lang === 'zu' ? 'en' : undefined}>{en}</span>;
}

/** Same swap for text passed to FinanceText, which needs a plain string rather than a node. */
export function financeZuOrEnglish(lang: string, en: string, zu: string | null): string {
  return lang === 'zu' && zu ? zu : en;
}

/** The lesson reading — FinanceText does its own markdown-lite parsing, so this picks the
 *  language before handing it a plain string rather than wrapping already-parsed nodes. */
export function FinanceZuLessonReading({ en, zu, headingLevel }: { en: string; zu: string | null; headingLevel?: 3 | 4 }) {
  const { lang } = useLanguage();
  return <FinanceText text={financeZuOrEnglish(lang, en, zu)} headingLevel={headingLevel} />;
}

/** One badge per lesson (not per string) — this lesson's content is an unreviewed isiZulu draft,
 *  or none exists yet and the learner is seeing the English original. */
export function FinanceZuBadge({ hasDraft }: { hasDraft: boolean }) {
  const { lang, t } = useLanguage();
  if (lang !== 'zu') return null;
  return (
    <span
      className="finance-zu-badge"
      style={{
        display: 'inline-flex', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600,
        color: hasDraft ? '#704B08' : '#5C5040',
        background: hasDraft ? '#FFF1C2' : 'rgba(140,122,98,0.08)',
        border: `1px solid ${hasDraft ? '#E9CC76' : '#E2D8C4'}`,
      }}
    >
      {hasDraft ? t('studentZuluLessonDraftBadge') : t('studentZuluLessonEnglishBadge')}
    </span>
  );
}

/** Page-level note for the course outline and the practical project — not repeated per string. */
export function FinanceZuCourseNotice() {
  const { lang, t } = useLanguage();
  if (lang !== 'zu') return null;
  return (
    <p role="note" className="finance-zu-notice" style={{ margin: '12px 0', fontSize: 13, color: '#5C5040' }}>
      <span lang="zu">{t('studentZuluLessonDraftBadge')}</span> — <span lang="en">Machine isiZulu draft, not yet reviewed by a fluent speaker. Lesson bodies not yet translated stay in English.</span>
    </p>
  );
}
