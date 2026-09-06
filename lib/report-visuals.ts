import type { LocationData } from './types';
import type { ReportSiteFacts } from './report-site-facts';
import type { SampleGarden } from './sample-gardens';
import { buildBillOfQuantities } from './report-boq';

export type ReportPresentation = 'screen' | 'colour' | 'ink';
export type ReportMetric = { label: string; value: string; note: string };
export type ReportChart = {
  id: string; title: string; note: string; unit: string;
  kind: 'bars' | 'months' | 'progress' | 'calendar';
  rows: Array<{ label: string; value: number; detail?: string; months?: number[]; once?: number[] }>;
};
export type ReportVisuals = { title: string; subtitle: string; basis: string; overviewTitle?: string; overviewNote?: string; metrics: ReportMetric[]; charts: ReportChart[] };
export const REPORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const REPORT_COLOURS = ['#245738', '#24738a', '#af6b24', '#766395', '#52656a'];
const n = (value: number) => value.toLocaleString('en-ZA', { maximumFractionDigits: 1 }).replace(/\s/g, ' ');
const valid = (value: number) => Number.isFinite(value) && value >= 0;

/** Charts use typed saved quantities, never numbers extracted from generated prose.
 * Missing data stays missing; a planned tank is not a tank of water on the ground. */
export function siteReportVisuals(facts: ReportSiteFacts | null, location: LocationData, language = 'en'): ReportVisuals {
  const t = (en: string, zu: string) => language === 'zu' ? zu : en;
  const metrics: ReportMetric[] = [];
  const charts: ReportChart[] = [];
  if (facts?.boundary) metrics.push({ label: t('Mapped site', 'Indawo ebalazwe'), value: `${n(facts.boundary.areaM2)} m²`, note: facts.boundary.source });
  if (facts?.design) {
    metrics.push({ label: t('Growing space', 'Indawo yokutshala'), value: `${n(facts.design.growingAreaM2)} m²`, note: t('Mapped beds and staple plots', 'Imibhede neziza ezibalazwe') });
    charts.push({ id: 'area', title: t('Space for growing', 'Indawo yokutshala'), note: t('Mapped area, not confirmation of land in production.', 'Indawo ebalazwe; akusona isiqinisekiso sendawo ekhiqizayo.'), unit: 'm²', kind: 'bars', rows: [
      { label: t('Vegetable beds', 'Imibhede yemifino'), value: facts.design.bedAreaM2, detail: `${facts.design.bedCount}` },
      { label: t('Staple plots', 'Iziza eziyisisekelo'), value: facts.design.plotAreaM2, detail: `${facts.design.plotCount}` },
    ].filter(r => valid(r.value)) });
  }
  if (valid(location.rainfall.annual)) metrics.push({ label: t('Annual rainfall', 'Imvula yonyaka'), value: `${n(location.rainfall.annual)} mm`, note: t('Climate estimate', 'Isilinganiso sesimo sezulu') });
  if (facts?.water) metrics.push({ label: t('Storage in the plan', 'Amanzi ohlelweni'), value: facts.water.tanksOfUnknownCapacity && !facts.water.statedStorageLitres ? t('Not stated', 'Akubhaliwe') : `${n(facts.water.statedStorageLitres)} L`, note: facts.water.tanksOfUnknownCapacity ? `${facts.water.tanksOfUnknownCapacity} ${t('tanks have no stated capacity', 'amathangi awunawo umthamo obhaliwe')}` : t('Stated capacity; check installation', 'Umthamo obhaliwe; hlola ukufakwa') });
  if (location.rainfall.monthly.length === 12 && location.rainfall.monthly.every(valid)) charts.push({ id: 'rainfall', title: t('Rain through the year', 'Imvula phakathi nonyaka'), note: `${location.rainfall.rainfallSource ?? t('Climate estimate', 'Isilinganiso sesimo sezulu')} · ${t('Monthly rainfall, not a weather forecast.', 'Imvula yenyanga, akusona isibikezelo sezulu.')}`, unit: 'mm', kind: 'months', rows: location.rainfall.monthly.map((value, i) => ({ label: REPORT_MONTHS[i], value })) });
  if (facts?.water?.tanks.length) charts.push({ id: 'water', title: t('Water storage', 'Ukugcina amanzi'), note: `${t('Capacity is not water currently available.', 'Umthamo awusho amanzi akhona manje.')} ${facts.water.tanksOfUnknownCapacity ? `${facts.water.tanksOfUnknownCapacity} ${t('tanks have no stated capacity.', 'amathangi awunawo umthamo obhaliwe.')}` : ''}`, kind: 'bars', unit: 'L', rows: facts.water.tanks.filter(r => r.statedLitres !== null).map(r => ({ label: `${r.name} ×${r.count}`, value: r.statedLitres! * r.count, detail: r.status })) });
  const cropRows = facts?.crop?.crops ?? [];
  // Chunk rather than truncate: the last crop deserves the same visibility as the first.
  for (let i = 0; i < cropRows.length; i += 7) charts.push({ id: `calendar-${i}`, title: t('Your sowing calendar', 'Ikhalenda lokuhlwanyela'), note: t('● Saved sowing month · ○ First season only. Sowing dates are not harvest dates. Month labels follow the saved plan.', '● Inyanga yokuhlwanyela · ○ Isizini yokuqala kuphela. Izinsuku zokuhlwanyela akuzona ezokuvuna. Amagama ezinyanga alandela uhlelo olugciniwe.'), unit: '', kind: 'calendar', rows: cropRows.slice(i, i + 7).map(c => ({ label: c.name, value: 0, detail: c.bedLabels.join(', '), months: c.sowMonths.map(m => REPORT_MONTHS.indexOf(m)).filter(m => m >= 0), once: c.firstSeasonOnlyMonths.map(m => REPORT_MONTHS.indexOf(m)).filter(m => m >= 0) })) });
  const boq = buildBillOfQuantities(facts);
  const groups = new Map<string, number>();
  for (const line of boq.lines) if (line.zar !== null && valid(line.zar)) groups.set(line.group, (groups.get(line.group) ?? 0) + line.zar);
  if (boq.lines.length) charts.push({ id: 'cost', title: t('What has been priced', 'Okunamanani'), note: `${t('Planned priced subtotal', 'Isamba esinentengo esihleliwe')}: R ${n(boq.subtotalZar)}. ${boq.unpricedCount} ${t('lines still need a price or measurement. Existing items are excluded. Confirm current local quotes.', 'imigqa isadinga intengo noma isilinganiso. Izinto ezikhona azifakiwe. Qinisekisa amanani endawo.')}`, unit: 'R', kind: 'bars', rows: [...groups].map(([label, value]) => ({ label, value })) });
  return { overviewTitle: t('The site at a glance', 'Indawo ngamafuphi'), overviewNote: t('Space, seasons and the resources behind the plan.', 'Indawo, izinkathi zonyaka nezinsiza zohlelo.'), title: facts?.farmName ?? t('Your land, your plan', 'Umhlaba wakho, uhlelo lwakho'), subtitle: `${Math.abs(location.lat).toFixed(4)}°${location.lat < 0 ? 'S' : 'N'} · ${Math.abs(location.lon).toFixed(4)}°${location.lon < 0 ? 'W' : 'E'}`, basis: t('Saved design quantities and site data. Planned work remains distinct from completed work.', 'Ubuningi bomklamo obugciniwe nedatha yendawo. Umsebenzi ohleliwe uhlukile kosewuqediwe.'), metrics, charts };
}

export function sampleReportVisuals(g: SampleGarden): ReportVisuals {
  const total = g.production.vegetableM2 + g.production.stapleM2;
  const rows = [{ label: 'Vegetable beds', value: g.production.vegetableM2 }, { label: 'Staple plots', value: g.production.stapleM2 }];
  if (g.areaM2 !== undefined && g.areaM2 >= total) rows.push({ label: 'Other site space', value: g.areaM2 - total });
  return { title: g.name, subtitle: `${g.kind} · ${g.town}`, basis: 'Fictional demonstration data. The photograph is an AI reference and the layout is schematic, not to scale.', metrics: [
    { label: 'Growing space', value: `${n(total)} m²`, note: 'Vegetables + staple crops' },
    { label: 'Harvest recorded', value: `${n(g.produceKg)} kg`, note: 'Illustrative total; period unspecified' },
    { label: 'Adult participants', value: `${g.farmers}`, note: 'Sample participant register' },
    { label: 'Training progress', value: `${g.training}%`, note: 'Illustrative programme progress' },
  ], charts: [
    { id: 'area', title: 'How the site is used', note: 'Sample area allocations. Other space includes buildings, access and trees; it is not all available for planting.', unit: 'm²', kind: 'bars', rows },
    { id: 'learning', title: 'Learning and participation', note: `${g.farmers} adult participants · Coordinator: ${g.facilitator}. Training progress is not a measure of livelihood improvement.`, unit: '%', kind: 'progress', rows: [{ label: 'Training progress', value: g.training }] },
  ] };
}

const escapeXml = (s: string) => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!));
/** One chart drawing for screen and PDF. Values and category labels accompany colour. */
export function reportChartSvg(chart: ReportChart, ink = false): { svg: string; height: number; width: number } {
  const width = chart.kind === 'calendar' ? 820 : 640;
  const height = chart.kind === 'calendar' ? 80 + chart.rows.length * 58 : chart.kind === 'bars' ? Math.max(150, 32 + chart.rows.length * 66) : 252;
  const colours = ink ? ['#242424', '#626262', '#8b8b8b', '#434343'] : REPORT_COLOURS;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/>`];
  const text = (x: number, y: number, value: string, size = 16, anchor = 'start', weight = 400, colour = '#263d30') => parts.push(`<text x="${x}" y="${y}" fill="${colour}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${escapeXml(value)}</text>`);
  const rect = (x: number, y: number, w: number, h: number, fill: string, radius = 4) => parts.push(`<rect x="${x}" y="${y}" width="${Math.max(0, w)}" height="${h}" rx="${radius}" fill="${fill}"/>`);
  if (!chart.rows.length) text(18, 55, 'No priced or measured values available', 18);
  else if (chart.kind === 'bars') {
    const max = Math.max(...chart.rows.map(r => r.value), 1);
    chart.rows.forEach((r, i) => { const y = 24 + i * 66; text(12, y, r.label, 17, 'start', 600); text(628, y, `${n(r.value)} ${chart.unit}`, 17, 'end', 600); rect(12, y + 14, 616, 14, '#edf1ee'); rect(12, y + 14, 616 * r.value / max, 14, colours[i % colours.length]); });
  } else if (chart.kind === 'months') {
    const max = Math.max(...chart.rows.map(r => r.value), 1);
    [0, 0.5, 1].forEach(f => { const y = 198 - f * 142; parts.push(`<path d="M42 ${y}H630" stroke="#d5ded8" stroke-dasharray="3 4"/>`); text(34, y + 4, n(max * f), 13, 'end'); });
    chart.rows.forEach((r, i) => { const x = 46 + i * 49, h = r.value / max * 142; rect(x + 6, 198 - h, 30, h, colours[1]); text(x + 21, 220, r.label, 14, 'middle'); text(x + 21, 188 - h, n(r.value), 12, 'middle', 600); });
    text(42, 22, chart.unit, 14);
  } else if (chart.kind === 'progress') {
    const value = Math.max(0, Math.min(100, chart.rows[0].value));
    const radius = 85, circumference = 2 * Math.PI * radius;
    parts.push(`<circle cx="135" cy="122" r="${radius}" fill="none" stroke="#e7ece8" stroke-width="18"/><circle cx="135" cy="122" r="${radius}" fill="none" stroke="${colours[0]}" stroke-width="18" stroke-dasharray="${value / 100 * circumference} ${circumference}" transform="rotate(-90 135 122)"/>`);
    text(135, 135, `${n(value)}%`, 44, 'middle', 600); text(275, 110, chart.rows[0].label, 23, 'start', 600); text(275, 145, `${n(100 - value)}% remaining`, 20);
  } else {
    REPORT_MONTHS.forEach((m, i) => text(267 + i * 46, 27, m, 15, 'middle', 600));
    chart.rows.forEach((r, i) => { const y = 56 + i * 58; text(12, y + 16, r.label, 17, 'start', 600); if (r.detail) text(12, y + 35, r.detail.length > 31 ? `${r.detail.slice(0, 28)}…` : r.detail, 13); REPORT_MONTHS.forEach((_, m) => { const x = 267 + m * 46; rect(x - 18, y, 36, 36, '#f1f5f2'); if (r.months?.includes(m)) parts.push(`<circle cx="${x}" cy="${y + 18}" r="9" stroke="${colours[0]}" stroke-width="3" fill="${r.once?.includes(m) ? 'white' : colours[0]}"/>`); }); });
  }
  parts.push('</svg>');
  return { svg: parts.join(''), width, height };
}
