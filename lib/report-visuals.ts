import { ELEMENTS_BY_ID } from './design-elements';
import { plantTakesCode } from './plant-codes';
import { ROUTE_LABELS } from './design-studio-report';
import { recordsMonthShort } from './records-months.ts';
import { numberLabel } from '@/lib/format-figures';
import type { LocationData } from './types';
import type { ReportSiteFacts } from './report-site-facts';
import type { SampleGarden } from './sample-gardens';
import { buildBillOfQuantities } from './report-boq';
import type { ReportFigure } from './report-figures';
import { inlineDraft, isInlineDraftLang } from '@/lib/xh-inline';

export type ReportPresentation = 'screen' | 'colour' | 'ink';
export type ReportMetric = { label: string; value: string; note: string };
export type ReportChart = {
  id: string; title: string; note: string; unit: string;
  /** Presentation language only; calendar month indexes and quantities stay canonical. */
  language?: string;
  kind: 'bars' | 'months' | 'progress' | 'calendar' | 'figure';
  rows: Array<{ label: string; value: number; detail?: string; months?: number[]; once?: number[] }>;
  /** kind 'figure': a finished drawing from lib/report-figures. `rows` stays empty. */
  figure?: ReportFigure;
};
/** slideHint: the words shown on a phone while a figure is wider than its card, in the report's language. */
export type ReportVisuals = { language?: string; title: string; subtitle: string; basis: string; overviewTitle?: string; overviewNote?: string; slideHint?: string; metrics: ReportMetric[]; charts: ReportChart[] };
export const REPORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const REPORT_COLOURS = ['#245738', '#24738a', '#af6b24', '#766395', '#52656a'];
const n = (value: number) => numberLabel(value, 1).replace(/\s/g, ' ');
const valid = (value: number) => Number.isFinite(value) && value >= 0;

/** Charts use typed saved quantities, never numbers extracted from generated prose.
 * Missing data stays missing; a planned tank is not a tank of water on the ground. */
export function siteReportVisuals(facts: ReportSiteFacts | null, location: LocationData, language = 'en'): ReportVisuals {
  const t = (en: string, zu: string) => reportVisualText(en, language, {}, zu);
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
  if (location.rainfall.monthly.length === 12 && location.rainfall.monthly.every(valid)) charts.push({ id: 'rainfall', title: t('Rain through the year', 'Imvula phakathi nonyaka'), note: `${location.rainfall.rainfallSource ?? t('Climate estimate', 'Isilinganiso sesimo sezulu')} · ${t('Monthly rainfall, not a weather forecast.', 'Imvula yenyanga, akusona isibikezelo sezulu.')}`, unit: 'mm', kind: 'months', rows: location.rainfall.monthly.map((value, i) => ({ label: recordsMonthShort(language, i + 1), value })) });
  if (facts?.water?.tanks.length) charts.push({ id: 'water', title: t('Water storage', 'Ukugcina amanzi'), note: `${t('Capacity is not water currently available.', 'Umthamo awusho amanzi akhona manje.')} ${facts.water.tanksOfUnknownCapacity ? `${facts.water.tanksOfUnknownCapacity} ${t('tanks have no stated capacity.', 'amathangi awunawo umthamo obhaliwe.')}` : ''}`, kind: 'bars', unit: 'L', rows: facts.water.tanks.filter(r => r.statedLitres !== null).map(r => ({ label: `${reportElementDisplayName(r.name,r.defId,language)} ×${r.count}`, value: r.statedLitres! * r.count, detail: reportVisualText(r.status, language) })) });
  const cropRows = facts?.crop?.crops ?? [];
  // Chunk rather than truncate: the last crop deserves the same visibility as the first.
  for (let i = 0; i < cropRows.length; i += 7) charts.push({ id: `calendar-${i}`, title: t('Your sowing calendar', 'Ikhalenda lokuhlwanyela'), note: t('● Saved sowing month · ○ First season only. Sowing dates are not harvest dates. Month labels follow the saved plan.', '● Inyanga yokuhlwanyela · ○ Isizini yokuqala kuphela. Izinsuku zokuhlwanyela akuzona ezokuvuna. Amagama ezinyanga alandela uhlelo olugciniwe.'), unit: '', kind: 'calendar', rows: cropRows.slice(i, i + 7).map(c => ({ label: c.name, value: 0, detail: c.bedLabels.join(', '), months: c.sowMonths.map(m => REPORT_MONTHS.indexOf(m)).filter(m => m >= 0), once: c.firstSeasonOnlyMonths.map(m => REPORT_MONTHS.indexOf(m)).filter(m => m >= 0) })) });
  const boq = buildBillOfQuantities(facts);
  const groups = new Map<string, number>();
  for (const line of boq.lines) if (line.zar !== null && valid(line.zar)) groups.set(line.group, (groups.get(line.group) ?? 0) + line.zar);
  if (boq.lines.length) charts.push({ id: 'cost', title: t('What has been priced', 'Okunamanani'), note: `${t('Planned priced subtotal', 'Isamba esinentengo esihleliwe')}: R ${n(boq.subtotalZar)}. ${boq.unpricedCount} ${t('lines still need a price or measurement. Existing items are excluded. Confirm current local quotes.', 'imigqa isadinga intengo noma isilinganiso. Izinto ezikhona azifakiwe. Qinisekisa amanani endawo.')}`, unit: 'R', kind: 'bars', rows: [...groups].map(([label, value]) => ({ label: reportVisualText(label, language), value })) });
  return { overviewTitle: t('The site at a glance', 'Indawo ngamafuphi'), overviewNote: t('Space, seasons and the resources behind the plan.', 'Indawo, izinkathi zonyaka nezinsiza zohlelo.'), title: facts?.farmName ?? t('Your land, your plan', 'Umhlaba wakho, uhlelo lwakho'), subtitle: `${Math.abs(location.lat).toFixed(4)}°${location.lat < 0 ? 'S' : 'N'} · ${Math.abs(location.lon).toFixed(4)}°${location.lon < 0 ? 'W' : 'E'}`, basis: t('Saved design quantities and site data. Planned work remains distinct from completed work.', 'Ubuningi bomklamo obugciniwe nedatha yendawo. Umsebenzi ohleliwe uhlukile kosewuqediwe.'), metrics, charts: charts.map(chart => language === 'en' ? chart : { ...chart, language }), ...(language === 'en' ? {} : { language }) };
}

/** A figure says more than the plain chart it grew out of, so it takes that chart's place (and,
 * for rain, its id: saved reports and the chapter rules already know it as 'rainfall'). */
const FIGURE_REPLACES: Record<string, string> = { climate: 'rainfall', 'water-budget': 'water', 'land-use': 'area' };
const FIGURE_KICKER: Record<string, [string, string]> = { 'site-plan': ['SITE PLAN', 'IPULANI YENDAWO'], 'land-use': ['m²', 'm²'], status: ['BUILT / PLANNED', 'OKWAKHIWE / OKUHLELIWE'], climate: ['JAN – DEC', 'JAN – DEC'], sectors: ['SUN · WIND · SLOPE', 'ILANGA · UMOYA · UMTHAMBEKA'], 'water-budget': ['LITRES', 'AMALITHA'], soil: ['SOIL', 'UMHLABATHI'], timeline: ['WEEKS', 'AMASONTO'] };
/** The ground comes first in the overview; the rest follow the charts they sit beside. */
const FIGURES_FIRST = ['site-plan', 'land-use', 'status'];

/** Adds the drawn figures to a report's visuals. Separate from siteReportVisuals because the
 * figures need the saved drawing, which only the browser holds; the typed charts need only facts. */
export function withReportFigures(visuals: ReportVisuals, figures: ReportFigure[], language = 'en'): ReportVisuals {
  if (!figures.length) return visuals;
  const source = reportVisualText('Source', language);
  const asChart = (figure: ReportFigure): ReportChart => ({ id: FIGURE_REPLACES[figure.id] === 'rainfall' ? 'rainfall' : figure.id, title: figure.title, note: `${figure.note} ${source}: ${figure.source}`.trim(), unit: figureKicker(figure.id, language), kind: 'figure', rows: [], figure, ...(language === 'en' ? {} : { language }) });
  const replaced = new Set(figures.map(figure => FIGURE_REPLACES[figure.id]).filter(Boolean));
  const first = figures.filter(figure => FIGURES_FIRST.includes(figure.id)).map(asChart);
  const rest = figures.filter(figure => !FIGURES_FIRST.includes(figure.id)).map(asChart);
  return { ...visuals, ...(language === 'en' ? {} : { language }), slideHint: reportVisualText('Slide to see more', language), charts: [...first, ...visuals.charts.filter(chart => !replaced.has(chart.id)), ...rest] };
}

export function sampleReportVisuals(g: SampleGarden, language = 'en'): ReportVisuals {
  const t = (source: string, values?: Record<string, string | number>) => reportVisualText(source, language, values);
  const total = g.production.vegetableM2 + g.production.stapleM2;
  const rows = [{ label: t('Vegetable beds'), value: g.production.vegetableM2 }, { label: t('Staple plots'), value: g.production.stapleM2 }];
  if (g.areaM2 !== undefined && g.areaM2 >= total) rows.push({ label: t('Other site space'), value: g.areaM2 - total });
  const visuals: ReportVisuals = { title: g.name, subtitle: `${g.kind ? t(g.kind) : g.kind} · ${g.town}`, basis: t('The photograph is AI-generated. The layout is schematic, not to scale.'), metrics: [
    { label: t('Growing space'), value: `${n(total)} m²`, note: t('Vegetables + staple crops') },
    { label: t('Harvest recorded'), value: `${n(g.produceKg)} kg`, note: t('Illustrative total; period unspecified') },
    { label: t('Adult participants'), value: `${g.farmers}`, note: t("Participant register") },
    { label: t('Training progress'), value: `${g.training}%`, note: t('Illustrative programme progress') },
  ], charts: [
    { id: 'area', title: t('How the site is used'), note: t("area allocations. Other space includes buildings, access and trees; it is not all available for planting."), unit: 'm²', kind: 'bars', rows },
    { id: 'learning', title: t('Learning and participation'), note: t('{count} adult participants · Coordinator: {coordinator}. Training progress is not a measure of livelihood improvement.', { count: g.farmers, coordinator: g.facilitator }), unit: '%', kind: 'progress', rows: [{ label: t('Training progress'), value: g.training }] },
  ] };
  return language === 'en' ? visuals : { ...visuals, language, charts: visuals.charts.map(chart => ({ ...chart, language })) };
}

const escapeXml = (s: string) => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!));
/** One chart drawing for screen and PDF. Values and category labels accompany colour. */
export function reportChartSvg(chart: ReportChart, ink = false): { svg: string; height: number; width: number } {
  if (chart.kind === 'figure' && chart.figure) return { svg: chart.figure.svg, width: chart.figure.width, height: chart.figure.height };
  const language = chart.language ?? 'en';
  const width = chart.kind === 'calendar' ? 820 : 640;
  const barLabels = chart.rows.map(row => wrapChartWords(row.label, 17, 485));
  const barRowHeights = barLabels.map(lines => 66 + Math.max(0, lines.length - 1) * 21);
  const height = chart.kind === 'calendar' ? 80 + chart.rows.length * 58 : chart.kind === 'bars' ? Math.max(150, 32 + barRowHeights.reduce((sum, value) => sum + value, 0)) : 252;
  const colours = ink ? ['#242424', '#626262', '#8b8b8b', '#434343'] : REPORT_COLOURS;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/>`];
  const text = (x: number, y: number, value: string, size = 16, anchor = 'start', weight = 400, colour = '#263d30') => parts.push(`<text x="${x}" y="${y}" fill="${colour}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${escapeXml(value)}</text>`);
  const rect = (x: number, y: number, w: number, h: number, fill: string, radius = 4) => parts.push(`<rect x="${x}" y="${y}" width="${Math.max(0, w)}" height="${h}" rx="${radius}" fill="${fill}"/>`);
  if (!chart.rows.length) wrapChartWords(reportVisualText('No priced or measured values available', language), 18, 604).forEach((line, at) => text(18, 55 + at * 23, line, 18));
  else if (chart.kind === 'bars') {
    const max = Math.max(...chart.rows.map(r => r.value), 1);
    let y = 24;
    chart.rows.forEach((r, i) => {
      barLabels[i].forEach((line, at) => text(12, y + at * 21, line, 17, 'start', 600));
      text(628, y, `${n(r.value)} ${chart.unit}`, 17, 'end', 600);
      const barY = y + Math.max(0, barLabels[i].length - 1) * 21 + 14;
      rect(12, barY, 616, 14, '#edf1ee'); rect(12, barY, 616 * r.value / max, 14, colours[i % colours.length]);
      y += barRowHeights[i];
    });
  } else if (chart.kind === 'months') {
    const max = Math.max(...chart.rows.map(r => r.value), 1);
    [0, 0.5, 1].forEach(f => { const y = 198 - f * 142; parts.push(`<path d="M42 ${y}H630" stroke="#d5ded8" stroke-dasharray="3 4"/>`); text(34, y + 4, n(max * f), 13, 'end'); });
    chart.rows.forEach((r, i) => { const x = 46 + i * 49, h = r.value / max * 142; rect(x + 6, 198 - h, 30, h, colours[1]); text(x + 21, 220, r.label, 14, 'middle'); text(x + 21, 188 - h, n(r.value), 12, 'middle', 600); });
    text(42, 22, chart.unit, 14);
  } else if (chart.kind === 'progress') {
    const value = Math.max(0, Math.min(100, chart.rows[0].value));
    const radius = 85, circumference = 2 * Math.PI * radius;
    parts.push(`<circle cx="135" cy="122" r="${radius}" fill="none" stroke="#e7ece8" stroke-width="18"/><circle cx="135" cy="122" r="${radius}" fill="none" stroke="${colours[0]}" stroke-width="18" stroke-dasharray="${value / 100 * circumference} ${circumference}" transform="rotate(-90 135 122)"/>`);
    text(135, 135, `${n(value)}%`, 44, 'middle', 600); text(275, 110, chart.rows[0].label, 23, 'start', 600); text(275, 145, reportVisualText('{remaining}% remaining', language, { remaining: n(100 - value) }), 20);
  } else {
    REPORT_MONTHS.forEach((_, i) => text(267 + i * 46, 27, recordsMonthShort(language, i + 1), 15, 'middle', 600));
    chart.rows.forEach((r, i) => { const y = 56 + i * 58; text(12, y + 16, r.label, 17, 'start', 600); if (r.detail) text(12, y + 35, r.detail.length > 31 ? `${r.detail.slice(0, 28)}…` : r.detail, 13); REPORT_MONTHS.forEach((_, m) => { const x = 267 + m * 46; rect(x - 18, y, 36, 36, '#f1f5f2'); if (r.months?.includes(m)) parts.push(`<circle cx="${x}" cy="${y + 18}" r="9" stroke="${colours[0]}" stroke-width="3" fill="${r.once?.includes(m) ? 'white' : colours[0]}"/>`); }); });
  }
  parts.push('</svg>');
  return { svg: parts.join(''), width, height };
}

/** Unreviewed AI drafts. Source quantities, stored labels and catalogue names are never translated by inference. */
export const REPORT_VISUAL_COPY: readonly { english: string; zu: string; st: string; ts: string; ve: string }[] = [
  {
    "english": "Mapped site",
    "zu": "Indawo ebalazwe",
    "st": "Sebaka se takilweng mmapeng",
    "ts": "Ndhawu leyi dirowiweke emepeni",
    "ve": "Fhethu ho olwaho kha mapa"
  },
  {
    "english": "Growing space",
    "zu": "Indawo yokutshala",
    "st": "Sebaka sa ho lema",
    "ts": "Ndhawu yo byala",
    "ve": "Fhethu ha u lima"
  },
  {
    "english": "Mapped beds and staple plots",
    "zu": "Imibhede neziza ezibalazwe",
    "st": "Dibethe le ditsha tsa dijalo tsa motheo tse takilweng mmapeng",
    "ts": "Mibedo ni swiphemu swa swakudya swa nkoka leswi dirowiweke emepeni",
    "ve": "Mibete na zwipiḓa zwa zwiliṅwa zwa ndeme zwo olwaho kha mapa"
  },
  {
    "english": "Space for growing",
    "zu": "Indawo yokutshala",
    "st": "Sebaka sa ho lema",
    "ts": "Ndhawu yo byala",
    "ve": "Fhethu ha u lima"
  },
  {
    "english": "Mapped area, not confirmation of land in production.",
    "zu": "Indawo ebalazwe; akusona isiqinisekiso sendawo ekhiqizayo.",
    "st": "Sebaka se takilweng mmapeng, ha se tiisetso ya hore mobu o ntse o hlahisa dijalo.",
    "ts": "Ndhawu leyi dirowiweke emepeni, a hi xitiyisekiso xa leswaku misava yi le ku humeleriseni.",
    "ve": "Fhethu ho olwaho kha mapa, a hu khwaṱhisedzi uri hu khou bveledzwa zwiliṅwa."
  },
  {
    "english": "Vegetable beds",
    "zu": "Imibhede yemifino",
    "st": "Dibethe tsa meroho",
    "ts": "Mibedo ya matsavu",
    "ve": "Mibete ya miroho"
  },
  {
    "english": "Staple plots",
    "zu": "Iziza eziyisisekelo",
    "st": "Ditsha tsa dijalo tsa motheo",
    "ts": "Swiphemu swa swibyariwa swa swakudya swa nkoka",
    "ve": "Zwipiḓa zwa zwiliṅwa zwa zwiḽiwa zwa ndeme"
  },
  {
    "english": "Annual rainfall",
    "zu": "Imvula yonyaka",
    "st": "Pula ya selemo",
    "ts": "Mpfula ya lembe",
    "ve": "Mvula ya ṅwaha"
  },
  {
    "english": "Climate estimate",
    "zu": "Isilinganiso sesimo sezulu",
    "st": "Tekanyetso ya tlelaemete",
    "ts": "Mpimanyeto wa maxelo",
    "ve": "Ndinganyelo ya kilima"
  },
  {
    "english": "Storage in the plan",
    "zu": "Amanzi ohlelweni",
    "st": "Polokelo e moralong",
    "ts": "Vuhlayiselo eka pulani",
    "ve": "Vhugalelo vhu re kha pulane"
  },
  {
    "english": "Not stated",
    "zu": "Akubhaliwe",
    "st": "Ha ho a bolelwa",
    "ts": "A swi vuriwanga",
    "ve": "A zwo ngo bulwa"
  },
  {
    "english": "tanks have no stated capacity",
    "zu": "amathangi awunawo umthamo obhaliwe",
    "st": "ditanka ha di na bokgoni bo boletsweng",
    "ts": "mathangi a ma na vundzeni leri vuriweke",
    "ve": "mathannga haana vhungomu ho bulwaho"
  },
  {
    "english": "Stated capacity; check installation",
    "zu": "Umthamo obhaliwe; hlola ukufakwa",
    "st": "Bokgoni bo boletsweng; hlahloba hore e kentswe",
    "ts": "Vundzeni leri vuriweke; kambela ku nghenisiwa",
    "ve": "Vhungomu ho bulwaho; sedzani u dzheniswa"
  },
  {
    "english": "Rain through the year",
    "zu": "Imvula phakathi nonyaka",
    "st": "Pula nakong ya selemo",
    "ts": "Mpfula elembeni hinkwaro",
    "ve": "Mvula kha ṅwaha woṱhe"
  },
  {
    "english": "Monthly rainfall, not a weather forecast.",
    "zu": "Imvula yenyanga, akusona isibikezelo sezulu.",
    "st": "Pula ya kgwedi, ha se bolepi ba boemo ba lehodimo.",
    "ts": "Mpfula ya n’hweti, a hi mvhumbo wa maxelo.",
    "ve": "Mvula ya ṅwedzi, a si mbonelaphanḓa ya mutsho."
  },
  {
    "english": "Water storage",
    "zu": "Ukugcina amanzi",
    "st": "Polokelo ya metsi",
    "ts": "Vuhlayiselo bya mati",
    "ve": "Vhugalelo ha maḓi"
  },
  {
    "english": "Capacity is not water currently available.",
    "zu": "Umthamo awusho amanzi akhona manje.",
    "st": "Bokgoni ha se metsi a fumanehang hona jwale.",
    "ts": "Vundzeni a hi mati lama nga kona sweswi.",
    "ve": "Vhungomu a si maḓi ane a vha hone zwino."
  },
  {
    "english": "tanks have no stated capacity.",
    "zu": "amathangi awunawo umthamo obhaliwe.",
    "st": "ditanka ha di na bokgoni bo boletsweng.",
    "ts": "mathangi a ma na vundzeni leri vuriweke.",
    "ve": "mathannga haana vhungomu ho bulwaho."
  },
  {
    "english": "Your sowing calendar",
    "zu": "Ikhalenda lokuhlwanyela",
    "st": "Khalendara ya hao ya ho jala",
    "ts": "Khalendara ya wena yo byala hi mbewu",
    "ve": "Khalenda yaṋu ya u zwala"
  },
  {
    "english": "● Saved sowing month · ○ First season only. Sowing dates are not harvest dates. Month labels follow the saved plan.",
    "zu": "● Inyanga yokuhlwanyela · ○ Isizini yokuqala kuphela. Izinsuku zokuhlwanyela akuzona ezokuvuna. Amagama ezinyanga alandela uhlelo olugciniwe.",
    "st": "● Kgwedi ya ho jala e bolokilweng · ○ Sehla sa pele feela. Matsatsi a ho jala ha se matsatsi a kotulo. Mabitso a dikgwedi a latela moralo o bolokilweng.",
    "ts": "● N’hweti yo byala leyi hlayisiweke · ○ Nguva yo sungula ntsena. Masiku yo byala a hi masiku ya ntshovelo. Mavito ya tin’hweti ma landzela pulani leyi hlayisiweke.",
    "ve": "● Ṅwedzi wa u zwala wo vhulungwaho · ○ Khalanwaha ya u thoma fhedzi. Madatumu a u zwala a si a u kaṋa. Madzina a miṅwedzi a tevhela pulane yo vhulungwaho."
  },
  {
    "english": "What has been priced",
    "zu": "Okunamanani",
    "st": "Tse nang le ditheko",
    "ts": "Leswi nga ni minxavo",
    "ve": "Zwi re na mitengo"
  },
  {
    "english": "Planned priced subtotal",
    "zu": "Isamba esinentengo esihleliwe",
    "st": "Kakaretso e ka tlase e rerilweng e nang le ditheko",
    "ts": "Nhlayohansi lowu kunguhatiweke lowu nga ni minxavo",
    "ve": "Ṱhanganyelo yo dzudzanywaho i re na mitengo"
  },
  {
    "english": "lines still need a price or measurement. Existing items are excluded. Confirm current local quotes.",
    "zu": "imigqa isadinga intengo noma isilinganiso. Izinto ezikhona azifakiwe. Qinisekisa amanani endawo.",
    "st": "mela e ntse e hloka theko kapa tekanyo. Dintho tse seng di le teng ha di kenyeletswe. Netefatsa ditheko tsa hona jwale tsa sebakeng.",
    "ts": "tilayini ta ha lava nxavo kumbe mpimo. Swilo leswi se swi nga kona a swi katsiwanga. Tiyisisa minxavo ya sweswi ya le ndhawini.",
    "ve": "mitaladzi i kha ḓi ṱoḓa mutengo kana muṅwelo. Zwithu zwi re hone a zwo ngo katelwa. Khwaṱhisedzani mitengo ya zwino ya henefho."
  },
  {
    "english": "The site at a glance",
    "zu": "Indawo le njengoba injalo",
    "st": "Sebaka ka bokgutshwanyane",
    "ts": "Ndhawu hi ku languta kan’we",
    "ve": "Fhethu nga u tou lavhelesa"
  },
  {
    "english": "Space, seasons and the resources behind the plan.",
    "zu": "Indawo, izinkathi nezinsiza ezisekela uhlelo.",
    "st": "Sebaka, dihla le mehlodi e tshehetsang moralo.",
    "ts": "Ndhawu, tinguva ni switirhisiwa leswi seketelaka pulani.",
    "ve": "Fhethu, khalanwaha na zwiko zwi tikedzaho pulane."
  },
  {
    "english": "Your land, your plan",
    "zu": "Umhlaba wakho, uhlelo lwakho",
    "st": "Mobu wa hao, moralo wa hao",
    "ts": "Misava ya wena, pulani ya wena",
    "ve": "Mavu aṋu, pulane yaṋu"
  },
  {
    "english": "Saved design quantities and site data. Planned work remains distinct from completed work.",
    "zu": "Ubuningi bomklamo obugciniwe nedatha yendawo. Umsebenzi ohleliwe uhlukile kosewuqediwe.",
    "st": "Bongata ba moralo bo bolokilweng le datha ya sebaka. Mosebetsi o rerilweng o dula o arohane le mosebetsi o phethilweng.",
    "ts": "Mimpimo ya pulani leyi hlayisiweke ni datha ya ndhawu. Ntirho lowu kunguhatiweke wu hambanile ni lowu hetiweke.",
    "ve": "Vhunzhi ha pulane ho vhulungwaho na data ya fhethu. Mushumo wo dzudzanywaho u dzula wo fhambana na wo fhelelaho."
  },
  {
    "english": "No priced or measured values available.",
    "zu": "Alukho ulwazi lwamanani noma lwezilinganiso olutholakalayo.",
    "st": "Ha ho boleng bo nang le theko kapa bo lekantsweng bo fumanehang.",
    "ts": "A ku na mimpimo leyi nga ni nxavo kumbe leyi pimiweke leyi kumekaka.",
    "ve": "A hu na miṅwelo i re na mutengo kana yo elwaho i wanalaho."
  },
  {
    "english": "View full size",
    "zu": "Buka ngosayizi ogcwele",
    "st": "Sheba ka boholo bo felletseng",
    "ts": "Vona hi sayizi leyi heleleke",
    "ve": "Vhonani nga saizi yo fhelelaho"
  },
  {
    "english": "IMBEWUFIELD / SITE REPORT",
    "zu": "IMBEWUFIELD / UMBIKO WESIZA",
    "st": "IMBEWUFIELD / TLALEHO YA SEBAKA",
    "ts": "IMBEWUFIELD / XIVIKO XA NDHAWU",
    "ve": "IMBEWUFIELD / MUVHIGO WA FHETHU"
  },
  {
    "english": "Source",
    "zu": "Umthombo",
    "st": "Mohlodi",
    "ts": "Xihlovo",
    "ve": "Tshiko"
  },
  {
    "english": "Slide to see more",
    "zu": "Shelelezisa eceleni ukuze ubone konke",
    "st": "Thellela ka thoko ho bona tse ding",
    "ts": "Swayipela etlhelo ku vona swo tala",
    "ve": "Suvhani nga thungo u vhona zwiṅwe"
  },
  {
    "english": "SITE PLAN",
    "zu": "IPULANI YENDAWO",
    "st": "MORALO WA SEBAKA",
    "ts": "PULANI YA NDHAWU",
    "ve": "PULANE YA FHETHU"
  },
  {
    "english": "BUILT / PLANNED",
    "zu": "OKWAKHIWE / OKUHLELIWE",
    "st": "TSE HAHILWENG / TSE RERILWENG",
    "ts": "LESWI AKIWEKE / LESWI KUNGUHATIWEKE",
    "ve": "ZWO FHAṰWAHO / ZWO DZUDZANYWAHO"
  },
  {
    "english": "SUN · WIND · SLOPE",
    "zu": "ILANGA · UMOYA · UMTHAMBEKA",
    "st": "LETSATSI · MOYA · LETSOAPO",
    "ts": "DYAMBU · MOYA · MRHIMIWA",
    "ve": "ḒUVHA · MUYA · MUTSHEṰO"
  },
  {
    "english": "LITRES",
    "zu": "AMALITHA",
    "st": "DILITARA",
    "ts": "TILITARA",
    "ve": "LITHARA"
  },
  {
    "english": "SOIL",
    "zu": "UMHLABATHI",
    "st": "MOBU",
    "ts": "MISAVA",
    "ve": "MAVU"
  },
  {
    "english": "WEEKS",
    "zu": "AMASONTO",
    "st": "DIBEKE",
    "ts": "MAVHIKI",
    "ve": "VHEGE"
  },
  {
    "english": "Water",
    "zu": "Amanzi",
    "st": "Metsi",
    "ts": "Mati",
    "ve": "Maḓi"
  },
  {
    "english": "Earthworks & routes",
    "zu": "Imisebenzi yomhlaba nezindlela",
    "st": "Mosebetsi wa mobu le ditsela",
    "ts": "Mintirho ya misava ni tindlela",
    "ve": "Mishumo ya mavu na nḓila"
  },
  {
    "english": "Growing area",
    "zu": "Indawo yokutshala",
    "st": "Sebaka sa ho lema",
    "ts": "Ndhawu yo byala",
    "ve": "Fhethu ha u lima"
  },
  {
    "english": "Structures & planting",
    "zu": "Izakhiwo nokutshala",
    "st": "Meaho le ho lema",
    "ts": "Miako ni ku byala",
    "ve": "Zwifhaṱo na u zwala"
  },
  {
    "english": "existing",
    "zu": "okukhona",
    "st": "e seng e le teng",
    "ts": "lexi se xi nga kona",
    "ve": "tshi re hone"
  },
  {
    "english": "proposed",
    "zu": "okuhleliwe",
    "st": "e sisinngwang",
    "ts": "lexi ringanyetiwaka",
    "ve": "tsho dzinginywaho"
  },
  {
    "english": "mixed",
    "zu": "isimo esixubile",
    "st": "boemo bo tswakantsweng",
    "ts": "xiyimo lexi pfanganisiweke",
    "ve": "vhuimo ho ṱanganelanaho"
  },
  {
    "english": "No priced or measured values available",
    "zu": "Alukho ulwazi lwamanani noma lwezilinganiso olutholakalayo",
    "st": "Ha ho boleng bo nang le theko kapa bo lekantsweng bo fumanehang",
    "ts": "A ku na mimpimo leyi nga ni nxavo kumbe leyi pimiweke leyi kumekaka",
    "ve": "A hu na miṅwelo i re na mutengo kana yo elwaho i wanalaho"
  },
  {
    "english": "{remaining}% remaining",
    "zu": "Kusele {remaining}%",
    "st": "{remaining}% e setseng",
    "ts": "Ku sale {remaining}%",
    "ve": "Ho sala {remaining}%"
  },
  {
    "english": "first season only",
    "zu": "isizini yokuqala kuphela",
    "st": "sehla sa pele feela",
    "ts": "nguva yo sungula ntsena",
    "ve": "khalanwaha ya u thoma fhedzi"
  },
  {
    "english": "Other site space",
    "zu": "Enye indawo yesiza",
    "st": "Sebaka se seng sa setsha",
    "ts": "Ndhawu yin’wana ya setandi",
    "ve": "Vhuṅwe vhupo ha fhethu"
  },
  {
    "english": "The photograph is AI-generated. The layout is schematic, not to scale.",
    "zu": "Isithombe sikhiqizwe yi-AI. Ukuhlelwa kuwumdwebo wohlelo, akukalwa ngesikali.",
    "st": "Senepe se entswe ke AI. Tlhophiso ke setshwantsho sa moralo, ha e a takwa ka sekala.",
    "ts": "Xifaniso xi endliwile hi AI. Malongoloxelo i xikece xa pulani, a ma endliwanga hi xikalo.",
    "ve": "Tshinepe tsho itwa nga AI. Nzudzanyo ndi tshiketshe tsha pulane, a wo ngo olwa nga tshikalo."
  },
  {
    "english": "Vegetables + staple crops",
    "zu": "Imifino + izitshalo eziyisisekelo",
    "st": "Meroho + dijalo tsa motheo",
    "ts": "Matsavu + swibyariwa swa swakudya swa nkoka",
    "ve": "Miroho + zwiliṅwa zwa zwiḽiwa zwa ndeme"
  },
  {
    "english": "Harvest recorded",
    "zu": "Isivuno esibhaliwe",
    "st": "Kotulo e rekotilweng",
    "ts": "Ntshovelo lowu rhekhodiweke",
    "ve": "Khaṋo yo rekhodiwaho"
  },
  {
    "english": "Illustrative total; period unspecified",
    "zu": "Isamba sesibonelo; isikhathi asishiwongo",
    "st": "Kakaretso ya mohlala; nako ha e a bolelwa",
    "ts": "Nhlayo ya xikombiso; nkarhi a wu vuriwanga",
    "ve": "Ṱhanganyelo ya tsumbo; tshifhinga a tsho ngo bulwa"
  },
  {
    "english": "Adult participants",
    "zu": "Abahlanganyeli abadala",
    "st": "Bankakarolo ba baholo",
    "ts": "Vatekaxiave lavakulu",
    "ve": "Vhashelamulenzhe vha vhahulwane"
  },
  {
    "english": "Participant register",
    "zu": "Irejista yabahlanganyeli",
    "st": "Rejistara ya bankakarolo",
    "ts": "Rhejisitara ya vatekaxiave",
    "ve": "Rekhodo ya vhashelamulenzhe"
  },
  {
    "english": "Training progress",
    "zu": "Inqubekela-phambili yoqeqesho",
    "st": "Tswelopele ya thupelo",
    "ts": "Nhluvuko wa dyondzo",
    "ve": "Mvelaphanḓa ya vhugudisi"
  },
  {
    "english": "Illustrative programme progress",
    "zu": "Inqubekela-phambili yohlelo eyisibonelo",
    "st": "Tswelopele ya lenaneo ya mohlala",
    "ts": "Nhluvuko wa nongonoko wa xikombiso",
    "ve": "Mvelaphanḓa ya mbekanyamushumo ya tsumbo"
  },
  {
    "english": "How the site is used",
    "zu": "Indlela indawo esetshenziswa ngayo",
    "st": "Kamoo sebaka se sebediswang kateng",
    "ts": "Ndlela leyi ndhawu yi tirhisiwaka ha yona",
    "ve": "Nḓila ine fhethu ha shumiswa ngayo"
  },
  {
    "english": "area allocations. Other space includes buildings, access and trees; it is not all available for planting.",
    "zu": "ukwabiwa kwendawo. Enye indawo ifaka izakhiwo, izindlela zokungena nezihlahla; akuyona yonke etholakalayo yokutshala.",
    "st": "kabo ya sebaka. Sebaka se seng se kenyelletsa meaho, ditsela tsa ho kena le difate; ha se sohle se fumanehang bakeng sa ho lema.",
    "ts": "ku averiwa ka ndhawu. Ndhawu yin’wana yi katsa miako, tindlela to nghena ni mirhi; a hi yona hinkwaro leyi kumekaka ku byala.",
    "ve": "khovhekanyo ya fhethu. Vhuṅwe vhupo vhu katela zwifhaṱo, nḓila dza u swika na miri; a si hoṱhe hune ha wanala u zwala."
  },
  {
    "english": "Learning and participation",
    "zu": "Ukufunda nokubamba iqhaza",
    "st": "Ho ithuta le ho nka karolo",
    "ts": "Ku dyondza ni ku teka xiave",
    "ve": "U guda na u shela mulenzhe"
  },
  {
    "english": "{count} adult participants · Coordinator: {coordinator}. Training progress is not a measure of livelihood improvement.",
    "zu": "Abahlanganyeli abadala abangu-{count} · Umxhumanisi: {coordinator}. Inqubekela-phambili yoqeqesho ayisona isilinganiso sokuthuthuka kokuziphilisa.",
    "st": "Bankakarolo ba baholo ba {count} · Mohokahanyi: {coordinator}. Tswelopele ya thupelo ha se tekanyo ya ntlafatso ya mokgwa wa boiphediso.",
    "ts": "Vatekaxiave lavakulu va {count} · Muhlanganisi: {coordinator}. Nhluvuko wa dyondzo a hi mpimo wa ku antswa ka ndlela yo tihanyisa.",
    "ve": "Vhashelamulenzhe vha vhahulwane vha {count} · Mudzudzanyi: {coordinator}. Mvelaphanḓa ya vhugudisi a si muṅwelo wa u khwinifhala ha vhuḓitshidzi."
  },
  {
    "english": "Community garden",
    "zu": "Ingadi yomphakathi",
    "st": "Tshimo ya setjhaba",
    "ts": "Ntanga wa muganga",
    "ve": "Ngade ya tshitshavha"
  },
  {
    "english": "Crèche garden",
    "zu": "Ingadi yenkulisa",
    "st": "Tshimo ya kretjhe",
    "ts": "Ntanga wa khirexe",
    "ve": "Ngade ya khiretshi"
  },
  {
    "english": "School garden",
    "zu": "Ingadi yesikole",
    "st": "Tshimo ya sekolo",
    "ts": "Ntanga wa xikolo",
    "ve": "Ngade ya tshikolo"
  },
  {
    "english": "Homestead garden",
    "zu": "Ingadi yasekhaya",
    "st": "Tshimo ya lelapa",
    "ts": "Ntanga wa le kaya",
    "ve": "Ngade ya muḓi"
  },
  {
    "english": "Commercial garden",
    "zu": "Ingadi yezentengiselwano",
    "st": "Tshimo ya kgwebo",
    "ts": "Ntanga wa mabindzu",
    "ve": "Ngade ya bindu"
  },
  {
    "english": "Community food forest",
    "zu": "Ihlathi lokudla lomphakathi",
    "st": "Morung wa dijo wa setjhaba",
    "ts": "Khwati ra swakudya ra muganga",
    "ve": "Ḓaka ḽa zwiḽiwa ḽa tshitshavha"
  },
  {
    "english": "THIS SITE",
    "zu": "LE NDAWO",
    "st": "SEBAKA SENA",
    "ts": "NDHAWU LEYI",
    "ve": "FHETHU AFHA"
  },
  {
    "english": "HOW IT WORKS",
    "zu": "INDLELA OKUSEBENZA NGAYO",
    "st": "KAMOO E SEBETSANG KATENG",
    "ts": "NDLELA LESWI SWI TIRHAKA HA YONA",
    "ve": "NḒILA INE ZWA SHUMA NGAYO"
  },
  {
    "english": "VISUAL FIELD GUIDE",
    "zu": "UMHLAHLANDLELA WASENSIMINI NGEZITHOMBE",
    "st": "TATAISO YA TSHIMO KA DITSHWANTSHO",
    "ts": "NKONGOMISO WA NSIMU HI SWIFANISO",
    "ve": "NYENDEDZI YA TSIMU NGA ZWIFANYISO"
  },
  {
    "english": "Catalogue illustration: {name}",
    "zu": "Isithombe sekhathalogi: {name}",
    "st": "Setshwantsho sa khathaloko: {name}",
    "ts": "Xifaniso xa khathaloko: {name}",
    "ve": "Tshifanyiso tsha khathaḽogu: {name}"
  },
  {
    "english": "House",
    "zu": "Indlu",
    "st": "Ntlo",
    "ts": "Yindlu",
    "ve": "Nnḓu"
  },
  {
    "english": "Patio",
    "zu": "Isitubhi",
    "st": "Lebala le katilweng",
    "ts": "Xivava lexi andlariweke",
    "ve": "Muṱa wo adzwaho"
  },
  {
    "english": "Driveway",
    "zu": "Indlela yemoto",
    "st": "Tsela ya koloi",
    "ts": "Ndlela ya movha",
    "ve": "Nḓila ya moḓoro"
  },
  {
    "english": "Lawn",
    "zu": "Utshani",
    "st": "Jwang ba lebaleng",
    "ts": "Byanyi bya le rivaleni",
    "ve": "Hatsi ha muṱani"
  },
  {
    "english": "Veg garden",
    "zu": "Ingadi yemifino",
    "st": "Serapa sa meroho",
    "ts": "Ntanga wa matsavu",
    "ve": "Ngade ya miroho"
  },
  {
    "english": "Orchard",
    "zu": "Insimu yezithelo",
    "st": "Serapa sa difate tsa ditholwana",
    "ts": "Ntanga wa mirhi ya mihandzu",
    "ve": "Ngade ya miri ya mitshelo"
  },
  {
    "english": "Cleared ground",
    "zu": "Indawo evulekile",
    "st": "Mobu o hlekilweng",
    "ts": "Misava leyi basisiweke",
    "ve": "Mavu o kunakiswaho"
  },
  {
    "english": "Swale",
    "zu": "Umsele wokubamba amanzi",
    "st": "Foro e tshwarang metsi",
    "ts": "Nsele wo khoma mati",
    "ve": "Mugero wa u fara maḓi"
  },
  {
    "english": "Fence",
    "zu": "Uthango",
    "st": "Terata",
    "ts": "Rihlampfu",
    "ve": "Luhura"
  },
  {
    "english": "Path",
    "zu": "Indlela",
    "st": "Tsela",
    "ts": "Ndlela",
    "ve": "Nḓila"
  },
  {
    "english": "Bed path",
    "zu": "Indlela yemibhede",
    "st": "Tsela pakeng tsa dibethe",
    "ts": "Ndlela ya mibedo",
    "ve": "Nḓila ya mibethe"
  },
  {
    "english": "Water pipe",
    "zu": "Ipayipi lamanzi",
    "st": "Peipi ya metsi",
    "ts": "Phayiphi ya mati",
    "ve": "Bommbo ḽa maḓi"
  },
  {
    "english": "Drip line",
    "zu": "Ipayipi lokuconsa",
    "st": "Peipi e rothelang",
    "ts": "Phayiphi yo thonisa",
    "ve": "Bommbo ḽa u rothodza"
  },
  {
    "english": "Windbreak",
    "zu": "Isivikelo somoya",
    "st": "Sethibela moya",
    "ts": "Xisirhelelo xa moya",
    "ve": "Tshithivheli tsha muya"
  },
  {
    "english": "Greywater line",
    "zu": "Amanzi asetshenzisiwe",
    "st": "Peipi ya metsi a sebedisitsweng",
    "ts": "Phayiphi ya mati lama tirhisiweke",
    "ve": "Bommbo ḽa maḓi o shumiswaho"
  },
  {
    "english": "North",
    "zu": "INyakatho",
    "st": "Leboya",
    "ts": "N'walungu",
    "ve": "Devhula"
  },
  {
    "english": "Site boundary",
    "zu": "Umngcele wendawo",
    "st": "Moedi wa sebaka",
    "ts": "Ndzelekano wa ndhawu",
    "ve": "Mukanoni wa fhethu"
  },
  {
    "english": "Buildings",
    "zu": "Izakhiwo",
    "st": "Meaho",
    "ts": "Miako",
    "ve": "Zwifhaṱo"
  },
  {
    "english": "vegetable bed, numbered",
    "zu": "umbhede wemifino, unenombolo",
    "st": "bethe ya meroho, e nang le nomoro",
    "ts": "mbedo wa matsavu, lowu nga ni nomboro",
    "ve": "mbethe wa miroho, u na nomboro"
  },
  {
    "english": "vegetable beds, numbered",
    "zu": "imibhede yemifino, inezinombolo",
    "st": "dibethe tsa meroho, tse nang le dinomoro",
    "ts": "mibedo ya matsavu, leyi nga ni tinomboro",
    "ve": "mibethe ya miroho, i na nomboro"
  },
  {
    "english": "1 staple plot (P1)",
    "zu": "isiza esiyisisekelo esi-1 (P1)",
    "st": "tshimo e 1 ya dijalo tsa motheo (P1)",
    "ts": "nsimu ya swibyariwa swa nkoka ya 1 (P1)",
    "ve": "tsimu ya zwiliṅwa zwa ndeme ya 1 (P1)"
  },
  {
    "english": "tree or planting, to scale",
    "zu": "isihlahla noma isitshalo, ngesikali",
    "st": "sefate kapa semela, ka sekala",
    "ts": "murhi kumbe xibyariwa, hi xikalo",
    "ve": "muri kana tshimela, nga tshikalo"
  },
  {
    "english": "trees and plantings, to scale",
    "zu": "izihlahla nezitshalo, ngesikali",
    "st": "difate le dimela, ka sekala",
    "ts": "mirhi ni swibyariwa, hi xikalo",
    "ve": "miri na zwimela, nga tshikalo"
  },
  {
    "english": "water tank or water point",
    "zu": "ithangi noma indawo yamanzi",
    "st": "tanka kapa sebaka sa metsi",
    "ts": "thangi kumbe ndhawu ya mati",
    "ve": "thannga kana fhethu ha maḓi"
  },
  {
    "english": "water tanks and points",
    "zu": "amathangi nezindawo zamanzi",
    "st": "ditanka le dibaka tsa metsi",
    "ts": "tithangi ni tindhawu ta mati",
    "ve": "thannga na fhethu ha maḓi"
  },
  {
    "english": "Paving and driveway",
    "zu": "Indawo egandayiwe",
    "st": "Sebaka se katilweng le tsela ya koloi",
    "ts": "Ndhawu leyi andlariweke ni ndlela ya movha",
    "ve": "Fhethu ho adzwaho na nḓila ya moḓoro"
  },
  {
    "english": "Terrace bank",
    "zu": "Udonga lwethala",
    "st": "Leralla la terase",
    "ts": "Ribuwa ra theraso",
    "ve": "Luvhondo lwa therasi"
  },
  {
    "english": "structure",
    "zu": "isakhiwo esincane",
    "st": "moaho",
    "ts": "muako",
    "ve": "tshifhaṱo"
  },
  {
    "english": "structures",
    "zu": "izakhiwo ezincane",
    "st": "meaho",
    "ts": "miako",
    "ve": "zwifhaṱo"
  },
  {
    "english": "soil or earthworks item",
    "zu": "into yomhlabathi",
    "st": "ntho ya mobu kapa mosebetsi wa mobu",
    "ts": "nchumu wa misava kumbe wa ku tirha misava",
    "ve": "tshithu tsha mavu kana mushumo wa mavu"
  },
  {
    "english": "soil and earthworks items",
    "zu": "izinto zomhlabathi",
    "st": "dintho tsa mobu le mesebetsi ya mobu",
    "ts": "swilo swa misava ni mintirho ya misava",
    "ve": "zwithu zwa mavu na mishumo ya mavu"
  },
  {
    "english": "animal shelter",
    "zu": "indawo yezilwane",
    "st": "setshabelo sa diphoofolo",
    "ts": "vutumbelo bya swifuwo",
    "ve": "vhudzulo ha zwifuwo"
  },
  {
    "english": "animal shelters",
    "zu": "izindawo zezilwane",
    "st": "ditshabelo tsa diphoofolo",
    "ts": "vutumbelo bya swifuwo",
    "ve": "vhudzulo ha zwifuwo"
  },
  {
    "english": "gate or access item",
    "zu": "isango noma indlela",
    "st": "heke kapa ntho ya ho kena",
    "ts": "nyangwa kumbe nchumu wo nghena",
    "ve": "gethe kana tshithu tsha u dzhena"
  },
  {
    "english": "gates and access items",
    "zu": "amasango nezindlela",
    "st": "diheke le dintho tsa ho kena",
    "ts": "tinyangwa ni swilo swo nghena",
    "ve": "magethe na zwithu zwa u dzhena"
  },
  {
    "english": "Solid = already there.  Dashed outline = planned, not built yet.",
    "zu": "Okugcwele = sekukhona.  Umugqa onamachashaza = kuhleliwe, akukakhiwa.",
    "st": "E tletseng = e se e le teng.  Mola o kgaohileng = e rerilwe, ha e eso ahuwe.",
    "ts": "Leswi tatiweke = swi se swi kona.  Layini leyi tsemekeke = swi kunguhatiwile, a swi si akiwa.",
    "ve": "Zwo ḓadzwaho = zwi hone.  Mutalo wo ṱhukhukanywaho = zwo pulaniwa, a zwi athu fhaṱiwa."
  },
  {
    "english": "Dashed outlines: everything on this plan is planned, not built yet.",
    "zu": "Imigqa enamachashaza: konke okukuleli pulani kuhleliwe, akukakhiwa.",
    "st": "Mela e kgaohileng: tsohle tse polaneng ena di rerilwe, ha di eso ahuwe.",
    "ts": "Milayini leyi tsemekeke: swilo hinkwato eka pulani leyi swi kunguhatiwile, a swi si akiwa.",
    "ve": "Mitalo yo ṱhukhukanywaho: zwoṱhe kha pulane iyi zwo pulaniwa, a zwi athu fhaṱiwa."
  },
  {
    "english": "Plant codes",
    "zu": "Amakhodi ezitshalo",
    "st": "Dikhoutu tsa dimela",
    "ts": "Tikhodi ta swimilana",
    "ve": "Khoudu dza zwimela"
  },
  {
    "english": "Bed names",
    "zu": "Amagama emibhede",
    "st": "Mabitso a dibethe",
    "ts": "Mavito ya mibedo",
    "ve": "Madzina a mibethe"
  },
  {
    "english": "vegetable bed",
    "zu": "umbhede wemifino",
    "st": "bethe ya meroho",
    "ts": "mbedo wa matsavu",
    "ve": "mbethe wa miroho"
  },
  {
    "english": "vegetable beds",
    "zu": "imibhede yemifino",
    "st": "dibethe tsa meroho",
    "ts": "mibedo ya matsavu",
    "ve": "mibethe ya miroho"
  },
  {
    "english": "staple plot",
    "zu": "isiza esiyisisekelo",
    "st": "tshimo ya dijalo tsa motheo",
    "ts": "nsimu ya swibyariwa swa nkoka",
    "ve": "tsimu ya zwiliṅwa zwa ndeme"
  },
  {
    "english": "staple plots",
    "zu": "iziza eziyisisekelo",
    "st": "masimo a dijalo tsa motheo",
    "ts": "masimu ya swibyariwa swa nkoka",
    "ve": "tsimu dza zwiliṅwa zwa ndeme"
  },
  {
    "english": "tree or planting",
    "zu": "isihlahla",
    "st": "sefate kapa semela",
    "ts": "murhi kumbe xibyariwa",
    "ve": "muri kana tshimela"
  },
  {
    "english": "trees and plantings",
    "zu": "izihlahla nezitshalo",
    "st": "difate le dimela",
    "ts": "mirhi ni swibyariwa",
    "ve": "miri na zwimela"
  },
  {
    "english": "water item",
    "zu": "into yamanzi",
    "st": "ntho ya metsi",
    "ts": "nchumu wa mati",
    "ve": "tshithu tsha maḓi"
  },
  {
    "english": "water items",
    "zu": "izinto zamanzi",
    "st": "dintho tsa metsi",
    "ts": "swilo swa mati",
    "ve": "zwithu zwa maḓi"
  },
  {
    "english": "Site plan",
    "zu": "Ipulani lendawo",
    "st": "Polane ya sebaka",
    "ts": "Pulani ya ndhawu",
    "ve": "Pulane ya fhethu"
  },
  {
    "english": "Drawn to scale from the saved design.",
    "zu": "Kudwetshwe ngesikali kusuka kumklamo ogciniwe.",
    "st": "E takilwe ka sekala ho tswa moralong o bolokilweng.",
    "ts": "Yi dirowiwe hi xikalo ku suka eka dizayini leyi hlayisiweke.",
    "ve": "Yo oliwa nga tshikalo u bva kha dizaini yo vhulungwaho."
  },
  {
    "english": "North is up. ",
    "zu": "INyakatho iphezulu. ",
    "st": "Leboya le hodimo. ",
    "ts": "N'walungu yi le henhla. ",
    "ve": "Devhula hu nṱha. "
  },
  {
    "english": "Bed numbers match the bed list. ",
    "zu": "Izinombolo zemibhede ziyafana nezasohlwini lwemibhede. ",
    "st": "Dinomoro tsa dibethe di tshwana le tsa lenaneng. ",
    "ts": "Tinomboro ta mibedo ti fambisana ni nxaxamelo wa mibedo. ",
    "ve": "Nomboro dza mibethe dzi fana na mutevhe wa mibethe. "
  },
  {
    "english": "The boundary runs beyond this drawing, which closes in on the designed area. ",
    "zu": "Umngcele udlulela ngale kwalo mdwebo, osondele endaweni eklanyiwe. ",
    "st": "Moedi o fetela ka ntle ho setshwantsho sena, se bontshang sebaka se ralilweng haufi. ",
    "ts": "Ndzelekano wu hundza xifaniso lexi, lexi tshinelelaka ndhawu leyi dizayiniweke. ",
    "ve": "Mukanoni u fhira tshifanyiso itshi, tshi sendela tsini na fhethu ho dizainiwaho. "
  },
  {
    "english": "Very small items are drawn larger so they can be seen. ",
    "zu": "Izinto ezincane kakhulu zidwetshwe zaba zinkulu ukuze zibonakale. ",
    "st": "Dintho tse nyenyane haholo di takilwe di le kgolo hore di bonahale. ",
    "ts": "Swilo leswitsongo swinene swi dirowiwe swi ri swikulu leswaku swi vonaka. ",
    "ve": "Zwithu zwiṱuku vhukuma zwo oliwa zwi zwihulwane uri zwi vhonale. "
  },
  {
    "english": "It is not a land survey.",
    "zu": "Akusikho ukuhlolwa komhlaba.",
    "st": "Sena ha se tekanyo ya semmuso ya mobu.",
    "ts": "Leyi a hi mpimo wa ximfumo wa misava.",
    "ve": "Iyi a si pimo ya mavu ya tshiofisi."
  },
  {
    "english": "Saved design",
    "zu": "Umklamo ogciniwe",
    "st": "Moralo o bolokilweng",
    "ts": "Dizayini leyi hlayisiweke",
    "ve": "Dizaini yo vhulungwaho"
  },
  {
    "english": "; boundary and buildings as traced on the map",
    "zu": "; umngcele nezakhiwo njengoba kudwetshwe kumephu",
    "st": "; moedi le meaho jwalokaha di takilwe mmapeng",
    "ts": "; ndzelekano ni miako hi laha swi landzelerisiweke emepeni",
    "ve": "; mukanoni na zwifhaṱo sa zwo olelwa kha mapa"
  },
  {
    "english": "Site plan drawn from the saved design",
    "zu": "Ipulani lendawo elidwetshwe kumklamo ogciniwe",
    "st": "Polane ya sebaka e takilweng ho tswa moralong o bolokilweng",
    "ts": "Pulani ya ndhawu leyi dirowiweke ku suka eka dizayini leyi hlayisiweke",
    "ve": "Pulane ya fhethu yo oliwaho u bva kha dizaini yo vhulungwaho"
  },
  {
    "english": "Scale bar",
    "zu": "Isikali",
    "st": "Mola wa sekala",
    "ts": "Layini ya xikalo",
    "ve": "Mutalo wa tshikalo"
  },
  {
    "english": "Staple crop plots",
    "zu": "Iziza zezitshalo eziyisisekelo",
    "st": "Masimo a dijalo tsa motheo",
    "ts": "Masimu ya swibyariwa swa nkoka",
    "ve": "Tsimu dza zwiliṅwa zwa ndeme"
  },
  {
    "english": "Roof",
    "zu": "Uphahla",
    "st": "Marulelo",
    "ts": "Lwangu",
    "ve": "Ṱhanga"
  },
  {
    "english": "Everything else: paths, trees, yard, open ground",
    "zu": "Konke okunye: izindlela, izihlahla, igceke, umhlaba ovulekile",
    "st": "Tse ding tsohle: ditsela, difate, lebala, mobu o bulehileng",
    "ts": "Swilo leswin'wana: tindlela, mirhi, rivala, misava leyi pfulekeke",
    "ve": "Zwiṅwe zwoṱhe: nḓila, miri, muṱa, mavu o vuleaho"
  },
  {
    "english": "The whole site",
    "zu": "Indawo yonke",
    "st": "Sebaka sohle",
    "ts": "Ndhawu hinkwayo",
    "ve": "Fhethu hoṱhe"
  },
  {
    "english": "How the ground is used",
    "zu": "Ukuthi umhlaba usetshenziswa kanjani",
    "st": "Kamoo mobu o sebediswang kateng",
    "ts": "Ndlela leyi misava yi tirhisiwaka ha yona",
    "ve": "Nḓila ine mavu a shumiswa ngayo"
  },
  {
    "english": "Areas as drawn on the saved design and traced on the map, whether built yet or not. Trees, paths and tanks are not counted as areas.",
    "zu": "Izindawo njengoba zidwetshwe kumklamo ogciniwe nakumephu, noma sezakhiwe noma cha. Izihlahla, izindlela namathangi akubalwa njengezindawo.",
    "st": "Dibaka jwalokaha di takilwe moralong o bolokilweng le mmapeng, ho sa tsotellehe hore di se di ahuwe kapa tjhe. Difate, ditsela le ditanka ha di balwe e le dibaka.",
    "ts": "Tindhawu hi laha ti dirowiweke eka dizayini leyi hlayisiweke ni ku landzelerisiwa emepeni, hambi ti se ti akiwile kumbe a ti si akiwa. Mirhi, tindlela ni tithangi a swi hlayiwi tani hi tindhawu.",
    "ve": "Fhethu sa ho oliwa kha dizaini yo vhulungwaho na u olelwa kha mapa, naho ho no fhaṱiwa kana hu sa athu. Miri, nḓila na thannga a zwi vhaliwi sa vhupo."
  },
  {
    "english": "Boundary",
    "zu": "Umngcele",
    "st": "Moedi",
    "ts": "Ndzelekano",
    "ve": "Mukanoni"
  },
  {
    "english": "traced on the map",
    "zu": "udwetshwe kumephu",
    "st": "o takilweng mmapeng",
    "ts": "lowu landzelerisiweke emepeni",
    "ve": "wo olelwaho kha mapa"
  },
  {
    "english": "Beds and plots: saved design.",
    "zu": "Imibhede neziza: umklamo ogciniwe.",
    "st": "Dibethe le masimo: moralo o bolokilweng.",
    "ts": "Mibedo ni masimu: dizayini leyi hlayisiweke.",
    "ve": "Mibethe na tsimu: dizaini yo vhulungwaho."
  },
  {
    "english": "Land use",
    "zu": "Ukusetshenziswa komhlaba",
    "st": "Tshebediso ya mobu",
    "ts": "Matirhiselo ya misava",
    "ve": "U shumisa mavu"
  },
  {
    "english": "Trees and plants",
    "zu": "Izihlahla nezitshalo",
    "st": "Difate le dimela",
    "ts": "Mirhi ni swimilana",
    "ve": "Miri na zwimela"
  },
  {
    "english": "Structures",
    "zu": "Izakhiwo",
    "st": "Meaho",
    "ts": "Miako",
    "ve": "Zwifhaṱo"
  },
  {
    "english": "Earthworks",
    "zu": "Imisebenzi yomhlaba",
    "st": "Mosebetsi wa mobu",
    "ts": "Mintirho ya misava",
    "ve": "Mishumo ya mavu"
  },
  {
    "english": "Animals",
    "zu": "Izilwane",
    "st": "Diphoofolo",
    "ts": "Swifuwo",
    "ve": "Zwifuwo"
  },
  {
    "english": "Access",
    "zu": "Ukufinyelela",
    "st": "Ho kena",
    "ts": "Ku nghena",
    "ve": "U dzhena"
  },
  {
    "english": "Paths, swales and pipes",
    "zu": "Izindlela, imisele namapayipi",
    "st": "Ditsela, diforo tse tshwarang metsi le dipeipi",
    "ts": "Tindlela, misele yo khoma mati ni tiphayiphi",
    "ve": "Nḓila, migero ya u fara maḓi na bommbo"
  },
  {
    "english": "already there",
    "zu": "sekukhona",
    "st": "di se di le teng",
    "ts": "swi se swi kona",
    "ve": "zwi hone"
  },
  {
    "english": "still to build or plant",
    "zu": "kusazokwakhiwa noma kutshalwe",
    "st": "di sa ntse di tla ahuwa kapa ho lengwa",
    "ts": "swa ha fanele ku akiwa kumbe ku byariwa",
    "ve": "zwi kha ḓi tea u fhaṱiwa kana u ṱavhiwa"
  },
  {
    "english": "Already there",
    "zu": "Sekukhona",
    "st": "Di se di le teng",
    "ts": "Swi se swi kona",
    "ve": "Zwi hone"
  },
  {
    "english": "Planned, not built or planted yet",
    "zu": "Kuhleliwe, akukakhiwa noma kutshalwe",
    "st": "Di rerilwe, ha di eso ahuwe kapa ho lengwa",
    "ts": "Swi kunguhatiwile, a swi si akiwa kumbe ku byariwa",
    "ve": "Zwo pulaniwa, a zwi athu fhaṱiwa kana u ṱavhiwa"
  },
  {
    "english": "Numbers: there now / total",
    "zu": "Izinombolo: okukhona manje / isamba",
    "st": "Dinomoro: tse teng jwale / kaofela",
    "ts": "Tinomboro: leswi nga kona sweswi / ntsengo",
    "ve": "Nomboro: zwi re hone zwino / ṱhanganyelo"
  },
  {
    "english": "Built, and still to build",
    "zu": "Okwakhiwe, nokusazokwakhiwa",
    "st": "Tse ahilweng le tse sa ntseng di tla ahuwa",
    "ts": "Leswi akiweke ni leswi swa ha faneleke ku akiwa",
    "ve": "Zwo fhaṱiwaho na zwi sa athu fhaṱiwa"
  },
  {
    "english": "One mark for each thing on the saved design, as it was marked there. Change an item to \"existing\" in the Design Studio once it is in the ground.",
    "zu": "Uphawu olulodwa lwento ngayinye esemklamweni ogciniwe, njengoba yaphawulwa khona. Shintsha into ibe \"ekhona\" ku-Design Studio uma isisemhlabathini.",
    "st": "Letshwao le le leng bakeng sa ntho ka nngwe moralong o bolokilweng, jwalokaha e tshwailwe teng. Fetola ntho hore e be \"e seng e le teng\" ho Design Studio hang ha e se e le mobung.",
    "ts": "Mfungho wun'we wa xilo xin'wana ni xin'wana eka dizayini leyi hlayisiweke, hi laha xi funghiweke kona. Cinca xilo xi va \"lexi se xi nga kona\" eka Design Studio loko se xi ri ehansi.",
    "ve": "Luswayo luthihi lwa tshithu tshiṅwe na tshiṅwe kha dizaini yo vhulungwaho, sa tsho swaiwa hone. Shandulani tshithu tshi vhe \"tshi re hone\" kha Design Studio musi tshi no vha mavuni."
  },
  {
    "english": "Built and planned",
    "zu": "Okwakhiwe nokuhleliwe",
    "st": "Tse ahilweng le tse rerilweng",
    "ts": "Leswi akiweke ni leswi kunguhatiweke",
    "ve": "Zwo fhaṱiwaho na zwo pulaniwaho"
  },
  {
    "english": "The design has changed since this report was written. This picture shows the design as it is today.",
    "zu": "Umklamo ushintshile selokhu kwabhalwa lo mbiko. Lesi sithombe sikhombisa umklamo njengoba unjalo namuhla.",
    "st": "Moralo o fetohile ho tloha ha tlaleho ena e ngolwa. Setshwantsho sena se bontsha moralo kamoo o leng kateng kajeno.",
    "ts": "Dizayini yi cincile ku sukela loko xiviko lexi xi tsariwile. Xifaniso lexi xi komba dizayini hi laha yi nga xiswona namuntlha.",
    "ve": "Dizaini yo shanduka u bva tshee muvhigo uyu wa ṅwalwa. Tshifanyiso itshi tshi sumbedza dizaini sa zwine ya vha zwone ṋamusi."
  },
  {
    "english": "{count} staple plots (P1–P{count})",
    "zu": "iziza eziyisisekelo ezi-{count} (P1–P{count})",
    "st": "masimo a {count} a dijalo tsa motheo (P1–P{count})",
    "ts": "masimu ya {count} ya swibyariwa swa nkoka (P1–P{count})",
    "ve": "tsimu dza {count} dza zwiliṅwa zwa ndeme (P1–P{count})"
  },
  {
    "english": "JoJo Tank 1000L",
    "zu": "Ithangi le-JoJo 1000L",
    "st": "Tanka ya JoJo 1000L",
    "ts": "Thangi ya JoJo 1000L",
    "ve": "Thannga ya JoJo 1000L"
  },
  {
    "english": "JoJo Tank 2500L",
    "zu": "Ithangi le-JoJo 2500L",
    "st": "Tanka ya JoJo 2500L",
    "ts": "Thangi ya JoJo 2500L",
    "ve": "Thannga ya JoJo 2500L"
  },
  {
    "english": "JoJo Tank 5000L",
    "zu": "Ithangi le-JoJo 5000L",
    "st": "Tanka ya JoJo 5000L",
    "ts": "Thangi ya JoJo 5000L",
    "ve": "Thannga ya JoJo 5000L"
  },
  {
    "english": "JoJo Tank 10000L",
    "zu": "Ithangi le-JoJo 10000L",
    "st": "Tanka ya JoJo 10000L",
    "ts": "Thangi ya JoJo 10000L",
    "ve": "Thannga ya JoJo 10000L"
  },
  {
    "english": "Rain Barrel",
    "zu": "Umgqomo wamanzi emvula",
    "st": "Moqomo wa metsi a pula",
    "ts": "Barele ya mati ya mpfula",
    "ve": "Dziramu ḽa maḓi a mvula"
  },
  {
    "english": "Small Pond",
    "zu": "Ichibi elincane",
    "st": "Letangwana le lenyane",
    "ts": "Xidzivana",
    "ve": "Tivha ḽiṱuku"
  },
  {
    "english": "Farm Dam",
    "zu": "Idamu lepulazi",
    "st": "Letamo la polasi",
    "ts": "Damu ra purasi",
    "ve": "Damu ḽa bulasi"
  },
  {
    "english": "Borehole",
    "zu": "Umthombo ombiwe",
    "st": "Sediba se tjhekilweng",
    "ts": "Xihlovo lexi ceriweke",
    "ve": "Tshisima tsho bwiwaho"
  },
  {
    "english": "Tap Point",
    "zu": "Indawo kampompi",
    "st": "Sebaka sa pompo",
    "ts": "Ndhawu ya pompi",
    "ve": "Fhethu ha bommbi"
  },
  {
    "english": "Water Trough",
    "zu": "Umkhombe wamanzi",
    "st": "Sejelwana sa metsi",
    "ts": "Xidjelwana xa mati",
    "ve": "Tshidyiwelo tsha maḓi"
  },
  {
    "english": "First-Flush Filter",
    "zu": "Isisefo samanzi okuqala emvula",
    "st": "Sefe ya metsi a pula a pele",
    "ts": "Xisefo xa mati yo sungula ya mpfula",
    "ve": "Tshisefo tsha maḓi a u thoma a mvula"
  },
  {
    "english": "Pump & Filter",
    "zu": "Iphampu nesisefo",
    "st": "Pompo le sefe",
    "ts": "Pompi ni xisefo",
    "ve": "Bommbi na tshisefo"
  },
  {
    "english": "Greywater Basin",
    "zu": "Umcengezi wamanzi asetshenzisiwe",
    "st": "Sekoti sa metsi a sebedisitsweng",
    "ts": "Xibya xa mati lama tirhisiweke",
    "ve": "Tshidzivha tsha maḓi o shumiswaho"
  },
  {
    "english": "Greywater Outlet",
    "zu": "Indawo yokuphuma kwamanzi asetshenzisiwe",
    "st": "Moo metsi a sebedisitsweng a tswang",
    "ts": "Ndhawu yo humesa mati lama tirhisiweke",
    "ve": "Fhethu ha u bvisa maḓi o shumiswaho"
  },
  {
    "english": "Greywater Diverter & Filter",
    "zu": "Isiphambukisi nesisefo samanzi asetshenzisiwe",
    "st": "Se kgelosang metsi a sebedisitsweng le sefe",
    "ts": "Xihambukisi ni xisefo xa mati lama tirhisiweke",
    "ve": "Tshifhambudzi na tshisefo tsha maḓi o shumiswaho"
  },
  {
    "english": "Infiltration Basin",
    "zu": "Umgodi wokungenisa amanzi emhlabathini",
    "st": "Sekoti se kenyang metsi mobung",
    "ts": "Nkova wo nghenisa mati emisaveni",
    "ve": "Tshidzivha tsha u nweledza maḓi mavuni"
  },
  {
    "english": "Half-moon",
    "zu": "Umgodi oyisigamu senyanga",
    "st": "Sekoti sa sebopeho sa halofo ya kgwedi",
    "ts": "Nkova wa xivumbeko xa hafu ya n'weti",
    "ve": "Tshidzivha tsha tshivhumbeo tsha hafu ya ṅwedzi"
  },
  {
    "english": "Berm / Contour Bank",
    "zu": "Indunduma / udonga olulandela ukuphakama okufanayo",
    "st": "Tutudu / leralla le latelang bophahamo bo lekanang",
    "ts": "Xirhendzevutana xa misava / ribuwa leri landzelaka ku tlakuka loku ringanaka",
    "ve": "Tshikwara tsha mavu / luvhondo lu tevhelaho vhunṱha vhu eḓanaho"
  },
  {
    "english": "Terrace / Retaining Bank",
    "zu": "Ithala / udonga olubamba umhlabathi",
    "st": "Terase / leralla le tshwarang mobu",
    "ts": "Theraso / ribuwa ro khoma misava",
    "ve": "Therasi / luvhondo lwa u fara mavu"
  },
  {
    "english": "Shed",
    "zu": "Ishede",
    "st": "Shedi",
    "ts": "Xidladla",
    "ve": "Tshitumba"
  },
  {
    "english": "Polytunnel",
    "zu": "Umhubhe wepulasitiki",
    "st": "Tonela ya polasetiki",
    "ts": "Thanele ya pulasitiki",
    "ve": "Thanele ya puḽasiṱiki"
  },
  {
    "english": "Shade Tunnel",
    "zu": "Umhubhe womthunzi",
    "st": "Tonela ya moriti",
    "ts": "Thanele ya ndzhuti",
    "ve": "Thanele ya murunzi"
  },
  {
    "english": "Chicken Coop",
    "zu": "Ihhoko lezinkukhu",
    "st": "Lesaka la dikgoho",
    "ts": "Xihoko xa tihuku",
    "ve": "Tshitumba tsha khuhu"
  },
  {
    "english": "Chicken Tractor",
    "zu": "Ihhoko lezinkukhu elihambayo",
    "st": "Lesaka la dikgoho le tsamaiswang",
    "ts": "Xihoko xa tihuku lexi fambisiwaka",
    "ve": "Tshitumba tsha khuhu tshi tshimbidzwaho"
  },
  {
    "english": "Kraal",
    "zu": "Isibaya",
    "st": "Lesaka",
    "ts": "Xivala",
    "ve": "Danga"
  },
  {
    "english": "Compost Bay (3-bin)",
    "zu": "Indawo yomquba (izigqoko ezi-3)",
    "st": "Sebaka sa mosuela (dikamore tse 3)",
    "ts": "Ndhawu ya manyoro (swibya swa 3)",
    "ve": "Fhethu ha manyoro (mabogisi a 3)"
  },
  {
    "english": "Worm Farm",
    "zu": "Indawo yokufuya izikelemu",
    "st": "Sebaka sa ho rua diboko",
    "ts": "Ndhawu yo fuwa swivungu",
    "ve": "Fhethu ha u fuwa zwivhungu"
  },
  {
    "english": "Nursery Table",
    "zu": "Itafula lenkulisa yezitshalo",
    "st": "Tafole ya sethopo",
    "ts": "Tafula ya ndhawu ya swithombana",
    "ve": "Ṱafula ya zwiraba zwa zwimela"
  },
  {
    "english": "Playground",
    "zu": "Indawo yokudlala",
    "st": "Lebala la dipapadi",
    "ts": "Rivala ro tlangela",
    "ve": "Fhethu ha u tambela"
  },
  {
    "english": "Market Stall",
    "zu": "Itafula lasemakethe",
    "st": "Tafole ya mmaraka",
    "ts": "Tafula ya makete",
    "ve": "Ṱafula ya makete"
  },
  {
    "english": "Other water thing",
    "zu": "Enye into yamanzi",
    "st": "Ntho e nngwe ya metsi",
    "ts": "Nchumu wun'wana wa mati",
    "ve": "Tshiṅwe tshithu tsha maḓi"
  },
  {
    "english": "Other structure",
    "zu": "Esinye isakhiwo",
    "st": "Moaho o mong",
    "ts": "Muako wun'wana",
    "ve": "Tshiṅwe tshifhaṱo"
  },
  {
    "english": "Beehive",
    "zu": "Isidleke sezinyosi",
    "st": "Ntlo ya dinotshi",
    "ts": "Yindlu ya tinyoxi",
    "ve": "Lukoro lwa ṋotshi"
  },
  {
    "english": "Goat Pen",
    "zu": "Isibaya sezimbuzi",
    "st": "Lesaka la dipodi",
    "ts": "Xivala xa timbuti",
    "ve": "Danga ḽa mbudzi"
  },
  {
    "english": "Pig Pen",
    "zu": "Isibaya sezingulube",
    "st": "Lesaka la dikolobe",
    "ts": "Xivala xa tinguluve",
    "ve": "Danga ḽa nguluvhe"
  },
  {
    "english": "Duck Pond",
    "zu": "Ichibi lamadada",
    "st": "Letangwana la matata",
    "ts": "Xidziva xa masekwa",
    "ve": "Tivha ḽa masekwa"
  },
  {
    "english": "Rabbit Hutch",
    "zu": "Ihhoko lonogwaja",
    "st": "Lesaka la mebutlanyana",
    "ts": "Xihoko xa mimpfundla",
    "ve": "Tshitumba tsha mivhuḓa"
  },
  {
    "english": "Livestock Trough",
    "zu": "Umkhombe wamanzi emfuyo",
    "st": "Sejelwana sa metsi a diphoofolo",
    "ts": "Xidjelwana xa mati ya swifuwo",
    "ve": "Tshidyiwelo tsha maḓi a zwifuwo"
  },
  {
    "english": "Biodigester",
    "zu": "Isitsha sokubolisa esikhiqiza igesi",
    "st": "Tanka e hlahisang gase ka ho bodisa",
    "ts": "Thangi yo virisa thyaka ku humesa gasi",
    "ve": "Thannga ya u vhivhisa tshika u bvisa gese"
  },
  {
    "english": "Shade Sail",
    "zu": "Indwangu yomthunzi",
    "st": "Lesela la moriti",
    "ts": "Lapi ra ndzhuti",
    "ve": "Labi ḽa murunzi"
  },
  {
    "english": "Gate",
    "zu": "Isango",
    "st": "Heke",
    "ts": "Nyangwa",
    "ve": "Gethe"
  },
  {
    "english": "Bench",
    "zu": "Ibhentshi",
    "st": "Benche",
    "ts": "Bence",
    "ve": "Bannga"
  },
  {
    "english": "Sign",
    "zu": "Ibhodi lophawu",
    "st": "Letshwao",
    "ts": "Bodo ya mfungho",
    "ve": "Bodo ya luswayo"
  },
  {
    "english": "Ground Solar Panel",
    "zu": "Iphaneli yelanga esemhlabathini",
    "st": "Phanele ya letsatsi e fatshe",
    "ts": "Phanele ya dyambu ya le hansi",
    "ve": "Phanele ya ḓuvha ya fhasi"
  },
  {
    "english": "Washing Line",
    "zu": "Intambo yokweneka izingubo",
    "st": "Thapo ya ho aneha diaparo",
    "ts": "Ntambhu yo aneka swiambalo",
    "ve": "Muḓali wa u anea zwiambaro"
  },
  {
    "english": "of rain in an average year",
    "zu": "yemvula ngonyaka ojwayelekile",
    "st": "ya pula ka selemo se tlwaelehileng",
    "ts": "ya mpfula hi lembe ra ntolovelo",
    "ve": "ya mvula nga ṅwaha wo ḓoweleaho"
  },
  {
    "english": "Wettest month",
    "zu": "Inyanga enemvula kakhulu",
    "st": "Kgwedi e nang le pula e ngata ka ho fetisisa",
    "ts": "N'weti lowu nga ni mpfula yo tala swinene",
    "ve": "Ṅwedzi u re na mvula nnzhi vhukuma"
  },
  {
    "english": "Driest month",
    "zu": "Inyanga eyome kakhulu",
    "st": "Kgwedi e ommeng ka ho fetisisa",
    "ts": "N'weti lowu omeke swinene",
    "ve": "Ṅwedzi wo oma vhukuma"
  },
  {
    "english": "Wet season",
    "zu": "Isikhathi semvula",
    "st": "Sehla sa pula",
    "ts": "Nguva ya timpfula",
    "ve": "Khalanwaha ya mvula"
  },
  {
    "english": "Dry season",
    "zu": "Isikhathi sesomiso",
    "st": "Sehla sa komello",
    "ts": "Nguva yo oma",
    "ve": "Khalanwaha ya gomelelo"
  },
  {
    "english": "Average temperature each month (°C)",
    "zu": "Izinga lokushisa elijwayelekile ngenyanga (°C)",
    "st": "Mocheso o tlwaelehileng kgwedi le kgwedi (°C)",
    "ts": "Mahiselo ya ntolovelo n'weti wun'wana ni wun'wana (°C)",
    "ve": "Tshikalo tsha mufhiso tsho ḓoweleaho ṅwedzi muṅwe na muṅwe (°C)"
  },
  {
    "english": "Warmest month",
    "zu": "Inyanga efudumele kakhulu",
    "st": "Kgwedi e futhumetseng ka ho fetisisa",
    "ts": "N'weti lowu hisaka swinene",
    "ve": "Ṅwedzi u fhisaho vhukuma"
  },
  {
    "english": "coolest",
    "zu": "ebanda kakhulu",
    "st": "e batang ka ho fetisisa",
    "ts": "lowu titimelaka swinene",
    "ve": "u rotholesaho vhukuma"
  },
  {
    "english": "Rain and warmth through the year",
    "zu": "Imvula nokufudumala phakathi nonyaka",
    "st": "Pula le mofuthu ho pholletsa le selemo",
    "ts": "Mpfula ni ku kufumela lembe hinkwaro",
    "ve": "Mvula na mufhiso kha ṅwaha woṱhe"
  },
  {
    "english": "Long-term monthly averages for this location, not a forecast. Any one year can be much wetter or much drier than this.",
    "zu": "Izilinganiso zesikhathi eside zale ndawo, akusona isibikezelo. Noma yimuphi unyaka ungaba nemvula eningi noma ube womile kakhulu kunalokhu.",
    "st": "Dipalohare tsa kgwedi ka nako e telele bakeng sa sebaka sena, ha se ponelopele. Selemo sefe kapa sefe se ka ba le pula e ngata haholo kapa sa oma haholo ho feta sena.",
    "ts": "Swiringaniso swa n'weti swa nkarhi wo leha swa ndhawu leyi, a hi mvhumbo wa maxelo. Lembe rin'wana ni rin'wana ri nga va ni mpfula yo tala kumbe ra oma swinene ku feta leswi.",
    "ve": "Ndinganyelo dza ṅwedzi dza tshifhinga tshilapfu dza fhethu afha, a si mbonelaphanḓa. Ṅwaha muṅwe na muṅwe u nga vha na mvula nnzhi kana wa oma vhukuma u fhira izwi."
  },
  {
    "english": "Rain by month",
    "zu": "Imvula ngenyanga",
    "st": "Pula ka kgwedi",
    "ts": "Mpfula hi n'weti",
    "ve": "Mvula nga ṅwedzi"
  },
  {
    "english": "a year",
    "zu": "ngonyaka",
    "st": "ka selemo",
    "ts": "hi lembe",
    "ve": "nga ṅwaha"
  },
  {
    "english": "wettest",
    "zu": "enemvula kakhulu",
    "st": "e nang le pula e ngata ka ho fetisisa",
    "ts": "lowu nga ni mpfula yo tala swinene",
    "ve": "u re na mvula nnzhi vhukuma"
  },
  {
    "english": "driest",
    "zu": "eyome kakhulu",
    "st": "e ommeng ka ho fetisisa",
    "ts": "lowu omeke swinene",
    "ve": "wo oma vhukuma"
  },
  {
    "english": "This roof can catch",
    "zu": "Lolu phahla lungabamba",
    "st": "Marulelo ana a ka tshwara",
    "ts": "Lwangu leri ri nga khoma",
    "ve": "Ṱhanga iyi i nga fara"
  },
  {
    "english": "in an average year",
    "zu": "ngonyaka ojwayelekile",
    "st": "ka selemo se tlwaelehileng",
    "ts": "hi lembe ra ntolovelo",
    "ve": "nga ṅwaha wo ḓoweleaho"
  },
  {
    "english": "of traced roof",
    "zu": "yophahla oludwetshiwe",
    "st": "ya marulelo a takilweng mmapeng",
    "ts": "ya lwangu leri landzelerisiweke emepeni",
    "ve": "ya ṱhanga yo olelwaho kha mapa"
  },
  {
    "english": "of rain",
    "zu": "yemvula",
    "st": "ya pula",
    "ts": "ya mpfula",
    "ve": "ya mvula"
  },
  {
    "english": "the rest is lost to splash and the first dirty flush",
    "zu": "okunye kulahleka ngokuchaphazela nangamanzi okuqala angcolile",
    "st": "a mang a lahleha ha a qaphalaka le ha metsi a pele a ditshila a tloswa",
    "ts": "laman'wana ma lahleka hi ku hangalaka ni mati yo sungula lama thyakeke",
    "ve": "maṅwe a xela nga u phaphaḓela na maḓi a u thoma o tshikafhalaho"
  },
  {
    "english": "litres",
    "zu": "amalitha",
    "st": "dilitara",
    "ts": "tilitara",
    "ve": "ḽithara"
  },
  {
    "english": "Rain the roof catches that month",
    "zu": "Imvula ebanjwa uphahla ngaleyo nyanga",
    "st": "Pula eo marulelo a e tshwarang kgweding eo",
    "ts": "Mpfula leyi lwangu ri yi khomaka hi n'weti wolowo",
    "ve": "Mvula ine ṱhanga ya i fara nga ṅwedzi wonoyo"
  },
  {
    "english": "Water used that month",
    "zu": "Amanzi asetshenziswa ngaleyo nyanga",
    "st": "Metsi a sebediswang kgweding eo",
    "ts": "Mati lama tirhisiwaka hi n'weti wolowo",
    "ve": "Maḓi a shumiswaho nga ṅwedzi wonoyo"
  },
  {
    "english": "a day",
    "zu": "ngosuku",
    "st": "ka letsatsi",
    "ts": "hi siku",
    "ve": "nga ḓuvha"
  },
  {
    "english": "Short: must come from the tank or another source",
    "zu": "Ukushoda: kumele kuvele ethangini noma komunye umthombo",
    "st": "Kgaello: metsi a tlameha ho tswa tankeng kapa mohloding o mong",
    "ts": "Kuna ku kayivela: mati ma fanele ku huma ethangini kumbe eka xihlovo xin'wana",
    "ve": "Ṱhahelelo: maḓi a tea u bva kha thannga kana tshiṅwe tshiko"
  },
  {
    "english": "Tank storage",
    "zu": "Isitoreji samathangi",
    "st": "Polokelo ya ditanka",
    "ts": "Vuhlayiselo bya tithangi",
    "ve": "Vhugalelo ha thannga"
  },
  {
    "english": "On the plan",
    "zu": "Kupulani",
    "st": "Polaneng",
    "ts": "Eka pulani",
    "ve": "Kha pulane"
  },
  {
    "english": "already installed",
    "zu": "sekufakiwe",
    "st": "e se e kentswe",
    "ts": "se swi nghenisiwile",
    "ve": "yo no dzheniswa"
  },
  {
    "english": "planned, not installed yet",
    "zu": "kuhleliwe, akukafakwa",
    "st": "e rerilwe, ha e eso kenngwe",
    "ts": "swi kunguhatiwile, a swi si nghenisiwa",
    "ve": "yo pulaniwa, a i athu dzheniswa"
  },
  {
    "english": "tank of unknown size, not counted",
    "zu": "ithangi elingaziwa usayizi, alibalwanga",
    "st": "tanka ya boholo bo sa tsejweng, ha e a balwa",
    "ts": "thangi ya mpimo lowu nga tivekiki, a yi hlayiwanga",
    "ve": "thannga ya saizi i sa ḓivhei, a yo ngo vhalwa"
  },
  {
    "english": "Needed to carry this use through the dry months (Tank Calculator)",
    "zu": "Okudingekayo ukuze kudlule izinyanga ezomile (Isibali Sethangi)",
    "st": "E hlokahalang ho tshehetsa tshebediso ena dikgweding tse ommeng (Sebadi sa Tanka)",
    "ts": "Leswi lavekaka ku fikelela matirhiselo lawa etin'wetini to oma (Xikhalikhuleyita xa Thangi)",
    "ve": "Zwine zwa ṱoḓea u swikelela u shumisa uhu kha miṅwedzi yo oma (Tshikhalikhuḽeitha tsha Thannga)"
  },
  {
    "english": "Daily water use has not been recorded for this site, so this figure cannot show which months run short. Add it in the Design Studio, Water step.",
    "zu": "Ukusetshenziswa kwamanzi kwansuku zonke akukaqoshwa kule ndawo, ngakho lo mdwebo awukwazi ukukhombisa izinyanga ezishodayo. Kufake ku-Design Studio, isinyathelo Samanzi.",
    "st": "Tshebediso ya metsi ka letsatsi ha e eso ngolwe bakeng sa sebaka sena, kahoo setshwantsho sena se ke ke sa bontsha dikgwedi tse nang le kgaello. E kenye ho Design Studio, mohatong wa Metsi.",
    "ts": "Matirhiselo ya mati ya siku na siku a ma si rhekhodiwa eka ndhawu leyi, kutani xifaniso lexi a xi koti ku komba tin'weti leti kayivelaka. Ma engetele eka Design Studio, eka goza ra Mati.",
    "ve": "U shumiswa ha maḓi nga ḓuvha a hu athu rekhodiwa kha fhethu afha, ngauralo tshifanyiso itshi a tshi koni u sumbedza miṅwedzi i re na ṱhahelelo. Zwi dzheniseni kha Design Studio, kha ḽiga ḽa Maḓi."
  },
  {
    "english": "The roof catches less than is used in",
    "zu": "Uphahla lubamba okuncane kunalokho okusetshenziswayo ngo",
    "st": "Marulelo a tshwara metsi a ka tlase ho a sebediswang ka",
    "ts": "Lwangu ri khoma mati matsongo ku ya hi lama tirhisiwaka hi",
    "ve": "Ṱhanga i fara maḓi maṱuku u fhira a shumiswaho nga"
  },
  {
    "english": "Over the longest dry run the gap adds up to",
    "zu": "Esikhathini eside esomile igebe lifinyelela ku",
    "st": "Nakong e telele ka ho fetisisa ya komello kgaello e fihla ho",
    "ts": "Eka nkarhi wo leha swinene wo oma ku kayivela ku hlanganela eka",
    "ve": "Kha tshifhinga tshilapfu vhukuma tsho oma ṱhahelelo i ṱangana ya vha"
  },
  {
    "english": "Over the whole year this roof catches less than the site uses. A bigger tank helps, but more roof or another water source is needed to close the gap.",
    "zu": "Ngonyaka wonke lolu phahla lubamba okuncane kunalokho okusetshenziswa indawo. Ithangi elikhulu liyasiza, kodwa kudingeka uphahla olwengeziwe noma omunye umthombo wamanzi.",
    "st": "Selemo sohle marulelo ana a tshwara metsi a ka tlase ho a sebediswang sebakeng sena. Tanka e kgolo e a thusa, empa ho hlokahala marulelo a mang kapa mohlodi o mong wa metsi ho tlatsa kgaello.",
    "ts": "Lembe hinkwaro lwangu leri ri khoma mati matsongo ku ya hi lama ndhawu yi ma tirhisaka. Thangi leyikulu ya pfuna, kambe ku laveka lwangu lerikulu kumbe xihlovo xin'wana xa mati ku siva ku kayivela.",
    "ve": "Kha ṅwaha woṱhe ṱhanga iyi i fara maḓi maṱuku u fhira ane fhethu ha a shumisa. Thannga khulwane i a thusa, fhedzi hu ṱoḓea ṱhanga nnzhi kana tshiṅwe tshiko tsha maḓi u vala ṱhahelelo."
  },
  {
    "english": "In an average year the roof catches more than is used in every month.",
    "zu": "Ngonyaka ojwayelekile uphahla lubamba okungaphezu kwalokho okusetshenziswayo nyanga zonke.",
    "st": "Ka selemo se tlwaelehileng marulelo a tshwara metsi a fetang a sebediswang kgwedi le kgwedi.",
    "ts": "Hi lembe ra ntolovelo lwangu ri khoma mati yo tala ku feta lama tirhisiwaka eka n'weti wun'wana ni wun'wana.",
    "ve": "Nga ṅwaha wo ḓoweleaho ṱhanga i fara maḓi manzhi u fhira a shumiswaho nga ṅwedzi muṅwe na muṅwe."
  },
  {
    "english": "Roof water: what comes in and what goes out",
    "zu": "Amanzi ophahla: okungenayo nokuphumayo",
    "st": "Metsi a marulelo: a kenang le a tswang",
    "ts": "Mati ya lwangu: lama nghenaka ni lama humaka",
    "ve": "Maḓi a ṱhanga: a dzhenaho na a bvaho"
  },
  {
    "english": "Average-year arithmetic, not a promise of rain. It counts only the roof that has been traced and only the tanks drawn on the plan; it says nothing about whether the water is safe to drink.",
    "zu": "Izibalo zonyaka ojwayelekile, akusona isithembiso semvula. Kubalwa kuphela uphahla oludwetshiwe namathangi asepulanini; akusho lutho ngokuphepha kwamanzi okuphuzwa.",
    "st": "Dipalo tsa selemo se tlwaelehileng, ha se tshepiso ya pula. Ho balwa feela marulelo a takilweng mmapeng le ditanka tse takilweng polaneng; ha ho bolelwe hore metsi a bolokehile ho ka nowa.",
    "ts": "I tinhlayo ta lembe ra ntolovelo, a hi xitshembiso xa mpfula. Ku hlayiwa ntsena lwangu leri landzelerisiweke emepeni ni tithangi leti dirowiweke eka pulani; a swi vuli leswaku mati ma hlayisekile ku ma nwa.",
    "ve": "Ndi mbalo dza ṅwaha wo ḓoweleaho, a si fulufhedziso ḽa mvula. Hu vhaliwa fhedzi ṱhanga yo olelwaho na thannga dzo oliwaho kha pulane; a zwi ambi tshithu nga ha uri maḓi o tsireledzea u a nwa."
  },
  {
    "english": "traced area",
    "zu": "indawo edwetshiwe",
    "st": "sebaka se takilweng mmapeng",
    "ts": "ndhawu leyi landzelerisiweke emepeni",
    "ve": "vhupo ho olelwaho kha mapa"
  },
  {
    "english": "Rain",
    "zu": "Imvula",
    "st": "Pula",
    "ts": "Mpfula",
    "ve": "Mvula"
  },
  {
    "english": "Daily use: as recorded in the Design Studio.",
    "zu": "Ukusetshenziswa kwansuku zonke: njengoba kuqoshwe ku-Design Studio.",
    "st": "Tshebediso ya letsatsi: jwalokaha e ngotswe ho Design Studio.",
    "ts": "Matirhiselo ya siku: hi laha ma rhekhodiweke eka Design Studio.",
    "ve": "U shumiswa nga ḓuvha: sa zwo rekhodiwa kha Design Studio."
  },
  {
    "english": "Roof catch by month",
    "zu": "Okubanjwa uphahla ngenyanga",
    "st": "Metsi a tshwarwang ke marulelo ka kgwedi",
    "ts": "Mati lama lwangu ri ma khomaka hi n'weti",
    "ve": "Maḓi a farwaho nga ṱhanga nga ṅwedzi"
  },
  {
    "english": "short in",
    "zu": "kuyashoda ngo",
    "st": "kgaello ka",
    "ts": "ku kayivela hi",
    "ve": "ṱhahelelo nga"
  },
  {
    "english": "storage on the plan",
    "zu": "isitoreji esikupulani",
    "st": "polokelo e polaneng",
    "ts": "vuhlayiselo eka pulani",
    "ve": "vhugalelo kha pulane"
  },
  {
    "english": "storage needed",
    "zu": "isitoreji esidingekayo",
    "st": "polokelo e hlokahalang",
    "ts": "vuhlayiselo leswi lavekaka",
    "ve": "vhugalelo vhune ha ṱoḓea"
  },
  {
    "english": "to the south",
    "zu": "eningizimu",
    "st": "ka borwa",
    "ts": "edzongeni",
    "ve": "tshipembe"
  },
  {
    "english": "to the north",
    "zu": "enyakatho",
    "st": "ka leboya",
    "ts": "en'walungwini",
    "ve": "devhula"
  },
  {
    "english": "overhead",
    "zu": "phezulu ngqo",
    "st": "hodimo ka ho otloloha",
    "ts": "ehenhla hi ku kongoma",
    "ve": "nṱha nga ho livhaho"
  },
  {
    "english": "The midday sun stands almost overhead",
    "zu": "Ilanga lasemini licishe libe phezulu ngqo",
    "st": "Letsatsi la motshehare le batla le le hodimo ka ho otloloha",
    "ts": "Dyambu ra nhlikanhi ri lava ku va ehenhla hi ku kongoma",
    "ve": "Ḓuvha ḽa masiari ḽi ṱoḓou vha nṱha nga ho livhaho"
  },
  {
    "english": "The midday sun stands",
    "zu": "Ilanga lasemini lima",
    "st": "Letsatsi la motshehare le eme",
    "ts": "Dyambu ra nhlikanhi ri le",
    "ve": "Ḓuvha ḽa masiari ḽi ima"
  },
  {
    "english": "Winter",
    "zu": "Ubusika",
    "st": "Mariha",
    "ts": "Xixika",
    "ve": "Vhuria"
  },
  {
    "english": "above the horizon",
    "zu": "ngaphezu komkhathizwe",
    "st": "ka hodima mola wa mahodimo",
    "ts": "ehenhla ka laha tilo ni misava swi hlanganaka",
    "ve": "nṱha ha vhukavhange"
  },
  {
    "english": "Summer",
    "zu": "Ihlobo",
    "st": "Lehlabula",
    "ts": "Ximumu",
    "ve": "Tshilimo"
  },
  {
    "english": "rises",
    "zu": "liphuma",
    "st": "le tjhaba",
    "ts": "ri huma",
    "ve": "ḽi ṱavha"
  },
  {
    "english": "sets",
    "zu": "lishona",
    "st": "le dikela",
    "ts": "ri pela",
    "ve": "ḽi kovhela"
  },
  {
    "english": "above the horizon at midday",
    "zu": "ngaphezu komkhathizwe emini",
    "st": "ka hodima mola wa mahodimo motshehare",
    "ts": "ehenhla ka laha tilo ni misava swi hlanganaka hi nhlikanhi",
    "ve": "nṱha ha vhukavhange nga masiari"
  },
  {
    "english": "Summer sun",
    "zu": "Ilanga lasehlobo",
    "st": "Letsatsi la lehlabula",
    "ts": "Dyambu ra ximumu",
    "ve": "Ḓuvha ḽa tshilimo"
  },
  {
    "english": "Winter sun",
    "zu": "Ilanga lasebusika",
    "st": "Letsatsi la mariha",
    "ts": "Dyambu ra xixika",
    "ve": "Ḓuvha ḽa vhuria"
  },
  {
    "english": "from the",
    "zu": "uvela e",
    "st": "o tswa",
    "ts": "wu huma",
    "ve": "u bva"
  },
  {
    "english": "fire follows this wind",
    "zu": "umlilo ulandela lo moya",
    "st": "mollo o latela moya ona",
    "ts": "ndzilo wu landzela moya lowu",
    "ve": "mulilo u tevhela muya uyu"
  },
  {
    "english": "regional pattern",
    "zu": "iphethini yesifunda",
    "st": "mokgwa wa sebaka se seholo",
    "ts": "maendlelo ya xifundzha",
    "ve": "maitele a dzingu"
  },
  {
    "english": "Fire risk",
    "zu": "Ingozi yomlilo",
    "st": "Kotsi ya mollo",
    "ts": "Khombo ra ndzilo",
    "ve": "Khombo ḽa mulilo"
  },
  {
    "english": "Fire is most likely to arrive from the",
    "zu": "Umlilo kungenzeka ufike uvela e",
    "st": "Mollo o ka nna wa fihla haholo ho tswa",
    "ts": "Ndzilo wu nga ha fika ngopfu wu huma",
    "ve": "Mulilo u nga kha ḓi swika u bva"
  },
  {
    "english": "Wind recorded on this site: usually from the",
    "zu": "Umoya oqoshwe kule ndawo: uvame ukuvela e",
    "st": "Moya o ngotsweng sebakeng sena: hangata o tswa",
    "ts": "Moya lowu rhekhodiweke eka ndhawu leyi: hakanyingi wu huma",
    "ve": "Muya wo rekhodiwaho kha fhethu afha: kanzhi u bva"
  },
  {
    "english": "strongest from the",
    "zu": "onamandla kakhulu uvela e",
    "st": "o matla ka ho fetisisa o tswa",
    "ts": "lowu nga ni ntamu swinene wu huma",
    "ve": "u re na maanḓa vhukuma u bva"
  },
  {
    "english": "Wind you recorded here: from the",
    "zu": "Umoya owuqophe lapha: uvela e",
    "st": "Moya oo o o ngotseng mona: o tswa",
    "ts": "Moya lowu u wu rhekhodeke laha: wu huma",
    "ve": "Muya we na u rekhoda afha: u bva"
  },
  {
    "english": "strongest",
    "zu": "onamandla",
    "st": "o matla ka ho fetisisa",
    "ts": "lowu nga ni ntamu swinene",
    "ve": "u re na maanḓa vhukuma"
  },
  {
    "english": "The ground falls toward the",
    "zu": "Umhlaba wehlela e",
    "st": "Mobu o theohela ka",
    "ts": "Misava yi rhelela yi ya",
    "ve": "Mavu a tsitsa a tshi ya"
  },
  {
    "english": "slope",
    "zu": "umthambeka",
    "st": "moepa",
    "ts": "ku rhelela",
    "ve": "mutsheṱo"
  },
  {
    "english": "Downhill, toward the",
    "zu": "Ukwehla, ngase",
    "st": "Ho theoha, ho ya ka",
    "ts": "Ku rhelela, ku ya",
    "ve": "U tsitsa, u ya"
  },
  {
    "english": "check with a level",
    "zu": "hlola ngelevela",
    "st": "hlahloba ka sesebediswa sa ho lekanya ho lekana",
    "ts": "kamba hi xipimelo xa ku ringana",
    "ve": "ṱolani nga tshipimo tsha vhunṱha"
  },
  {
    "english": "The ground reads as nearly flat, so no downhill direction is drawn.",
    "zu": "Umhlaba ubonakala ucishe ube yisicaba, ngakho akukho ndlela yokwehla edwetshiwe.",
    "st": "Mobu o bonahala o batla o bataletse, kahoo ha ho tsela ya ho theoha e takilweng.",
    "ts": "Misava yi vonaka yi lava ku va xiphepherhele, kutani a ku dirowiwi tlhelo ro rhelela.",
    "ve": "Mavu a vhonala a tshi ṱoḓou vha a phaphathi, ngauralo a hu na sia ḽa u tsitsa ḽo oliwaho."
  },
  {
    "english": "Nearly flat: no downhill direction drawn — check with a level",
    "zu": "Cishe yisicaba: akukho ndlela yokwehla — hlola ngelevela",
    "st": "O batla o bataletse: ha ho tsela ya ho theoha e takilweng — hlahloba ka sesebediswa sa ho lekanya ho lekana",
    "ts": "Yi lava ku va xiphepherhele: a ku dirowiwanga tlhelo ro rhelela — kamba hi xipimelo xa ku ringana",
    "ve": "A ṱoḓou vha a phaphathi: a hu na sia ḽa u tsitsa ḽo oliwaho — ṱolani nga tshipimo tsha vhunṱha"
  },
  {
    "english": "Wind of the region — not measured on this site",
    "zu": "Umoya wesifunda — awulinganiswanga kule ndawo",
    "st": "Moya wa sebaka se seholo — ha o a lekanngwa sebakeng sena",
    "ts": "Moya wa xifundzha — a wu pimiwanga eka ndhawu leyi",
    "ve": "Muya wa dzingu — a wo ngo elwa kha fhethu afha"
  },
  {
    "english": "Where fire is most likely to come from (regional)",
    "zu": "Lapho umlilo ungavela khona (isifunda)",
    "st": "Moo mollo o ka tswang teng haholo (sebaka se seholo)",
    "ts": "Laha ndzilo wu nga humaka kona ngopfu (xifundzha)",
    "ve": "Hune mulilo wa nga bva hone (dzingu)"
  },
  {
    "english": "Sun, wind and slope",
    "zu": "Ilanga, umoya nomthambeka",
    "st": "Letsatsi, moya le moepa",
    "ts": "Dyambu, moya ni ku rhelela",
    "ve": "Ḓuvha, muya na mutsheṱo"
  },
  {
    "english": "North is up; the house mark is this site. Sun paths are calculated from the latitude. Hatched marks are regional patterns, not measurements: check them against what you and your neighbours see.",
    "zu": "INyakatho iphezulu; uphawu lwendlu yile ndawo. Izindlela zelanga zibalwa ngokwe-latitude. Izimpawu ezinemidwa ziyiphethini yesifunda, aziyona imilinganiso: ziqinisekise ngalokho wena nomakhelwane enikubonayo.",
    "st": "Leboya le hodimo; letshwao la ntlo ke sebaka sena. Ditsela tsa letsatsi di balwa ho tswa ho latitude. Matshwao a nang le mela e tshekaletseng ke mekgwa ya sebaka se seholo, ha se ditekanyo: a bapise le seo wena le baahelani ba hao le se bonang.",
    "ts": "N'walungu yi le henhla; mfungho wa yindlu i ndhawu leyi. Tindlela ta dyambu ti hlayiwa ku suka eka latitude. Mimfungho ya milayini yo hingakanya i maendlelo ya xifundzha, a hi mimpimo: yi kambisise hi leswi wena ni vaakelani va wena mi swi vonaka.",
    "ve": "Devhula hu nṱha; luswayo lwa nnḓu ndi fhethu afha. Nḓila dza ḓuvha dzi vhalwa u bva kha latitude. Maswayo a mitalo yo sendamaho ndi maitele a dzingu, a si miṅwelo: a ṱoleni nga zwine inwi na vhahura vhaṋu na zwi vhona."
  },
  {
    "english": "Sun: calculated for latitude",
    "zu": "Ilanga: kubalwe nge-latitude",
    "st": "Letsatsi: le baletswe latitude",
    "ts": "Dyambu: ri hlayiwile hi latitude",
    "ve": "Ḓuvha: ḽo vhalelwa latitude"
  },
  {
    "english": "Wind and fire: regional pattern",
    "zu": "Umoya nomlilo: iphethini yesifunda",
    "st": "Moya le mollo: mokgwa wa sebaka se seholo",
    "ts": "Moya ni ndzilo: maendlelo ya xifundzha",
    "ve": "Muya na mulilo: maitele a dzingu"
  },
  {
    "english": "Slope: elevation model.",
    "zu": "Umthambeka: imodeli yokuphakama.",
    "st": "Moepa: mohlala wa bophahamo.",
    "ts": "Ku rhelela: modele wa ku tlakuka.",
    "ve": "Mutsheṱo: modele wa vhunṱha."
  },
  {
    "english": "Observed wind: recorded in the Design Studio.",
    "zu": "Umoya obonwe: uqoshwe ku-Design Studio.",
    "st": "Moya o bonweng: o ngotswe ho Design Studio.",
    "ts": "Moya lowu voniweke: wu rhekhodiwile eka Design Studio.",
    "ve": "Muya wo vhonwaho: wo rekhodiwa kha Design Studio."
  },
  {
    "english": "Sector diagram",
    "zu": "Umdwebo wamasekta",
    "st": "Setshwantsho sa diseketara",
    "ts": "Xifaniso xa tisekitara",
    "ve": "Tshifanyiso tsha sekithara"
  },
  {
    "english": "not measured",
    "zu": "akulinganiswanga",
    "st": "ha e a lekanngwa",
    "ts": "a swi pimiwanga",
    "ve": "a zwo ngo elwa"
  },
  {
    "english": "The soil here has not been measured yet",
    "zu": "Umhlabathi walapha awukalinganiswa",
    "st": "Mobu wa mona ha o eso lekanngwe",
    "ts": "Misava ya laha a yi si pimiwa",
    "ve": "Mavu a afha a a athu elwa"
  },
  {
    "english": "A soil test fills in these three readings.",
    "zu": "Ukuhlolwa komhlabathi kugcwalisa lezi zilinganiso ezintathu.",
    "st": "Teko ya mobu e tlatsa ditekanyo tsena tse tharo.",
    "ts": "Ku kamberiwa ka misava ku tata mimpimo leyi yinharhu.",
    "ve": "U ṱola mavu zwi ḓadza miṅwelo iyi miraru."
  },
  {
    "english": "How sour or sweet (pH)",
    "zu": "Ubumuncu noma ubumnandi (pH)",
    "st": "Ho ba bodila kapa monate (pH)",
    "ts": "Ku dzunga kumbe ku tsokombela (pH)",
    "ve": "U vha vhavhi kana u ṋandifha (pH)"
  },
  {
    "english": "Sand, silt and clay",
    "zu": "Isihlabathi, udaka nobumba",
    "st": "Lehlabathe, seretse se sesesane le letsopa",
    "ts": "Sava, sava leritsongo swinene ni vumba",
    "ve": "Muṱavha, mavu masekene na vumba"
  },
  {
    "english": "Organic carbon",
    "zu": "Ikhabhoni yemvelo",
    "st": "Khabone ya tlhaho",
    "ts": "Khaboni ya ntumbuluko",
    "ve": "Khaboni ya mvelo"
  },
  {
    "english": "Soil at a glance",
    "zu": "Umhlabathi ngamafuphi",
    "st": "Mobu ka ho habanya",
    "ts": "Misava hi ku languta ntsena",
    "ve": "Mavu nga u tou lavhelesa"
  },
  {
    "english": "No soil measurement is recorded for this site, so nothing is plotted. Arrange a soil test on a sample from the top 30 cm.",
    "zu": "Akukho ukulinganiswa komhlabathi okuqoshiwe kule ndawo, ngakho akukho okudwetshiwe. Hlela ukuhlolwa komhlabathi kusampula yamasentimitha angu-30 aphezulu.",
    "st": "Ha ho tekanyo ya mobu e ngotsweng sebakeng sena, kahoo ha ho letho le bontshwang. Hlophisa teko ya mobu ka sampole e tswang karolong e ka hodimo ya 30 cm.",
    "ts": "A ku na mpimo wa misava lowu rhekhodiweke eka ndhawu leyi, kutani a ku kombiwi nchumu. Hlela ku kamberiwa ka misava hi sampulu ya le henhla ka 30 cm.",
    "ve": "A hu na muṅwelo wa mavu wo rekhodiwaho kha fhethu afha, ngauralo a hu na tshithu tsho oliwaho. Dzudzanyani u ṱoliwa ha mavu nga sampulu ya kha 30 cm ya nṱha."
  },
  {
    "english": "No soil measurement recorded",
    "zu": "Akukho ukulinganiswa komhlabathi okuqoshiwe",
    "st": "Ha ho tekanyo ya mobu e ngotsweng",
    "ts": "A ku na mpimo wa misava lowu rhekhodiweke",
    "ve": "A hu na muṅwelo wa mavu wo rekhodiwaho"
  },
  {
    "english": "Soil not measured.",
    "zu": "Umhlabathi awulinganiswanga.",
    "st": "Mobu ha o a lekanngwa.",
    "ts": "Misava a yi pimiwanga.",
    "ve": "Mavu a o ngo elwa."
  },
  {
    "english": "How sour or sweet the soil is (pH)",
    "zu": "Ukuthi umhlabathi umuncu noma umnandi kangakanani (pH)",
    "st": "Hore mobu o bodila kapa o monate hakae (pH)",
    "ts": "Ndlela leyi misava yi dzungaka kumbe yi tsokombelaka ha yona (pH)",
    "ve": "Nḓila ine mavu a vha vhavhi kana a ṋandifha ngayo (pH)"
  },
  {
    "english": "← more acid (sour)",
    "zu": "← umuncu kakhulu",
    "st": "← o bodila haholo",
    "ts": "← ku dzunga swinene",
    "ve": "← vhavhi vhukuma"
  },
  {
    "english": "more alkaline →",
    "zu": "une-alkali kakhulu →",
    "st": "o nang le alkali haholo →",
    "ts": "ku va ni alkali yo tala →",
    "ve": "a re na alkali nnzhi →"
  },
  {
    "english": "most vegetables: 6 to 7",
    "zu": "imifino eminingi: 6 kuya ku-7",
    "st": "meroho e mengata: 6 ho ya ho 7",
    "ts": "matsavu yo tala: 6 ku fika eka 7",
    "ve": "miroho minzhi: 6 u swika kha 7"
  },
  {
    "english": "Sand",
    "zu": "Isihlabathi",
    "st": "Lehlabathe",
    "ts": "Sava",
    "ve": "Muṱavha"
  },
  {
    "english": "Silt",
    "zu": "Udaka olucolekile",
    "st": "Seretse se sesesane",
    "ts": "Sava leritsongo swinene",
    "ve": "Mavu masekene"
  },
  {
    "english": "Clay",
    "zu": "Ubumba",
    "st": "Letsopa",
    "ts": "Vumba",
    "ve": "Vumba"
  },
  {
    "english": "What the soil is made of",
    "zu": "Ukuthi umhlabathi wenziwe ngani",
    "st": "Seo mobu o entsweng ka sona",
    "ts": "Leswi misava yi endliweke hi swona",
    "ve": "Zwine mavu a itwa ngazwo"
  },
  {
    "english": "Organic carbon: how much rotted plant matter the soil holds",
    "zu": "Ikhabhoni yemvelo: ukuthi umhlabathi uphethe izinto zezitshalo ezibolile ezingakanani",
    "st": "Khabone ya tlhaho: bongata ba dintho tsa dimela tse bodileng tseo mobu o di tshwereng",
    "ts": "Khaboni ya ntumbuluko: mpimo wa swilo swa swimilana leswi boleke leswi misava yi swi khomaka",
    "ve": "Khaboni ya mvelo: vhunzhi ha zwimela zwo sinaho zwine mavu a zwi fara"
  },
  {
    "english": "Filled dot: measured by a laboratory on a sample from this site.",
    "zu": "Ichashazi eligcwele: kulinganiswe yilabhorethri kusampula yale ndawo.",
    "st": "Letheba le tletseng: le lekantswe laboratoring ka sampole ya sebaka sena.",
    "ts": "Thonsi leri tatiweke: ri pimiwile hi laboratori eka sampulu ya ndhawu leyi.",
    "ve": "Tshithoma tsho ḓadzwaho: tsho elwa nga ḽaborathori kha sampulu ya fhethu afha."
  },
  {
    "english": "Hollow dot and dashed outlines: estimated for this location by the SoilGrids world soil model, not measured here. A soil test on your own sample will replace them.",
    "zu": "Ichashazi elingenalutho nemidwa enqamukayo: kulinganiselwe le ndawo yimodeli yomhlabathi yomhlaba i-SoilGrids, akulinganiswanga lapha. Ukuhlolwa komhlabathi wakho kuzokuvala lokhu.",
    "st": "Letheba le sa tlatswang le mela e kgaohileng: di hakantswe bakeng sa sebaka sena ke mohlala wa mobu wa lefatshe wa SoilGrids, ha di a lekanngwa mona. Teko ya mobu ka sampole ya hao e tla nka sebaka sa tsona.",
    "ts": "Thonsi leri nga tatiwangiki ni milayini leyi tsemekeke: swi ringanyetiwile eka ndhawu leyi hi modele wa misava wa misava hinkwaro wa SoilGrids, a swi pimiwanga laha. Ku kamberiwa ka sampulu ya misava ya wena ku ta swi siva.",
    "ve": "Tshithoma tshi si na tshithu na mitalo yo ṱhukhukanywaho: zwo anganyelwa fhethu afha nga modele wa mavu wa ḽifhasi wa SoilGrids, a zwo ngo elwa afha. U ṱoliwa ha sampulu ya mavu aṋu hu ḓo zwi dzhiela vhudzulo."
  },
  {
    "english": "No soil measurement is recorded for this site, so nothing is plotted. Arrange a soil test: the result fills in all three scales.",
    "zu": "Akukho ukulinganiswa komhlabathi okuqoshiwe kule ndawo, ngakho akukho okudwetshiwe. Hlela ukuhlolwa komhlabathi: umphumela uzogcwalisa zonke izikali ezintathu.",
    "st": "Ha ho tekanyo ya mobu e ngotsweng bakeng sa sebaka sena, kahoo ha ho letho le bontshwang. Hlophisa teko ya mobu: sephetho se tlatsa dikala tsohle tse tharo.",
    "ts": "A ku na mpimo wa misava lowu rhekhodiweke eka ndhawu leyi, kutani a ku kombiwi nchumu. Hlela ku kamberiwa ka misava: mbuyelo wu tata swikalo leswinharhu.",
    "ve": "A hu na muṅwelo wa mavu wo rekhodiwaho kha fhethu afha, ngauralo a hu na tshithu tsho oliwaho. Dzudzanyani u ṱoliwa ha mavu: mvelelo i ḓadza zwikalo zwiraru zwoṱhe."
  },
  {
    "english": "Top 30 cm of soil. No \"good\" or \"bad\" bands are drawn for organic carbon because the right level depends on the soil type and climate.",
    "zu": "Amasentimitha angu-30 aphezulu omhlabathi. Ayikho imigqa ethi \"kuhle\" noma \"kubi\" yekhabhoni yemvelo ngoba izinga elifanele lincike ohlotsheni lomhlabathi nesimo sezulu.",
    "st": "Karolo e ka hodimo ya 30 cm ya mobu. Ha ho mela e reng \"ntle\" kapa \"mpe\" bakeng sa khabone ya tlhaho hobane tekanyo e loketseng e itshetlehile ka mofuta wa mobu le boemo ba lehodimo.",
    "ts": "Misava ya le henhla ka 30 cm. A ku dirowiwi mabhande ya \"kahle\" kumbe \"biha\" ya khaboni ya ntumbuluko hikuva mpimo lowu faneleke wu titshege hi muxaka wa misava ni maxelo.",
    "ve": "30 cm ya nṱha ha mavu. A hu na mitalo ya \"zwavhuḓi\" kana \"zwi si zwavhuḓi\" yo oliwaho ya khaboni ya mvelo ngauri tshikalo tsho teaho tshi bva kha lushaka lwa mavu na kilima."
  },
  {
    "english": "Your uploaded laboratory soil test",
    "zu": "Ukuhlolwa kwakho komhlabathi kwelabhorethri okulayishiwe",
    "st": "Teko ya hao ya mobu ya laboratori e kentsweng",
    "ts": "Ku kamberiwa ka misava ya wena hi laboratori loku u ku ngheniseke",
    "ve": "Mvelelo dza u ṱoliwa ha mavu nga ḽaborathori dze na dzi dzhenisa"
  },
  {
    "english": "SoilGrids world soil model (ISRIC), 250 m grid: an estimate, not a measurement",
    "zu": "Imodeli yomhlabathi yomhlaba i-SoilGrids (ISRIC), igridi engu-250 m: isilinganiso, akusona isilinganiso sangempela",
    "st": "Mohlala wa mobu wa lefatshe wa SoilGrids (ISRIC), keriti ya 250 m: ke kakanyo, ha se tekanyo",
    "ts": "Modele wa misava wa misava hinkwaro wa SoilGrids (ISRIC), giridi ya 250 m: i ndzinganyeto, a hi mpimo",
    "ve": "Modele wa mavu wa ḽifhasi wa SoilGrids (ISRIC), giridi ya 250 m: ndi ndinganyelo, a si muṅwelo"
  },
  {
    "english": "Soil",
    "zu": "Umhlabathi",
    "st": "Mobu",
    "ts": "Misava",
    "ve": "Mavu"
  },
  {
    "english": "organic carbon",
    "zu": "ikhabhoni yemvelo",
    "st": "khabone ya tlhaho",
    "ts": "khaboni ya ntumbuluko",
    "ve": "khaboni ya mvelo"
  },
  {
    "english": "laboratory result",
    "zu": "umphumela welabhorethri",
    "st": "sephetho sa laboratori",
    "ts": "mbuyelo wa laboratori",
    "ve": "mvelelo ya ḽaborathori"
  },
  {
    "english": "SoilGrids estimate",
    "zu": "isilinganiso se-SoilGrids",
    "st": "kakanyo ya SoilGrids",
    "ts": "ndzinganyeto wa SoilGrids",
    "ve": "ndinganyelo ya SoilGrids"
  },
  {
    "english": "stages of work. The last one starts around week",
    "zu": "izigaba zomsebenzi. Esokugcina siqala cishe ngeviki",
    "st": "mekgahlelo ya mosebetsi. Wa ho qetela o qala hoo e ka bang bekeng ya",
    "ts": "swiyenge swa mintirho. Xo hetelela xi sungula kwalomu ka vhiki ra",
    "ve": "zwipiḓa zwa mushumo. Tsha u fhedza tshi thoma tsini na vhege ya"
  },
  {
    "english": "Stages overlap: the next one can start before the one before it is finished.",
    "zu": "Izigaba ziyadlulana: esilandelayo singaqala ngaphambi kokuba esandulelayo siphele.",
    "st": "Mekgahlelo e a kopana: o latelang o ka qala pele o fetileng o fela.",
    "ts": "Swiyenge swa hlangana: lexi landzelaka xi nga sungula lexi xi rhangeleke xi nga si hela.",
    "ve": "Zwipiḓa zwi a ṱanganelana: tshi tevhelaho tshi nga thoma tshi tshi rangelaho tshi sa athu fhela."
  },
  {
    "english": "Each stage starts when the one before it is finished.",
    "zu": "Isigaba ngasinye siqala lapho esandulelayo sesiphelile.",
    "st": "Mokgahlelo ka mong o qala ha o fetileng o fedile.",
    "ts": "Xiyenge xin'wana ni xin'wana xi sungula loko lexi xi rhangeleke xi herile.",
    "ve": "Tshipiḓa tshiṅwe na tshiṅwe tshi thoma musi tshi tshi rangelaho tsho fhela."
  },
  {
    "english": "weeks from the day work starts",
    "zu": "amaviki kusukela ngosuku umsebenzi oqala ngalo",
    "st": "dibeke ho tloha letsatsing leo mosebetsi o qalang ka lona",
    "ts": "mavhiki ku sukela esikwini leri mintirho yi sungulaka ha rona",
    "ve": "vhege u bva ḓuvha ḽine mushumo wa thoma ngaḽo"
  },
  {
    "english": "Planned work, not started",
    "zu": "Umsebenzi ohleliwe, awukaqali",
    "st": "Mosebetsi o rerilweng, ha o eso qale",
    "ts": "Mintirho leyi kunguhatiweke, a yi si sungula",
    "ve": "Mushumo wo pulaniwaho, a u athu thoma"
  },
  {
    "english": "Hold point: stop and check before the next phase",
    "zu": "Iphuzu lokuma: yima uhlole ngaphambi kwesigaba esilandelayo",
    "st": "Ntlha ya ho ema: ema o hlahlobe pele ho mokgahlelo o latelang",
    "ts": "Ndhawu yo yima: yima u kamba xiyenge lexi landzelaka xi nga si sungula",
    "ve": "Fhethu ha u ima: imani ni ṱole phanḓa ha tshipiḓa tshi tevhelaho"
  },
  {
    "english": "Carries on",
    "zu": "Kuyaqhubeka",
    "st": "O tswela pele",
    "ts": "Ya ya mahlweni",
    "ve": "U bvela phanḓa"
  },
  {
    "english": "Order of work",
    "zu": "Ukulandelana komsebenzi",
    "st": "Tatelano ya mosebetsi",
    "ts": "Nandzelelano wa mintirho",
    "ve": "U tevhekana ha mushumo"
  },
  {
    "english": "The order and rough length of each phase, worked out from what is on the saved design. The weeks are a planning guide, not a promise: weather, money and labour will move them. The order should not change.",
    "zu": "Ukulandelana nobude obulinganiselwe besigaba ngasinye, kubalwe kulokho okusemklamweni ogciniwe. Amaviki ayisiqondiso sokuhlela, akusona isithembiso: isimo sezulu, imali nabasebenzi kuzowashintsha. Ukulandelana akufanele kushintshe.",
    "st": "Tatelano le bolelele bo hakantsweng ba mokgahlelo ka mong, di balwa ho tswa ho se leng moralong o bolokilweng. Dibeke ke tataiso ya ho rera, ha se tshepiso: boemo ba lehodimo, tjhelete le basebetsi di tla di fetola. Tatelano ha e a lokela ho fetoha.",
    "ts": "Nandzelelano ni vulehi bya nkarhi lowu ringanyetiweke bya xiyenge xin'wana ni xin'wana, swi hlayiwa ku suka eka leswi nga eka dizayini leyi hlayisiweke. Mavhiki i nkongomiso wo kunguhata, a hi xitshembiso: maxelo, mali ni vatirhi swi ta ma cinca. Nandzelelano a wu fanelanga ku cinca.",
    "ve": "U tevhekana na vhulapfu ho anganyelwaho ha tshipiḓa tshiṅwe na tshiṅwe, zwi vhalwa u bva kha zwi re kha dizaini yo vhulungwaho. Vhege ndi nyendedzi ya u pulana, a si fulufhedziso: mutsho, tshelede na vhashumi zwi ḓo dzi shandula. U tevhekana a hu tei u shanduka."
  },
  {
    "english": "Build phases derived from the saved design",
    "zu": "Izigaba zokwakha ezithathwe kumklamo ogciniwe",
    "st": "Mekgahlelo ya kaho e tswang moralong o bolokilweng",
    "ts": "Swiyenge swo aka leswi humaka eka dizayini leyi hlayisiweke",
    "ve": "Zwipiḓa zwa u fhaṱa zwo bviswaho kha dizaini yo vhulungwaho"
  },
  {
    "english": "NASA POWER (50 km climate grid)",
    "zu": "NASA POWER (igridi yesimo sezulu engu-50 km)",
    "st": "NASA POWER (keriti ya boemo ba lehodimo ya 50 km)",
    "ts": "NASA POWER (giridi ya maxelo ya 50 km)",
    "ve": "NASA POWER (giridi ya kilima ya 50 km)"
  },
  {
    "english": "ERA5-Land via Open-Meteo (9 km grid)",
    "zu": "ERA5-Land nge-Open-Meteo (igridi engu-9 km)",
    "st": "ERA5-Land ka Open-Meteo (keriti ya 9 km)",
    "ts": "ERA5-Land hi Open-Meteo (giridi ya 9 km)",
    "ve": "ERA5-Land nga Open-Meteo (giridi ya 9 km)"
  },
  {
    "english": "climate data service",
    "zu": "isevisi yedatha yesimo sezulu",
    "st": "tshebeletso ya dintlha tsa boemo ba lehodimo",
    "ts": "vukorhokeri bya datha ya maxelo",
    "ve": "tshumelo ya data ya kilima"
  },
  {
    "english": "a 1 m post throws a {length} m shadow",
    "zu": "isigxobo esingu-1 m senza isithunzi esingu-{length} m",
    "st": "palo ya 1 m e etsa moriti wa {length} m",
    "ts": "mhandzi ya 1 m yi endla ndzhuti wa {length} m",
    "ve": "phuluphu ya 1 m i ita murunzi wa {length} m"
  },
  {
    "english": "Summer cooling wind",
    "zu": "Umoya opholisa ehlobo",
    "st": "Moya o phodisang wa lehlabula",
    "ts": "Moya wo horisa wa ximumu",
    "ve": "Muya wa u rothodza wa tshilimo"
  },
  {
    "english": "Cold front — driving rain",
    "zu": "Ingaphambili elibandayo — imvula ephephethwayo",
    "st": "Moya o batang o fihlang — pula e kgannwang ke moya",
    "ts": "Moya wo titimela lowu fikaka — mpfula leyi biwaka hi moya",
    "ve": "Muya u rotholelaho u swikaho — mvula i sukumedzwaho nga muya"
  },
  {
    "english": "Berg wind",
    "zu": "Umoya oshisayo owomileyo ovela ezintabeni (berg)",
    "st": "Moya o tjhesang o ommeng o tswang dithabeng (berg)",
    "ts": "Moya wo hisa wo oma lowu humaka etintshaveni (berg)",
    "ve": "Muya u fhisaho wo oma u bvaho thavhani (berg)"
  },
  {
    "english": "{range}, episodic",
    "zu": "{range}, ngezikhathi ezithile",
    "st": "{range}, nako le nako",
    "ts": "{range}, hi minkarhi yo karhi",
    "ve": "{range}, nga zwiṅwe zwifhinga"
  },
  {
    "english": "Winter grassfire / ember risk follows the dry, hot berg wind, not the cooling summer wind.",
    "zu": "Ingozi yomlilo wotshani / yamalahle avuthayo ebusika ilandela umoya oshisayo owomileyo ovela ezintabeni, hhayi umoya opholisa ehlobo.",
    "st": "Kotsi ya mollo wa jwang / mashala a tukang mariha e latela moya o ommeng o tjhesang o tswang dithabeng, eseng moya o phodisang wa lehlabula.",
    "ts": "Khombo ra ndzilo wa byanyi / makala lama pfurhaka hi xixika ri landzela moya wo oma wo hisa wa le tintshaveni, ku nga ri moya wo horisa wa ximumu.",
    "ve": "Khombo ḽa mulilo wa hatsi / maxale a fhisaho nga vhuria ḽi tevhela muya wo oma u fhisaho wa thavhani, hu si muya wa u rothodza wa tshilimo."
  },
  {
    "english": "Compass: N = north; E = east; S = south; W = west.",
    "zu": "Ikhampasi: N = inyakatho; E = impumalanga; S = iningizimu; W = intshonalanga.",
    "st": "Khampase: N = leboya; E = botjhabela; S = borwa; W = bophirima.",
    "ts": "Khampasi: N = n'walungu; E = vuxa; S = dzonga; W = vupeladyambu.",
    "ve": "Khampasi: N = devhula; E = vhubvaḓuvha; S = tshipembe; W = vhukovhela."
  },
  {
    "english": "Verify, Set Out & Make Safe",
    "zu": "Qinisekisa, maka indawo bese uyiphephisa",
    "st": "Netefatsa, tshwaya sebaka mme o se boloke se bolokehile",
    "ts": "Tiyisisa, fungha ndhawu u yi endla yi hlayiseka",
    "ve": "Khwaṱhisedzani, swayani fhethu ni hu tsireledze"
  },
  {
    "english": "Safe Access & Water Spine",
    "zu": "Ukufinyelela okuphephile nolayini omkhulu wamanzi",
    "st": "Tsela e bolokehileng le peipi e kgolo ya metsi",
    "ts": "Ku nghena loku hlayisekeke ni layini leyikulu ya mati",
    "ve": "U dzhena ho tsireledzeaho na bommbo ḽihulwane ḽa maḓi"
  },
  {
    "english": "Safe Access",
    "zu": "Ukufinyelela okuphephile",
    "st": "Tsela e bolokehileng",
    "ts": "Ku nghena loku hlayisekeke",
    "ve": "U dzhena ho tsireledzeaho"
  },
  {
    "english": "Water Spine",
    "zu": "Ulayini omkhulu wamanzi",
    "st": "Peipi e kgolo ya metsi",
    "ts": "Layini leyikulu ya mati",
    "ve": "Bommbo ḽihulwane ḽa maḓi"
  },
  {
    "english": "Vetiver Bank & Soil Building",
    "zu": "Udonga lwe-Vetiver nokwakha umhlabathi",
    "st": "Leralla la Vetiver le ho ntlafatsa mobu",
    "ts": "Ribuwa ra Vetiver ni ku aka misava",
    "ve": "Luvhondo lwa Vetiver na u fhaṱa mavu"
  },
  {
    "english": "Earthworks & Soil Building",
    "zu": "Imisebenzi yomhlaba nokwakha umhlabathi",
    "st": "Mosebetsi wa mobu le ho ntlafatsa mobu",
    "ts": "Mintirho ya misava ni ku aka misava",
    "ve": "Mishumo ya mavu na u fhaṱa mavu"
  },
  {
    "english": "Beds, Drip & Working Infrastructure",
    "zu": "Imibhede, ukuconsa nezakhiwo zokusebenza",
    "st": "Dibethe, nosetso e rothelang le meaho ya mosebetsi",
    "ts": "Mibedo, ku cheleta hi mathonsi ni miako yo tirhela",
    "ve": "Mibethe, u sheledza nga marotha na zwifhaṱo zwa mushumo"
  },
  {
    "english": "Perennials & Guilds",
    "zu": "Izitshalo eziphila iminyaka namaqembu ezitshalo asekelanayo",
    "st": "Dimela tse phelang dilemo le dihlopha tsa dimela tse thusanang",
    "ts": "Swimilana leswi hanyaka malembenyana ni mintlawa ya swimilana leswi pfunanaka",
    "ve": "Zwimela zwa miṅwaha minzhi na zwigwada zwa zwimela zwi thusanaho"
  },
  {
    "english": "Small Livestock & Commissioning",
    "zu": "Imfuyo encane nokuqalisa ukusebenza",
    "st": "Diphoofolo tse nyenyane le ho qala tshebetso",
    "ts": "Swifuwo leswitsongo ni ku sungula ku tirha",
    "ve": "Zwifuwo zwiṱuku na u thoma u shumisa"
  },
  {
    "english": "Commissioning & Handover",
    "zu": "Ukuqalisa ukusebenza nokunikezela",
    "st": "Ho qala tshebetso le ho nehelana",
    "ts": "Ku sungula ku tirha ni ku nyiketa",
    "ve": "U thoma u shumisa na u ṋekedza"
  },
  {
    "english": "Week {start}–{end}",
    "zu": "Iviki {start}–{end}",
    "st": "Beke {start}–{end}",
    "ts": "Vhiki {start}–{end}",
    "ve": "Vhege {start}–{end}"
  },
  {
    "english": "Weeks {start}–{end}",
    "zu": "Amaviki {start}–{end}",
    "st": "Dibeke {start}–{end}",
    "ts": "Mavhiki {start}–{end}",
    "ve": "Vhege {start}–{end}"
  },
  {
    "english": "Month {month}+",
    "zu": "Inyanga {month}+",
    "st": "Kgwedi {month}+",
    "ts": "N'weti {month}+",
    "ve": "Ṅwedzi {month}+"
  },
  {
    "english": "Loam",
    "zu": "Umhlabathi oxubile",
    "st": "Mobu o tswakantsweng",
    "ts": "Misava leyi pfanganisiweke",
    "ve": "Mavu o ṱanganelanaho"
  },
  {
    "english": "Clay loam",
    "zu": "Umhlabathi oxubile onobumba",
    "st": "Mobu o tswakantsweng o nang le letsopa",
    "ts": "Misava leyi pfanganisiweke leyi nga ni vumba",
    "ve": "Mavu o ṱanganelanaho a re na vumba"
  },
  {
    "english": "Sandy clay",
    "zu": "Ubumba obunesihlabathi",
    "st": "Letsopa le nang le lehlabathe",
    "ts": "Vumba leri nga ni sava",
    "ve": "Vumba ḽi re na muṱavha"
  },
  {
    "english": "Sandy loam",
    "zu": "Umhlabathi oxubile onesihlabathi",
    "st": "Mobu o tswakantsweng o nang le lehlabathe",
    "ts": "Misava leyi pfanganisiweke leyi nga ni sava",
    "ve": "Mavu o ṱanganelanaho a re na muṱavha"
  },
  {
    "english": "Silt loam",
    "zu": "Umhlabathi oxubile onodaka olucolekile",
    "st": "Mobu o tswakantsweng o nang le seretse se sesesane",
    "ts": "Misava leyi pfanganisiweke leyi nga ni sava leritsongo swinene",
    "ve": "Mavu o ṱanganelanaho a re na mavu masekene"
  },
  {
    "english": "Silty clay loam",
    "zu": "Umhlabathi oxubile onodaka olucolekile nobumba",
    "st": "Mobu o tswakantsweng o nang le seretse se sesesane le letsopa",
    "ts": "Misava leyi pfanganisiweke leyi nga ni sava leritsongo swinene ni vumba",
    "ve": "Mavu o ṱanganelanaho a re na mavu masekene na vumba"
  },
  {
    "english": "Sandy clay loam",
    "zu": "Umhlabathi oxubile onesihlabathi nobumba",
    "st": "Mobu o tswakantsweng o nang le lehlabathe le letsopa",
    "ts": "Misava leyi pfanganisiweke leyi nga ni sava ni vumba",
    "ve": "Mavu o ṱanganelanaho a re na muṱavha na vumba"
  },
  {
    "english": "Follow the water through the site",
    "zu": "Landela amanzi endaweni yonke",
    "st": "Latela metsi ho pholletsa le sebaka",
    "ts": "Landzela mati endhawini hinkwayo",
    "ve": "Tevhelani maḓi kha fhethu hoṱhe"
  },
  {
    "english": "Rain runs off a roof into a gutter, through a first-flush pipe into a tank, and the overflow is led to a mulched basin around a fruit tree.",
    "zu": "Imvula igeleza ophahleni iye emseleni wophahla, idlule epayipini lokususa amanzi okuqala iye ethangini, bese amanzi achichimayo eholwa aye emgodini ombozwe ngesembozo sezitshalo ozungeze isihlahla sezithelo.",
    "st": "Pula e theoha marulelong e kena forong ya marulelo, e feta peiping e tlosang metsi a pele e kena tankeng, mme metsi a fetang a lebiswa sekoting se kwahetsweng ka dimela ho pota sefate sa ditholwana.",
    "ts": "Mpfula yi khuluka elwangwini yi ya eka nsele wa lwangu, yi hundza eka phayiphi yo susa mati yo sungula yi ya ethangini, kutani mati lama talaka ma yisiwa enkoweni lowu funengetiweke hi swimilana ku rhendzela murhi wa mihandzu.",
    "ve": "Mvula i elela i tshi bva kha ṱhanga ya ya kha mugero wa ṱhanga, ya fhira kha bommbo ḽa u bvisa maḓi a u thoma ya ya kha thannga, maḓi a fhiraho a livhiswa tshidzivhani tsho tibedzwaho nga zwimela u mona na muri wa mitshelo."
  },
  {
    "english": "It does not confirm a tank is installed, a pipe is correctly sized or water is safe to use.",
    "zu": "Akuqinisekisi ukuthi ithangi lifakiwe, ipayipi lilinganiswe kahle noma amanzi aphephile ukusetshenziswa.",
    "st": "Ha se netefatso ya hore tanka e kentswe, peipi e na le boholo bo nepahetseng kapa metsi a bolokehile ho sebediswa.",
    "ts": "A xi tiyisisi leswaku thangi yi nghenisiwile, phayiphi yi ni mpimo lowu faneleke kumbe mati ma hlayisekile ku tirhisiwa.",
    "ve": "A tshi khwaṱhisedzi uri thannga yo dzheniswa, bommbo ḽi na saizi yo teaho kana maḓi o tsireledzea u shumiswa."
  },
  {
    "english": "How a swale holds water on a slope",
    "zu": "Indlela umsele wokubamba amanzi ogcina ngayo amanzi endaweni eyehlelayo",
    "st": "Kamoo foro e tshwarang metsi e bolokang metsi moepeng",
    "ts": "Ndlela leyi nsele wo khoma mati wu hlayisaka mati endhawini leyi rheleraka",
    "ve": "Nḓila ine mugero wa u fara maḓi wa a vhulunga kha mutsheṱo"
  },
  {
    "english": "Cut through a slope: runoff drops into a level ditch, soaks in and spreads under a fruit tree planted on the mound below it.",
    "zu": "Ukusikwa kwendawo eyehlelayo: amanzi agelezayo angena emgodini oqondene nelevela, angene emhlabathini asabalale ngaphansi kwesihlahla sezithelo esitshalwe endundumeni engezansi.",
    "st": "Ho bontshwa kahare ho moepa: metsi a phallang a kena forong e bataletseng, a monyela mme a namela tlasa sefate sa ditholwana se lenngweng tutudung e ka tlase.",
    "ts": "Ku kombiwa endzeni ka ndhawu leyi rheleraka: mati lama khulukaka ma nghena enkoveni lowu ringaneke, ma nghena ehansi ma hangalaka ehansi ka murhi wa mihandzu lowu byariweke exirhendzevutaneni xa misava lexi nga ehansi.",
    "ve": "Hu sumbedzwa ngomu ha mutsheṱo: maḓi a elelaho a dzhena mugeroni wo linganaho, a nwele mavuni a phaḓalala fhasi ha muri wa mitshelo wo ṱavhiwaho tshikwarani tshi re fhasi."
  },
  {
    "english": "A swale must be set out level on the contour and sized for the slope; on steep or unstable ground get advice before digging.",
    "zu": "Umsele kumele umakwe ngokulingana ku-contour futhi usayizi uhambisane nokwehla; endaweni eyehle kakhulu noma engazinzile thola iseluleko ngaphambi kokumba.",
    "st": "Foro e tlameha ho tshwauwa e bataletse ho latela contour mme boholo ba yona bo dumellane le moepa; mobung o moepa haholo kapa o sa tsitsang batla keletso pele o tjheka.",
    "ts": "Nsele wu fanele ku funghiwa wu ringana hi contour ni ku va ni mpimo lowu fambisanaka ni ku rhelela; eka misava leyi rheleraka swinene kumbe leyi nga tiyanga kuma switsundzuxo u nga si cela.",
    "ve": "Mugero u tea u swaiwa wo lingana kha contour, saizi ya hone i tshimbidzane na mutsheṱo; kha mavu o sendamaho vhukuma kana a sa khwaṱhi ṱoḓani nyeletshedzo phanḓa ha u bwa."
  },
  {
    "english": "Water at the roots, not on the leaves",
    "zu": "Amanzi ezimpandeni, hhayi emaqabungeni",
    "st": "Metsi metsong, eseng mahlakung",
    "ts": "Mati etimitswini, ku nga ri ematlukeni",
    "ve": "Maḓi kha midzi, hu si kha maṱari"
  },
  {
    "english": "A raised tank feeds drip lines laid under mulch along rows of cabbage and spinach.",
    "zu": "Ithangi eliphakanyisiwe liphakela amapayipi okuconsa abekwe ngaphansi kwesembozo sezitshalo emigqeni ye-cabbage ne-spinach.",
    "st": "Tanka e phahamisitsweng e fepela dipeipi tse rothang tse behilweng tlasa sekwahelo sa dimela meleng ya cabbage le spinach.",
    "ts": "Thangi leyi tlakusiweke yi phamela tiphayiphi to thonisa leti vekiweke ehansi ka xifunengeto xa swimilana emilayeni ya cabbage ni spinach.",
    "ve": "Thannga yo imiswaho i ṋea bommbo dza u rothodza maḓi dzo vhewaho fhasi ha tshitibedza tsha zwimela kha mitaladzi ya cabbage na spinach."
  },
  {
    "english": "Pipe sizes, tank height and watering times still have to be worked out for the real beds.",
    "zu": "Osayizi bamapayipi, ukuphakama kwethangi nezikhathi zokunisela kusamele kubalelwe imibhede yangempela.",
    "st": "Boholo ba dipeipi, bophahamo ba tanka le dinako tsa ho nosetsa di sa ntse di lokela ho balellwa dibethe tsa nnete.",
    "ts": "Mimpimo ya tiphayiphi, ku tlakuka ka thangi ni minkarhi yo cheleta swa ha fanele ku hlayiwa hi mibedo ya xiviri.",
    "ve": "Saizi dza bommbo, vhunṱha ha thannga na zwifhinga zwa u sheledza zwi kha ḓi tea u vhalelwa mibethe ya vhukuma."
  },
  {
    "english": "Look below the surface",
    "zu": "Bheka ngaphansi komhlabathi",
    "st": "Sheba ka tlasa mobu",
    "ts": "Languta ehansi ka misava",
    "ve": "Sedzani fhasi ha mavu"
  },
  {
    "english": "Cut through garden soil: mulch on top, dark living topsoil with roots and earthworms, paler subsoil with stones below, and compost being added by hand.",
    "zu": "Ukusikwa komhlabathi wengadi: isembozo sezitshalo phezulu, umhlabathi ongaphezulu omnyama ophilayo onezimpande nezikelemu, umhlabathi ongezansi okhanyayo onamatshe, nomquba ofakwa ngesandla.",
    "st": "Ho bontshwa kahare ho mobu wa serapa: sekwahelo sa dimela hodimo, mobu o ka hodimo o lefifi o phelang o nang le metso le diboko, mobu o ka tlase o kganyang o nang le majwe, le mosuela o kenngwang ka letsoho.",
    "ts": "Ku kombiwa endzeni ka misava ya ntanga: xifunengeto xa swimilana ehenhla, misava ya le henhla ya ntima leyi hanyaka leyi nga ni timitsu ni swivungu, misava ya le hansi yo vonakala leyi nga ni maribye, ni manyoro lama cheriwaka hi voko.",
    "ve": "Hu sumbedzwa ngomu ha mavu a ngade: tshitibedza tsha zwimela nṱha, mavu a nṱha matswu a tshilaho a re na midzi na zwivhungu, mavu a fhasi a re na muvhala wo tsukaho na matombo, na manyoro a tshi dzheniswa nga tshanḓa."
  },
  {
    "english": "Use the site evidence checklist to add soil observations and laboratory results. This illustration does not describe measured conditions at this site.",
    "zu": "Sebenzisa uhlu lobufakazi bendawo ukufaka okubonile ngomhlabathi nemiphumela yelabhorethri. Lo mfanekiso awuchazi izimo ezilinganisiwe kule ndawo.",
    "st": "Sebedisa lenane la bopaki ba sebaka ho kenya seo o se boneng ka mobu le diphetho tsa laboratori. Setshwantsho sena ha se hlalose maemo a lekantsweng sebakeng sena.",
    "ts": "Tirhisa nxaxamelo wa vumbhoni bya ndhawu ku engetela leswi u swi voneke hi misava ni mimbuyelo ya laboratori. Xifaniso lexi a xi hlamuseli swiyimo leswi pimiweke eka ndhawu leyi.",
    "ve": "Shumisani mutevhe wa vhuṱanzi ha fhethu u dzhenisa zwe na vhona nga mavu na mvelelo dza ḽaborathori. Tshifanyiso itshi a tshi ṱalusi vhuimo ho elwaho kha fhethu afha."
  },
  {
    "english": "Inside a trench bed",
    "zu": "Ngaphakathi kombhede womsele",
    "st": "Kahare ho bethe ya foro",
    "ts": "Endzeni ka mbedo wa nkova",
    "ve": "Ngomu ha mbethe wa mugero"
  },
  {
    "english": "Cut through a trench bed: branches and bones at the bottom, then dry grass, green material, manure and topsoil, with cabbages growing in mulch on top.",
    "zu": "Ukusikwa kombhede womsele: amagatsha namathambo phansi, kulandele utshani obomile, izinto eziluhlaza, umquba nomhlabathi ongaphezulu, kube ne-cabbages ezikhula esembozweni sezitshalo phezulu.",
    "st": "Ho bontshwa kahare ho bethe ya foro: makala le masapo tlase, ho latele jwang bo ommeng, dintho tse tala, moitedi le mobu o ka hodimo, ka cabbages tse holang sekwahelong sa dimela hodimo.",
    "ts": "Ku kombiwa endzeni ka mbedo wa nkova: marhavi ni marhambu ehansi, ku landzela byanyi byo oma, swilo swa rihlaza, manyoro ni misava ya le henhla, ku ri ni cabbages leti kulaka eka xifunengeto xa swimilana ehenhla.",
    "ve": "Hu sumbedzwa ngomu ha mbethe wa mugero: matavhi na marambo fhasi, ha tevhela hatsi ho omaho, zwithu zwidala, manyoro na mavu a nṱha, hu na cabbages dzi aluwaho kha tshitibedza tsha zwimela nṱha."
  },
  {
    "english": "Depth and fill depend on what the household has to hand.",
    "zu": "Ukujula nokugcwalisa kuncike kulokho umndeni onakho.",
    "st": "Botebo le tse tlatswang di itshetlehile ka seo lelapa le nang le sona.",
    "ts": "Ku enta ni swo tata swi titshege hi leswi ndyangu wu nga na swona.",
    "ve": "Vhudzivha na zwi ḓadzwaho zwi bva kha zwine muṱa wa vha nazwo."
  },
  {
    "english": "Compost in three stages",
    "zu": "Umquba ngezigaba ezintathu",
    "st": "Mosuela ka mekgahlelo e meraro",
    "ts": "Manyoro hi swiyenge swinharhu",
    "ve": "Manyoro nga zwipiḓa zwiraru"
  },
  {
    "english": "Three compost bays side by side: fresh material, a heap half broken down, and finished dark compost ready for the beds.",
    "zu": "Izindawo ezintathu zomquba zilandelana: izinto ezintsha, inqwaba esibole ingxenye, nomquba omnyama osuqediwe olungele imibhede.",
    "st": "Dibaka tse tharo tsa mosuela di bapile: dintho tse ntjha, qubu e bodileng halofo, le mosuela o lefifi o seng o loketse dibethe.",
    "ts": "Tindhawu tinharhu ta manyoro ti ri etlhelo ka yin'wana: swilo leswintshwa, nhulu leyi boleke hafu, ni manyoro ya ntima lama heleleke lama lunghekeleke mibedo.",
    "ve": "Fhethu huraru ha manyoro ho vhewa tsini na hone: zwithu zwiswa, tshiṱhopho tsho sinaho hafu, na manyoro matswu o fhelelaho o lugelaho mibethe."
  },
  {
    "english": "Any container or heap works; the point is the three stages.",
    "zu": "Noma yisiphi isitsha noma inqwaba kuyasebenza; okubalulekile izigaba ezintathu.",
    "st": "Setshelo sefe kapa sefe kapa qubu e a sebetsa; taba ke mekgahlelo e meraro.",
    "ts": "Xibya xin'wana ni xin'wana kumbe nhulu ya tirha; mhaka i swiyenge swinharhu.",
    "ve": "Tshibogisi tshiṅwe na tshiṅwe kana tshiṱhopho zwi a shuma; tsha ndeme ndi zwipiḓa zwiraru."
  },
  {
    "english": "Move each crop family on, every season",
    "zu": "Hambisa iqembu ngalinye lezitshalo ngesizini ngayinye",
    "st": "Suthisa lelapa ka leng la dijalo sehleng ka seng",
    "ts": "Fambisa ndyangu wun'wana ni wun'wana wa swibyariwa hi nguva yin'wana ni yin'wana",
    "ve": "Tshimbidzani muṱa muṅwe na muṅwe wa zwiliṅwa kha khalanwaha iṅwe na iṅwe"
  },
  {
    "english": "Four beds seen from above — leaf crops, fruiting crops, legumes and root crops — with arrows showing each group moving to the next bed.",
    "zu": "Imibhede emine ibonwa phezulu — izitshalo zamaqabunga, ezithelo, ezinemidumba nezezimpande — nemicibisholo ekhombisa iqembu ngalinye lithuthela embhedeni olandelayo.",
    "st": "Dibethe tse nne di bonwa hodimo — dijalo tsa mahlaku, tsa ditholwana, tsa dinawa le tsa metso — ka metsu e bontshang sehlopha ka seng se fallela betheng e latelang.",
    "ts": "Mibedo ya mune yi voniwa ehenhla — swibyariwa swa matluka, swa mihandzu, swa tinyawa ni swa timitsu — ku ri ni miseve leyi kombaka ntlawa wun'wana ni wun'wana wu ya eka mbedo lowu landzelaka.",
    "ve": "Mibethe miṋa i vhonwa nṱha — zwiliṅwa zwa maṱari, zwa mitshelo, zwa ṋawa na zwa midzi — hu na misevhe i sumbedzaho tshigwada tshiṅwe na tshiṅwe tshi tshi ya kha mbethe u tevhelaho."
  },
  {
    "english": "The report's own calendar says what is planted where; this shows only the principle.",
    "zu": "Ikhalenda yombiko uqobo ichaza okutshalwe kuphi; lokhu kukhombisa umqondo kuphela.",
    "st": "Khalendara ya tlaleho ka boyona e bolela se lenngweng le moo se leng teng; sena se bontsha molao feela.",
    "ts": "Khalendara ya xiviko hi yoxe yi vula leswi byariweke ni laha swi nga kona; lexi xi komba ntsena nawu wa kona.",
    "ve": "Khaḽenda ya muvhigo nga wayo i bula zwine zwa ṱavhiwa na hune zwa ṱavhiwa hone; itshi tshi sumbedza muhumbulo fhedzi."
  },
  {
    "english": "A guild, layer by layer",
    "zu": "Iqembu lezitshalo ezisizanayo, ungqimba ngongqimba",
    "st": "Sehlopha sa dimela tse thusanang, lera ka lera",
    "ts": "Ntlawa wa swimilana leswi pfunanaka, hi maleyara",
    "ve": "Tshigwada tsha zwimela zwi thusanaho, nga zwipiḓa"
  },
  {
    "english": "A fruit tree with a climber, a berry shrub, a clumping plant, ground cover and root crops sharing one mulched bed, roots drawn below ground.",
    "zu": "Isihlahla sezithelo nesitshalo esikhuphukayo, isihlahlana samajikijolo, isitshalo esikhula ngesixha, izitshalo ezimboza umhlabathi nezezimpande zabelana ngombhede ombozwe ngesembozo sezitshalo, izimpande zidwetshwe ngaphansi komhlabathi.",
    "st": "Sefate sa ditholwana se nang le semela se hloang, sehlahlana sa monokotshwai, semela se melang ka sehlopha, sekwahelo sa mobu le dijalo tsa metso di arolelana bethe e kwahetsweng ka dimela, metso e takilwe ka tlase.",
    "ts": "Murhi wa mihandzu wu ri ni ximilana lexi khandziyaka, xihlahla xa tiberry, ximilana lexi kulaka hi ntlawa, swifunengeto swa misava ni swibyariwa swa timitsu swi avelana mbedo lowu funengetiweke hi swimilana, timitsu ti dirowiwe ehansi.",
    "ve": "Muri wa mitshelo u na tshimela tshi gonya, tshithukhwana tsha mitshelo miṱuku, tshimela tshi aluwaho nga tshigwada, zwitibedza zwa mavu na zwiliṅwa zwa midzi zwi ṱanganelaho mbethe wo tibedzwaho nga zwimela, midzi yo oliwa fhasi ha mavu."
  },
  {
    "english": "Species and spacing must be chosen for this site; this is not its planting plan.",
    "zu": "Izinhlobo zezitshalo nezikhala kufanele kukhethelwe le ndawo; lokhu akulona uhlelo lwayo lokutshala.",
    "st": "Mefuta ya dimela le dikgeo di tlameha ho kgethelwa sebaka sena; sena ha se polane ya sona ya ho lema.",
    "ts": "Tinxaka ta swimilana ni ku hambana swi fanele ku hlawuleriwa ndhawu leyi; lowu a hi pulani ya yona yo byala.",
    "ve": "Tshaka dza zwimela na zwikhala zwi tea u khethelwa fhethu afha; iyi a si pulane ya hone ya u ṱavha."
  },
  {
    "english": "How a windbreak lifts the wind",
    "zu": "Indlela isivikelo somoya esiphakamisa ngayo umoya",
    "st": "Kamoo sethibela moya se phahamisang moya",
    "ts": "Ndlela leyi xisirhelelo xa moya xi tlakusaka moya ha yona",
    "ve": "Nḓila ine tshithivheli tsha muya tsha u imisa ngayo"
  },
  {
    "english": "Wind meets a belt of tall trees, smaller trees and shrubs, rises over it and comes down well beyond the vegetable beds sheltered behind.",
    "zu": "Umoya uhlangana nomugqa wezihlahla ezinde, ezincane nezihlahlana, ukhuphuke udlule phezulu bese wehla kude ngale kwemibhede yemifino evikelekile engemuva.",
    "st": "Moya o kopana le lebanta la difate tse telele, tse nyenyane le dihlahlana, o phahama o fete hodima lona ebe o theoha hole ka mora dibethe tsa meroho tse sireleditsweng.",
    "ts": "Moya wu hlangana ni layini ya mirhi leyo leha, mirhi leyitsongo ni swihlahla, wu tlakuka wu hundza ehenhla kutani wu rhelela ekule endzhaku ka mibedo ya matsavu leyi sirhelelekeke.",
    "ve": "Muya u ṱangana na mutevhe wa miri milapfu, miṱuku na zwitukhwana, wa gonya wa fhira nṱha wa tsitsa kule nga murahu ha mibethe ya miroho yo tsireledzeaho."
  },
  {
    "english": "Which side to plant follows the wind directions recorded for the site, not this drawing.",
    "zu": "Uhlangothi lokutshala lulandela imimoya eqoshiwe yendawo, hhayi lo mdwebo.",
    "st": "Lehlakore la ho lema le latela ditsela tsa moya tse ngotsweng sebakeng sena, eseng setshwantsho sena.",
    "ts": "Tlhelo ro byala ri landzela matlhelo ya moya lama rhekhodiweke eka ndhawu, ku nga ri xifaniso lexi.",
    "ve": "Sia ḽa u ṱavha ḽi tevhela masia a muya o rekhodiwaho kha fhethu afha, hu si tshifanyiso itshi."
  },
  {
    "english": "Low winter sun in, high summer sun out",
    "zu": "Ilanga eliphansi lasebusika malingenise, eliphezulu lasehlobo maliphume",
    "st": "Letsatsi le tlase la mariha le kene, le hodimo la lehlabula le sale kantle",
    "ts": "Dyambu ra xixika ra le hansi ri nghene, ra ximumu ra le henhla ri sale ehandle",
    "ve": "Ḓuvha ḽa vhuria ḽa fhasi ḽi dzhene, ḽa tshilimo ḽa nṱha ḽi sale nnḓa"
  },
  {
    "english": "A house with a wide eave: the high summer sun is stopped by the roof overhang while the low winter sun reaches in under it.",
    "zu": "Indlu enophahla olweluleke ngaphandle: ilanga eliphezulu lasehlobo livinjwa wuphahla, kanti eliphansi lasebusika lingena ngaphansi kwalo.",
    "st": "Ntlo e nang le marulelo a atolositsweng ka ntle: letsatsi le hodimo la lehlabula le thijwa ke marulelo, ha letsatsi le tlase la mariha le kena ka tlasa ona.",
    "ts": "Yindlu leyi nga ni lwangu leri yaka ehandle: dyambu ra ximumu ra le henhla ri siviwa hi lwangu, kasi dyambu ra xixika ra le hansi ri nghena ehansi ka rona.",
    "ve": "Nnḓu i na ṱhanga yo aṱamaho nnḓa: ḓuvha ḽa tshilimo ḽa nṱha ḽi thivhiwa nga ṱhanga, ngeno ḓuvha ḽa vhuria ḽa fhasi ḽi tshi dzhena nga fhasi hayo."
  },
  {
    "english": "The real sun angles for this latitude are in the sun and wind figure.",
    "zu": "Ama-engeli elanga angempela ale latitude asesithombeni selanga nomoya.",
    "st": "Diengele tsa nnete tsa letsatsi ho latitude ena di setshwantshong sa letsatsi le moya.",
    "ts": "Tiangle ta xiviri ta dyambu ta latitude leyi ti le ka xifaniso xa dyambu ni moya.",
    "ve": "Dziangele dza vhukuma dza ḓuvha kha latitude iyi dzi kha tshifanyiso tsha ḓuvha na muya."
  },
  {
    "english": "Zones: what you visit most sits closest",
    "zu": "Izindawo: okuvakashela kakhulu makube seduze",
    "st": "Dizone: seo o se etelang haholo se be haufi",
    "ts": "Tizoni: leswi u swi endzelaka ngopfu swi va ekusuhi",
    "ve": "Zouni: zwine na zwi dalela kanzhi zwi vhe tsini"
  },
  {
    "english": "A homestead seen from above: herb and vegetable beds at the door, then chickens and fruit trees, then field crops, grazing and a belt of trees at the edge.",
    "zu": "Umuzi obonwa phezulu: imibhede yamakhambi nemifino emnyango, kulandele izinkukhu nezihlahla zezithelo, kulandele izitshalo zasensimini, amadlelo nomugqa wezihlahla emaphethelweni.",
    "st": "Lelapa le bonwa hodimo: dibethe tsa ditlama le meroho pela monyako, ho latele dikgoho le difate tsa ditholwana, ho latele dijalo tsa masimo, makgulo le lebanta la difate moeding.",
    "ts": "Muzi wu voniwa ehenhla: mibedo ya mitsembyana ni matsavu enyangweni, ku landzela tihuku ni mirhi ya mihandzu, ku landzela swibyariwa swa le masin'wini, madyelo ni layini ya mirhi emakumu.",
    "ve": "Muḓi u vhonwa nṱha: mibethe ya zwimela zwi shumiswaho na miroho munangoni, ha tevhela khuhu na miri ya mitshelo, ha tevhela zwiliṅwa zwa masimuni, mafulo na mutevhe wa miri mukanoni."
  },
  {
    "english": "The zones mapped for this site are in its own site plan.",
    "zu": "Izindawo ezibalazwe zaleli pulazi zikupulani yalo yendawo.",
    "st": "Dizone tse takilweng mmapeng wa sebaka sena di polaneng ya sona ya sebaka.",
    "ts": "Tizoni leti mepiweke ta ndhawu leyi ti le ka pulani ya yona.",
    "ve": "Zouni dzo olelwaho kha mapa wa fhethu afha dzi kha pulane ya hone."
  },
  {
    "english": "Let the chickens prepare the next bed",
    "zu": "Izinkukhu mazilungise umbhede olandelayo",
    "st": "Dumella dikgoho ho lokisa bethe e latelang",
    "ts": "Pfumelela tihuku ku lunghisa mbedo lowu landzelaka",
    "ve": "Tendelani khuhu dzi lugise mbethe u tevhelaho"
  },
  {
    "english": "A movable wire chicken run on wheels stands on one bed while the bed beside it, already cleared and manured, is ready for planting.",
    "zu": "Ihhoko lezinkukhu elinyakazayo elinamasondo limi embhedeni owodwa, kanti umbhede oseceleni osususwe izitshalo futhi wafakwa umquba usulungele ukutshalwa.",
    "st": "Lesaka la dikgoho la terata le tsamaiswang ka mabili le eme betheng e nngwe, ha bethe e pela lona, e seng e hlekilwe le ho tshelwa moitedi, e loketse ho lengwa.",
    "ts": "Xihoko xa tihuku xa waya lexi fambisiwaka hi mavhilwa xi yime eka mbedo wun'we, kasi mbedo lowu nga ekusuhi, lowu se wu basisiweke wu cheleriwa manyoro, wu lunghekele ku byariwa.",
    "ve": "Tshitumba tsha khuhu tsha luṱale tshi tshimbidzwaho nga malinga tsho ima kha mbethe muthihi, ngeno mbethe u re tsini, wo no kunakiswaho na u shelwa manyoro, wo lugela u ṱavhiwa."
  },
  {
    "english": "Stock numbers, housing and by-laws still need checking locally.",
    "zu": "Izibalo zemfuyo, izindawo zokuhlala nemithetho kamasipala kusadinga ukuhlolwa endaweni.",
    "st": "Dipalo tsa diphoofolo, matlo le melao ya masepala di sa ntse di lokela ho hlahlojwa sebakeng sa heno.",
    "ts": "Tinhlayo ta swifuwo, tindlu ni milawu ya masipala swa ha fanele ku kamberiwa laha ndhawini.",
    "ve": "Tshivhalo tsha zwifuwo, vhudzulo na milayo ya masipala zwi kha ḓi tea u ṱolwa henefho."
  },
  {
    "english": "Keep a bare or green ring between grass and home",
    "zu": "Gcina isiyingi esingenatshani noma esiluhlaza phakathi kotshani nomuzi",
    "st": "Boloka lesale le se nang jwang kapa le letala pakeng tsa jwang le lehae",
    "ts": "Hlayisa xirhendzevutana lexi nga riki na byanyi kumbe xa rihlaza phakathi ka byanyi ni kaya",
    "ve": "Vhulungani tshitendeledzi tshi si na hatsi kana tshidala vhukati ha hatsi na muḓi"
  },
  {
    "english": "A house and water tank on a green lawn, ringed by a bare cleared strip and a gravel road that separate them from dry grassland.",
    "zu": "Indlu nethangi lamanzi otshanini obuluhlaza, kuzungezwe umucu osusiwe izitshalo nomgwaqo wamatshe okuhlukanisa notshani obomile.",
    "st": "Ntlo le tanka ya metsi lebaleng le letala, di potapotilwe ke mola o hlekilweng le tsela ya lehlohlojane e di arolang le jwang bo ommeng.",
    "ts": "Yindlu ni thangi ya mati eka byanyi bya rihlaza, swi rhendzeriwe hi ntambhu ya misava leyi basisiweke ni ndlela ya maribyana leswi swi hambanisaka ni byanyi byo oma.",
    "ve": "Nnḓu na thannga ya maḓi kha hatsi hudala, zwo moniwa nga mutalo wo kunakiswaho na nḓila ya matombo zwi zwi fhandekanyaho na hatsi ho omaho."
  },
  {
    "english": "Break widths and burning rules come from the local fire protection association.",
    "zu": "Ububanzi bezindawo zokuvimba umlilo nemithetho yokushisa kuvela enhlanganweni yendawo yokuvikela umlilo.",
    "st": "Bophara ba dithibela mollo le melao ya ho tjhesa di tswa mokgatlong wa lehae wa tshireletso ya mollo.",
    "ts": "Vuanami bya tindhawu to sivela ndzilo ni milawu yo hisa swi huma eka nhlangano wa ndhawu wo sirhelela eka ndzilo.",
    "ve": "Vhuphara ha zwithivheli zwa mulilo na milayo ya u fhisa zwi bva kha dzangano ḽa tsireledzo ya mulilo ḽa henefho."
  },
  {
    "english": "Something to harvest in every season",
    "zu": "Okuthile ongakuvuna ngesizini ngayinye",
    "st": "Ho hong ho ka kotulwang sehleng ka seng",
    "ts": "Xilo xo tshovela hi nguva yin'wana ni yin'wana",
    "ve": "Tshiṅwe tshithu tsha u kaṋa kha khalanwaha iṅwe na iṅwe"
  },
  {
    "english": "Four beds side by side: maize, beans, pumpkin and sweet potato under a high summer sun; cabbage, carrots, onions, peas and young seedlings under a low winter sun.",
    "zu": "Imibhede emine ilandelana: maize, beans, pumpkin ne-sweet potato ngaphansi kwelanga eliphezulu lasehlobo; cabbage, carrots, onions, peas nezithombo ezintsha ngaphansi kwelanga eliphansi lasebusika.",
    "st": "Dibethe tse nne di bapile: maize, beans, pumpkin le sweet potato tlasa letsatsi le hodimo la lehlabula; cabbage, carrots, onions, peas le dithopo tse nyenyane tlasa letsatsi le tlase la mariha.",
    "ts": "Mibedo ya mune yi ri etlhelo ka yin'wana: maize, beans, pumpkin ni sweet potato ehansi ka dyambu ra ximumu ra le henhla; cabbage, carrots, onions, peas ni swithombana leswintshwa ehansi ka dyambu ra xixika ra le hansi.",
    "ve": "Mibethe miṋa yo vhewa tsini: maize, beans, pumpkin na sweet potato fhasi ha ḓuvha ḽa tshilimo ḽa nṱha; cabbage, carrots, onions, peas na zwimela zwiṱuku fhasi ha ḓuvha ḽa vhuria ḽa fhasi."
  },
  {
    "english": "The crops and months for this site are in its planting calendar.",
    "zu": "Izitshalo nezinyanga zaleli pulazi zisekhalendeni lalo lokutshala.",
    "st": "Dijalo le dikgwedi tsa sebaka sena di khalendareng ya sona ya ho lema.",
    "ts": "Swibyariwa ni tin'weti ta ndhawu leyi swi le khalendareni ya yona yo byala.",
    "ve": "Zwiliṅwa na miṅwedzi ya fhethu afha zwi kha khaḽenda ya hone ya u ṱavha."
  },
  {
    "english": "From the garden to a table at the gate",
    "zu": "Kusuka engadini kuya etafuleni esangweni",
    "st": "Ho tloha serapeng ho ya tafoleng hekeng",
    "ts": "Ku suka entangeni ku ya etafuleni enyangweni",
    "ve": "U bva ngadeni u ya kha ṱafula getheni"
  },
  {
    "english": "A shaded roadside table with crates of spinach, cabbage, tomatoes and pumpkins, seedling trays, eggs and a scale.",
    "zu": "Itafula elinomthunzi eceleni komgwaqo elinamakhreyithi e-spinach, cabbage, tomatoes nama-pumpkins, amathileyi ezithombo, amaqanda nesikali.",
    "st": "Tafole e moriting pela tsela e nang le mabokose a spinach, cabbage, tomatoes le pumpkins, diterei tsa sethopo, mahe le sekala.",
    "ts": "Tafula leyi nga endzhutini etlhelo ka ndlela yi ni mabokisi ya spinach, cabbage, tomatoes ni pumpkins, tithireyi ta swithombana, matandza ni xikalo.",
    "ve": "Ṱafula i re murunzini thungo ha nḓila i na mabogisi a spinach, cabbage, tomatoes na pumpkins, ṱhireyi dza zwimela zwiṱuku, makumba na tshikalo."
  },
  {
    "english": "Prices and demand have to be checked in the local market.",
    "zu": "Amanani nesidingo kufanele kuhlolwe emakethe yendawo.",
    "st": "Ditheko le tlhoko di tlameha ho hlahlojwa mmarakeng wa lehae.",
    "ts": "Minxavo ni xilaveko swi fanele ku kamberiwa emakete ya ndhawu.",
    "ve": "Mitengo na ṱhoḓea zwi tea u ṱolwa maketeni wa henefho."
  },
  {
    "english": "Bare plot to food garden, in stages",
    "zu": "Kusuka esizeni esingenalutho kuye engadini yokudla, ngezigaba",
    "st": "Ho tloha tshimong e feela ho ya serapeng sa dijo, ka mekgahlelo",
    "ts": "Ku suka ensin'wini leyi nga riki na swimilana ku ya entangeni wa swakudya, hi swiyenge",
    "ve": "U bva kha tsimu i si na zwimela u ya kha ngade ya zwiḽiwa, nga zwipiḓa"
  },
  {
    "english": "The same sloping plot three times: bare ground with a house and tank, then young contour beds and saplings, then a full garden with fruit trees.",
    "zu": "Indawo efanayo eyehlelayo ibonakala kathathu: umhlaba ongenazitshalo onendlu nethangi, kulandele imibhede emisha elandela ama-contour nezihlahla ezincane, kulandele ingadi egcwele enezihlahla zezithelo.",
    "st": "Sebaka se le seng se moepa se bontshwa hararo: mobu o feela o nang le ntlo le tanka, ho latele dibethe tse ntjha tsa contour le difate tse nyenyane, ho latele serapa se tletseng se nang le difate tsa ditholwana.",
    "ts": "Ndhawu yin'we leyi rheleraka yi kombiwa kanharhu: misava leyi nga riki na swimilana yi ni yindlu ni thangi, ku landzela mibedo leyintshwa ya contour ni mirhi leyitsongo, ku landzela ntanga lowu taleke wa mirhi ya mihandzu.",
    "ve": "Fhethu huthihi ho sendamaho hu sumbedzwa luraru: mavu a si na zwimela a na nnḓu na thannga, ha tevhela mibethe miswa ya contour na miri miṱuku, ha tevhela ngade yo ḓalaho i na miri ya mitshelo."
  },
  {
    "english": "How fast the real site changes depends on water, labour and money.",
    "zu": "Ukushintsha kwendawo yangempela kushesha noma kubambezeleke ngokwamanzi, abasebenzi nemali.",
    "st": "Lebelo la phetoho ya sebaka sa nnete le itshetlehile ka metsi, basebetsi le tjhelete.",
    "ts": "Ku hatlisa ka ku cinca ka ndhawu ya xiviri ku titshege hi mati, vatirhi ni mali.",
    "ve": "U shanduka ha fhethu ha vhukuma nga u ṱavhanya zwi bva kha maḓi, vhashumi na tshelede."
  },
  {
    "english": "A living landscape, layer by layer",
    "zu": "Indawo ephilayo, ungqimba ngongqimba",
    "st": "Tikoloho e phelang, lera ka lera",
    "ts": "Ndhawu leyi hanyaka, hi maleyara",
    "ve": "Fhethu hu tshilaho, nga zwipiḓa"
  },
  {
    "english": "Concept illustration. Species, spacing and the layers present must be checked for this site; this is not its measured vegetation profile.",
    "zu": "Umfanekiso womqondo. Izinhlobo zezitshalo, izikhala nezingqimba ezikhona kumele kuhlolwe kule ndawo; lokhu akusona isithombe sezitshalo ezilinganisiwe zaleli pulazi.",
    "st": "Setshwantsho sa mohopolo. Mefuta ya dimela, dikgeo le malera a teng di tlameha ho hlahlojwa sebakeng sena; sena ha se setshwantsho sa dimela tse lekantsweng tsa sona.",
    "ts": "Xifaniso xa mianakanyo. Tinxaka ta swimilana, ku hambana ni maleyara lama nga kona swi fanele ku kamberiwa eka ndhawu leyi; lexi a hi xifaniso xa swimilana swa yona leswi pimiweke.",
    "ve": "Tshifanyiso tsha muhumbulo. Tshaka dza zwimela, zwikhala na zwipiḓa zwi re hone zwi tea u ṱolwa kha fhethu afha; itshi a si tshifanyiso tsha zwimela zwa hone zwo elwaho."
  },
  {
    "english": "Trees mentioned in this section",
    "zu": "Izihlahla ezishiwo kulesi sigaba",
    "st": "Difate tse boletsweng karolong ena",
    "ts": "Mirhi leyi boxiweke eka xiyenge lexi",
    "ve": "Miri yo bulwaho kha tshipiḓa itshi"
  },
  {
    "english": "Catalogue illustrations, not site photographs or identification evidence. Read the advice and confirm local suitability before choosing plants.",
    "zu": "Imifanekiso yekhathalogi, hhayi izithombe zendawo noma ubufakazi bokuhlonza. Funda iseluleko bese uqinisekisa ukufaneleka kwendawo ngaphambi kokukhetha izitshalo.",
    "st": "Ditshwantsho tsa khathaloko, ha se dinepe tsa sebaka kapa bopaki ba boitsebiso. Bala keletso mme o netefatse ho tshwaneleha ha lehae pele o kgetha dimela.",
    "ts": "Swifaniso swa khathalogu, a hi swifaniso swa ndhawu kumbe vumbhoni byo hlawula muxaka. Hlaya switsundzuxo u tiyisisa ku faneleka ka ndhawu u nga si hlawula swimilana.",
    "ve": "Zwifanyiso zwa khathaḽogu, a si zwinepe zwa fhethu kana vhuṱanzi ha u ṱalusa tshimela. Vhalani nyeletshedzo ni khwaṱhisedze u tea ha henefho phanḓa ha u khetha zwimela."
  },
  {
    "english": "Concept illustration, the same in every report. It is not a picture of this site.",
    "zu": "Umfanekiso womqondo, ofanayo kuyo yonke imibiko. Akusona isithombe sale ndawo.",
    "st": "Setshwantsho sa mohopolo, se tshwanang ditlalehong tsohle. Ha se setshwantsho sa sebaka sena.",
    "ts": "Xifaniso xa mianakanyo, lexi fanaka eka swiviko hinkwato. A hi xifaniso xa ndhawu leyi.",
    "ve": "Tshifanyiso tsha muhumbulo, tshi fanaho kha mivhigo yoṱhe. A si tshifanyiso tsha fhethu afha."
  },
  {
    "english": "Tree canopy",
    "zu": "Isiqongo sesihlahla",
    "st": "Moqhaka wa sefate",
    "ts": "Matluka ya le henhla ka murhi",
    "ve": "Ṱhodzi ya muri"
  },
  {
    "english": "Upper growing layer",
    "zu": "Ungqimba lokukhula oluphezulu",
    "st": "Lera le hodimo la ho hola",
    "ts": "Leyara ya le henhla yo kula",
    "ve": "Tshipiḓa tsha nṱha tsha u aluwa"
  },
  {
    "english": "Shrubs & understory",
    "zu": "Izihlahlana nezitshalo ezingaphansi",
    "st": "Dihlahla le dimela tse ka tlase",
    "ts": "Swihlahla ni swimilana swa le hansi",
    "ve": "Zwitukhwana na zwimela zwa fhasi"
  },
  {
    "english": "Space below the canopy",
    "zu": "Isikhala ngaphansi kwesiqongo",
    "st": "Sebaka tlasa moqhaka wa sefate",
    "ts": "Ndhawu ehansi ka matluka ya murhi",
    "ve": "Tshikhala fhasi ha ṱhodzi ya muri"
  },
  {
    "english": "Ground cover & leaf litter",
    "zu": "Izitshalo ezimboza umhlabathi namahlamvu awileyo",
    "st": "Sekwahelo sa mobu le mahlaku a weleng",
    "ts": "Swifunengeto swa misava ni matluka lama weleke",
    "ve": "Zwitibedza zwa mavu na maṱari o waho"
  },
  {
    "english": "Roots & living soil",
    "zu": "Izimpande nomhlabathi ophilayo",
    "st": "Metso le mobu o phelang",
    "ts": "Timitsu ni misava leyi hanyaka",
    "ve": "Midzi na mavu a tshilaho"
  },
  {
    "english": "Trench bed",
    "zu": "Umbhede womsele",
    "st": "Bethe ya foro",
    "ts": "Mbedo wa nkova",
    "ve": "Mbethe wa mugero"
  },
  {
    "english": "Compost",
    "zu": "Umquba wezitshalo obolisiwe",
    "st": "Mosuela",
    "ts": "Manyoro ya swilo leswi boleke",
    "ve": "Manyoro a zwimela zwo sinaho"
  },
  {
    "english": "Windbreak row",
    "zu": "Umugqa wokuvikela umoya",
    "st": "Mola wa ho thibela moya",
    "ts": "Layini yo sivela moya",
    "ve": "Muduba wa u thivhela muya"
  },
  {
    "english": "Swale (on-contour earthwork)",
    "zu": "Umsele wokubamba amanzi (umsebenzi womhlabathi olandela ukuphakama okufanayo)",
    "st": "Foro e tshwarang metsi (mosebetsi wa mobu o latelang mela e lekanang ka bophahamo)",
    "ts": "Nsele wo khoma mati (ntirho wa misava hi ku landza milayeni leyi nga eka ku tlakuka loku fanaka)",
    "ve": "Mugero wa u fara maḓi (mushumo wa mavu kha mitalo i re kha vhuimo ha nṱha hu fanaho)"
  }
];

/** Only an exact default name on its recorded catalogue ID may change presentation language.
 * Older reports have no ID; guessing from their names would rename the farmer's own words.
 * Plant identities remain canonical even where a draft dictionary happens to contain the name. */
export function reportElementDisplayName(name:string,defId:string|undefined,language:string):string {
  const def=defId&&Object.hasOwn(ELEMENTS_BY_ID,defId)?ELEMENTS_BY_ID[defId]:undefined;
  if(!def||name!==def.name||def.category==='growing'||def.botanical||plantTakesCode(def.id))return name;
  return reportVisualText(def.name,language);
}

/** A full cost line retains the route explanation; the header keeps its established short form.
 * Only the producer's default label on its recorded route kind may change language. */
export function reportRouteDisplayName(label:string,kind:string|undefined,language:string,compact=false):string {
  const shown=compact?label.replace(/ \(.*\)$/, ''):label;
  const source=kind&&Object.hasOwn(ROUTE_LABELS,kind)?ROUTE_LABELS[kind as keyof typeof ROUTE_LABELS]:undefined;
  return source===label?reportVisualText(shown,language):shown;
}
export function reportRouteShortName(label:string,kind:string|undefined,language:string):string {
  return reportRouteDisplayName(label,kind,language,true);
}

const visualCopy = new Map(REPORT_VISUAL_COPY.map(row => [row.english, row]));
export function reportVisualText(english: string, language: string, values: Record<string, string | number> = {}, legacyZulu?: string): string {
  const row = visualCopy.get(english);
  // isiXhosa: the draft keyed by the exact English template (lib/locales/xh-inline), else English.
  const template = language === 'zu' && legacyZulu !== undefined ? legacyZulu
    : isInlineDraftLang(language) ? inlineDraft(language, english) ?? english
    : row && (language === 'zu' || language === 'st' || language === 'ts' || language === 've') ? row[language] : english;
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => Object.hasOwn(values, key) ? String(values[key]) : placeholder);
}

export function reportYearRange(language: string): string {
  return `${recordsMonthShort(language, 1).toUpperCase()} – ${recordsMonthShort(language, 12).toUpperCase()}`;
}

function figureKicker(id: string, language: string): string {
  const source = FIGURE_KICKER[id];
  if (!source) return '';
  if (source[0] === 'm²') return source[0];
  if (source[0] === 'JAN – DEC') return reportYearRange(language);
  return reportVisualText(source[0], language, {}, source[1]);
}

/** One alternative description for the SVG and its on-screen card, including first-season qualifiers. */
export function reportChartAlt(chart: ReportChart): string {
  const language = chart.language ?? 'en';
  if (chart.figure) return chart.figure.alt;
  if (!chart.rows.length) return `${chart.title}. ${reportVisualText('No priced or measured values available.', language)}`;
  return `${chart.title}. ${chart.rows.map(row => {
    const label = row.detail && chart.kind === 'calendar' ? `${row.label} · ${row.detail}` : row.label;
    const value = chart.kind === 'calendar'
      ? (row.months ?? []).map(month => recordsMonthShort(language, month + 1)).join(', ')
      : `${row.value} ${chart.unit}`;
    const once = chart.kind === 'calendar' && row.once?.length
      ? `; ${reportVisualText('first season only', language)}: ${row.once.map(month => recordsMonthShort(language, month + 1)).join(', ')}` : '';
    return `${label}: ${value}${once}`;
  }).join('; ')}`;
}

/** Wrap only presentation text; a longer native label never changes a saved quantity or category. */
function wrapChartWords(value: string, size: number, width: number): string[] {
  const limit = Math.max(1, Math.floor(width / (size * 0.58)));
  const lines: string[] = [];
  let line = '';
  for (const word of value.split(/\s+/).filter(Boolean)) {
    const parts = Array.from(word);
    while (parts.length > limit) {
      if (line) { lines.push(line); line = ''; }
      lines.push(parts.splice(0, limit).join(''));
    }
    const rest = parts.join('');
    if (line && Array.from(line + ' ' + rest).length > limit) { lines.push(line); line = ''; }
    line = line ? line + ' ' + rest : rest;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}
