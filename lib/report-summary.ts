import { reportElementDisplayName, reportRouteDisplayName } from './report-visuals';
import { numberLabel } from '@/lib/format-figures';
import type { LocationData } from './types';
import type { ReportSiteFacts } from './report-site-facts';
import { buildBillOfQuantities } from './report-boq';
import { registerReportPdfFont, reportPdfText } from './report-pdf-font.ts';
import { recordsMonthShort } from './records-months.ts';
import type { BoqLine } from './report-boq';
import { xhInlineDraft } from '@/lib/xh-inline';

export type ReportSummaryPage = { title: string; lines: string[] };
export function reportSummaryPages(facts: ReportSiteFacts | null, location: LocationData, pageCount: 1 | 5, language = 'en'): ReportSummaryPage[] {
  const t = (en: string, zulu: string) => reportSummaryText(en, language, {}, zulu);
  const unknown = t('Not recorded', 'Akubhaliwe');
  const area = (value?: number) => value === undefined ? unknown : `${numberLabel(value, 1)} m²`;
  const amount = (value: number) => `R ${numberLabel(value, 0)}`;
  const boq = buildBillOfQuantities(facts,language);
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
    `${t('Stated tank capacity in the design', 'Umthamo wamathangi obhalwe emklamweni')}: ${facts?.water ? `${numberLabel(facts.water.statedStorageLitres)} L` : unknown}`,
    t('Capacity is not water currently available; check which tanks are already installed.', 'Umthamo awusho amanzi akhona manje; hlola ukuthi yimaphi amathangi asefakiwe.'),
  ];
  const cropLines = facts?.crop?.crops.length ? facts.crop.crops.map(c => `${c.name} · ${c.bedLabels.join(', ')} · ${t('sow', 'hlwanyela')}: ${c.sowMonths.map(month => summaryMonth(month, language)).join(', ')}${c.firstSeasonOnlyMonths.length ? ` · ${t('once only', 'kanye kuphela')}: ${c.firstSeasonOnlyMonths.map(month => summaryMonth(month, language)).join(', ')}` : ''}${c.alreadyGrowing ? ` · ${t('includes an existing crop', 'kufaka isitshalo esesikhona')}` : ''}`) : [t('No crop rows linked to this site were saved with this report.', 'Ayikho imigqa yezitshalo exhunywe kule ndawo egcinwe nalo mbiko.')];
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
    { title: t('Water, soil and the mapped site', 'Amanzi, umhlabathi nendawo ebalazwe'), lines: [factsLines[7], ...factsLines.slice(8), `${t('Traced roof', 'Uphahla olulinganisiwe')}: ${area(facts?.roof?.areaM2)}`, ...(facts?.water?.tanks.map(tank => `${reportElementDisplayName(tank.name,tank.defId,language)} ×${tank.count} · ${tank.status === 'existing' ? t('existing', 'ikhona') : tank.status === 'proposed' ? t('planned', 'ihleliwe') : t('mixed status', 'isimo esixubile')}`) ?? []), ...(facts?.design?.routes.map(r => `${reportRouteDisplayName(r.label,r.kind,language)}: ${numberLabel(r.totalLengthM)} m`) ?? []), t('Confirm water reliability, drainage and soil condition on the ground before construction or amendment purchases.', 'Qinisekisa ukutholakala kwamanzi, ukuphuma kwamanzi nesimo somhlabathi ngaphambi kokwakha noma ukuthenga izinto zokulungisa umhlabathi.')] },
    { title: t('Bill of quantities', 'Uhlu lobuningi nezindleko'), lines: [...costLines, ...boq.lines.map(l => `${summaryBoqDescription(l, language)} · ${l.quantity} · ${l.zar === null ? l.unpriced === 'existing' ? t('existing; excluded from new spend', 'ikhona; ayifakiwe ezindlekweni ezintsha') : t('quote / measurement needed', 'kudingeka intengo / isilinganiso') : amount(l.zar)}`)] },
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
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true, putOnlyUsedFonts: true });
  const font = await registerReportPdfFont(doc);
  const text = (source: string) => reportSummaryText(source, language);
  for (let i = 0; i < pages.length; i++) {
    if (i) doc.addPage();
    doc.setTextColor(20); doc.setFont(font, 'bold'); doc.setFontSize(18);
    const titleLines = doc.splitTextToSize(reportPdfText(pages[i].title), 503) as string[];
    doc.text(titleLines.slice(0, 2), 46, 56);
    doc.setFont(font, 'normal'); doc.setFontSize(10);
    let y = 70 + Math.min(titleLines.length, 2) * 20;
    let omitted = false;
    for (const line of pages[i].lines) {
      const wrapped = doc.splitTextToSize(reportPdfText(line), 503) as string[];
      if (y + wrapped.length * 13 + 8 > 730) { omitted = true; break; }
      doc.text(wrapped, 46, y); y += wrapped.length * 13 + 8;
    }
    if (omitted) {
      doc.setFont(font, 'bold'); doc.setFontSize(8);
      doc.text(doc.splitTextToSize(text('Additional detail is in the full report.'), 503), 46, 747, { lineHeightFactor: 1.25 });
    }
    doc.setFont(font, 'normal'); doc.setFontSize(8);
    if (['zu', 'xh', 'st', 'ts', 've'].includes(language)) {
      doc.text(doc.splitTextToSize(text('Draft translation · not reviewed by a fluent speaker.'), 503), 46, 776, { lineHeightFactor: 1.25 });
    }
    doc.text(reportPdfText(`ImbewuField · ${stamp} · ${i + 1}/${pages.length}`), 46, 798);
    doc.text(doc.splitTextToSize(text('Verify measurements and costs before acting.'), 503), 46, 812, { lineHeightFactor: 1.25 });
  }
  return doc.output('blob');
}

/** A complete, no-network demo record assembled from this site's saved design.
 * This is deliberately not presented as a freshly generated AI assessment. */
export function sampleFullSiteReport(facts: ReportSiteFacts | null, location: LocationData, language = 'en'): string {
  const zu = language === 'zu';
  const t = (en: string, zulu: string) => reportSummaryText(en, language, {}, zulu);
  const pages = reportSummaryPages(facts, location, 5, language);
  const sections = pages.map(page => `## ${page.title}\n\n${page.lines.map(line => `- ${line}`).join('\n')}`);
  const status = (value: 'existing' | 'proposed' | 'mixed') => zu
    ? value === 'existing' ? 'okukhona' : value === 'proposed' ? 'okuhleliwe' : 'isimo esixubile'
    : reportSummaryText(value, language);
  const inventory = facts?.design?.elements.map(item => `- ${reportElementDisplayName(item.name,item.defId,language)} × ${item.count} · ${status(item.status)}`) ?? [];
  const beds = facts?.design?.beds.map(bed => `- ${bed.label} · ${numberLabel(bed.areaM2)} m² · ${t(bed.kind, bed.kind === 'bed' ? 'umbhede' : 'isiza')}`) ?? [];
  return [
    `## ${t('report basis', 'Isisekelo sombiko')}\n\n${t('This ready-to-read sample is assembled from the saved site and design records. It is not a new AI analysis or an independently verified assessment. Sample finances, soil examples and household examples remain illustrative wherever labelled. Planned areas and infrastructure do not establish completed work.', 'Lesi yisibonelo esilungiselelwe ukufundeka, esakhiwe ngamarekhodi agciniwe endawo nawomklamo. Asikona ukuhlaziywa okusha kwe-AI noma ukuhlolwa okuzimele okuqinisekisiwe. Izibonelo zezimali, zomhlabathi nezasekhaya ziyizibonelo zokubonisa kuphela uma zibhalwe kanjalo. Izindawo nengqalasizinda okuhleliwe akufakazeli ukuthi umsebenzi usuqediwe.')}`,
    ...sections,
    `## ${t('Full design inventory', 'Uhlu oluphelele lomklamo')}\n\n${inventory.length ? inventory.join('\n') : t('No placed elements recorded.', 'Akukho zinto ezibekiwe ezirekhodiwe.')}`,
    `## ${t('Production spaces', 'Izindawo zokukhiqiza')}\n\n${beds.length ? beds.join('\n') : t('No production spaces recorded.', 'Azikho izindawo zokukhiqiza ezirekhodiwe.')}`,
    `## ${t('Evidence and limitations', 'Ubufakazi nemikhawulo')}\n\n${t('Site photos and map plates, where available, are shown separately in this report. An AI-generated reference photograph is not evidence of the real site. Missing measurements, quotes or records remain missing. Review the site, dates and evidence with the implementing organisation before using this example for a funding decision.', 'Izithombe zendawo namamephu, uma zikhona, ziboniswa ngokwehlukana kulo mbiko. Isithombe esiyisibonelo esikhiqizwe yi-AI asibona ubufakazi bendawo yangempela. Izilinganiso, amanani noma amarekhodi angekho zihlala zingekho. Buyekeza indawo, izinsuku nobufakazi nenhlangano ezosebenzisa uhlelo ngaphambi kokusebenzisa lesi sibonelo esinqumweni sokuxhasa ngezimali.')}`,
  ].join('\n\n');
}

/** Unreviewed AI drafts paired with the existing English and isiZulu source wording.
 * Saved names and catalogue identities never pass through this source lookup. */
export const REPORT_SUMMARY_COPY: readonly { english: string; zu: string; st: string; ts: string; ve: string }[] = [
  {
    "english": "Not recorded",
    "zu": "Akubhaliwe",
    "st": "Ha e a rekotwa",
    "ts": "A swi rhekhodiwanga",
    "ve": "A zwo ngo rekhodiwa"
  },
  {
    "english": "Site summary",
    "zu": "Isifinyezo sendawo",
    "st": "Kakaretso ya sebaka",
    "ts": "Nkatsakanyo wa ndhawu",
    "ve": "Manweledzo a fhethu"
  },
  {
    "english": "Mapped boundary",
    "zu": "Umngcele obalazwe",
    "st": "Moedi o takilweng mmapeng",
    "ts": "Ndzilakana lowu dirowiweke emepeni",
    "ve": "Mukano wo olwaho kha mapa"
  },
  {
    "english": "Mapped growing area",
    "zu": "Indawo yokutshala ebalazwe",
    "st": "Sebaka sa ho lema se takilweng mmapeng",
    "ts": "Ndhawu yo byala leyi dirowiweke emepeni",
    "ve": "Fhethu ha u lima ho olwaho kha mapa"
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
    "zu": "Iziza zezitshalo eziyisisekelo",
    "st": "Ditsha tsa dijalo tsa motheo",
    "ts": "Swiphemu swa swibyariwa swa swakudya swa nkoka",
    "ve": "Zwipiḓa zwa zwiliṅwa zwa zwiḽiwa zwa ndeme"
  },
  {
    "english": "Mapped space is not confirmation that all of it is currently in production.",
    "zu": "Indawo ebalazwe ayiqinisekisi ukuthi yonke isatshaliwe njengamanje.",
    "st": "Sebaka se takilweng mmapeng ha se tiisetso ya hore sohle se ntse se hlahisa dijalo hona jwale.",
    "ts": "Ndhawu leyi dirowiweke emepeni a hi xitiyisekiso xa leswaku hinkwato yi le ku humeleriseni ka swibyariwa sweswi.",
    "ve": "Fhethu ho olwaho kha mapa a hu khwaṱhisedzi uri hoṱhe hu khou bveledza zwiliṅwa zwino."
  },
  {
    "english": "Annual rainfall estimate",
    "zu": "Isilinganiso semvula yonyaka",
    "st": "Tekanyetso ya pula ya selemo",
    "ts": "Mpimanyeto wa mpfula ya lembe",
    "ve": "Ndinganyelo ya mvula ya ṅwaha"
  },
  {
    "english": "Soil",
    "zu": "Umhlabathi",
    "st": "Mobu",
    "ts": "Misava",
    "ve": "Mavu"
  },
  {
    "english": "lab result",
    "zu": "umphumela wokuhlolwa",
    "st": "sephetho sa laboratori",
    "ts": "mbuyelo wa laboratori",
    "ve": "mvelelo ya laboratori"
  },
  {
    "english": "SoilGrids model; confirm on site",
    "zu": "imodeli ye-SoilGrids; qinisekisa endaweni",
    "st": "mohlala wa SoilGrids; netefatsa sebakeng",
    "ts": "modlele wa SoilGrids; tiyisisa endhawini",
    "ve": "modele wa SoilGrids; khwaṱhisedzani fhethu"
  },
  {
    "english": "Not measured. Arrange a soil test.",
    "zu": "Awukahlolwa. Hlela ukuhlolwa komhlabathi.",
    "st": "Ha o a lekanngwa. Hlophisa teko ya mobu.",
    "ts": "A swi pimiwanga. Lulamisa nkambelo wa misava.",
    "ve": "A zwo ngo elwa. Dzudzanyani mulingo wa mavu."
  },
  {
    "english": "Stated tank capacity in the design",
    "zu": "Umthamo wamathangi obhalwe emklamweni",
    "st": "Bokgoni ba ditanka bo boletsweng moralong",
    "ts": "Vundzeni bya mathangi leri vuriweke eka pulani",
    "ve": "Vhungomu ha mathannga ho bulwaho kha pulane"
  },
  {
    "english": "Capacity is not water currently available; check which tanks are already installed.",
    "zu": "Umthamo awusho amanzi akhona manje; hlola ukuthi yimaphi amathangi asefakiwe.",
    "st": "Bokgoni ha se metsi a fumanehang hona jwale; hlahloba hore na ke ditanka dife tse seng di kentswe.",
    "ts": "Vundzeni a hi mati lama nga kona sweswi; kambela leswaku i mathangi wahi lama se ya nghenisiweke.",
    "ve": "Vhungomu a si maḓi ane a vha hone zwino; sedzani uri ndi mathannga afhio o no dzheniswaho."
  },
  {
    "english": "sow",
    "zu": "hlwanyela",
    "st": "jala",
    "ts": "byala hi mbewu",
    "ve": "zwala"
  },
  {
    "english": "once only",
    "zu": "kanye kuphela",
    "st": "hang feela",
    "ts": "kan’we ntsena",
    "ve": "luthihi fhedzi"
  },
  {
    "english": "includes an existing crop",
    "zu": "kufaka isitshalo esesikhona",
    "st": "e kenyelletsa sejalo se seng se le teng",
    "ts": "swi katsa xibyariwa lexi se xi nga kona",
    "ve": "zwi katela tshiliṅwa tshi re hone"
  },
  {
    "english": "No crop rows linked to this site were saved with this report.",
    "zu": "Ayikho imigqa yezitshalo exhunywe kule ndawo egcinwe nalo mbiko.",
    "st": "Ha ho mela ya dijalo e hokahaneng le sebaka sena e bolokilweng le tlaleho ena.",
    "ts": "A ku na tirheyi ta swibyariwa leti hlanganisiweke ni ndhawu leyi leti hlayisiweke ni xiviko lexi.",
    "ve": "A hu na mitaladzi ya zwiliṅwa yo ṱumanywaho na fhethu afha yo vhulungwaho na muvhigo uyu."
  },
  {
    "english": "This is the saved planting plan, not a harvest or sales record. Check actual bed clearance before each next planting.",
    "zu": "Lolu uhlelo lokutshala olugciniwe, alulona irekhodi lesivuno noma ukuthengisa. Hlola ukuthi umbhede usukhululekile ngaphambi kokutshala okulandelayo.",
    "st": "Ona ke moralo wa ho lema o bolokilweng, ha se rekoto ya kotulo kapa thekiso. Hlahloba hore bethe e hlile e lokolohile pele ho temo e nngwe le e nngwe e latelang.",
    "ts": "Leyi i pulani yo byala leyi hlayisiweke, a hi rhekhodo ya ntshovelo kumbe ku xavisa. Kambela leswaku mubedo wu tshunxekile hakunene u nga si byala leswi landzelaka.",
    "ve": "Iyi ndi pulane ya u zwala yo vhulungwaho, a si rekhodo ya khaṋo kana thengiso. Sedzani uri mubete a u na tshithu zwa vhukuma ni sa athu zwala zwi tevhelaho."
  },
  {
    "english": "For seed quantities, use the crop planner’s seed list. Do not buy seed from an inferred yield or monthly availability chart.",
    "zu": "Ngobuningi bembewu, sebenzisa uhlu lwembewu kuhlelo lwezitshalo. Ungathengi imbewu ngokwesivuno esiqageliwe noma ishadi lokutholakala kwenyanga.",
    "st": "Bakeng sa bongata ba peo, sebedisa lenane la peo la moralo wa dijalo. Se reke peo ho ya ka chai e hakantsweng kapa tjhate ya ho fumaneha ha dijo ka kgwedi.",
    "ts": "Eka nhlayo ya mbewu, tirhisa nxaxamelo wa mbewu wa xipulani xa swibyariwa. U nga xavi mbewu hi ku landza ntshovelo lowu kumbeteriweke kumbe chati ya ku kumeka hi n’hweti.",
    "ve": "Kha vhunzhi ha mbeu, shumisani mutevhe wa mbeu wa tshidzudzanyi tsha zwiliṅwa. Ni songo renga mbeu nga u tevhela khaṋo yo humbulwaho kana tshati ya u wanala nga ṅwedzi."
  },
  {
    "english": "Priced infrastructure subtotal",
    "zu": "Isamba sezindleko zengqalasizinda ezinentengo",
    "st": "Kakaretso e ka tlase ya meralo ya motheo e nang le ditheko",
    "ts": "Nhlayohansi wa switirhisiwa leswi nga ni minxavo",
    "ve": "Ṱhanganyelo ya themamveledziso i re na mitengo"
  },
  {
    "english": "Lines awaiting a price or measurement",
    "zu": "Imigqa elinde intengo noma isilinganiso",
    "st": "Mela e emetseng theko kapa tekanyo",
    "ts": "Tilayini leti yimeleke nxavo kumbe mpimo",
    "ve": "Mitaladzi yo lindelaho mutengo kana muṅwelo"
  },
  {
    "english": "Planned budget, not actual spending. A missing price is not zero. Obtain current local quotes.",
    "zu": "Lena ibhajethi ehleliwe, akuzona izimali esezisetshenzisiwe. Intengo engekho ayisho uziro. Thola amanani akamuva endaweni.",
    "st": "Ke tekanyetso e rerilweng, ha se tjhelete e seng e sebedisitswe. Theko e siyo ha e bolele lefela. Fumana ditheko tsa hona jwale tsa sebakeng.",
    "ts": "I mpimanyeto lowu kunguhatiweke, a hi mali leyi tirhisiweke hakunene. Nxavo lowu nga riki kona a wu vuli ziro. Kuma minxavo ya sweswi ya le ndhawini.",
    "ve": "Ndi mugaganyagwama wo dzudzanywaho, a si tshelede yo no shumiswaho. Mutengo u siho a si nothe. Wanani mitengo ya zwino ya henefho."
  },
  {
    "english": "Crop rows",
    "zu": "Imigqa yezitshalo",
    "st": "Mela ya dijalo",
    "ts": "Tirheyi ta swibyariwa",
    "ve": "Mitaladzi ya zwiliṅwa"
  },
  {
    "english": "More crop rows are listed in the five-page or full report.",
    "zu": "Eminye imigqa yezitshalo isembikweni wamakhasi amahlanu noma ogcwele.",
    "st": "Mela e meng ya dijalo e thathamisitswe tlalehong ya maqephe a mahlano kapa tlalehong e felletseng.",
    "ts": "Tirheyi tin’wana ta swibyariwa ti xaxametiwile eka xiviko xa matluka ya ntlhanu kumbe lexi heleleke.",
    "ve": "Miṅwe mitaladzi ya zwiliṅwa yo ṅwalwa kha muvhigo wa masiaṱari maṱanu kana muvhigo wo fhelelaho."
  },
  {
    "english": "Next: verify the land measurements, soil and water supply; confirm the crop plan and obtain missing quotes.",
    "zu": "Okulandelayo: qinisekisa izilinganiso zomhlaba, umhlabathi namanzi; qinisekisa uhlelo lwezitshalo uthole namanani angekho.",
    "st": "Ho latelang: netefatsa ditekanyo tsa mobu, boemo ba mobu le phepelo ya metsi; netefatsa moralo wa dijalo mme o fumane ditheko tse siyo.",
    "ts": "Lexi landzelaka: tiyisisa mipimo ya ndhawu, misava ni mphakelo wa mati; tiyisisa pulani ya swibyariwa kutani u kuma minxavo leyi kayivelaka.",
    "ve": "Zwi tevhelaho: khwaṱhisedzani miṅwelo ya fhethu, mavu na mphakelo wa maḓi; khwaṱhisedzani pulane ya zwiliṅwa ni wane mitengo i siho."
  },
  {
    "english": "Crop plan",
    "zu": "Uhlelo lwezitshalo",
    "st": "Moralo wa dijalo",
    "ts": "Pulani ya swibyariwa",
    "ve": "Pulane ya zwiliṅwa"
  },
  {
    "english": "Water, soil and the mapped site",
    "zu": "Amanzi, umhlabathi nendawo ebalazwe",
    "st": "Metsi, mobu le sebaka se takilweng mmapeng",
    "ts": "Mati, misava ni ndhawu leyi dirowiweke emepeni",
    "ve": "Maḓi, mavu na fhethu ho olwaho kha mapa"
  },
  {
    "english": "Traced roof",
    "zu": "Uphahla olulinganisiwe",
    "st": "Marule a takilweng mmapeng",
    "ts": "Lwangu leri dirowiweke emepeni",
    "ve": "Ṱhanga yo olwaho kha mapa"
  },
  {
    "english": "existing",
    "zu": "ikhona",
    "st": "e seng e le teng",
    "ts": "lexi se xi nga kona",
    "ve": "tshi re hone"
  },
  {
    "english": "planned",
    "zu": "ihleliwe",
    "st": "e rerilweng",
    "ts": "lexi kunguhatiweke",
    "ve": "tsho dzudzanywaho"
  },
  {
    "english": "mixed status",
    "zu": "isimo esixubile",
    "st": "boemo bo tswakantsweng",
    "ts": "xiyimo lexi pfanganisiweke",
    "ve": "vhuimo ho ṱanganelanaho"
  },
  {
    "english": "Confirm water reliability, drainage and soil condition on the ground before construction or amendment purchases.",
    "zu": "Qinisekisa ukutholakala kwamanzi, ukuphuma kwamanzi nesimo somhlabathi ngaphambi kokwakha noma ukuthenga izinto zokulungisa umhlabathi.",
    "st": "Netefatsa botshepehi ba phepelo ya metsi, phallo ya metsi le boemo ba mobu sebakeng pele ho kaho kapa ho reka dintho tsa ho lokisa mobu.",
    "ts": "Tiyisisa ku tshembeka ka mati, ku huma ka mati ni xiyimo xa misava endhawini u nga si aka kumbe ku xava swo antswisa misava.",
    "ve": "Khwaṱhisedzani u fulufhedzea ha maḓi, u bva ha maḓi na vhuimo ha mavu fhethu ni sa athu fhaṱa kana u renga zwa u khwinisa mavu."
  },
  {
    "english": "Bill of quantities",
    "zu": "Uhlu lobuningi nezindleko",
    "st": "Lenane la bongata le ditjeho",
    "ts": "Nxaxamelo wa mimpimo ni swibalo swa mali",
    "ve": "Mutevhe wa vhunzhi na mbadelo"
  },
  {
    "english": "existing; excluded from new spend",
    "zu": "ikhona; ayifakiwe ezindlekweni ezintsha",
    "st": "e seng e le teng; ha e kenyeletswe ditjehong tse ntjha",
    "ts": "lexi se xi nga kona; a xi katsiwanga eka mali leyintshwa yo tirhisa",
    "ve": "tshi re hone; a tsho ngo katelwa kha mbadelo ntswa"
  },
  {
    "english": "quote / measurement needed",
    "zu": "kudingeka intengo / isilinganiso",
    "st": "ho hlokahala theko / tekanyo",
    "ts": "ku laveka nxavo / mpimo",
    "ve": "hu ṱoḓea mutengo / muṅwelo"
  },
  {
    "english": "Next actions and checks",
    "zu": "Izinyathelo ezilandelayo nokuhlola",
    "st": "Mehato le ditlhahlobo tse latelang",
    "ts": "Magoza ni minkambelo leyi landzelaka",
    "ve": "Nyito na tsedzuluso zwi tevhelaho"
  },
  {
    "english": "Confirm what is already on the site and what is still proposed. Keep the saved design as the reference.",
    "zu": "Qinisekisa okukhona endaweni nokusahleliwe. Sebenzisa umklamo ogciniwe njengereferensi.",
    "st": "Netefatsa se seng se le teng sebakeng le se ntseng se sisinngwa. Boloka moralo o bolokilweng e le sesupo.",
    "ts": "Tiyisisa leswi se swi nga kona endhawini ni leswi swa ha ringanyetiwaka. Tirhisa pulani leyi hlayisiweke ku kongomisa.",
    "ve": "Khwaṱhisedzani zwi re hone fhethu na zwine zwa kha ḓi tou dzinginywa. Shumisani pulane yo vhulungwaho sa tshisumbedzi."
  },
  {
    "english": "Check the crop plan against the real beds and seasonal conditions. A planned sowing is not proof of planting.",
    "zu": "Qhathanisa uhlelo lwezitshalo nemibhede yangempela nezimo zesizini. Ukuhlwanyela okuhleliwe akubona ubufakazi bokuthi sekutshaliwe.",
    "st": "Bapisa moralo wa dijalo le dibethe tsa nnete le maemo a sehla. Ho jala ho rerilweng ha se bopaki ba hore ho jetswe.",
    "ts": "Kambela pulani ya swibyariwa hi ku yi pimanisa ni mibedo ya xiviri ni swiyimo swa nguva. Ku byala loku kunguhatiweke a hi vumbhoni bya leswaku ku byariwile.",
    "ve": "Sedzani pulane ya zwiliṅwa ni i vhambedze na mibete ya vhukuma na nyimele dza khalanwaha. U zwala ho dzudzanywaho a si vhuṱanzi ha uri ho zwaliwa."
  },
  {
    "english": "Record harvest weight, food kept or donated, sales and costs with their dates.",
    "zu": "Bhala isisindo sesivuno, ukudla okugciniwe noma okunikelwe, ukuthengisa nezindleko kanye nezinsuku zakho.",
    "st": "Rekota boima ba kotulo, dijo tse bolokilweng kapa tse fanweng, thekiso le ditjeho hammoho le matsatsi a tsona.",
    "ts": "Rhekhoda ntiko wa ntshovelo, swakudya leswi hlayisiweke kumbe ku nyiketiwa, ku xavisa ni swibalo swa mali ni masiku ya swona.",
    "ve": "Rekhodani tshileme tsha khaṋo, zwiḽiwa zwo vhulungwaho kana zwo ṋetshedzwaho, thengiso na mbadelo na madatumu azwo."
  },
  {
    "english": "Check production area on site before reporting hectares to a funder. Count each physical bed once.",
    "zu": "Hlola indawo ekhiqizayo ngaphambi kokubika amahektha kumxhasi. Bala umbhede ngamunye kanye.",
    "st": "Lekola sebaka se hlahisang dijalo sebakeng pele o tlalehela mofani wa tjhelete dihekthere. Bala bethe ka nngwe ya nnete hang feela.",
    "ts": "Kambela ndhawu yo humelerisa endhawini u nga si vika tihekitara eka munyiki wa mali. Hlayela mubedo wun’wana ni wun’wana wa xiviri kan’we ntsena.",
    "ve": "Sedzani fhethu ha mveledziso henefho ni sa athu vhiga dzihekithara kha muṋetshedzi wa masheleni. Vhalani mubete muṅwe na muṅwe wa vhukuma luthihi fhedzi."
  },
  {
    "english": "Agree support actions with the farmer. At review, record what improved, what did not and what needs to change.",
    "zu": "Vumelana nomlimi ngezinyathelo zosizo. Ekubuyekezeni, bhala okuthuthukile, okungathuthukanga nokudinga ukushintsha.",
    "st": "Dumellanang le molemi ka mehato ya tshehetso. Ha ho hlahlojwa, rekota se ntlafetseng, se sa ntlafalang le se hlokang ho fetoha.",
    "ts": "Pfumelelanani ni murimi hi magoza ya nseketelo. Loko ku kambisisiwa, rhekhoda leswi antsweke, leswi nga antswangiki ni leswi faneleke ku cinca.",
    "ve": "Tendelani na mulimi nga nyito dza thikhedzo. Musi ni tshi sedzulusa, rekhodani zwo khwinifhalaho, zwi songo khwinifhalaho na zwine zwa tea u shanduka."
  },
  {
    "english": "This summary uses saved measurements and plan quantities. Read the full report for detailed advice, assumptions and source notes.",
    "zu": "Lesi sifinyezo sisebenzisa izilinganiso ezigciniwe nobuningi bohlelo. Funda umbiko ogcwele ngezeluleko eziningiliziwe, okucatshangiwe namanothi emithombo.",
    "st": "Kakaretso ena e sebedisa ditekanyo tse bolokilweng le bongata ba moralo. Bala tlaleho e felletseng bakeng sa dikeletso tse qaqileng, dikakanyo le dintlha tsa mehlodi.",
    "ts": "Nkatsakanyo lowu wu tirhisa mipimo leyi hlayisiweke ni mimpimo ya pulani. Hlaya xiviko lexi heleleke ku kuma switsundzuxo leswi nga ni vuxokoxoko, leswi ehleketeleriweke ni tinotsi ta swihlovo.",
    "ve": "Manweledzo aya a shumisa miṅwelo yo vhulungwaho na vhunzhi ha pulane. Vhalani muvhigo wo fhelelaho u wana nyeletshedzo dzo dodombedzwaho, zwo humbulwaho na notsi dza zwiko."
  },
  {
    "english": "report basis",
    "zu": "Isisekelo sombiko",
    "st": "motheo wa tlaleho",
    "ts": "xisekelo xa xiviko",
    "ve": "mutheo wa muvhigo"
  },
  {
    "english": "This ready-to-read sample is assembled from the saved site and design records. It is not a new AI analysis or an independently verified assessment. Sample finances, soil examples and household examples remain illustrative wherever labelled. Planned areas and infrastructure do not establish completed work.",
    "zu": "Lesi yisibonelo esilungiselelwe ukufundeka, esakhiwe ngamarekhodi agciniwe endawo nawomklamo. Asikona ukuhlaziywa okusha kwe-AI noma ukuhlolwa okuzimele okuqinisekisiwe. Izibonelo zezimali, zomhlabathi nezasekhaya ziyizibonelo zokubonisa kuphela uma zibhalwe kanjalo. Izindawo nengqalasizinda okuhleliwe akufakazeli ukuthi umsebenzi usuqediwe.",
    "st": "Mohlala ona o loketseng ho balwa o bopilwe ka direkoto tse bolokilweng tsa sebaka le moralo. Ha se tlhahlobo e ntjha ya AI kapa tlhahlobo e netefaditsweng ka boikemelo. Mehlala ya ditjhelete, mobu le malapa e ntse e le ya ho bontsha feela moo e ngotsweng jwalo. Dibaka le meralo ya motheo e rerilweng ha e tiise hore mosebetsi o phethilwe.",
    "ts": "Xikombiso lexi lunghekeleke ku hlayiwa xi hlengeletiwe hi tirhekhodo ta ndhawu ni pulani leti hlayisiweke. A hi nkambisiso lowuntshwa wa AI kumbe nkambelo lowu tiyisisiweke hi ku tiyimela. Timali ta swikombiso, swikombiso swa misava ni swa mindyangu swa ha ri swo komba ntsena laha swi tsariweke tano. Tindhawu ni switirhisiwa leswi kunguhatiweke a swi tiyisisi leswaku ku tirhiwile ku hela.",
    "ve": "Tsumbo iyi yo lugelaho u vhalwa yo kuvhanganywa kha rekhodo dza fhethu na pulane dzo vhulungwaho. A si tsenguluso ntswa ya AI kana tsedzuluso yo khwaṱhisedzwaho nga yoṱhe. Tsumbo dza masheleni, mavu na miṱa dzi dzula dzi tsumbo fhedzi hoṱhe hune dza ṅwalwa nga u ralo. Fhethu na themamveledziso zwo dzudzanywaho a zwi khwaṱhisedzi mushumo wo fhelelaho."
  },
  {
    "english": "Full design inventory",
    "zu": "Uhlu oluphelele lomklamo",
    "st": "Lenane le felletseng la moralo",
    "ts": "Nxaxamelo lowu heleleke wa pulani",
    "ve": "Mutevhe wo fhelelaho wa pulane"
  },
  {
    "english": "No placed elements recorded.",
    "zu": "Akukho zinto ezibekiwe ezirekhodiwe.",
    "st": "Ha ho dintho tse behilweng tse rekotilweng.",
    "ts": "A ku rhekhodiwanga swiphemu leswi vekiweke.",
    "ve": "A hu na zwipiḓa zwo vhewaho zwo rekhodiwaho."
  },
  {
    "english": "Production spaces",
    "zu": "Izindawo zokukhiqiza",
    "st": "Dibaka tsa tlhahiso",
    "ts": "Tindhawu to humelerisa",
    "ve": "Fhethu ha mveledziso"
  },
  {
    "english": "No production spaces recorded.",
    "zu": "Azikho izindawo zokukhiqiza ezirekhodiwe.",
    "st": "Ha ho dibaka tsa tlhahiso tse rekotilweng.",
    "ts": "A ku rhekhodiwanga tindhawu to humelerisa.",
    "ve": "A hu na fhethu ha mveledziso ho rekhodiwaho."
  },
  {
    "english": "Evidence and limitations",
    "zu": "Ubufakazi nemikhawulo",
    "st": "Bopaki le meedi",
    "ts": "Vumbhoni ni swipimelo",
    "ve": "Vhuṱanzi na mikano"
  },
  {
    "english": "Site photos and map plates, where available, are shown separately in this report. An AI-generated reference photograph is not evidence of the real site. Missing measurements, quotes or records remain missing. Review the site, dates and evidence with the implementing organisation before using this example for a funding decision.",
    "zu": "Izithombe zendawo namamephu, uma zikhona, ziboniswa ngokwehlukana kulo mbiko. Isithombe esiyisibonelo esikhiqizwe yi-AI asibona ubufakazi bendawo yangempela. Izilinganiso, amanani noma amarekhodi angekho zihlala zingekho. Buyekeza indawo, izinsuku nobufakazi nenhlangano ezosebenzisa uhlelo ngaphambi kokusebenzisa lesi sibonelo esinqumweni sokuxhasa ngezimali.",
    "st": "Dinepe tsa sebaka le maqephe a dimmapa, moo di fumanehang, di bontshwa ka thoko tlalehong ena. Senepe sa mohlala se entsweng ke AI ha se bopaki ba sebaka sa nnete. Ditekanyo, ditheko kapa direkoto tse siyo di ntse di le siyo. Hlahlobang sebaka, matsatsi le bopaki le mokgatlo o phethahatsang mosebetsi pele le sebedisa mohlala ona ho etsa qeto ya tjhelete.",
    "ts": "Swifaniso swa ndhawu ni maphepha ya mimepe, laha swi kumekaka, swi kombisiwa hi ku hambana eka xiviko lexi. Xifaniso xa xikombiso lexi endliweke hi AI a hi vumbhoni bya ndhawu ya xiviri. Mipimo, minxavo kumbe tirhekhodo leti kayivelaka ta ha kayivela. Kambisisani ndhawu, masiku ni vumbhoni ni nhlangano lowu tirhisaka pulani u nga si tirhisa xikombiso lexi eka xiboho xa ku nyika mali.",
    "ve": "Zwinepe zwa fhethu na masiaṱari a mimapa, hune zwa wanala hone, zwi sumbedzwa nga thungo kha muvhigo uyu. Tshinepe tsha tsumbo tsho itwaho nga AI a si vhuṱanzi ha fhethu ha vhukuma. Miṅwelo, mitengo kana rekhodo zwi siho zwi dzula zwi siho. Sedzulusani fhethu, madatumu na vhuṱanzi na dzangano ḽine ḽa ita mushumo ni sa athu shumisa tsumbo iyi kha tsheo ya u ṋetshedza masheleni."
  },
  {
    "english": "Additional detail is in the full report.",
    "zu": "Eminye imininingwane isembikweni ogcwele.",
    "st": "Dintlha tse ding di tlalehong e felletseng.",
    "ts": "Vuxokoxoko byin’wana byi le ka xiviko lexi heleleke.",
    "ve": "Zwiṅwe zwidodombedzwa zwi kha muvhigo wo fhelelaho."
  },
  {
    "english": "Verify measurements and costs before acting.",
    "zu": "Qinisekisa izilinganiso nezindleko ngaphambi kokusebenza.",
    "st": "Netefatsa ditekanyo le ditjeho pele o nka bohato.",
    "ts": "Tiyisisa mipimo ni swibalo swa mali u nga si tirha.",
    "ve": "Khwaṱhisedzani miṅwelo na mbadelo ni sa athu ita mushumo."
  },
  {
    "english": "Draft translation · not reviewed by a fluent speaker.",
    "zu": "Uhlaka lokuhumusha · alukabuyekezwa umuntu olukhuluma kahle ulimi.",
    "st": "Moralo wa phetolelo · ha o so hlahlojwe ke sebui se phollatsi.",
    "ts": "Vuhundzuluxeri byo sungula · a byi si kambisisiwa hi muvulavuri la nga ni vuswikoti.",
    "ve": "Mvetamveto ya ṱhalutshedzo · a i athu sedzuluswa nga muambi a konaho luambo."
  },
  {
    "english": "bed",
    "zu": "umbhede",
    "st": "bethe",
    "ts": "mubedo",
    "ve": "mubete"
  },
  {
    "english": "plot",
    "zu": "isiza",
    "st": "setsha",
    "ts": "xiphemu",
    "ve": "tshipiḓa"
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
    "english": "Vegetable beds established ({count} bed)",
    "zu": "Imibhede yemifino eyenziwe (umbhede ongu-{count})",
    "st": "Dibethe tsa meroho tse thehilweng (bethe e {count})",
    "ts": "Mibedo ya matsavu leyi endliweke (mubedo wa {count})",
    "ve": "Mibete ya miroho yo itwaho (mubete wa {count})"
  },
  {
    "english": "Vegetable beds established ({count} beds)",
    "zu": "Imibhede yemifino eyenziwe (imibhede engu-{count})",
    "st": "Dibethe tsa meroho tse thehilweng (dibethe tse {count})",
    "ts": "Mibedo ya matsavu leyi endliweke (mibedo ya {count})",
    "ve": "Mibete ya miroho yo itwaho (mibete ya {count})"
  },
  {
    "english": "Staple plots established ({count} plot)",
    "zu": "Iziza zezitshalo eziyisisekelo ezenziwe (isiza esingu-{count})",
    "st": "Ditsha tsa dijalo tsa motheo tse thehilweng (setsha se {count})",
    "ts": "Swiphemu swa swibyariwa swa swakudya swa nkoka leswi endliweke (xiphemu xa {count})",
    "ve": "Zwipiḓa zwa zwiliṅwa zwa zwiḽiwa zwa ndeme zwo itwaho (tshipiḓa tsha {count})"
  },
  {
    "english": "Staple plots established ({count} plots)",
    "zu": "Iziza zezitshalo eziyisisekelo ezenziwe (iziza ezingu-{count})",
    "st": "Ditsha tsa dijalo tsa motheo tse thehilweng (ditsha tse {count})",
    "ts": "Swiphemu swa swibyariwa swa swakudya swa nkoka leswi endliweke (swiphemu swa {count})",
    "ve": "Zwipiḓa zwa zwiliṅwa zwa zwiḽiwa zwa ndeme zwo itwaho (zwipiḓa zwa {count})"
  },
  {
    "english": "Listed plant on saved plan",
    "zu": "Isitshalo esisohlwini olulawulwayo ohlelweni olugciniwe",
    "st": "Semela se lenaneng le laolwang moralong o bolokilweng",
    "ts": "Ximilana lexi nga eka nxaxamelo lowu lawuriwaka eka pulani leyi hlayisiweke",
    "ve": "Tshimela tshi re kha mutevhe wo laedzwaho kha pulane yo vhulungwaho"
  }
];

const summaryCopy = new Map(REPORT_SUMMARY_COPY.map(row => [row.english, row]));
export function reportSummaryText(english: string, language: string, values: Record<string, string | number> = {}, legacyZulu?: string): string {
  const row = summaryCopy.get(english);
  // isiXhosa: the draft keyed by the exact English template (lib/locales/xh-inline), else English.
  const template = language === 'zu' && legacyZulu !== undefined ? legacyZulu
    : language === 'xh' ? xhInlineDraft(english) ?? english
    : row && (language === 'zu' || language === 'st' || language === 'ts' || language === 've') ? row[language] : english;
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => Object.hasOwn(values, key) ? String(values[key]) : placeholder);
}

const summaryMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function summaryMonth(month: string, language: string): string {
  const index = summaryMonths.indexOf(month);
  return index < 0 ? month : recordsMonthShort(language, index + 1);
}

export function summaryBoqDescription(line: BoqLine, language: string): string {
  const source = line.descriptionSource;
  if (!source) return line.description;
  if (source.kind === 'listed-plant') return reportSummaryText('Listed plant on saved plan', language);
  const english = source.kind === 'beds'
    ? source.count === 1 ? 'Vegetable beds established ({count} bed)' : 'Vegetable beds established ({count} beds)'
    : source.count === 1 ? 'Staple plots established ({count} plot)' : 'Staple plots established ({count} plots)';
  return reportSummaryText(english, language, { count: source.count });
}
