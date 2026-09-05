'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './PhotoViewer.module.css';

/** Mark only profile/site photos: maps, crop symbols and controls keep their own actions. */
export default function PhotoViewer() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLImageElement | null>(null);
  const [photo, setPhoto] = useState<{ src: string; caption: string } | null>(null);
  const [zoom, setZoom] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    function prepare() {
      document.querySelectorAll<HTMLImageElement>('img[data-photo-preview]').forEach(img => {
        img.tabIndex = 0;
        img.setAttribute('role', 'button');
        img.setAttribute('aria-label', `Open photo: ${img.alt || 'profile or site photograph'}`);
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
      const sampleImage = new URL(source, window.location.href).pathname.startsWith('/demo/');
      const caption = event.target.alt || 'Photograph';
      setPhoto({ src: source, caption: sampleImage ? `Fictional sample image · ${caption}` : caption });
      setZoom(false); setFailed(false);
      dialog.current?.showModal();
    }
    prepare();
    const observer = new MutationObserver(prepare);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'alt', 'data-photo-preview'] });
    document.addEventListener('click', open, true);
    document.addEventListener('keydown', open, true);
    return () => { observer.disconnect(); document.removeEventListener('click', open, true); document.removeEventListener('keydown', open, true); };
  }, []);

  return <dialog ref={dialog} className={styles.viewer} aria-label="Photo viewer" onKeyDown={e => e.stopPropagation()}
    onClick={e => { if (e.target === dialog.current) dialog.current.close(); }}
    onClose={() => { setPhoto(null); setZoom(false); if (trigger.current?.isConnected) trigger.current.focus(); }}>
    {photo && <div className={styles.panel}>
      <header><p>{photo.caption}</p><button type="button" autoFocus onClick={() => dialog.current?.close()}>Close ×</button></header>
      <div className={styles.imageArea}>{failed ? <p role="status">This photo could not load. Close and try again when connected.</p> : <img className={zoom ? styles.zoomed : ''} src={photo.src} alt={photo.caption} onError={() => setFailed(true)} />}</div>
      {!failed && <button type="button" aria-pressed={zoom} onClick={() => setZoom(!zoom)}>{zoom ? 'Fit to screen' : 'Enlarge'}</button>}
    </div>}
  </dialog>;
}
