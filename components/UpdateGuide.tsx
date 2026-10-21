'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import {
  OPEN_UPDATE_GUIDE_EVENT, UPDATE_GUIDE_KEY, readUpdateGuide, type UpdateGuideState,
} from '@/lib/update-tour';
import { translate, useLanguage } from '@/lib/i18n';
import styles from './UpdateGuide.module.css';
import { isUpdateCopyLanguage,updateDescription } from '@/lib/update-copy';
import { useUpdateCopy } from '@/lib/use-update-copy';
import UpdateCopyText from './UpdateCopyText';

export default function UpdateGuide({ loadedBuildSha }: { loadedBuildSha: string | null }) {
  const pathname = usePathname();
  const { lang, t } = useLanguage();
  const [guide, setGuide] = useState<UpdateGuideState | null>(null);
  const [minimized, setMinimized] = useState(false);
  const panel = useRef<HTMLElement>(null);
  // Source-paired drafts can scroll. A new stop must start at its heading and close control.
  useEffect(() => { if (panel.current) panel.current.scrollTop = 0; }, [guide?.phase, guide?.index, minimized]);
  const nativeCopy = useUpdateCopy(lang, !!guide?.stops.length);

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
  const draftLocale = isUpdateCopyLanguage(lang);
  const source = (key: string) => translate('en', key);
  const withCount = (value: string) => value.replace('{index}', String(guide.index + 1))
    .replace('{total}', String(guide.stops.length));
  // These control drafts need the source at the point where the farmer decides what to tap.
  const paired = (key: string, count = false) => {
    const local = count ? withCount(t(key)) : t(key);
    const english = count ? withCount(source(key)) : source(key);
    return <><span lang={draftLocale ? lang : undefined}>{local}</span>
      {draftLocale && local !== english && <small className={styles.source} lang="en"><span lang={lang}>{t('offlineSourceLabel')}: </span>{english}</small>}</>;
  };

  if (minimized && guide.phase === 'tour') {
    return <section ref={panel} lang={lang} className={styles.mini} role="region" aria-label={t('updateGuideRegionAria')}>
      <button type="button" aria-label={withCount(t('updateGuideContinue'))} onClick={() => setMinimized(false)}>
        {paired('updateGuideContinue', true)}
      </button>
      <button type="button" onClick={() => save(null)} aria-label={t('updateGuideCloseAria')}><X size={16} aria-hidden /></button>
    </section>;
  }

  return (
    <section ref={panel} lang={lang} className={styles.guide} role="region" aria-label={t('updateGuideRegionAria')}>
      <div className={styles.head}>
        <span>{guide.phase === 'offer' ? t('updateGuideOfferBadge') : withCount(t('updateGuideTourBadge'))}</span>
        <button type="button" className={styles.close} onClick={() => save(null)} aria-label={t('updateGuideCloseAria')}><X size={18} aria-hidden /></button>
      </div>
      {draftLocale && <p className={styles.draftNotice} lang={lang} role="note">{t('updatesDraftNotice')}</p>}
      {guide.phase === 'offer' ? (
        <>
          <h2>{paired('updateGuideOfferTitle')}</h2>
          <p>{paired('updateGuideOfferBody')}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={() => save({ ...guide, phase: 'tour' })}>{t('settingsGuideMe')}</button>
            <button type="button" aria-label={t('updateGuideNotNow')} onClick={() => save(null)}>{paired('updateGuideNotNow')}</button>
          </div>
        </>
      ) : (
        <>
          <h2><UpdateCopyText source={stop.title} lang={lang} copy={nativeCopy.copy} sourceLabel={t('offlineSourceLabel')}/></h2>
          <p className={styles.where}><UpdateCopyText source={stop.where} lang={lang} copy={nativeCopy.copy} sourceLabel={t('offlineSourceLabel')}/></p>
          <p><UpdateCopyText source={stop.detail} lang={lang} copy={nativeCopy.copy} sourceLabel={t('offlineSourceLabel')}/></p>
          {draftLocale&&[stop.title,stop.where,stop.detail].some(text=>updateDescription(nativeCopy.copy,text)===text)&&<p role="note" lang={lang}>{t(nativeCopy.pending?'updatesLoadingTranslations':nativeCopy.failed?'updatesTranslationsUnavailable':'updatesEnglishGap')}</p>}
          <div className={styles.actions}>
            {!onPage && <a aria-label={t('updateGuideOpenPage')} className={styles.primary} href={stop.href}>{paired('updateGuideOpenPage')}</a>}
            {onPage && <span className={styles.arrived}>{t('updateGuideArrived')}</span>}
          </div>
          <div className={styles.actions}>
            {guide.index > 0 && <button type="button" aria-label={t('updateGuidePrevious')} onClick={() => save({ ...guide, index: guide.index - 1 })}>{paired('updateGuidePrevious')}</button>}
            <button type="button" aria-label={t(guide.index+1<guide.stops.length?'updateGuideNext':'updateGuideFinish')} onClick={() => guide.index + 1 < guide.stops.length
              ? save({ ...guide, index: guide.index + 1 }) : save(null)}>
              {guide.index + 1 < guide.stops.length ? paired('updateGuideNext') : paired('updateGuideFinish')}
            </button>
            <button type="button" aria-label={t('updateGuideStop')} onClick={() => save(null)}>{paired('updateGuideStop')}</button>
          </div>
        </>
      )}
    </section>
  );
}
