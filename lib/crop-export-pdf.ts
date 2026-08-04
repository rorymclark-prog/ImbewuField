// ── Crop plan → a document a farmer can take to town on paper ───────────────
//
// "If a farmer wants a crop plan printed he can export it as a PDF from the
// crop plan section which would include when to purchase seedlings and seeds."
//
// Built with jsPDF, which is already a dependency and already how this app
// ships a document (app/invoice/page.tsx, lib/report-pdf.ts). Deliberately NOT
// window.print(): the manifest declares "display": "standalone", so once the
// app is installed to a home screen there is no print affordance on iOS at
// all — window.print() resolves without throwing and without showing anything,
// so the button would look dead on exactly the device most of our farmers use.
// (lib/report-pdf.ts's header records that exact bug on the report screen.)
//
// The document is four things in order:
//   1. what the year looks like, in a paragraph or two;
//   2. every bed and plot, with what goes in it and when;
//   3. the SEED AND SEEDLING BUYING SCHEDULE, grouped by month;
//   4. the job list, month by month.
//
// The buying schedule is the part that earns the trip: it is a shopping
// calendar, so the farmer standing in a co-op in September can see that
// September is when the cabbage seed has to be bought, and why.

import type { CropTask, PlanBed, Planting } from '@/lib/crop-plan';
import {
  buildBedPlanRows, buildBuyingSchedule, buildTaskMonths,
  monthShort, monthYearLabel, taskLine,
} from '@/lib/crop-export-schedule';

export interface CropPlanPdfMeta {
  /** The design/site this plan belongs to. */
  planTitle: string;
  /** "KZN Midlands · Summer rainfall", or an honest "No site set" line. */
  siteLine: string;
  /** "6 beds · 2 staple plots · 48.0 m² of growing space". */
  bedsSummary: string;
  /** Already-localised date string for the cover line. */
  dateLabel: string;
  estimatedKgPerYear: number;
  lossPercent: number;
}

export interface CropPlanPdfInput {
  plantings: Planting[];
  beds: PlanBed[];
  tasks: CropTask[];
  meta: CropPlanPdfMeta;
  /** buildYearReport's paragraphs — the plan in plain words. */
  yearReport?: string[];
  /** "Today". Decides the reading order and every resolved year in the document. */
  now?: Date;
}

/**
 * jsPDF's built-in fonts are WinAnsi-encoded: they have no glyph for an emoji
 * and no glyph for most typographic punctuation. Handed 🌽 they emit garbage
 * or nothing, and the farmer's printed plan is full of holes — so every string
 * that reaches the page goes through here first.
 *
 * Characters with a sensible Latin-1 equivalent are transliterated (an em dash
 * becomes a hyphen, ⅓ becomes 1/3); anything still above U+00FF after that —
 * every crop icon in the catalog — is dropped. Exported because a silent
 * character-mangling bug is exactly the sort that only a test catches.
 */
export function pdfSafe(text: string): string {
  const mapped = text
    .replace(/[‐-―]/g, '-')      // hyphens/dashes, incl. em & en
    .replace(/[‘’‛]/g, "'") // curly single quotes
    .replace(/[“”]/g, '"')       // curly double quotes
    .replace(/…/g, '...')
    .replace(/·/g, '-')               // middle dot (the app's own separator)
    .replace(/•/g, '-')
    .replace(/½/g, '1/2')
    .replace(/⅓/g, '1/3')
    .replace(/¼/g, '1/4')
    .replace(/¾/g, '3/4')
    .replace(/[\u00A0\u2007\u202F\u2009\u200A]/g, ' ');
  const kept = [...mapped].filter((ch) => (ch.codePointAt(0) ?? 0) <= 0xff).join('');
  // Dropping an icon leaves the space that followed it, so "🌽 Maize" would
  // print as " Maize" and every bullet would look mis-indented.
  return kept.replace(/[ \t]{2,}/g, ' ').replace(/^[ \t]+|[ \t]+$/g, '');
}

const INK = {
  text: [32, 25, 15],
  muted: [110, 96, 74],
  green: [31, 77, 43],
  gold: [154, 96, 30],
  rule: [226, 216, 196],
} as const;

/** Build the printable plan as a PDF blob. Throws if jsPDF cannot be loaded. */
export async function buildCropPlanPdf(input: CropPlanPdfInput): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const now = input.now ?? new Date();
  const nowMonth = now.getMonth() + 1;
  const { meta } = input;

  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 46;
  const CW = PW - M * 2;
  const BOTTOM = PH - 54;
  let y = 0;

  const setInk = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2]);

  const footer = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setInk(INK.muted);
    doc.text('ImbewuField crop plan - planning guide only, adjust to your own rainfall and frost dates', M, PH - 30);
    doc.text(String(doc.getNumberOfPages()), PW - M, PH - 30, { align: 'right' });
  };
  const newPage = () => { footer(); doc.addPage(); y = M + 8; };
  const need = (h: number) => { if (y + h > BOTTOM) newPage(); };

  const write = (
    text: string,
    opts: { size?: number; bold?: boolean; ink?: readonly number[]; indent?: number; gap?: number; lead?: number } = {},
  ) => {
    const size = opts.size ?? 10;
    const lead = opts.lead ?? size * 1.32;
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    setInk(opts.ink ?? INK.text);
    const indent = opts.indent ?? 0;
    const lines = doc.splitTextToSize(pdfSafe(text), CW - indent) as string[];
    need(lines.length * lead + (opts.gap ?? 0));
    doc.text(lines, M + indent, y);
    y += lines.length * lead + (opts.gap ?? 0);
  };

  const sectionHeading = (text: string) => {
    // A heading alone at the foot of a page is worse than a slightly short page.
    need(46);
    y += 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    setInk(INK.green);
    doc.text(pdfSafe(text), M, y);
    y += 6;
    doc.setDrawColor(INK.rule[0], INK.rule[1], INK.rule[2]);
    doc.line(M, y, PW - M, y);
    y += 14;
  };

  // ── Cover block ────────────────────────────────────────────────────────────
  y = M + 18;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); setInk(INK.text);
  doc.text('ImbewuField', M, y);
  y += 20;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(12); setInk(INK.green);
  doc.text(pdfSafe(`Crop plan - ${meta.planTitle}`), M, y);
  y += 18;
  doc.setFontSize(9); setInk(INK.muted);
  doc.text(pdfSafe(`${meta.siteLine} - ${meta.dateLabel}`), M, y);
  y += 13;
  doc.text(pdfSafe(meta.bedsSummary), M, y);
  y += 13;
  doc.text(
    pdfSafe(
      `About ${meta.estimatedKgPerYear.toFixed(0)} kg over the year`
      + `${meta.lossPercent > 0 ? ` (after the ${meta.lossPercent}% loss you allowed for)` : ''}`
      + ` - the plan runs from ${monthShort(nowMonth)} ${now.getFullYear()} and repeats every year.`,
    ),
    M, y,
  );
  y += 12;
  doc.setDrawColor(198, 186, 160); doc.line(M, y, PW - M, y);
  y += 20;

  // ── 1. The year in words ───────────────────────────────────────────────────
  if (input.yearReport?.length) {
    sectionHeading('Your year at a glance');
    for (const paragraph of input.yearReport) {
      write(paragraph, { size: 10, gap: 6 });
    }
  }

  // ── 2. Bed by bed ──────────────────────────────────────────────────────────
  sectionHeading('Bed by bed');
  write(
    'Every bed and plot on your map. "Into the bed" is when the crop actually takes the ground - for a '
    + 'crop raised in trays that is a month after the seed is sown.',
    { size: 8.5, ink: INK.muted, gap: 10 },
  );

  const bedRows = buildBedPlanRows(input.plantings, input.beds);
  for (const row of bedRows) {
    need(34);
    write(
      // m² survives pdfSafe — the superscript two is Latin-1 (0xB2), unlike an emoji.
      `${row.bedLabel}${row.kind === 'plot' ? ' (staple plot)' : ''} - ${row.areaM2.toFixed(1)} m²`,
      { size: 10.5, bold: true, gap: 2 },
    );
    if (!row.crops.length) {
      write('Nothing planned here yet - there is room for another crop.', { size: 9, ink: INK.muted, indent: 12, gap: 8 });
      continue;
    }
    for (const crop of row.crops) {
      const bedPart = crop.transplant
        ? `sow into trays ${monthShort(crop.sowMonth)}, into the bed ${monthShort(crop.bedMonth)}`
        : `sow ${monthShort(crop.sowMonth)}`;
      const harvestPart = crop.harvestEndMonth !== crop.harvestMonth
        ? `harvest ${monthShort(crop.harvestMonth)}-${monthShort(crop.harvestEndMonth)}`
        : `harvest ${monthShort(crop.harvestMonth)}`;
      const extras = [
        crop.shareLabel,
        crop.existing ? 'already growing' : '',
      ].filter(Boolean).join(', ');
      write(
        `${crop.cropName} - ${bedPart}, ${harvestPart} - about ${crop.estimatedKg.toFixed(1)} kg`
        + `${extras ? ` (${extras})` : ''}`,
        { size: 9.5, ink: INK.text, indent: 12, gap: 1 },
      );
    }
    y += 7;
  }

  // ── 3. The buying schedule ─────────────────────────────────────────────────
  sectionHeading('Seed and seedling buying schedule');
  write(
    'What to buy, and the month to buy it. Quantities come from your bed sizes and each crop\'s spacing; '
    + 'seed sown direct includes a bit extra for germination losses. Buy in the month shown - a month ahead of '
    + 'sowing - so the seed is in the house before the ground is ready. Crops raised in trays (seedlings) are '
    + 'bought two months before they reach the bed, because they spend about six weeks in the tray first.',
    { size: 8.5, ink: INK.muted, gap: 12 },
  );

  const schedule = buildBuyingSchedule(input.plantings, input.beds, nowMonth);
  if (!schedule.length) {
    write('Nothing new to buy - every crop in this plan is already growing.', { size: 10, ink: INK.muted });
  }
  for (const month of schedule) {
    need(40);
    write(monthYearLabel(month.month, now), { size: 11, bold: true, ink: INK.gold, gap: 4 });
    for (const item of month.items) {
      write(
        `${item.count} ${item.unit} - ${item.cropName} - for ${item.bedLabels.join(', ')}`,
        { size: 10, bold: true, indent: 12, gap: 1 },
      );
      write(item.note, { size: 8.5, ink: INK.muted, indent: 12, gap: 5 });
    }
    y += 4;
  }

  // ── 4. The job list ────────────────────────────────────────────────────────
  sectionHeading('What to do, month by month');
  const taskMonths = buildTaskMonths(input.tasks, nowMonth);
  if (!taskMonths.length) {
    write('No tasks yet - add some crops to your beds.', { size: 10, ink: INK.muted });
  }
  for (const month of taskMonths) {
    need(38);
    write(monthYearLabel(month.month, now), { size: 11, bold: true, ink: INK.gold, gap: 4 });
    for (const task of month.tasks) {
      need(16);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      setInk(INK.green);
      doc.text('-', M + 4, y);
      setInk(INK.text);
      const lines = doc.splitTextToSize(pdfSafe(taskLine(task)), CW - 16) as string[];
      doc.text(lines, M + 16, y);
      y += lines.length * 12.5 + 1;
    }
    y += 6;
  }

  footer();
  return doc.output('blob');
}

/** File-system-safe download name, same shape as the site report's. */
export function cropPlanPdfFilename(planTitle?: string, date = new Date()): string {
  const safe = (planTitle || 'Crop-plan')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'Crop-plan';
  const stamp = Number.isNaN(date.getTime()) ? 'undated' : date.toISOString().slice(0, 10);
  return `ImbewuField-Crop-Plan-${safe}-${stamp}.pdf`;
}
