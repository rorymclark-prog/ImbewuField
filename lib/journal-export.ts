import { journalCategory, type JournalEntry } from './field-journal';
import { deliverFile, type FileDelivery } from './file-delivery';

export interface JournalExportOptions {
  sample?: boolean;
  title?: string;
  generatedAt?: string;
  selection?: string;
  includePhotos?: boolean;
}

const BASIS = 'Farmer observations from the journal available on this device. These notes are not verified measurements or a complete record of farm production. Harvest weights and money remain in My Records.';
const DEMO = 'DEMONSTRATION JOURNAL — illustrative entries, not evidence of a real farm\'s results.';

function csvCell(value: string | number): string {
  let text = String(value);
  // Quoting alone does not prevent a spreadsheet from executing a farmer's free-text note.
  // A leading apostrophe is the export-only escape; the stored observation stays untouched.
  if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildJournalCsv(entries: JournalEntry[], options: JournalExportOptions = {}): string {
  const rows: Array<Array<string | number>> = [[
    'Date', 'Category', 'Title', 'Notes', 'Recorded bed', 'Recorded bed ID', 'Recorded crop',
    'Attached photos', 'Record basis', 'Selection',
  ]];
  for (const entry of entries) rows.push([
    entry.date, journalCategory(entry.category).label, entry.title, entry.notes,
    entry.bedLabel ?? '', entry.bedId ?? '', entry.cropName ?? '', entry.photos?.length ?? 0,
    options.sample ? `${DEMO} ${BASIS}` : BASIS, options.selection ?? 'Selected journal entries',
  ]);
  return `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function html(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
}

function safePhoto(source: string): boolean {
  // Keep this copy independent of the server and prevent active SVG/HTML or remote tracking.
  return /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-zA-Z0-9+/=\r\n]+$/u.test(source);
}

/** A self-contained copy: no scripts, remote fonts, external images or live app dependencies.
 * The browser's Print command can save it as a PDF when the farmer is offline. */
export function buildJournalHtml(entries: JournalEntry[], options: JournalExportOptions = {}): string {
  const title = options.title ?? 'Field journal — selected entries';
  const articles = entries.map(entry => {
    const photos = options.includePhotos === false ? [] : (entry.photos ?? [])
      .map((source, index) => ({ source, number: index + 1 }))
      .filter(photo => safePhoto(photo.source));
    const excluded = (entry.photos?.length ?? 0) - photos.length;
    return `<article><header><p class="date">${html(entry.date)} · ${html(journalCategory(entry.category).label)}</p><h2>${html(entry.title || 'Journal note')}</h2></header>${entry.bedLabel || entry.cropName ? `<p class="tags">${entry.bedLabel ? `Recorded bed: ${html(entry.bedLabel)}` : ''}${entry.bedLabel && entry.cropName ? ' · ' : ''}${entry.cropName ? `Recorded crop: ${html(entry.cropName)}` : ''}</p>` : ''}<p class="notes">${html(entry.notes)}</p>${photos.length ? `<div class="photos">${photos.map(({ source, number }) => `<figure><img src="${html(source)}" alt="Attached journal photo ${number}"><figcaption>${html(entry.date)} · ${html(entry.title || 'Journal note')} · Photo ${number}</figcaption></figure>`).join('')}</div>` : ''}${excluded > 0 ? `<p class="basis">${excluded} attached photo${excluded === 1 ? '' : 's'} omitted from this copy${options.includePhotos === false ? ' by selection' : ' because an offline image copy was unavailable'}.</p>` : ''}</article>`;
  }).join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${html(title)}</title>
<style>body{margin:0;background:#fff;color:#20271f;font:16px/1.55 system-ui,sans-serif}main{max-width:800px;margin:auto;padding:32px 20px}h1,h2{font-family:Georgia,serif;line-height:1.2}h1{font-size:32px}h2{font-size:23px;margin:6px 0 12px}article{border-top:1px solid #bdc7bb;padding:24px 0;overflow-wrap:anywhere}.date{font-weight:700;margin:0}.tags,.basis,figcaption{font-size:14px;color:#465343}.notes{white-space:pre-wrap;overflow-wrap:anywhere}.notice{border:2px solid #465343;padding:12px}.photos{display:flex;gap:16px;flex-wrap:wrap}figure{margin:8px 0;max-width:100%;flex:0 1 340px}img{display:block;width:100%;max-height:450px;object-fit:contain}figcaption{margin-top:6px}footer{border-top:1px solid #bdc7bb;padding-top:16px}@page{margin:16mm}@media print{main{max-width:none;padding:0}.print-help{display:none}h2,header{break-after:avoid}figure{break-inside:avoid}article{padding:16px 0}.photos{display:block}figure{max-width:100%}img{max-height:110mm;width:auto;max-width:100%}}</style></head>
<body><main><header><p>ImbewuField · Journal copy</p><h1>${html(title)}</h1>${options.sample ? `<p class="notice">${html(DEMO)}</p>` : ''}<p>${entries.length} selected ${entries.length === 1 ? 'entry' : 'entries'}${options.generatedAt ? ` · Copy prepared ${html(options.generatedAt)}` : ''}</p><p>${html(options.selection ?? 'Selected journal entries')}</p><p class="basis">${html(BASIS)}</p><p class="basis">Dates are the recorded dates of the observations. Bed and crop labels are retained as written. This selection is not a site-wide assessment or a nutrition, yield or financial claim.</p><p class="print-help">This copy works offline. Use your browser’s Print command to print it or save as PDF. Photos are the journal’s stored copies.</p></header>
${articles || '<p>No journal entries were selected.</p>'}
<footer>ImbewuField · Field journal · Original wording retained${options.sample ? ' · Demonstration records' : ''}</footer></main></body></html>`;
}

export function downloadJournalCsv(entries: JournalEntry[], options: JournalExportOptions = {}): Promise<FileDelivery> {
  return deliverFile(new Blob([buildJournalCsv(entries, options)], { type: 'text/csv;charset=utf-8' }), 'ImbewuField-journal.csv', 'Field journal');
}

export function downloadJournalHtml(entries: JournalEntry[], options: JournalExportOptions = {}): Promise<FileDelivery> {
  return deliverFile(new Blob([buildJournalHtml(entries, options)], { type: 'text/html;charset=utf-8' }), 'ImbewuField-journal.html', 'Field journal printable copy');
}
