'use client';

import { useEffect, useRef, useState } from 'react';
import { downloadFile } from '@/lib/crop-export-deliver';
import {
  buildDwdKlObservationHtml, dwdKlObservationReport, DWD_KL_COLUMNS, DWD_KL_INTERVALS,
  DWD_KL_LIMITS, DWD_KL_PRELIMINARY, DWD_KL_QUALITY, DWD_KL_TITLE,
} from '@/lib/international/dwd-kl-observation-report';
import {
  dwdKlRequestableDays, dwdKlSelectionProblem, DWD_KL_ATTRIBUTION, DWD_KL_LICENCE, DWD_KL_SPECIFICATION,
  DWD_KL_STATIONS, type DwdKlSelection,
} from '@/lib/international/providers/dwd-kl-observations';
import type { DwdKlLoad } from '@/lib/international/providers/dwd-kl-http';

const blank = { stationId: '', firstDay: '', lastDay: '' };
const inputClass = 'min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-2 text-sm';
const buttonClass = 'min-h-11 rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50';

export default function DwdKlObservationPanel({ actorIsCurrent }: { actorIsCurrent: () => boolean }) {
  const [selection, setSelection] = useState<DwdKlSelection>(blank);
  const [outcome, setOutcome] = useState<DwdKlLoad | null>(null);
  const [loading, setLoading] = useState(false);
  const selectionLive = useRef(selection);
  const outcomeLive = useRef(outcome);
  const pending = useRef<AbortController | null>(null);
  const active = useRef(true);
  const currentActor = useRef(actorIsCurrent);
  currentActor.current = actorIsCurrent;
  const ready = outcome?.status === 'available' && actorIsCurrent() ? outcome : null;
  const report = ready && dwdKlObservationReport(ready);
  const now = new Date();
  const dates = dwdKlRequestableDays(now);
  const canRead = dwdKlSelectionProblem(selection, now) === null;

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      pending.current?.abort();
      pending.current = null;
      outcomeLive.current = null;
    };
  }, []);

  function clearRead() {
    pending.current?.abort();
    pending.current = null;
    outcomeLive.current = null;
    setOutcome(null);
    setLoading(false);
  }

  function change(key: keyof DwdKlSelection, value: string) {
    if (!active.current || !currentActor.current()) return;
    clearRead();
    const next = { ...selectionLive.current, [key]: value };
    selectionLive.current = next;
    setSelection(next);
  }

  async function read() {
    if (!active.current || !currentActor.current() || pending.current || !canRead || selectionLive.current !== selection) return;
    const controller = new AbortController();
    pending.current = controller;
    outcomeLive.current = null;
    setOutcome(null);
    setLoading(true);
    const query = new URLSearchParams({ ...selection });
    let result: DwdKlLoad = { status: 'held', reason: 'unavailable' };
    try {
      const response = await fetch(`/api/international/dwd-kl?${query}`, { signal: controller.signal, cache: 'no-store' });
      if (response.ok) {
        const candidate: DwdKlLoad = await response.json();
        if (candidate?.status === 'held' || (candidate?.status === 'available' &&
          candidate.station.id === selection.stationId && candidate.selection.stationId === selection.stationId && candidate.selection.firstDay === selection.firstDay &&
          candidate.selection.lastDay === selection.lastDay)) result = candidate;
      }
    } catch { /* A held result keeps the station values unavailable. */ }
    if (pending.current !== controller || !active.current) return;
    pending.current = null;
    setLoading(false);
    if (!currentActor.current()) return;
    outcomeLive.current = result;
    setOutcome(result);
  }

  async function download() {
    const isCurrent = () => !!ready && active.current && currentActor.current() && outcomeLive.current === ready;
    if (!ready || !isCurrent()) return;
    const file = new Blob([buildDwdKlObservationHtml(ready)], { type: 'text/html;charset=utf-8' });
    await downloadFile(file, `dwd-${ready.station.id}-${ready.selection.firstDay}.html`, isCurrent, isCurrent);
  }

  return <details aria-label={DWD_KL_TITLE} className="space-y-3 rounded-lg border border-[var(--border)] p-3 text-sm">
    <summary className="min-h-11 cursor-pointer py-2 font-semibold">{DWD_KL_TITLE}</summary>
    <p>{DWD_KL_LIMITS}</p>
    <p>Choose a station and up to 366 days from DWD’s recent archive. {DWD_KL_PRELIMINARY}</p>
    <div className="grid gap-2 sm:grid-cols-3">
      <label>Climate station<select className={inputClass} value={selection.stationId} onChange={event => change('stationId', event.target.value)}>
        <option value="">Choose station</option>
        {DWD_KL_STATIONS.map(station =>
          <option key={station.id} value={station.id}>{station.name} · {station.id}</option>)}
      </select></label>
      <label>First DWD day<input className={inputClass} type="date" min={dates.firstDay} max={dates.lastDay}
        value={selection.firstDay} onChange={event => change('firstDay', event.target.value)} /></label>
      <label>Last DWD day<input className={inputClass} type="date" min={dates.firstDay} max={dates.lastDay}
        value={selection.lastDay} onChange={event => change('lastDay', event.target.value)} /></label>
    </div>
    <button className={buttonClass} type="button" disabled={loading || !canRead || !actorIsCurrent()} onClick={read}>Read DWD station history</button>
    {loading && <p role="status">Reading station history…</p>}
    {outcome?.status === 'held' && <p role="status">{outcome.reason === 'rate-limited'
      ? 'DWD is limiting requests. Try again later.'
      : 'Station history is unavailable for this request. Check the dates or try again later.'}</p>}
    {ready && report && <section aria-label="DWD station observations" className="space-y-2">
      <p className="break-words font-semibold">{report.station}</p>
      <p>{report.period}</p><p role="status">{report.coverage}</p>
      <p>{DWD_KL_INTERVALS}</p><p>{DWD_KL_QUALITY}</p>
      <p>{DWD_KL_ATTRIBUTION} · Retrieved {ready.source.retrievedAt} · <a className="underline" href={ready.source.url} target="_blank" rel="noreferrer">Original archive</a>
        {' · '}<a className="underline" href={DWD_KL_SPECIFICATION} target="_blank" rel="noreferrer">Dataset specification</a>
        {' · '}<a className="underline" href={DWD_KL_LICENCE} target="_blank" rel="noreferrer">CC BY 4.0</a></p>
      <p className="sm:hidden">Scroll the table to see all readings and quality codes.</p>
      <div className="overflow-x-auto" role="region" aria-label="Daily station readings" tabIndex={0}>
        <table className="w-full border-collapse text-left">
          <caption className="text-left font-semibold">Daily station readings</caption>
          <thead><tr>{DWD_KL_COLUMNS.map(label =>
            <th className="border-b border-[var(--border)] px-2 py-1" scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{report.rows.map(row => <tr key={row.day} className="border-b border-[var(--border)]">
            <th className="whitespace-nowrap px-2 py-1 font-normal" scope="row">{row.day}</th>
            {row.cells ? row.cells.map((cell, index) => <td className="px-2 py-1" key={DWD_KL_COLUMNS[index + 1]}>{cell}</td>)
              : <td className="px-2 py-1" colSpan={DWD_KL_COLUMNS.length - 1}>No station record</td>}
          </tr>)}</tbody>
        </table>
      </div>
      <button className={buttonClass} type="button" onClick={download}>Download DWD station history</button>
    </section>}
  </details>;
}
