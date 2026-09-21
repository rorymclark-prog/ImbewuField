'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppGuide } from '@/lib/course-app-guides';
import { formatPackSize } from '@/lib/offline-pack';
import { CACHE_CHANGED_EVENT, downloadPack, offlineSupported, packStatus, removePack, requestPersistence, type DownloadProgress } from '@/lib/offline-cache';
import { fieldPageDownloads } from '@/lib/field-page-downloads';
import styles from './AppGuide.module.css';
import { guidePackWithScreens } from './guide-screens';

export default function GuideOfflineDownload({ guide }: { guide: AppGuide }) {
  const pack = useMemo(() => guidePackWithScreens(guide.id), [guide.id]);
  const [media, setMedia] = useState<DownloadProgress | null>(null);
  const [savedBytes, setSavedBytes] = useState(0);
  const [pageReady, setPageReady] = useState(false);
  const [stage, setStage] = useState<'idle' | 'media' | 'page'>('idle');
  const [message, setMessage] = useState('Checking what is saved on this device…');
  const [error, setError] = useState('');
  const [supported, setSupported] = useState(true);
  const [mayClear, setMayClear] = useState(false);
  const operation = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const sequence = useRef(0);

  const refresh = useCallback(async () => {
    const ticket = ++sequence.current;
    const available = offlineSupported() && 'serviceWorker' in navigator;
    if (!alive.current) return;
    setSupported(available);
    if (!available) return;
    const status = await packStatus(pack);
    const pages = new Map<string, boolean>();
    try {
      await fieldPageDownloads(false, [guide.href, '/student'], p => pages.set(p.path, p.ready));
    } catch { /* A saved media file is not proof that the page can reopen. */ }
    if (!alive.current || ticket !== sequence.current) return;
    setMedia(status);
    setPageReady(pages.get(guide.href) === true && pages.get('/student') === true);
    setMessage('');
  }, [pack, guide.href]);

  useEffect(() => {
    alive.current = true;
    const update = () => { if (!operation.current) void refresh(); };
    update();
    window.addEventListener(CACHE_CHANGED_EVENT, update);
    window.addEventListener('online', update);
    window.addEventListener('focus', update);
    return () => {
      alive.current = false;
      operation.current?.abort();
      window.removeEventListener(CACHE_CHANGED_EVENT, update);
      window.removeEventListener('online', update);
      window.removeEventListener('focus', update);
    };
  }, [refresh]);

  const start = async () => {
    const controller = new AbortController();
    operation.current = controller;
    ++sequence.current;
    setError(''); setStage('media'); setMessage('Saving recordings and pictures…');
    try {
      if (pack.missing.length) throw Error('This guide is missing a file. Please keep using the written steps while it is corrected.');
      setMayClear(!(await requestPersistence()));
      const result = await downloadPack(pack, p => { if (alive.current) setSavedBytes(p.bytes); }, controller.signal);
      if (controller.signal.aborted) return;
      if (result.failed.length) throw Error(`${result.failed.length} files could not be saved. Reconnect and choose Finish download; saved files will be reused.`);
      setStage('page'); setMessage('Preparing the written guide and My Studies…');
      const pages = new Map<string, boolean>();
      await fieldPageDownloads(true, [guide.href, '/student'], p => pages.set(p.path, p.ready && !p.error));
      if (!pages.get(guide.href) || !pages.get('/student')) throw Error('The written guide is not ready to reopen offline. Keep your connection and choose Finish download.');
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'The guide could not finish downloading. Reconnect and try again.');
    } finally {
      if (alive.current) { setStage('idle'); await refresh(); }
      operation.current = null;
    }
  };

  const removeRecordings = async () => {
    // The illustration is shared with assessed lessons and other guides. Giving back this
    // guide's audio space must not break an unrelated download the learner paid for.
    const audio = pack.entries.filter(e => e.kind === 'audio');
    setError('');
    try {
      await removePack({ ...pack, entries: audio, bytes: audio.reduce((sum, e) => sum + e.bytes, 0) });
      const remaining = await packStatus({ ...pack, entries: audio });
      if (remaining.done) setError('Some recordings could not be removed. Try again.');
    } catch { setError('Device storage could not be changed. Try again.'); }
    await refresh();
  };

  const complete = media && media.total > 0 && media.done === media.total && pageReady && !pack.missing.length;
  const busy = stage !== 'idle';
  const partial = Boolean(media?.done);
  return <section className={`${styles.offline} no-print`} aria-labelledby="guide-offline-title">
    <h2 id="guide-offline-title">Take this guide home</h2>
    <p>Save the written steps, screen pictures and English recordings while you have signal.</p>
    <p className={styles.small}>Recordings and pictures: {formatPackSize(pack.bytes)}. Files needed to open the guide are downloaded too.</p>
    {!supported ? <p>This browser cannot save the full guide for offline use. You can print the written steps.</p> : <>
      <div role="status" aria-live="polite">
        {complete && !busy ? <p><strong>Guide saved on this device.</strong> Before leaving signal, switch your connection off, reopen this guide and try a recording.</p> : <p>{message || (partial ? 'Part of this guide is saved. Finish the download before leaving signal.' : 'This guide is not yet saved for offline use.')}</p>}
      </div>
      <div className={styles.actions}>
        {!busy && !complete && <button type="button" onClick={() => void start()} disabled={!media}>{partial ? 'Finish download' : 'Download this guide'}</button>}
        {stage === 'media' && <button type="button" onClick={() => operation.current?.abort()}>Stop download</button>}
        {!busy && media && media.done > 1 && <button type="button" onClick={() => void removeRecordings()}>Remove this guide’s recordings</button>}
        {!busy && <button type="button" onClick={() => void refresh()}>Check saved guide</button>}
      </div>
      {busy && <p>{formatPackSize(savedBytes)} of {formatPackSize(pack.bytes)} of recordings and pictures saved.</p>}
      {error && <p role="alert">{error}</p>}
      {complete && mayClear && <p>The phone may clear downloads when space is low. Check again before leaving signal.</p>}
    </>}
    <p className={styles.small}>This saves the guide and its pictures, not the sample farm or every app tool. Removing recordings keeps the written page and pictures.</p>
  </section>;
}
