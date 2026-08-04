'use client';

// "Take this plan with you" — the two ways the crop plan leaves the screen.
//
//  📅 Calendar  → every task of the year as an .ics file that imports into
//                 Google Calendar and Apple Calendar (lib/crop-calendar-ics.ts).
//  🖨 Print/PDF → the whole plan as a document, seed-buying schedule included,
//                 for a farmer who works off paper (lib/crop-export-pdf.ts).
//
// Both files are generated on the device — no network, nothing uploaded.
// The heavy work (jsPDF) is behind a dynamic import inside the builder, so
// opening the crop plan does not pay for a document nobody asked for.

import { useState } from 'react';
import type { CropTask, PlanBed, Planting } from '@/lib/crop-plan';
import { buildCropPlanIcs, cropPlanIcsFilename } from '@/lib/crop-calendar-ics';
import { buildCropPlanPdf, cropPlanPdfFilename, type CropPlanPdfMeta } from '@/lib/crop-export-pdf';
import { deliverFile } from '@/lib/crop-export-deliver';

export interface CropPlanExportCardProps {
  plantings: Planting[];
  beds: PlanBed[];
  tasks: CropTask[];
  meta: CropPlanPdfMeta;
  yearReport?: string[];
}

type Busy = 'ics' | 'pdf' | null;

export default function CropPlanExportCard({ plantings, beds, tasks, meta, yearReport }: CropPlanExportCardProps) {
  const [busy, setBusy] = useState<Busy>(null);
  const [status, setStatus] = useState<string | null>(null);
  const empty = tasks.length === 0;

  async function exportCalendar() {
    if (busy) return;
    setBusy('ics');
    setStatus(null);
    try {
      const ics = buildCropPlanIcs(tasks, { calendarName: `ImbewuField - ${meta.planTitle}` });
      // The charset matters: crop names carry an emoji icon and bed labels
      // carry 'ü' (Hügel). Without it some clients guess Latin-1 and the
      // farmer sees mojibake in every event title.
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const how = await deliverFile(blob, cropPlanIcsFilename(meta.planTitle), 'ImbewuField crop plan');
      setStatus(
        how === 'shared'
          ? `Shared ${tasks.length} tasks — open the file to add them to your calendar.`
          : `Downloaded ${tasks.length} tasks — open the .ics file to add them to your calendar.`,
      );
    } catch (err) {
      setStatus(`Could not build the calendar file: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf() {
    if (busy) return;
    setBusy('pdf');
    setStatus(null);
    try {
      const blob = await buildCropPlanPdf({ plantings, beds, tasks, meta, yearReport });
      const how = await deliverFile(blob, cropPlanPdfFilename(meta.planTitle), 'ImbewuField crop plan');
      setStatus(how === 'shared' ? 'Plan shared — print it or save it to your files.' : 'Plan downloaded — open it to print.');
    } catch (err) {
      setStatus(`Could not build the PDF: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setBusy(null);
    }
  }

  const buttonStyle = (primary: boolean, disabled: boolean) => ({
    fontSize: 13,
    padding: '9px 14px',
    borderRadius: 12,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    background: primary ? '#1F4D2B' : '#FFFFFF',
    color: primary ? '#F7F2E9' : '#5C5040',
    border: primary ? '1px solid #1F4D2B' : '1px solid #E2D8C4',
  });

  return (
    <div className="rounded-2xl p-4 mt-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      <div className="font-display font-semibold mb-1" style={{ fontSize: 15, color: '#20190F' }}>
        📤 Take this plan with you
      </div>
      <p className="font-sans mb-3" style={{ fontSize: 12, color: '#8C7A62', lineHeight: 1.5 }}>
        Both files are made on this phone — nothing is uploaded, and they work with no signal.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={exportCalendar}
          disabled={empty || busy !== null}
          className="font-display font-semibold inline-flex items-center gap-1.5"
          style={buttonStyle(true, empty || busy !== null)}
          title={empty ? 'Add some crops first — there are no tasks to export yet' : 'Every task of the year as a calendar file'}
        >
          {busy === 'ics' ? '⏳ Building…' : empty ? '📅 Add tasks to calendar' : `📅 Add ${tasks.length} tasks to calendar`}
        </button>
        <button
          onClick={exportPdf}
          disabled={busy !== null}
          className="font-display font-semibold inline-flex items-center gap-1.5"
          style={buttonStyle(false, busy !== null)}
          title="The whole plan as a PDF — bed by bed, what seed to buy when, and every month's jobs"
        >
          {busy === 'pdf' ? '⏳ Building…' : '🖨 Print / export PDF'}
        </button>
      </div>

      <div className="font-sans mt-2.5" style={{ fontSize: 11, color: '#8C7A62', lineHeight: 1.55 }}>
        The calendar file works with Google Calendar and Apple Calendar. Tasks land as whole-day entries on the
        first of their month — this plan works in months, not exact days — with a reminder three days before.
        The PDF includes the seed and seedling buying schedule, grouped by the month to buy in.
      </div>

      {status && (
        <div className="font-sans mt-2" style={{ fontSize: 12, color: '#1F4D2B' }}>{status}</div>
      )}
    </div>
  );
}
