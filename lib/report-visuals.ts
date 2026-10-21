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
