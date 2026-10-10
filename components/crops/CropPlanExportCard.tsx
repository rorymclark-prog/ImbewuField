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

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { Share2, CalendarPlus, Hourglass, Download, ClipboardList } from 'lucide-react';
import type { CropTask, PlanBed, Planting } from '@/lib/crop-plan';
import type { PlanNote } from '@/lib/crop-autosuggest';
import type { PlacedTreeGroup, TreeSeasonChoices } from '@/lib/perennial-harvest';
import type { ProductionGuide } from '@/lib/crop-export-schedule';
import type { ProductionProjection } from '@/lib/production-projection';
import type { PoultryGuidance } from '@/lib/animal-enterprises';
import { buildCropPlanIcs, cropPlanIcsFilename } from '@/lib/crop-calendar-ics';
import {
  ALL_SECTIONS, FARMER_SECTIONS, availabilityIconKeys, buildCropPlanPdf, cropPlanPdfFilename,
  type CropPlanAvailability, type CropPlanPageFormat, type CropPlanPdfInput, type CropPlanPdfMeta, type CropPlanSection,
} from '@/lib/crop-export-pdf';
import { loadPdfIcons } from '@/lib/pdf-icons';
import {
  canShareFiles, deliverFile, downloadFile, openFileInTab, prefersShareSheet, shareFile,
} from '@/lib/crop-export-deliver';

export interface CropPlanExportCardProps {
  plantings: Planting[];
  beds: PlanBed[];
  tasks: CropTask[];
  meta: CropPlanPdfMeta;
  /** A dated example must keep its calendar axis when exported on another day. */
  now?: Date;
  /** Example farms can start with a concise booklet and keep the full reference as a separate export. */
  sections?: CropPlanSection[];
  availabilityDetails?: boolean;
  yearReport?: string[];
  /** The accepted suggestion's own notes, so the printed plan carries the
   * reasons behind it and not just the rows. */
  planNotes?: PlanNote[];
  planNotesAt?: number;
  /** The planner's availability chart (veg, food forest, animals, field space), so the printed
   * "Food availability" page shows the same trays the farmer sees on screen. */
  availability?: CropPlanAvailability;
  /** The design's trees with a harvest record, for the task summary's "pick" lines. */
  treeGroups?: PlacedTreeGroup[];
  treeSeasons?: TreeSeasonChoices;
  productionGuide?: ProductionGuide;
  productionProjection?: ProductionProjection;
  poultryGuidance?: PoultryGuidance;
}

type Busy = 'ics' | 'pdf' | null;
const cropUi = (lang: string, english: string, isiZulu: string) => lang === 'zu' ? isiZulu : english;

export default function CropPlanExportCard({ plantings, beds, tasks, meta, now, sections, availabilityDetails, yearReport, planNotes, planNotesAt, availability, treeGroups, treeSeasons, productionGuide, productionProjection, poultryGuidance }: CropPlanExportCardProps) {
  const { lang } = useLanguage();
  const [busy, setBusy] = useState<Busy>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [quickPrintFormat, setQuickPrintFormat] = useState<CropPlanPageFormat>('a4');
  const empty = tasks.length === 0;

  async function exportCalendar() {
    if (busy) return;
    setBusy('ics');
    setStatus(null);
    try {
      const ics = buildCropPlanIcs(tasks, { calendarName: `ImbewuField - ${meta.planTitle}`, now, stamp: new Date() });
      // The charset matters: crop names carry an emoji icon and bed labels
      // carry 'ü' (Hügel). Without it some clients guess Latin-1 and the
      // farmer sees mojibake in every event title.
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const how = await deliverFile(blob, cropPlanIcsFilename(meta.planTitle), 'ImbewuField production plan');
      setStatus(
        how === 'cancelled'
          ? 'Sharing cancelled — no file was sent.'
          : how === 'shared'
          ? `Shared ${tasks.length} tasks — open the file to add them to your calendar.`
          : `Downloaded ${tasks.length} tasks — open the .ics file to add them to your calendar.`,
      );
    } catch (err) {
      setStatus(`Could not build the calendar file: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setBusy(null);
    }
  }

  // BOTH ROUTES, ALWAYS. The owner pressed "Print / export PDF" on a Mac and
  // got the macOS share sheet, which has no Save to Files and no Print — and
  // the download fallback never ran, because as far as the code was concerned
  // the share had succeeded. There was no way to get the file: "there is no
  // print options how do we save a pdf to downloads or email etc". Whichever
  // route this device prefers, the other one stays one tap away.
  const [canShare, setCanShare] = useState(false);
  const [shareFirst, setShareFirst] = useState(false);
  useEffect(() => {
    // After mount only — navigator and matchMedia do not exist during SSR, and
    // guessing on the server would render the wrong button for half our users.
    setCanShare(canShareFiles('application/pdf'));
    setShareFirst(prefersShareSheet());
  }, []);

  async function withPdf(
    run: (blob: Blob) => string | Promise<string>,
    overrides?: Pick<CropPlanPdfInput, 'sections' | 'pageFormat' | 'availabilityDetails'>,
  ) {
    if (busy) return;
    setBusy('pdf');
    setStatus(null);
    try {
      const input: CropPlanPdfInput = { plantings, beds, tasks, meta, now, yearReport, planNotes, planNotesAt, availability, treeGroups, treeSeasons, productionGuide, productionProjection, poultryGuidance, sections: sections ?? FARMER_SECTIONS, availabilityDetails, ...overrides };
      // Both month views reuse the app's pictures: crops growing in beds, and food to pick.
      const wantsIcons = !input.sections || input.sections.includes('availability') || input.sections.includes('calendar') || input.sections.includes('projection');
      const icons = wantsIcons ? await loadPdfIcons(availabilityIconKeys(input)) : undefined;
      const blob = await buildCropPlanPdf({ ...input, icons });
      setStatus(await run(blob));
    } catch (err) {
      setStatus(`Could not build the PDF: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setBusy(null);
    }
  }

  const downloadedStatus = 'Plan saved to your downloads — open it to print.';
  const openedStatus = "Opened in a new tab — use your browser's Print button there.";
  const exportPdf = () => withPdf(async (blob) => {
    const how = await deliverFile(blob, cropPlanPdfFilename(meta.planTitle), 'ImbewuField production plan');
    return how === 'cancelled' ? 'Sharing cancelled — no file was sent.'
      : how === 'shared' ? 'Plan shared — save it to your files or send it on.' : downloadedStatus;
  });

  const downloadPdf = () => withPdf((blob) => {
    downloadFile(blob, cropPlanPdfFilename(meta.planTitle));
    return downloadedStatus;
  });

  const sharePdf = () => withPdf(async (blob) => {
    const how = await shareFile(blob, cropPlanPdfFilename(meta.planTitle), 'ImbewuField production plan');
    if (how === 'cancelled') return 'Sharing cancelled — no file was sent.';
    if (how === 'shared') return 'Plan shared.';
    downloadFile(blob, cropPlanPdfFilename(meta.planTitle));
    return 'Sharing was unavailable — the plan was saved to your downloads.';
  });

  const printPdf = () => withPdf((blob) => {
    if (openFileInTab(blob)) return openedStatus;
    downloadFile(blob, cropPlanPdfFilename(meta.planTitle));
    return 'The new tab was blocked — open the downloaded plan to print.';
  });

  const referencePdf = () => withPdf((blob) => {
    downloadFile(blob, cropPlanPdfFilename(meta.planTitle, new Date(), 'reference'));
    return 'Detailed reference saved to your downloads.';
  }, { sections: ALL_SECTIONS, availabilityDetails: true });

  const futurePdf = () => withPdf((blob) => {
    downloadFile(blob, cropPlanPdfFilename(meta.planTitle, new Date(), 'future-harvest'));
    return 'Future harvest PDF saved to your downloads.';
  }, { sections: ['projection'] });

  // The wall calendar stays concise; the farmer copy and the separate future
  // harvest download retain the age groups, projected production and sources.
  const quickPrint = () => withPdf((blob) => {
    if (openFileInTab(blob)) return openedStatus;
    downloadFile(blob, cropPlanPdfFilename(meta.planTitle, new Date(), `quick-print-${quickPrintFormat}`));
    return 'The new tab was blocked — open the downloaded calendar to print.';
  }, { sections: ['availability', 'calendar', 'taskSummary'], pageFormat: quickPrintFormat, availabilityDetails: false });

  const buttonStyle = (primary: boolean, disabled: boolean) => ({
    fontSize: 13,
    padding: '9px 14px',
    minHeight: 44,
    borderRadius: 12,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    background: primary ? 'var(--color-forest)' : 'var(--bg-2)',
    color: primary ? 'var(--on-forest)' : 'var(--text-primary)',
    border: '1px solid var(--border)',
  });

  return (
    <div className="rounded-2xl p-4 mt-4" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
        <div className="font-display font-semibold mb-1 flex items-center gap-2" style={{ fontSize: 15, color: 'var(--text-primary)' }}>
        <Share2 size={14} aria-hidden style={{ flexShrink: 0 }} /> {cropUi(lang, 'Take this plan with you', 'Hamba nalolu hlelo')}
      </div>
      <p className="font-sans mb-3" style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        Files are made on this device. Download a copy to use away from the app.
      </p>
      <p className="font-sans mb-3" style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>Your plan includes vegetables, fruit, nuts, berries and animal products from your map.</p>
      {lang === 'zu' && (
        <p role="note" className="font-sans mb-3" style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Draft notice: exported task names, planting times and instructions remain in English pending source and local farming review. Isaziso: amagama emisebenzi, izikhathi zokutshala nemiyalelo kumafayela athunyelwayo kuseNgisini kuze kubuyekezwe imithombo nolwazi lwezolimo lwendawo.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={exportCalendar}
          disabled={empty || busy !== null}
          className="font-display font-semibold inline-flex items-center gap-1.5"
          style={buttonStyle(true, empty || busy !== null)}
          title={empty ? 'Add some crops first — there are no tasks to export yet' : 'Every task of the year as a calendar file'}
        >
          {busy === 'ics'
            ? <><Hourglass size={14} aria-hidden /> {cropUi(lang, 'Building…', 'Kwakhiwa…')}</>
            : <><CalendarPlus size={14} aria-hidden /> {empty ? cropUi(lang, 'Add tasks to calendar', 'Engeza imisebenzi ekhalendeni') : `${cropUi(lang, 'Add', 'Engeza')} ${tasks.length} ${lang === 'zu' ? (tasks.length === 1 ? 'umsebenzi ekhalendeni' : 'imisebenzi ekhalendeni') : 'tasks to calendar'}`}</>}
        </button>
        <button
          onClick={exportPdf}
          disabled={busy !== null}
          className="font-display font-semibold inline-flex items-center gap-1.5"
          style={buttonStyle(false, busy !== null)}
          title={sections ? 'Download the selected plan sections shown below' : 'See each crop growing in its bed over the months, pictures of what to pick, what to buy and monthly jobs'}
        >
          {busy === 'pdf'
            ? <><Hourglass size={14} aria-hidden /> Building…</>
            : shareFirst
            ? <><Share2 size={14} aria-hidden /> {cropUi(lang, 'Share the plan (PDF)', 'Yabelana ngohlelo (PDF)')}</>
              : <><Download size={14} aria-hidden /> {cropUi(lang, 'Download the plan (PDF)', 'Landa uhlelo (PDF)')}</>}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={quickPrint}
          disabled={busy !== null}
          className="font-display font-semibold inline-flex items-center gap-1.5"
          style={buttonStyle(false, busy !== null)}
          title="Crops growing in each bed, pictures of what to pick and monthly jobs — for pinning on a wall"
        >
          {busy === 'pdf'
            ? <><Hourglass size={14} aria-hidden /> {cropUi(lang, 'Building…', 'Kwakhiwa…')}</>
            : <><ClipboardList size={14} aria-hidden /> {cropUi(lang, 'Calendar & jobs', 'Ikhalenda nemisebenzi')}</>}
        </button>
        <select
          value={quickPrintFormat}
          onChange={(e) => setQuickPrintFormat(e.target.value as CropPlanPageFormat)}
          disabled={busy !== null}
          className="font-sans rounded-lg"
          style={{ fontSize: 12, minHeight: 44, padding: '6px 8px', border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-2)' }}
          aria-label="Calendar paper size"
          title="Paper size — pick A3 or A2 for a wall-sized print"
        >
          <option value="a4">A4</option>
          <option value="a3">A3</option>
          <option value="a2">A2</option>
        </select>
      </div>

      <div className="font-sans flex flex-wrap items-center gap-x-3 mt-2" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Or:{' '}
        <button onClick={printPdf} disabled={busy !== null} className="underline" style={{ color: 'var(--text-primary)', minHeight: 44, textAlign: 'left' }}>
          {cropUi(lang, 'open it to print', 'yivule ukuze uphrinte')}
        </button>
        <button onClick={futurePdf} disabled={busy !== null || !productionProjection} className="underline" style={{ color: 'var(--text-primary)', minHeight: 44, textAlign: 'left' }}>Future harvest PDF</button>
        <button onClick={referencePdf} disabled={busy !== null} className="underline" style={{ color: 'var(--text-primary)', minHeight: 44, textAlign: 'left' }}>Detailed reference PDF</button>
        {shareFirst && (
          <>
            <button onClick={downloadPdf} disabled={busy !== null} className="underline" style={{ color: 'var(--text-primary)', minHeight: 44, textAlign: 'left' }}>
              {cropUi(lang, 'save it to this device', 'yigcine kule divayisi')}
            </button>
          </>
        )}
        {!shareFirst && canShare && (
          <>
            <button onClick={sharePdf} disabled={busy !== null} className="underline" style={{ color: 'var(--text-primary)', minHeight: 44, textAlign: 'left' }}>
              {cropUi(lang, 'send it somewhere', 'yithumele kwenye indawo')}
            </button>
          </>
        )}
      </div>

      <details className="font-sans mt-2.5" style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        <summary style={{ cursor: 'pointer', minHeight: 44, paddingTop: 12 }}>What each file contains</summary>
        The calendar file works with Google Calendar and Apple Calendar. Tasks land as whole-day entries on the
        first of their month — this plan works in months, not exact days — with a reminder three days before.
        The printed plan shows each crop growing in its bed across the months, like the app, plus pictures of what you can pick.
        {!sections && ' It also has what to buy, monthly tick-off jobs and a harvest record.'}
        {' '}Picking dates for trees and animals must be confirmed locally; plants and housing with unknown dates stay listed on the plan. The separate Future harvest PDF has the ten-year graph and age groups. Calendar &amp; jobs gives concise wall sheets in your chosen paper size. Record animal numbers and care checks in the site survey; confirm production months in this plan. The detailed reference includes the full bed-by-bed plan, benchmarks, buying lists, guidance, monthly field sheets and harvest records.
        {sections && <p>Selected booklet sections: {sections.map(section => ({ calendar: 'bed calendar', availability: 'food calendar', projection: 'future harvest', taskSummary: 'monthly jobs', dashboard: 'overview', numbers: 'benchmarks', guidance: 'guidance', plan: 'planting plan', buying: 'buying lists', fieldsheets: 'field sheets', record: 'harvest records' })[section]).join(', ')}.</p>}
      </details>

      {status && (
        <div role="status" aria-live="polite" className="font-sans mt-2" style={{ fontSize: 12, color: 'var(--text-primary)' }}>{status}</div>
      )}
    </div>
  );
}
