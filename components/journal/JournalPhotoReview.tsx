'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Columns2, X } from 'lucide-react';
import type { JournalEntry } from '@/lib/field-journal';
import { farmMemoryText, type FarmMemoryKey } from '@/lib/farm-memory-copy';
import styles from './JournalPhotoReview.module.css';

/** Compare the farmer's own dated observations, without inferring crop health or yields. */
export default function JournalPhotoReview({ entries, lang = 'en' }: { entries: readonly JournalEntry[]; lang?: string }) {
  const fm = (key: FarmMemoryKey, vars?: Record<string, string | number>) => farmMemoryText(lang, key, vars);
  const photos = useMemo(() => [...entries]
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    .flatMap((entry) => (entry.photos ?? []).map((src, index) => ({
      id: `${entry.id}:${index}`, src, date: entry.date, title: entry.title,
      context: [entry.bedLabel, entry.cropName].filter(Boolean).join(' · '),
      number: index + 1,
    }))), [entries]);
  const [selection, setSelection] = useState<{ first: string; second: string | null } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const first = photos.find((photo) => photo.id === selection?.first);
  const second = photos.find((photo) => photo.id === selection?.second);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (selection && first && dialog && !dialog.open) dialog.showModal();
    if ((!selection || !first) && dialog?.open) dialog.close();
  }, [selection, first]);

  function open(id: string, compare: boolean) {
    opener.current = document.activeElement as HTMLElement | null;
    setSelection({ first: id, second: compare ? photos.find((photo) => photo.id !== id)?.id ?? null : null });
  }

  if (photos.length === 0) return null;

  const optionLabel = (photo: typeof photos[number]) => `${photo.date} · ${photo.title || fm('untitledNote')}${photo.context ? ` · ${photo.context}` : ''} · ${fm('photoNumber', { n: photo.number })}`;
  return (
    <section className={styles.review} lang={lang === 'zu' ? 'zu' : 'en'} aria-label={fm('photos')}>
      <div className={styles.heading}><Camera size={16} aria-hidden /><h2>{fm('photosHeading')}</h2></div>
      <p>{fm('photosHelp')}</p>
      <div className={styles.strip}>
        {photos.slice(0, 8).map((photo) => <button key={photo.id} type="button" onClick={() => open(photo.id, false)} aria-label={fm('openPhoto', { label: optionLabel(photo) })}>
          <img src={photo.src} alt="" loading="lazy" />
          <span>{photo.date}</span>
        </button>)}
      </div>
      {photos.length > 1 && <button className={styles.compare} type="button" onClick={() => open(photos[0].id, true)}><Columns2 size={17} aria-hidden />{fm('comparePhotos')}</button>}
      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="journal-photo-heading"
        onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}
        onClose={() => { setSelection(null); if (opener.current?.isConnected) opener.current.focus(); }}>
        {first && selection && <div className={styles.panel}>
          <header><h2 id="journal-photo-heading">{fm(second ? 'compareObservations' : 'photo')}</h2><button type="button" autoFocus onClick={() => dialogRef.current?.close()} aria-label={fm('closePhotos')}><X size={22} aria-hidden /></button></header>
          <p className={styles.explanation}>{fm('photoExplanation')}</p>
          <div className={`${styles.frames} ${second ? styles.pair : ''}`}>
            {[first, ...(second ? [second] : [])].map((photo, index) => <figure key={`${index}-${photo.id}`}>
              <label>{fm(second ? (index === 0 ? 'firstPhoto' : 'secondPhoto') : 'choosePhoto')}
                <select value={photo.id} onChange={(event) => setSelection((current) => current ? { ...current, [index === 0 ? 'first' : 'second']: event.target.value } : null)}>
                  {photos.map((choice) => <option key={choice.id} value={choice.id} disabled={second ? choice.id === (index === 0 ? second.id : first.id) : false}>{optionLabel(choice)}</option>)}
                </select>
              </label>
              <img src={photo.src} alt={`${photo.title || fm('observation')} · ${photo.date}${photo.context ? ` · ${photo.context}` : ''}`} />
              <figcaption><time dateTime={photo.date}>{photo.date}</time><strong lang={photo.title ? '' : undefined}>{photo.title || fm('untitledNote')}</strong>{photo.context && <span lang="">{photo.context}</span>}</figcaption>
            </figure>)}
          </div>
          {photos.length > 1 && <button className={styles.compare} type="button" onClick={() => setSelection({ first: first.id, second: second ? null : photos.find((photo) => photo.id !== first.id)!.id })}><Columns2 size={17} aria-hidden />{fm(second ? 'viewOne' : 'compareAnother')}</button>}
        </div>}
      </dialog>
    </section>
  );
}
