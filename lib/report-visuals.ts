import { recordsMonthShort } from './records-months.ts';
import { numberLabel } from '@/lib/format-figures';
import type { LocationData } from './types';
import type { ReportSiteFacts } from './report-site-facts';
import type { SampleGarden } from './sample-gardens';
import { buildBillOfQuantities } from './report-boq';
import type { ReportFigure } from './report-figures';

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
  if (facts?.water?.tanks.length) charts.push({ id: 'water', title: t('Water storage', 'Ukugcina amanzi'), note: `${t('Capacity is not water currently available.', 'Umthamo awusho amanzi akhona manje.')} ${facts.water.tanksOfUnknownCapacity ? `${facts.water.tanksOfUnknownCapacity} ${t('tanks have no stated capacity.', 'amathangi awunawo umthamo obhaliwe.')}` : ''}`, kind: 'bars', unit: 'L', rows: facts.water.tanks.filter(r => r.statedLitres !== null).map(r => ({ label: `${r.name} ×${r.count}`, value: r.statedLitres! * r.count, detail: reportVisualText(r.status, language) })) });
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
    "ts": "Mpfula ya n’hweti, a hi vuprofeta bya maxelo.",
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
  }
];

const visualCopy = new Map(REPORT_VISUAL_COPY.map(row => [row.english, row]));
export function reportVisualText(english: string, language: string, values: Record<string, string | number> = {}, legacyZulu?: string): string {
  const row = visualCopy.get(english);
  const template = language === 'zu' && legacyZulu !== undefined ? legacyZulu
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
