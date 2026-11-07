'use client';

import AppHeader from '@/components/layout/AppHeader';
import { useLanguage } from '@/lib/i18n';
import { inlineText } from '@/lib/xh-inline';
import styles from './StudyHeader.module.css';

/** Study pages' top bar: the shared app header (logo, Back, primary nav, Settings) with the page name as its label.
 *  `zuTitle` is an unreviewed isiZulu draft; English shows when there is no draft. `title` stays the
 *  English prop; isiXhosa readers get the draft keyed by that exact English (lib/locales/xh-inline/). */
export default function StudyHeader({ title, zuTitle, backFallback = '/student' }: { title: string; zuTitle?: string; backFallback?: string }) {
  const { lang } = useLanguage();
  return (
    <div className={styles.bar}>
      <AppHeader title={lang === 'zu' && zuTitle ? zuTitle : inlineText(lang, title)} backFallback={backFallback} />
    </div>
  );
}
