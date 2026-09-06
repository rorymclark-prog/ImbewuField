import type { LocationData } from './types';
import type { ReportSiteFacts } from './report-site-facts';
import type { BillOfQuantities } from './report-boq';
import type { RiskRow } from './report-risk';
import { reportSummaryPages } from './report-summary';

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
  'Fruit, Nut & Berry Trees': 'Izihlahla zezithelo, amantongomane namajikijolo', 'Indigenous Trees': 'Izihlahla zendabuko',
  'Agroecosystem Planting Guide': 'Umhlahlandlela wokutshala ohambisana nemvelo', 'Crop Rotation': 'Ukushintshanisa izitshalo',
  'Animals & Livestock': 'Izilwane nemfuyo', 'Sun & Solar': 'Ilanga namandla elanga', 'Wind & Windbreaks': 'Umoya nezivimbamoya',
  'Fire & Hazards': 'Umlilo nezingozi', 'Economic Opportunities': 'Amathuba okuthola imali', 'Plant Guilds': 'Amaqoqo ezitshalo ezisizanayo',
  'Zone Design': 'Ukuhlelwa kwezindawo', 'Seasonal Calendar': 'Ikhalenda lezinkathi', '5-Year Vision': 'Umbono weminyaka emihlanu', 'Year 1 Priorities': 'Okubalulekile onyakeni wokuqala',
};
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
  const costs = ['## Uhlu lobuningi nezindleko', '', ...summary[3].lines.slice(0, 3), '', '| Into | Ubuningi | Intengo ngeyunithi | Isamba |', '|---|---|---|---|', ...boq.lines.map(l => `| ${cell(l.description)} | ${cell(l.quantity)} | ${l.rate ?? 'Intengo ayikho'} | ${l.zar === null ? l.unpriced === 'existing' ? 'Ikhona; ayifakiwe ezindlekweni ezintsha' : 'Kudingeka intengo noma isilinganiso' : `R ${l.zar.toLocaleString('en-ZA')}`} |`), '', 'Ubuningi buvela emklamweni. Izintengo ziyizilinganiso zokuhlela; qinisekisa ukuthutha, abasebenzi, intela namanani akamuva ngaphambi kokuthenga.'].join('\n');
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
