import {
  ECCC_DAILY_ATTRIBUTION, ECCC_DAILY_LICENCE, type EcccDailyObservations, type EcccTemperatureCell,
} from './providers/eccc-daily-observations.ts';

export type AvailableEcccObservations = Extract<EcccDailyObservations, { status: 'available' }>;
export const ECCC_OBSERVATION_LIMITS = 'Historical station records are for context. They do not establish weather at your site, future conditions, planting dates, frost safety, heat suitability or irrigation needs.';
export const ECCC_OBSERVATION_TITLE = 'Canadian historical station weather';

function temperatureText(cell: EcccTemperatureCell): string {
  switch (cell.kind) {
    case 'observed': return `${cell.celsius} °C`;
    case 'estimated': return `${cell.celsius} °C (estimated, E)`;
    case 'missing': return cell.flag === 'M' ? 'Missing (M)' : 'Missing reading';
    case 'withheld-flag': return `Withheld (flag ${cell.flag})`;
  }
}

export function ecccObservationReport(result: AvailableEcccObservations) {
  const { selection, station } = result;
  const windowDays = result.requestedDays === 1 ? 'day' : 'days';
  const unflaggedDays = result.fullyObservedDays === 1 ? 'day' : 'days';
  return {
    station: station
      ? `${station.name}, ${station.province} · Climate ID ${selection.stationClimateId} · Station ID ${station.id}`
      : `Climate ID ${selection.stationClimateId} · No station records returned`,
    period: `${selection.firstLocalDay} to ${selection.lastLocalDay} (station local dates)`,
    coverage: `${result.returnedDays} of ${result.requestedDays} ${windowDays} returned · ${result.fullyObservedDays} ${unflaggedDays} with all three readings unflagged`,
    rows: result.days.map(day => ({
      day: day.localDay,
      cells: day.kind === 'returned' ? [temperatureText(day.minimum), temperatureText(day.mean), temperatureText(day.maximum)] : null,
    })),
  };
}

function html(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function buildEcccObservationHtml(result: AvailableEcccObservations): string {
  const { station, period, coverage, rows } = ecccObservationReport(result);
  const body = rows.map(row => {
    const cells = row.cells?.map(cell => `<td>${html(cell)}</td>`).join('') ?? '<td colspan="3">No station record</td>';
    return `<tr><th scope="row">${html(row.day)}</th>${cells}</tr>`;
  }).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${ECCC_OBSERVATION_TITLE}</title><style>
body{margin:2rem auto;padding:0 1rem;max-width:52rem;font:16px/1.45 system-ui,sans-serif;color:#172320}
h1{line-height:1.15}p{margin:.55rem 0}table{width:100%;border-collapse:collapse;margin-block:1rem}
caption{text-align:left;font-weight:600;margin-bottom:.5rem}th,td{padding:.5rem;border-bottom:1px solid #a7b3ae;text-align:left}
thead{background:#edf3ef}th[scope=row]{white-space:nowrap}a{color:#125944}
@media print{body{margin:0;padding:0;font-size:11pt}thead{display:table-header-group}tr{break-inside:avoid}}
</style></head><body><main><h1>${ECCC_OBSERVATION_TITLE}</h1>
<p>${html(station)}</p><p>${html(period)}</p><p>${html(coverage)}</p>
<p>${ECCC_OBSERVATION_LIMITS}</p>
<p>${ECCC_DAILY_ATTRIBUTION} · Retrieved ${html(result.source.retrievedAt)} · <a href="${html(result.source.url)}">Original station query</a> · <a href="${ECCC_DAILY_LICENCE}">Data licence</a></p>
<table><caption>Daily air temperature in degrees Celsius</caption><thead><tr><th scope="col">Local date</th><th scope="col">Minimum</th><th scope="col">Mean</th><th scope="col">Maximum</th></tr></thead><tbody>
${body}</tbody></table></main></body></html>`;
}
