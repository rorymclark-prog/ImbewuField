// ── Garden Survey → PDF ───────────────────────────────────────────────────
//
// app/survey/page.tsx's "Print" button called window.print() directly — the exact bug already
// fixed for the Site Analysis Report and the crop plan (see lib/report-pdf.ts's header comment):
// ImbewuField's manifest declares `"display": "standalone"`, so once a farmer installs the app to
// their home screen, window.print() resolves without throwing and without showing anything. The
// button looks dead on exactly the device most of our farmers use, and nothing is catchable in a
// try/catch, so it never surfaced an error either.
//
// It is worse here than a merely dead button: when the survey's own save() fails, the page tells
// the farmer to "print this page before you leave it" as the one way to keep answers about to
// vanish with the tab. That escape hatch was silently doing nothing on the device most likely to
// need it.
//
// Small and plain by design. A garden survey result is a handful of beds and a six-week task
// list, not a document handed to a funder — this deliberately does not reuse lib/report-pdf.ts's
// cover/plates/footer machinery, just a real file where "Print" used to be a no-op.

export interface SurveyPdfBed {
  letter: string;
  crop: string;
}

export interface SurveyPdfWeek {
  wk: number;
  title: string;
  tasks: string[];
}

export interface SurveyPdfData {
  beds: SurveyPdfBed[];
  bedAreaM2: number;
  ha: number;
  sunLabel: string;
  tanksPhrase: string;
  goalLabel: string | null;
  weeks: SurveyPdfWeek[];
  titleLabel?: string;
  bedLabel?: string;
  bedsSectionLabel?: string;
  summaryBedLabel?: string;
  summaryGoalLabel?: string;
  weekLabel?: string;
  weeksTitleLabel?: string;
  reviewNotice?: string;
}

/** File-system-safe name for the exported survey. */
export function surveyPdfFilename(date = new Date()): string {
  const stamp = Number.isNaN(date.getTime()) ? 'undated' : date.toISOString().slice(0, 10);
  return `ImbewuField-Garden-Survey-${stamp}.pdf`;
}

const INK = { text: [32, 25, 15], muted: [110, 96, 74], green: [31, 77, 43], gold: [154, 96, 30] } as const;

/** Build the garden survey result as a PDF blob. Throws if jsPDF cannot be loaded. */
export async function buildSurveyPdf(data: SurveyPdfData): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const M = 46;
  const CW = PW - M * 2;
  const BOTTOM = doc.internal.pageSize.getHeight() - 40;
  let y = M;

  const setInk = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2]);
  // A bed list can run to 12 rows and a task list to 18 lines — short in the common case, but
  // nothing here is bounded tightly enough to promise one page, so every section still checks.
  const need = (h: number) => { if (y + h > BOTTOM) { doc.addPage(); y = M; } };

  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); setInk(INK.text);
  const titleLines = doc.splitTextToSize(data.titleLabel ?? 'Garden plan', CW) as string[];
  doc.text(titleLines, M, y); y += titleLines.length * 24 + 2;

  if (data.reviewNotice) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setInk(INK.gold);
    const noticeLines = doc.splitTextToSize(data.reviewNotice, CW) as string[];
    doc.text(noticeLines, M, y);
    y += noticeLines.length * 10 + 10;
  }

  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); setInk(INK.muted);
  const sub = `${data.beds.length} ${data.summaryBedLabel ?? 'beds'} · ${(data.beds.length * data.bedAreaM2).toFixed(1)} m² · `
    + `${data.ha} ha · ${data.sunLabel} · ${data.tanksPhrase}`
    + (data.goalLabel ? ` · ${data.summaryGoalLabel ?? 'goal'}: ${data.goalLabel}` : '');
  const subLines = doc.splitTextToSize(sub, CW) as string[];
  doc.text(subLines, M, y); y += subLines.length * 14 + 18;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); setInk(INK.green);
  const bedsHeadingLines = doc.splitTextToSize(data.bedsSectionLabel ?? 'Beds', CW) as string[];
  doc.text(bedsHeadingLines, M, y); y += bedsHeadingLines.length * 14 + 2;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); setInk(INK.text);
  for (const bed of data.beds) {
    const lines = doc.splitTextToSize(`${data.bedLabel ?? 'Bed'} ${bed.letter} (${data.bedAreaM2} m²) — ${bed.crop}`, CW) as string[];
    need(lines.length * 13);
    doc.text(lines, M, y);
    y += lines.length * 13;
  }
  y += 12;

  need(16);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); setInk(INK.green);
  const weeksLabelLines = doc.splitTextToSize(data.weeksTitleLabel ?? 'First six weeks', CW) as string[];
  doc.text(weeksLabelLines, M, y); y += weeksLabelLines.length * 14 + 2;
  for (const week of data.weeks) {
    const title = `${data.weekLabel ?? 'Week'} ${week.wk} — ${week.title}`;
    const titleLines = doc.splitTextToSize(title, CW) as string[];
    need(titleLines.length * 14);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); setInk(INK.gold);
    doc.text(titleLines, M, y); y += titleLines.length * 14;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); setInk(INK.text);
    for (const task of week.tasks) {
      const lines = doc.splitTextToSize(`•  ${task}`, CW - 10) as string[];
      need(lines.length * 13 + 2);
      doc.text(lines, M + 6, y); y += lines.length * 13 + 2;
    }
    y += 6;
  }

  need(20);
  y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setInk(INK.muted);
  doc.text('Generated by ImbewuField · imbewufield.vercel.app', M, y);

  return doc.output('blob');
}
