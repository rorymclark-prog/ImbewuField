import { journalPlanningReferenceText } from './journal-link-display';
import { inspectJournalGrowerLink, inspectJournalNurserySowing, inspectJournalNurseryProgress, inspectJournalNurseryFieldPlanting, type JournalEntry,
  type JournalNurserySowingObservation, type JournalNurseryProgressObservation, type JournalNurseryFieldPlantingObservation } from './field-journal';
import { deliverFile, type FileDelivery } from './file-delivery';
import { farmMemoryText, farmMemoryCategoryLabel, type FarmMemoryKey } from './farm-memory-copy';

export interface JournalExportOptions {
  lang?: string;
  sample?: boolean;
  title?: string;
  generatedAt?: string;
  selection?: string;
  includePhotos?: boolean;
}

export function csvCell(value: string | number): string {
  let text = String(value);
  // Quoting alone does not prevent a spreadsheet from executing a farmer's free-text note.
  // A leading apostrophe is the export-only escape; the stored observation stays untouched.
  if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

type NurserySowingExport = { status: 'held' }
  | { status: 'observed'; observation: JournalNurserySowingObservation; plannedDate: string };
function nurserySowingSnapshot(entry: JournalEntry): NurserySowingExport | null {
  const inspected = inspectJournalNurserySowing(entry);
  if (inspected.status === 'legacy') return null;
  if (inspected.status === 'held') return { status: 'held' };
  const link = inspectJournalGrowerLink(entry);
  if (link.status !== 'linked' || link.link.eventKind !== 'nursery-start') return { status: 'held' };
  return { status: 'observed', observation: inspected.observation, plannedDate: link.link.plannedDate };
}
const nurserySowingColumns = ['Nursery sowing observation status (English)', 'Physical trays used (including partly filled trays)',
  'Recorded variety / cultivar (user-entered)', 'Recorded seed-lot reference (user-entered)',
  'Recorded raising-batch reference (user-entered)', 'Planned nursery start (UTC calendar date)'];
function nurserySowingCells(snapshot: NurserySowingExport | null): Array<string | number> {
  if (!snapshot) return ['', '', '', '', '', ''];
  if (snapshot.status === 'held') return ['Needs review', '', '', '', '', ''];
  const { traysUsed, references } = snapshot.observation;
  return ['Observed', traysUsed ?? 'Unknown', references.variety ?? 'Not recorded',
    references.seedLotReference ?? 'Not recorded', references.raisingBatchReference ?? 'Not recorded', snapshot.plannedDate];
}

type NurseryProgressExport = { status: 'held' }
  | { status: 'observed'; observation: JournalNurseryProgressObservation; plannedDate: string };
function nurseryProgressSnapshot(entry: JournalEntry): NurseryProgressExport | null {
  const inspected = inspectJournalNurseryProgress(entry);
  if (inspected.status === 'legacy') return null;
  if (inspected.status === 'held') return { status: 'held' };
  const link = inspectJournalGrowerLink(entry);
  if (link.status !== 'linked' || link.link.eventKind !== 'nursery-start') return { status: 'held' };
  return { status: 'observed', observation: inspected.observation, plannedDate: link.link.plannedDate };
}
const nurseryProgressColumns = ['Nursery progress observation status (English)', 'Observed stage (grower assessment)',
  'Count coverage', 'Plants observed', 'Progress variety / cultivar (user-entered)',
  'Progress seed-lot reference (user-entered)', 'Progress raising-batch reference (user-entered)',
  'Progress planned nursery start (UTC calendar date)'];
const nurseryStageLabels: Record<JournalNurseryProgressObservation['stage'], string> = {
  emerged: 'Emerged (grower assessment)', alive: 'Alive (grower assessment)', ready: 'Ready (grower assessment)',
};
function nurseryProgressCells(snapshot: NurseryProgressExport | null): Array<string | number> {
  if (!snapshot) return ['', '', '', '', '', '', '', ''];
  if (snapshot.status === 'held') return ['Needs review', '', '', '', '', '', '', ''];
  const { stage, coverage, plantsObserved, references } = snapshot.observation;
  return ['Observed', nurseryStageLabels[stage], coverage === 'whole-batch' ? 'Whole batch' : 'Checked subset', plantsObserved,
    references.variety ?? 'Not recorded', references.seedLotReference ?? 'Not recorded', references.raisingBatchReference ?? 'Not recorded', snapshot.plannedDate];
}

type NurseryFieldPlantingExport = { status: 'held' }
  | { status: 'observed'; observation: JournalNurseryFieldPlantingObservation; plannedDate: string };
function nurseryFieldPlantingSnapshot(entry: JournalEntry): NurseryFieldPlantingExport | null {
  const inspected = inspectJournalNurseryFieldPlanting(entry);
  if (inspected.status === 'legacy') return null;
  if (inspected.status === 'held') return { status: 'held' };
  const link = inspectJournalGrowerLink(entry);
  if (link.status !== 'linked' || link.link.eventKind !== 'field-entry') return { status: 'held' };
  return { status: 'observed', observation: inspected.observation, plannedDate: link.link.plannedDate };
}
const nurseryFieldPlantingColumns = ['Nursery field planting observation status (English)', 'Plants planted during this recorded work',
  'Field planting variety / cultivar (user-entered)', 'Field planting seed-lot reference (user-entered)',
  'Field planting raising-batch reference (user-entered)', 'Planned field entry (UTC calendar date)'];
function nurseryFieldPlantingCells(snapshot: NurseryFieldPlantingExport | null): Array<string | number> {
  if (!snapshot) return ['', '', '', '', '', ''];
  if (snapshot.status === 'held') return ['Needs review', '', '', '', '', ''];
  const { plantsPlanted, references } = snapshot.observation;
  return ['Observed', plantsPlanted, references.variety ?? 'Not recorded', references.seedLotReference ?? 'Not recorded',
    references.raisingBatchReference ?? 'Not recorded', snapshot.plannedDate];
}

export function buildJournalCsv(entries: JournalEntry[], options: JournalExportOptions = {}): string {
  const lang = options.lang ?? 'en';
  const t = (key: FarmMemoryKey) => farmMemoryText(lang, key);
  const headerKeys: FarmMemoryKey[] = ['exportDate', 'exportCategory', 'exportTitle', 'exportNotes',
    'exportBed', 'exportBedId', 'exportCrop', 'exportPhotos', 'exportBasisHeading', 'exportSelection'];
  const includeReference = entries.some(entry => journalPlanningReferenceText(entry) !== null);
  const nurserySowing = entries.map(nurserySowingSnapshot), includeNurserySowing = nurserySowing.some(value => value !== null);
  const nurseryProgress = entries.map(nurseryProgressSnapshot), includeNurseryProgress = nurseryProgress.some(value => value !== null);
  const fieldPlanting = entries.map(nurseryFieldPlantingSnapshot), includeFieldPlanting = fieldPlanting.some(value => value !== null);
  // Old journal copies keep their exact column contract. New observation fields
  // appear only when selected records actually contain observed or held evidence.
  const rows: Array<Array<string | number>> = [[...headerKeys.map(t), ...(includeReference ? ['Planning reference (English)'] : []),
    ...(includeNurserySowing ? nurserySowingColumns : []), ...(includeNurseryProgress ? nurseryProgressColumns : []),
    ...(includeFieldPlanting ? nurseryFieldPlantingColumns : [])]];
  for (const [index, entry] of entries.entries()) rows.push([
    entry.date, farmMemoryCategoryLabel(lang, entry.category), entry.title, entry.notes,
    entry.bedLabel ?? '', entry.bedId ?? '', entry.cropName ?? '', entry.photos?.length ?? 0,
    `${options.sample ? `${t('exportDemo')} ` : ''}${t('exportBasis')}${lang === 'zu' ? ` ${t('draftNotice')}` : ''}`,
    options.selection ?? t('exportDefaultSelection'),
    ...(includeReference ? [journalPlanningReferenceText(entry) ?? ''] : []),
    ...(includeNurserySowing ? nurserySowingCells(nurserySowing[index]) : []),
    ...(includeNurseryProgress ? nurseryProgressCells(nurseryProgress[index]) : []),
    ...(includeFieldPlanting ? nurseryFieldPlantingCells(fieldPlanting[index]) : []),
  ]);
  return `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function html(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
}

function nurserySowingHtml(entry: JournalEntry): string {
  const snapshot = nurserySowingSnapshot(entry);
  if (!snapshot) return '';
  if (snapshot.status === 'held') return '<p lang="en" class="basis">Nursery sowing observation needs review. Retained evidence is not exported as checked quantities or reference labels.</p>';
  const { traysUsed, references } = snapshot.observation;
  const fields: Array<[string, string | number]> = [
    ['Observed day', entry.date], ['Planned nursery start (UTC calendar date)', snapshot.plannedDate],
    ['Physical trays used (including partly filled trays)', traysUsed ?? 'Unknown'],
    ['Recorded variety / cultivar', references.variety ?? 'Not recorded'],
    ['Recorded seed-lot reference', references.seedLotReference ?? 'Not recorded'],
    ['Recorded raising-batch reference', references.raisingBatchReference ?? 'Not recorded'],
  ];
  return `<section lang="en" class="basis"><h3>Recorded nursery sowing</h3><p>Grower-entered observation; reference labels are user-entered, not verified seed identity.</p><dl>${fields.map(([label, value]) => `<dt>${html(label)}</dt><dd>${html(String(value))}</dd>`).join('')}</dl></section>`;
}

function nurseryProgressHtml(entry: JournalEntry): string {
  const snapshot = nurseryProgressSnapshot(entry);
  if (!snapshot) return '';
  if (snapshot.status === 'held') return '<p lang="en" class="basis">Nursery progress observation needs review. Retained evidence is not exported as checked counts, stages, coverage or reference labels.</p>';
  const { stage, coverage, plantsObserved, references } = snapshot.observation;
  const fields: Array<[string, string | number]> = [
    ['Observed day', entry.date], ['Planned nursery start (UTC calendar date)', snapshot.plannedDate],
    ['Observed stage', nurseryStageLabels[stage]], ['Count coverage', coverage === 'whole-batch' ? 'Whole batch' : 'Checked subset'],
    ['Plants observed', plantsObserved], ['Recorded variety / cultivar', references.variety ?? 'Not recorded'],
    ['Recorded seed-lot reference', references.seedLotReference ?? 'Not recorded'],
    ['Recorded raising-batch reference', references.raisingBatchReference ?? 'Not recorded'],
  ];
  return `<section lang="en" class="basis"><h3>Recorded nursery count</h3><p>Grower-entered count and assessment; reference labels are user-entered, not verified seed identity. Ready is the grower's assessment, not a readiness certificate. Counts are not available stock or crop capacity.</p><dl>${fields.map(([label, value]) => `<dt>${html(label)}</dt><dd>${html(String(value))}</dd>`).join('')}</dl></section>`;
}

function nurseryFieldPlantingHtml(entry: JournalEntry): string {
  const snapshot = nurseryFieldPlantingSnapshot(entry);
  if (!snapshot) return '';
  if (snapshot.status === 'held') return '<p lang="en" class="basis">Nursery field planting observation needs review. Retained evidence is not exported as checked quantities or reference labels.</p>';
  const { plantsPlanted, references } = snapshot.observation;
  const fields: Array<[string, string | number]> = [
    ['Observed day', entry.date], ['Planned field entry (UTC calendar date)', snapshot.plannedDate],
    ['Plants planted during this recorded work', plantsPlanted], ['Recorded variety / cultivar', references.variety ?? 'Not recorded'],
    ['Recorded seed-lot reference', references.seedLotReference ?? 'Not recorded'],
    ['Recorded raising-batch reference', references.raisingBatchReference ?? 'Not recorded'],
  ];
  return `<section lang="en" class="basis"><h3>Recorded field planting</h3><p>Grower-entered observation for this work, not a stock balance, survival result or completed batch. Reference labels are user-entered, not verified seed identity. No particular earlier sowing or count record is identified.</p><dl>${fields.map(([label, value]) => `<dt>${html(label)}</dt><dd>${html(String(value))}</dd>`).join('')}</dl></section>`;
}

function safePhoto(source: string): boolean {
  // Keep this copy independent of the server and prevent active SVG/HTML or remote tracking.
  return /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-zA-Z0-9+/=\r\n]+$/u.test(source);
}

/** A self-contained copy: no scripts, remote fonts, external images or live app dependencies.
 * The browser's Print command can save it as a PDF when the farmer is offline. */
export function buildJournalHtml(entries: JournalEntry[], options: JournalExportOptions = {}): string {
  const lang = options.lang === 'zu' ? 'zu' : 'en';
  const t = (key: FarmMemoryKey, vars?: Record<string, string | number>) => farmMemoryText(lang, key, vars);
  const title = options.title ?? t('exportHeading');
  const articles = entries.map(entry => {
    const reference = journalPlanningReferenceText(entry);
    const photos = options.includePhotos === false ? [] : (entry.photos ?? [])
      .map((source, index) => ({ source, number: index + 1 }))
      .filter(photo => safePhoto(photo.source));
    const excluded = (entry.photos?.length ?? 0) - photos.length;
    const omitted = t(excluded === 1 ? 'exportPhotoOmittedOne' : 'exportPhotoOmittedMany', {
      n: excluded, reason: t(options.includePhotos === false ? 'exportOmittedByChoice' : 'exportOmittedUnavailable'),
    });
    return `<article><header><p class="date">${html(entry.date)} · ${html(farmMemoryCategoryLabel(lang, entry.category))}</p><h2>${html(entry.title || t('exportNote'))}</h2></header>${entry.bedLabel || entry.cropName ? `<p class="tags">${entry.bedLabel ? `${html(t('exportBed'))}: ${html(entry.bedLabel)}` : ''}${entry.bedLabel && entry.cropName ? ' · ' : ''}${entry.cropName ? `${html(t('exportCrop'))}: ${html(entry.cropName)}` : ''}</p>` : ''}<p class="notes">${html(entry.notes)}</p>${reference ? `<p lang="en" class="basis">${html(reference)}</p>` : ''}${nurserySowingHtml(entry)}${nurseryProgressHtml(entry)}${nurseryFieldPlantingHtml(entry)}${photos.length ? `<div class="photos">${photos.map(({ source, number }) => `<figure><img src="${html(source)}" alt="${html(t('exportPhotoAlt', { n: number }))}"><figcaption>${html(entry.date)} · ${html(entry.title || t('exportNote'))} · ${html(t('photoNumber', { n: number }))}</figcaption></figure>`).join('')}</div>` : ''}${excluded > 0 ? `<p class="basis">${html(omitted)}</p>` : ''}</article>`;
  }).join('\n');
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${html(title)}</title>
<style>body{margin:0;background:#fff;color:#20271f;font:16px/1.55 system-ui,sans-serif}main{max-width:800px;margin:auto;padding:32px 20px}h1,h2{font-family:Georgia,serif;line-height:1.2}h1{font-size:32px}h2{font-size:23px;margin:6px 0 12px}article{border-top:1px solid #bdc7bb;padding:24px 0;overflow-wrap:anywhere}.date{font-weight:700;margin:0}.tags,.basis,figcaption{font-size:14px;color:#465343}.notes{white-space:pre-wrap;overflow-wrap:anywhere}.notice{border:2px solid #465343;padding:12px}.photos{display:flex;gap:16px;flex-wrap:wrap}figure{margin:8px 0;max-width:100%;flex:0 1 340px}img{display:block;width:100%;max-height:450px;object-fit:contain}figcaption{margin-top:6px}footer{border-top:1px solid #bdc7bb;padding-top:16px}@page{margin:16mm}@media print{main{max-width:none;padding:0}.print-help{display:none}h2,header{break-after:avoid}figure{break-inside:avoid}article{padding:16px 0}.photos{display:block}figure{max-width:100%}img{max-height:110mm;width:auto;max-width:100%}}</style></head>
<body><main><header><p>ImbewuField · ${html(t('exportCopyLabel'))}</p><h1>${html(title)}</h1>${options.sample ? `<p class="notice">${html(t('exportDemo'))}</p>` : ''}${lang === 'zu' ? `<p class="notice">${html(t('draftNotice'))}</p>` : ''}<p>${html(t(entries.length === 1 ? 'exportSelectedOne' : 'exportSelectedMany', { n: entries.length }))}${options.generatedAt ? ` · ${html(t('exportPrepared', { value: options.generatedAt }))}` : ''}</p><p>${html(options.selection ?? t('exportDefaultSelection'))}</p><p class="basis">${html(t('exportBasis'))}</p><p class="basis">${html(t('exportScope'))}</p><p class="print-help">${html(t('exportPrintHelp'))}</p></header>
${articles || `<p>${html(t('exportEmpty'))}</p>`}
<footer>ImbewuField · ${html(t('exportFooter'))}${options.sample ? ` · ${html(t('exportDemoFooter'))}` : ''}</footer></main></body></html>`;
}

export function downloadJournalCsv(entries: JournalEntry[], options: JournalExportOptions = {}): Promise<FileDelivery> {
  return deliverFile(new Blob([buildJournalCsv(entries, options)], { type: 'text/csv;charset=utf-8' }), 'ImbewuField-journal.csv', farmMemoryText(options.lang ?? 'en', 'exportShareTitle'));
}

export function downloadJournalHtml(entries: JournalEntry[], options: JournalExportOptions = {}): Promise<FileDelivery> {
  return deliverFile(new Blob([buildJournalHtml(entries, options)], { type: 'text/html;charset=utf-8' }), 'ImbewuField-journal.html', farmMemoryText(options.lang ?? 'en', 'exportPrintShareTitle'));
}
