'use client';

import { useHydratedLang } from '@/lib/use-hydrated-lang';
import styles from './DesignDraftCopy.module.css';
import courseStyles from './FinanceCourse.module.css';
import ArrowLabel, { stripArrow } from './ArrowLabel';
import { inlineDraft, inlineText, isInlineDraftLang, xhInlineDraft } from '@/lib/xh-inline';

/** Draft route chrome always keeps its exact English source visible in isiZulu mode. */
export default function DesignDraftCopy({ en, zu }: { en: string; zu: string }) {
  const lang = useHydratedLang();
  // A trailing "→" / leading "←" in the copy becomes a Lucide arrow (ArrowLabel); the words are unchanged.
  const arrow = (text: string, children: string) => (text !== stripArrow(text) ? <ArrowLabel dir={/^\s*←/.test(text) ? 'back' : /↑\s*$/.test(text) ? 'up' : 'next'}>{children}</ArrowLabel> : children);
  // isiXhosa reads the same exact English through lib/xh-inline.ts and keeps the same English source line.
  const xhosa = isInlineDraftLang(lang) ? inlineDraft(lang, en) : null;
  if (xhosa) return <span lang={lang} style={{ display: 'inline-block', minWidth: 0 }}>{arrow(xhosa, xhosa)}<small lang="en" className={styles.source}>English source: {stripArrow(en)}</small></span>;
  return lang === 'zu' ? <span style={{ display: 'inline-block', minWidth: 0 }}>{arrow(zu, zu)}<small className={styles.source}>English source: {stripArrow(en)}</small></span> : arrow(en, en);
}

export function DesignDraftNotice() {
  const lang = useHydratedLang();
  if (lang === 'xh') {
    const source = 'Navigation, headings, lesson text and exercise prompts on this pathway are unreviewed isiXhosa drafts. Model measurements and narration remain in English.';
    const draft = xhInlineDraft(source);
    // One notice, never an English sentence paired with an identical English source: until the isiXhosa
    // drafts have loaded the English shows once, with no "English source" line under it.
    if (!draft) return <aside role="note" className={`${courseStyles.notice} ${courseStyles.projectNotice}`}><p lang="en"><strong>isiXhosa draft.</strong> {source}</p></aside>;
    return <aside role="note" className={`${courseStyles.notice} ${courseStyles.projectNotice}`}><p><strong lang="xh">{inlineText(lang, 'isiXhosa draft.')}</strong> <span lang="xh">{draft}</span><small lang="en" className={styles.source}>English source: {source}</small></p></aside>;
  }
  if (lang === 'af') {
    const source = 'Navigation, headings, lesson text and exercise prompts on this pathway are unreviewed Afrikaans drafts. Model measurements and narration remain in English.';
    const draft = inlineDraft(lang, source);
    // Same as isiXhosa above: one notice, never the English twice. Until the Afrikaans drafts have loaded
    // the English shows once, with no "English source" line under it.
    if (!draft) return <aside role="note" className={`${courseStyles.notice} ${courseStyles.projectNotice}`}><p lang="en"><strong>Afrikaans draft.</strong> {source}</p></aside>;
    return <aside role="note" className={`${courseStyles.notice} ${courseStyles.projectNotice}`}><p><strong lang="af">{inlineText(lang, 'Afrikaans draft.')}</strong> <span lang="af">{draft}</span><small lang="en" className={styles.source}>English source: {source}</small></p></aside>;
  }
  if (lang !== 'zu') return null;
  const en = 'Some navigation, headings and exercise prompts on this pathway are unreviewed isiZulu drafts. Core lesson text, model measurements and narration remain in English.';
  const zu = 'Ezinye izinto zokuzulazula, izihloko nemiyalo yemisebenzi kule ndlela yokufunda kuyizinhlaka zesiZulu ezingakabuyekezwa. Umbhalo oyinhloko wezifundo, izilinganiso zemodeli nokulandisa kuhlala kungesiNgisi.';
  return <aside role="note" className={`${courseStyles.notice} ${courseStyles.projectNotice}`}><p><strong>IsiZulu draft · Uhlaka lwesiZulu.</strong> {zu}<small className={styles.source}>English source: {en}</small></p></aside>;
}
