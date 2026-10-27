import { REPORT_UI_KEYS } from './i18n-pending.ts';
import { recordsDate, recordsMonthShort } from './records-months.ts';
import { numberLabel } from '@/lib/format-figures';
import type { LocationData } from './types';
import type { ReportSiteFacts } from './report-site-facts';
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
    "english": "Not measured; arrange a soil test",
    "zu": "Akukalwanga; hlela ukuhlolwa komhlabathi",
    "st": "Ha e a lekanyetswa; hlophisa teko ya mobu",
    "ts": "A swi pimiwanga; lunghiselela ku kamberiwa ka misava",
    "ve": "A zwo ngo eletshedzwa; dzudzanyani ndingo ya mavu"
  },
  {
    "english": "No laboratory result or SoilGrids source recorded",
    "zu": "Akukho miphumela yaselabhorethri noma umthombo we-SoilGrids orekhodiwe",
    "st": "Ha ho na sephetho sa laboratori kapa mohlodi wa SoilGrids o ngodisitsweng",
    "ts": "A ku na mbuyelo wa laboratori kumbe xihlovo xa SoilGrids lexi rhekhodiweke",
    "ve": "A hu na mvelelo ya laborathori kana tshisima tsha SoilGrids tsho rekhodiwaho"
  },
  {
    "english": "Local market evidence",
    "zu": "Ubufakazi bemakethe yendawo",
    "st": "Bopaki ba mmaraka wa lehae",
    "ts": "Vumbhoni bya makete wa laha kaya",
    "ve": "Vhuṱanzi ha makete wa henefho"
  },
  {
    "english": "Local market notes (farmer-reported): {notes}",
    "zu": "Amanothi emakethe yendawo (abikwe ngumlimi): {notes}",
    "st": "Dintlha tsa mmaraka wa lehae (tse tlalehilweng ke sehwai): {notes}",
    "ts": "Tinotsi ta makete wa laha kaya (leti vikiweke hi murimi): {notes}",
    "ve": "Notsi dza makete wa henefho (dzo vhigwaho nga murimi): {notes}"
  },
  {
    "english": "Market source as reported: {source}",
    "zu": "Umthombo wemakethe njengoba ubikiwe: {source}",
    "st": "Mohlodi wa mmaraka jwalo ka ha o tlalehilwe: {source}",
    "ts": "Xihlovo xa makete hilaha xi vikiweke hakona: {source}",
    "ve": "Tshisima tsha makete sa zwe tsha vhigwa: {source}"
  },
  {
    "english": "Market observation / discussion date: {date}",
    "zu": "Usuku lokubona noma lokuxoxa ngemakethe: {date}",
    "st": "Letsatsi la ho bona kapa ho buisana ka mmaraka: {date}",
    "ts": "Siku ro languta kumbe ku burisana hi makete: {date}",
    "ve": "Ḓuvha ḽa u vhona kana u haseledza nga ha makete: {date}"
  },
  {
    "english": "Not recorded",
    "zu": "Akurekhodiwe",
    "st": "Ha e a ngodiswa",
    "ts": "A swi rhekhodiwanga",
    "ve": "A zwo ngo rekhodiwa"
  },
  {
    "english": "Not recorded; the survey save date is not an observation date",
    "zu": "Akurekhodiwe; usuku lokugcina uhlolo akulona usuku lokubona",
    "st": "Ha e a ngodiswa; letsatsi la ho boloka phuputso hase letsatsi la ho bona",
    "ts": "A swi rhekhodiwanga; siku ro hlayisa ndzavisiso a hi siku ro languta",
    "ve": "A zwo ngo rekhodiwa; ḓuvha ḽa u vhulunga ṱhoḓisiso a si ḓuvha ḽa u vhona"
  },
  {
    "english": "These notes are not independently verified demand, a current price or a purchase commitment. Confirm buyer, product, quantity, unit, price, transport and date before planning sales.",
    "zu": "Lawa manothi awakona ukufunwa okuqinisekiswe ngokuzimela, inani lamanje noma isibopho sokuthenga. Qinisekisa umthengi, umkhiqizo, inani, iyunithi, intengo, ukuthutha nosuku ngaphambi kokuhlela ukuthengisa.",
    "st": "Dintlha tsena hase tlhoko e netefaditsweng ka boikemelo, theko ya jwale kapa boitlamo ba ho reka. Netefatsa moreki, sehlahiswa, bongata, yuniti, theko, dipalangwang le letsatsi pele o rera ho rekisa.",
    "ts": "Tinotsi leti a hi xilaveko lexi tiyisisiweke hi ku tiyimela, nxavo wa sweswi kumbe xitshembiso xa ku xava. Tiyisisa muxavi, xikumiwa, nhlayo, yuniti, nxavo, vutleketli ni siku u nga si kunguhata ku xavisa.",
    "ve": "Notsi idzi a si ṱhoḓea yo khwaṱhisedzwaho nga u ḓiimisa, mutengo wa zwino kana vhuḓiimiseli ha u renga. Khwaṱhisedzani murengi, tshibveledzwa, vhunzhi, yuniti, mutengo, vhuendi na ḓuvha musi ni sa athu u dzudzanya u rengisa."
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
  },
  {
    "english": "Harvest by crop",
    "zu": "Isivuno ngesitshalo",
    "st": "Kotulo ka sejalo",
    "ts": "Ntshovelo hi xibyariwa",
    "ve": "Khaṋo nga tshiliṅwa"
  },
  {
    "english": "Is the land actually producing food, and which crops carry it?",
    "zu": "Ingabe umhlaba ukhiqiza ukudla ngokoqobo, futhi yiziphi izitshalo ezikwenzayo?",
    "st": "Na mobu o hlile o hlahisa dijo, mme ke dijalo dife tse di hlahisang?",
    "ts": "Xana misava yi humelerisa swakudya hakunene, naswona i swibyariwa swihi leswi swi humelerisaka?",
    "ve": "Naa mavu a khou bveledza zwiḽiwa zwa vhukuma, nahone ndi zwiliṅwa zwifhio zwine zwa zwi bveledza?"
  },
  {
    "english": "The report does not read harvest logs; record the starting period before support, or label a later baseline as retrospective",
    "zu": "Umbiko awufundi amarekhodi esivuno; bhala isikhathi sokuqala ngaphambi kosizo, noma ubeke uphawu lokuthi isimo sokuqala esibhalwe kamuva sibheka emuva",
    "st": "Tlaleho ha e bale direkoto tsa kotulo; ngola nako ya qalo pele ho tshehetso, kapa o hlalose motheo o ngotsweng hamorao e le o hopotsweng ka morao",
    "ts": "Xiviko a xi hlayi tirhekhodo ta ntshovelo; rhekhoda nkarhi wo sungula mpfuno wu nga si sungula, kumbe u fungha mpimo wo sungula wa le ndzhaku leswaku wu tsariwe hi ku languta swa khale",
    "ve": "Muvhigo a u vhali rekhodo dza khaṋo; ṅwalani tshifhinga tsha u thoma musi thuso i sa athu thoma, kana ni sumbedze uri ndeme ya u thoma yo ṅwalwaho nga murahu ndi ya u humbula zwa kale"
  },
  {
    "english": "Weigh each pick and log it against the crop",
    "zu": "Kala isisindo njalo uma uvuna bese usibhala ngesitshalo",
    "st": "Kala boima ba kotulo ka nngwe mme o e ngole tlasa sejalo",
    "ts": "Pima ntiko wa ntshovelo wun'wana ni wun'wana kutani u wu rhekhoda eka xibyariwa",
    "ve": "Kalani tshileme tsha khaṋo iṅwe na iṅwe ni tshi ṅwale kha tshiliṅwa tshayo"
  },
  {
    "english": "Every harvest",
    "zu": "Njalo uma kuvunwa",
    "st": "Kotulong e nngwe le e nngwe",
    "ts": "Eka ntshovelo wun'wana ni wun'wana",
    "ve": "Kha khaṋo iṅwe na iṅwe"
  },
  {
    "english": "Harvest log",
    "zu": "Irekhodi lesivuno",
    "st": "Rekoto ya kotulo",
    "ts": "Rhekhodo ya ntshovelo",
    "ve": "Rekhodo ya khaṋo"
  },
  {
    "english": "Sold vs kept",
    "zu": "Okuthengisiwe nokugciniwe",
    "st": "Tse rekisitsweng le tse bolokilweng",
    "ts": "Leswi xavisiweke ni leswi hlayisiweke",
    "ve": "Zwo rengiswaho na zwo vhulungwaho"
  },
  {
    "english": "How much of the harvest was sold, and how much fed the household?",
    "zu": "Kungakanani kwesivuno okuthengisiwe, futhi kungakanani okudliwe ekhaya?",
    "st": "Ke kotulo e kae e rekisitsweng, mme ke e kae e jeweng lapeng?",
    "ts": "Xana ku xavisiwe ntshovelo wo fika kwihi, naswona wu dyiwe wo fika kwihi ekaya?",
    "ve": "Ndi khaṋo nngafhani yo rengiswaho, nahone ndi nngafhani yo ḽiwaho muṱani?"
  },
  {
    "english": "Set by the first full month of both logs",
    "zu": "Kunqunywa yinyanga yokuqala ephelele yamarekhodi womabili",
    "st": "E behwa ke kgwedi ya pele e felletseng ya direkoto ka bobedi",
    "ts": "Swi vekiwa hi n'hweti yo sungula leyi heleleke ya tirhekhodo hatimbirhi",
    "ve": "Zwi vhewa nga ṅwedzi wa u thoma wo fhelelaho wa rekhodo dzoṱhe mbili"
  },
  {
    "english": "Log sales, home use, donations, losses and stored stock separately. Harvest minus sales is not household consumption.",
    "zu": "Bhala ukuthengisa, ukusetshenziswa ekhaya, okunikelwe, okulahlekile nokugciniwe ngokwehlukana. Isivuno kususwe okuthengisiwe asilingani nokudla okudliwe ekhaya.",
    "st": "Ngola thekiso, tshebediso ya lapeng, dimpho, ditahlehelo le thepa e bolokilweng ka thoko. Kotulo ha ho tlositswe thekiso ha e bolele dijo tse jeweng lapeng.",
    "ts": "Rhekhoda leswi xavisiweke, leswi tirhisiweke ekaya, tinyiko, leswi lahlekeke ni leswi hlayisiweke hi ku hambana. Ntshovelo loko ku susiwa leswi xavisiweke a swi vuli leswi dyiweke ekaya.",
    "ve": "Ṅwalani thengiso, zwine zwa shumiswa muṱani, zwifhiwa, ndozwo na zwo vhulungwaho nga u fhambana. Khaṋo yo bviswa zwo rengiswaho a i ambi zwiḽiwa zwo ḽiwaho muṱani."
  },
  {
    "english": "Every sale",
    "zu": "Njalo uma kuthengiswa",
    "st": "Thekisong e nngwe le e nngwe",
    "ts": "Eka ku xavisa kun'wana ni kun'wana",
    "ve": "Kha thengiso iṅwe na iṅwe"
  },
  {
    "english": "Sales ledger",
    "zu": "Irejista yokuthengisa",
    "st": "Buka ya thekiso",
    "ts": "Buku ya ku xavisa",
    "ve": "Bugu ya thengiso"
  },
  {
    "english": "Tree and perennial survival",
    "zu": "Ukuphila kwezihlahla nezitshalo zeminyaka eminingi",
    "st": "Ho phela ha difate le dimela tsa dilemo tse ngata",
    "ts": "Ku hanya ka mirhi ni swimilana swa nkarhi wo leha",
    "ve": "U tshila ha miri na zwimela zwa miṅwaha minzhi"
  },
  {
    "english": "Are the perennials that were planted still alive a year later?",
    "zu": "Ingabe izitshalo zeminyaka eminingi ezatshalwa zisaphila ngemva konyaka?",
    "st": "Na dimela tsa dilemo tse ngata tse jetsweng di sa phela selemo hamorao?",
    "ts": "Xana swimilana swa nkarhi wo leha leswi byariweke swa ha hanya endzhaku ka lembe?",
    "ve": "Naa zwimela zwa miṅwaha minzhi zwo ṱavhiwaho zwi kha ḓi tshila nga murahu ha ṅwaha?"
  },
  {
    "english": "{count} placed on the plan{names}",
    "zu": "Kubekwe ezi-{count} epulanini{names}",
    "st": "Ho behilwe tse {count} moralong{names}",
    "ts": "Ku vekiwile {count} eka pulani{names}",
    "ve": "Ho vhewa zwa {count} kha pulane{names}"
  },
  {
    "english": "No trees placed on the plan yet",
    "zu": "Azikho izihlahla ezibekiwe epulanini okwamanje",
    "st": "Ha ho difate tse behilweng moralong hajwale",
    "ts": "A ku si va na mirhi leyi vekiweke eka pulani",
    "ve": "A hu athu vhewa miri kha pulane"
  },
  {
    "english": "First verify how many were actually planted and when. Count living plants against that planting cohort, not proposed map items; record replacements separately.",
    "zu": "Qala uqinisekise ukuthi zingaki ezatshalwa ngokoqobo nokuthi nini. Bala eziphilayo uziqhathanise nalelo qoqo elatshalwa, hhayi izinto ezihlongozwe ebalazweni; bhala ezifakwe esikhundleni ngokwehlukana.",
    "st": "Qala ka ho netefatsa hore ho jetswe tse kae ka nnete le neng. Bala tse phelang o di bapise le sehlopha seo se jetsweng, eseng dintho tse sisintsweng mmapeng; ngola tse kenang sebakeng sa tse shweleng ka thoko.",
    "ts": "Rhanga u tiyisisa leswaku ku byariwe swingani hakunene ni leswaku rini. Hlayela swimilana leswi hanyaka eka ntlawa wolowo lowu byariweke, ku nga ri swilo leswi ringanyetiweke emepeni; rhekhoda leswi pfalaka leswin'wana hi ku hambana.",
    "ve": "Thomani nga u khwaṱhisedza uri ho ṱavhiwa zwingana zwa vhukuma na uri lini. Vhalani zwimela zwi tshilaho ni zwi vhambedze na tshigwada tshenetsho tsho ṱavhiwaho, hu si zwo dzinginywaho kha mapa; ṅwalani zwo valaho zwiṅwe nga u fhambana."
  },
  {
    "english": "Every six months, and after any drought or fire",
    "zu": "Njalo ezinyangeni eziyisithupha, nangemva kwanoma yisiphi isomiso noma umlilo",
    "st": "Dikgweding tse ding le tse ding tse tsheletseng, le ka mora komello kapa mollo ofe kapa ofe",
    "ts": "Endzhaku ka tin'hweti tin'wana ni tin'wana ta tsevu, ni le ndzhaku ka dyandza kumbe ndzilo wun'wana ni wun'wana",
    "ve": "Nga murahu ha miṅwedzi miṅwe na miṅwe ya rathi, na nga murahu ha gomelelo kana mulilo muṅwe na muṅwe"
  },
  {
    "english": "Field journal",
    "zu": "Idayari yasensimini",
    "st": "Bukana ya tshimo",
    "ts": "Dayari ya nsimu",
    "ve": "Dayari ya tsimu"
  },
  {
    "english": "Ground cover",
    "zu": "Ukumbozwa komhlabathi",
    "st": "Sekoahelo sa mobu",
    "ts": "Ku funengeteka ka misava",
    "ve": "U tibilwa ha mavu"
  },
  {
    "english": "Is bare soil shrinking or spreading?",
    "zu": "Ingabe umhlabathi ongenalutho uyancipha noma uyanda?",
    "st": "Na mobu o sa kwahelwang o a fokotseha kapa o a ata?",
    "ts": "Xana misava leyi nga funengetiwangiki ya hunguteka kumbe ya andza?",
    "ve": "Naa mavu a songo tibedzwaho a khou fhungudzea kana u engedzea?"
  },
  {
    "english": "Photograph the fixed points before any work starts",
    "zu": "Thatha izithombe ezindaweni ezimisiwe ngaphambi kokuqala kwanoma yimuphi umsebenzi",
    "st": "Nka dinepe dibakeng tse tshwailweng pele mosebetsi ofe kapa ofe o qala",
    "ts": "Teka swifaniso etindhawini leti hlawuriweke ku nga si sungula mitirho",
    "ve": "Fodani fhethu ho vhewaho musi mushumo muṅwe na muṅwe u sa athu thoma"
  },
  {
    "english": "Photograph the same three marked spots, from the same standing position, facing the same way",
    "zu": "Thatha izithombe ezindaweni ezintathu ezifanayo ezimakiwe, ume endaweni efanayo ubheke ohlangothini olufanayo",
    "st": "Nka dinepe dibakeng tse tharo tse tshwanang tse tshwailweng, o eme sebakeng se tshwanang, o shebile nqa e tshwanang",
    "ts": "Teka swifaniso eka tindhawu tinharhu leti fanaka leti funghiweke, u yime endhawini leyi fanaka, u langute tlhelo leri fanaka",
    "ve": "Fodani fhethu huthihi huraru ho swaiwaho, no ima fhethu huthihi, no sedza thungo huthihi"
  },
  {
    "english": "Once a season, four times a year",
    "zu": "Kanye ngesizini, kane ngonyaka",
    "st": "Hang ka sehla, makgetlo a mane ka selemo",
    "ts": "Kan'we hi nguva, ka mune hi lembe",
    "ve": "Luthihi nga khalanwaha, luṋa nga ṅwaha"
  },
  {
    "english": "Field journal photographs",
    "zu": "Izithombe zedayari yasensimini",
    "st": "Dinepe tsa bukana ya tshimo",
    "ts": "Swifaniso swa dayari ya nsimu",
    "ve": "Zwifanyiso zwa dayari ya tsimu"
  },
  {
    "english": "Stored water",
    "zu": "Amanzi agciniwe",
    "st": "Metsi a bolokilweng",
    "ts": "Mati lama hlayisiweke",
    "ve": "Maḓi o vhulungwaho"
  },
  {
    "english": "Does the stored water last through the dry months?",
    "zu": "Ingabe amanzi agciniwe anela kuzo zonke izinyanga ezomile?",
    "st": "Na metsi a bolokilweng a lekana dikgweding tse ommeng?",
    "ts": "Xana mati lama hlayisiweke ma ringana tin'hweti hinkwato leti omeke?",
    "ve": "Naa maḓi o vhulungwaho a a lingana kha miṅwedzi yo omayo?"
  },
  {
    "english": "{litres} L of tank capacity on the plan",
    "zu": "Umthamo wamathangi ongu-{litres} L epulanini",
    "st": "Bokgoni ba ditanka ba {litres} L moralong",
    "ts": "Vundzeni bya mathangi bya {litres} L eka pulani",
    "ve": "Vhungala ha thannga ha {litres} L kha pulane"
  },
  {
    "english": "No tank capacity stated on the plan yet",
    "zu": "Awukho umthamo wethangi obhaliwe epulanini okwamanje",
    "st": "Ha ho bokgoni ba tanka bo boletsweng moralong hajwale",
    "ts": "A ku si va na vundzeni bya thangi leri vuriweke eka pulani",
    "ve": "A hu athu bulwa vhungala ha thannga kha pulane"
  },
  {
    "english": "Read the tank level on the same day each month and write down the date and the level",
    "zu": "Funda izinga lamanzi ethangini ngosuku olufanayo nyanga zonke bese ubhala usuku nezinga",
    "st": "Bala boemo ba metsi ka tankeng ka letsatsi le tshwanang kgwedi le kgwedi, mme o ngole letsatsi le boemo",
    "ts": "Hlaya mpimo wa mati ethangini hi siku leri fanaka n'hweti yin'wana ni yin'wana kutani u tsala siku ni mpimo",
    "ve": "Vhalani vhuimo ha maḓi kha thannga nga ḓuvha ḽithihi ṅwedzi muṅwe na muṅwe ni ṅwale ḓuvha na vhuimo"
  },
  {
    "english": "Monthly",
    "zu": "Nyanga zonke",
    "st": "Kgwedi le kgwedi",
    "ts": "N'hweti yin'wana ni yin'wana",
    "ve": "Ṅwedzi muṅwe na muṅwe"
  },
  {
    "english": "{count} bed",
    "zu": "umbhede ongu-{count}",
    "st": "bethe e {count}",
    "ts": "mbedo wa {count}",
    "ve": "mbethe wa {count}"
  },
  {
    "english": "{count} beds",
    "zu": "imibhede engu-{count}",
    "st": "dibethe tse {count}",
    "ts": "mibedo ya {count}",
    "ve": "mibethe ya {count}"
  },
  {
    "english": "{count} plot",
    "zu": "isiza esingu-{count}",
    "st": "tshimo e {count}",
    "ts": "nsimu ya {count}",
    "ve": "tsimu ya {count}"
  },
  {
    "english": "{count} plots",
    "zu": "iziza ezingu-{count}",
    "st": "masimo a {count}",
    "ts": "masimu ya {count}",
    "ve": "tsimu dza {count}"
  },
  {
    "english": " and ",
    "zu": " kanye ",
    "st": " le ",
    "ts": " ni ",
    "ve": " na "
  },
  {
    "english": "Growing area in use",
    "zu": "Indawo yokutshala esetshenziswayo",
    "st": "Sebaka sa temo se sebediswang",
    "ts": "Ndhawu yo byala leyi tirhisiwaka",
    "ve": "Fhethu ha u ṱavha hu shumiswaho"
  },
  {
    "english": "How much of the drawn growing area is actually planted?",
    "zu": "Kungakanani kwendawo yokutshala edwetshiwe okutshalwe ngokoqobo?",
    "st": "Ke sebaka se sekae sa temo se takilweng se hlileng se jetsweng?",
    "ts": "Xana i ndhawu yo fika kwihi eka leyi dirowiweke yo byala leyi byariweke hakunene?",
    "ve": "Ndi fhethu hungafhani ha u ṱavha ho olwaho he ha ṱavhiwa zwa vhukuma?"
  },
  {
    "english": "{area} m² drawn across {parts}",
    "zu": "Kudwetshwe {area} m² kuyo {parts}",
    "st": "Ho takilwe {area} m² ho {parts}",
    "ts": "Ku dirowiwe {area} m² eka {parts}",
    "ve": "Ho olwa {area} m² kha {parts}"
  },
  {
    "english": "Measure the physical beds carrying a crop, counting each once. A saved crop plan is planned use, not confirmation of actual planting.",
    "zu": "Linganisa imibhede engokoqobo enezitshalo, ubale ngamunye kanye. Uhlelo lwezitshalo olugciniwe luwukusetshenziswa okuhleliwe, alusikho ukuqinisekisa ukuthi kutshalwe ngokoqobo.",
    "st": "Lekanya dibethe tsa nnete tse nang le sejalo, o bale e nngwe le e nngwe hang feela. Moralo wa dijalo o bolokilweng ke tshebediso e rerilweng, ha o netefatse hore ho jetswe ka nnete.",
    "ts": "Pima mibedo ya xiviri leyi nga ni xibyariwa, u hlayela wun'wana ni wun'wana kan'we. Pulani ya swibyariwa leyi hlayisiweke i matirhiselo lama kunguhatiweke, a hi xitiyisekiso xa ku byala ka xiviri.",
    "ve": "Pimani mibethe ya vhukuma i re na tshiliṅwa, ni vhale muṅwe na muṅwe luthihi. Pulane ya zwiliṅwa yo vhulungwaho ndi u shumisa ho pulaniwaho, a i khwaṱhisedzi u ṱavhiwa ha vhukuma."
  },
  {
    "english": "Crop planner",
    "zu": "Isihleli sezitshalo",
    "st": "Sehlophisi sa dijalo",
    "ts": "Xipulani xa swibyariwa",
    "ve": "Mupulani wa zwiliṅwa"
  },
  {
    "english": "Monitoring & Evaluation Plan",
    "zu": "Uhlelo lokuqapha nokuhlola",
    "st": "Moralo wa ho beha leihlo le ho lekola",
    "ts": "Pulani yo landzelerisa ni ku kambela",
    "ve": "Pulane ya u sedzulusa na u ṱhaṱhuvha"
  },
  {
    "english": "Each indicator below is one this app can record, on a screen that already exists. An indicator nobody can capture is not a plan — it is a wish, and it is why most monitoring tables are empty a year later.",
    "zu": "Inkomba ngayinye engezansi ingabhalwa kule app, esikrinini esikhona kakade. Inkomba engeke iqoshwe muntu ayilona uhlelo — iyisifiso, futhi yingakho amathebula amaningi okuqapha enganalutho ngemva konyaka.",
    "st": "Letshwao ka leng le ka tlase le ka ngolwa ke app ena, skrineng se seng se le teng. Letshwao leo ho seng motho ya ka le rekotang ha se moralo — ke takatso, mme ke ka hoo ditafole tse ngata tsa ho beha leihlo di se nang letho selemo hamorao.",
    "ts": "Xikombiso xin'wana ni xin'wana laha hansi xi nga rhekhodiwa hi app leyi, eka xikrini lexi se xi nga kona. Xikombiso lexi ku nga riki na munhu loyi a nga xi rhekhodaka a hi pulani — i ku navela, naswona hi swona leswi endlaka leswaku matafula yo tala yo landzelerisa ma nga vi na swona endzhaku ka lembe.",
    "ve": "Tshisumbedzi tshiṅwe na tshiṅwe afho fhasi tshi nga ṅwalwa nga app iyi, kha tshikirini tshi re hone. Tshisumbedzi tshine ha vha hu si na ane a nga tshi ṅwala a si pulane — ndi nyemulo, nahone ndi ngazwo thebuḽu nnzhi dza u sedzulusa dzi tshi vha dzi si na tshithu nga murahu ha ṅwaha."
  },
  {
    "english": "Indicator",
    "zu": "Inkomba",
    "st": "Letshwao",
    "ts": "Xikombiso",
    "ve": "Tshisumbedzi"
  },
  {
    "english": "What it answers",
    "zu": "Umbuzo ewuphendulayo",
    "st": "Potso eo le e arabang",
    "ts": "Leswi xi swi hlamulaka",
    "ve": "Zwine tsha fhindula"
  },
  {
    "english": "Baseline",
    "zu": "Isimo sokuqala",
    "st": "Motheo wa qalo",
    "ts": "Mpimo wo sungula",
    "ve": "Vhuimo ha u thoma"
  },
  {
    "english": "How to measure",
    "zu": "Indlela yokulinganisa",
    "st": "Mokgwa wa ho lekanya",
    "ts": "Ndlela yo pima",
    "ve": "Nḓila ya u pima"
  },
  {
    "english": "How often",
    "zu": "Kangaki",
    "st": "Hangata hakae",
    "ts": "Kangani",
    "ve": "Lungana"
  },
  {
    "english": "Recorded in",
    "zu": "Kubhalwa kuphi",
    "st": "Ho ngolwa hokae",
    "ts": "Swi rhekhodiwa kwihi",
    "ve": "Zwi ṅwalwa ngafhi"
  },
  {
    "english": "Take baseline readings before support starts. Label any later or recalled starting figures clearly; compare matching periods and do not attribute every change to the project.",
    "zu": "Thatha izilinganiso zesimo sokuqala ngaphambi kokuqala kosizo. Cacisa noma yiziphi izibalo zokuqala eziqoshwe kamuva noma ezikhunjulwayo; qhathanisa izikhathi ezifanayo futhi ungasho ukuthi lonke ushintsho ludalwe yiphrojekthi.",
    "st": "Nka ditekanyo tsa motheo pele tshehetso e qala. Hlalosa ka ho hlaka dipalo tsa qalo tse nkilweng hamorao kapa tse hopotsweng; bapisa dinako tse tshwanang mme o se ke wa re phetoho e nngwe le e nngwe e bakilwe ke projeke.",
    "ts": "Teka mimpimo yo sungula mpfuno wu nga si sungula. Fungha kahle tinhlayo to sungula leti tekiweke endzhaku kumbe leti tsundzukiwaka; ringanisa minkarhi leyi fanaka naswona u nga vuli leswaku ku cinca kun'wana ni kun'wana ku vangiwe hi phurojeke.",
    "ve": "Tekani mbonalo dza u thoma musi thuso i sa athu thoma. Sumbedzani zwavhuḓi nomboro dza u thoma dzo ṅwalwaho nga murahu kana dzo humbulwaho; vhambedzani zwifhinga zwi fanaho ni si dzhie uri tshanduko iṅwe na iṅwe yo vhangwa nga thandela."
  },
  {
    "english": "Dry-season crop failure from insufficient stored water",
    "zu": "Ukungaphumeleli kwezitshalo ngesikhathi esomile ngenxa yamanzi agciniwe anganele",
    "st": "Ho hloleha ha dijalo sehleng se ommeng ka lebaka la metsi a bolokilweng a sa lekaneng",
    "ts": "Ku tsandzeka ka swibyariwa hi nguva yo oma hi mhaka ya mati lama hlayisiweke lama nga enelangiki",
    "ve": "U kundelwa ha zwiliṅwa nga khalanwaha yo omayo nga ṅwambo wa maḓi o vhulungwaho a sa lingani"
  },
  {
    "english": "{rainfall} mm/yr, below the {threshold} mm threshold this register uses for a water-limited site",
    "zu": "{rainfall} mm/ngonyaka, ngaphansi komkhawulo ongu-{threshold} mm osetshenziswa yile rejista endaweni enamanzi ancane",
    "st": "{rainfall} mm/selemo, ka tlase ho moedi wa {threshold} mm oo rejista ena e o sebedisang bakeng sa sebaka se nang le metsi a fokolang",
    "ts": "{rainfall} mm/lembe, ehansi ka mpimo wa {threshold} mm lowu rhejistara leyi yi wu tirhisaka eka ndhawu leyi nga ni mati lama pimiweke",
    "ve": "{rainfall} mm/ṅwaha, fhasi ha mukano wa {threshold} mm une redzhisiṱara iyi ya u shumisa kha fhethu hu re na maḓi maṱuku"
  },
  {
    "english": "Build storage before expanding planted area. Size the tanks against the roof catchment figure in the water section, and plant the dry months from stored water only.",
    "zu": "Yakha indawo yokugcina amanzi ngaphambi kokwandisa indawo etshaliwe. Khetha usayizi wamathangi ngokwesibalo samanzi ophahla esigabeni samanzi, bese utshala ezinyangeni ezomile ngamanzi agciniwe kuphela.",
    "st": "Haha polokelo ya metsi pele o atolosa sebaka se jetsweng. Lekanya boholo ba ditanka ho ya ka palo ya metsi a marulelo karolong ya metsi, mme o jale dikgweding tse ommeng ka metsi a bolokilweng feela.",
    "ts": "Aka vuhlayiselo bya mati u nga si ndlandlamuxa ndhawu leyi byariweke. Pima mathangi hi ku ya hi nhlayo ya mati ya lwangu eka xiyenge xa mati, kutani u byala hi tin'hweti to oma hi mati lama hlayisiweke ntsena.",
    "ve": "Fhaṱani vhugalelo ha maḓi musi ni sa athu engedza fhethu ho ṱavhiwaho. Khethani vhuhulwane ha thannga nga nomboro ya maḓi a ṱhanga kha khethekanyo ya maḓi, ni ṱavhe nga miṅwedzi yo omayo nga maḓi o vhulungwaho fhedzi."
  },
  {
    "english": "Roof runoff is lost — catchment traced but nothing to store it in",
    "zu": "Amanzi agelezayo ophahla ayalahleka — uphahla ludwetshiwe kodwa akukho okuwugcina",
    "st": "Metsi a phallang marulelong a a lahleha — sebaka sa ho a bokella se takilwe empa ha ho moo a bolokwang teng",
    "ts": "Mati ya lwangu ma lahleka — ndhawu yo ma hlengeleta yi dirowiwile kambe a ku na xo ma hlayisela eka xona",
    "ve": "Maḓi a elelaho a ṱhanga a a xela — fhethu ha u a kuvhanganya ho olwa fhedzi a hu na tsha u a vhulunga"
  },
  {
    "english": "{area} m² of roof traced and 0 L of tank capacity on the plan",
    "zu": "Uphahla olungu-{area} m² ludwetshiwe nomthamo wethangi ongu-0 L epulanini",
    "st": "Marulelo a {area} m² a takilwe le bokgoni ba tanka ba 0 L moralong",
    "ts": "Ku dirowiwe lwangu ra {area} m² ni vundzeni bya thangi bya 0 L eka pulani",
    "ve": "Ho olwa ṱhanga ya {area} m² na vhungala ha thannga ha 0 L kha pulane"
  },
  {
    "english": "Gutter the traced roof and connect it to a tank. This is the cheapest water on the site and it is currently running onto the ground.",
    "zu": "Faka imisele yophahla oludwetshiwe uyixhume ethangini. Lawa amanzi ashibhe kakhulu endaweni futhi manje agelezela emhlabathini.",
    "st": "Kenya digatara marulelong a takilweng mme o di hokele tankeng. Ana ke metsi a theko e tlase ka ho fetisisa sebakeng sena mme hajwale a phallela fatshe.",
    "ts": "Veka tigatara eka lwangu leri dirowiweke kutani u ti hlanganisa ni thangi. Lawa hi wona mati yo chipa ngopfu endhawini naswona sweswi ma khulukela ehansi.",
    "ve": "Vheani migero kha ṱhanga yo olwaho ni i ṱumanye na thannga. Aya ndi maḓi a mutengo wa fhasi u fhira oṱhe kha fhethu nahone zwino a khou elela mavuni."
  },
  {
    "english": "Storage cannot be planned — tank sizes are not recorded",
    "zu": "Ukugcina amanzi akukwazi ukuhlelwa — osayizi bamathangi ababhalwanga",
    "st": "Polokelo e ke ke ya rerwa — boholo ba ditanka ha bo a ngolwa",
    "ts": "Vuhlayiselo a byi nge pulaniwi — vukulu bya mathangi a byi rhekhodiwanga",
    "ve": "Vhugalelo a vhu nga pulaniwi — vhuhulwane ha thannga a ho ngo ṅwalwa"
  },
  {
    "english": "{count} tank on the plan with no stated capacity",
    "zu": "Ithangi elingu-{count} epulanini elingenamthamo obhaliwe",
    "st": "Tanka e {count} moralong e se nang bokgoni bo boletsweng",
    "ts": "Thangi ra {count} eka pulani leri nga vuriwangiki vundzeni bya rona",
    "ve": "Thannga ya {count} kha pulane i si na vhungala ho bulwaho"
  },
  {
    "english": "{count} tanks on the plan with no stated capacity",
    "zu": "Amathangi angu-{count} epulanini angenamthamo obhaliwe",
    "st": "Ditanka tse {count} moralong tse se nang bokgoni bo boletsweng",
    "ts": "Mathangi ya {count} eka pulani lama nga vuriwangiki vundzeni bya wona",
    "ve": "Thannga dza {count} kha pulane dzi si na vhungala ho bulwaho"
  },
  {
    "english": "Measure or read the capacity off each tank and record it. Every dry-season calculation in this report depends on it.",
    "zu": "Linganisa noma ufunde umthamo wethangi ngalinye bese uwubhala. Zonke izibalo zesikhathi esomile kulo mbiko zincike kuwo.",
    "st": "Lekanya kapa o bale bokgoni tankeng ka nngwe mme o bo ngole. Palo e nngwe le e nngwe ya sehla se ommeng tlalehong ena e itshetlehile ka bona.",
    "ts": "Pima kumbe u hlaya vundzeni bya thangi rin'wana ni rin'wana kutani u byi rhekhoda. Nhlayo yin'wana ni yin'wana ya nguva yo oma eka xiviko lexi yi titshege hi byona.",
    "ve": "Pimani kana ni vhale vhungala kha thannga iṅwe na iṅwe ni vhu ṅwale. Mbalelo iṅwe na iṅwe ya khalanwaha yo omayo kha muvhigo uyu yo ḓitika ngaho."
  },
  {
    "english": "Soil loss from runoff on the slope",
    "zu": "Ukulahleka komhlabathi ngenxa yamanzi agelezayo emthambekeni",
    "st": "Ho lahleha ha mobu ka lebaka la metsi a phallang moepeng",
    "ts": "Ku lahleka ka misava hi mati lama khulukaka eriweni",
    "ve": "U xela ha mavu nga maḓi a elelaho kha mutsheṱo"
  },
  {
    "english": "{slope}° slope, at or above the {threshold}° threshold",
    "zu": "Ukwehla okungu-{slope}°, kufinyelela noma kudlule umkhawulo ongu-{threshold}°",
    "st": "Moepa wa {slope}°, o fihlang kapa o fetang moedi wa {threshold}°",
    "ts": "Ku rhelela ka {slope}°, eka kumbe ehenhla ka mpimo wa {threshold}°",
    "ve": "Mutsheṱo wa {slope}°, u lingana kana u fhira mukano wa {threshold}°"
  },
  {
    "english": "Keep the ground covered at all times, and put earthworks on contour above the growing area before breaking any more soil.",
    "zu": "Gcina umhlabathi umboziwe ngaso sonke isikhathi, bese wenza imisebenzi yomhlabathi elandela imigqa yokuphakama okufanayo ngaphezu kwendawo yokutshala ngaphambi kokumba omunye umhlabathi.",
    "st": "Boloka mobu o kwahetswe ka dinako tsohle, mme o etse mesebetsi ya mobu e latelang mela e lekanang ka bophahamo ka hodimo ho sebaka sa temo pele o epolla mobu o mong.",
    "ts": "Hlayisa misava yi funengetiwile minkarhi hinkwaya, kutani u endla mitirho ya misava hi ku landza milayeni leyi nga eka ku tlakuka loku fanaka ehenhla ka ndhawu yo byala u nga si cela misava yin'wana.",
    "ve": "Dzulani no tiba mavu tshifhinga tshoṱhe, ni vhee mishumo ya mavu kha mitalo i re kha vhuimo ha nṱha hu fanaho nṱha ha fhethu ha u ṱavha musi ni sa athu lima maṅwe mavu."
  },
  {
    "english": "Runoff carries water and topsoil off the growing area",
    "zu": "Amanzi agelezayo asusa amanzi nomhlabathi ongaphezulu endaweni yokutshala",
    "st": "Metsi a phallang a tlosa metsi le mobu o ka hodimo sebakeng sa temo",
    "ts": "Mati lama khulukaka ma rhwala mati ni misava ya le henhla ma swi susa endhawini yo byala",
    "ve": "Maḓi a elelaho a bvisa maḓi na mavu a nṱha kha fhethu ha u ṱavha"
  },
  {
    "english": "{slope}° slope, between the {lower}° and {upper}° thresholds",
    "zu": "Ukwehla okungu-{slope}°, phakathi kwemikhawulo engu-{lower}° no-{upper}°",
    "st": "Moepa wa {slope}°, o pakeng tsa meedi ya {lower}° le {upper}°",
    "ts": "Ku rhelela ka {slope}°, exikarhini ka mimpimo ya {lower}° na {upper}°",
    "ve": "Mutsheṱo wa {slope}°, vhukati ha mikano ya {lower}° na {upper}°"
  },
  {
    "english": "Mulch the beds and slow runoff on contour. Watch the ground after the first heavy rain and record where water actually runs.",
    "zu": "Mboza imibhede ngezinsalela zezitshalo bese unciphisa ukugeleza kwamanzi ngokulandela ukuphakama okufanayo. Bheka umhlabathi ngemva kwemvula yokuqala enkulu bese ubhala ukuthi amanzi ageleza kuphi ngokoqobo.",
    "st": "Kwahela dibethe ka dimela tse ommeng mme o fokotse phallo ya metsi ho latela mela e lekanang ka bophahamo. Sheba mobu ka mora pula ya pele e matla mme o ngole moo metsi a hlileng a phallang teng.",
    "ts": "Funengeta mibedo hi masalela ya swimilana kutani u hunguta ku khuluka ka mati hi ku landza milayeni ya ku tlakuka loku ringanaka. Languta misava endzhaku ka mpfula yo sungula ya ntamu kutani u rhekhoda laha mati ma khulukaka kona hakunene.",
    "ve": "Tibani mibethe nga masalela a zwimela ni fhungudze u elela ha maḓi kha mitalo i re kha vhuimo ha nṱha hu fanaho. Sedzani mavu nga murahu ha mvula ya u thoma khulwane ni ṅwale hune maḓi a elela hone zwa vhukuma."
  },
  {
    "english": "Frost damage to tender crops and young trees",
    "zu": "Ukulimala kwezitshalo ezibuthaka nezihlahla ezincane ngenxa yesithwathwa",
    "st": "Tshenyo ya serame dijalong tse bobebe le difateng tse nyenyane",
    "ts": "Ku onhiwa ka swibyariwa leswi nga tiyelangiki xirhami ni mirhi leyitsongo hi gwitsi",
    "ve": "U tshinyala ha zwiliṅwa zwi sa konḓeleli murotholo na miri miṱuku nga murotholo"
  },
  {
    "english": "minimum {temperature} °C, below the {threshold} °C threshold",
    "zu": "Izinga eliphansi {temperature} °C, ngaphansi komkhawulo ongu-{threshold} °C",
    "st": "Bonyane ba {temperature} °C, ka tlase ho moedi wa {threshold} °C",
    "ts": "Mahiselo ya le hansi ya {temperature} °C, ehansi ka mpimo wa {threshold} °C",
    "ve": "Ṱhukhu ya {temperature} °C, fhasi ha mukano wa {threshold} °C"
  },
  {
    "english": "Keep tender crops off the lowest ground, where cold air settles. Plant frost-sensitive trees after the last frost date, not before.",
    "zu": "Ungatshali izitshalo ezibuthaka endaweni ephansi kakhulu, lapho kuhlala khona umoya obandayo. Tshala izihlahla ezingakwazi ukumelana nesithwathwa ngemva kosuku lokugcina lwesithwathwa, hhayi ngaphambi kwalo.",
    "st": "O se ke wa jala dijalo tse bobebe mobung o tlase ka ho fetisisa, moo moya o batang o dulanang teng. Jala difate tse tshabang serame ka mora letsatsi la ho qetela la serame, eseng pele ho lona.",
    "ts": "Papalata ku byala swibyariwa leswi nga tiyelangiki xirhami endhawini ya le hansi ngopfu, laha moya wo titimela wu tshamaka kona. Byala mirhi leyi chavaka gwitsi endzhaku ka siku ro hetelela ra gwitsi, ku nga ri loko ri nga si fika.",
    "ve": "Ni songo ṱavha zwiliṅwa zwi sa konḓeleli murotholo fhethu ha fhasi-fhasi, hune muya u rotholelaho wa dzula hone. Ṱavhani miri i sa konḓeleli murotholo nga murahu ha ḓuvha ḽa u fhedza ḽa murotholo, hu si phanḓa haḽo."
  },
  {
    "english": "Soil recommendations are built on modelled soil, not this field",
    "zu": "Izincomo zomhlabathi zisekelwe kumodeli yomhlabathi, hhayi kule nsimu",
    "st": "Dikeletso tsa mobu di thehilwe mobung wa mohlala, eseng tshimong ena",
    "ts": "Switsundzuxo swa misava swi sekeriwe eka misava ya modele, ku nga ri nsimu leyi",
    "ve": "Themendelo dza mavu dzo ḓitika nga mavu a modele, hu si tsimu iyi"
  },
  {
    "english": "soil figures come from a district-wide model, not a sample taken here",
    "zu": "Izibalo zomhlabathi zivela kumodeli yesifunda sonke, hhayi esampuleni ethathwe lapha",
    "st": "Dipalo tsa mobu di tswa mohlaleng wa setereke sohle, eseng sampoleng e nkilweng mona",
    "ts": "Tinhlayo ta misava ti huma eka modele ya xifundzantsongo hinkwaxo, ku nga ri eka sampulu leyi tekiweke laha",
    "ve": "Nomboro dza mavu dzi bva kha modele ya tshiṱiriki tshoṱhe, hu si kha sambula yo dzhiiwaho fhano"
  },
  {
    "english": "no soil data for this point — the app's generic defaults were used",
    "zu": "Ayikho idatha yomhlabathi yaleli phuzu — kusetshenziswe izibalo ezijwayelekile ze-app",
    "st": "Ha ho data ya mobu sebakeng sena — ho sebedisitswe dipalo tse akaretsang tsa app",
    "ts": "A ku na datha ya misava ya ndhawu leyi — ku tirhisiwe tinhlayo ta ntolovelo ta app",
    "ve": "A hu na data ya mavu kha fhethu hafha — ho shumiswa nomboro dza app dza u angaredza"
  },
  {
    "english": "Take one soil sample and send it for a test. It is the cheapest way to replace every estimated soil figure in this report with a measured one.",
    "zu": "Thatha isampula elilodwa lomhlabathi ulithumele liyohlolwa. Kuyindlela eshibhe kakhulu yokufaka isilinganiso sangempela esikhundleni saso sonke isibalo somhlabathi esilinganiselwe kulo mbiko.",
    "st": "Nka sampole e le nngwe ya mobu mme o e romele bakeng sa teko. Ke mokgwa o theko e tlase ka ho fetisisa wa ho beha palo e lekantsweng sebakeng sa palo e nngwe le e nngwe ya mobu e hakantsweng tlalehong ena.",
    "ts": "Teka sampulu yin'we ya misava kutani u yi rhumela ku ya kamberiwa. I ndlela yo chipa ngopfu yo siva nhlayo yin'wana ni yin'wana ya misava leyi ringanyetiweke eka xiviko lexi hi leyi pimiweke.",
    "ve": "Dzhiani sambula nthihi ya mavu ni i rumele kha ndingo. Ndi nḓila ya mutengo wa fhasi u fhira dzoṱhe ya u siva nomboro iṅwe na iṅwe ya mavu yo anganywaho kha muvhigo uyu nga yo pimiwaho."
  },
  {
    "english": "Every area figure is provisional — no property boundary was traced",
    "zu": "Zonke izibalo zendawo ngezokuqala — awukho umngcele wendawo odwetshiwe",
    "st": "Palo e nngwe le e nngwe ya sebaka ke ya nakwana — ha ho moedi wa sebaka o takilweng",
    "ts": "Nhlayo yin'wana ni yin'wana ya ndhawu i ya xinkarhana — ndzelekano wa ndhawu a wu dirowiwanga",
    "ve": "Nomboro iṅwe na iṅwe ya fhethu ndi ya tshifhinganyana — a ho ngo olwa mukano wa fhethu"
  },
  {
    "english": "no traced boundary on the map",
    "zu": "Awukho umngcele odwetshiwe ebalazweni",
    "st": "Ha ho moedi o takilweng mmapeng",
    "ts": "A ku na ndzelekano lowu dirowiweke emepeni",
    "ve": "A hu na mukano wo olwaho kha mapa"
  },
  {
    "english": "Walk and trace the boundary. Until then, treat site area, and anything divided by it, as unconfirmed.",
    "zu": "Hamba umngcele uwudwebe. Kuze kube yilapho, thatha indawo yepulazi nanoma yini ehlukaniswa ngayo njengokungaqinisekisiwe.",
    "st": "Tsamaya o latele moedi mme o o take. Ho fihlela moo, nka sebaka sa polasi le ntho efe kapa efe e arolwang ka sona e sa netefatswa.",
    "ts": "Famba u landzelela ndzelekano kutani u wu dirowa. Ku fikela kwalaho, teka ndhawu ya purasi ni xin'wana ni xin'wana lexi avanyisiwaka hi yona swi nga si tiyisisiwa.",
    "ve": "Tshimbilani ni tevhedze mukano ni u ole. U swika zwenezwo, dzhiani vhuhulwane ha fhethu na tshiṅwe na tshiṅwe tshi kovhiwaho ngaho zwi sa athu khwaṱhisedzwa."
  },
  {
    "english": "The build costs more than the bill of quantities shows",
    "zu": "Ukwakha kubiza ngaphezu kwalokho okuboniswa uhlu lobuningi",
    "st": "Kaho e bitsa ho feta seo lenane la bongata le se bontshang",
    "ts": "Ku aka swi durha ku hundza leswi nxaxamelo wa nhlayo wu swi kombaka",
    "ve": "U fhaṱa zwi ḓura u fhira zwine mutevhe wa vhunzhi wa sumbedza"
  },
  {
    "english": "{count} measured line in the bill carry no rate",
    "zu": "Umugqa ongu-{count} olinganisiwe ohlwini awunantengo ngeyunithi",
    "st": "Mola o {count} o lekantsweng lenaneng ha o na theko ka yuniti",
    "ts": "Layini ya {count} leyi pimiweke eka nxaxamelo a yi na nxavo hi yuniti",
    "ve": "Mutalo wa {count} wo pimiwaho kha mutevhe a u na mutengo nga yuniti"
  },
  {
    "english": "{count} measured lines in the bill carry no rate",
    "zu": "Imigqa engu-{count} elinganisiwe ohlwini ayinantengo ngeyunithi",
    "st": "Mela e {count} e lekantsweng lenaneng ha e na theko ka yuniti",
    "ts": "Tilayini ta {count} leti pimiweke eka nxaxamelo a ti na nxavo hi yuniti",
    "ve": "Mitalo ya {count} yo pimiwaho kha mutevhe a i na mutengo nga yuniti"
  },
  {
    "english": "Get local quotes for the unpriced lines before committing a budget. The subtotal in the cost section is a floor, not a total.",
    "zu": "Thola amanani endawo emigqeni engenantengo ngaphambi kokuzibophezela ngebhajethi. Isamba esingaphelele esigabeni sezindleko siyisisekelo esiphansi, hhayi isamba sonke.",
    "st": "Fumana dikhotheishene tsa lehae bakeng sa mela e se nang theko pele o itlama ka tekanyetso. Kakaretso e sa fellang karolong ya ditshenyehelo ke bonyane, ha se kakaretso yohle.",
    "ts": "Kuma mintsengo ya laha kusuhi ya tilayini leti nga riki na nxavo u nga si tiboha eka mpimanyeto. Ntsengo lowu nga helelangiki eka xiyenge xa mali i wa le hansi, a hi ntsengo hinkwawo.",
    "ve": "Wanani khotheisheni dza henefho dza mitalo i si na mutengo musi ni sa athu ḓivhofha kha mugaganyagwama. Mutengo u sa athu fhelela kha khethekanyo ya mutengo ndi wa fhasi-fhasi, a si mutengo woṱhe."
  },
  {
    "english": "No crop plan — the growing area has no sowing schedule behind it",
    "zu": "Alukho uhlelo lwezitshalo — indawo yokutshala ayinasimiso sokuhlwanyela",
    "st": "Ha ho moralo wa dijalo — sebaka sa temo ha se na lenaneo la ho jala",
    "ts": "A ku na pulani ya swibyariwa — ndhawu yo byala a yi na xiyimiso xo byala",
    "ve": "A hu na pulane ya zwiliṅwa — fhethu ha u ṱavha a hu na mbekanyamushumo ya u zwala"
  },
  {
    "english": "nothing entered in the crop planner",
    "zu": "Akukho okufakiwe esihleleni sezitshalo",
    "st": "Ha ho letho le kentsweng sehlophising sa dijalo",
    "ts": "A ku na lexi nghenisiweke eka xipulani xa swibyariwa",
    "ve": "A hu na tsho dzheniswaho kha mupulani wa zwiliṅwa"
  },
  {
    "english": "Build the crop plan before the next sowing window. Beds without a plan sit empty through the months that matter.",
    "zu": "Yakha uhlelo lwezitshalo ngaphambi kwesikhathi esilandelayo sokuhlwanyela. Imibhede engenalo uhlelo ihlala ingenalutho phakathi nezinyanga ezibalulekile.",
    "st": "Etsa moralo wa dijalo pele ho nako e latelang ya ho jala. Dibethe tse se nang moralo di dula di se na letho dikgweding tsa bohlokwa.",
    "ts": "Endla pulani ya swibyariwa nkarhi lowu landzelaka wo byala wu nga si fika. Mibedo leyi nga riki na pulani yi tshika ku tirhisiwa hi tin'hweti leti nga ta nkoka.",
    "ve": "Itani pulane ya zwiliṅwa tshifhinga tshi tevhelaho tsha u zwala tshi sa athu swika. Mibethe i si na pulane i dzula i si na tshithu kha miṅwedzi ya ndeme."
  },
  {
    "english": "Risk Register",
    "zu": "Irejista yezingozi",
    "st": "Rejista ya dikotsi",
    "ts": "Rhejistara ya makhombo",
    "ve": "Redzhisiṱara ya khombo"
  },
  {
    "english": "No risk in this register's rule set was triggered by this site's data. That is not the same as no risk — it means the specific thresholds this report checks (rainfall, slope, frost, soil basis, traced boundary, unpriced work, crop plan) were all clear.",
    "zu": "Idatha yale ndawo ayivusanga ngozi emithethweni yale rejista. Lokhu akusho ukuthi ayikho ingozi — kusho ukuthi imikhawulo ethile ehlolwa yilo mbiko (imvula, ukwehla, isithwathwa, isisekelo somhlabathi, umngcele odwetshiwe, umsebenzi ongenantengo, uhlelo lwezitshalo) ayivusanga sixwayiso.",
    "st": "Data ya sebaka sena ha e a tsosa kotsi melaong ya rejista ena. Seo ha se bolele hore ha ho kotsi — se bolela hore meedi e itseng e hlahlojwang ke tlaleho ena (pula, moepa, serame, motheo wa mobu, moedi o takilweng, mosebetsi o se nang theko, moralo wa dijalo) ha e a tsosa temoso.",
    "ts": "Datha ya ndhawu leyi a yi pfuxanga khombo eka milawu ya rhejistara leyi. Sweswo a swi vuli leswaku a ku na khombo — swi vula leswaku mimpimo yo karhi leyi xiviko lexi xi yi kambelaka (mpfula, ku rhelela, gwitsi, masungulo ya misava, ndzelekano lowu dirowiweke, mitirho leyi nga riki na nxavo, pulani ya swibyariwa) a yi pfuxanga xitsundzuxo.",
    "ve": "Data ya fhethu hafha a yo ngo vusa khombo kha milayo ya redzhisiṱara iyi. Zwenezwo a zwi ambi uri a hu na khombo — zwi amba uri mikano yo livhaho ine muvhigo uyu wa i sedza (mvula, mutsheṱo, murotholo, mutheo wa mavu, mukano wo olwaho, mushumo u si na mutengo, pulane ya zwiliṅwa) a yo ngo vusa tsevho."
  },
  {
    "english": "Each row was raised by this site's own data. The trigger column prints the figure and the threshold that produced the rating, so a reader who disagrees can argue with the number rather than the adjective.",
    "zu": "Umugqa ngamunye uvela kudatha yale ndawo uqobo. Ikholomu yesizathu iveza isibalo nomkhawulo okudale isilinganiso, ukuze umfundi ongavumelani naso akhulume ngenombolo kunegama lokuchaza.",
    "st": "Mola ka mong o hlahisitswe ke data ya sebaka sena. Kholomo ya sesosa e bontsha palo le moedi tse hlahisitseng tekanyo, hore mmadi ya sa dumellaneng a bue ka palo ho e na le lentswe le hlalosang.",
    "ts": "Layini yin'wana ni yin'wana yi pfuxiwe hi datha ya ndhawu leyi. Kholomu ya xivangelo yi komba nhlayo ni mpimo leswi vangeke mpimo wa khombo, leswaku muhlayi loyi a nga pfumelelaniki a nga kaneta nhlayo ematshan'weni ya rito ro hlamusela.",
    "ve": "Mutalo muṅwe na muṅwe wo bveledzwa nga data ya fhethu hafha. Kholomu ya tshivhangi i sumbedza nomboro na mukano zwo bveledzaho ndeme, uri muvhali a sa tendelani nazwo a kone u amba nga nomboro nṱhani ha ipfi ḽa u ṱalusa."
  },
  {
    "english": "Risk",
    "zu": "Ingozi",
    "st": "Kotsi",
    "ts": "Khombo",
    "ve": "Khombo"
  },
  {
    "english": "What raised it",
    "zu": "Okuyivusile",
    "st": "Se e bakileng",
    "ts": "Leswi ri pfuxeke",
    "ve": "Zwo i vusaho"
  },
  {
    "english": "Likelihood",
    "zu": "Amathuba okwenzeka",
    "st": "Monyetla wa ho etsahala",
    "ts": "Ku koteka ka ku humelela",
    "ve": "U nga itea"
  },
  {
    "english": "Impact",
    "zu": "Umthelela",
    "st": "Tshusumetso",
    "ts": "Ku khumba",
    "ve": "Masiandaitwa"
  },
  {
    "english": "What to do about it",
    "zu": "Okufanele kwenziwe ngakho",
    "st": "Se ka etswang ka yona",
    "ts": "Leswi nga endliwaka hi rona",
    "ve": "Zwine zwa fanela u itwa ngazwo"
  },
  {
    "english": "High",
    "zu": "Phezulu",
    "st": "Hodimo",
    "ts": "Ehenhla",
    "ve": "Nṱha"
  },
  {
    "english": "Medium",
    "zu": "Phakathi",
    "st": "Bohareng",
    "ts": "Exikarhini",
    "ve": "Vhukati"
  },
  {
    "english": "Low",
    "zu": "Phansi",
    "st": "Tlase",
    "ts": "Ehansi",
    "ve": "Fhasi"
  },
  {
    "english": "Cost & Bill of Quantities",
    "zu": "Izindleko nohlu lobuningi",
    "st": "Ditshenyehelo le lenane la bongata",
    "ts": "Mali ni nxaxamelo wa nhlayo",
    "ve": "Mutengo na mutevhe wa vhunzhi"
  },
  {
    "english": "No priced work can be listed yet: nothing has been drawn on the plan to measure. Draw the beds, tanks, fences and paths in the Design Studio and this bill fills itself from those measurements.",
    "zu": "Akukho msebenzi onentengo ongafakwa ohlwini okwamanje: akukho okudwetshiwe epulanini okungalinganiswa. Dweba imibhede, amathangi, uthango nezindlela eSitudiyo somklamo bese lolu hlu lugcwaliswa ngalezo zilinganiso.",
    "st": "Ha ho mosebetsi o nang le theko o ka ngolwang hajwale: ha ho letho le takilweng moralong le ka lekanngwang. Taka dibethe, ditanka, diterata le ditsela ho Studio sa moralo mme lenane lena le tla tlatswa ka ditekanyo tseo.",
    "ts": "A ku si va na mitirho leyi nga ni nxavo leyi nga nxaxametiwaka: a ku na lexi dirowiweke eka pulani lexi nga pimiwaka. Dirowa mibedo, mathangi, marihlampfu ni tindlela eka Xitudio xa dizayini kutani nxaxamelo lowu wu ta tatiwa hi mimpimo yoleyo.",
    "ve": "A hu athu vha na mushumo u re na mutengo u nga ṅwalwaho: a hu na tsho olwaho kha pulane tshi nga pimiwaho. Olani mibethe, thannga, mahura na nḓila kha Studio ya nyolo nahone mutevhe uyu u ḓo ḓadzwa nga mbonalo dzenedzo."
  },
  {
    "english": "Every quantity below is measured off this farm's own plan. Nothing here was estimated from a typical farm, and no line was added because a design \"usually has one\".",
    "zu": "Bonke ubuningi obungezansi bulinganiswe epulanini laleli pulazi. Akukho okuqagelwe ngepulazi elivamile, futhi awukho umugqa ofakiwe ngoba umklamo \"uvame ukuba nakho\".",
    "st": "Bongata bo bong le bo bong bo ka tlase bo lekantswe moralong wa polasi ena. Ha ho letho le hakantsweng ho tswa polasing e tlwaelehileng, mme ha ho mola o kentsweng hobane moralo \"o atisa ho ba le wona\".",
    "ts": "Nhlayo yin'wana ni yin'wana laha hansi yi pimiwe eka pulani ya purasi leri. A ku na lexi ringanyetiweke hi ku ya hi purasi ra ntolovelo, naswona a ku na layini leyi engeteriweke hikuva dizayini \"yi tala ku va na yona\".",
    "ve": "Vhunzhi vhuṅwe na vhuṅwe afho fhasi ho pimiwa kha pulane ya bulasi iḽi. A hu na tsho anganywaho u bva kha bulasi ḽo ḓoweleaho, nahone a hu na mutalo wo engedzwaho ngauri nyolo \"i anzela u vha natsho\"."
  },
  {
    "english": "Item",
    "zu": "Into",
    "st": "Ntho",
    "ts": "Nchumu",
    "ve": "Tshithu"
  },
  {
    "english": "Quantity",
    "zu": "Ubuningi",
    "st": "Bongata",
    "ts": "Nhlayo",
    "ve": "Vhunzhi"
  },
  {
    "english": "Rate",
    "zu": "Intengo ngeyunithi",
    "st": "Theko ka yuniti",
    "ts": "Nxavo hi yuniti",
    "ve": "Mutengo nga yuniti"
  },
  {
    "english": "Amount",
    "zu": "Isamba",
    "st": "Kakaretso",
    "ts": "Ntsengo",
    "ve": "Mutengo woṱhe"
  },
  {
    "english": "Measured from",
    "zu": "Kulinganiswe kuphi",
    "st": "Ho lekantswe ho eng",
    "ts": "Swi pimiwe eka yini",
    "ve": "Zwo pimiwa zwi tshi bva ngafhi"
  },
  {
    "english": "no researched rate — get a local quote",
    "zu": "ayikho intengo ngeyunithi ecwaningiwe — thola intengo endaweni",
    "st": "ha ho theko ka yuniti e batlisisitsweng — fumana khotheishene ya lehae",
    "ts": "a ku na nxavo hi yuniti lowu lavisisiweke — kuma nxavo wa laha kusuhi",
    "ve": "a hu na mutengo nga yuniti wo ṱoḓisisiwaho — wanani khotheisheni ya henefho"
  },
  {
    "english": "quantity not measured — trace its footprint to price it",
    "zu": "ubuningi abulinganisiwe — dweba indawo esiyithathayo ukuze kubalwe intengo",
    "st": "bongata ha bo a lekanngwa — taka sebaka seo e se nkang ho fumana theko",
    "ts": "nhlayo a yi pimiwanga — dirowa ndhawu leyi yi yi tekaka leswaku yi ta nyikiwa nxavo",
    "ve": "vhunzhi a ho ngo pimiwa — olani fhethu hune tsha dzula hone uri tshi vhewe mutengo"
  },
  {
    "english": "outside the price book's size range — get a local quote",
    "zu": "ngaphandle kosayizi abakulolu hlu lwamanani — thola intengo endaweni",
    "st": "boholo bo ka ntle ho meedi ya buka ya ditheko — fumana khotheishene ya lehae",
    "ts": "ehandle ka vukulu bya buku ya minxavo — kuma nxavo wa laha kusuhi",
    "ve": "vhuhulwane vhu nnḓa ha mikano ya bugu ya mitengo — wanani khotheisheni ya henefho"
  },
  {
    "english": "already on the farm — not a build cost",
    "zu": "sekhona epulazini — akusona isindleko sokwakha",
    "st": "e se e le polasing — ha se tshenyehelo ya kaho",
    "ts": "se yi le purasini — a hi mali yo aka",
    "ve": "tsho no vha bulasini — a si mutengo wa u fhaṱa"
  },
  {
    "english": "listed plant on saved plan — obtain local legal and ecological advice; do not buy or propagate from this bill",
    "zu": "isitshalo esisohlwini esisepulanini eligciniwe — thola izeluleko zomthetho nezemvelo endaweni; ungathengi noma usandise izitshalo ngalolu hlu",
    "st": "semela se lenaneng moralong o bolokilweng — fumana keletso ya lehae ya molao le ya tikoloho; o se ke wa reka kapa wa atisa dimela ho latela lenane lena",
    "ts": "ximilana lexi nxaxametiweke eka pulani leyi hlayisiweke — kuma switsundzuxo swa nawu ni swa mbango swa laha kusuhi; u nga xavi kumbe u andzisa swimilana hi nxaxamelo lowu",
    "ve": "tshimela tshi re kha mutevhe kha pulane yo vhulungwaho — wanani nyeletshedzo ya mulayo na ya mupo ya henefho; ni songo renga kana u andisa zwimela nga mutevhe uyu"
  },
  {
    "english": "{amount} each",
    "zu": "{amount} ngayinye",
    "st": "{amount} ka nngwe",
    "ts": "{amount} hi xin'we",
    "ve": "{amount} nga tshithihi"
  },
  {
    "english": "{count} no.",
    "zu": "inani {count}",
    "st": "palo {count}",
    "ts": "nhlayo {count}",
    "ve": "tshivhalo {count}"
  },
  {
    "english": "Placed in the Design Studio",
    "zu": "Kubekwe eSitudiyo somklamo",
    "st": "Ho behilwe ho Studio sa moralo",
    "ts": "Swi vekiwe eka Xitudio xa dizayini",
    "ve": "Zwo vhewa kha Studio ya nyolo"
  },
  {
    "english": "Measured off the traced line",
    "zu": "Kulinganiswe emgqeni olandelwe",
    "st": "Ho lekantswe moleng o latetsweng",
    "ts": "Swi pimiwe eka layini leyi landzeleriweke",
    "ve": "Zwo pimiwa kha mutalo wo tevhedzelwaho"
  },
  {
    "english": "Subtotal of the priced lines: {subtotal}",
    "zu": "Isamba semigqa enentengo: {subtotal}",
    "st": "Kakaretso e sa fellang ya mela e nang le theko: {subtotal}",
    "ts": "Ntsengo wa tilayini leti nga ni nxavo: {subtotal}",
    "ve": "Mutengo wa mitalo i re na mutengo: {subtotal}"
  },
  {
    "english": "This subtotal is NOT the cost of the build. {unpriced} a measured quantity but no rate, so the real figure is higher by whatever those cost. They are listed above with the reason, rather than left out or costed at zero — a bill that hides what it could not price reads as complete when it is not.",
    "zu": "Lesi samba AKUZONA izindleko zokwakha. {unpriced} ubuningi obulinganisiwe, kodwa intengo ngeyunithi ayikho; ngakho isibalo sangempela siphezulu ngezindleko zalezo zinto. Zifakwe ngenhla nezizathu zazo, azishiywanga ngaphandle noma zibizwe ngoziro — uhlu olufihla okungenantengo lubukeka luphelele kodwa lungaphelele.",
    "st": "Kakaretso ena HA SE ditshenyehelo tsa kaho. {unpriced} bongata bo lekantsweng empa theko ka yuniti ha e yo, kahoo palo ya nnete e phahame ka ditshenyehelo tsa dintho tseo. Di thathamisitswe ka hodimo le mabaka a tsona, ho e na le ho siuwa kapa ho behwa theko ya lefela — lenane le patang seo le sa kang la se behela theko le bonahala le felletse empa le sa fella.",
    "ts": "Ntsengo lowu A HI mali ya ku aka. {unpriced} nhlayo leyi pimiweke kambe nxavo hi yuniti a wu kona, kutani nhlayo ya xiviri yi le henhla hi mali ya swilo swoleswo. Swi nxaxametiwile laha henhla ni xivangelo xa swona, ematshan'weni yo swi siya kumbe ku swi veka eka ziro — nxaxamelo lowu tumbetaka leswi wu nga swi nyiki nxavo wu vonaka wu helele loko wu nga helelanga.",
    "ve": "Mutengo uyu A SI mutengo wa u fhaṱa. {unpriced} vhunzhi ho pimiwaho fhedzi mutengo nga yuniti a u ho, ngauralo nomboro ya vhukuma i fhira nga mutengo wa zwithu zwenezwo. Zwo ṅwalwa afho nṱha na zwivhangi zwazwo, nṱhani ha u zwi sia kana u zwi vhea kha ziro — mutevhe u dzumbaho zwine wa si kone u zwi vhea mutengo u vhonala wo fhelela ngeno u songo fhelela."
  },
  {
    "english": "{count} line carries",
    "zu": "umugqa ongu-{count} uphethe",
    "st": "mola o {count} o na le",
    "ts": "layini ya {count} yi na",
    "ve": "mutalo wa {count} u na"
  },
  {
    "english": "{count} lines carry",
    "zu": "imigqa engu-{count} iphethe",
    "st": "mela e {count} e na le",
    "ts": "tilayini ta {count} ti na",
    "ve": "mitalo ya {count} i na"
  },
  {
    "english": "{items} excluded from this bill. They are part of the design and not part of the spend.",
    "zu": "{items} kulolu hlu. Ziyingxenye yomklamo, aziyona ingxenye yezindleko.",
    "st": "{items} lenaneng lena. Ke karolo ya moralo, ha se karolo ya tshebediso ya tjhelete.",
    "ts": "{items} eka nxaxamelo lowu. I xiphemu xa dizayini, a hi xiphemu xa mali leyi nga ta tirhisiwa.",
    "ve": "{items} kha mutevhe uyu. Ndi tshipiḓa tsha nyolo, a si tshipiḓa tsha tshelede ine ya ḓo shumiswa."
  },
  {
    "english": "{count} item marked as already on the farm is",
    "zu": "into engu-{count} emakwe ngokuthi isikhona epulazini ayifakiwe",
    "st": "ntho e {count} e tshwailweng e le teng polasing ha e kenyeletswe",
    "ts": "nchumu wa {count} lowu funghiweke leswaku se wu le purasini a wu katsiwanga",
    "ve": "tshithu tsha {count} tsho swaiwaho uri tsho no vha bulasini a tshi katelwi"
  },
  {
    "english": "{count} items marked as already on the farm are",
    "zu": "izinto ezingu-{count} ezimakwe ngokuthi sezikhona epulazini azifakiwe",
    "st": "dintho tse {count} tse tshwailweng di le teng polasing ha di kenyeletswe",
    "ts": "swilo swa {count} leswi funghiweke leswaku se swi le purasini a swi katsiwanga",
    "ve": "zwithu zwa {count} zwo swaiwaho uri zwo no vha bulasini a zwi katelwi"
  },
  {
    "english": "All prices are rough planning estimates based on late-2025/early-2026 South African retail pricing incl. VAT and will vary by region, supplier, and site access — get local quotes before committing budget.",
    "zu": "Zonke izintengo ziyizilinganiso zokuqala zokuhlela ezisekelwe kumanani okuthengisa aseNingizimu Afrika ngasekupheleni kuka-2025/ekuqaleni kuka-2026, kuhlanganisa i-VAT, futhi zizohluka ngesifunda, umhlinzeki nokufinyeleleka kwendawo — thola amanani endawo ngaphambi kokuzibophezela ngebhajethi.",
    "st": "Ditheko tsohle ke dikhakanyo tsa ho rera tse thehilweng dithekong tsa mabenkele tsa Afrika Borwa tsa mafelong a 2025/mathwasong a 2026, ho kenyeletsa VAT, mme di tla fapana ho ya ka sebaka, mofani le ho fihlelleha ha sebaka — fumana dikhotheishene tsa lehae pele o itlama ka tekanyetso.",
    "ts": "Minxavo hinkwaya i mimpimanyeto yo pulana leyi sekeriweke eka minxavo ya mavhengele ya Afrika-Dzonga ya ekuheleni ka 2025/eku sunguleni ka 2026, ku katsa VAT, naswona yi ta hambana hi ndhawu, muxavisi ni ku ngheneka ka ndhawu — kuma minxavo ya laha kusuhi u nga si tiboha eka mpimanyeto.",
    "ve": "Mitengo yoṱhe ndi ndinganyelo dza u pulana dzo ḓitikaho nga mitengo ya mavhengeleni ya Afurika Tshipembe ya mafheloni a 2025/mathomoni a 2026, hu katelwa VAT, nahone i ḓo fhambana nga dzingu, murengisi na u swikelea ha fhethu — wanani khotheisheni dza henefho musi ni sa athu ḓivhofha kha mugaganyagwama."
  },
  {
    "english": "Saved crop plan",
    "zu": "Uhlelo lwezitshalo olugciniwe",
    "st": "Moralo wa dijalo o bolokilweng",
    "ts": "Pulani ya swibyariwa leyi hlayisiweke",
    "ve": "Pulane ya zwiliṅwa yo vhulungwaho"
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

/** The saved crop page has one wording and data source in every report language. */
export function savedCropPlanMarkdown(facts: ReportSiteFacts | null,d: LocationData,language='en'):string {
  return `## ${reportDocumentText('Saved crop plan',language)}\n\n${reportSummaryPages(facts,d,5,language)[1].lines.join('\n\n')}`;
}

/** Earlier native crop and assessment/risk notes; all targets now share the full cost tables. */
export function zuluReportClosingNotes(facts: ReportSiteFacts | null, d: LocationData) {
  const crop = savedCropPlanMarkdown(facts,d,'zu');
  // This earlier native-only assessment note adds context beyond the shared source table.
  const riskNote = 'Lolu uhlu lokuqaphela ngokwezibalo zendawo; alulona ukuhlolwa kobunjiniyela noma isilinganiso esiqinisekisiwe sethuba lengozi.';
  const monitoringNote = 'Ku-NGO Assessments, sebenzisa ukuhlola kwasekuqaleni, ngaphambi nangemva kwesifundo, phakathi nephrojekthi nasekupheleni. Impendulo nge-app ingeyokuzithandela. Bhala ushintsho oluvunyelwene ngalo, umuntu ozolwenza nosuku lokulwenza.';
  return {crop, monitoringNote, riskNote};
}
