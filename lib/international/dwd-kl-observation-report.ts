import {
  DWD_KL_ATTRIBUTION, DWD_KL_LICENCE, DWD_KL_SPECIFICATION, type DwdKlObservations,
} from './providers/dwd-kl-observations.ts';

export type AvailableDwdKlObservations = Extract<DwdKlObservations, { status: 'available' }>;
export const DWD_KL_TITLE = 'German historical station weather';
export const DWD_KL_LIMITS = 'These readings describe the named station and past dates. They do not establish site conditions, forecasts, planting dates, frost or heat safety, or irrigation needs.';
export const DWD_KL_PRELIMINARY = 'Recent archive. DWD quality control is incomplete and earlier readings may change.';
export const DWD_KL_INTERVALS = 'Temperature extrema cover 00:00–24:00 UTC. The 2 m air mean uses at least 21 hourly readings. Precipitation covers 06:00 UTC to 06:00 the next day.';
export const DWD_KL_QUALITY = 'QN_4 is the quality level for the readings shown. QN_3 applies to the archive’s wind readings.';
export const DWD_KL_COLUMNS = ['DWD date', 'Air min (2 m)', 'Air mean (2 m)', 'Air max (2 m)', 'Near-ground min (5 cm)',
  'Precipitation (mm)', 'QN_4', 'QN_3'];

function formatReading(value: number | null, unit: string): string {
  return value === null ? 'Missing reading' : `${Number.isInteger(value) ? value.toFixed(1) : value} ${unit}`;
}

function formatQuality(value: number | null): string {
  return value === null ? 'Missing code' : value === 1 ? '1 · Formal checks only' : String(value);
}

export function dwdKlObservationReport(result: AvailableDwdKlObservations) {
  return {
    station: `${result.station.name} · DWD station ${result.station.id}`,
    period: `${result.selection.firstDay} to ${result.selection.lastDay}`,
    coverage: `${result.returnedDays} of ${result.requestedDays} ${result.requestedDays === 1 ? 'day' : 'days'} returned`,
    rows: result.days.map(day => ({
      day: day.day,
      cells: day.kind === 'no-record' ? null : [
        ...[day.airMinimum, day.airMean, day.airMaximum, day.nearGroundMinimum].map(value => formatReading(value, '°C')),
        formatReading(day.precipitationMm, 'mm'), formatQuality(day.qn4), formatQuality(day.qn3),
      ],
    })),
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function buildDwdKlObservationHtml(result: AvailableDwdKlObservations): string {
  const { station, period, coverage, rows } = dwdKlObservationReport(result);
  const headings = DWD_KL_COLUMNS.map(label => `<th scope="col">${label}</th>`).join('');
  const body = rows.map(row => {
    const cells = row.cells?.map(cell => `<td>${escapeHtml(cell)}</td>`).join('') ??
      `<td colspan="${DWD_KL_COLUMNS.length - 1}">No station record</td>`;
    return `<tr><th scope="row">${escapeHtml(row.day)}</th>${cells}</tr>`;
  }).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${DWD_KL_TITLE}</title><style>
body{margin:2rem auto;padding:0 1rem;max-width:64rem;font:16px/1.45 system-ui,sans-serif;color:#172320}
h1{line-height:1.15}p{margin:.55rem 0}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;margin-block:1rem}
caption{text-align:left;font-weight:600;margin-bottom:.5rem}th,td{padding:.5rem;border-bottom:1px solid #a7b3ae;text-align:left}
thead{background:#edf3ef}th[scope=row]{white-space:nowrap}a{color:#125944}.member{overflow-wrap:anywhere}
@media print{body{margin:0;padding:0;font-size:10pt}.table-wrap{overflow:visible}thead{display:table-header-group}tr{break-inside:avoid}td,th{padding:.25rem}}
</style></head><body><main><h1>${DWD_KL_TITLE}</h1>
<p>${escapeHtml(station)}</p><p>${escapeHtml(period)} · ${escapeHtml(coverage)}</p>
<p>${DWD_KL_PRELIMINARY}</p><p>${DWD_KL_LIMITS}</p>
<p lang="de">Diese historischen Messwerte gelten für die genannte Station. Sie sind weder eine Wettervorhersage noch eine Empfehlung für Aussaat, Pflanzung, Frostschutz oder Bewässerung. Die Qualitätsprüfung ist noch nicht abgeschlossen.</p>
<p>${DWD_KL_INTERVALS}</p><p>${DWD_KL_QUALITY}</p>
<p>${DWD_KL_ATTRIBUTION} · Retrieved ${escapeHtml(result.source.retrievedAt)} · <a href="${escapeHtml(result.source.url)}" rel="noreferrer">Original archive</a> · <a href="${DWD_KL_SPECIFICATION}" rel="noreferrer">Dataset specification</a> · <a href="${DWD_KL_LICENCE}" rel="noreferrer">CC BY 4.0</a></p>
<p class="member">Archive member ${escapeHtml(result.source.memberName)}. Values and quality codes extracted and formatted for display.</p>
<div class="table-wrap" role="region" aria-label="Daily station readings" tabindex="0"><table><caption>Daily station readings</caption><thead><tr>${headings}</tr></thead><tbody>
${body}</tbody></table></div></main></body></html>`;
}
