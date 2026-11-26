'use client';

import { useEffect, useRef, useState } from 'react';
import { downloadFile } from '@/lib/file-delivery';
import { buildGardenProgressReportHtml, type GardenProgressReportHtmlInput } from '@/lib/international/projects/garden-report-html';
import { buildGardenReport, gardenRecordInPeriod, validGardenReportDates, type GardenReportDates, type GardenReportSite } from '@/lib/international/projects/garden-report';
import type { GardenReportRead } from '@/lib/international/projects/garden-report-source';

interface Props {
  sites: readonly GardenReportSite[];
  load: (siteId: string, isCurrent: () => boolean) => Promise<GardenReportRead | null>;
}

const button = 'min-h-11 rounded-lg border border-[var(--border)] px-3 py-2 font-semibold disabled:opacity-50';
const field = 'min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2';
const datesEmpty: GardenReportDates = { periodStart: '', periodEnd: '', cutoffDate: '' };
const changed = 'The garden or its records changed. Check the linked records again.';
const dateFields: readonly [keyof GardenReportDates, string][] = [
  ['periodStart', 'First reporting day'], ['periodEnd', 'Last reporting day'], ['cutoffDate', 'Records entered by'],
];

function toggled(ids: ReadonlySet<string>, id: string, checked: boolean) {
  const next = new Set(ids);
  if (checked) next.add(id); else next.delete(id);
  return next;
}

function quantityLabel(quantity: number | null, unit: string | null) {
  return quantity === null || !unit ? 'Quantity unknown' : [quantity, unit].join(' ');
}

/** Mounted with the grower source revision as its key so old account/site data
 * cannot survive a withdrawal of the checked source. */
export default function GardenProgressReport({ sites, load }: Props) {
  const [siteId, setSiteId] = useState('');
  const [dates, setDates] = useState(datesEmpty);
  const [read, setRead] = useState<GardenReportRead | null>(null);
  const [harvestIds, setHarvestIds] = useState<ReadonlySet<string>>(new Set());
  const [noteIds, setNoteIds] = useState<ReadonlySet<string>>(new Set());
  const [preview, setPreview] = useState<GardenProgressReportHtmlInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const mounted = useRef(false), generation = useRef(0), operation = useRef<object | null>(null);
  const readRef = useRef<GardenReportRead | null>(null);
  const previewRef = useRef<GardenProgressReportHtmlInput | null>(null);

  function withdrawRecords() {
    generation.current++;
    operation.current = null;
    readRef.current?.release();
    readRef.current = null;
    previewRef.current = null;
  }

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; withdrawRecords(); };
  }, []);

  function reset() {
    withdrawRecords();
    setRead(null); setPreview(null); setHarvestIds(new Set()); setNoteIds(new Set());
    setBusy(false); setMessage('');
  }

  function invalidatePreview() {
    previewRef.current = null;
    setPreview(null);
    setMessage('');
  }

  function begin() {
    if (operation.current || !mounted.current) return null;
    const token = {};
    operation.current = token;
    setBusy(true);
    setMessage('');
    return token;
  }

  function finish(token: object) {
    if (operation.current === token) {
      operation.current = null;
      if (mounted.current) setBusy(false);
    }
  }

  async function loadRecords() {
    if (!siteId || !validGardenReportDates(dates) || operation.current) return;
    reset();
    const token = begin();
    if (!token) return;
    const turn = generation.current;
    const current = () => mounted.current && generation.current === turn;
    try {
      const loaded = await load(siteId, current);
      if (!current() || operation.current !== token || !loaded?.isCurrent()) {
        loaded?.release();
        if (current()) setMessage(changed);
        return;
      }
      readRef.current = loaded;
      setRead(loaded);
    } catch { if (current()) setMessage('Could not check the garden’s linked records. Try again.'); }
    finally { finish(token); }
  }

  async function prepare() {
    if (!read || readRef.current !== read || !read.isCurrent()) {
      setMessage(changed);
      return;
    }
    const token = begin();
    if (!token) return;
    invalidatePreview();
    const current = () => mounted.current && operation.current === token && readRef.current === read;
    try {
      if (!await read.checkCurrent() || !current()) {
        if (current()) setMessage(changed);
        return;
      }
      const report = buildGardenReport(read.records, dates, harvestIds, noteIds);
      if (!report || !read.isCurrent()) { setMessage(changed); return; }
      previewRef.current = report;
      setPreview(report);
    } catch { if (current()) setMessage('Could not verify the selected records. Try again.'); }
    finally { finish(token); }
  }

  async function download() {
    if (!read || !preview || previewRef.current !== preview) return;
    const token = begin();
    if (!token) return;
    const current = () => mounted.current && operation.current === token && readRef.current === read
      && previewRef.current === preview && read.isCurrent();
    try {
      const name = preview.sample ? 'DEMO-garden-progress-report.html' : 'garden-progress-report.html';
      const html = buildGardenProgressReportHtml(preview);
      const result = await downloadFile(new Blob([html], { type: 'text/html;charset=utf-8' }), name,
        async () => current() && await read.checkCurrent() && current(), current);
      if (mounted.current && operation.current === token) {
        if (result !== 'downloaded') invalidatePreview();
        setMessage(result === 'downloaded' ? 'Garden progress report downloaded.' : changed);
      }
    } catch { if (mounted.current && operation.current === token) setMessage('Could not download the report. Try again.'); }
    finally { finish(token); }
  }

  const notes = read?.records.notes.filter(note => gardenRecordInPeriod(note, dates)) ?? [];
  const shownHarvest = new Map(read?.records.harvest.map(row => [row.recordId, row]));
  const ready = !!siteId && validGardenReportDates(dates);
  return <details lang="en" className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] px-4 text-sm text-[var(--text-primary)]"
      onToggle={event => { if (!event.currentTarget.open) reset(); }}>
    <summary className="min-h-11 cursor-pointer py-3 font-display text-lg font-semibold">Garden project progress</summary>
    <div className="space-y-4 pb-4">
      <p>Build a private Food Security garden report from linked harvest records and field notes.</p>
      <form aria-label="Garden report dates" className="space-y-3" onSubmit={event => { event.preventDefault(); void loadRecords(); }}>
        <label className="block space-y-1">Mapped garden
          <select aria-label="Mapped garden" className={field} required value={siteId} onChange={event => { reset(); setSiteId(event.target.value); }}>
            <option value="">Choose a saved garden</option>
            {sites.map(site => <option key={site.id} value={site.id}>{site.label}</option>)}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-3">{dateFields.map(([key, label]) => <label key={key} className="block min-w-0 space-y-1">{label}
          <input aria-label={label} type="date" className={field} required value={dates[key]}
            onChange={event => { reset(); setDates({ ...dates, [key]: event.target.value }); }} />
        </label>)}</div>
        <p>Dates use UTC. The recording cutoff can be the last reporting day or later.</p>
        {dateFields.every(([key]) => dates[key]) && !validGardenReportDates(dates) &&
          <p role="status">Check the date order and recording cutoff.</p>}
        <button className={button} type="submit" disabled={!ready || busy}>Check linked records</button>
      </form>
      {read && <div className="space-y-3">
        {read.records.sample && <p className="font-semibold">DEMO — sample records</p>}
        <fieldset className="space-y-1">
          <legend className="font-semibold">Choose harvest records</legend>
          {shownHarvest.size === 0 && <p>No linked harvest records could be verified for this garden.</p>}
          {[...shownHarvest.values()].map(row => <label key={row.recordId} className="flex min-h-11 items-start gap-3 break-words py-2">
            <input className="mt-1" type="checkbox" checked={harvestIds.has(row.recordId)} disabled={busy}
              onChange={event => { invalidatePreview(); setHarvestIds(toggled(harvestIds, row.recordId, event.target.checked)); }} />
            <span className="min-w-0">{quantityLabel(row.quantity, row.unit)} · Picked {row.observedOn} · Recorded {row.recordedOn ?? 'unknown'}<br />{row.recordId}</span>
          </label>)}
        </fieldset>
        <fieldset className="space-y-1">
          <legend className="font-semibold">Choose field notes for the timeline</legend>
          {read.notesHeld ? <p>Field notes are unavailable for this draft.</p>
            : notes.length === 0 && <p>No verified field notes match this reporting period.</p>}
          {notes.map(note => <label key={note.recordId} className="flex min-h-11 items-start gap-3 break-words py-2">
            <input className="mt-1" type="checkbox" checked={noteIds.has(note.recordId)} disabled={busy}
              onChange={event => { invalidatePreview(); setNoteIds(toggled(noteIds, note.recordId, event.target.checked)); }} />
            <span className="min-w-0">Observed {note.observedOn} · Recorded {note.recordedOn}<br />{note.text}</span>
          </label>)}
        </fieldset>
        <button className={button} type="button" disabled={busy} onClick={() => void prepare()}>Preview garden report</button>
      </div>}
      {preview && <section aria-label="Garden report preview" className="space-y-3 border-t border-[var(--border)] pt-3">
        <h2 className="text-base font-semibold">Private draft for {preview.siteLabel}</h2>
        <p>{preview.periodStart} to {preview.periodEnd} · Records entered by {preview.cutoffDate} (UTC). Selected records only.</p>
        <p className="font-semibold">{preview.total.value !== null ? 'Recorded harvest weight: ' + preview.total.value + ' kg'
          : preview.total.knownSubtotal !== null ? 'Known partial weight: ' + preview.total.knownSubtotal + ' kg'
            : 'Recorded harvest weight is unknown.'}</p>
        {preview.total.gaps.map(gap => <p key={gap}>{gap}</p>)}
        {!!preview.harvest.length && <ul aria-label="Selected harvest evidence" className="space-y-2">{preview.harvest.map((row, index) =>
          <li key={row.recordId + index} className="break-words">
            <p>{quantityLabel(row.quantity, row.unit)} · Picked {row.pickedOn} · Recorded {row.recordedOn ?? 'unknown'} · {row.recordId}</p>
            {row.reasons.map(reason => <p key={reason}>{reason}</p>)}
          </li>)}</ul>}
        {!!preview.notes?.length && <ul aria-label="Selected field notes" className="space-y-2">{preview.notes.map(note =>
          <li key={note.recordId} className="break-words">Observed {note.observedOn} · Recorded {note.recordedOn}<br />{note.text}</li>)}</ul>}
        <button className={button} type="button" disabled={busy} onClick={() => void download()}>Download garden report</button>
      </section>}
      <p role="status" aria-live="polite">{busy ? 'Checking current records…' : message}</p>
    </div>
  </details>;
}
