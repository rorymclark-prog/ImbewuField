'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Check, Loader2, Trash2, AlertTriangle, WifiOff } from 'lucide-react';

import { offlinePack, formatPackSize, type OfflinePack, type PackQuality } from '@/lib/offline-pack';
import {
  downloadPack, packStatus, removePack, offlineSupported, requestPersistence, storageEstimate,
  CACHE_CHANGED_EVENT,
} from '@/lib/offline-cache';

/**
 * Take a module — or the whole course — home.
 *
 * Rory, on watching the finished Seeds module: "all people in KZN go to town to shop at least once
 * a week or 2 or 3 times a month then they download all lessons on their phone (via one click)".
 * That trip is the only moment data is cheap and signal is good. Everything after it happens on a
 * homestead where a 700 KB clip is a decision, so a course that streams is a course that is not
 * used.
 *
 * THE SIZE IS ALWAYS SHOWN, BEFORE THE TAP. It is somebody's airtime. The number comes from
 * lib/course-asset-sizes.ts, which is generated from the real files and checked against disk by a
 * test, so it cannot quietly drift into a lie after a re-encode.
 */

type Phase = 'idle' | 'checking' | 'downloading' | 'done' | 'partial' | 'error';

interface Props {
  /** One module, or every module — the component does not care which. */
  moduleIds: string[];
  lang: string;
  label: string;
  /** Inline row inside a module panel, vs. the prominent whole-course card. */
  compact?: boolean;
}

export default function OfflineDownload({ moduleIds, lang, label, compact = false }: Props) {
  const [packs, setPacks] = useState<OfflinePack[]>([]);
  const [phase, setPhase] = useState<Phase>('checking');
  const [doneFiles, setDoneFiles] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [notPersisted, setNotPersisted] = useState(false);
  const [tightOnSpace, setTightOnSpace] = useState(false);
  // STANDARD BY DEFAULT, ALWAYS. The person this course is built for is on metered KZN data; the
  // higher-quality set exists for facilitators, funders and anyone training off a laptop on wifi.
  // Defaulting the other way would spend a farmer's airtime to serve a projector.
  const [quality, setQuality] = useState<PackQuality>('standard');
  const abortRef = useRef<AbortController | null>(null);

  const totalBytes = packs.reduce((s, p) => s + p.bytes, 0);
  // Both totals are known up front so the choice can be made with the two numbers side by side,
  // rather than by toggling and watching a figure change.
  const sizeFor = useCallback((q: PackQuality) => moduleIds
    .map((id) => offlinePack(id, lang, q))
    .reduce((s, p) => s + p.bytes, 0), [moduleIds, lang]);
  const standardBytes = sizeFor('standard');
  const highBytes = sizeFor('high');
  const hasHigher = highBytes > standardBytes;

  useEffect(() => {
    setPacks(moduleIds.map((id) => offlinePack(id, lang, quality)).filter((p) => p.entries.length > 0));
  }, [moduleIds, lang, quality]);

  const refresh = useCallback(async () => {
    if (packs.length === 0) return;
    if (!offlineSupported()) { setPhase('error'); return; }
    let done = 0; let total = 0; let stored = 0;
    for (const p of packs) {
      const s = await packStatus(p);
      done += s.done; total += s.total; stored += s.bytes;
    }
    setDoneFiles(done); setTotalFiles(total); setBytes(stored);
    setPhase(total > 0 && done === total ? 'done' : done > 0 ? 'partial' : 'idle');
  }, [packs]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Every Download control on the page reads one shared cache, so any of them changing it makes
  // the others' answer wrong. Without this, downloading the whole course left each module still
  // offering a download of files the phone already had.
  useEffect(() => {
    const onChange = () => { void refresh(); };
    window.addEventListener(CACHE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CACHE_CHANGED_EVENT, onChange);
  }, [refresh]);

  const start = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('downloading');
    setFailed([]);

    // Ask before filling the disk, not after. Chrome grants this silently to installed PWAs; where
    // it is refused the download still runs, and the learner is told the phone may clear it.
    setNotPersisted(!(await requestPersistence()));
    const est = await storageEstimate();
    if (est && est.quota > 0) setTightOnSpace(est.quota - est.usage < totalBytes * 1.5);

    const allFailed: string[] = [];
    let base = 0;
    let baseFiles = 0;
    for (const p of packs) {
      const r = await downloadPack(p, (prog) => {
        setDoneFiles(baseFiles + prog.done);
        setBytes(base + prog.bytes);
      }, controller.signal);
      allFailed.push(...r.failed);
      base += p.bytes;
      baseFiles += p.entries.length;
      if (controller.signal.aborted) break;
    }

    abortRef.current = null;
    setFailed(allFailed);
    await refresh();
    // A partial download is never rounded up to success — see DownloadResult in lib/offline-cache.
    if (allFailed.length > 0) setPhase('partial');
  }, [packs, refresh, totalBytes]);

  const cancel = useCallback(() => { abortRef.current?.abort(); }, []);

  const remove = useCallback(async () => {
    for (const p of packs) await removePack(p);
    await refresh();
  }, [packs, refresh]);

  if (packs.length === 0) return null;

  if (!offlineSupported()) {
    return compact ? null : (
      <p className="font-sans text-xs" style={{ color: '#8C7A62' }}>
        This browser cannot store lessons for offline use. Chrome on Android can.
      </p>
    );
  }

  const pct = totalBytes > 0 ? Math.min(100, Math.round((bytes / totalBytes) * 100)) : 0;
  const busy = phase === 'downloading';

  const shell = compact
    ? 'flex flex-wrap items-center gap-2 py-2'
    : 'rounded-2xl p-4 flex flex-col gap-3';
  const shellStyle = compact
    ? undefined
    : { background: 'rgba(31,77,43,0.05)', border: '1px solid #E2D8C4' };

  return (
    <div className={shell} style={shellStyle}>
      {!compact && (
        <div className="flex items-start gap-2">
          <WifiOff size={16} style={{ color: '#1F4D2B', marginTop: 2, flexShrink: 0 }} />
          <div className="min-w-0">
            <p className="font-display font-semibold text-sm" style={{ color: '#20190F' }}>{label}</p>
            {/* Says WHY, in the learner's own terms. A download button with no reason attached
                reads as an app asking for data; this one is a plan for the month. */}
            <p className="font-sans text-xs mt-0.5 leading-relaxed" style={{ color: '#5C5040' }}>
              Get the slides, the narration and the clips onto this phone while you have signal.
              They then work with no airtime at all.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {phase === 'done' ? (
          <>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-display font-semibold"
              style={{ background: 'rgba(31,77,43,0.1)', color: '#1F4D2B', border: '1px solid rgba(31,77,43,0.25)' }}>
              <Check size={13} />On this phone · {formatPackSize(totalBytes)}
            </span>
            <button onClick={remove}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-sans"
              style={{ color: '#8C7A62', border: '1px solid #E2D8C4', background: 'transparent' }}>
              <Trash2 size={12} />Remove
            </button>
          </>
        ) : busy ? (
          <>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-display font-semibold"
              style={{ background: '#1F4D2B', color: '#EAF3E2' }}>
              <Loader2 size={13} className="animate-spin" />
              {formatPackSize(bytes)} of {formatPackSize(totalBytes)}
            </span>
            <button onClick={cancel}
              className="px-2.5 py-1.5 rounded-xl text-xs font-sans"
              style={{ color: '#8C7A62', border: '1px solid #E2D8C4', background: 'transparent' }}>
              Stop
            </button>
          </>
        ) : (
          <button onClick={start} disabled={phase === 'checking'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-display font-semibold transition-all"
            style={{ background: '#1F4D2B', color: '#EAF3E2', border: 'none', opacity: phase === 'checking' ? 0.6 : 1 }}>
            <Download size={13} />
            {/* A resumed download quotes what is LEFT, not the whole thing — the already-cached
                files are not fetched again and quoting them would overstate the cost. */}
            {phase === 'partial' && doneFiles > 0
              ? `Finish download · ${formatPackSize(Math.max(0, totalBytes - bytes))} left`
              : `Download · ${formatPackSize(totalBytes)}`}
          </button>
        )}
      </div>

      {/* THE QUALITY CHOICE, named for who it is for and priced in the same breath.
          Rory: "i want a high res version available for facilitators and funders and those with
          data and network ... label them so that people know its higher res more data."
          Both sizes are shown at once so nobody has to toggle back and forth to compare, and the
          higher option says who it is for — a farmer scanning this should be able to tell in one
          read that it is not the one for them. Hidden entirely when the module has no
          higher-quality files, rather than offering a choice that changes nothing. */}
      {hasHigher && !busy && phase !== 'done' && (
        <div role="group" aria-label="Download quality" className="flex flex-wrap items-center gap-1.5">
          {([
            { key: 'standard' as PackQuality, name: 'Standard', note: 'for phones on data', size: standardBytes },
            { key: 'high' as PackQuality, name: 'Higher quality', note: 'facilitators & funders · wifi', size: highBytes },
          ]).map((opt) => {
            const on = quality === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setQuality(opt.key)}
                aria-pressed={on}
                className="text-left px-2.5 py-1.5 rounded-xl"
                style={{
                  background: on ? 'rgba(31,77,43,0.10)' : 'transparent',
                  border: `1px solid ${on ? 'rgba(31,77,43,0.30)' : '#E2D8C4'}`,
                  cursor: 'pointer',
                }}
              >
                <span className="font-sans text-xs font-semibold block" style={{ color: on ? '#1F4D2B' : '#5C5040' }}>
                  {opt.name} · {formatPackSize(opt.size)}
                </span>
                <span className="font-sans block" style={{ fontSize: 10.5, color: '#8C7A62' }}>{opt.note}</span>
              </button>
            );
          })}
        </div>
      )}

      {(busy || phase === 'partial') && totalFiles > 0 && (
        <div className="w-full">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(32,25,15,0.08)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#1F4D2B' }} />
          </div>
          <p className="font-mono text-xs mt-1" style={{ color: '#8C7A62' }}>
            {doneFiles} of {totalFiles} files
          </p>
        </div>
      )}

      {failed.length > 0 && (
        // Named, not buried. The gap would otherwise surface at the homestead, weeks later, with
        // no signal left to fix it and no way to tell a broken app from a broken download.
        <p className="flex items-start gap-1.5 font-sans text-xs leading-relaxed" style={{ color: '#8A4B2A' }}>
          <AlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
          {failed.length} {failed.length === 1 ? 'file' : 'files'} did not download. Tap Finish download
          again while you still have signal — the rest is already saved.
        </p>
      )}

      {phase === 'done' && notPersisted && (
        <p className="font-sans text-xs leading-relaxed" style={{ color: '#8C7A62' }}>
          Saved, but this phone may clear it if storage runs low. Installing the app to your home
          screen makes it stick.
        </p>
      )}

      {tightOnSpace && phase !== 'done' && (
        <p className="font-sans text-xs leading-relaxed" style={{ color: '#8A4B2A' }}>
          This phone is low on space — the download may not fit.
        </p>
      )}
    </div>
  );
}
