'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Columns2, X } from 'lucide-react';
import type { JournalEntry } from '@/lib/field-journal';
import styles from './JournalPhotoReview.module.css';

/** Compare the farmer's own dated observations, without inferring crop health or yields. */
export default function JournalPhotoReview({ entries }: { entries: readonly JournalEntry[] }) {
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

  const optionLabel = (photo: typeof photos[number]) => `${photo.date} · ${photo.title || 'Untitled note'}${photo.context ? ` · ${photo.context}` : ''} · Photo ${photo.number}`;
  return (
    <section className={styles.review} lang="en" aria-label="Journal photos">
      <div className={styles.heading}><Camera size={16} aria-hidden /><h2>Photos in these notes</h2></div>
      <p>Open a photo or compare two dates. These are the pictures saved with your notes.</p>
      <div className={styles.strip}>
        {photos.slice(0, 8).map((photo) => <button key={photo.id} type="button" onClick={() => open(photo.id, false)} aria-label={`Open photo: ${optionLabel(photo)}`}>
          <img src={photo.src} alt="" loading="lazy" />
          <span>{photo.date}</span>
        </button>)}
      </div>
      {photos.length > 1 && <button className={styles.compare} type="button" onClick={() => open(photos[0].id, true)}><Columns2 size={17} aria-hidden />Compare two photos</button>}
      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="journal-photo-heading"
        onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}
        onClose={() => { setSelection(null); if (opener.current?.isConnected) opener.current.focus(); }}>
        {first && selection && <div className={styles.panel}>
          <header><h2 id="journal-photo-heading">{second ? 'Compare your observations' : 'Journal photo'}</h2><button type="button" autoFocus onClick={() => dialogRef.current?.close()} aria-label="Close journal photos"><X size={22} aria-hidden /></button></header>
          <p className={styles.explanation}>Dates and captions come from your notes. Photos alone do not measure growth or prove a yield.</p>
          <div className={`${styles.frames} ${second ? styles.pair : ''}`}>
            {[first, ...(second ? [second] : [])].map((photo, index) => <figure key={`${index}-${photo.id}`}>
              <label>{second ? (index === 0 ? 'First photo' : 'Second photo') : 'Choose a photo'}
                <select value={photo.id} onChange={(event) => setSelection((current) => current ? { ...current, [index === 0 ? 'first' : 'second']: event.target.value } : null)}>
                  {photos.map((choice) => <option key={choice.id} value={choice.id} disabled={second ? choice.id === (index === 0 ? second.id : first.id) : false}>{optionLabel(choice)}</option>)}
                </select>
              </label>
              <img src={photo.src} alt={`${photo.title || 'Journal observation'} · ${photo.date}${photo.context ? ` · ${photo.context}` : ''}`} />
              <figcaption><time dateTime={photo.date}>{photo.date}</time><strong>{photo.title || 'Untitled note'}</strong>{photo.context && <span>{photo.context}</span>}</figcaption>
            </figure>)}
          </div>
          {photos.length > 1 && <button className={styles.compare} type="button" onClick={() => setSelection({ first: first.id, second: second ? null : photos.find((photo) => photo.id !== first.id)!.id })}><Columns2 size={17} aria-hidden />{second ? 'View one photo' : 'Compare with another photo'}</button>}
        </div>}
      </dialog>
    </section>
  );
}
