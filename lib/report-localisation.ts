import { REPORT_UI_KEYS } from './i18n-pending.ts';
import { recordsDate, recordsMonthShort } from './records-months.ts';
import { numberLabel } from '@/lib/format-figures';
import type { LocationData } from './types';
import type { ReportSiteFacts } from './report-site-facts';
import type { BillOfQuantities } from './report-boq';
import type { RiskRow } from './report-risk';
import { reportSummaryPages } from './report-summary';

/** Unreviewed AI drafts for code-authored document furniture; saved values are only interpolated. */
export const REPORT_DOCUMENT_COPY:readonly {english:string;zu:string;st:string;ts:string;ve:string}[] = [
  {
    "english": "Permaculture Site Report",
    "zu": "Umbiko wendawo ye-permaculture",
    "st": "Tlaleho ya sebaka sa permaculture",
    "ts": "Xiviko xa ndhawu xa permaculture",
    "ve": "Muvhigo wa fhethu wa permaculture"
  },
  {
    "english": "Permaculture Site Report — {name}",
    "zu": "Umbiko wendawo ye-permaculture — {name}",
    "st": "Tlaleho ya sebaka sa permaculture — {name}",
    "ts": "Xiviko xa ndhawu xa permaculture — {name}",
    "ve": "Muvhigo wa fhethu wa permaculture — {name}"
  },
  {
    "english": "Issued {date}",
    "zu": "Ukhishwe ngo-{date}",
    "st": "E ntshitswe ka {date}",
    "ts": "Xi humesiwe hi {date}",
    "ve": "Wo bviswa nga {date}"
  },
  {
    "english": "Document control",
    "zu": "Imininingwane yedokhumenti",
    "st": "Taolo ya tokomane",
    "ts": "Vulawuri bya tsalwa",
    "ve": "Ndangulo ya ḽiṅwalwa"
  },
  {
    "english": "Field",
    "zu": "Inkambu",
    "st": "Karolo",
    "ts": "Xiyenge",
    "ve": "Tshipiḓa"
  },
  {
    "english": "Detail",
    "zu": "Imininingwane",
    "st": "Dintlha",
    "ts": "Vuxokoxoko",
    "ve": "Zwidodombedzwa"
  },
  {
    "english": "Reference",
    "zu": "Inombolo yenkomba",
    "st": "Nomoro ya tshupiso",
    "ts": "Nomboro ya nkombiso",
    "ve": "Nomboro ya u sumba"
  },
  {
    "english": "Site",
    "zu": "Indawo",
    "st": "Sebaka",
    "ts": "Ndhawu",
    "ve": "Fhethu"
  },
  {
    "english": "Issued",
    "zu": "Ukhishwe nini",
    "st": "E ntshitswe neng",
    "ts": "Xi humesiwe rini",
    "ve": "Wo bviswa lini"
  },
  {
    "english": "Revision",
    "zu": "Inguqulo",
    "st": "Mofuta",
    "ts": "Ndzulamiso",
    "ve": "Mvusuludzo"
  },
  {
    "english": "1 — first issue",
    "zu": "1 — ukukhishwa kokuqala",
    "st": "1 — e ntshitsweng lekgetlo la pele",
    "ts": "1 — ku humesiwa ko sungula",
    "ve": "1 — u bviswa lwa u thoma"
  },
  {
    "english": "Basis of issue",
    "zu": "Isisekelo sokukhishwa",
    "st": "Motheo wa ho ntsha",
    "ts": "Xisekelo xa ku humesa",
    "ve": "Mutheo wa u bvisa"
  },
  {
    "english": "Prepared by",
    "zu": "Ulungiswe ngu-",
    "st": "E lokisitswe ke",
    "ts": "Xi lulamisiwe hi",
    "ve": "Wo lugiswa nga"
  },
  {
    "english": "Status",
    "zu": "Isimo",
    "st": "Boemo",
    "ts": "Xiyimo",
    "ve": "Vhuimo"
  },
  {
    "english": "Not named by the farmer",
    "zu": "Ayikabizwa ngegama umlimi",
    "st": "Ha e so rehelwe ke molemi",
    "ts": "A yi si thyiwa hi murimi",
    "ve": "A hu athu u rehiwa nga mulimi"
  },
  {
    "english": "{length} report, {count} section requested",
    "zu": "Umbiko wohlobo {length}, kucelwe isigaba esingu-{count}",
    "st": "Tlaleho ya mofuta wa {length}, ho kopilwe karolo e {count}",
    "ts": "Xiviko xa muxaka wa {length}, ku komberiwe xiyenge xa {count}",
    "ve": "Muvhigo wa lushaka lwa {length}, ho humbelwa tshipiḓa tsha {count}"
  },
  {
    "english": "{length} report, {count} sections requested",
    "zu": "Umbiko wohlobo {length}, kucelwe izigaba ezingu-{count}",
    "st": "Tlaleho ya mofuta wa {length}, ho kopilwe dikarolo tse {count}",
    "ts": "Xiviko xa muxaka wa {length}, ku komberiwe swiyenge swa {count}",
    "ve": "Muvhigo wa lushaka lwa {length}, ho humbelwa zwipiḓa zwa {count}"
  },
  {
    "english": "For the farmer's use and discussion. Not a professional engineering, agronomic or financial certification.",
    "zu": "Owokusetshenziswa nokuxoxwa ngumlimi. Awusona isitifiketi sochwepheshe sobunjiniyela, sezolimo noma sezezimali.",
    "st": "Bakeng sa tshebediso le puisano ya molemi. Ha se setifikeiti sa setsebi sa boenjineri, temo kapa ditjhelete.",
    "ts": "Wu endleriwe ku tirhisiwa ni ku kanerisana hi murimi. A hi xitifikheti xa xiphurofexinali xa vuinjhiniyere, swa vurimi kumbe swa timali.",
    "ve": "Ndi wa u shumiswa na u ambiwa nga mulimi. A si ṱhanziela ya phurofeshinaḽa ya vhuinzhiniere, vhulimi kana masheleni."
  },
  {
    "english": "This report describes one site on one date. Where a figure was measured, the table beside it names what measured it; where the app had no data, the report says so rather than filling the gap.",
    "zu": "Lo mbiko uchaza indawo eyodwa ngosuku olulodwa. Lapho isibalo silinganisiwe, ithebula eliseduze lisichaza ukuthi silinganiswe ngani; lapho i-app ingenayo idatha, umbiko ukusho lokho kunokugcwalisa isikhala.",
    "st": "Tlaleho ena e hlalosa sebaka se le seng ka letsatsi le le leng. Moo palo e lekantsweng, tafole e haufi le yona e bolela se e lekantseng; moo app e se nang data, tlaleho e bolela seo ho e na le ho tlatsa sekgeo.",
    "ts": "Xiviko lexi xi hlamusela ndhawu yin'we hi siku rin'we. Laha nhlayo yi pimiweke, tafula leri nga ekusuhi na yona ri vula lexi yi pimeke; laha app yi nga riki na data, xiviko xi vula tano ematshan'weni yo tata xivandla.",
    "ve": "Muvhigo uyu u ṱalusa fhethu huthihi nga ḓuvha ḽithihi. He nomboro ya pimiwa, thebulu i re tsini nayo i bula tsho i pimaho; he app ya vha i si na data, muvhigo u bula zwenezwo nṱhani ha u ḓadza tshikhala."
  },
  {
    "english": "ImbewuField, from this site's location and public environmental data",
    "zu": "ImbewuField, kusetshenziswa indawo yale ndawo nedatha yomphakathi yemvelo",
    "st": "ImbewuField, ho tswa moo sebaka sena se leng teng le dateng ya tikoloho ya setjhaba",
    "ts": "ImbewuField, hi ndhawu leyi ndhawu leyi yi nga eka yona ni data ya mbango ya mani na mani",
    "ve": "ImbewuField, ho shumiswa vhuimo ha fhethu afha na data ya mupo ya nnyi na nnyi"
  },
  {
    "english": "ImbewuField, from the farmer's own {sources}",
    "zu": "ImbewuField, kusetshenziswa lokhu komlimi: {sources}",
    "st": "ImbewuField, ho tswa ho tse latelang tsa molemi: {sources}",
    "ts": "ImbewuField, hi leswi landzelaka swa murimi: {sources}",
    "ve": "ImbewuField, ho shumiswa zwi tevhelaho zwa mulimi: {sources}"
  },
  {
    "english": "map",
    "zu": "imephu",
    "st": "mmapa",
    "ts": "mepe",
    "ve": "mapa"
  },
  {
    "english": "survey",
    "zu": "inhlolovo",
    "st": "phuputso",
    "ts": "nkambisiso",
    "ve": "ṱhoḓisiso"
  },
  {
    "english": "crop plan",
    "zu": "uhlelo lwezitshalo",
    "st": "moralo wa dijalo",
    "ts": "pulani ya swibyariwa",
    "ve": "pulane ya zwiliṅwa"
  },
  {
    "english": "and",
    "zu": "kanye",
    "st": "le",
    "ts": "ni",
    "ve": "na"
  },
  {
    "english": "Brief advice",
    "zu": "Izeluleko ezimfushane",
    "st": "Keletso e kgutshwane",
    "ts": "Switsundzuxo swo koma",
    "ve": "Nyeletshedzo pfufhi"
  },
  {
    "english": "Standard",
    "zu": "Okujwayelekile",
    "st": "E tlwaelehileng",
    "ts": "Ya ntolovelo",
    "ve": "Yo ḓoweleaho"
  },
  {
    "english": "Comprehensive",
    "zu": "Okuphelele",
    "st": "E akaretsang tsohle",
    "ts": "Leswi heleleke",
    "ve": "Wo fhelelaho"
  },
  {
    "english": "Draft translation: not yet reviewed by a fluent speaker. Check the English source before acting.",
    "zu": "Ukuhumusha okusabuyekezwa: akukahlolwa ngumuntu olwazi kahle lolu limi. Hlola umbhalo wesiNgisi ngaphambi kokwenza okushiwoyo.",
    "st": "Phetolelo ya moralo: ha e so hlahlojwe ke motho ya tsebang puo hantle. Hlahloba mohlodi wa Senyesemane pele o etsa se bolelwang.",
    "ts": "Vuhundzuluxi bya xitsalwana: a byi si kambisisiwa hi munhu la tivaka ririmi kahle. Kambisisa xihlovo xa Xinghezi u nga si endla leswi vuriwaka.",
    "ve": "Ṱhalutshedzelo ya mvetamveto: a i athu u sedzwa nga muthu a ambaho luambo zwavhuḓi. Sedzani tshiko tsha Luisimane phanḓa ha u tevhedza zwine zwa ambiwa."
  },
  {
    "english": "Contents",
    "zu": "Okuqukethwe",
    "st": "Dikahare",
    "ts": "Leswi nga endzeni",
    "ve": "Zwi re ngomu"
  },
  {
    "english": "Figures",
    "zu": "Imifanekiso",
    "st": "Ditshwantsho",
    "ts": "Swifaniso",
    "ve": "Zwifanyiso"
  },
  {
    "english": "Figure not captioned",
    "zu": "Umfanekiso awunayo incazelo",
    "st": "Setshwantsho ha se na tlhaloso",
    "ts": "Xifaniso a xi na nhlamuselo",
    "ve": "Tshifanyiso a tshi na ṱhaluso"
  },
  {
    "english": "Figure {number} — {caption}",
    "zu": "Umfanekiso {number} — {caption}",
    "st": "Setshwantsho {number} — {caption}",
    "ts": "Xifaniso {number} — {caption}",
    "ve": "Tshifanyiso {number} — {caption}"
  },
  {
    "english": "Site at a Glance",
    "zu": "Indawo kafushane",
    "st": "Sebaka ka bokgutshwane",
    "ts": "Ndhawu hi ku komisa",
    "ve": "Fhethu nga u pfufhifhadza"
  },
  {
    "english": "This section may be incomplete: the model reached its output limit.",
    "zu": "Lesi sigaba singase singapheleli: imodeli ifinyelele emkhawulweni wayo wokubhala.",
    "st": "Karolo ena e ka nna ya se fele: mohlala o fihlile moeding wa seo o ka se hlahisang.",
    "ts": "Xiyenge lexi xi nga va xi nga helelanga: modele yi fikelele mpimo wa leswi yi nga swi humesaka.",
    "ve": "Tshipiḓa itshi tshi nga vha tshi songo fhelelela: modele yo swika kha mukano wa zwine ya nga zwi bvisa."
  },
  {
    "english": "This section could not be safely generated because it named a listed invasive plant. Please regenerate the report.",
    "zu": "Lesi sigaba asikwazanga ukukhiqizwa ngokuphepha ngoba sibize isitshalo esihlaselayo esisohlwini. Sicela uphinde ukhiqize umbiko.",
    "st": "Karolo ena ha e a ka ya hlahiswa ka polokeho hobane e boletse semela se hlaselang se leng lenaneng. Ka kopo hlahisa tlaleho hape.",
    "ts": "Xiyenge lexi a xi kotanga ku endliwa hi ndlela leyi hlayisekeke hikuva xi vule ximilana lexi hlaselaka lexi nga eka nxaxamelo. Hi kombela u endla xiviko nakambe.",
    "ve": "Tshipiḓa itshi a tsho ngo kona u bveledzwa nga nḓila yo tsireledzeaho ngauri tsho bula tshimela tshi phaḓalalaho tshi tshi tshinya tshi re kha mutevhe. Ri humbela uri ni dovhe ni bveledze muvhigo."
  },
  {
    "english": "A section could not be generated — please regenerate the report.",
    "zu": "Kukhona isigaba esingakwazanga ukukhiqizwa — sicela uphinde ukhiqize umbiko.",
    "st": "Karolo e itseng ha e a ka ya hlahiswa — ka kopo hlahisa tlaleho hape.",
    "ts": "Xiyenge xin'wana a xi kotanga ku endliwa — hi kombela u endla xiviko nakambe.",
    "ve": "Tshipiḓa tshiṅwe a tsho ngo kona u bveledzwa — ri humbela uri ni dovhe ni bveledze muvhigo."
  }
];
export const REPORT_DOCUMENT_LANGUAGES=['zu','st','ts','ve'] as const;
const documentCopy=new Map(REPORT_DOCUMENT_COPY.map(row=>[row.english,row]));
export function reportDocumentText(source:string,language='en',values:Record<string,string|number>={}):string {
  const row=documentCopy.get(source);
  const text=row&&REPORT_DOCUMENT_LANGUAGES.includes(language as typeof REPORT_DOCUMENT_LANGUAGES[number])?row[language as typeof REPORT_DOCUMENT_LANGUAGES[number]]:source;
  return text.replace(/\{(\w+)\}/g,(token,key:string)=>Object.hasOwn(values,key)?String(values[key]):token);
}

export const REPORT_ZU: Record<string, string> = {
  'Language': 'Ulimi', 'Wording': 'Indlela yokuchaza', 'Length': 'Ubude bezeluleko', 'Sections': 'Izigaba',
  'Simple': 'Kulula', 'Detailed': 'Kunemininingwane', 'Brief advice': 'Izeluleko ezimfushane', 'Standard': 'Okujwayelekile', 'Comprehensive': 'Okuphelele',
  'Saved reports': 'Imibiko egciniwe', 'Read the report': 'Funda umbiko', 'Export PDF': 'Khipha i-PDF', 'PDF ready': 'I-PDF isilungile', 'Building…': 'Kuyakhiwa…',
  'Generate report': 'Khiqiza umbiko', 'Generate new report': 'Khiqiza umbiko omusha', 'Regenerate': 'Khiqiza kabusha', 'Share': 'Yabelana', 'Copied!': 'Kukopishiwe!',
  'Permaculture Site Analysis Report': 'Umbiko wokuhlola indawo ye-permaculture',
  'Saved Places · GPS Points': 'Izindawo ezigciniwe · Amaphoyinti e-GPS', 'Site Satellite View': 'Isithombe sendawo sesathelayithi',
  'Monthly Rainfall Pattern': 'Imvula yenyanga ngayinye', 'Photos included': 'Izithombe zifakiwe', 'Photo analysis will inform the report': 'Ukuhlolwa kwezithombe kuzosiza umbiko', 'Tap to open': 'Thepha ukuze uvule',
  'Biome': 'Uhlobo lwemvelo', 'Rainfall': 'Imvula', 'Elevation': 'Ukuphakama', 'Soil pH': 'I-pH yomhlabathi',
  'Executive Summary': 'Isifinyezo', 'Site Conditions': 'Izimo zendawo', 'Natural Vegetation & Biome': 'Izitshalo zemvelo nohlobo lwemvelo',
  'Water Harvesting': 'Ukuqoqwa kwamanzi', 'Irrigation Plan': 'Uhlelo lokunisela', 'Soil Strategy': 'Uhlelo lomhlabathi',
  'Planting Calendar': 'Ikhalenda lokutshala', 'Year-Round Food Production': 'Ukukhiqiza ukudla unyaka wonke',
  'Suitable Plants for This Site': 'Izitshalo ezifanele le ndawo',
  'Fruit, Nut & Berry Trees': 'Izihlahla zezithelo, amantongomane namajikijolo', 'Indigenous Trees': 'Izihlahla zendabuko',
  'Agroecosystem Planting Guide': 'Umhlahlandlela wokutshala ohambisana nemvelo', 'Crop Rotation': 'Ukushintshanisa izitshalo',
  'Animals & Livestock': 'Izilwane nemfuyo', 'Sun & Solar': 'Ilanga namandla elanga', 'Wind & Windbreaks': 'Umoya nezivimbamoya',
  'Fire & Hazards': 'Umlilo nezingozi', 'Economic Opportunities': 'Amathuba okuthola imali', 'Plant Guilds': 'Amaqoqo ezitshalo ezisizanayo',
  'Zone Design': 'Ukuhlelwa kwezindawo', 'Seasonal Calendar': 'Ikhalenda lezinkathi', '5-Year Vision': 'Umbono weminyaka emihlanu', 'Year 1 Priorities': 'Okubalulekile onyakeni wokuqala',
};
/** Controls follow the app language; a saved report keeps its original content language. */
export function reportUiText(english: string, language: string, lookup: (key: string) => string, legacyZulu: string | undefined = REPORT_ZU[english]): string {
  // Preserve the existing source-paired isiZulu wording rather than replacing it with a synonym.
  if (language === 'zu' && legacyZulu !== undefined) return legacyZulu;
  const key = REPORT_UI_KEYS[english];
  if (!key) return english;
  const value = lookup(key);
  return value === key ? english : value;
}

/** Exact known source headings, normalised only for case/spacing; unknown prose is not guessed. */
export function reportHeadingAliases(sources:readonly string[],language:string,lookup:(key:string)=>string):Record<string,string> {
  return Object.fromEntries(sources.map(source=>[reportUiText(source,language,lookup).normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase(),source]));
}

/** Server-side dictionaries are pure data; never import the client language provider into a route. */
export async function reportHeadingLookup(language:string):Promise<((key:string)=>string)|undefined> {
  const dict=language==='zu'?(await import('./locales/zu')).default
    :language==='st'?(await import('./locales/st')).default
    :language==='ts'?(await import('./locales/ts')).default
    :language==='ve'?(await import('./locales/ve')).default:null;
  return dict ? key=>dict[key]??key : undefined;
}

/** Prompt titles predate the selector's shorter topic labels; keep English output unchanged. */
export const REPORT_PROMPT_HEADINGS:Readonly<Record<string,string>>={
  'Water Harvesting':'Water Harvesting Design',
  'Soil Strategy':'Soil Building Plan',
  'Planting Calendar':'Seasonal Planting Guidance',
  'Crop Rotation':'Crop Rotation Plan',
  'Irrigation Plan':'Irrigation Plan — How Much Water You Need',
  'Year-Round Food Production':'All-Year-Round Food Production',
  'Fire & Hazards':'Fire Risk & Other Hazards',
  'Seasonal Calendar':'Seasonal Action Calendar',
};

/** Only selected top-level source headings change; numeric facts and narrative templates stay exact. */
export function reportHeadingPrompt(prompt:string,sources:readonly string[],language:string,lookup?:((key:string)=>string)):string {
  if(!lookup||language==='en')return prompt;
  const selected=new Map(sources.map(source=>[Object.hasOwn(REPORT_PROMPT_HEADINGS,source)?REPORT_PROMPT_HEADINGS[source]:source,source]));
  return prompt.replace(/^## (.+)$/gm,(line,title:string)=>selected.has(title)?`## ${reportUiText(selected.get(title)!,language,lookup)}`:line);
}

/** The same date and time, with the app's existing native month names. */
export function reportUiDate(language: string, iso: string, withTime = true): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return recordsDate(language, date, true) + (withTime ? ` · ${date.toLocaleTimeString('en-ZA', { hour12: false })}` : '');
}

/** Calendar labels are presentation only; stored sowing months and dates stay exact. */
export function reportUiMonth(language: string, englishMonthYear: string): string {
  const [month, ...rest] = englishMonthYear.split(' ');
  const index = Array.from({ length: 12 }, (_, at) => recordsMonthShort('en', at + 1)).indexOf(month.slice(0, 3));
  return index < 0 ? englishMonthYear : [recordsMonthShort(language, index + 1), ...rest].join(' ');
}

const cell = (value: string) => value.replace(/[|\r\n]/g, ' ');
const riskZu: Record<string, [string, string]> = {
  'Dry-season crop failure from insufficient stored water': ['Izitshalo zingahluleka ngesikhathi esomile ngenxa yokushoda kwamanzi', 'Qinisekisa amanzi atholakalayo ngaphambi kokwandisa indawo etshaliwe. Bala isidingo sokunisela nezinsuku amanzi angahlala ngazo.'],
  'Roof runoff is lost — catchment traced but nothing to store it in': ['Uphahla lubalazwe kodwa akukho thangi emklamweni', 'Hlola ukuthi amathangi akhona yini endaweni. Hlela ukuxhuma imisele yophahla ethangini elifanele.'],
  'Storage cannot be planned — tank sizes are not recorded': ['Amandla okugcina amanzi awaziwa ngoba umthamo wamathangi awubhaliwe', 'Funda umthamo ethangini noma uwulinganise bese uwubhala.'],
  'Soil loss from runoff on the slope': ['Ukuguguleka komhlabathi endaweni eyehlelayo', 'Gcina umhlabathi umboziwe. Qinisekisa ama-contour nokuphuma kwamanzi nochwepheshe ngaphambi kokumba.'],
  'Runoff carries water and topsoil off the growing area': ['Amanzi agelezayo angathwala umhlabathi ongaphezulu', 'Mboza imibhede bese ubheka lapho amanzi egeleza khona ngemva kwemvula enamandla.'],
  'Frost damage to tender crops and young trees': ['Isithwathwa singalimaza izitshalo nezihlahla ezincane', 'Hlola izindawo ezibandayo nezinsuku zesithwathwa ngaphambi kokutshala izitshalo ezibuthakathaka.'],
  'Soil recommendations are built on modelled soil, not this field': ['Umhlabathi waleli pulazi awukahlolwa elebhu', 'Thatha amasampula afanele uwathumele ukuyohlolwa ngaphambi kokuthenga izinto zokulungisa umhlabathi.'],
  'Every area figure is provisional — no property boundary was traced': ['Awukho umngcele wendawo obalazwe', 'Hamba umngcele uwubhale ebalazweni. Qinisekisa zonke izilinganiso zendawo.'],
  'The build costs more than the bill of quantities shows': ['Isamba sezindleko asikapheleli', 'Thola amanani endawo emigqeni engenantengo ngaphambi kokuvuma ibhajethi.'],
  'No crop plan — the growing area has no sowing schedule behind it': ['Alukho uhlelo lwezitshalo olugciniwe lwale ndawo', 'Hlela izitshalo nemibhede ngaphambi kwesikhathi esilandelayo sokuhlwanyela.'],
};

/** Code-authored isiZulu front/back matter. All numbers retain their source;
 * plant names, catalogue item names and recorded farmer labels are not translated. */
export function zuluReportMatter(facts: ReportSiteFacts | null, d: LocationData, boq: BillOfQuantities, risks: RiskRow[], date: string) {
  const summary = reportSummaryPages(facts, d, 5, 'zu');
  const cover = `# Umbiko wokuhlola indawo · ${cell(facts?.farmName ?? 'ImbewuField')}\n\nImbewuField · ${date}\n\nLo mbiko usebenzisa imininingwane yendawo nohlelo olugciniwe lapho lukhona. Akukona ukuqinisekiswa ukuthi konke okuhleliwe sekwenziwe.\n`;
  const glance = `## Indawo kafushane\n\n${summary[0].lines.join('\n\n')}`;
  const crop = `## Uhlelo lwezitshalo olugciniwe\n\n${summary[1].lines.join('\n\n')}`;
  const costs = ['## Uhlu lobuningi nezindleko', '', ...summary[3].lines.slice(0, 3), '', '| Into | Ubuningi | Intengo ngeyunithi | Isamba |', '|---|---|---|---|', ...boq.lines.map(l => `| ${cell(l.description)} | ${cell(l.quantity)} | ${l.rate ?? 'Intengo ayikho'} | ${l.zar === null ? l.unpriced === 'existing' ? 'Ikhona; ayifakiwe ezindlekweni ezintsha' : 'Kudingeka intengo noma isilinganiso' : `R ${numberLabel(l.zar)}`} |`), '', 'Ubuningi buvela emklamweni. Izintengo ziyizilinganiso zokuhlela; qinisekisa ukuthutha, abasebenzi, intela namanani akamuva ngaphambi kokuthenga.'].join('\n');
  const monitoring = ['## Ukuqapha, ukuhlola nokufunda', '',
    'Bhala isimo sokuqala ngaphambi kokuba kuqale usizo. Uma idatha iqoqwe sekudlule isikhathi, yibize ngokuthi ukubika okubheka emuva.',
    'Bhala isivuno ngesitshalo nangesisindo ngaso sonke isikhathi uvuna. Bhala nokuthengisa, ukudla okudliwe, okunikelwe nokonakele ngokwehlukana. Isivuno esingathengiswanga asisho ukuthi sonke sidliwe ekhaya.',
    'Njalo ngenyanga, qinisekisa indawo etshaliwe ngokoqobo namanzi akhona emathangini. Indawo ebalazwe nomthamo wethangi akufani nendawo ekhiqizayo namanzi akhona.',
    'Ngemva kokutshala, bhala inani lezihlahla ezitshalwe ngokoqobo. Phinda ubale eziphilayo njalo ezinyangeni eziyisithupha nangemva kwesomiso noma komlilo. Bhala izihlahla ezifakwe esikhundleni ngokwehlukana.',
    'Thatha izithombe ezindaweni ezifanayo njalo ngesizini ukuze uqhathanise ukumbozwa komhlabathi.',
    'Ku-NGO Assessments, sebenzisa ukuhlola kwasekuqaleni, ngaphambi nangemva kwesifundo, phakathi nephrojekthi nasekupheleni. Impendulo nge-app ingeyokuzithandela. Bhala ushintsho oluvunyelwene ngalo, umuntu ozolwenza nosuku lokulwenza.',
  ].join('\n\n');
  const risk = ['## Izingozi okufanele zihlolwe', '', 'Lolu uhlu lokuqaphela ngokwezibalo zendawo; alulona ukuhlolwa kobunjiniyela noma isilinganiso esiqinisekisiwe sethuba lengozi.', '', ...risks.map(r => {
    const translated = riskZu[r.risk];
    const evidence = r.trigger
      .replace(/(mm)\/yr/g, '$1/ngonyaka')
      .replace(/, below the (.+) threshold this register uses for a water-limited site/, ', ngaphansi komkhawulo ongu-$1 osetshenziswa yilesi sihloli')
      .replace(/^(minimum )?(-?[\d.]+) °C, below the (.+) °C threshold$/, 'Izinga eliphansi $2 °C, ngaphansi komkhawulo ongu-$3 °C')
      .replace(/° slope, at or above the (.+)° threshold/, '° ukwehla, kufinyelela noma kudlule umkhawulo ongu-$1°')
      .replace(/° slope, between the (.+)° and (.+)° thresholds/, '° ukwehla, phakathi kwemikhawulo engu-$1° no-$2°');
    return `### ${r.id} · ${translated?.[0] ?? 'Hlola le ngozi nomeluleki'}\n\n${translated?.[1] ?? r.mitigation}\n\nUbufakazi / source trigger: ${evidence}`;
  }), ...(!risks.length ? ['Akukho okuphakamisiwe ngemithetho yalesi sihloli. Lokhu akusho ukuthi azikho ezinye izingozi.'] : [])].join('\n');
  const assurance = ['## Indlela yokusebenzisa lo mbiko', '',
    'Lo mbiko awukahlolwa uchwepheshe wezolimo. Uyisiqalo sokuhlela, hhayi umyalelo wokwakha noma wokuthenga.',
    'Sebenzisa ulwazi lwakho lwendawo. Imodeli ayazi konke okwenzeka enhlabathini, emanzini noma emndenini wakho.',
    'Bheka umthombo wesilinganiso somhlabathi. Idatha ye-SoilGrids iyimodeli yendawo ebanzi; izibalo ezijwayelekile azizona izilinganiso zaleli pulazi. Ukuhlolwa komhlabathi kusiza izinqumo zokufaka izinto emhlabathini.',
    'Bonisa umbiko kumeluleki wezolimo wendawo. Qinisekisa izilinganiso, izindleko nezimo zangempela ngaphambi kokusebenza.',
    'Bhala okutshalwe ngokoqobo, okuvuniwe nokuguqukile. Sebenzisa amarekhodi ukwenza uhlelo lwesizini elandelayo lube ngcono.',
  ].join('\n\n');
  return { cover, glance, backMatter: [crop, costs, monitoring, risk, assurance] };
}
