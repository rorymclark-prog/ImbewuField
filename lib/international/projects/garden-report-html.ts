import { validProjectDate } from './evaluate';
import type { IndicatorReview } from './types';

export interface GardenProgressHarvestRow {
  readonly recordId: string;
  readonly pickedOn: string | null;
  readonly recordedOn: string | null;
  readonly quantity: number | null;
  readonly unit: string | null;
  readonly includedInWeight: boolean;
  readonly reasons: readonly string[];
}

export interface GardenProgressReportHtmlInput {
  readonly siteLabel: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly cutoffDate: string;
  readonly timeZone: string;
  readonly sample: boolean;
  readonly total: Pick<IndicatorReview, 'state' | 'value' | 'knownSubtotal'> & { readonly gaps: readonly string[] };
  readonly harvest: readonly GardenProgressHarvestRow[];
  readonly notes?: readonly {
    readonly recordId: string;
    readonly observedOn: string;
    readonly recordedOn: string;
    readonly text: string;
  }[];
}

function html(value: string | number): string {
  return String(value).replace(/[&<>"']/g, character =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
}

function date(value: string | null): string {
  return validProjectDate(value) ? `<time datetime="${html(value)}">${html(value)}</time>` : 'Unknown';
}

function quantity(value: number | null): string {
  return value !== null && Number.isFinite(value) && value >= 0 ? html(value) : 'Unknown';
}

function textList(items: readonly string[]): string {
  return items.length ? `<ul>${items.map(item => `<li>${html(item)}</li>`).join('')}</ul>` : '';
}

function weightSummary(total: GardenProgressReportHtmlInput['total']): string {
  const value = total.state === 'reported' ? total.value
    : total.state === 'incomplete' ? total.knownSubtotal : null;
  if (value === null || !Number.isFinite(value) || value < 0) {
    return '<p class="result">Recorded weight is unknown.</p>';
  }
  const label = total.state === 'incomplete' ? 'Known partial weight' : 'Recorded weight';
  return `<p class="result">${label} <strong>${quantity(value)} kg</strong></p>`;
}

function harvestSection(rows: GardenProgressReportHtmlInput['harvest']): string {
  if (!rows.length) return '<p>No harvest records are included in this draft.</p>';
  return `<ul class="records">${rows.map(row => `<li>
<article>
<h3>Harvest record</h3><p class="reference">${html(row.recordId)}</p>
<dl>
<div><dt>Picking date</dt><dd>${date(row.pickedOn)}</dd></div>
<div><dt>Recorded date</dt><dd>${date(row.recordedOn)}</dd></div>
<div><dt>Recorded quantity</dt><dd>${quantity(row.quantity)}${row.unit ? ` ${html(row.unit)}` : ''}</dd></div>
<div><dt>Weight total</dt><dd>${row.includedInWeight ? 'Included in kg' : 'Outside the kg total'}</dd></div>
</dl>
${textList(row.reasons)}
</article></li>`).join('')}</ul>`;
}

function notesSection(notes: GardenProgressReportHtmlInput['notes']): string {
  if (!notes?.length) return '';
  return `<section aria-labelledby="field-notes"><h2 id="field-notes">Selected field notes</h2>
<p>Grower observations are shown separately from recorded harvest weight.</p>
<ol class="records">${notes.map(note => `<li><article>
<h3>Observed ${date(note.observedOn)}</h3><p>Recorded ${date(note.recordedOn)}</p><p class="reference">${html(note.recordId)}</p>
<p class="note">${html(note.text)}</p></article></li>`).join('')}</ol></section>`;
}

/** Render the checked, selected evidence as a standalone local download. */
export function buildGardenProgressReportHtml(input: GardenProgressReportHtmlInput): string {
  const title = input.sample ? 'DEMO · Garden progress report' : 'Garden progress report';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${title}</title>
<style>
:root{font:16px/1.5 system-ui,sans-serif;color:#1d2e23;background:#f6f7f3}
body{margin:0}main{max-width:46rem;margin:auto;padding:2rem 1.2rem;overflow-wrap:anywhere}
header{border-bottom:3px solid #427052;padding-bottom:1rem}
h1{font-family:Georgia,serif;font-size:clamp(2rem,7vw,2.8rem);line-height:1.1;margin:.3em 0}
h2{font-size:1.25rem;margin:0}h3{font-size:1rem;margin:0}p{margin:.45rem 0}section{margin:1.4rem 0}
dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.55rem 1rem;margin:.75rem 0}
dt{font-weight:650}dd{margin:0;font-variant-numeric:tabular-nums}
.result{font-size:1.2rem}.reference{color:#425248}.note{white-space:pre-wrap}
.records{list-style:none;padding:0}.records>li{margin:.8rem 0}
article{background:#fff;border:1px solid #c6cfc4;border-left:3px solid #7c9e87;padding:.7rem .85rem}
@page{margin:16mm}@media print{:root{background:#fff}main{padding:0}h2,h3{break-after:avoid}.records>li{break-inside:avoid}}
</style></head><body><main>
<header><p>ImbewuField · Private mapped-site draft</p><h1>${title}</h1><p>${html(input.siteLabel)}</p>
${input.sample ? '<p><strong>Demonstration only.</strong> The site and records are illustrative examples.</p>' : ''}</header>
<section aria-labelledby="report-period"><h2 id="report-period">Reporting period</h2><dl>
<div><dt>From</dt><dd>${date(input.periodStart)}</dd></div><div><dt>Through</dt><dd>${date(input.periodEnd)}</dd></div>
<div><dt>Evidence cutoff</dt><dd>${date(input.cutoffDate)}</dd></div><div><dt>Date basis</dt><dd>${html(input.timeZone)}</dd></div>
</dl></section>
<section aria-labelledby="harvest-weight"><h2 id="harvest-weight">Recorded harvest weight</h2>
${weightSummary(input.total)}
<p>This covers selected records. Quantities in other units are listed in their original units.</p>
${textList(input.total.gaps)}</section>
<section aria-labelledby="record-list"><h2 id="record-list">Selected harvest records</h2>
<p>Picking dates and recorded dates are shown separately.</p>${harvestSection(input.harvest)}</section>
${notesSection(input.notes)}
</main></body></html>`;
}
