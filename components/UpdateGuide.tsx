'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import {
  OPEN_UPDATE_GUIDE_EVENT, UPDATE_GUIDE_KEY, readUpdateGuide, type UpdateGuideState,
} from '@/lib/update-tour';
import { translate, useLanguage } from '@/lib/i18n';
import styles from './UpdateGuide.module.css';

export default function UpdateGuide({ loadedBuildSha }: { loadedBuildSha: string | null }) {
  const pathname = usePathname();
  const { lang, t } = useLanguage();
  const [guide, setGuide] = useState<UpdateGuideState | null>(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    try {
      setGuide(readUpdateGuide(window.sessionStorage.getItem(UPDATE_GUIDE_KEY), loadedBuildSha));
    } catch { /* The tour is optional when storage is unavailable. */ }
    let cancelled = false;
    // Loaded on demand — the guide is opened far less often than every route mounts this
    // component, so the full changelog stays out of the shared layout bundle until asked for.
    const open = () => {
      import('@/lib/release-notes').then(({ visibleUpdateTour }) => {
        if (cancelled) return;
        setGuide({ sha: loadedBuildSha, stops: visibleUpdateTour(), phase: 'offer', index: 0 });
      }).catch(() => { /* Offline and the chunk never cached: the guide is optional, stay quiet. */ });
    };
    window.addEventListener(OPEN_UPDATE_GUIDE_EVENT, open);
    return () => {
      cancelled = true;
      window.removeEventListener(OPEN_UPDATE_GUIDE_EVENT, open);
    };
  }, [loadedBuildSha]);

  // On arrival, get out of the way so the farmer can actually see and use the page.
  useEffect(() => {
    if (!guide || guide.phase !== 'tour') { setMinimized(false); return; }
    setMinimized(pathname === guide.stops[guide.index].href.split('#')[0]);
  }, [pathname, guide?.phase, guide?.index]);

  function save(next: UpdateGuideState | null) {
    setGuide(next);
    try {
      if (next) window.sessionStorage.setItem(UPDATE_GUIDE_KEY, JSON.stringify(next));
      else window.sessionStorage.removeItem(UPDATE_GUIDE_KEY);
    } catch { /* The guide still works until this tab closes. */ }
  }

  if (!guide || !guide.stops.length) return null;
  const stop = guide.stops[guide.index];
  const onPage = pathname === stop.href.split('#')[0];
  const draftLocale = lang === 'st' || lang === 've';
  const source = (key: string) => translate('en', key);
  const withCount = (value: string) => value.replace('{index}', String(guide.index + 1))
    .replace('{total}', String(guide.stops.length));
  // These control drafts need the source at the point where the farmer decides what to tap.
  const paired = (key: string, count = false) => {
    const local = count ? withCount(t(key)) : t(key);
    const english = count ? withCount(source(key)) : source(key);
    return <><span lang={draftLocale ? lang : undefined}>{local}</span>
      {draftLocale && local !== english && <small className={styles.source} lang="en">English: {english}</small>}</>;
  };

  if (minimized && guide.phase === 'tour') {
    return <section className={styles.mini} role="region" aria-label={t('updateGuideRegionAria')}>
      <button type="button" onClick={() => setMinimized(false)}>
        {paired('updateGuideContinue', true)}
      </button>
      <button type="button" onClick={() => save(null)} aria-label={t('updateGuideCloseAria')}><X size={16} aria-hidden /></button>
    </section>;
  }

  return (
    <section className={styles.guide} role="region" aria-label={t('updateGuideRegionAria')}>
      <div className={styles.head}>
        <span>{guide.phase === 'offer' ? t('updateGuideOfferBadge') : withCount(t('updateGuideTourBadge'))}</span>
        <button type="button" className={styles.close} onClick={() => save(null)} aria-label={t('updateGuideCloseAria')}><X size={18} aria-hidden /></button>
      </div>
      {draftLocale && <p className={styles.draftNotice} role="note">Unreviewed {lang === 'st' ? 'Sesotho' : 'Tshivenda'} machine draft. English is shown with drafted controls.</p>}
      {guide.phase === 'offer' ? (
        <>
          <h2>{paired('updateGuideOfferTitle')}</h2>
          <p>{t('updateGuideOfferBody')}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={() => save({ ...guide, phase: 'tour' })}>{t('settingsGuideMe')}</button>
            <button type="button" onClick={() => save(null)}>{paired('updateGuideNotNow')}</button>
          </div>
        </>
      ) : (
        <>
          <h2>{stop.title}</h2>
          <p className={styles.where}>{stop.where}</p>
          <p>{stop.detail}</p>
          <div className={styles.actions}>
            {!onPage && <a className={styles.primary} href={stop.href}>{paired('updateGuideOpenPage')}</a>}
            {onPage && <span className={styles.arrived}>{t('updateGuideArrived')}</span>}
          </div>
          <div className={styles.actions}>
            {guide.index > 0 && <button type="button" onClick={() => save({ ...guide, index: guide.index - 1 })}>{paired('updateGuidePrevious')}</button>}
            <button type="button" onClick={() => guide.index + 1 < guide.stops.length
              ? save({ ...guide, index: guide.index + 1 }) : save(null)}>
              {guide.index + 1 < guide.stops.length ? paired('updateGuideNext') : paired('updateGuideFinish')}
            </button>
            <button type="button" onClick={() => save(null)}>{paired('updateGuideStop')}</button>
          </div>
        </>
      )}
    </section>
  );
}
