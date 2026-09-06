import type { LocationData } from './types';
import type { ReportSiteFacts } from './report-site-facts';
import { buildBillOfQuantities } from './report-boq';
import { pdfSafe } from './crop-export-pdf';

export type ReportSummaryPage = { title: string; lines: string[] };
export function reportSummaryPages(facts: ReportSiteFacts | null, location: LocationData, pageCount: 1 | 5, language = 'en'): ReportSummaryPage[] {
  const zu = language === 'zu';
  const t = (en: string, zulu: string) => zu ? zulu : en;
  const unknown = t('Not recorded', 'Akubhaliwe');
  const area = (value?: number) => value === undefined ? unknown : `${value.toLocaleString('en-ZA', { maximumFractionDigits: 1 })} m²`;
  const amount = (value: number) => `R ${value.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
  const boq = buildBillOfQuantities(facts);
  const soilKnown = location.soil.soilSource === 'lab' || location.soil.soilSource === 'soilgrids';
  const title = facts?.farmName ?? t('Site summary', 'Isifinyezo sendawo');
  const factsLines = [
    `${Math.abs(location.lat).toFixed(4)}°${location.lat < 0 ? 'S' : 'N'}, ${Math.abs(location.lon).toFixed(4)}°${location.lon < 0 ? 'W' : 'E'}`,
    `${t('Mapped boundary', 'Umngcele obalazwe')}: ${area(facts?.boundary?.areaM2)}`,
    `${t('Mapped growing area', 'Indawo yokutshala ebalazwe')}: ${area(facts?.design?.growingAreaM2)}`,
    `${t('Vegetable beds', 'Imibhede yemifino')}: ${facts?.design?.bedCount ?? unknown} · ${area(facts?.design?.bedAreaM2)}`,
    `${t('Staple plots', 'Iziza zezitshalo eziyisisekelo')}: ${facts?.design?.plotCount ?? unknown} · ${area(facts?.design?.plotAreaM2)}`,
    t('Mapped space is not confirmation that all of it is currently in production.', 'Indawo ebalazwe ayiqinisekisi ukuthi yonke isatshaliwe njengamanje.'),
    `${t('Annual rainfall estimate', 'Isilinganiso semvula yonyaka')}: ${location.rainfall.annual} mm`,
    `${t('Soil', 'Umhlabathi')}: ${soilKnown ? `pH ${location.soil.ph} · ${location.soil.soilSource === 'lab' ? t('lab result', 'umphumela wokuhlolwa') : t('SoilGrids model; confirm on site', 'imodeli ye-SoilGrids; qinisekisa endaweni')}` : t('Not measured. Arrange a soil test.', 'Awukahlolwa. Hlela ukuhlolwa komhlabathi.')}`,
    `${t('Stated tank capacity in the design', 'Umthamo wamathangi obhalwe emklamweni')}: ${facts?.water ? `${facts.water.statedStorageLitres.toLocaleString()} L` : unknown}`,
    t('Capacity is not water currently available; check which tanks are already installed.', 'Umthamo awusho amanzi akhona manje; hlola ukuthi yimaphi amathangi asefakiwe.'),
  ];
  const cropLines = facts?.crop?.crops.length ? facts.crop.crops.map(c => `${c.name} · ${c.bedLabels.join(', ')} · ${t('sow', 'hlwanyela')}: ${c.sowMonths.join(', ')}${c.firstSeasonOnlyMonths.length ? ` · ${t('once only', 'kanye kuphela')}: ${c.firstSeasonOnlyMonths.join(', ')}` : ''}${c.alreadyGrowing ? ` · ${t('includes an existing crop', 'kufaka isitshalo esesikhona')}` : ''}`) : [t('No crop rows linked to this site were saved with this report.', 'Ayikho imigqa yezitshalo exhunywe kule ndawo egcinwe nalo mbiko.')];
  const cropNotes = [t('This is the saved planting plan, not a harvest or sales record. Check actual bed clearance before each next planting.', 'Lolu uhlelo lokutshala olugciniwe, alulona irekhodi lesivuno noma ukuthengisa. Hlola ukuthi umbhede usukhululekile ngaphambi kokutshala okulandelayo.'), t('For seed quantities, use the crop planner’s seed list. Do not buy seed from an inferred yield or monthly availability chart.', 'Ngobuningi bembewu, sebenzisa uhlu lwembewu kuhlelo lwezitshalo. Ungathengi imbewu ngokwesivuno esiqageliwe noma ishadi lokutholakala kwenyanga.')];
  const costLines = [
    `${t('Priced infrastructure subtotal', 'Isamba sezindleko zengqalasizinda ezinentengo')}: ${boq.lines.length ? amount(boq.subtotalZar) : unknown}`,
    `${t('Lines awaiting a price or measurement', 'Imigqa elinde intengo noma isilinganiso')}: ${boq.lines.length ? boq.unpricedCount : unknown}`,
    t('Planned budget, not actual spending. A missing price is not zero. Obtain current local quotes.', 'Lena ibhajethi ehleliwe, akuzona izimali esezisetshenzisiwe. Intengo engekho ayisho uziro. Thola amanani akamuva endaweni.'),
  ];
  if (pageCount === 1) return [{ title, lines: [...factsLines, `${t('Crop rows', 'Imigqa yezitshalo')}: ${facts?.crop?.plantingCount ?? unknown}`, ...cropLines.slice(0, 4), ...(cropLines.length > 4 ? [t('More crop rows are listed in the five-page or full report.', 'Eminye imigqa yezitshalo isembikweni wamakhasi amahlanu noma ogcwele.')] : []), ...costLines, t('Next: verify the land measurements, soil and water supply; confirm the crop plan and obtain missing quotes.', 'Okulandelayo: qinisekisa izilinganiso zomhlaba, umhlabathi namanzi; qinisekisa uhlelo lwezitshalo uthole namanani angekho.')] }];
  return [
    { title, lines: factsLines },
    { title: t('Crop plan', 'Uhlelo lwezitshalo'), lines: [...cropNotes, ...cropLines] },
    { title: t('Water, soil and the mapped site', 'Amanzi, umhlabathi nendawo ebalazwe'), lines: [factsLines[7], ...factsLines.slice(8), `${t('Traced roof', 'Uphahla olulinganisiwe')}: ${area(facts?.roof?.areaM2)}`, ...(facts?.water?.tanks.map(tank => `${tank.name} ×${tank.count} · ${tank.status === 'existing' ? t('existing', 'ikhona') : tank.status === 'proposed' ? t('planned', 'ihleliwe') : t('mixed status', 'isimo esixubile')}`) ?? []), ...(facts?.design?.routes.map(r => `${r.label}: ${r.totalLengthM.toLocaleString()} m`) ?? []), t('Confirm water reliability, drainage and soil condition on the ground before construction or amendment purchases.', 'Qinisekisa ukutholakala kwamanzi, ukuphuma kwamanzi nesimo somhlabathi ngaphambi kokwakha noma ukuthenga izinto zokulungisa umhlabathi.')] },
    { title: t('Bill of quantities', 'Uhlu lobuningi nezindleko'), lines: [...costLines, ...boq.lines.map(l => `${l.description} · ${l.quantity} · ${l.zar === null ? l.unpriced === 'existing' ? t('existing; excluded from new spend', 'ikhona; ayifakiwe ezindlekweni ezintsha') : t('quote / measurement needed', 'kudingeka intengo / isilinganiso') : amount(l.zar)}`)] },
    { title: t('Next actions and checks', 'Izinyathelo ezilandelayo nokuhlola'), lines: [
      t('Confirm what is already on the site and what is still proposed. Keep the saved design as the reference.', 'Qinisekisa okukhona endaweni nokusahleliwe. Sebenzisa umklamo ogciniwe njengereferensi.'),
      t('Check the crop plan against the real beds and seasonal conditions. A planned sowing is not proof of planting.', 'Qhathanisa uhlelo lwezitshalo nemibhede yangempela nezimo zesizini. Ukuhlwanyela okuhleliwe akubona ubufakazi bokuthi sekutshaliwe.'),
      t('Record harvest weight, food kept or donated, sales and costs with their dates.', 'Bhala isisindo sesivuno, ukudla okugciniwe noma okunikelwe, ukuthengisa nezindleko kanye nezinsuku zakho.'),
      t('Check production area on site before reporting hectares to a funder. Count each physical bed once.', 'Hlola indawo ekhiqizayo ngaphambi kokubika amahektha kumxhasi. Bala umbhede ngamunye kanye.'),
      t('Agree support actions with the farmer. At review, record what improved, what did not and what needs to change.', 'Vumelana nomlimi ngezinyathelo zosizo. Ekubuyekezeni, bhala okuthuthukile, okungathuthukanga nokudinga ukushintsha.'),
      t('This summary uses saved measurements and plan quantities. Read the full report for detailed advice, assumptions and source notes.', 'Lesi sifinyezo sisebenzisa izilinganiso ezigciniwe nobuningi bohlelo. Funda umbiko ogcwele ngezeluleko eziningiliziwe, okucatshangiwe namanothi emithombo.'),
    ] },
  ];
}

/** Fixed page count, white paper, no photograph plates. Readable type has priority
 * over squeezing unlimited crop/BOQ rows onto a page; omissions are stated. */
export async function buildInkSummaryPdf(pages: ReportSummaryPage[], stamp: string, language = 'en'): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  for (let i = 0; i < pages.length; i++) {
    if (i) doc.addPage();
    doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
    const titleLines = doc.splitTextToSize(pdfSafe(pages[i].title), 503) as string[];
    doc.text(titleLines.slice(0, 2), 46, 56);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    let y = 70 + Math.min(titleLines.length, 2) * 20;
    let omitted = false;
    for (const line of pages[i].lines) {
      const wrapped = doc.splitTextToSize(pdfSafe(line), 503) as string[];
      if (y + wrapped.length * 13 + 8 > 744) { omitted = true; break; }
      doc.text(wrapped, 46, y); y += wrapped.length * 13 + 8;
    }
    if (omitted) { doc.setFont('helvetica', 'bold'); doc.text(language === 'zu' ? 'Eminye imininingwane isembikweni ogcwele.' : 'Additional detail is in the full report.', 46, 764); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(pdfSafe(`ImbewuField · ${stamp} · ${i + 1}/${pages.length}`), 46, 798);
    doc.text(language === 'zu' ? 'Qinisekisa izilinganiso nezindleko ngaphambi kokusebenza.' : 'Verify measurements and costs before acting.', 46, 812);
  }
  return doc.output('blob');
}

/** A complete, no-network demo record assembled from this site's saved design.
 * This is deliberately not presented as a freshly generated AI assessment. */
export function sampleFullSiteReport(facts: ReportSiteFacts | null, location: LocationData, language = 'en'): string {
  const pages = reportSummaryPages(facts, location, 5, language);
  const sections = pages.map(page => `## ${page.title}\n\n${page.lines.map(line => `- ${line}`).join('\n')}`);
  const inventory = facts?.design?.elements.map(item => `- ${item.name} × ${item.count} · ${item.status}`) ?? [];
  const beds = facts?.design?.beds.map(bed => `- ${bed.label} · ${bed.areaM2.toLocaleString('en-ZA')} m² · ${bed.kind}`) ?? [];
  return [
    '## Sample report basis\n\nThis ready-to-read sample is assembled from the saved site and design records. It is not a new AI analysis or an independently verified assessment. Sample finances, soil examples and household examples remain illustrative wherever labelled. Planned areas and infrastructure do not establish completed work.',
    ...sections,
    `## Full design inventory\n\n${inventory.length ? inventory.join('\n') : 'No placed elements recorded.'}`,
    `## Production spaces\n\n${beds.length ? beds.join('\n') : 'No production spaces recorded.'}`,
    '## Evidence and limitations\n\nSite photos and map plates, where available, are shown separately in this report. An AI-generated reference photograph is not evidence of the real site. Missing measurements, quotes or records remain missing. Review the site, dates and evidence with the implementing organisation before using this example for a funding decision.',
  ].join('\n\n');
}
