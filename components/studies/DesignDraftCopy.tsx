'use client';

import { useLanguage } from '@/lib/i18n';
import styles from './DesignDraftCopy.module.css';
import courseStyles from './FinanceCourse.module.css';
import ArrowLabel, { stripArrow } from './ArrowLabel';

/** Draft route chrome always keeps its exact English source visible in isiZulu mode. */
export default function DesignDraftCopy({ en, zu }: { en: string; zu: string }) {
  const { lang } = useLanguage();
  // A trailing "→" / leading "←" in the copy becomes a Lucide arrow (ArrowLabel); the words are unchanged.
  const arrow = (text: string, children: string) => (text !== stripArrow(text) ? <ArrowLabel dir={/^\s*←/.test(text) ? 'back' : 'next'}>{children}</ArrowLabel> : children);
  return lang === 'zu' ? <span style={{ display: 'inline-block', minWidth: 0 }}>{arrow(zu, zu)}<small className={styles.source}>English source: {stripArrow(en)}</small></span> : arrow(en, en);
}

export function DesignDraftNotice() {
  const { lang } = useLanguage();
  if (lang !== 'zu') return null;
  const en = 'Some navigation, headings and exercise prompts on this pathway are unreviewed isiZulu drafts. Core lesson text, model measurements and narration remain in English.';
  const zu = 'Ezinye izinto zokuzulazula, izihloko nemiyalo yemisebenzi kule ndlela yokufunda kuyizinhlaka zesiZulu ezingakabuyekezwa. Umbhalo oyinhloko wezifundo, izilinganiso zemodeli nokulandisa kuhlala kungesiNgisi.';
  return <aside role="note" className={`${courseStyles.notice} ${courseStyles.projectNotice}`}><p><strong>IsiZulu draft · Uhlaka lwesiZulu.</strong> {zu}<small className={styles.source}>English source: {en}</small></p></aside>;
}
