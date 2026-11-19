'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { downloadFile } from '@/lib/crop-export-deliver';
import {
  buildEcccObservationHtml, ecccObservationReport, ECCC_OBSERVATION_LIMITS, ECCC_OBSERVATION_TITLE,
} from '@/lib/international/eccc-observation-report';
import { loadEcccDailyObservations, type EcccDailyLoad } from '@/lib/international/providers/eccc-daily-http';
import {
  ecccDailyObservationUrl, ecccLatestRequestableDay, ECCC_DAILY_ATTRIBUTION, ECCC_DAILY_LICENCE, type EcccDailySelection,
} from '@/lib/international/providers/eccc-daily-observations';

const blank = { stationClimateId: '', firstLocalDay: '', lastLocalDay: '' };
const control = 'min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-2 text-sm';
const button = 'min-h-11 rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50';

export default function EcccObservationPanel({ actorIsCurrent }: { actorIsCurrent: () => boolean }) {
  const [selection, setSelection] = useState<EcccDailySelection>(blank);
  const selectionLive = useRef<EcccDailySelection>(blank);
  const [outcome, setOutcome] = useState<EcccDailyLoad | null>(null);
  const [loading, setLoading] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const active = useRef(true);
  const currentActor = useRef(actorIsCurrent);
  currentActor.current = actorIsCurrent;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      pending.current?.abort();
      pending.current = null;
    };
  }, []);

  const outcomeLive = useRef(outcome);
  outcomeLive.current = outcome;
  const ready = outcome?.status === 'available' ? outcome : null;
  const report = ready && ecccObservationReport(ready);
  const latestDay = ecccLatestRequestableDay();
  const canRead = !!ecccDailyObservationUrl(selection) && selection.lastLocalDay <= latestDay;

  function change(key: keyof EcccDailySelection, event: ChangeEvent<HTMLInputElement>) {
    if (!active.current || !currentActor.current()) return;
    const value = event.target.value;
    pending.current?.abort();
    pending.current = null;
    outcomeLive.current = null;
    setOutcome(null);
    setLoading(false);
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
    const result = await loadEcccDailyObservations(selection, controller.signal);
    if (pending.current !== controller) return;
    pending.current = null;
    if (!active.current) return;
    setLoading(false);
    if (currentActor.current()) {
      outcomeLive.current = result;
      setOutcome(result);
    }
  }

  async function download() {
    const isCurrent = () => !!ready && active.current && currentActor.current() && outcomeLive.current === ready;
    if (!ready || !isCurrent()) return;
    const file = new Blob([buildEcccObservationHtml(ready)], { type: 'text/html;charset=utf-8' });
    await downloadFile(file, `station-${ready.selection.stationClimateId}-${ready.selection.firstLocalDay}.html`, isCurrent, isCurrent);
  }

  return <details aria-label={ECCC_OBSERVATION_TITLE} className="space-y-3 rounded-lg border border-[var(--border)] p-3 text-sm">
    <summary className="min-h-11 cursor-pointer py-2 font-semibold">{ECCC_OBSERVATION_TITLE}</summary>
    <p>{ECCC_OBSERVATION_LIMITS}</p>
    <p>Choose a public ECCC climate station ID and up to 366 historical days. New dates become selectable at 08:00 UTC.
      The request sends only the station ID and dates.
      {' '}<a className="underline" href="https://climate.weather.gc.ca/historical_data/search_historic_data_e.html" target="_blank" rel="noreferrer">Find a climate station ID</a>.</p>
    <div className="grid gap-2 sm:grid-cols-3">
      <label>Climate station ID<input className={control} value={selection.stationClimateId} maxLength={7}
        spellCheck={false} placeholder="e.g. 4057165" onChange={e => change('stationClimateId', e)} /></label>
      <label>First station day<input className={control} type="date" max={latestDay} value={selection.firstLocalDay} onChange={e => change('firstLocalDay', e)} /></label>
      <label>Last station day<input className={control} type="date" max={latestDay} value={selection.lastLocalDay} onChange={e => change('lastLocalDay', e)} /></label>
    </div>
    <button className={button} type="button" disabled={loading || !canRead} onClick={read}>Read station history</button>
    {loading && <p role="status">Reading station history…</p>}
    {outcome?.status === 'held' && <p role="status">{outcome.reason === 'rate-limited'
      ? 'ECCC is limiting requests. Try again later.'
      : outcome.reason === 'unavailable' ? 'Station history is unavailable. Check the connection and try again.'
      : 'The selected station response could not be verified. Check the station ID and dates.'}</p>}
    {ready && report && <section aria-label="Station observations" className="space-y-2">
      <p className="font-semibold break-words">{report.station}</p>
      <p>{report.period}</p><p role="status">{report.coverage}</p>
      <p>{ECCC_DAILY_ATTRIBUTION} · <a className="underline" href={ready.source.url} target="_blank" rel="noreferrer">Original station query</a>
        {' · '}<a className="underline" href={ECCC_DAILY_LICENCE} target="_blank" rel="noreferrer">Data licence</a></p>
      <div className="overflow-x-auto"><table className="w-full border-collapse text-left">
        <caption className="text-left font-semibold">Daily air temperature in degrees Celsius</caption>
        <thead><tr>{['Local date', 'Minimum', 'Mean', 'Maximum'].map(label =>
          <th className="border-b border-[var(--border)] px-2 py-1" scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{report.rows.map(row => <tr key={row.day} className="border-b border-[var(--border)]">
          <th className="whitespace-nowrap px-2 py-1 font-normal" scope="row">{row.day}</th>
          {row.cells ? row.cells.map((cell, index) => <td className="px-2 py-1" key={index}>{cell}</td>)
            : <td className="px-2 py-1" colSpan={3}>No station record</td>}
        </tr>)}</tbody>
      </table></div>
      <button className={button} type="button" onClick={download}>Download station history</button>
    </section>}
  </details>;
}
