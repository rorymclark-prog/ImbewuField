'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatPackSize } from '@/lib/offline-pack';
import { CACHE_CHANGED_EVENT, downloadPack, offlineSupported, packStatus, requestPersistence, type DownloadProgress } from '@/lib/offline-cache';
import { fieldPageDownloads } from '@/lib/field-page-downloads';
import { studiesPathwayPack, type StudiesPathwayId } from '@/lib/studies-pathway-pack';
import styles from './FinanceCourse.module.css';

export default function PathwayOfflineDownload({ pathwayId }: { pathwayId: StudiesPathwayId }) {
  const pathway = useMemo(() => studiesPathwayPack(pathwayId), [pathwayId]);
  const [media, setMedia] = useState<DownloadProgress | null>(null);
  const [pagesReady, setPagesReady] = useState(false);
  const [stage, setStage] = useState<'idle' | 'media' | 'pages'>('idle');
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
    let status: DownloadProgress;
    try {
      status = await packStatus(pathway.pack);
    } catch {
      if (alive.current && ticket === sequence.current) {
        setMedia(null);
        setPagesReady(false);
        setMessage('Saved files could not be checked. Keep your connection and try again.');
      }
      return;
    }
    const pages = new Map<string, boolean>();
    try {
      await fieldPageDownloads(false, [...pathway.pages], page => pages.set(page.path, page.ready));
    } catch { /* Media alone must never make a reading pathway look saved. */ }
    if (!alive.current || ticket !== sequence.current) return;
    setMedia(status);
    setPagesReady(pathway.pages.every(path => pages.get(path) === true));
    setMessage('');
  }, [pathway]);

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
    setError(''); setStage('media'); setMessage('Saving pictures and practice materials…');
    try {
      if (pathway.pack.missing.length) throw Error('This pathway is missing a file. Keep using the written pages while it is corrected.');
      const persisted = await requestPersistence();
      if (!alive.current || controller.signal.aborted) return;
      setMayClear(!persisted);
      const result = await downloadPack(pathway.pack, undefined, controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      if (result.failed.length) throw Error(`${result.failed.length} files could not be saved. Reconnect and choose Finish download; saved files will be reused.`);
      setStage('pages'); setMessage('Preparing every reading page and its startup files…');
      const pages = new Map<string, boolean>();
      await fieldPageDownloads(true, [...pathway.pages], page => pages.set(page.path, page.ready && !page.error));
      if (!alive.current || controller.signal.aborted) return;
      if (!pathway.pages.every(path => pages.get(path) === true)) throw Error('Some reading pages are not ready to reopen offline. Keep your connection and choose Finish download.');
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : 'This pathway could not finish downloading. Reconnect and try again.');
    } finally {
      if (alive.current) { setStage('idle'); await refresh(); }
      operation.current = null;
    }
  };

  const complete = media && media.total > 0 && media.done === media.total && pagesReady && !pathway.pack.missing.length;
  const busy = stage !== 'idle';
  const partial = Boolean(media?.done) || pagesReady;

  return <section className={`${styles.section} no-print`} aria-labelledby={`${pathway.id}-offline-title`}>
    <h2 id={`${pathway.id}-offline-title`}>Take this reading pathway home</h2>
    <p>Save every English reading page, its pictures and printable practice materials while you have signal.</p>
    <p>Pictures and practice materials: {formatPackSize(pathway.pack.bytes)}. The pages and files needed to open them are downloaded too.</p>
    {!supported ? <p>This browser cannot save the full pathway for offline use. You can print the written pages.</p> : <>
      <div role="status" aria-live="polite">
        {complete && !busy ? <p><strong>{pathway.title} is saved on this device.</strong> Before leaving signal, switch your connection off and reopen a lesson.</p> : <p>{message || (partial ? 'Part of this pathway is saved. Finish the download before leaving signal.' : 'This pathway is not yet saved for offline use.')}</p>}
      </div>
      <div className={styles.actions}>
        {!busy && !complete && <button type="button" onClick={() => void start()} disabled={!media}>{partial ? 'Finish download' : 'Download this pathway'}</button>}
        {stage === 'media' && <button type="button" onClick={() => operation.current?.abort()}>Stop download</button>}
        {!busy && <button type="button" onClick={() => void refresh()}>Check saved pathway</button>}
      </div>
      {busy && <p>{stage === 'media' ? 'Saving pictures and practice materials…' : 'Preparing reading pages…'}</p>}
      {error && <p role="alert">{error}</p>}
      {complete && mayClear && <p>The phone may clear downloads when space is low. Check again before leaving signal.</p>}
    </>}
    <p>This saves this pathway’s teaching pages only. Download app guides and other pathways separately; external source links need a connection. It does not back up your account, answers, app records or live maps.</p>
  </section>;
}
