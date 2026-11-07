'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { inlineText, inlineTemplate } from '@/lib/xh-inline';
import { isSampleMode, SAMPLE_MODE_EVENT } from '@/lib/sample-mode';
import { readFinanceChecklist } from '@/lib/finance-reading-checklist';
import styles from './FinanceCourse.module.css';

export default function FinanceReadingChecklist({ lessonIds, lessonId }: { lessonIds: string[]; lessonId?: string }) {
  const { user, loading } = useAuth();
  const { lang } = useLanguage();
  const tx = (english: string) => inlineText(lang, english);
  const [saved, setSaved] = useState<{ key: string; ids: string[] } | null>(null);
  const [error, setError] = useState('');
  const [sample, setSample] = useState<boolean | null>(null);
  useEffect(() => {
    const update = () => setSample(isSampleMode());
    update();
    window.addEventListener(SAMPLE_MODE_EVENT, update);
    return () => window.removeEventListener(SAMPLE_MODE_EVENT, update);
  }, []);
  const key = `imbewu:finance-reading:v1:${sample ? 'sample' : user?.uid ?? 'guest'}`;
  const allowed = lessonIds.join('|');
  useEffect(() => {
    if (loading || sample === null) return;
    const read = () => {
      try {
        const ids = readFinanceChecklist(localStorage.getItem(key), allowed.split('|'));
        setSaved({ key, ids }); setError('');
      } catch { setSaved(null); setError(tx('Your saved reading checklist could not be opened. You can still read every lesson.')); }
    };
    read();
    const changed = (event: StorageEvent) => { if (event.key === key || event.key === null) read(); };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [key, loading, allowed, sample]);

  const current = !loading && sample !== null && saved?.key === key ? saved.ids : null;
  const read = Boolean(lessonId && current?.includes(lessonId));
  const toggle = () => {
    if (!lessonId || !current) return;
    try {
      // Re-read before writing so a second tab's new ticks are not replaced by this view's stale copy.
      const ids = new Set(readFinanceChecklist(localStorage.getItem(key), lessonIds));
      ids.has(lessonId) ? ids.delete(lessonId) : ids.add(lessonId);
      localStorage.setItem(key, JSON.stringify([...ids]));
      setSaved({ key, ids: [...ids] }); setError('');
    } catch { setError(tx('This reading tick could not be saved. Your lesson is still available.')); }
  };
  const done = current?.length ?? 0;
  const total = lessonIds.length;
  return <div className={`${styles.checklist}${lessonId ? '' : ` ${styles.checklistCard}`}`}>
    {current && total > 0 && <div className={styles.progress} role="progressbar" aria-label={tx('Lessons marked as read')} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}><span style={{ width: `${Math.round((done / total) * 100)}%` }} /></div>}
    <p>{current ? inlineTemplate(lang, '{done} of {total} lessons marked as read on this device.', null, { done: current.length, total: lessonIds.length }) : error ? tx('Reading checklist unavailable.') : tx('Opening your reading checklist…')}</p>
    {lessonId && <div className={styles.actions}><button type="button" disabled={!current} aria-pressed={read} onClick={toggle}>{tx(read ? 'Marked as read · undo' : 'Mark this lesson as read')}</button></div>}
    <p>{tx('This is your reading checklist, not an assessment result.')} {sample ? tx('Sample ticks are temporary and reset when the sample session ends.') : tx('It is saved only on this device.')}</p>
    {error && <p role="alert">{error}</p>}
  </div>;
}
