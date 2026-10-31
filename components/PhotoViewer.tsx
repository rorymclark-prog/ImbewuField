'use client';

import { useEffect, useRef, useState } from 'react';
import { translate, useLanguage } from '@/lib/i18n';
import LanguageDraftNote from './LanguageDraftNote';
import styles from './PhotoViewer.module.css';
import { inlineText, inlineTemplate } from '@/lib/xh-inline';

/** Mark only profile/site photos: maps, crop symbols and controls keep their own actions. */
export default function PhotoViewer() {
  const {lang,t}=useLanguage();
  // isiXhosa is an unreviewed machine draft too; it reads the inline drafts keyed by the English
  // (its dictionary has no photoViewer* entries yet) and keeps the English source beside errors.
  const draft=['zu','st','ts','ve','xh'].includes(lang);
  const ui=(key:string,english:string)=>lang==='xh'?inlineText(lang,english):t(key);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLImageElement | null>(null);
  // Keep the original caption, so switching language cannot translate or reinterpret a farmer's words.
  const [photo, setPhoto] = useState<{ src: string; caption: string; sample: boolean } | null>(null);
  const [zoom, setZoom] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    function prepare() {
      document.querySelectorAll<HTMLImageElement>('img[data-photo-preview]').forEach(img => {
        img.tabIndex = 0;
        img.setAttribute('role', 'button');
        img.setAttribute('aria-label', lang==='xh' ? inlineTemplate(lang, 'Open photo: {name}', null, { name: img.alt || inlineText(lang, 'profile or site photograph') }) : t('photoViewerOpen').replace('{caption}',()=>img.alt || t('photoViewerTriggerFallback')));
        img.style.cursor = 'zoom-in';
      });
    }
    function open(event: Event) {
      if (!(event.target instanceof HTMLImageElement) || !event.target.hasAttribute('data-photo-preview')) return;
      if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') return;
      // A portrait inside a directory row must enlarge without opening that row too.
      event.preventDefault(); event.stopPropagation();
      trigger.current = event.target;
      const source = event.target.currentSrc || event.target.src;
      const sample = new URL(source, window.location.href).pathname.startsWith('/demo/');
      setPhoto({ src: source, caption: event.target.alt, sample });
      setZoom(false); setFailed(false);
    }
    prepare();
    const observer = new MutationObserver(prepare);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'alt', 'data-photo-preview'] });
    document.addEventListener('click', open, true);
    document.addEventListener('keydown', open, true);
    return () => { observer.disconnect(); document.removeEventListener('click', open, true); document.removeEventListener('keydown', open, true); };
  }, [lang,t]);

  // The Close button must exist before showModal chooses its autofocus target.
  useEffect(()=>{if(photo&&dialog.current&&!dialog.current.open)dialog.current.showModal();},[photo]);
  const caption=photo?.caption||ui('photoViewerCaptionFallback','Photograph');
  const imageCaption=photo?.sample?`${ui('photoViewerSampleLabel','Illustration')} · ${caption}`:caption;
  return <dialog ref={dialog} lang={lang} className={styles.viewer} aria-label={ui('photoViewerDialogTitle','Photo viewer')} onKeyDown={e => e.stopPropagation()}
    onClick={e => { if (e.target === dialog.current) dialog.current.close(); }}
    onClose={() => { setPhoto(null); setZoom(false); if (trigger.current?.isConnected) trigger.current.focus(); }}>
    {photo && <div className={styles.panel}>
      <header><p>{photo.sample&&<><span lang={lang}>{ui('photoViewerSampleLabel','Illustration')}</span>{' · '}</>}<span lang={photo.caption?'':lang}>{caption}</span></p><button type="button" autoFocus onClick={() => dialog.current?.close()}>{ui('photoViewerClose','Close ×')}</button></header>
      <LanguageDraftNote lang={lang} scope="photo-viewer"/>
      <div className={styles.imageArea}>{failed ? <p role="status"><span>{ui('photoViewerLoadError','This photo could not load. Close and try again when connected.')}</span>{draft&&<small lang="en" style={{display:'block',fontSize:12,lineHeight:1.4,marginTop:8}}><span lang={lang}>{t('offlineSourceLabel')}: </span>{translate('en','photoViewerLoadError')}</small>}</p> : <img lang={photo.caption?'':lang} className={zoom ? styles.zoomed : ''} src={photo.src} alt={imageCaption} onError={() => setFailed(true)} />}</div>
      {!failed && <button type="button" aria-pressed={zoom} onClick={() => setZoom(!zoom)}>{zoom ? ui('photoViewerFit','Fit to screen') : ui('photoViewerEnlarge','Enlarge')}</button>}
    </div>}
  </dialog>;
}
