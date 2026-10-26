import { recordsDate } from './records-months.ts';
import { numberLabel } from '@/lib/format-figures';
import type { CompletionScoreInputs } from './completion-score';
import type { EvidenceItem } from './site-evidence';
import { hasDrawnDesign, type ReportSiteFacts } from './report-site-facts';

export type ReportDesignRecords = {
  /** Current site facts, never the earlier saved report's snapshot. */
  facts?: ReportSiteFacts | null;
  /** Same selected sheets the report displays; null while their metadata loads. */
  maps?: { count: number; latestAt?: string } | null;
};

function designPreparation(inputs: CompletionScoreInputs, records: ReportDesignRecords, language: string): ReportPreparation[] {
  const copy = (source: string, values?: Record<string, string | number>) => reportPreparationText(source, language, values);
  const boundary = records.facts?.boundary;
  const perimeter = boundary?.perimeterM;
  const fenceM = records.facts?.design?.routes.filter(route => route.kind === 'fence')
    .reduce((sum, route) => sum + route.totalLengthM, 0) ?? 0;
  const number = (value: number) => numberLabel(value, 1);
  const dimensions = [
    boundary && boundary.areaM2 > 0 ? copy('Area {area} m²', { area: number(boundary.areaM2) }) : '',
    perimeter && perimeter > 0 ? copy('perimeter {perimeter} m', { perimeter: number(perimeter) }) : '',
  ].filter(Boolean).join(' · ');
  const fence = fenceM > 0 ? copy('Fence lines: {length} m. These may include internal fences.', { length: number(fenceM) }) : '';
  const traced = inputs.boundaryPointCount >= 3 || !!dimensions;
  const hasDesign = inputs.zoneCount > 0 || inputs.elementCount > 0 || hasDrawnDesign(records.facts);
  const mapCount = records.maps?.count ?? 0;
  const latest = records.maps?.latestAt;
  const date = latest && Number.isFinite(Date.parse(latest))
    ? recordsDate(language, new Date(latest), true) : '';
  return [
    {
      id: 'boundary', title: copy('Boundary & measurements'),
      status: dimensions ? copy('Boundary measurements available') : fenceM > 0 ? copy('Fence measurements available') : traced ? copy('Boundary outline saved') : copy('Boundary not recorded'),
      hasRecord: traced || fenceM > 0,
      action: traced || fenceM > 0 ? copy('View boundary and measurements') : copy('Add boundary'),
      detail: dimensions
        ? `${dimensions}. ${boundary?.source ?? ''}. ${fence} ${copy('Use the saved dimensions; record any ground-check corrections in the design.')}`
        : `${traced ? copy('The outline is saved; dimensions are not available in this view.') : fenceM > 0 ? copy('A fence line does not establish the complete property outline.') : copy('Trace the property outline in the Design Map to calculate its area and perimeter.')} ${fence}`.trim(),
    },
    {
      id: 'design', title: copy('Site design'),
      status: mapCount > 0 ? copy(mapCount === 1 ? '{count} saved design map available' : '{count} saved design maps available', { count: mapCount }) : hasDesign ? copy('Design records saved') : records.maps === null ? copy('Checking saved design maps…') : copy('Design not recorded'),
      hasRecord: hasDesign || mapCount > 0,
      action: mapCount > 0 ? copy('View saved design maps') : hasDesign ? copy('View saved design') : copy('Open Design Map'),
      detail: mapCount > 0
        ? copy('Your saved sheets are available in this report{latest}. Open them to review or include them in the full PDF.', { latest: date ? copy('; latest saved {date}', { date }) : '' })
        : `${hasDesign ? copy('Your saved layout is available in the Design Map. ') : ''}${records.maps === null ? copy('Checking this browser for saved sheets.') : copy('No saved map sheets found in this browser for this site. If you saved them on another device, open that device’s report.')}`,
    },
  ];
}

export type ReportPreparation = { id: 'photos'|'soil'|'water'|'survey'|'boundary'|'design'|'crops'; title:string; status:string; detail:string; action:string; hasRecord:boolean };
/** Presence is preparation, never a claim of accuracy, lab verification or a finished design. */
export function reportPreparation(inputs: CompletionScoreInputs, evidence: Record<string,EvidenceItem[]>, records: ReportDesignRecords = {}, language = 'en'): ReportPreparation[] {
  const copy = (source: string, values?: Record<string, string | number>) => reportPreparationText(source, language, values);
  const photos=Object.entries(evidence).filter(([key])=>!key.startsWith('land_legal_')&&!key.endsWith('_lab_result')).flatMap(([,rows])=>rows).filter(row=>row.type==='photo'&&!!row.dataUrl).length;
  function lab(kind:'soil'|'water'): ReportPreparation {
    const rows=evidence[`${kind}_lab_result`]??[];
    const notes=rows.some(row=>!!row.note?.trim());
    const files=rows.some(row=>!!row.documentId||row.type==='photo'&&!!row.dataUrl);
    const references=rows.some(row=>row.type==='pdf'&&!!row.name);
    return {id:kind,title:kind==='soil'?copy('Soil sample & test results'):copy('Water sample & test results'),status:notes?copy('Results entered · review source'):files?copy('Document added · enter key results'):references?copy('Filename only · original needed'):copy('Test results not recorded'),hasRecord:notes||files,action:kind==='soil'?copy('Add soil test results'):copy('Add water test results'),detail:copy('Add the sampling date, location / sample ID, laboratory and results with units. Retain the original PDF or photograph and enter the values the report should use.')};
  }
  return [
    {id:'photos',title:copy('Site photographs'),status:photos?copy(photos===1?'{count} site photograph saved':'{count} site photographs saved',{count:photos}):copy('Site photos needed'),hasRecord:photos>0,action:copy('Add site photos'),detail:copy('Show the whole site, growing areas, slopes, access and water sources. Include views that explain the conditions on the ground.')},
    lab('soil'),lab('water'),
    {id:'survey',title:copy('Site & household survey'),status:copy('{filled} of {total} key checks recorded',{filled:inputs.surveyFilledFields,total:inputs.surveyTotalFields}),hasRecord:inputs.surveyFilledFields>0,action:copy('Complete or review survey'),detail:copy('Record your goals, people, current production, water access, soil observations and challenges. Review the full survey before generating.')},
    ...designPreparation(inputs, records, language),
    {id:'crops',title:copy('Planting plan'),status:inputs.hasCropPlan?copy('Plantings recorded · review coverage'):copy('Planting plan not recorded'),hasRecord:inputs.hasCropPlan,action:copy('Complete planting plan'),detail:copy('Choose crops for the site’s beds and record planting dates. Check any areas that still have no plan.')},
  ];
}

/** Unreviewed AI drafts, paired with the unchanged English source. Farmer labels and evidence stay verbatim.
 * This small pure source table also serves server/PDF callers without loading the client UI dictionaries. */
export const REPORT_PREPARATION_COPY: readonly { english: string; zu: string; st: string; ts: string; ve: string }[] = [
  {
    "english": "Improve this report",
    "zu": "Yengeza ulwazi kulo mbiko",
    "st": "Ntlafatsa tlaleho ena",
    "ts": "Antswisa xiviko lexi",
    "ve": "Khwinisani uyu muvhigo"
  },
  {
    "english": "{count} of 7 areas have records · see what to add or review",
    "zu": "Izigaba ezingu-{count} kwezingu-7 zinamarekhodi · bheka ongakwengeza noma okubuyekezayo",
    "st": "Dikarolo tse {count} ho tse 7 di na le direkoto · bona seo o ka se eketsang kapa wa se hlahloba",
    "ts": "Swiyenge swa {count} eka 7 swi na tirhekhodo · vona leswi u nga swi engetelaka kumbe ku swi kambisisa",
    "ve": "Zwipiḓa zwa {count} kha 7 zwi na rekhodo · vhonani zwine na nga engedza kana u sedzulusa"
  },
  {
    "english": "Generate with the information you have, or add more evidence first. Records present do not mean the information has been checked or the design is finished.",
    "zu": "Khiqiza umbiko ngolwazi onalo, noma uqale wengeze ubufakazi. Ukuba namarekhodi akusho ukuthi ulwazi seluhloliwe noma umklamo usuqediwe.",
    "st": "Hlahisa tlaleho ka boitsebiso boo o nang le bona, kapa eketsa bopaki pele. Ho ba le direkoto ha ho bolele hore boitsebiso bo hlahlobilwe kapa moralo o phethilwe.",
    "ts": "Endla xiviko hi vuxokoxoko bya wena, kumbe rhanga u engetela vumbhoni. Ku va ni tirhekhodo a swi vuli leswaku vuxokoxoko byi kamberiwile kumbe pulani yi hetiwile.",
    "ve": "Itani muvhigo nga mafhungo ane na vha nao, kana ni thome nga u engedza vhuṱanzi. U vha na rekhodo a zwi ambi uri mafhungo o sedzuluswa kana pulane yo fhela."
  },
  {
    "english": "This checklist describes your current site. The saved report remains an earlier snapshot; generate a new report to use updated evidence.",
    "zu": "Lolu hlu luchaza indawo yakho njengamanje. Umbiko ogciniwe usamile olwazini lwangaphambilini; khiqiza umbiko omusha ukuze usebenzise ubufakazi obubuyekeziwe.",
    "st": "Lenane lena le hlalosa sebaka sa hao sa hona jwale. Tlaleho e bolokilweng e ntse e bontsha boemo ba pele; hlahisa tlaleho e ntjha ho sebedisa bopaki bo ntjhafaditsweng.",
    "ts": "Nxaxamelo lowu wu hlamusela ndhawu ya wena ya sweswi. Xiviko lexi hlayisiweke xi ha komba xiyimo xa khale; endla xiviko lexintshwa ku tirhisa vumbhoni byo pfuxetiwa.",
    "ve": "Mutevhe uyu u ṱalusa fhethu haṋu ha zwino. Muvhigo wo vhulungwaho u kha ḓi sumbedza vhuimo ha kale; itani muvhigo muswa u shumisa vhuṱanzi ho khwiniswaho."
  },
  {
    "english": "Name and save this site to attach its evidence",
    "zu": "Nike igama lale ndawo uyigcine ukuze unamathisele ubufakazi bayo",
    "st": "Reha sebaka sena lebitso o se boloke ho hokela bopaki ba sona",
    "ts": "Nyika ndhawu leyi vito u yi hlayisa ku namarheta vumbhoni bya yona",
    "ve": "Ṋeani fhethu afha dzina ni vhu vhulunge uri ni ṱumekedze vhuṱanzi haho"
  },
  {
    "english": "Your garden or site name",
    "zu": "Igama lengadi noma lendawo yakho",
    "st": "Lebitso la tshimo kapa sebaka sa hao",
    "ts": "Vito ra ntanga kumbe ndhawu ya wena",
    "ve": "Dzina ḽa ngade kana fhethu haṋu"
  },
  {
    "english": "Save site",
    "zu": "Gcina indawo",
    "st": "Boloka sebaka",
    "ts": "Hlayisa ndhawu",
    "ve": "Vhulungani fhethu"
  },
  {
    "english": "The site could not be saved. Keep this page open and try again.",
    "zu": "Indawo ayikwazanga ukugcinwa. Gcina leli khasi livuliwe bese uzama futhi.",
    "st": "Sebaka ha se a bolokeha. Boloka leqephe lena le butswe mme o leke hape.",
    "ts": "Ndhawu a yi hlayisekanga. Tshika tluka leri ri pfulekile kutani u ringeta nakambe.",
    "ve": "Fhethu a ho ngo vhulungea. Litshani siaṱari iḽi ḽo vulea ni lingedze hafhu."
  },
  {
    "english": "Climate and regional soil layers provide context. They do not replace your site observations or laboratory measurements.",
    "zu": "Idatha yesimo sezulu nomhlabathi wesifunda inikeza umongo. Ayithathi indawo yalokho okubone endaweni noma izilinganiso zaselabhorethri.",
    "st": "Datha ya tlelaemete le ya mobu wa lebatowa e fana ka moelelo. Ha e nke sebaka sa tseo o di boneng sebakeng sa hao kapa ditekanyo tsa laboratori.",
    "ts": "Datha ya maxelo ni ya misava ya xifundzha yi nyika mongo. A yi sivi leswi u swi voneke endhawini ya wena kumbe mipimo ya le laboratori.",
    "ve": "Data ya kilima na ya mavu a dzingu i ṋea nyimele. A i dzhieli vhudzulo zwe na zwi vhona fhethu haṋu kana miṅwelo ya laboratori."
  },
  {
    "english": "Site evidence updated. Choose Generate new report to include it in the advice.",
    "zu": "Ubufakazi bendawo bubuyekeziwe. Khetha okuthi Khiqiza umbiko omusha ukuze bufakwe ezelulekweni.",
    "st": "Bopaki ba sebaka bo ntjhafaditswe. Kgetha Hlahisa tlaleho e ntjha ho bo kenyelletsa dikeletsong.",
    "ts": "Vumbhoni bya ndhawu byi pfuxetiwile. Hlawula Endla xiviko lexintshwa ku byi katsa eka switsundzuxo.",
    "ve": "Vhuṱanzi ha fhethu ho khwiniswa. Nangani Itani muvhigo muswa u vhu katela kha nyeletshedzo."
  },
  {
    "english": "Site photographs",
    "zu": "Izithombe zendawo",
    "st": "Dinepe tsa sebaka",
    "ts": "Swifaniso swa ndhawu",
    "ve": "Zwinepe zwa fhethu"
  },
  {
    "english": "Soil sample & test results",
    "zu": "Amasampula omhlabathi nemiphumela yokuhlola",
    "st": "Sampole ya mobu le diphetho tsa diteko",
    "ts": "Sampulu ya misava ni mimbuyelo ya nkambelo",
    "ve": "Sambula ya mavu na mvelelo dza mulingo"
  },
  {
    "english": "Water sample & test results",
    "zu": "Amasampula amanzi nemiphumela yokuhlola",
    "st": "Sampole ya metsi le diphetho tsa diteko",
    "ts": "Sampulu ya mati ni mimbuyelo ya nkambelo",
    "ve": "Sambula ya maḓi na mvelelo dza mulingo"
  },
  {
    "english": "Site & household survey",
    "zu": "Ukuhlola indawo nomndeni",
    "st": "Patlisiso ya sebaka le lelapa",
    "ts": "Nkambisiso wa ndhawu ni ndyangu",
    "ve": "Ṱhoḓisiso ya fhethu na muṱa"
  },
  {
    "english": "Boundary & measurements",
    "zu": "Imingcele nezilinganiso",
    "st": "Moedi le ditekanyo",
    "ts": "Ndzilakana ni mipimo",
    "ve": "Mukano na miṅwelo"
  },
  {
    "english": "Site design",
    "zu": "Uhlelo lwendawo",
    "st": "Moralo wa sebaka",
    "ts": "Pulani ya ndhawu",
    "ve": "Pulane ya fhethu"
  },
  {
    "english": "Planting plan",
    "zu": "Uhlelo lokutshala",
    "st": "Moralo wa ho lema",
    "ts": "Pulani yo byala",
    "ve": "Pulane ya u zwala"
  },
  {
    "english": "Add site photos",
    "zu": "Faka izithombe zendawo",
    "st": "Kenya dinepe tsa sebaka",
    "ts": "Engetela swifaniso swa ndhawu",
    "ve": "Engedzani zwinepe zwa fhethu"
  },
  {
    "english": "Add soil test results",
    "zu": "Faka imiphumela yokuhlola umhlabathi",
    "st": "Kenya diphetho tsa diteko tsa mobu",
    "ts": "Engetela mimbuyelo ya nkambelo wa misava",
    "ve": "Engedzani mvelelo dza mulingo wa mavu"
  },
  {
    "english": "Add water test results",
    "zu": "Faka imiphumela yokuhlola amanzi",
    "st": "Kenya diphetho tsa diteko tsa metsi",
    "ts": "Engetela mimbuyelo ya nkambelo wa mati",
    "ve": "Engedzani mvelelo dza mulingo wa maḓi"
  },
  {
    "english": "Complete or review survey",
    "zu": "Gcwalisa noma ubuyekeze uhlu lokuhlola",
    "st": "Tlatsa kapa hlahloba patlisiso",
    "ts": "Tatisa kumbe kambisisa nkambisiso",
    "ve": "Fhedzisani kana ni sedzuluse ṱhoḓisiso"
  },
  {
    "english": "View boundary and measurements",
    "zu": "Buka umngcele nezilinganiso",
    "st": "Sheba moedi le ditekanyo",
    "ts": "Vona ndzilakana ni mipimo",
    "ve": "Vhonani mukano na miṅwelo"
  },
  {
    "english": "Add boundary",
    "zu": "Faka umngcele",
    "st": "Kenya moedi",
    "ts": "Engetela ndzilakana",
    "ve": "Engedzani mukano"
  },
  {
    "english": "View saved design maps",
    "zu": "Buka amamephu omklamo agciniwe",
    "st": "Sheba dimmapa tsa moralo tse bolokilweng",
    "ts": "Vona mimepe ya pulani leyi hlayisiweke",
    "ve": "Vhonani mimapa ya pulane yo vhulungwaho"
  },
  {
    "english": "View saved design",
    "zu": "Buka umklamo ogciniwe",
    "st": "Sheba moralo o bolokilweng",
    "ts": "Vona pulani leyi hlayisiweke",
    "ve": "Vhonani pulane yo vhulungwaho"
  },
  {
    "english": "Open Design Map",
    "zu": "Vula imephu yomklamo",
    "st": "Bula mmapa wa moralo",
    "ts": "Pfula mepe wa pulani",
    "ve": "Vulani mapa wa pulane"
  },
  {
    "english": "Complete planting plan",
    "zu": "Gcwalisa uhlelo lokutshala",
    "st": "Phetha moralo wa ho lema",
    "ts": "Hetisa pulani yo byala",
    "ve": "Fhedzisani pulane ya u zwala"
  },
  {
    "english": "Area {area} m²",
    "zu": "Indawo {area} m²",
    "st": "Boholo {area} m²",
    "ts": "Vukulu {area} m²",
    "ve": "Vhuhulwane {area} m²"
  },
  {
    "english": "perimeter {perimeter} m",
    "zu": "umjikelezo {perimeter} m",
    "st": "potoloho {perimeter} m",
    "ts": "mpfhuka wo rhendzela {perimeter} m",
    "ve": "vhulapfu ha u mona {perimeter} m"
  },
  {
    "english": "Fence lines: {length} m. These may include internal fences.",
    "zu": "Imigqa yocingo: {length} m. Lokhu kungafaka nocingo lwangaphakathi.",
    "st": "Mela ya terata: {length} m. E ka kenyelletsa diterata tsa ka hare.",
    "ts": "Tilayini ta darata: {length} m. Ti nga katsa tidarata ta le ndzeni.",
    "ve": "Mitalo ya luhura: {length} m. I nga katela khura dza nga ngomu."
  },
  {
    "english": "Boundary measurements available",
    "zu": "Izilinganiso zomngcele ziyatholakala",
    "st": "Ditekanyo tsa moedi di teng",
    "ts": "Mipimo ya ndzilakana ya kumeka",
    "ve": "Miṅwelo ya mukano i hone"
  },
  {
    "english": "Fence measurements available",
    "zu": "Izilinganiso zocingo ziyatholakala",
    "st": "Ditekanyo tsa terata di teng",
    "ts": "Mipimo ya darata ya kumeka",
    "ve": "Miṅwelo ya luhura i hone"
  },
  {
    "english": "Boundary outline saved",
    "zu": "Umngcele udwetshiwe wagcinwa",
    "st": "Sebopeho sa moedi se bolokilwe",
    "ts": "Xivumbeko xa ndzilakana xi hlayisiwile",
    "ve": "Tshivhumbeo tsha mukano tsho vhulungwa"
  },
  {
    "english": "Boundary not recorded",
    "zu": "Umngcele awubhaliwe",
    "st": "Moedi ha o a rekotwa",
    "ts": "Ndzilakana a wu rhekhodiwanga",
    "ve": "Mukano a wo ngo rekhodiwa"
  },
  {
    "english": "Use the saved dimensions; record any ground-check corrections in the design.",
    "zu": "Sebenzisa izilinganiso ezigciniwe; bhala emklamweni noma yikuphi ukulungiswa okuvela ekuhloleni endaweni.",
    "st": "Sebedisa ditekanyo tse bolokilweng; rekota ditokiso tse fumanweng ha ho hlahlojwa sebakeng moralong.",
    "ts": "Tirhisa mipimo leyi hlayisiweke; rhekhoda eka pulani ku lulamisa kwihi na kwihi loku humaka eka ku kambela endhawini.",
    "ve": "Shumisani miṅwelo yo vhulungwaho; rekhodani kha pulane ndulamiso dziṅwe na dziṅwe dzo wanalaho musi ni tshi sedza fhethu."
  },
  {
    "english": "The outline is saved; dimensions are not available in this view.",
    "zu": "Umngcele udwetshiwe wagcinwa; izilinganiso azitholakali kulokhu kubuka.",
    "st": "Sebopeho sa moedi se bolokilwe; ditekanyo ha di fumanehe ponong ena.",
    "ts": "Xivumbeko xi hlayisiwile; mipimo a yi kumeki eka xivono lexi.",
    "ve": "Tshivhumbeo tsho vhulungwa; miṅwelo a i wanali kha mbonalo iyi."
  },
  {
    "english": "A fence line does not establish the complete property outline.",
    "zu": "Umugqa wocingo awuqinisekisi umngcele ophelele wendawo.",
    "st": "Mola wa terata ha o bontshe moedi o felletseng wa setsha.",
    "ts": "Layini ya darata a yi tiyisisi ndzilakana lowu heleleke wa ndhawu.",
    "ve": "Mutalo wa luhura a u khwaṱhisedzi mukano wo fhelelaho wa fhethu."
  },
  {
    "english": "Trace the property outline in the Design Map to calculate its area and perimeter.",
    "zu": "Dweba umngcele wendawo ebalazweni lomklamo ukuze kubalwe indawo nomjikelezo wayo.",
    "st": "Taka moedi wa setsha mmapeng wa moralo ho bala boholo le potoloho ya sona.",
    "ts": "Dirowa ndzilakana wa ndhawu eka mepe wa pulani ku hlayela vukulu ni mpfhuka wo rhendzela.",
    "ve": "Olani mukano wa fhethu kha mapa wa pulane u vhalela vhuhulwane na vhulapfu ha u mona naho."
  },
  {
    "english": "{count} saved design map available",
    "zu": "Imephu yomklamo engu-{count} egciniwe iyatholakala",
    "st": "Mmapa wa moralo o {count} o bolokilweng o teng",
    "ts": "Mepe wa pulani wa {count} lowu hlayisiweke wa kumeka",
    "ve": "Mapa wa pulane wa {count} wo vhulungwaho u hone"
  },
  {
    "english": "{count} saved design maps available",
    "zu": "Amamephu omklamo angu-{count} agciniwe ayatholakala",
    "st": "Dimmapa tsa moralo tse {count} tse bolokilweng di teng",
    "ts": "Mimepe ya pulani ya {count} leyi hlayisiweke ya kumeka",
    "ve": "Mimapa ya pulane ya {count} yo vhulungwaho i hone"
  },
  {
    "english": "Design records saved",
    "zu": "Amarekhodi omklamo agciniwe",
    "st": "Direkoto tsa moralo di bolokilwe",
    "ts": "Tirhekhodo ta pulani ti hlayisiwile",
    "ve": "Rekhodo dza pulane dzo vhulungwa"
  },
  {
    "english": "Checking saved design maps…",
    "zu": "Kuhlolwa amamephu omklamo agciniwe…",
    "st": "Ho hlahlojwa dimmapa tsa moralo tse bolokilweng…",
    "ts": "Ku kamberiwa mimepe ya pulani leyi hlayisiweke…",
    "ve": "Hu khou sedzwa mimapa ya pulane yo vhulungwaho…"
  },
  {
    "english": "Design not recorded",
    "zu": "Umklamo awubhaliwe",
    "st": "Moralo ha o a rekotwa",
    "ts": "Pulani a yi rhekhodiwanga",
    "ve": "Pulane a yo ngo rekhodiwa"
  },
  {
    "english": "Your saved sheets are available in this report{latest}. Open them to review or include them in the full PDF.",
    "zu": "Amakhasi akho agciniwe ayatholakala kulo mbiko{latest}. Wavule ukuze uwabuyekeze noma uwafake ku-PDF ephelele.",
    "st": "Maqephe a hao a bolokilweng a teng tlalehong ena{latest}. A bule ho a hlahloba kapa ho a kenya ho PDF e felletseng.",
    "ts": "Maphepha ya wena lama hlayisiweke ya kumeka eka xiviko lexi{latest}. Ma pfule ku ma kambisisa kumbe ku ma katsa eka PDF leyi heleleke.",
    "ve": "Masiaṱari aṋu o vhulungwaho a hone kha muvhigo uyu{latest}. A vuleni u sedzulusa kana u a katela kha PDF yo fhelelaho."
  },
  {
    "english": "; latest saved {date}",
    "zu": "; agcinwe okokugcina ngo-{date}",
    "st": "; a qetetse ho bolokwa ka {date}",
    "ts": "; ya hetelele ya hlayisiwe hi {date}",
    "ve": "; o vhulungwa lwa u fhedzisela nga {date}"
  },
  {
    "english": "Your saved layout is available in the Design Map. ",
    "zu": "Ukuhlelwa kwakho okugciniwe kuyatholakala ebalazweni lomklamo. ",
    "st": "Tlhophiso ya hao e bolokilweng e teng mmapeng wa moralo. ",
    "ts": "Malongoloxelo ya wena lama hlayisiweke ya kumeka eka mepe wa pulani. ",
    "ve": "Nzudzanyo yaṋu yo vhulungwaho i hone kha mapa wa pulane. "
  },
  {
    "english": "Checking this browser for saved sheets.",
    "zu": "Kuhlolwa lesi siphequluli ukuze kutholakale amakhasi agciniwe.",
    "st": "Ho hlahlojwa maqephe a bolokilweng ho sebatli sena.",
    "ts": "Ku kamberiwa maphepha lama hlayisiweke eka brauza leyi.",
    "ve": "Hu khou sedzwa masiaṱari o vhulungwaho kha brausa iyi."
  },
  {
    "english": "No saved map sheets found in this browser for this site. If you saved them on another device, open that device’s report.",
    "zu": "Awekho amakhasi emephu agciniwe atholakele kulesi siphequluli ale ndawo. Uma uwagcine kwenye idivayisi, vula umbiko waleyo divayisi.",
    "st": "Ha ho maqephe a mmapa a bolokilweng a fumanweng ho sebatli sena bakeng sa sebaka sena. Haeba o a bolokile sesebedisweng se seng, bula tlaleho ya sesebediswa seo.",
    "ts": "A ku kumekanga maphepha ya mepe lama hlayisiweke eka brauza leyi ya ndhawu leyi. Loko u ma hlayisile eka xitirhisiwa xin’wana, pfula xiviko xa xitirhisiwa xexo.",
    "ve": "A hu ngo wanala masiaṱari a mapa o vhulungwaho kha brausa iyi a fhethu afha. Arali no a vhulunga kha tshiṅwe tshishumiswa, vulani muvhigo wa tshenetsho tshishumiswa."
  },
  {
    "english": "Results entered · review source",
    "zu": "Imiphumela ibhaliwe · buyekeza umthombo",
    "st": "Diphetho di kentswe · hlahloba mohlodi",
    "ts": "Mimbuyelo yi nghenisiwile · kambisisa xihlovo",
    "ve": "Mvelelo dzo dzheniswa · sedzulusani tshiko"
  },
  {
    "english": "Document added · enter key results",
    "zu": "Idokhumenti ifakiwe · bhala imiphumela esemqoka",
    "st": "Tokomane e kentswe · kenya diphetho tsa bohlokwa",
    "ts": "Tsalwa ri engeteriwile · nghenisa mimbuyelo ya nkoka",
    "ve": "Ḽiṅwalwa ḽo engedzwa · dzhenisani mvelelo dza ndeme"
  },
  {
    "english": "Filename only · original needed",
    "zu": "Igama lefayela kuphela · kudingeka elokuqala",
    "st": "Lebitso la faele feela · ho hlokahala ya pele",
    "ts": "Vito ra fayili ntsena · ku laveka ya masungulo",
    "ve": "Dzina ḽa faela fhedzi · hu ṱoḓea ya u thoma"
  },
  {
    "english": "Test results not recorded",
    "zu": "Imiphumela yokuhlola ayibhalwanga",
    "st": "Diphetho tsa diteko ha di a rekotwa",
    "ts": "Mimbuyelo ya nkambelo a yi rhekhodiwanga",
    "ve": "Mvelelo dza mulingo a dzo ngo rekhodiwa"
  },
  {
    "english": "Add the sampling date, location / sample ID, laboratory and results with units. Retain the original PDF or photograph and enter the values the report should use.",
    "zu": "Faka usuku lokuthatha isampula, indawo / i-ID yesampula, ilabhorethri nemiphumela enamayunithi. Gcina i-PDF noma isithombe sokuqala bese ubhala amanani okufanele asetshenziswe umbiko.",
    "st": "Kenya letsatsi la ho nka sampole, sebaka / ID ya sampole, laboratori le diphetho tse nang le diyuniti. Boloka PDF kapa senepe sa pele mme o kenye boleng boo tlaleho e lokelang ho bo sebedisa.",
    "ts": "Engetela siku ro teka sampulu, ndhawu / ID ya sampulu, laboratori ni mimbuyelo leyi nga ni tiyuniti. Hlayisa PDF kumbe xifaniso xa masungulo kutani u nghenisa mimpimo leyi xiviko xi faneleke ku yi tirhisa.",
    "ve": "Engedzani datumu ya u dzhia sambula, fhethu / ID ya sambula, laboratori na mvelelo dzi re na yuniti. Vhulungani PDF kana tshinepe tsha u thoma ni dzhenise miṅwelo ine muvhigo wa fanela u i shumisa."
  },
  {
    "english": "{count} site photograph saved",
    "zu": "Isithombe sendawo esingu-{count} sigciniwe",
    "st": "Senepe sa sebaka se {count} se bolokilwe",
    "ts": "Xifaniso xa ndhawu xa {count} xi hlayisiwile",
    "ve": "Tshinepe tsha fhethu tsha {count} tsho vhulungwa"
  },
  {
    "english": "{count} site photographs saved",
    "zu": "Izithombe zendawo ezingu-{count} zigciniwe",
    "st": "Dinepe tsa sebaka tse {count} di bolokilwe",
    "ts": "Swifaniso swa ndhawu swa {count} swi hlayisiwile",
    "ve": "Zwinepe zwa fhethu zwa {count} zwo vhulungwa"
  },
  {
    "english": "Site photos needed",
    "zu": "Kudingeka izithombe zendawo",
    "st": "Ho hlokahala dinepe tsa sebaka",
    "ts": "Ku laveka swifaniso swa ndhawu",
    "ve": "Hu ṱoḓea zwinepe zwa fhethu"
  },
  {
    "english": "Show the whole site, growing areas, slopes, access and water sources. Include views that explain the conditions on the ground.",
    "zu": "Bonisa yonke indawo, izindawo zokulima, imithambeka, izindlela zokungena nemithombo yamanzi. Faka izithombe ezichaza izimo zangempela endaweni.",
    "st": "Bontsha sebaka sohle, dibaka tsa ho lema, matsoapo, ditsela tsa ho kena le mehlodi ya metsi. Kenyelletsa dinepe tse hlalosang maemo a teng sebakeng.",
    "ts": "Komba ndhawu hinkwayo, tindhawu to byala, mirhimiwa, tindlela to nghena ni swihlovo swa mati. Katsa swifaniso leswi hlamuselaka swiyimo swa le ndhawini.",
    "ve": "Sumbedzani fhethu hoṱhe, fhethu ha u lima, miṱavha, nḓila dza u swika na zwiko zwa maḓi. Katelani zwinepe zwine zwa ṱalusa vhuimo ha fhethu."
  },
  {
    "english": "{filled} of {total} key checks recorded",
    "zu": "Ukuhlola okusemqoka okungu-{filled} kokungu-{total} kubhaliwe",
    "st": "Dintlha tsa bohlokwa tse {filled} ho tse {total} di rekotilwe",
    "ts": "Ku rhekhodiwe minkambelo ya nkoka ya {filled} eka {total}",
    "ve": "Ho rekhodiwa tsedzuluso dza ndeme dza {filled} kha {total}"
  },
  {
    "english": "Record your goals, people, current production, water access, soil observations and challenges. Review the full survey before generating.",
    "zu": "Bhala izinhloso zakho, abantu, umkhiqizo wamanje, ukutholakala kwamanzi, okubonile emhlabathini nezinselelo. Buyekeza lonke uhlu lokuhlola ngaphambi kokukhiqiza umbiko.",
    "st": "Rekota dipheo tsa hao, batho, tlhahiso ya hona jwale, phihlello ya metsi, tseo o di boneng mobung le diphephetso. Hlahloba patlisiso yohle pele o hlahisa tlaleho.",
    "ts": "Rhekhoda swikongomelo swa wena, vanhu, vuhumelerisi bya sweswi, ku kuma mati, leswi u swi voneke eka misava ni swiphiqo. Kambisisa nkambisiso hinkwawo u nga si endla xiviko.",
    "ve": "Rekhodani zwipikwa zwaṋu, vhathu, mveledziso ya zwino, u wana maḓi, zwe na zwi vhona kha mavu na khaedu. Sedzulusani ṱhoḓisiso yoṱhe ni sa athu ita muvhigo."
  },
  {
    "english": "Plantings recorded · review coverage",
    "zu": "Okutshalwayo kubhaliwe · buyekeza indawo ehlanganisiwe",
    "st": "Dimela di rekotilwe · hlahloba sebaka se rerilweng",
    "ts": "Ku byala ku rhekhodiwile · kambisisa ndhawu leyi katsiwaka",
    "ve": "Zwimela zwo rekhodiwa · sedzulusani fhethu ho katelwaho"
  },
  {
    "english": "Planting plan not recorded",
    "zu": "Uhlelo lokutshala alubhalwanga",
    "st": "Moralo wa ho lema ha o a rekotwa",
    "ts": "Pulani yo byala a yi rhekhodiwanga",
    "ve": "Pulane ya u zwala a yo ngo rekhodiwa"
  },
  {
    "english": "Choose crops for the site’s beds and record planting dates. Check any areas that still have no plan.",
    "zu": "Khetha izitshalo zemibhede yale ndawo bese ubhala izinsuku zokutshala. Hlola noma yiziphi izindawo ezingakabi nohlelo.",
    "st": "Kgetha dijalo bakeng sa dibethe tsa sebaka mme o rekote matsatsi a ho lema. Hlahloba dibaka tse ntseng di se na moralo.",
    "ts": "Hlawula swibyariwa swa mibedo ya ndhawu kutani u rhekhoda masiku yo byala. Kambela tindhawu leti ti nga si vaka ni pulani.",
    "ve": "Nangani zwiliṅwa zwa mibete ya fhethu ni rekhode madatumu a u zwala. Sedzani fhethu huṅwe na huṅwe hu sa athu vha na pulane."
  }
];

const preparationCopy = new Map(REPORT_PREPARATION_COPY.map(row => [row.english, row]));
export function reportPreparationText(english: string, language: string, values: Record<string, string | number> = {}): string {
  const row = preparationCopy.get(english);
  const template = row && (language === 'zu' || language === 'st' || language === 'ts' || language === 've') ? row[language] : english;
  // Substitute once: a farmer's label containing braces must not be interpreted as another template.
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => Object.hasOwn(values, key) ? String(values[key]) : placeholder);
}
