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
  },
  {
    "english": "Site Report — {name}",
    "zu": "Umbiko wendawo — {name}",
    "st": "Tlaleho ya sebaka — {name}",
    "ts": "Xiviko xa ndhawu — {name}",
    "ve": "Muvhigo wa fhethu — {name}"
  },
  {
    "english": "Nothing in this table was written by the report generator. Each figure is either measured off this farm's own map or read from the data source named beside it.",
    "zu": "Akukho kuleli thebula okubhalwe ngumkhiqizi wombiko. Isibalo ngasinye silinganiswa ebalazweni laleli pulazi noma sifundwa emthonjeni wedatha obhalwe eduze kwaso.",
    "st": "Ha ho letho tafoleng ena le ngotsweng ke sehlahisi sa tlaleho. Palo ka nngwe e lekantswe mmapeng wa polasi ena kapa e badilwe mohloding wa data o boletsweng haufi le yona.",
    "ts": "Ku hava lexi nga etafuleni leri lexi tsariweke hi muendli wa xiviko. Nhlayo yin'wana ni yin'wana yi pimiwe emepeni wa purasi leri kumbe yi hlayiwe eka xihlovo xa data lexi vuriweke ekusuhi na yona.",
    "ve": "A hu na tshithu kha thebulu iyi tsho ṅwalwaho nga mubveledzi wa muvhigo. Nomboro iṅwe na iṅwe yo pimiwa kha mapa wa bulasi iyi kana yo vhalwa kha tshiko tsha data tsho bulwaho tsini nayo."
  },
  {
    "english": "Measure",
    "zu": "Okulinganiswayo",
    "st": "Se lekanywang",
    "ts": "Lexi pimiwaka",
    "ve": "Tshine tsha pimiwa"
  },
  {
    "english": "Value",
    "zu": "Inani",
    "st": "Boleng",
    "ts": "Nhlayo",
    "ve": "Ndeme"
  },
  {
    "english": "Where it comes from",
    "zu": "Lapho kuvela khona",
    "st": "Moo se tswang teng",
    "ts": "Laha swi humaka kona",
    "ve": "Hune zwa bva hone"
  },
  {
    "english": "Named by the farmer",
    "zu": "Ibizwe ngegama ngumlimi",
    "st": "Se rehetswe ke molemi",
    "ts": "Yi thyiwe hi murimi",
    "ve": "Ho rehiwa nga mulimi"
  },
  {
    "english": "Property boundary",
    "zu": "Umngcele wendawo",
    "st": "Moedi wa sebaka",
    "ts": "Ndzilekano wa ndhawu",
    "ve": "Mukano wa fhethu"
  },
  {
    "english": "Mapped site area",
    "zu": "Ubukhulu bendawo ebalazwe",
    "st": "Boholo ba sebaka se mmapeng",
    "ts": "Vukulu bya ndhawu leyi nga emepeni",
    "ve": "Vhuhulu ha fhethu ho swaiwaho kha mapa"
  },
  {
    "english": "Sum of every shape drawn on the map (not a single traced boundary)",
    "zu": "Isamba sazo zonke izimo ezidwetshwe ebalazweni (akuwona umngcele owodwa olandelwe)",
    "st": "Kakaretso ya dibopeho tsohle tse takilweng mmapeng (ha se moedi o le mong o latetsweng)",
    "ts": "Ntsengo wa swivumbeko hinkwato leswi dirowiweke emepeni (a hi ndzilekano wun'we lowu landzelerisiweke)",
    "ve": "Ṱhanganyelo ya zwivhumbeo zwoṱhe zwo oliwaho kha mapa (a si mukano muthihi wo tevhedzelwaho)"
  },
  {
    "english": "Not traced",
    "zu": "Awukalandelwa ebalazweni",
    "st": "Ha o so latelwe mmapeng",
    "ts": "A wu si landzelerisiwa emepeni",
    "ve": "A u athu u tevhedzelwa kha mapa"
  },
  {
    "english": "Nothing drawn on the map yet",
    "zu": "Akukho okudwetshwe ebalazweni okwamanje",
    "st": "Ha ho eso takwe letho mmapeng",
    "ts": "Ku hava lexi nga si dirowiwa emepeni",
    "ve": "A hu athu u oliwa tshithu kha mapa"
  },
  {
    "english": "Growing area drawn",
    "zu": "Indawo yokutshala edwetshiwe",
    "st": "Sebaka sa temo se takilweng",
    "ts": "Ndhawu yo byala leyi dirowiweke",
    "ve": "Fhethu ha u ṱavha ho oliwaho"
  },
  {
    "english": "{count} bed {area}",
    "zu": "Umbhede ongu-{count} {area}",
    "st": "Bethe e {count} {area}",
    "ts": "Mubedo wa {count} {area}",
    "ve": "Mbethe wa {count} {area}"
  },
  {
    "english": "{count} beds {area}",
    "zu": "Imibhede engu-{count} {area}",
    "st": "Dibethe tse {count} {area}",
    "ts": "Mibedo ya {count} {area}",
    "ve": "Mibethe ya {count} {area}"
  },
  {
    "english": "{count} staple plot {area}",
    "zu": "Isiqephu sezitshalo eziyisisekelo esingu-{count} {area}",
    "st": "Tshimo e {count} ya dijalo tsa mantlha {area}",
    "ts": "Xiphemu xa {count} xa swibyariwa swa swakudya swa nkoka {area}",
    "ve": "Tshipiḓa tsha {count} tsha zwiliṅwa zwa zwiḽiwa zwa ndeme {area}"
  },
  {
    "english": "{count} staple plots {area}",
    "zu": "Iziqephu zezitshalo eziyisisekelo ezingu-{count} {area}",
    "st": "Ditshimo tse {count} tsa dijalo tsa mantlha {area}",
    "ts": "Swiphemu swa {count} swa swibyariwa swa swakudya swa nkoka {area}",
    "ve": "Zwipiḓa zwa {count} zwa zwiliṅwa zwa zwiḽiwa zwa ndeme {area}"
  },
  {
    "english": "Measured off the farmer's plan",
    "zu": "Ilinganiswe ohlelweni lomlimi",
    "st": "Se lekantswe moralong wa molemi",
    "ts": "Swi pimiwe eka pulani ya murimi",
    "ve": "Zwo pimiwa kha pulane ya mulimi"
  },
  {
    "english": "Trees and perennials placed",
    "zu": "Izihlahla nezitshalo zeminyaka eminingi ezibekiwe",
    "st": "Difate le dimela tsa dilemo tse ngata tse behilweng",
    "ts": "Mirhi ni swimilana swa nkarhi wo leha leswi vekiweke",
    "ve": "Miri na zwimela zwa miṅwaha minzhi zwo vhewaho"
  },
  {
    "english": "Placed by the farmer in the Design Studio",
    "zu": "Kubekwe ngumlimi eSitudiyo somklamo",
    "st": "Se behilwe ke molemi ho Studio sa moralo",
    "ts": "Swi vekiwe hi murimi eka Xitudiyo xa dizayini",
    "ve": "Zwo vhewa nga mulimi kha Studio ya nyolo"
  },
  {
    "english": "Structures placed",
    "zu": "Izakhiwo ezibekiwe",
    "st": "Meaho e behilweng",
    "ts": "Miako leyi vekiweke",
    "ve": "Zwifhaṱo zwo vhewaho"
  },
  {
    "english": "Earthworks and routes",
    "zu": "Imisebenzi yomhlabathi nemizila",
    "st": "Mesebetsi ya mobu le ditsela",
    "ts": "Mitirho ya misava ni tindlela",
    "ve": "Mishumo ya mavu na nḓila"
  },
  {
    "english": "Measured off the traced lines",
    "zu": "Ilinganiswe emigqeni elandelwe ebalazweni",
    "st": "Se lekantswe meleng e latetsweng mmapeng",
    "ts": "Swi pimiwe eka milayeni leyi landzelerisiweke emepeni",
    "ve": "Zwo pimiwa kha mitaladzi yo tevhedzelwaho kha mapa"
  },
  {
    "english": "Permaculture zones drawn",
    "zu": "Izindawo ze-permaculture ezidwetshiwe",
    "st": "Dizone tsa permaculture tse takilweng",
    "ts": "Tizoni ta permaculture leti dirowiweke",
    "ve": "Zouni dza permaculture dzo oliwaho"
  },
  {
    "english": "Zone {zone} {area}",
    "zu": "Indawo {zone} {area}",
    "st": "Sebaka {zone} {area}",
    "ts": "Zoni {zone} {area}",
    "ve": "Zouni {zone} {area}"
  },
  {
    "english": "Rings drawn by the farmer",
    "zu": "Izindilinga ezidwetshwe ngumlimi",
    "st": "Didikadikwe tse takilweng ke molemi",
    "ts": "Swirhendzevutana leswi dirowiweke hi murimi",
    "ve": "Zwitendeledzi zwo oliwaho nga mulimi"
  },
  {
    "english": "capacity not stated",
    "zu": "umthamo awubhaliwe",
    "st": "boholo ba polokelo ha bo bolelwe",
    "ts": "mpimo wo khoma a wu vuriwanga",
    "ve": "vhungomu a vhu ngo bulwa"
  },
  {
    "english": "{value} (drawn as proposed)",
    "zu": "{value} (kudwetshwe njengokuhleliwe)",
    "st": "{value} (e takilwe e le tshisinyo)",
    "ts": "{value} (swi dirowiwe swi ri leswi ringanyetiwaka)",
    "ve": "{value} (zwo oliwa zwi tshi kha ḓi dzinginywa)"
  },
  {
    "english": "Water storage on the plan",
    "zu": "Ukugcina amanzi ohlelweni",
    "st": "Polokelo ya metsi moralong",
    "ts": "Vuhlayiselo bya mati eka pulani",
    "ve": "Vhugalamaḓi kha pulane"
  },
  {
    "english": "Design Studio",
    "zu": "Isitudiyo somklamo",
    "st": "Studio sa moralo",
    "ts": "Xitudiyo xa dizayini",
    "ve": "Studio ya nyolo"
  },
  {
    "english": "Water points recorded",
    "zu": "Izindawo zamanzi ezibhaliwe",
    "st": "Dibaka tsa metsi tse ngotsweng",
    "ts": "Tindhawu ta mati leti rhekhodiweke",
    "ve": "Fhethu ha maḓi ho ṅwalwaho"
  },
  {
    "english": "Pinned on the map by the farmer",
    "zu": "Kumakwe ebalazweni ngumlimi",
    "st": "Se tshwailwe mmapeng ke molemi",
    "ts": "Swi funghiwe emepeni hi murimi",
    "ve": "Ho swaiwa kha mapa nga mulimi"
  },
  {
    "english": "Roof catchment traced",
    "zu": "Uphahla lokuqoqa amanzi olulandelwe ebalazweni",
    "st": "Marulelo a ho bokella metsi a latetsweng mmapeng",
    "ts": "Lwangu ro hlengeleta mati leri landzelerisiweke emepeni",
    "ve": "Ṱhanga ya u kuvhanganya maḓi yo tevhedzelwaho kha mapa"
  },
  {
    "english": "{area} → {harvest}/yr at {coefficient} runoff",
    "zu": "{area} → {harvest}/ngonyaka ngokugeleza okungu-{coefficient}",
    "st": "{area} → {harvest}/ka selemo ka phallo ya {coefficient}",
    "ts": "{area} → {harvest}/hi lembe hi ku khuluka ka {coefficient}",
    "ve": "{area} → {harvest}/nga ṅwaha kha u elela ha {coefficient}"
  },
  {
    "english": "Roof catchment",
    "zu": "Uphahla lokuqoqa amanzi",
    "st": "Marulelo a ho bokella metsi",
    "ts": "Lwangu ro hlengeleta mati",
    "ve": "Ṱhanga ya u kuvhanganya maḓi"
  },
  {
    "english": "Not traced or measured",
    "zu": "Akukalandelwa ebalazweni noma kukalwe",
    "st": "Ha a so latelwe mmapeng kapa a lekanngwe",
    "ts": "A swi si landzelerisiwa emepeni kumbe ku pimiwa",
    "ve": "A zwi athu u tevhedzelwa kha mapa kana u pimiwa"
  },
  {
    "english": "No roof outline on the map",
    "zu": "Awukho umngcele wophahla ebalazweni",
    "st": "Ha ho moedi wa marulelo mmapeng",
    "ts": "Ku hava xivumbeko xa lwangu emepeni",
    "ve": "A hu na mukano wa ṱhanga kha mapa"
  },
  {
    "english": "Crop plan entered",
    "zu": "Uhlelo lwezitshalo olufakiwe",
    "st": "Moralo wa dijalo o kentsweng",
    "ts": "Pulani ya swibyariwa leyi nghenisiweke",
    "ve": "Pulane ya zwiliṅwa yo dzheniswaho"
  },
  {
    "english": "{plantings} plantings, {crops} crops, across {beds} beds/plots",
    "zu": "Ukutshala okungu-{plantings}, izitshalo ezingu-{crops}, emibhedeni / eziqeshini ezingu-{beds}",
    "st": "Mela ya ho jala e {plantings}, dijalo tse {crops}, dibetheng / ditshimong tse {beds}",
    "ts": "Mibyalo ya {plantings}, swibyariwa swa {crops}, eka mibedo / swiphemu swa {beds}",
    "ve": "U ṱavha ha {plantings}, zwiliṅwa zwa {crops}, kha mibethe / zwipiḓa zwa {beds}"
  },
  {
    "english": "Entered by the farmer in the crop planner",
    "zu": "Kufakwe ngumlimi ohlelweni lokuhlela izitshalo",
    "st": "Se kentswe ke molemi ho moralo wa dijalo",
    "ts": "Swi nghenisiwe hi murimi eka xihleri xa swibyariwa",
    "ve": "Zwo dzheniswa nga mulimi kha tshishumiswa tsha u pulana zwiliṅwa"
  },
  {
    "english": "Farmer's scale correction",
    "zu": "Ukulungiswa kwesilinganiso ngumlimi",
    "st": "Tokiso ya sekala ya molemi",
    "ts": "Ku lulamisiwa ka xikalo hi murimi",
    "ve": "Ndulamiso ya tshikalo ya mulimi"
  },
  {
    "english": "{factor}x applied to every area and length above",
    "zu": "{factor}x isetshenziswe kuyo yonke indawo nobude obungenhla",
    "st": "{factor}x e sebedisitswe sebakeng le boleleleng bo bong le bo bong bo ka hodimo",
    "ts": "{factor}x yi tirhisiwile eka vukulu ni vulehi hinkwabyo leswi nga ehenhla",
    "ve": "{factor}x yo shumiswa kha vhuhulu na vhulapfu hoṱhe zwi re afho nṱha"
  },
  {
    "english": "Measured on site by the farmer",
    "zu": "Ilinganiswe endaweni ngumlimi",
    "st": "Se lekantswe sebakeng ke molemi",
    "ts": "Swi pimiwe endhawini hi murimi",
    "ve": "Zwo pimiwa henefho fhethu nga mulimi"
  },
  {
    "english": "Wind observed on site",
    "zu": "Umoya obonwe endaweni",
    "st": "Moya o bonweng sebakeng",
    "ts": "Moya lowu xiyisisiweke endhawini",
    "ve": "Muya wo ṱhogomelwaho henefho fhethu"
  },
  {
    "english": "From the {direction}",
    "zu": "Uvela ku-{direction}",
    "st": "O tswa ho {direction}",
    "ts": "Wu huma eka {direction}",
    "ve": "U bva kha {direction}"
  },
  {
    "english": ", strongest from the {direction}",
    "zu": ", unamandla kakhulu uma uvela ku-{direction}",
    "st": ", o matla ka ho fetisisa ha o tswa ho {direction}",
    "ts": ", wu ni ntamu swinene loko wu huma eka {direction}",
    "ve": ", u na maanḓa vhukuma u tshi bva kha {direction}"
  },
  {
    "english": "Farmer's own observation",
    "zu": "Okubonwe ngumlimi ngokwakhe",
    "st": "Se bonweng ke molemi ka boyena",
    "ts": "Leswi xiyisisiweke hi murimi hi yexe",
    "ve": "Zwo ṱhogomelwaho nga mulimi ene muṋe"
  },
  {
    "english": "Annual rainfall",
    "zu": "Imvula yonyaka",
    "st": "Pula ya selemo",
    "ts": "Mpfula ya lembe",
    "ve": "Mvula ya ṅwaha"
  },
  {
    "english": "{rainfall} mm — wet {wet}, dry {dry}",
    "zu": "{rainfall} mm — isikhathi semvula {wet}, isikhathi esomile {dry}",
    "st": "{rainfall} mm — nako ya pula {wet}, nako e ommeng {dry}",
    "ts": "{rainfall} mm — nguva ya mpfula {wet}, nguva yo oma {dry}",
    "ve": "{rainfall} mm — tshifhinga tsha mvula {wet}, tshifhinga tsho omaho {dry}"
  },
  {
    "english": "Climate data service",
    "zu": "Isevisi yedatha yesimo sezulu",
    "st": "Tshebeletso ya data ya tlelaemete",
    "ts": "Vukorhokeri bya data ya maxelo",
    "ve": "Tshumelo ya data ya kilima"
  },
  {
    "english": "Natural vegetation",
    "zu": "Izitshalo zemvelo",
    "st": "Dimela tsa tlhaho",
    "ts": "Swimilana swa ntumbuluko",
    "ve": "Zwimela zwa mupo"
  },
  {
    "english": "Agro-ecological zone",
    "zu": "Indawo yezolimo ngokwemvelo",
    "st": "Sebaka sa temo ho ya ka tikoloho",
    "ts": "Ndhawu ya vurimi hi ku ya hi mbango",
    "ve": "Fhethu ha vhulimi u ya nga mupo"
  },
  {
    "english": "Closest to {label}",
    "zu": "Kusondelene kakhulu no-{label}",
    "st": "Se haufi haholo le {label}",
    "ts": "Swi le kusuhi swinene ni {label}",
    "ve": "Hu tsini vhukuma na {label}"
  },
  {
    "english": "KZN DARD bioresource units — a best-effort climate match, not a verified classification",
    "zu": "Amayunithi ezinsiza zemvelo e-KZN DARD — ukuhambisana nesimo sezulu ngokusemandleni, hhayi ukuhlukaniswa okuqinisekisiwe",
    "st": "Dikarolo tsa mehlodi ya tlhaho tsa KZN DARD — ho lekanya ho tshwana ha tlelaemete ka boiteko bo botle, ha se sehlopha se netefaditsweng",
    "ts": "Tiyuniti ta switirhisiwa swa ntumbuluko ta KZN DARD — ku ringanisa maxelo hi vuswikoti hinkwabyo, a hi ku hambanisa loku tiyisisiweke",
    "ve": "Yunithi dza zwiko zwa mupo dza KZN DARD — u vhambedza kilima nga hune zwa konadzea ngaho, hu si khethekanyo yo khwaṱhisedzwaho"
  },
  {
    "english": "Soil (0-30 cm)",
    "zu": "Umhlabathi (0-30 cm)",
    "st": "Mobu (0-30 cm)",
    "ts": "Misava (0-30 cm)",
    "ve": "Mavu (0-30 cm)"
  },
  {
    "english": "pH {ph} · {carbon}% organic carbon · {texture}",
    "zu": "pH {ph} · {carbon}% ikhabhoni yemvelo · {texture}",
    "st": "pH {ph} · {carbon}% khabone ya dimela le diphoofolo · {texture}",
    "ts": "pH {ph} · {carbon}% khaboni ya swilo leswi hanyaka · {texture}",
    "ve": "pH {ph} · {carbon}% khaboni ya zwithu zwi tshilaho · {texture}"
  },
  {
    "english": "Soil test you uploaded",
    "zu": "Ukuhlolwa komhlabathi okufakile",
    "st": "Teko ya mobu eo o e kentseng",
    "ts": "Ndzavisiso wa misava lowu u wu ngheniseke",
    "ve": "Ndingo ya mavu ye na i dzhenisa"
  },
  {
    "english": "ISRIC SoilGrids model (district-wide, not your field)",
    "zu": "Imodeli ye-ISRIC SoilGrids (yesifunda sonke, hhayi insimu yakho)",
    "st": "Mohlala wa ISRIC SoilGrids (wa setereke kaofela, eseng tshimo ya hao)",
    "ts": "Modele ya ISRIC SoilGrids (ya xifundzatsongo hinkwaxo, ku nga ri nsimu ya wena)",
    "ve": "Modele ya ISRIC SoilGrids (ya tshiṱiriki tshoṱhe, hu si tsimu yaṋu)"
  },
  {
    "english": "NOT A READING — the app's generic defaults",
    "zu": "AKUSONA ISILINGANISO — amanani ajwayelekile e-app",
    "st": "HA SE TEKANYO — dipalo tse tlwaelehileng tsa app",
    "ts": "A HI MPIMO — tinhlayo ta ntolovelo ta app",
    "ve": "A SI MPIMO — nomboro dzo ḓoweleaho dza app"
  },
  {
    "english": "Soil data source not recorded",
    "zu": "Umthombo wedatha yomhlabathi awubhaliwe",
    "st": "Mohlodi wa data ya mobu ha o a ngolwa",
    "ts": "Xihlovo xa data ya misava a xi rhekhodiwanga",
    "ve": "Tshiko tsha data ya mavu a tsho ngo ṅwalwa"
  },
  {
    "english": "Elevation, slope, aspect",
    "zu": "Ukuphakama, ukwehla, lapho kubheke khona",
    "st": "Bophahamo, moepa, lehlakore le shebilweng",
    "ts": "Ku tlakuka, ku rhelela, tlhelo leri ku languteke eka rona",
    "ve": "Vhunṱha, mutsheṱo, sia ḽo livhiwaho"
  },
  {
    "english": "{elevation} m · {slope}° · faces {aspect}",
    "zu": "{elevation} m · {slope}° · kubheke ku-{aspect}",
    "st": "{elevation} m · {slope}° · se shebile {aspect}",
    "ts": "{elevation} m · {slope}° · ku langute eka {aspect}",
    "ve": "{elevation} m · {slope}° · hu livha kha {aspect}"
  },
  {
    "english": "SRTM elevation model",
    "zu": "Imodeli yokuphakama ye-SRTM",
    "st": "Mohlala wa bophahamo wa SRTM",
    "ts": "Modele ya ku tlakuka ya SRTM",
    "ve": "Modele ya vhunṱha ya SRTM"
  },
  {
    "english": "Not on this site",
    "zu": "Akukho kule ndawo",
    "st": "Ha se sebakeng sena",
    "ts": "A swi kona endhawini leyi",
    "ve": "A zwi ho fhethu afha"
  },
  {
    "english": "No {body}",
    "zu": "Akukho {body}",
    "st": "Ha ho na {body}",
    "ts": "Ku hava {body}",
    "ve": "A hu na {body}"
  },
  {
    "english": "no {body}",
    "zu": "akukho {body}",
    "st": "ha ho na {body}",
    "ts": "ku hava {body}",
    "ve": "a hu na {body}"
  },
  {
    "english": "Nothing of the kind drawn or recorded",
    "zu": "Akukho okunjalo okudwetshiwe noma okubhaliwe",
    "st": "Ha ho letho la mofuta oo le takilweng kapa le ngotsweng",
    "ts": "Ku hava swo tano leswi dirowiweke kumbe ku rhekhodiwa",
    "ve": "A hu na tshithu tsha lushaka ulwo tsho oliwaho kana u ṅwalwa"
  },
  {
    "english": "dam",
    "zu": "idamu",
    "st": "letamo",
    "ts": "damu",
    "ve": "damu"
  },
  {
    "english": "pond",
    "zu": "ichibi",
    "st": "letamo le lenyenyane",
    "ts": "xidziva",
    "ve": "tshidzivha"
  },
  {
    "english": "reservoir",
    "zu": "inqolobane yamanzi",
    "st": "polokelo ya metsi",
    "ts": "ndhawu yo hlayisa mati",
    "ve": "vhugalamaḓi"
  },
  {
    "english": "borehole",
    "zu": "umgodi wamanzi obholiwe",
    "st": "mosima wa metsi o tjhekilweng ka motjhine",
    "ts": "xihlovo xa mati lexi boriweke",
    "ve": "tshisima tsha maḓi tsho boriwaho"
  },
  {
    "english": "well",
    "zu": "umgodi wamanzi",
    "st": "sediba",
    "ts": "xihlovo xa mati lexi celiweke",
    "ve": "tshisima tsha maḓi"
  },
  {
    "english": "spring",
    "zu": "umthombo wamanzi",
    "st": "mohlodi wa metsi",
    "ts": "xihlovo xa mati xa ntumbuluko",
    "ve": "tshisima tsha mvelo"
  },
  {
    "english": "river",
    "zu": "umfula",
    "st": "noka",
    "ts": "nambu",
    "ve": "mulambo"
  },
  {
    "english": "perimeter",
    "zu": "ubude bomngcele",
    "st": "bolelele ba moedi",
    "ts": "vulehi bya ndzilekano",
    "ve": "vhulapfu ha mukano"
  },
  {
    "english": "tank",
    "zu": "ithangi",
    "st": "tanka",
    "ts": "thangi",
    "ve": "thannga"
  },
  {
    "english": "Traced on the map",
    "zu": "Kulandelwe ebalazweni",
    "st": "Se latetswe mmapeng",
    "ts": "Swi landzelerisiwe emepeni",
    "ve": "Ho tevhedzelwa kha mapa"
  },
  {
    "english": "Traced by the farmer on the map",
    "zu": "Kulandelwe ngumlimi ebalazweni",
    "st": "Se latetswe mmapeng ke molemi",
    "ts": "Swi landzelerisiwe emepeni hi murimi",
    "ve": "Ho tevhedzelwa kha mapa nga mulimi"
  },
  {
    "english": "Traced by the farmer in the Design Studio",
    "zu": "Kulandelwe ngumlimi eSitudiyo somklamo",
    "st": "Se latetswe ke molemi ho Studio sa moralo",
    "ts": "Swi landzelerisiwe hi murimi eka Xitudiyo xa dizayini",
    "ve": "Ho tevhedzelwa nga mulimi kha Studio ya nyolo"
  },
  {
    "english": "Traced by the farmer in the Design Studio ({count} points)",
    "zu": "Kulandelwe ngumlimi eSitudiyo somklamo (amaphoyinti angu-{count})",
    "st": "Se latetswe ke molemi ho Studio sa moralo (dintlha tse {count})",
    "ts": "Swi landzelerisiwe hi murimi eka Xitudiyo xa dizayini (tiphoyinti ta {count})",
    "ve": "Ho tevhedzelwa nga mulimi kha Studio ya nyolo (phoindi dza {count})"
  }
];
export const REPORT_DOCUMENT_LANGUAGES=['zu','st','ts','ve'] as const;
const documentCopy=new Map(REPORT_DOCUMENT_COPY.map(row=>[row.english,row]));
export function reportDocumentText(source:string,language='en',values:Record<string,string|number>={}):string {
  const row=documentCopy.get(source);
  const text=row&&REPORT_DOCUMENT_LANGUAGES.includes(language as typeof REPORT_DOCUMENT_LANGUAGES[number])?row[language as typeof REPORT_DOCUMENT_LANGUAGES[number]]:source;
  return text.replace(/\{(\w+)\}/g,(token,key:string)=>Object.hasOwn(values,key)?String(values[key]):token);
}

/** These are collector-authored provenance records, not farmer names or arbitrary annotations. */
export function reportRecordedSourceLabel(source:string,language='en'):string {
  const counted=/^Traced by the farmer in the Design Studio \((\d+) points\)$/.exec(source);
  if(counted)return reportDocumentText('Traced by the farmer in the Design Studio ({count} points)',language,{count:counted[1]});
  return ['Traced on the map','Traced by the farmer on the map','Traced by the farmer in the Design Studio'].includes(source)
    ?reportDocumentText(source,language):source;
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

/** Earlier isiZulu closing drafts, retained until the full closing builders gain native copy.
 * Cover and glance now use the same source-preserving builders in all four languages. */
export function zuluReportBackMatter(facts: ReportSiteFacts | null, d: LocationData, boq: BillOfQuantities, risks: RiskRow[]):string[] {
  const summary = reportSummaryPages(facts, d, 5, 'zu');
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
  return [crop, costs, monitoring, risk, assurance];
}
