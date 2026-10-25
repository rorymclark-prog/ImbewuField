// The buying shortlist and the calendar assumption answer different questions. A mixed
// early/middle/late orchard can extend supply, but its union is not one tree's season.
import { bananaCirclesIn, firstCropAgeLabel, formatMonthSpan, formatRange, isHouseholdFoodHarvest, placedTreeGroups, type PlacedPlant, type PlacedTreeGroup, type TreeSeasonChoices, confirmedTreeMonths, type HarvestWindow } from './perennial-harvest';
import { enterprisesForHousing, HOUSING_LABEL, PRODUCT_LABEL, placedAnimalGroups, type HousingKind, type PlacedAnimalGroup } from './animal-enterprises';
import { recordsMonthLong } from './records-months';
import { cropExportText, isCropExportDraftLanguage } from './crop-export-copy';
import type { GrowingZoneId } from './growing-zones';
import type { SiteProductionConditions } from './site-survey';
import type { ProductionGuideItem } from './crop-export-schedule';

interface Reference { label: string; url: string }
interface Profile {
  products?: string;
  care: string[];
  purchase: string[];
  sources: Reference[];
}
const KZN_URL = 'https://www.kzndard.gov.za/images/Documents/Horticulture/Veg_prod/Fruit%20and%20%20Nut%20Production%20in%20KZN.pdf';
const kzn = (pages: string): Reference => ({ label: `KZN DARD, Fruit and Nut Production, PDF pp. ${pages} (regional reference; confirm current nursery stock)`, url: KZN_URL });
const arc = (module: number, pages: string): Reference => ({ label: `ARC Climate-Smart Agriculture, module ${module}, printed pp. ${pages}`, url: `https://www.arc.agric.za/arc-iscw/CSA-Toolbox/Pages/assets/modules/${module}.pdf` });
const sanbi = (name: string): Reference => ({ label: `SANBI PlantZAfrica: ${name}`, url: `https://pza.sanbi.org/${name}` });

/** Only existing catalogue identities. Named selections are not new species records. */
export const PRODUCT_PROFILES: Readonly<Record<string, Profile>> = {
  'persea-americana': {
    care: ['Keep roots well drained; water matters during flowering.'],
    purchase: ['KZN sequence: earlier Fuerte (May–Nov), middle Hass (Aug–Dec), later Ryan (Nov–Feb). These seasons overlap. Buy labelled grafted trees; confirm rootstock and pollination partners.'],
    sources: [kzn('6–7')],
  },
  'musa-acuminata-aaa-group': {
    care: ['Warm, frost-free conditions and dependable water are needed. Keep a replacement follower after the fruiting stem is removed.'],
    purchase: ['Cooler KZN: Williams; warmer valleys: Grand Nain; windy coast: Chinese Cavendish. Buy clean planting material. These are climate choices, not early/middle/late seasons.'],
    sources: [{ label: 'KZN DARD, Bananas in KwaZulu-Natal, pp. 1–4', url: 'https://www.kzndard.gov.za/images/Documents/Research%20and%20Technology%20Development%20Services/Publications/RESEARCH%20REPORTS/BananasinKwaZulu-Natal.pdf' }],
  },
  'carica-papaya': {
    care: ['Avoid frost and waterlogging. Honey Gold needs male and female plants; Sunrise Solo is hermaphrodite.'],
    purchase: ['Planning choice for warm sites: Sunrise Solo. Confirm plant sex/form with the nursery.'],
    sources: [kzn('18–19')],
  },
  'macadamia-integrifolia': {
    products: 'Nuts: record nut-in-shell separately from kernels.',
    care: ['Match the cultivar to the microclimate; avoid hard frost and poorly drained ground.', 'Collect fallen nuts frequently, dehusk promptly and dry with clean ventilation. Keep poultry and manure away from harvesting nuts.'],
    purchase: ['KZN coastal 90–300 m shortlist: Beaumont (695), Purvis (294), Makai (800), 660. Confirm site elevation and current pollination/maturity advice.'],
    sources: [kzn('24–25'), arc(6, '245–246'), { label: 'SAMAC, Best Practices: Harvesting, Dehusking, Drying (2023), pp. 1–6', url: 'https://static1.squarespace.com/static/65f742fcfd803d273845ddbe/t/68d66a4acafd86118747c421/1758882378831/SAMAC-Best-Practices-Harvesting.pdf' }],
  },
  'mangifera-indica': {
    care: ['Check frost, drainage and flowering-season disease pressure. Heat and sunburn sensitivity differ between cultivars.'],
    purchase: ['ARC identifies Tommy Atkins and Kent among more heat/sunburn-tolerant options; Sensation and Keitt are more susceptible. Confirm local harvest dates before choosing a succession.'],
    sources: [arc(6, '239–242')],
  },
  'malus-domestica': {
    care: ['Check the actual cultivar, rootstock, winter chilling and compatible pollen source before buying. A warm or cold climate-zone label alone does not establish these conditions.'],
    purchase: ['Afri-Star is an ARC-bred low-chill candidate with a stated 300–500 Infruitec Chilling Unit requirement; its December–January dates were obtained at Bien Donne, Simondium, Western Cape and need local checking elsewhere. Granny Smith has an Elgin first-pick reference in late March; SAPO names Golden Delicious or Hillieri as pollen partners. These are separate cultivar references, not a continuous picking season or a warm KZN recommendation. Confirm current nursery stock and local performance.'],
    sources: [{ label: 'Culdevco / ARC: Afri-Star apple cultivar information (Bien Donne, Simondium trial context; checked 10 October 2026)', url: 'https://culdevco.co.za/apples-cultivar-info-afri-star/' }, { label: 'SAPO Trust: Granny Smith apple cultivar information (Elgin first pick; checked 10 October 2026)', url: 'https://www.saplant.co.za/varieties/apples/granny-smith/' }],
  },
  'citrus-limon': {
    care: ['Check drainage, water and cultivar/rootstock fit. Main crop timing differs between warm and cool areas; smaller additional crops are not a full-year promise.'],
    purchase: ['Request labelled lemon stock and rootstock advice from a reputable citrus nursery. A locally validated named cultivar shortlist is not established here.'],
    sources: [arc(6, '237–238')],
  },
  'litchi-chinensis': {
    care: ['Match warm summers with cool, frost-free winter conditions for flowering; protect from wind and keep young plants watered.'],
    purchase: ['KZN candidates: earlier Fay Zee Siu (mid-November–mid-December), middle Mauritius (mid-November–early-January), later Wai Chee (end-January–end-February), using SALGA/ARC cultivar references. Confirm local dates, nursery stock and flowering conditions.'],
    sources: [kzn('16–17'), { label: 'SALGA / ARC-ITSC: Litchi Cultivars', url: 'https://litchisa.co.za/cultivars-2/' }],
  },
  'passiflora-edulis': {
    care: ['Provide trellising and pruning; avoid waterlogging and inspect for root rot and virus problems.'],
    purchase: ['Purple granadilla is the KZN fresh-fruit reference; yellow forms are more acidic and used for juice. Confirm stock health and local season.'],
    sources: [kzn('14–15')],
  },
  'vitis-vinifera': {
    care: ['Match the vineyard variety to its production region, water and support system. The national supply season combines several regions.'],
    purchase: ['DAFF industry reference: earlier Prime Seedless, Sugraone and Flame Seedless; later Dauphine and Crimson Seedless. SATI identifies Orange River choices including Prime, Thompson Seedless and Sugraone. Confirm local dates and stock; the industry sequence is not a KZN farm calendar.'],
    sources: [{ label: 'DAFF, Table grape market value chain profile (2012), p. 1', url: 'https://www.nda.gov.za/phocadownloadpap/Agricultural_Marketing_Commodity_Profiles/Table%20grape%20market%20value%20chain%20profile%202012.pdf' }, { label: 'SATI: Production regions', url: 'https://www.satgi.co.za/about/' }],
  },
  'fragaria-x-ananassa': {
    care: ['Use clean runners and match the variety and production system to the area. Reliable irrigation and disease control matter.'],
    purchase: ['KZN guide names Chandler and Selecta. Current local availability and performance need checking; tunnel and outdoor seasons must remain separate.'],
    sources: [kzn('34–35'), { label: 'SASGA: An overview of strawberry cultivation in South Africa', url: 'https://strawberries.org.za/an-overview-of-strawberry-cultivation-in-south-africa/' }],
  },
  'punica-granatum': {
    products: 'Fruit: record whole fruit separately from arils or juice.',
    care: ['Check fruit maturity and post-harvest handling. Sunburn, cracking and rot vary by cultivar.'],
    purchase: ['Wonderful is an SA industry cultivar. Treat it as a candidate, not proof of fit for a humid KZN site; no locally validated early/middle succession is sourced here.'],
    sources: [{ label: 'Post-Harvest Innovation / Stellenbosch: Ancient fruit needs new guidelines (2017), pp. 1–2', url: 'https://postharvestinnovation.org.za/wp-content/uploads/2017/06/Ancient-fruit-needs-new-guidelines-PHI-Pomegranate-Project-2017.pdf' }, { label: 'Post-Harvest Innovation Programme: Pomegranate', url: 'https://postharvestinnovation.org.za/commodities/pomegranate/' }],
  },
  'moringa-oleifera': {
    products: 'Leaves and green pods; keep their records separate.',
    care: ['Choose a sunny, well-drained growing position, protect establishment and plan pruning for leaf harvest.'],
    purchase: ['Use correctly identified local planting material. No locally validated named cultivar shortlist is sourced; this plan does not claim nitrogen fixation or medicinal effects.'],
    sources: [{ label: 'North West DARD: Moringa production for food security (2021)', url: 'https://dard.nwpg.gov.za/wp-content/uploads/2022/05/Moringa-production-for-food-security.pdf' }],
  },
  'citrus-reticulata': {
    care: ['Soft citrus generally favours cooler, drier conditions. Confirm rootstock and pollination/seediness requirements before mixing varieties.'],
    purchase: ['For a suitable site: early Miho Wase satsuma (from mid-March); middle clementines (late March–mid-June); later Nadorcott mandarin (mid-May–September). Dates are broad SA references, not a local calendar. Order labelled nursery trees.'],
    sources: [{ label: 'Citrus Academy, Citrus Types and Cultivars (2017), pp. 7–13', url: 'https://www.crw.org.za/home/document-home/learning-aids-and-resources/ca-citrus-av-series-learning-material/citrus-planting-management/5808-ca-av-series-cpm-lm-m02-citrus-types-and-cultivars-1/file' }],
  },
  'rubus-idaeus': {
    care: ['Check chilling, support and pruning system before planting. Autumn-bearing varieties must not inherit a spring-bearing calendar.'],
    purchase: ['KZN guide: low-chill autumn bearers Heritage or Autumn Bliss; spring bearers Glen Prosen, Glen Lyon or Tulameen need more chilling. Confirm local dates.'],
    sources: [kzn('36–37')],
  },
  'vaccinium-corymbosum': {
    care: ['Check soil acidity, cultivar chilling, irrigation and pollination requirements before buying.'],
    purchase: ['Warm-climate candidate: Biloxi, a low-chill southern highbush cultivar, reported by a nursery producing stock in South Africa. Obtain a compatible southern highbush pollination partner. Early flowering can suffer spring frost; local soil, chill and harvest dates still need checking. Do not substitute rabbiteye plants as a highbush cultivar.'],
    sources: [{ label: 'Fall Creek: South African nursery production (includes Biloxi; confirm current stock)', url: 'https://www.fallcreeknursery.com/blog/season-2-blueberries-at-fall-creek-south-africa' }, { label: 'USDA ARS: Biloxi southern highbush release', url: 'https://www.ars.usda.gov/southeast-area/poplarville-ms/tcshl/docs/plant-releases/' }, { label: 'USDA breeders, Biloxi southern highbush blueberry, Acta Horticulturae 574 (2002)', url: 'https://www.pubhort.org/actahort/books/574/574_21.htm' }],
  },
  'carya-illinoinensis': {
    care: ['Use compatible pollen-shedding and receptive varieties. Wet-summer areas need scab-resistant choices; early nut maturity alone does not establish pollination compatibility.'],
    purchase: ['SAPPA shortlist: wetter KZN/Lowveld — Ukulinga, Cape Fear, Choctaw; wet, colder KZN — Barton; drier Highveld — Barton, Pawnee, Wichita; dry western areas — Wichita, Choctaw, Western Schley. The inferred climate group alone cannot distinguish all these areas. Confirm local humidity, soils and the pollination pair before buying.'],
    sources: [{ label: 'SAPPA: Cultivar Recommendation by Production Area, p. 1 (retrieved 4 October 2026)', url: 'https://www.sappa.za.org/download/16957/?tmstv=1779439974' }],
  },
  'prunus-persica': {
    care: ['Confirm cultivar-specific chilling and spring frost risk. Mean winter temperature is not a chill-hour measurement.'],
    purchase: ['Low-to-medium chill candidate: Earligold (200–400 Infruitec units), with a December first-pick reference from Bien Donne, Western Cape. Later Cederberg has a January reference. Confirm actual chilling, stock and local dates before staging varieties.'],
    sources: [{ label: 'Culdevco / ARC: Earligold cultivar sheet, Bien Donne data', url: 'https://culdevco.co.za/peach-cultivar-info-earligold/' }, { label: 'Culdevco / ARC: Cederberg cultivar sheet', url: 'https://culdevco.co.za/peach-cultivar-info-cederberg/' }],
  },
  'prunus-salicina': {
    care: ['Match chilling and pollination partners. A second variety must flower compatibly, not merely ripen at a different time.'],
    purchase: ['Candidate: African Delight (200–400 Infruitec units). Pollinators listed by ARC/Culdevco: Pioneer or African Rose. Late-February first-pick data is from the Western Cape reference site, not a promise for warm KZN.'],
    sources: [{ label: 'Culdevco / ARC: African Delight cultivar sheet', url: 'https://culdevco.co.za/plums-cultivar-info-african-delight/' }],
  },
  'harpephyllum-caffrum': { products: 'Ripe fruit for fresh use or preserves.', care: ['Frost-free regional reference; male and female trees are separate.'], purchase: ['Request correctly identified local fruiting stock and pollination provision; no named cultivar is sourced.'], sources: [sanbi('harpephyllum-caffrum')] },
  'englerophytum-magalismontanum': { products: 'Ripe fruit.', care: ['Match the local rocky woodland/forest habitat; flowering dates are not harvest dates.'], purchase: ['Request correctly identified local fruiting material; no named cultivar is sourced.'], sources: [sanbi('englerophytum-magalismontanum')] },
  'vangueria-infausta': { products: 'Ripe fruit, fresh or dried.', care: ['Confirm local establishment conditions before relying on the regional fruiting reference.'], purchase: ['Request locally appropriate fruiting stock; no named cultivar is sourced.'], sources: [sanbi('vangueria-infausta')] },
  'strychnos-spinosa': { products: 'Ripe fruit pulp only.', care: ['Seeds and unripe fruit are toxic. Keep children away from unsupervised harvesting and preparation.'], purchase: ['Confirm identity and appropriate handling before including it in a food plan; no named cultivar is sourced.'], sources: [{ label: 'FAO Ecocrop / ICRAF: Strychnos spinosa', url: 'https://ecocrop.apps.fao.org/ecocrop/srv/en/cropView?id=10135' }] },
  'carissa-macrocarpa': { products: 'Ripe fruit, fresh or preserved.', care: ['Coastal plant; allow for thorns near children and paths.'], purchase: ['Ask for a locally suitable fruiting plant; no named food cultivar is established by this source.'], sources: [sanbi('carissa-macrocarpa')] },
  'carpobrotus-edulis': { products: 'Ripe fruit.', care: ['Full sun and well-drained ground; a waterwise Cape groundcover. Flowering dates are not picking dates.'], purchase: ['Use correctly identified local planting material; no named cultivar is sourced.'], sources: [sanbi('carpobrotus-edulis')] },
  'dovyalis-afra': { products: 'Fruit for preserves.', care: ['Thorny hedge; plan male and female plants for fruit.'], purchase: ['Request identified fruiting material and a compatible male plant; no named cultivar is sourced.'], sources: [sanbi('dovyalis-caffra')] },
  'sclerocarya-birrea-subsp-caffra': { products: 'Fruit and kernels.', care: ['Male and female trees are separate. Preserve space for the mature tree.'], purchase: ['Ask for a known fruiting female and pollination provision; nationality alone does not establish local fit.'], sources: [sanbi('sclerocarya-birrea')] },
  'garcinia-livingstonei': { products: 'Ripe fruit.', care: ['Cold-sensitive; check a warm, sheltered site.'], purchase: ['Confirm local fruiting stock and provenance; no named cultivar is sourced.'], sources: [sanbi('garcinia-livingstonei')] },
  'grewia-occidentalis': { products: 'Ripe fruit, fresh or dried.', care: ['Frost- and drought-hardy; establishment care still matters.'], purchase: ['Choose locally appropriate, correctly identified material; no named cultivar is sourced.'], sources: [sanbi('grewia-occidentalis')] },
  'pappea-capensis': { products: 'Ripe fruit pulp for fresh use or preserves.', care: ['Growth is slower in cold or dry conditions. Seed oil is not presented here as cooking oil.'], purchase: ['Confirm local fruiting material; no named cultivar is sourced.'], sources: [sanbi('pappea-capensis')] },
  'mimusops-zeyheri': { products: 'Ripe fruit.', care: ['Best in summer-rain areas with little frost; protect young trees in colder sites.'], purchase: ['Confirm local suitability and fruiting stock; no named cultivar is sourced.'], sources: [sanbi('mimusops-zeyheri')] },
  'syzygium-cordatum': { products: 'Ripe berries.', care: ['Water-loving: a dry site needs a dependable moisture source. Flowering for bees is not a honey-harvest forecast.'], purchase: ['Choose a moist position and local provenance; no named cultivar is sourced.'], sources: [sanbi('syzygium-cordatum')] },
  'phoenix-reclinata': { products: 'Ripe fruit.', care: ['Male and female plants are separate. Allow for the clump and sharp leaf bases.'], purchase: ['Confirm fruiting female stock and a male pollination source; no named cultivar is sourced.'], sources: [sanbi('phoenix-reclinata')] },
  'rhoicissus-tomentosa': { products: 'Ripe fruit for preserves.', care: ['Provide climbing support. Tuberous roots are poisonous; children should not forage unsupervised.'], purchase: ['Use correctly identified local material; no named cultivar is sourced.'], sources: [sanbi('rhoicissus-tomentosa')] },
};

/** Unreviewed presentation drafts. Source profile data remains canonical; research notes not yet
 * covered by this registry retain their original words and the report says that explicitly. */
export const PRODUCT_GUIDE_COPY: readonly {english:string;zu:string;st:string;ts:string;ve:string}[] = [
  {
    "english": "Keep roots well drained; water matters during flowering.",
    "zu": "Izimpande mazihlale emhlabathini okhipha amanzi kahle; amanzi abalulekile ngesikhathi sokuqhakaza.",
    "st": "Boloka metso mobung o ntshang metsi hantle; metsi a bohlokwa nakong ya ho thunya.",
    "ts": "Tiyisisa leswaku mati ya huma kahle laha timitsu ti nga kona; mati i ya nkoka loko ku huma swiluva.",
    "ve": "Midzi i dzule mavuni a bvumisaho maḓi zwavhuḓi; maḓi ndi a ndeme musi hu tshi khou vha na maluvha."
  },
  {
    "english": "KZN sequence: earlier Fuerte (May–Nov), middle Hass (Aug–Dec), later Ryan (Nov–Feb). These seasons overlap. Buy labelled grafted trees; confirm rootstock and pollination partners.",
    "zu": "Ukulandelana kwase-KZN: i-Fuerte yokuqala ({month5}–{month11}), i-Hass yaphakathi ({month8}–{month12}), i-Ryan yakamuva ({month11}–{month2}). Lezi zikhathi ziyagqagqana. Thenga izihlahla ezixhunyelelwe ezinamalebula; qinisekisa isiphunzi nezinhlobo ezihambisanayo zempova.",
    "st": "Tatellano ya KZN: Fuerte ya pele ({month5}–{month11}), Hass ya bohareng ({month8}–{month12}), Ryan ya morao ({month11}–{month2}). Dinako tsena di a kopana. Reka difate tse hlomathisitsweng tse nang le dileibole; netefatsa kutu ya motso le balekane ba ho tsamaisa peo.",
    "ts": "Ku landzelana ka KZN: Fuerte yo sungula ({month5}–{month11}), Hass ya le xikarhini ({month8}–{month12}), Ryan ya le ndzhaku ({month11}–{month2}). Tinguva leti ta hlangana. Xava mirhi leyi tlhomiweke leyi nga ni tilebulu; tiyisisa nsinya wa timitsu ni mirhi leyi fambisanaka eku hangalaseni ka mpova.",
    "ve": "U tevhekana ha KZN: Fuerte ya u thoma ({month5}–{month11}), Hass ya vhukati ({month8}–{month12}), Ryan ya nga murahu ({month11}–{month2}). Zwifhinga izwi zwi a dzhena kha zwiṅwe. Rengani miri yo ṱumetshedzwaho i re na ḽebuḽu; khwaṱhisedzani mudzi wa mutheo na miri i tshimbidzanaho kha u phaḓaladza luvhanda."
  },
  {
    "english": "Warm, frost-free conditions and dependable water are needed. Keep a replacement follower after the fruiting stem is removed.",
    "zu": "Kudingeka indawo efudumele, engenasithwathwa namanzi athembekile. Gcina ihlumela elizolandela lapho isiqu esithelile sisusiwe.",
    "st": "Ho hlokahala mofuthu, sebaka se se nang serame se qetellang ka leqhwa le metsi a tshepahalang. Boloka lehlomela le tla nka sebaka ka mora ho tlosa kutu e behileng ditholwana.",
    "ts": "Ku laveka ndhawu yo kufumela leyi nga riki na gwitsi ni mati lama kumekaka hi ku tiyiseka. Siya xihluke lexi nga ta siva xirhabyana lexi susiwaka endzhaku ko tswala mihandzu.",
    "ve": "Hu ṱoḓea fhethu hu dudelaho hu si na ṅwando na maḓi a fulufhedzeaho. Vhulungani tshiṋangi tshi ḓo dzhielaho vhudzulo tsinde ḽo bviswaho musi ḽo no aṋwa."
  },
  {
    "english": "Cooler KZN: Williams; warmer valleys: Grand Nain; windy coast: Chinese Cavendish. Buy clean planting material. These are climate choices, not early/middle/late seasons.",
    "zu": "E-KZN epholile: Williams; ezigodini ezifudumele: Grand Nain; ogwini olunomoya: Chinese Cavendish. Thenga izinto zokutshala ezihlanzekile. Lokhu ukukhetha ngokwesimo sezulu, akuzona izikhathi zokuqala/zaphakathi/zakamuva.",
    "st": "KZN e phodileng: Williams; dikgohlong tse futhumetseng: Grand Nain; lebopong le nang le moya: Chinese Cavendish. Reka thepa ya ho jala e hlwekileng. Tsena ke dikgetho tsa maemo a lehodimo, ha se dinako tsa pele/bohareng/morao.",
    "ts": "Eka KZN leyi titimelaka: Williams; eka minkova yo kufumela: Grand Nain; eribuweni leri nga ni moya: Chinese Cavendish. Xava switirhisiwa swo byala leswi baseke. Leyi i nhlawulo wa maxelo, a hi tinguva ta le ku sunguleni/xikarhini/ndzhaku.",
    "ve": "Kha KZN hu rotholelaho: Williams; kha mikovhe i dudelaho: Grand Nain; khunzikhunzini ya lwanzhe hu re na muya: Chinese Cavendish. Rengani zwishumiswa zwa u ṱavha zwo kunaho. Izwi ndi u nanga u ya nga kilima, a si zwifhinga zwa u thoma/vhukati/murahu."
  },
  {
    "english": "Avoid frost and waterlogging. Honey Gold needs male and female plants; Sunrise Solo is hermaphrodite.",
    "zu": "Gwema isithwathwa nokugcwala kwamanzi. I-Honey Gold idinga izitshalo zesilisa nezesifazane; i-Sunrise Solo inezitho zombili zobulili.",
    "st": "Qoba serame se bakang leqhwa le mobu o tletseng metsi. Honey Gold e hloka dimela tsa botona le botshehadi; Sunrise Solo e na le ditho tsa botona le botshehadi semeleng se le seng.",
    "ts": "Papalata gwitsi ni misava leyi taleke mati. Honey Gold yi lava swimilana swa xinuna ni swa xisati; Sunrise Solo yi ni swirho swa xinuna ni swa xisati eka ximilana xinwe.",
    "ve": "Iledzani ṅwando na mavu o ḓalaho maḓi. Honey Gold i ṱoḓa zwimela zwa tshiduna na tshisadzi; Sunrise Solo i na zwipiḓa zwa vhuduna na vhusadzi kha tshimela tshithihi."
  },
  {
    "english": "Planning choice for warm sites: Sunrise Solo. Confirm plant sex/form with the nursery.",
    "zu": "Okukhethelwe ukuhlela izindawo ezifudumele: Sunrise Solo. Qinisekisa ubulili/uhlobo lwesitshalo enkulisa yezitshalo.",
    "st": "Kgetho ya moralo bakeng sa dibaka tse futhumetseng: Sunrise Solo. Netefatsa bong/sebopeho sa semela le keretjhe ya dimela.",
    "ts": "Nhlawulo wa ku pulana eka tindhawu to kufumela: Sunrise Solo. Tiyisisa rimbewu/xivumbeko xa ximilana ni ndhawu yo kurisela swimilana.",
    "ve": "Nḓila ya u pulana kha fhethu hu dudelaho: Sunrise Solo. Khwaṱhisedzani mbeu/tshivhumbeo tsha tshimela na hune ha alusiwa zwimela."
  },
  {
    "english": "Nuts: record nut-in-shell separately from kernels.",
    "zu": "Amantongomane: bhala amantongomane asesemagobolondweni ngokwehlukana nezikhwebu.",
    "st": "Matokomane: ngola a ntseng a le dikgapetleng ka thoko ho dithollo tse ntshitsweng.",
    "ts": "Timanga: rhekhoda leti nga ha riki ni swikhamba ti hambanile ni tindzoho leti susiweke swikhamba.",
    "ve": "Nḓuhu: rekhodani dzi re kha maganda dzo fhambana na tshikoro tsho bviswaho maganda."
  },
  {
    "english": "Match the cultivar to the microclimate; avoid hard frost and poorly drained ground.",
    "zu": "Khetha uhlobo oluhambisana nesimo sezulu sendawo encane; gwema isithwathwa esinzima nomhlabathi ongakhiphi amanzi kahle.",
    "st": "Nyalanya mofuta le boemo ba lehodimo ba sebaka se senyane; qoba serame se matla se bakang leqhwa le mobu o sa ntsheng metsi hantle.",
    "ts": "Hlawula muxaka lowu fambisanaka ni maxelo ya ndhawu yoleyo; papalata gwitsi lerikulu ni misava leyi nga humesiki mati kahle.",
    "ve": "Fananyisani lushaka lwa tshimela u ya nga kilima ya fhethu honoho; iledzani ṅwando muhulwane na mavu a sa bvumisaho maḓi zwavhuḓi."
  },
  {
    "english": "Collect fallen nuts frequently, dehusk promptly and dry with clean ventilation. Keep poultry and manure away from harvesting nuts.",
    "zu": "Qoqa njalo amantongomane awile, susa amakhoba masinyane bese womisa endaweni ehlanzekile engenisa umoya. Izinkukhu nomquba makuqhele lapho kuvunwa khona amantongomane.",
    "st": "Bokella matokomane a weleng kgafetsa, tlosa makgapetla a kantle kapele mme o a omise sebakeng se hlwekileng se kenang moya. Suthisetsa dikgoho le moitedi hole le matokomane a kotulwang.",
    "ts": "Hlengeleta timanga leti weke nkarhi na nkarhi, susa makamba ya le handle hi ku hatlisa kutani u ti omisa endhawini yo basa leyi nghenaka moya. Tiyisisa leswaku tihuku ni manyoro a swi le kusuhi ni timanga leti tshoveriwaka.",
    "ve": "Kuvhanganyani nḓuhu dzo waho tshifhinga tshoṱhe, bvisani maganda a nnḓa nga u ṱavhanya ni dzi omise kha fhethu ho kunaho hu re na muya. Kuku na manyoro zwi dzule kule na nḓuhu dzi khou kaṋiwaho."
  },
  {
    "english": "KZN coastal 90–300 m shortlist: Beaumont (695), Purvis (294), Makai (800), 660. Confirm site elevation and current pollination/maturity advice.",
    "zu": "Uhlu olufushane logu lwase-KZN oluku-90–300 m: Beaumont (695), Purvis (294), Makai (800), 660. Qinisekisa ukuphakama kwendawo nezeluleko zamanje zempova/ukuvuthwa.",
    "st": "Lenane le lekgutshwane la lebopo la KZN la 90–300 m: Beaumont (695), Purvis (294), Makai (800), 660. Netefatsa bophahamo ba sebaka le keletso ya hajwale ya ho tsamaisa peo/ho butswa.",
    "ts": "Nxaxamelo wo koma wa ribuwa ra KZN ra 90–300 m: Beaumont (695), Purvis (294), Makai (800), 660. Tiyisisa ku tlakuka ka ndhawu ni switsundzuxo swa sweswi swa mpova/ku vupfa.",
    "ve": "Mutevhe mupfufhi wa khunzikhunzini ya lwanzhe ya KZN ya 90–300 m: Beaumont (695), Purvis (294), Makai (800), 660. Khwaṱhisedzani vhunṱha ha fhethu na nyeletshedzo dza zwino dza luvhanda/u vhibva."
  },
  {
    "english": "Check frost, drainage and flowering-season disease pressure. Heat and sunburn sensitivity differ between cultivars.",
    "zu": "Hlola isithwathwa, ukuphuma kwamanzi nobungozi bezifo ngesikhathi sokuqhakaza. Ukuzwela ekushiseni nasekushisweni yilanga kuyehluka ngezinhlobo.",
    "st": "Hlahloba serame se bakang leqhwa, phallo ya metsi mobung le kotsi ya mafu nakong ya ho thunya. Kutlo ya mocheso le ho tjheswa ke letsatsi e fapana ka mefuta.",
    "ts": "Kambela gwitsi, ku huma ka mati ni khombo ya mavabyi hi nkarhi wa swiluva. Ku khumbeka hi ku hisa ni ku hisiwa hi dyambu swa hambana hi mixaka.",
    "ve": "Ṱolani ṅwando, u bva ha maḓi na khombo ya malwadze nga tshifhinga tsha maluvha. U kwamea nga mufhiso na u swa nga ḓuvha zwi fhambana nga tshaka."
  },
  {
    "english": "ARC identifies Tommy Atkins and Kent among more heat/sunburn-tolerant options; Sensation and Keitt are more susceptible. Confirm local harvest dates before choosing a succession.",
    "zu": "I-ARC ibala i-Tommy Atkins ne-Kent phakathi kwezinhlobo ezibekezelela ukushisa/ukushiswa yilanga kangcono; i-Sensation ne-Keitt zithinteka kalula. Qinisekisa izinsuku zokuvuna zendawo ngaphambi kokukhetha izinhlobo ezilandelanayo.",
    "st": "ARC e kenyelletsa Tommy Atkins le Kent mefuteng e mamellang mocheso/ho tjheswa ke letsatsi ho feta; Sensation le Keitt di ameha habonolo. Netefatsa matsatsi a kotulo a lehae pele o kgetha tatellano.",
    "ts": "ARC yi katsa Tommy Atkins na Kent eka mixaka leyi tiyiselaka ku hisa/ku hisiwa hi dyambu ku antswa; Sensation na Keitt swi khumbeka ngopfu. Tiyisisa masiku ya ntshovelo ya ndhawu u nga si hlawula mixaka leyi landzelelanaka.",
    "ve": "ARC i vhala Tommy Atkins na Kent kha tshaka dzi konḓelelaho mufhiso/u swa nga ḓuvha khwine; Sensation na Keitt dzi a kwamea nga maanḓa. Khwaṱhisedzani maḓuvha a u kaṋa a henefho musi ni sa athu nanga u tevhekana ha tshaka."
  },
  {
    "english": "Check the actual cultivar, rootstock, winter chilling and compatible pollen source before buying. A warm or cold climate-zone label alone does not establish these conditions.",
    "zu": "Ngaphambi kokuthenga, hlola uhlobo lwangempela, isiphunzi, ukubanda kwasebusika nomthombo wempova ohambisanayo. Ilebula lendawo yesimo sezulu efudumele noma ebandayo lodwa alikuqinisekisi lokhu.",
    "st": "Pele o reka, hlahloba mofuta wa nnete, kutu ya motso, ho bata ha mariha le mohlodi wa peo o dumellanang. Leibole ya sebaka se futhumetseng kapa se batang feela ha e netefatse maemo ana.",
    "ts": "U nga si xava, kambela muxaka wa xiviri, nsinya wa timitsu, ku titimela ka xixika ni xihlovo xa mpova lexi fambisanaka na wona. Lebulu ya ndhawu ya maxelo yo kufumela kumbe yo titimela yi ri yoxe a yi tiyisisi swiyimo leswi.",
    "ve": "Musi ni sa athu renga, ṱolani lushaka lwa vhukuma, mudzi wa mutheo, u rothola ha vhuriha na tshiko tsha luvhanda tshi tshimbidzanaho nalwo. Ḽebuḽu ya dzingu ḽi dudelaho kana ḽi rotholelaho i yoṱhe a i khwaṱhisedzi nyimele idzi."
  },
  {
    "english": "Afri-Star is an ARC-bred low-chill candidate with a stated 300–500 Infruitec Chilling Unit requirement; its December–January dates were obtained at Bien Donne, Simondium, Western Cape and need local checking elsewhere. Granny Smith has an Elgin first-pick reference in late March; SAPO names Golden Delicious or Hillieri as pollen partners. These are separate cultivar references, not a continuous picking season or a warm KZN recommendation. Confirm current nursery stock and local performance.",
    "zu": "I-Afri-Star iwuhlobo olungadingi ukubanda okuningi olwakhiwe yi-ARC, olunesidingo esibhalwe esingu-300–500 Infruitec Chilling Unit; izinsuku zalo zika-{month12}–{month1} zatholakala e-Bien Donne, Simondium, Western Cape futhi zidinga ukuqinisekiswa endaweni kwenye indawo. I-Granny Smith inereferensi yokuqala ukukha e-Elgin ngasekupheleni kuka-{month3}; i-SAPO ibala i-Golden Delicious noma i-Hillieri njengezinhlobo zempova ezihambisanayo. Lezi izinkomba zezinhlobo ezehlukene, akusona isikhathi esiqhubekayo sokukha noma isincomo se-KZN efudumele. Qinisekisa izitshalo ezitholakala enkulisa manje nokusebenza kwazo endaweni.",
    "st": "Afri-Star ke mofuta o hlahisitsweng ke ARC o hlokang ho bata ho fokolang, o nang le tlhoko e boletsweng ya 300–500 Infruitec Chilling Unit; matsatsi a wona a {month12}–{month1} a fumanehile Bien Donne, Simondium, Western Cape mme a hloka ho hlahlojwa dibakeng tse ding. Granny Smith e na le tshupiso ya ho qala ho kga Elgin mafelong a {month3}; SAPO e bolela Golden Delicious kapa Hillieri e le balekane ba peo. Tsena ke ditshupiso tsa mefuta e arohaneng, ha se nako e tswelang pele ya ho kga kapa keletso bakeng sa KZN e futhumetseng. Netefatsa dimela tse fumanehang hajwale keretjheng le tshebetso ya lehae.",
    "ts": "Afri-Star i muxaka lowu humesiweke hi ARC lowu lavaka ku titimela kutsongo, lowu nga ni xilaveko lexi vuriweke xa 300–500 Infruitec Chilling Unit; masiku ya wona ya {month12}–{month1} ma kumeke eBien Donne, Simondium, Western Cape naswona ma fanele ku kambisisiwa endhawini kunwana. Granny Smith yi ni xikombo xa ku sungula ku kha eElgin ekuheleni ka {month3}; SAPO yi vula Golden Delicious kumbe Hillieri ku va vanghana va mpova. Swikombo leswi i swa mixaka yo hambana, a hi nguva yo kha leyi nga heriki kumbe xitsundzuxo xa KZN yo kufumela. Tiyisisa swimilana leswi nga kona sweswi endhawini yo kurisela ni ndlela leyi swi tirhaka ha yona endhawini.",
    "ve": "Afri-Star ndi lushaka lwo bveledzwaho nga ARC lu ṱoḓaho u rothola huṱuku, lu re na ṱhoḓea yo bulwaho ya 300–500 Infruitec Chilling Unit; maḓuvha alwo a {month12}–{month1} o wanala Bien Donne, Simondium, Western Cape nahone a ṱoḓa u sedzulusiwa huṅwe henefho. Granny Smith i na tshiko tsha u thoma u ka Elgin mafheloni a {month3}; SAPO i bula Golden Delicious kana Hillieri sa tshaka dzi ṋeaho luvhanda. Izwi ndi zwiko zwa tshaka dzo fhambanaho, a si tshifhinga tsha u ka tshi sa khauwi kana themendelo ya KZN i dudelaho. Khwaṱhisedzani zwimela zwi re hone zwino kha hune zwa alusiwa na kushumele kwa henefho."
  },
  {
    "english": "Check drainage, water and cultivar/rootstock fit. Main crop timing differs between warm and cool areas; smaller additional crops are not a full-year promise.",
    "zu": "Hlola ukuphuma kwamanzi, amanzi nokufaneleka kohlobo/isiphunzi. Isikhathi sesivuno esikhulu siyehluka phakathi kwezindawo ezifudumele nezipholile; izivuno ezincane ezengeziwe azisona isithembiso sonyaka wonke.",
    "st": "Hlahloba phallo ya metsi mobung, metsi le ho tshwaneleha ha mofuta/kutu ya motso. Nako ya kotulo e kgolo e fapana dibakeng tse futhumetseng le tse phodileng; dikotulo tse nyane tse eketsehileng ha se tshepiso ya selemo kaofela.",
    "ts": "Kambela ku huma ka mati, mati ni ku faneleka ka muxaka/nsinya wa timitsu. Nkarhi wa ntshovelo lowukulu wa hambana etindhawini to kufumela ni to titimela; mintshovelo leyitsongo yo engetela a yi vuli ku tswala lembe hinkwaro.",
    "ve": "Ṱolani u bva ha maḓi, maḓi na u tea ha lushaka/mudzi wa mutheo. Tshifhinga tsha khaṋo khulwane tshi fhambana kha fhethu hu dudelaho na hu rotholelaho; khaṋo ṱhukhu dzo engedzeaho a dzi fulufhedzisi ṅwaha woṱhe."
  },
  {
    "english": "Request labelled lemon stock and rootstock advice from a reputable citrus nursery. A locally validated named cultivar shortlist is not established here.",
    "zu": "Cela izitshalo zikalamula ezinamalebula nezeluleko zesiphunzi enkulisa yezithelo ezisawolintshi ethembekile. Alukho lapha uhlu olufushane lwezinhlobo eziqanjwe amagama oluqinisekiswe endaweni.",
    "st": "Kopa dimela tsa lemon tse nang le dileibole le keletso ya kutu ya motso keretjheng e tshepahalang ya citrus. Ha ho lenane le lekgutshwane la mefuta e bitsitsweng ka mabitso le netefaditsweng sebakeng mona.",
    "ts": "Kombela swimilana swa lemon leswi nga ni tilebulu ni switsundzuxo swa nsinya wa timitsu eka ndhawu yo kurisela citrus leyi tivekaka. A ku na nxaxamelo wo koma wa mixaka leyi nga ni mavito leyi tiyisisiweke endhawini laha.",
    "ve": "Humbelani zwimela zwa lemon zwi re na ḽebuḽu na nyeletshedzo ya mudzi wa mutheo kha hune ha alusiwa citrus hu fulufhedzeaho. A hu na mutevhe mupfufhi wa tshaka dzo bulwaho nga madzina wo khwaṱhisedzwaho henefho afha."
  },
  {
    "english": "Match warm summers with cool, frost-free winter conditions for flowering; protect from wind and keep young plants watered.",
    "zu": "Hlanganisa ihlobo elifudumele nobusika obupholile obungenasithwathwa ukuze kuqhakaze; vikela emoyeni futhi unisele izitshalo ezisencane.",
    "st": "Nyalanya lehlabula le futhumetseng le mariha a phodileng a se nang leqhwa bakeng sa ho thunya; sireletsa moyeng mme o nosetse dimela tse nyane.",
    "ts": "Fananisa ximumu xo kufumela ni xixika xo titimela lexi nga riki na gwitsi leswaku ku ta huma swiluva; sirhelela eka moya naswona u cheleta swimilana leswitsongo.",
    "ve": "Fananyisani tshilimo tshi dudelaho na vhuriha vhu rotholelaho vhu si na ṅwando uri hu vhe na maluvha; tsireledzani kha muya ni sheledze zwimela zwiṱuku."
  },
  {
    "english": "KZN candidates: earlier Fay Zee Siu (mid-November–mid-December), middle Mauritius (mid-November–early-January), later Wai Chee (end-January–end-February), using SALGA/ARC cultivar references. Confirm local dates, nursery stock and flowering conditions.",
    "zu": "Izinhlobo ezingacatshangelwa e-KZN: i-Fay Zee Siu yokuqala (maphakathi no-{month11}–maphakathi no-{month12}), i-Mauritius yaphakathi (maphakathi no-{month11}–ekuqaleni kuka-{month1}), i-Wai Chee yakamuva (ekupheleni kuka-{month1}–ekupheleni kuka-{month2}), ngokwezinkomba zezinhlobo ze-SALGA/ARC. Qinisekisa izinsuku zendawo, izitshalo ezitholakala enkulisa nezimo zokuqhakaza.",
    "st": "Mefuta e ka nahanelwang KZN: Fay Zee Siu ya pele (bohareng ba {month11}–bohareng ba {month12}), Mauritius ya bohareng (bohareng ba {month11}–qalong ya {month1}), Wai Chee ya morao (mafelong a {month1}–mafelong a {month2}), ho sebediswa ditshupiso tsa mefuta tsa SALGA/ARC. Netefatsa matsatsi a lehae, dimela tse fumanehang keretjheng le maemo a ho thunya.",
    "ts": "Mixaka leyi nga kambisisiwaka eKZN: Fay Zee Siu yo sungula (exikarhini ka {month11}–exikarhini ka {month12}), Mauritius ya le xikarhini (exikarhini ka {month11}–eku sunguleni ka {month1}), Wai Chee ya le ndzhaku (ekuheleni ka {month1}–ekuheleni ka {month2}), hi ku tirhisa swikombo swa mixaka swa SALGA/ARC. Tiyisisa masiku ya ndhawu, swimilana leswi kumekaka endhawini yo kurisela ni swiyimo swa ku huma ka swiluva.",
    "ve": "Tshaka dzi nga sedzuluswaho kha KZN: Fay Zee Siu ya u thoma (vhukati ha {month11}–vhukati ha {month12}), Mauritius ya vhukati (vhukati ha {month11}–mathomoni a {month1}), Wai Chee ya murahu (mafheloni a {month1}–mafheloni a {month2}), hu tshi shumiswa zwiko zwa tshaka zwa SALGA/ARC. Khwaṱhisedzani maḓuvha a henefho, zwimela zwi re hone hune zwa alusiwa na nyimele dza maluvha."
  },
  {
    "english": "Provide trellising and pruning; avoid waterlogging and inspect for root rot and virus problems.",
    "zu": "Faka izisekelo zokukhuphuka futhi uthene; gwema ukugcwala kwamanzi uhlole ukubola kwezimpande nezinkinga zamagciwane.",
    "st": "Fana ka ditshehetso tsa ho hloa le ho faola; qoba mobu o tletseng metsi mme o hlahlobe ho bola ha metso le mathata a divaerase.",
    "ts": "Nyika swiseketelo swo khandziya ni ku thena; papalata misava leyi taleke mati naswona u kambela ku bola ka timitsu ni swiphiqo swa tivhayirasi.",
    "ve": "Ṋeani zwitikedzi zwa u gonya ni rune; iledzani mavu o ḓalaho maḓi ni ṱole u sina ha midzi na thaidzo dza vairasi."
  },
  {
    "english": "Purple granadilla is the KZN fresh-fruit reference; yellow forms are more acidic and used for juice. Confirm stock health and local season.",
    "zu": "I-purple granadilla iyireferensi yezithelo ezintsha yase-KZN; izinhlobo eziphuzi zimuncu kakhulu futhi zisetshenziselwa ujusi. Qinisekisa impilo yezitshalo nesikhathi sendawo.",
    "st": "Purple granadilla ke tshupiso ya ditholwana tse foreshe ya KZN; mefuta e tshehla e bodila ho feta mme e sebedisetswa jusi. Netefatsa bophelo ba dimela le nako ya lehae.",
    "ts": "Purple granadilla i xikombo xa mihandzu leyintshwa xa KZN; mixaka ya xitshopana yi ni asidi yo tala naswona yi tirhisiwa eka juzi. Tiyisisa rihanyo ra swimilana ni nguva ya ndhawu.",
    "ve": "Purple granadilla ndi tshiko tsha mitshelo mivhisi tsha KZN; tshaka dza ṱaḓa dzi na asidi nnzhi nahone dzi shumiswa kha dzhuisi. Khwaṱhisedzani mutakalo wa zwimela na tshifhinga tsha henefho."
  },
  {
    "english": "Match the vineyard variety to its production region, water and support system. The national supply season combines several regions.",
    "zu": "Khetha uhlobo lwesivini oluhambisana nesifunda sokukhiqiza, amanzi nohlelo lokusekela. Isikhathi sikazwelonke sokuhlinzeka sihlanganisa izifunda eziningana.",
    "st": "Nyalanya mofuta wa serapa sa morara le sebaka sa tlhahiso, metsi le tsamaiso ya tshehetso. Nako ya phepelo ya naha e kopanya dibaka tse mmalwa.",
    "ts": "Fananisa muxaka wa nsimu ya madiriva ni ndhawu ya vuhumelerisi, mati ni sisiteme yo seketela. Nguva ya mphakelo wa tiko yi hlanganisa tindhawu to tala.",
    "ve": "Fananyisani lushaka lwa tsimu ya nḓirivhe na dzingu ḽa u bveledza, maḓi na maitele a u tikedza. Tshifhinga tsha mphakelo wa lushaka tshi ṱanganya madzingu manzhi."
  },
  {
    "english": "DAFF industry reference: earlier Prime Seedless, Sugraone and Flame Seedless; later Dauphine and Crimson Seedless. SATI identifies Orange River choices including Prime, Thompson Seedless and Sugraone. Confirm local dates and stock; the industry sequence is not a KZN farm calendar.",
    "zu": "Ireferensi yezimboni ye-DAFF: i-Prime Seedless, i-Sugraone ne-Flame Seedless zakuqala; i-Dauphine ne-Crimson Seedless zakamuva. I-SATI ibala izinketho zase-Orange River ezihlanganisa i-Prime, i-Thompson Seedless ne-Sugraone. Qinisekisa izinsuku nezitshalo ezitholakala endaweni; ukulandelana kwezimboni akulona ikhalenda lepulazi lase-KZN.",
    "st": "Tshupiso ya indasteri ya DAFF: Prime Seedless, Sugraone le Flame Seedless tsa pele; Dauphine le Crimson Seedless tsa morao. SATI e bolela dikgetho tsa Orange River tse kenyelletsang Prime, Thompson Seedless le Sugraone. Netefatsa matsatsi le dimela tsa lehae; tatellano ya indasteri ha se khalendara ya polasi ya KZN.",
    "ts": "Xikombo xa indasitiri xa DAFF: Prime Seedless, Sugraone na Flame Seedless to sungula; Dauphine na Crimson Seedless ta le ndzhaku. SATI yi vula mixaka ya Orange River leyi katsaka Prime, Thompson Seedless na Sugraone. Tiyisisa masiku ni swimilana swa ndhawu; ku landzelana ka indasitiri a hi khalendara ya purasi ra KZN.",
    "ve": "Tshiko tsha indasṱiri tsha DAFF: Prime Seedless, Sugraone na Flame Seedless dza u thoma; Dauphine na Crimson Seedless dza murahu. SATI i bula tshaka dza Orange River dzi katelaho Prime, Thompson Seedless na Sugraone. Khwaṱhisedzani maḓuvha na zwimela zwa henefho; u tevhekana ha indasṱiri a si khalenda ya bulasi ḽa KZN."
  },
  {
    "english": "Use clean runners and match the variety and production system to the area. Reliable irrigation and disease control matter.",
    "zu": "Sebenzisa amahlumela anokwebeka ahlanzekile, ukhethe uhlobo nohlelo lokukhiqiza olufanele indawo. Ukunisela okuthembekile nokulawula izifo kubalulekile.",
    "st": "Sebedisa mahlomela a hahabang a hlwekileng mme o nyalanye mofuta le tsamaiso ya tlhahiso le sebaka. Ho nosetsa ho tshepahalang le taolo ya mafu di bohlokwa.",
    "ts": "Tirhisa swihluke leswi navaka leswi baseke naswona u fananisa muxaka ni sisiteme ya vuhumelerisi ni ndhawu. Ku cheleta loku tiyisekaka ni ku lawula mavabyi i swa nkoka.",
    "ve": "Shumisani matavhi a navhaho o kunaho ni fananyise lushaka na maitele a u bveledza na fhethu. U sheledza hu fulufhedzeaho na u langa malwadze ndi zwa ndeme."
  },
  {
    "english": "KZN guide names Chandler and Selecta. Current local availability and performance need checking; tunnel and outdoor seasons must remain separate.",
    "zu": "Umhlahlandlela wase-KZN ubala i-Chandler ne-Selecta. Ukutholakala nokusebenza kwazo endaweni manje kudinga ukuhlolwa; izikhathi zasemhubheni nezangaphandle mazihlale zehlukene.",
    "st": "Tataiso ya KZN e bolela Chandler le Selecta. Ho fumaneha le tshebetso ya tsona ya hajwale sebakeng di hloka ho hlahlojwa; dinako tsa ka tonneleng le tsa ka ntle di lokela ho dula di arohane.",
    "ts": "Nkongomiso wa KZN wu vula Chandler na Selecta. Ku kumeka ni matirhelo ya swona sweswi endhawini swi lava ku kambisisiwa; tinguva ta le tunnel ni ta le handle ti fanele ku hambana.",
    "ve": "Nyendedzi ya KZN i bula Chandler na Selecta. U wanala na kushumele kwadzo kwa zwino henefho zwi ṱoḓa u sedzulusiwa; zwifhinga zwa nga ngomu ha thaneḽe na zwa nnḓa zwi dzule zwo fhambana."
  },
  {
    "english": "Fruit: record whole fruit separately from arils or juice.",
    "zu": "Izithelo: bhala izithelo eziphelele ngokwehlukana nezinhlamvu ezinenyama noma ujusi.",
    "st": "Ditholwana: ngola ditholwana tse feletseng ka thoko ho dithollo tse nang le nama kapa jusi.",
    "ts": "Mihandzu: rhekhoda mihandzu leyi heleleke yi hambanile ni tindzoho leti nga ni nyama kumbe juzi.",
    "ve": "Mitshelo: rekhodani mitshelo yo fhelelaho yo fhambana na mbeu dzi re na ṋama kana dzhuisi."
  },
  {
    "english": "Check fruit maturity and post-harvest handling. Sunburn, cracking and rot vary by cultivar.",
    "zu": "Hlola ukuvuthwa kwezithelo nokuphathwa kwazo emva kokuvuna. Ukushiswa yilanga, ukuqhekeka nokubola kuyehluka ngezinhlobo.",
    "st": "Hlahloba ho butswa ha ditholwana le tlhokomelo ya tsona ka mora kotulo. Ho tjheswa ke letsatsi, ho petsoha le ho bola di fapana ka mefuta.",
    "ts": "Kambela ku vupfa ka mihandzu ni ku yi khoma endzhaku ka ntshovelo. Ku hisiwa hi dyambu, ku pandzeka ni ku bola swa hambana hi mixaka.",
    "ve": "Ṱolani u vhibva ha mitshelo na u i fara nga murahu ha khaṋo. U swa nga ḓuvha, u phatsha na u sina zwi fhambana nga tshaka."
  },
  {
    "english": "Wonderful is an SA industry cultivar. Treat it as a candidate, not proof of fit for a humid KZN site; no locally validated early/middle succession is sourced here.",
    "zu": "I-Wonderful iwuhlobo olusetshenziswa embonini yaseNingizimu Afrika. Yibheke njengengacatshangelwa, hhayi ubufakazi bokufaneleka kwendawo yase-KZN enomswakama; alukho lapha uhlelo lwezinhlobo zokuqala/zaphakathi oluqinisekiswe endaweni.",
    "st": "Wonderful ke mofuta wa indasteri ya Afrika Borwa. E nke e le e ka nahanelwang, eseng bopaki ba ho tshwaneleha sebakeng se mongobo sa KZN; ha ho tatellano ya pele/bohareng e netefaditsweng sebakeng e fuweng mohlodi mona.",
    "ts": "Wonderful i muxaka wa indasitiri ya Afrika-Dzonga. Wu teki wu ri lowu nga kambisisiwaka, ku nga ri vumbhoni bya leswaku wu faneleka eka ndhawu ya KZN leyi nga ni ndzhongho; a ku na ku landzelana ka mixaka yo sungula/ya le xikarhini loku tiyisisiweke endhawini loku sekeriweke eka xihlovo laha.",
    "ve": "Wonderful ndi lushaka lwa indasṱiri ya Afurika Tshipembe. Lu dzhieni sa lu nga sedzuluswaho, hu si vhuṱanzi ha u tea kha fhethu ha KZN hu re na muṋo; a hu na u tevhekana ha tshaka dza u thoma/vhukati ho khwaṱhisedzwaho henefho ho wanalaho kha tshiko afha."
  },
  {
    "english": "Leaves and green pods; keep their records separate.",
    "zu": "Amaqabunga nemidumba eluhlaza; gcina amarekhodi ako ehlukene.",
    "st": "Mahlaku le diphotlwa tse tala; boloka direkoto tsa tsona di arohane.",
    "ts": "Matluka ni tinyawa ta le swiphotlweni ta rihlaza; hlayisa tirhekhodo ta swona ti hambanile.",
    "ve": "Maṱari na maganda a mbeu madala; vhulungani rekhodo dzazwo dzo fhambana."
  },
  {
    "english": "Choose a sunny, well-drained growing position, protect establishment and plan pruning for leaf harvest.",
    "zu": "Khetha indawo yokukhula enelanga ekhipha amanzi kahle, vikela ukusimama kwesitshalo bese uhlela ukuthenela ukuvuna amaqabunga.",
    "st": "Kgetha sebaka sa ho hola se nang le letsatsi se ntshang metsi hantle, sireletsa ho mela ha semela mme o rere ho faola bakeng sa kotulo ya mahlaku.",
    "ts": "Hlawula ndhawu yo kula leyi nga ni dyambu ni ku huma ka mati kahle, sirhelela ku sungula ku kula kutani u pulana ku thena leswaku ku tshoveriwa matluka.",
    "ve": "Nangani fhethu ha u aluwa hu re na ḓuvha hu bvumisaho maḓi zwavhuḓi, tsireledzani u thoma u aluwa ni pulane u runela u kaṋa maṱari."
  },
  {
    "english": "Use correctly identified local planting material. No locally validated named cultivar shortlist is sourced; this plan does not claim nitrogen fixation or medicinal effects.",
    "zu": "Sebenzisa izinto zokutshala zendawo ezikhonjwe kahle. Alukho uhlu olufushane lwezinhlobo eziqanjwe amagama oluqinisekiswe endaweni olunomthombo; lolu hlelo alusho ukuthi isitshalo sibopha i-nitrogen noma siyelapha.",
    "st": "Sebedisa thepa ya ho jala ya lehae e tsejwang ka nepo. Ha ho lenane le lekgutshwane la mefuta e nang le mabitso le netefaditsweng sebakeng le nang le mohlodi; moralo ona ha o bolele hore semela se tlamella nitrogen kapa se na le diphello tsa bongaka.",
    "ts": "Tirhisa switirhisiwa swo byala swa ndhawu leswi tivekaka kahle. A ku na nxaxamelo wo koma wa mixaka leyi nga ni mavito leyi tiyisisiweke endhawini leyi nga ni xihlovo; pulani leyi a yi vuli leswaku ximilana xi khoma nitrogen kumbe xi ni ku tirha ka vutshunguri.",
    "ve": "Shumisani zwishumiswa zwa u ṱavha zwa henefho zwo ṱaluswaho zwavhuḓi. A hu na mutevhe mupfufhi wa tshaka dzo bulwaho nga madzina wo khwaṱhisedzwaho henefho u re na tshiko; pulane iyi a i buli u vhofha nitrogen kana mvelelo dza dzilafho."
  },
  {
    "english": "Soft citrus generally favours cooler, drier conditions. Confirm rootstock and pollination/seediness requirements before mixing varieties.",
    "zu": "Izithelo ezisawolintshi ezithambile zivame ukuthanda izimo ezipholile nezomile. Qinisekisa izidingo zesiphunzi nempova/ukuba nezinhlamvu ngaphambi kokuxuba izinhlobo.",
    "st": "Ditholwana tsa citrus tse bonolo hangata e rata maemo a phodileng, a ommeng. Netefatsa ditlhoko tsa kutu ya motso le ho tsamaisa peo/ho ba le dipeo pele o kopanya mefuta.",
    "ts": "Mihandzu ya citrus yo olova yi tala ku tsakela swiyimo swo titimela ni swo oma. Tiyisisa swilaveko swa nsinya wa timitsu ni mpova/ku va ni timbewu u nga si hlanganisa mixaka.",
    "ve": "Mitshelo ya citrus yo leluwaho i anzela u takalela nyimele dzi rotholelaho dzo omaho. Khwaṱhisedzani ṱhoḓea dza mudzi wa mutheo na luvhanda/u vha na mbeu musi ni sa athu ṱanganya tshaka."
  },
  {
    "english": "For a suitable site: early Miho Wase satsuma (from mid-March); middle clementines (late March–mid-June); later Nadorcott mandarin (mid-May–September). Dates are broad SA references, not a local calendar. Order labelled nursery trees.",
    "zu": "Endaweni efanelekile: i-Miho Wase satsuma yokuqala (kusukela maphakathi no-{month3}); ama-clementines aphakathi (ekupheleni kuka-{month3}–maphakathi no-{month6}); i-Nadorcott mandarin yakamuva (maphakathi no-{month5}–{month9}). Izinsuku ziyizinkomba ezibanzi zaseNingizimu Afrika, azilona ikhalenda lendawo. Oda izihlahla zasenkulisa ezinamalebula.",
    "st": "Bakeng sa sebaka se loketseng: Miho Wase satsuma ya pele (ho tloha bohareng ba {month3}); clementines tsa bohareng (mafelong a {month3}–bohareng ba {month6}); Nadorcott mandarin ya morao (bohareng ba {month5}–{month9}). Matsatsi ke ditshupiso tse batsi tsa Afrika Borwa, ha se khalendara ya lehae. Odara difate tsa keretjhe tse nang le dileibole.",
    "ts": "Eka ndhawu leyi faneleke: Miho Wase satsuma yo sungula (ku sukela exikarhini ka {month3}); clementines ta le xikarhini (ekuheleni ka {month3}–exikarhini ka {month6}); Nadorcott mandarin ya le ndzhaku (exikarhini ka {month5}–{month9}). Masiku i swikombo swo anama swa Afrika-Dzonga, a hi khalendara ya ndhawu. Oda mirhi ya ndhawu yo kurisela leyi nga ni tilebulu.",
    "ve": "Kha fhethu ho teaho: Miho Wase satsuma ya u thoma (u bva vhukati ha {month3}); clementines dza vhukati (mafheloni a {month3}–vhukati ha {month6}); Nadorcott mandarin ya murahu (vhukati ha {month5}–{month9}). Maḓuvha ndi zwiko zwo angalalaho zwa Afurika Tshipembe, a si khalenda ya henefho. Odarani miri ya hune ya alusiwa i re na ḽebuḽu."
  },
  {
    "english": "Check chilling, support and pruning system before planting. Autumn-bearing varieties must not inherit a spring-bearing calendar.",
    "zu": "Hlola ukubanda, izisekelo nohlelo lokuthena ngaphambi kokutshala. Izinhlobo ezithela ekwindla mazingazuzi ikhalenda lezinhlobo ezithela entwasahlobo.",
    "st": "Hlahloba ho bata, tshehetso le tsamaiso ya ho faola pele o jala. Mefuta e behang ditholwana ka hwetla ha e a lokela ho fuwa khalendara ya mefuta e behang nakong ya selemo.",
    "ts": "Kambela ku titimela, swiseketelo ni sisiteme yo thena u nga si byala. Mixaka leyi tswalaka hi xixikana a yi fanelanga ku kuma khalendara ya leyi tswalaka hi ximunwana.",
    "ve": "Ṱolani u rothola, zwitikedzi na maitele a u runa musi ni sa athu ṱavha. Tshaka dzi aṋwaho nga tshifhefho dzi songo fhiwa khalenda ya dzi aṋwaho nga lutavula."
  },
  {
    "english": "KZN guide: low-chill autumn bearers Heritage or Autumn Bliss; spring bearers Glen Prosen, Glen Lyon or Tulameen need more chilling. Confirm local dates.",
    "zu": "Umhlahlandlela wase-KZN: izinhlobo ezithela ekwindla ezingadingi ukubanda okuningi i-Heritage noma i-Autumn Bliss; ezithela entwasahlobo i-Glen Prosen, i-Glen Lyon noma i-Tulameen zidinga ukubanda okuningi. Qinisekisa izinsuku zendawo.",
    "st": "Tataiso ya KZN: Heritage kapa Autumn Bliss di beha ka hwetla mme di hloka ho bata ho fokolang; Glen Prosen, Glen Lyon kapa Tulameen tse behang nakong ya selemo di hloka ho bata ho feta. Netefatsa matsatsi a lehae.",
    "ts": "Nkongomiso wa KZN: Heritage kumbe Autumn Bliss ti tswala hi xixikana naswona ti lava ku titimela kutsongo; Glen Prosen, Glen Lyon kumbe Tulameen leti tswalaka hi ximunwana ti lava ku titimela ko tala. Tiyisisa masiku ya ndhawu.",
    "ve": "Nyendedzi ya KZN: Heritage kana Autumn Bliss dzi aṋwa nga tshifhefho nahone dzi ṱoḓa u rothola huṱuku; Glen Prosen, Glen Lyon kana Tulameen dzi aṋwaho nga lutavula dzi ṱoḓa u rothola hunzhi. Khwaṱhisedzani maḓuvha a henefho."
  },
  {
    "english": "Check soil acidity, cultivar chilling, irrigation and pollination requirements before buying.",
    "zu": "Hlola ubumuncu bomhlabathi, ukubanda okudingwa uhlobo, ukunisela nezidingo zempova ngaphambi kokuthenga.",
    "st": "Hlahloba bodila ba mobu, ho bata ho hlokwang ke mofuta, ho nosetsa le ditlhoko tsa ho tsamaisa peo pele o reka.",
    "ts": "Kambela asidi ya misava, ku titimela loku laviwaka hi muxaka, ku cheleta ni swilaveko swa mpova u nga si xava.",
    "ve": "Ṱolani asidi ya mavu, u rothola hu ṱoḓwaho nga lushaka, u sheledza na ṱhoḓea dza luvhanda musi ni sa athu renga."
  },
  {
    "english": "Warm-climate candidate: Biloxi, a low-chill southern highbush cultivar, reported by a nursery producing stock in South Africa. Obtain a compatible southern highbush pollination partner. Early flowering can suffer spring frost; local soil, chill and harvest dates still need checking. Do not substitute rabbiteye plants as a highbush cultivar.",
    "zu": "Uhlobo olungacatshangelwa esimweni sezulu esifudumele: Biloxi, uhlobo lwe-southern highbush olungadingi ukubanda okuningi, olubikwe yinkulisa ekhiqiza izitshalo eNingizimu Afrika. Thola olunye uhlobo lwe-southern highbush oluhambisanayo lwempova. Ukuqhakaza kusenesikhathi kungalinyazwa isithwathwa sasentwasahlobo; umhlabathi, ukubanda nezinsuku zokuvuna zendawo kusadinga ukuhlolwa. Ungasebenzisi izitshalo ze-rabbiteye esikhundleni sohlobo lwe-highbush.",
    "st": "Mofuta o ka nahanelwang bakeng sa boemo bo futhumetseng: Biloxi, mofuta wa southern highbush o hlokang ho bata ho fokolang, o tlalehilweng ke keretjhe e hlahisang dimela Afrika Borwa. Fumana molekane wa southern highbush o dumellanang bakeng sa ho tsamaisa peo. Ho thunya kapele ho ka angwa ke serame se bakang leqhwa nakong ya selemo; mobu, ho bata le matsatsi a kotulo a lehae di ntse di hloka ho hlahlojwa. O se ke wa nkela mofuta wa highbush sebaka ka dimela tsa rabbiteye.",
    "ts": "Muxaka lowu nga kambisisiwaka eka maxelo yo kufumela: Biloxi, muxaka wa southern highbush lowu lavaka ku titimela kutsongo, lowu vikiweke hi ndhawu yo kurisela swimilana eAfrika-Dzonga. Kuma muxaka wa southern highbush lowu fambisanaka na wona eka mpova. Swiluva swa le ku sunguleni swi nga khumbiwa hi gwitsi ra ximunwana; misava, ku titimela ni masiku ya ntshovelo ya ndhawu swa ha lava ku kambisisiwa. U nga sivi muxaka wa highbush hi swimilana swa rabbiteye.",
    "ve": "Lushaka lu nga sedzuluswaho kha kilima i dudelaho: Biloxi, lushaka lwa southern highbush lu ṱoḓaho u rothola huṱuku, lwo vhigwaho nga hune ha alusiwa zwimela Afurika Tshipembe. Wanani lushaka lwa southern highbush lu tshimbidzanaho nalwo kha luvhanda. Maluvha a u ṱavhanya a nga kwamiwa nga ṅwando wa lutavula; mavu, u rothola na maḓuvha a khaṋo a henefho zwi kha ḓi ṱoḓa u sedzulusiwa. Ni songo dzhiela lushaka lwa highbush vhudzulo nga zwimela zwa rabbiteye."
  },
  {
    "english": "Use compatible pollen-shedding and receptive varieties. Wet-summer areas need scab-resistant choices; early nut maturity alone does not establish pollination compatibility.",
    "zu": "Sebenzisa izinhlobo ezikhipha impova neziyemukelayo ezihambisanayo. Izindawo ezinemvula yasehlobo zidinga izinhlobo ezimelana nesifo se-scab; ukuvuthwa kwamantongomane kusenesikhathi kukodwa akuqinisekisi ukuhambisana kwempova.",
    "st": "Sebedisa mefuta e dumellanang e ntshang le e amohelang peo. Dibaka tse nang le pula hlabula di hloka mefuta e hanyetsang lefu la scab; ho butswa ha matokomane kapele feela ha ho netefatse ho dumellana ha peo.",
    "ts": "Tirhisa mixaka leyi humesaka ni ku amukela mpova leyi fambisanaka. Tindhawu leti nga ni mpfula hi ximumu ti lava mixaka leyi lwisanaka ni vuvabyi bya scab; ku vupfa ka timanga hi ku hatlisa ntsena a swi tiyisisi ku fambisana eka mpova.",
    "ve": "Shumisani tshaka dzi tshimbidzanaho dzi bvisaho na dzi ṱanganedzaho luvhanda. Madzingu a re na mvula tshilimo a ṱoḓa tshaka dzi konḓelelaho vhulwadze ha scab; u vhibva ha nḓuhu nga u ṱavhanya hu hoṱhe a hu khwaṱhisedzi u tshimbidzana kha luvhanda."
  },
  {
    "english": "SAPPA shortlist: wetter KZN/Lowveld — Ukulinga, Cape Fear, Choctaw; wet, colder KZN — Barton; drier Highveld — Barton, Pawnee, Wichita; dry western areas — Wichita, Choctaw, Western Schley. The inferred climate group alone cannot distinguish all these areas. Confirm local humidity, soils and the pollination pair before buying.",
    "zu": "Uhlu olufushane lwe-SAPPA: e-KZN/Lowveld enomswakama omningi — Ukulinga, Cape Fear, Choctaw; e-KZN emanzi nebandayo kakhulu — Barton; e-Highveld eyomile kakhudlwana — Barton, Pawnee, Wichita; ezindaweni ezomile zasentshonalanga — Wichita, Choctaw, Western Schley. Iqembu lesimo sezulu elicatshangelwe lodwa alikwazi ukuhlukanisa zonke lezi zindawo. Qinisekisa umswakama wendawo, umhlabathi nezinhlobo ezimbili zempova ngaphambi kokuthenga.",
    "st": "Lenane le lekgutshwane la SAPPA: KZN/Lowveld e nang le mongobo o mongata — Ukulinga, Cape Fear, Choctaw; KZN e metsi, e batang ho feta — Barton; Highveld e ommeng ho feta — Barton, Pawnee, Wichita; dibaka tse ommeng tsa bophirimela — Wichita, Choctaw, Western Schley. Sehlopha sa maemo a lehodimo se hakantsweng feela ha se kgone ho kgetholla dibaka tsena tsohle. Netefatsa mongobo wa lehae, mobu le balekane ba peo pele o reka.",
    "ts": "Nxaxamelo wo koma wa SAPPA: KZN/Lowveld leyi nga ni ndzhongho wo tala — Ukulinga, Cape Fear, Choctaw; KZN leyi tsakamaka, leyi titimelaka swinene — Barton; Highveld leyi omeke ku tlurisa — Barton, Pawnee, Wichita; tindhawu to oma ta le vupeladyambu — Wichita, Choctaw, Western Schley. Ntlawa wa maxelo lowu kumbeteriweke wu ri woxe a wu koti ku hambanisa tindhawu leti hinkwato. Tiyisisa ndzhongho wa ndhawu, misava ni mixaka yimbirhi ya mpova u nga si xava.",
    "ve": "Mutevhe mupfufhi wa SAPPA: KZN/Lowveld hu re na muṋo munzhi — Ukulinga, Cape Fear, Choctaw; KZN hu ṋukalaho, hu rotholelaho nga maanḓa — Barton; Highveld ho omaho nga maanḓa — Barton, Pawnee, Wichita; fhethu ho omaho ha vhukovhela — Wichita, Choctaw, Western Schley. Tshigwada tsha kilima tsho humbulelwaho tshi tshoṱhe a tshi koni u fhambanya fhethu hoṱhe uhu. Khwaṱhisedzani muṋo wa henefho, mavu na tshaka mbili dza luvhanda musi ni sa athu renga."
  },
  {
    "english": "Confirm cultivar-specific chilling and spring frost risk. Mean winter temperature is not a chill-hour measurement.",
    "zu": "Qinisekisa ukubanda okudingwa uhlobo oluthile nobungozi besithwathwa sasentwasahlobo. Izinga lokushisa eliyisilinganiso lasebusika alisona isilinganiso samahora okubanda.",
    "st": "Netefatsa ho bata ho hlokwang ke mofuta o itseng le kotsi ya leqhwa nakong ya selemo. Mocheso o mahareng wa mariha ha se tekanyo ya dihora tsa ho bata.",
    "ts": "Tiyisisa ku titimela loku laviwaka hi muxaka wolowo ni khombo ya gwitsi ra ximunwana. Mahiselo ya xixika ya avhareji a hi mpimo wa tiawara to titimela.",
    "ve": "Khwaṱhisedzani u rothola hu ṱoḓwaho nga lushaka lwonolwo na khombo ya ṅwando wa lutavula. Mufhiso wa vhukati wa vhuriha a si muelo wa awara dza u rothola."
  },
  {
    "english": "Low-to-medium chill candidate: Earligold (200–400 Infruitec units), with a December first-pick reference from Bien Donne, Western Cape. Later Cederberg has a January reference. Confirm actual chilling, stock and local dates before staging varieties.",
    "zu": "Uhlobo olungacatshangelwa oludinga ukubanda okuncane kuya kokumaphakathi: Earligold (200–400 Infruitec units), olunereferensi yokuqala ukukha ngo-{month12} yase-Bien Donne, Western Cape. I-Cederberg yakamuva inereferensi ka-{month1}. Qinisekisa ukubanda kwangempela, izitshalo nezinsuku zendawo ngaphambi kokuhlela izinhlobo zilandelane.",
    "st": "Mofuta o ka nahanelwang o hlokang ho bata ho fokolang ho isa ho mahareng: Earligold (200–400 Infruitec units), o nang le tshupiso ya ho qala ho kga ka {month12} e tswang Bien Donne, Western Cape. Cederberg ya morao e na le tshupiso ya {month1}. Netefatsa ho bata ha nnete, dimela le matsatsi a lehae pele o hlophisa tatellano ya mefuta.",
    "ts": "Muxaka lowu nga kambisisiwaka lowu lavaka ku titimela kutsongo ku fika eka ka le xikarhini: Earligold (200–400 Infruitec units), lowu nga ni xikombo xa ku sungula ku kha hi {month12} eBien Donne, Western Cape. Cederberg ya le ndzhaku yi ni xikombo xa {month1}. Tiyisisa ku titimela ka xiviri, swimilana ni masiku ya ndhawu u nga si pulana ku landzelana ka mixaka.",
    "ve": "Lushaka lu nga sedzuluswaho lu ṱoḓaho u rothola huṱuku u swika kha ha vhukati: Earligold (200–400 Infruitec units), lu re na tshiko tsha u thoma u ka nga {month12} tsha Bien Donne, Western Cape. Cederberg ya murahu i na tshiko tsha {month1}. Khwaṱhisedzani u rothola ha vhukuma, zwimela na maḓuvha a henefho musi ni sa athu vhekanya tshaka dzi tshi tevhekana."
  },
  {
    "english": "Match chilling and pollination partners. A second variety must flower compatibly, not merely ripen at a different time.",
    "zu": "Hlanganisa izidingo zokubanda nezinhlobo zempova ezihambisanayo. Olunye uhlobo kufanele luqhakaze ngesikhathi esihambisanayo, lungamane luvuthwe ngesikhathi esihlukile.",
    "st": "Nyalanya ditlhoko tsa ho bata le balekane ba peo. Mofuta wa bobedi o lokela ho thunya ka nako e dumellanang, eseng feela ho butswa ka nako e fapaneng.",
    "ts": "Fananisa ku titimela ni mixaka leyi fambisanaka eka mpova. Muxaka wa vumbirhi wu fanele ku huma swiluva hi nkarhi lowu fambisanaka, ku nga ri ntsena ku vupfa hi nkarhi wo hambana.",
    "ve": "Fananyisani u rothola na tshaka dzi tshimbidzanaho kha luvhanda. Lushaka lwa vhuvhili lu tea u vha na maluvha nga tshifhinga tshi tshimbidzanaho, hu si u sokou vhibva nga tshifhinga tsho fhambanaho."
  },
  {
    "english": "Candidate: African Delight (200–400 Infruitec units). Pollinators listed by ARC/Culdevco: Pioneer or African Rose. Late-February first-pick data is from the Western Cape reference site, not a promise for warm KZN.",
    "zu": "Uhlobo olungacatshangelwa: African Delight (200–400 Infruitec units). Izinhlobo zempova ezibhalwe yi-ARC/Culdevco: Pioneer noma African Rose. Idatha yokuqala ukukha ngasekupheleni kuka-{month2} ivela endaweni yereferensi yase-Western Cape, ayisona isithembiso se-KZN efudumele.",
    "st": "Mofuta o ka nahanelwang: African Delight (200–400 Infruitec units). Balekane ba peo ba boletsweng ke ARC/Culdevco: Pioneer kapa African Rose. Datha ya ho qala ho kga mafelong a {month2} e tswa sebakeng sa tshupiso sa Western Cape, ha se tshepiso bakeng sa KZN e futhumetseng.",
    "ts": "Muxaka lowu nga kambisisiwaka: African Delight (200–400 Infruitec units). Mixaka ya mpova leyi nxaxametiweke hi ARC/Culdevco: Pioneer kumbe African Rose. Datha ya ku sungula ku kha ekuheleni ka {month2} yi huma eka ndhawu ya xikombo ya Western Cape, a hi xitshembiso xa KZN yo kufumela.",
    "ve": "Lushaka lu nga sedzuluswaho: African Delight (200–400 Infruitec units). Tshaka dza luvhanda dzo ṅwalwaho nga ARC/Culdevco: Pioneer kana African Rose. Data ya u thoma u ka mafheloni a {month2} i bva kha fhethu ha tshiko ha Western Cape, a si fulufhedziso ḽa KZN i dudelaho."
  },
  {
    "english": "Ripe fruit for fresh use or preserves.",
    "zu": "Izithelo ezivuthiwe zokudliwa zisentsha noma zokulondolozwa.",
    "st": "Ditholwana tse butswitseng bakeng sa ho jewa di le foreshe kapa ho bolokwa.",
    "ts": "Mihandzu leyi vupfeke yo dyiwa yi ri yintshwa kumbe ku hlayisiwa.",
    "ve": "Mitshelo yo vhibvaho ya u ḽiwa i mivhisi kana u vhulungwa."
  },
  {
    "english": "Frost-free regional reference; male and female trees are separate.",
    "zu": "Ireferensi yesifunda esingenasithwathwa; izihlahla zesilisa nezesifazane zehlukene.",
    "st": "Tshupiso ya sebaka se se nang leqhwa; difate tsa botona le botshehadi di arohane.",
    "ts": "Xikombo xa ndhawu leyi nga riki na gwitsi; mirhi ya xinuna ni ya xisati yi hambanile.",
    "ve": "Tshiko tsha dzingu ḽi si na ṅwando; miri ya tshiduna na tshisadzi yo fhambana."
  },
  {
    "english": "Request correctly identified local fruiting stock and pollination provision; no named cultivar is sourced.",
    "zu": "Cela izitshalo zendawo ezithela izithelo ezikhonjwe kahle nokulungiselelwa kwempova; alukho uhlobo oluqanjwe igama olunomthombo.",
    "st": "Kopa dimela tsa lehae tse behang ditholwana tse tsejwang ka nepo le tokisetso ya ho tsamaisa peo; ha ho mofuta o bitsitsweng ka lebitso o nang le mohlodi.",
    "ts": "Kombela swimilana swa ndhawu leswi tswalaka mihandzu leswi tivekaka kahle ni ku lunghiselela mpova; a ku na muxaka lowu nga ni vito lowu sekeriweke eka xihlovo.",
    "ve": "Humbelani zwimela zwa henefho zwi aṋwaho mitshelo zwo ṱaluswaho zwavhuḓi na ndugiselelo ya luvhanda; a hu na lushaka lwo bulwaho nga dzina lu re na tshiko."
  },
  {
    "english": "Ripe fruit.",
    "zu": "Izithelo ezivuthiwe.",
    "st": "Ditholwana tse butswitseng.",
    "ts": "Mihandzu leyi vupfeke.",
    "ve": "Mitshelo yo vhibvaho."
  },
  {
    "english": "Match the local rocky woodland/forest habitat; flowering dates are not harvest dates.",
    "zu": "Hambisana nendawo yakhona yemithi/ihlathi elinamatshe; izinsuku zokuqhakaza akuzona izinsuku zokuvuna.",
    "st": "Nyalanya le tikoloho ya lehae ya meru e nang le majwe; matsatsi a ho thunya ha se matsatsi a kotulo.",
    "ts": "Fananisa ni ndhawu ya mirhi/khwati ya maribye ya ndhawu; masiku ya swiluva a hi masiku ya ntshovelo.",
    "ve": "Fananyisani na vhudzulo ha henefho ha mavhiḓa/ḓaka ḽi re na matombo; maḓuvha a maluvha a si maḓuvha a khaṋo."
  },
  {
    "english": "Request correctly identified local fruiting material; no named cultivar is sourced.",
    "zu": "Cela izinto zendawo zokutshala ezithela izithelo ezikhonjwe kahle; alukho uhlobo oluqanjwe igama olunomthombo.",
    "st": "Kopa thepa ya lehae e behang ditholwana e tsejwang ka nepo; ha ho mofuta o bitsitsweng ka lebitso o nang le mohlodi.",
    "ts": "Kombela switirhisiwa swa ndhawu leswi tswalaka mihandzu leswi tivekaka kahle; a ku na muxaka lowu nga ni vito lowu sekeriweke eka xihlovo.",
    "ve": "Humbelani zwishumiswa zwa henefho zwi aṋwaho mitshelo zwo ṱaluswaho zwavhuḓi; a hu na lushaka lwo bulwaho nga dzina lu re na tshiko."
  },
  {
    "english": "Ripe fruit, fresh or dried.",
    "zu": "Izithelo ezivuthiwe, ezintsha noma ezomisiwe.",
    "st": "Ditholwana tse butswitseng, tse foreshe kapa tse omisitsweng.",
    "ts": "Mihandzu leyi vupfeke, leyintshwa kumbe leyi omisiweke.",
    "ve": "Mitshelo yo vhibvaho, mivhisi kana yo omiswaho."
  },
  {
    "english": "Confirm local establishment conditions before relying on the regional fruiting reference.",
    "zu": "Qinisekisa izimo zokusimama endaweni ngaphambi kokuthembela kureferensi yesifunda yokuthela izithelo.",
    "st": "Netefatsa maemo a ho mela sebakeng pele o tshepa tshupiso ya sebaka ya ho beha ditholwana.",
    "ts": "Tiyisisa swiyimo swa ku sungula ku kula endhawini u nga si tshemba xikombo xa ndhawu xa ku tswala mihandzu.",
    "ve": "Khwaṱhisedzani nyimele dza u thoma u aluwa henefho musi ni sa athu fulufhela tshiko tsha dzingu tsha u aṋwa mitshelo."
  },
  {
    "english": "Request locally appropriate fruiting stock; no named cultivar is sourced.",
    "zu": "Cela izitshalo ezithela izithelo ezifanele indawo; alukho uhlobo oluqanjwe igama olunomthombo.",
    "st": "Kopa dimela tse behang ditholwana tse tshwanelang sebaka; ha ho mofuta o bitsitsweng ka lebitso o nang le mohlodi.",
    "ts": "Kombela swimilana leswi tswalaka mihandzu leswi faneleke endhawini; a ku na muxaka lowu nga ni vito lowu sekeriweke eka xihlovo.",
    "ve": "Humbelani zwimela zwi aṋwaho mitshelo zwo teaho henefho; a hu na lushaka lwo bulwaho nga dzina lu re na tshiko."
  },
  {
    "english": "Ripe fruit pulp only.",
    "zu": "Inyama yezithelo ezivuthiwe kuphela.",
    "st": "Nama ya ditholwana tse butswitseng feela.",
    "ts": "Nyama ya mihandzu leyi vupfeke ntsena.",
    "ve": "Ṋama ya mitshelo yo vhibvaho fhedzi."
  },
  {
    "english": "Seeds and unripe fruit are toxic. Keep children away from unsupervised harvesting and preparation.",
    "zu": "Izinhlamvu nezithelo ezingakavuthwa zinobuthi. Izingane mazingavuni noma zilungiselele ngaphandle kokuqashwa.",
    "st": "Dipeo le ditholwana tse sa butswang di na le tjhefo. Bana ba se ke ba kotula kapa ba lokisa ditholwana ba sa behwa leihlo.",
    "ts": "Timbewu ni mihandzu leyi nga vupfangiki swi ni chefu. Vana va nga tshoveri kumbe ku lunghiselela mihandzu handle ko langutisiwa.",
    "ve": "Mbeu na mitshelo i sa athu vhibvaho zwi na mulimo. Vhana vha songo kaṋa kana u lugisa mitshelo vha sa sedzwi."
  },
  {
    "english": "Confirm identity and appropriate handling before including it in a food plan; no named cultivar is sourced.",
    "zu": "Qinisekisa ukuthi yisiphi isitshalo nokuphathwa okufanele ngaphambi kokusifaka ohlelweni lokudla; alukho uhlobo oluqanjwe igama olunomthombo.",
    "st": "Netefatsa boitsebiso le ho tshwara ka nepo pele o se kenya moralong wa dijo; ha ho mofuta o bitsitsweng ka lebitso o nang le mohlodi.",
    "ts": "Tiyisisa leswaku i ximilana xihi ni ndlela yo xi khoma leyi faneleke u nga si xi katsa eka pulani ya swakudya; a ku na muxaka lowu nga ni vito lowu sekeriweke eka xihlovo.",
    "ve": "Khwaṱhisedzani vhuṋe ha tshimela na kufarele kwo teaho musi ni sa athu tshi katela kha pulane ya zwiḽiwa; a hu na lushaka lwo bulwaho nga dzina lu re na tshiko."
  },
  {
    "english": "Ripe fruit, fresh or preserved.",
    "zu": "Izithelo ezivuthiwe, ezintsha noma ezilondoloziwe.",
    "st": "Ditholwana tse butswitseng, tse foreshe kapa tse bolokilweng.",
    "ts": "Mihandzu leyi vupfeke, leyintshwa kumbe leyi hlayisiweke.",
    "ve": "Mitshelo yo vhibvaho, mivhisi kana yo vhulungwaho."
  },
  {
    "english": "Coastal plant; allow for thorns near children and paths.",
    "zu": "Isitshalo sasogwini; cabangela ameva eduze kwezingane nezindlela.",
    "st": "Semela sa lebopo; ela hloko meutlwa pela bana le ditsela.",
    "ts": "Ximilana xa le ribuweni; ehleketa hi mitwa ekusuhi ni vana ni tindlela.",
    "ve": "Tshimela tsha khunzikhunzini ya lwanzhe; sedzani mipfa tsini na vhana na nḓila."
  },
  {
    "english": "Ask for a locally suitable fruiting plant; no named food cultivar is established by this source.",
    "zu": "Cela isitshalo esithela izithelo esifanele indawo; lo mthombo awuqinisekisi uhlobo lokudla oluqanjwe igama.",
    "st": "Kopa semela se behang ditholwana se tshwanelang sebaka; mohlodi ona ha o netefatse mofuta wa dijo o bitsitsweng ka lebitso.",
    "ts": "Kombela ximilana lexi tswalaka mihandzu lexi faneleke endhawini; xihlovo lexi a xi tiyisisi muxaka wa swakudya lowu nga ni vito.",
    "ve": "Humbelani tshimela tshi aṋwaho mitshelo tsho teaho henefho; tshiko itshi a tshi khwaṱhisedzi lushaka lwa zwiḽiwa lwo bulwaho nga dzina."
  },
  {
    "english": "Full sun and well-drained ground; a waterwise Cape groundcover. Flowering dates are not picking dates.",
    "zu": "Ilanga eligcwele nomhlabathi okhipha amanzi kahle; isitshalo saseKapa esimboza umhlabathi esingadingi amanzi amaningi. Izinsuku zokuqhakaza akuzona izinsuku zokukha.",
    "st": "Letsatsi le felletseng le mobu o ntshang metsi hantle; semela se kwahelang mobu sa Kapa se sebedisang metsi ka hloko. Matsatsi a ho thunya ha se matsatsi a ho kga.",
    "ts": "Dyambu leri heleleke ni misava leyi humesaka mati kahle; ximilana xo funengeta misava xa Kapa lexi nga tirhisiki mati yo tala. Masiku ya swiluva a hi masiku ya ku kha.",
    "ve": "Ḓuvha ḽo fhelelaho na mavu a bvumisaho maḓi zwavhuḓi; tshimela tsha Kapa tshi tsireledzaho mavu tshi sa ṱoḓi maḓi manzhi. Maḓuvha a maluvha a si maḓuvha a u ka."
  },
  {
    "english": "Use correctly identified local planting material; no named cultivar is sourced.",
    "zu": "Sebenzisa izinto zokutshala zendawo ezikhonjwe kahle; alukho uhlobo oluqanjwe igama olunomthombo.",
    "st": "Sebedisa thepa ya ho jala ya lehae e tsejwang ka nepo; ha ho mofuta o bitsitsweng ka lebitso o nang le mohlodi.",
    "ts": "Tirhisa switirhisiwa swo byala swa ndhawu leswi tivekaka kahle; a ku na muxaka lowu nga ni vito lowu sekeriweke eka xihlovo.",
    "ve": "Shumisani zwishumiswa zwa u ṱavha zwa henefho zwo ṱaluswaho zwavhuḓi; a hu na lushaka lwo bulwaho nga dzina lu re na tshiko."
  },
  {
    "english": "Fruit for preserves.",
    "zu": "Izithelo zokulondolozwa.",
    "st": "Ditholwana tsa ho bolokwa.",
    "ts": "Mihandzu yo hlayisiwa.",
    "ve": "Mitshelo ya u vhulungwa."
  },
  {
    "english": "Thorny hedge; plan male and female plants for fruit.",
    "zu": "Uthango olunameva; hlela izitshalo zesilisa nezesifazane ukuze kutholakale izithelo.",
    "st": "Lekhoakhoa le nang le meutlwa; rera dimela tsa botona le botshehadi bakeng sa ditholwana.",
    "ts": "Rihlampfu ra mitwa; pulana swimilana swa xinuna ni swa xisati leswaku ku ta va ni mihandzu.",
    "ve": "Luhura lwa mipfa; pulanani zwimela zwa tshiduna na tshisadzi uri hu vhe na mitshelo."
  },
  {
    "english": "Request identified fruiting material and a compatible male plant; no named cultivar is sourced.",
    "zu": "Cela izinto zokutshala ezithela izithelo ezikhonjwe kahle nesitshalo sesilisa esihambisanayo; alukho uhlobo oluqanjwe igama olunomthombo.",
    "st": "Kopa thepa e behang ditholwana e tsejwang le semela sa botona se dumellanang; ha ho mofuta o bitsitsweng ka lebitso o nang le mohlodi.",
    "ts": "Kombela switirhisiwa leswi tswalaka mihandzu leswi tivekaka ni ximilana xa xinuna lexi fambisanaka; a ku na muxaka lowu nga ni vito lowu sekeriweke eka xihlovo.",
    "ve": "Humbelani zwishumiswa zwi aṋwaho mitshelo zwo ṱaluswaho na tshimela tsha tshiduna tshi tshimbidzanaho nazwo; a hu na lushaka lwo bulwaho nga dzina lu re na tshiko."
  },
  {
    "english": "Fruit and kernels.",
    "zu": "Izithelo nezikhwebu.",
    "st": "Ditholwana le dithollo.",
    "ts": "Mihandzu ni tindzoho.",
    "ve": "Mitshelo na tshikoro."
  },
  {
    "english": "Male and female trees are separate. Preserve space for the mature tree.",
    "zu": "Izihlahla zesilisa nezesifazane zehlukene. Gcina indawo yesihlahla lapho sesikhulile.",
    "st": "Difate tsa botona le botshehadi di arohane. Boloka sebaka sa sefate ha se se se hodile.",
    "ts": "Mirhi ya xinuna ni ya xisati yi hambanile. Siya ndhawu ya murhi loko wu kurile.",
    "ve": "Miri ya tshiduna na tshisadzi yo fhambana. Vhulungani tshikhala tsha muri musi wo no hula."
  },
  {
    "english": "Ask for a known fruiting female and pollination provision; nationality alone does not establish local fit.",
    "zu": "Cela isihlahla sesifazane esaziwayo esithela izithelo nokulungiselelwa kwempova; ukuthi isitshalo singesaliphi izwe kukodwa akukuqinisekisi ukufaneleka kwendawo.",
    "st": "Kopa semela sa botshehadi se tsejwang se behang ditholwana le tokisetso ya ho tsamaisa peo; naha eo semela se tswang ho yona feela ha e netefatse ho tshwaneleha ha sebaka.",
    "ts": "Kombela ximilana xa xisati lexi tivekaka lexi tswalaka mihandzu ni ku lunghiselela mpova; tiko leri ximilana xi humaka eka rona ri ri roxe a ri tiyisisi ku faneleka endhawini.",
    "ve": "Humbelani tshimela tsha tshisadzi tshi ḓivheaho tshi aṋwaho mitshelo na ndugiselelo ya luvhanda; lushaka lwa shango hune tsha bva hone lu lwoṱhe a lu khwaṱhisedzi u tea henefho."
  },
  {
    "english": "Cold-sensitive; check a warm, sheltered site.",
    "zu": "Siyazwela emakhazeni; hlola indawo efudumele nevikelekile.",
    "st": "Se angwa ke serame; hlahloba sebaka se futhumetseng se sireleditsweng.",
    "ts": "Xi khumbeka hi xirhami; kambela ndhawu yo kufumela leyi sirhelelekeke.",
    "ve": "Tshi kwamea nga murotholo; ṱolani fhethu hu dudelaho ho tsireledzeaho."
  },
  {
    "english": "Confirm local fruiting stock and provenance; no named cultivar is sourced.",
    "zu": "Qinisekisa izitshalo zendawo ezithela izithelo nokuthi zivelaphi; alukho uhlobo oluqanjwe igama olunomthombo.",
    "st": "Netefatsa dimela tsa lehae tse behang ditholwana le hore di tswa hokae; ha ho mofuta o bitsitsweng ka lebitso o nang le mohlodi.",
    "ts": "Tiyisisa swimilana swa ndhawu leswi tswalaka mihandzu ni laha swi humaka kona; a ku na muxaka lowu nga ni vito lowu sekeriweke eka xihlovo.",
    "ve": "Khwaṱhisedzani zwimela zwa henefho zwi aṋwaho mitshelo na hune zwa bva hone; a hu na lushaka lwo bulwaho nga dzina lu re na tshiko."
  },
  {
    "english": "Frost- and drought-hardy; establishment care still matters.",
    "zu": "Siyakwazi ukubekezelela isithwathwa nesomiso; ukunakekelwa ngesikhathi sisimama kusabalulekile.",
    "st": "Se mamella leqhwa le komello; tlhokomelo nakong ya ho mela e ntse e le bohlokwa.",
    "ts": "Xi tiyisela gwitsi ni dyandza; ku xi hlayisa loko xi sungula ku kula swa ha ri swa nkoka.",
    "ve": "Tshi konḓelela ṅwando na gomelelo; ndondolo ya musi tshi tshi thoma u aluwa i kha ḓi vha ya ndeme."
  },
  {
    "english": "Choose locally appropriate, correctly identified material; no named cultivar is sourced.",
    "zu": "Khetha izinto zokutshala ezifanele indawo nezikhonjwe kahle; alukho uhlobo oluqanjwe igama olunomthombo.",
    "st": "Kgetha thepa e tshwanelang sebaka e tsejwang ka nepo; ha ho mofuta o bitsitsweng ka lebitso o nang le mohlodi.",
    "ts": "Hlawula switirhisiwa leswi faneleke endhawini leswi tivekaka kahle; a ku na muxaka lowu nga ni vito lowu sekeriweke eka xihlovo.",
    "ve": "Nangani zwishumiswa zwo teaho henefho zwo ṱaluswaho zwavhuḓi; a hu na lushaka lwo bulwaho nga dzina lu re na tshiko."
  },
  {
    "english": "Ripe fruit pulp for fresh use or preserves.",
    "zu": "Inyama yezithelo ezivuthiwe yokudliwa isentsha noma yokulondolozwa.",
    "st": "Nama ya ditholwana tse butswitseng bakeng sa ho jewa e le foreshe kapa ho bolokwa.",
    "ts": "Nyama ya mihandzu leyi vupfeke yo dyiwa yi ri yintshwa kumbe ku hlayisiwa.",
    "ve": "Ṋama ya mitshelo yo vhibvaho ya u ḽiwa i mivhisi kana u vhulungwa."
  },
  {
    "english": "Growth is slower in cold or dry conditions. Seed oil is not presented here as cooking oil.",
    "zu": "Ukukhula kuhamba kancane ezimweni ezibandayo noma ezomile. Amafutha ezinhlamvu awethulwa lapha njengamafutha okupheka.",
    "st": "Kgolo e butle maemong a batang kapa a ommeng. Oli ya dipeo ha e hlahiswe mona e le oli ya ho pheha.",
    "ts": "Ku kula ka nonoka eka swiyimo swo titimela kumbe swo oma. Mafurha ya timbewu a ma nyikeriwi laha ku va mafurha yo sweka.",
    "ve": "U aluwa hu a lenga kha nyimele dzi rotholelaho kana dzo omaho. Mapfura a mbeu a ha ṋewi afha sa mapfura a u bika."
  },
  {
    "english": "Confirm local fruiting material; no named cultivar is sourced.",
    "zu": "Qinisekisa izinto zokutshala zendawo ezithela izithelo; alukho uhlobo oluqanjwe igama olunomthombo.",
    "st": "Netefatsa thepa ya lehae e behang ditholwana; ha ho mofuta o bitsitsweng ka lebitso o nang le mohlodi.",
    "ts": "Tiyisisa switirhisiwa swa ndhawu leswi tswalaka mihandzu; a ku na muxaka lowu nga ni vito lowu sekeriweke eka xihlovo.",
    "ve": "Khwaṱhisedzani zwishumiswa zwa henefho zwi aṋwaho mitshelo; a hu na lushaka lwo bulwaho nga dzina lu re na tshiko."
  },
  {
    "english": "Best in summer-rain areas with little frost; protect young trees in colder sites.",
    "zu": "Sisebenza kangcono ezindaweni ezinemvula yasehlobo nesithwathwa esincane; vikela izihlahla ezincane ezindaweni ezibandayo kakhulu.",
    "st": "Se sebetsa hantle dibakeng tse nang le pula hlabula le leqhwa le lenyane; sireletsa difate tse nyane dibakeng tse batang ho feta.",
    "ts": "Xi kula ku antswa eka tindhawu leti nga ni mpfula hi ximumu ni gwitsi ritsongo; sirhelela mirhi leyitsongo etindhawini leti titimelaka swinene.",
    "ve": "Tshi aluwa khwine kha madzingu a re na mvula tshilimo na ṅwando muṱuku; tsireledzani miri miṱuku kha fhethu hu rotholelaho nga maanḓa."
  },
  {
    "english": "Confirm local suitability and fruiting stock; no named cultivar is sourced.",
    "zu": "Qinisekisa ukufaneleka kwendawo nezitshalo ezithela izithelo; alukho uhlobo oluqanjwe igama olunomthombo.",
    "st": "Netefatsa ho tshwaneleha ha sebaka le dimela tse behang ditholwana; ha ho mofuta o bitsitsweng ka lebitso o nang le mohlodi.",
    "ts": "Tiyisisa ku faneleka ka ndhawu ni swimilana leswi tswalaka mihandzu; a ku na muxaka lowu nga ni vito lowu sekeriweke eka xihlovo.",
    "ve": "Khwaṱhisedzani u tea ha henefho na zwimela zwi aṋwaho mitshelo; a hu na lushaka lwo bulwaho nga dzina lu re na tshiko."
  },
  {
    "english": "Ripe berries.",
    "zu": "Amajikijolo avuthiwe.",
    "st": "Monokotshwai o butswitseng.",
    "ts": "Mihandzu leyitsongo leyi vupfeke.",
    "ve": "Mitshelo miṱuku yo vhibvaho."
  },
  {
    "english": "Water-loving: a dry site needs a dependable moisture source. Flowering for bees is not a honey-harvest forecast.",
    "zu": "Sithanda amanzi: indawo eyomile idinga umthombo womswakama othembekile. Ukuqhakaza okusetshenziswa yizinyosi akusona isibikezelo sokuvuna uju.",
    "st": "Se rata metsi: sebaka se ommeng se hloka mohlodi wa mongobo o tshepahalang. Ho thunya bakeng sa dinotshi ha se ponelopele ya kotulo ya mahe a dinotshi.",
    "ts": "Xi tsakela mati: ndhawu yo oma yi lava xihlovo xa ndzhongho lexi tiyisekaka. Ku huma swiluva leswi tirhisiwaka hi tinyoxi a hi mvhumbo wa ntshovelo wa vulombe.",
    "ve": "Tshi funa maḓi: fhethu ho omaho hu ṱoḓa tshiko tsha muṋo tshi fulufhedzeaho. U vha na maluvha a ṋotshi a si mvumbo ya u kaṋa mutoli."
  },
  {
    "english": "Choose a moist position and local provenance; no named cultivar is sourced.",
    "zu": "Khetha indawo enomswakama nezitshalo ezivela endaweni; alukho uhlobo oluqanjwe igama olunomthombo.",
    "st": "Kgetha sebaka se mongobo le dimela tse tswang sebakeng; ha ho mofuta o bitsitsweng ka lebitso o nang le mohlodi.",
    "ts": "Hlawula ndhawu leyi nga ni ndzhongho ni swimilana leswi humaka endhawini; a ku na muxaka lowu nga ni vito lowu sekeriweke eka xihlovo.",
    "ve": "Nangani fhethu hu re na muṋo na zwimela zwi bvaho henefho; a hu na lushaka lwo bulwaho nga dzina lu re na tshiko."
  },
  {
    "english": "Male and female plants are separate. Allow for the clump and sharp leaf bases.",
    "zu": "Izitshalo zesilisa nezesifazane zehlukene. Cabangela iqoqo lesitshalo nezisekelo zamaqabunga ezicijile.",
    "st": "Dimela tsa botona le botshehadi di arohane. Ela hloko sehlopha sa dikutu le metheo e bohale ya mahlaku.",
    "ts": "Swimilana swa xinuna ni swa xisati swi hambanile. Siya ndhawu ya ntlawa wa swirhabyana ni masungulo ya matluka lama tlhavaka.",
    "ve": "Zwimela zwa tshiduna na tshisadzi zwo fhambana. Sedzani tshikhala tsha tshitumbulwa na mitheo ya maṱari i ṱhavhaho."
  },
  {
    "english": "Confirm fruiting female stock and a male pollination source; no named cultivar is sourced.",
    "zu": "Qinisekisa izitshalo zesifazane ezithela izithelo nomthombo wesilisa wempova; alukho uhlobo oluqanjwe igama olunomthombo.",
    "st": "Netefatsa dimela tsa botshehadi tse behang ditholwana le mohlodi wa peo wa botona; ha ho mofuta o bitsitsweng ka lebitso o nang le mohlodi.",
    "ts": "Tiyisisa swimilana swa xisati leswi tswalaka mihandzu ni xihlovo xa xinuna xa mpova; a ku na muxaka lowu nga ni vito lowu sekeriweke eka xihlovo.",
    "ve": "Khwaṱhisedzani zwimela zwa tshisadzi zwi aṋwaho mitshelo na tshiko tsha tshiduna tsha luvhanda; a hu na lushaka lwo bulwaho nga dzina lu re na tshiko."
  },
  {
    "english": "Ripe fruit for preserves.",
    "zu": "Izithelo ezivuthiwe zokulondolozwa.",
    "st": "Ditholwana tse butswitseng tsa ho bolokwa.",
    "ts": "Mihandzu leyi vupfeke yo hlayisiwa.",
    "ve": "Mitshelo yo vhibvaho ya u vhulungwa."
  },
  {
    "english": "Provide climbing support. Tuberous roots are poisonous; children should not forage unsupervised.",
    "zu": "Faka izisekelo zokukhuphuka. Izimpande eziyizigaxa zinobuthi; izingane mazingazifuneli ukudla ngaphandle kokuqashwa.",
    "st": "Fana ka ditshehetso tsa ho hloa. Metso e kang dikotola e na le tjhefo; bana ba se ke ba ipatlela dijo tsa naheng ba sa behwa leihlo.",
    "ts": "Nyika swiseketelo swo khandziya. Timitsu ta swigaxa ti ni chefu; vana va nga lavi swakudya swa nhova handle ko langutisiwa.",
    "ve": "Ṋeani zwitikedzi zwa u gonya. Midzi ya khufhi i na mulimo; vhana vha songo ṱoḓa zwiḽiwa zwa ḓakani vha sa sedzwi."
  },
  {
    "english": "Use correctly identified local material; no named cultivar is sourced.",
    "zu": "Sebenzisa izinto zendawo ezikhonjwe kahle; alukho uhlobo oluqanjwe igama olunomthombo.",
    "st": "Sebedisa thepa ya lehae e tsejwang ka nepo; ha ho mofuta o bitsitsweng ka lebitso o nang le mohlodi.",
    "ts": "Tirhisa switirhisiwa swa ndhawu leswi tivekaka kahle; a ku na muxaka lowu nga ni vito lowu sekeriweke eka xihlovo.",
    "ve": "Shumisani zwishumiswa zwa henefho zwo ṱaluswaho zwavhuḓi; a hu na lushaka lwo bulwaho nga dzina lu re na tshiko."
  },
  {
    "english": "{existing} existing; {proposed} proposed. Products: {products}.",
    "zu": "Okukhona: {existing}; okuhleliwe: {proposed}. Okukhiqizwayo: {products}.",
    "st": "Tse teng: {existing}; tse rerilweng: {proposed}. Dihlahiswa: {products}.",
    "ts": "Leswi nga kona: {existing}; leswi pulaniweke: {proposed}. Swibveledzwa: {products}.",
    "ve": "Zwi re hone: {existing}; zwo dzudzanywaho: {proposed}. Zwibveledzwa: {products}."
  },
  {
    "english": "Buying advice: {advice}",
    "zu": "Iseluleko sokuthenga: {advice}",
    "st": "Keletso ya ho reka: {advice}",
    "ts": "Switsundzuxo swo xava: {advice}",
    "ve": "Nyeletshedzo ya u renga: {advice}"
  },
  {
    "english": "Production purchases and variety assumptions",
    "zu": "Ukuthengwa kokukhiqiza nezinhlobo ezicatshangelwe",
    "st": "Ditheko tsa tlhahiso le mefuta e nkilweng e le motheo",
    "ts": "Ku xava swa vuhumelerisi ni mixaka leyi tekiweke yi ri masungulo",
    "ve": "U renga zwa u bveledza na tshaka dzo humbulelwaho"
  },
  {
    "english": "Research checked 11 October 2026. Buy only proposed stock after checking local suitability. Existing plants and structures are inventory, not repeat purchases. Early/middle/late describes picking order; compatible flowering is a separate pollination check. Expected seasons describe established production, not guaranteed food this year.",
    "zu": "Ucwaningo lwahlolwa ngo-11 {month10} 2026. Thenga kuphela izitshalo noma izilwane ezihleliwe emva kokuhlola ukufaneleka kwendawo. Izitshalo nezakhiwo ezikhona ziyirekhodi lokukhona, akuzona ezizophinde zithengwe. Okokuqala/okuphakathi/okwakamuva kuchaza ukulandelana kokukha; ukuhambisana kokuqhakaza kuwukuhlola kwempova okuhlukile. Izikhathi ezilindelekile zichaza ukukhiqiza osekusimeme, akukhona ukudla okuqinisekisiwe kulo nyaka.",
    "st": "Patlisiso e hlahlobilwe ka 11 {month10} 2026. Reka feela dimela kapa diphoofolo tse rerilweng ka mora ho hlahloba ho tshwaneleha ha sebaka. Dimela le meaho e seng e le teng ke direkoto tsa thepa, ha se tse lokelang ho rekwa hape. Pele/bohareng/morao ho hlalosa tatellano ya ho kga; ho thunya ho dumellanang ke tlhahlobo e arohaneng ya ho tsamaisa peo. Dinako tse lebelletsweng di hlalosa tlhahiso e seng e tsitsitse, ha se dijo tse tiisitsweng selemong sena.",
    "ts": "Ndzavisiso wu kamberiwile hi 11 {month10} 2026. Xava ntsena swimilana kumbe swifuwo leswi pulaniweke endzhaku ko kambela ku faneleka endhawini. Swimilana ni miako leswi nga kona i nhundzu leyi rhekhodiweke, a hi leswi faneleke ku xaviwa nakambe. Ku sungula/xikarhini/ndzhaku swi hlamusela ku landzelana ka ku kha; ku huma swiluva loku fambisanaka i nkambelo wunwana wa mpova. Tinguva leti languteriweke ti hlamusela vuhumelerisi bya leswi se swi kurile, a ti tiyisisi swakudya lembe leri.",
    "ve": "Ṱhoḓisiso yo sedzuluswa nga 11 {month10} 2026. Rengani fhedzi zwimela kana zwifuwo zwo dzudzanywaho nga murahu ha u ṱola u tea henefho. Zwimela na zwifhaṱo zwi re hone ndi thundu yo rekhodiwaho, a si zwine zwa tea u rengululwa. U thoma/vhukati/murahu zwi ṱalutshedza u tevhekana ha u ka; u tshimbidzana ha maluvha ndi u ṱola luvhanda ho fhambanaho. Zwifhinga zwo lavhelelwaho zwi ṱalutshedza u bveledza ho no khwaṱhaho, a zwi fulufhedzisi zwiḽiwa ṅwaha uyu."
  },
  {
    "english": "Some research notes below remain in their original English. This purchasing section is not fully translated yet.",
    "zu": "Amanye amanothi ocwaningo angezansi asesesiNgisini sawo sokuqala. Lesi sigaba sokuthenga asikahunyushwa sonke.",
    "st": "Dintlha tse ding tsa patlisiso ka tlase di ntse di le Senyesemaneng sa tsona sa pele. Karolo ena ya ho reka ha e eso fetolelwe kaofela.",
    "ts": "Tinhlamuselo tinwana ta ndzavisiso laha hansi ta ha ri hi Xinghezi xa tona xo sungula. Xiyenge lexi xo xava a xi si hundzuluxiwa hinkwaxo.",
    "ve": "Dziṅwe ṱhalutshedzo dza ṱhoḓisiso afho fhasi dzi kha ḓi vha nga English yadzo ya u thoma. Tshipiḓa itshi tsha u renga a tshi athu ṱalutshedzwa tshoṱhe."
  },
  {
    "english": "Source: [{label}]({url})",
    "zu": "Umthombo: [{label}]({url})",
    "st": "Mohlodi: [{label}]({url})",
    "ts": "Xihlovo: [{label}]({url})",
    "ve": "Tshiko: [{label}]({url})"
  }
];
// First-crop drafts retain the full source qualification; they never calculate a new age.
export const PRODUCT_FIRST_CROP_COPY: readonly {english:string;zu:string;st:string;ts:string;ve:string}[] = [
  {
    "english": "Hluhluwe production-cycle reference: 18 months / 12 = 1.5 years. The source explicitly says cycle length varies greatly. Starting material, cultivar, weather and flower initiation matter; this is neither a universal first-harvest date nor a 12-month annual yield.",
    "zu": "Isikhombo somjikelezo wokukhiqiza e-Hluhluwe: izinyanga ezingu-18 / 12 = iminyaka engu-1.5. Umthombo usho ngokucacile ukuthi ubude bomjikelezo buhluka kakhulu. Impahla yokuqala, uhlobo, isimo sezulu nokuqala kokuqhakaza kubalulekile; lokhu akulona usuku lokuqala lokuvuna olusebenza yonke indawo noma isivuno sonyaka wezinyanga ezingu-12.",
    "st": "Tshupiso ya potoloho ya tlhahiso ya Hluhluwe: dikgwedi tse 18 / 12 = dilemo tse 1.5. Mohlodi o bolela ka ho hlaka hore bolelele ba potoloho bo fapana haholo. Thepa ya ho qala, mofuta, maemo a lehodimo le ho qala ha dipalesa di bohlokwa; sena ha se letsatsi la kotulo ya pele le sebetsang hohle kapa chai ya selemo sa dikgwedi tse 12.",
    "ts": "Xikombiso xa ndzhendzheleko wa vuhumelerisi eHluhluwe: tin’hweti ta 18 / 12 = malembe ya 1.5. Xihlovo xi vula hi ku kongoma leswaku ku leha ka ndzhendzheleko ku hambana swinene. Swilo swo sungula ku byala, muxaka, maxelo ni ku sungula ka swiluva i swa nkoka; lowu a hi nkarhi wa kotulo yo sungula lowu tirhaka hinkwako kumbe mbuyelo wa lembe ra tin’hweti ta 12.",
    "ve": "Tshiko tsha mutengelele wa u bveledza wa Hluhluwe: miṅwedzi ya 18 / 12 = miṅwaha ya 1.5. Tshiko tshi amba nga ho livhaho uri vhulapfu ha mutengelele vhu a fhambana nga maanḓa. Zwithu zwa u thoma ngazwo, lushaka, mutsho na u thoma ha maluvha ndi zwa ndeme; itshi a si tshifhinga tsha khaṋo ya u thoma tshi shumaho hoṱhe kana khaṋo ya ṅwaha wa miṅwedzi ya 12."
  },
  {
    "english": "First commercial cutting readiness at 12–18 months in the described Cape production system. The account discusses sowing and transfer to plantations but does not explicitly define whether the clock starts at sowing or planting out. Confirm starting stock and timing locally. This is tea-shoot establishment, not fruit-tree bearing.",
    "zu": "Ukulungela ukusikwa kokuqala kokudayisa ngezinyanga ezingu-12–18 ohlelweni lokukhiqiza lwase-Cape oluchaziwe. Incazelo ikhuluma ngokuhlwanyela nokudlulisela emasimini kodwa ayicacisi ukuthi isikhathi siqala ekuhlwanyeleni noma ekutshaleni ngaphandle. Qinisekisa impahla yokuqala nesikhathi endaweni. Lokhu ukusimama kwamahlumela etiye, akukhona ukuqala kokuthela kwesihlahla sezithelo.",
    "st": "Ho lokela ho sehwa la pele bakeng sa kgwebo ka dikgwedi tse 12–18 tsamaisong e hlalositsweng ya tlhahiso ya Cape. Tlhaloso e bua ka ho jala peo le ho fetisetsa masimong empa ha e hlalose ka ho hlaka hore nako e qala ha ho jalwa peo kapa ha ho jalwa kantle. Netefatsa thepa ya ho qala le nako sebakeng seo. Sena ke ho tsitsisa mahlomela a tee, ha se ho qala ho beha ha sefate sa ditholwana.",
    "ts": "Ku lunghekela ku tsemiwa ro sungula ka bindzu eka tin’hweti ta 12–18 eka sisiteme ya vuhumelerisi ya Cape leyi hlamuseriweke. Nhlamuselo yi bula hi ku byala mbewu ni ku yisa emasin’weni kambe a yi hlamuseli hi ku kongoma loko nkarhi wu sungula eku byaleni mbewu kumbe eku byaleni ehandle. Tiyisisa swibyariwa swo sungula ni nkarhi endhawini. Loku i ku simeka swihluke swa tiya, a hi ku tswala ka murhi wa mihandzu.",
    "ve": "U lugela u geriwa lwa u thoma kha zwa vhubindudzi nga miṅwedzi ya 12–18 kha maitele a u bveledza a Cape o ṱalutshedzwaho. Muvhigo u amba nga ha u zwala na u pfukisela masimuni fhedzi a u ṱalutshedzi nga ho livhaho uri tshifhinga tshi thoma musi hu tshi zwalwa kana hu tshi ṱavhiwa nnḓa. Khwaṱhisedzani zwithu zwa u thoma ngazwo na tshifhinga henefho. Izwi ndi u khwaṱhisa matavhi a tie, a si u aṋwa ha muri wa mitshelo."
  },
  {
    "english": "KZN typical first crop after planting, about 18 months. The same paragraph reports 9–11 months under favourable Makhathini Flats conditions. This is a typical regional reference, not a minimum or guarantee.",
    "zu": "Isivuno sokuqala esivamile e-KZN emva kokutshala, cishe izinyanga ezingu-18. Isigaba esifanayo sibika izinyanga ezingu-9–11 ezimweni ezinhle zase-Makhathini Flats. Lesi isikhombo sesifunda esivamile, akusona isikhathi esincane kunazo zonke noma isiqinisekiso.",
    "st": "Kotulo ya pele e tlwaelehileng KZN ka mora ho jala, hoo e ka bang dikgwedi tse 18. Serapa sona seo se tlaleha dikgwedi tse 9–11 tlasa maemo a matle a Makhathini Flats. Sena ke tshupiso e tlwaelehileng ya sebaka, ha se nako e nyenyane ka ho fetisisa kapa tiiso.",
    "ts": "Kotulo yo sungula leyi tolovelekeke eKZN endzhaku ko byala, kwalomu ka tin’hweti ta 18. Ndzimana yoleyo yi vika tin’hweti ta 9–11 ehansi ka swiyimo leswinene swa Makhathini Flats. Lexi i xikombiso lexi tolovelekeke xa xifundzha, a hi nkarhi lowutsongo swinene kumbe xitiyisiso.",
    "ve": "Khaṋo ya u thoma yo ḓoweleaho KZN nga murahu ha u ṱavha, hu ṱoḓaho u vha miṅwedzi ya 18. Phara yeneyo i vhiga miṅwedzi ya 9–11 kha nyimele dzavhuḓi dza Makhathini Flats. Itshi ndi tshiko tsho ḓoweleaho tsha dzingu, a si tshifhinga tshiṱukusa kana khwaṱhisedzo."
  },
  {
    "english": "Light cropping at about year 5 in the KZN guide, for irrigated areas with hot summers, cold winters and low growing-season humidity. It identifies dry Zululand/Lowveld river valleys as suitable regional areas. Propagation, cultivar and nursery age are not specified; this is a qualified general reference, not an expected farm quantity.",
    "zu": "Ukuthela okuncane cishe ngonyaka wesi-5 encwadini yase-KZN, ezindaweni eziniselwayo ezinehlobo elishisayo, ubusika obubandayo nomswakama ophansi ngesikhathi sokukhula. Ikhomba izigodi zemifula ezomile zase-Zululand/Lowveld njengezindawo zesifunda ezifanelekile. Indlela yokwandisa, uhlobo nobudala basenkulisa akucacisiwe; lesi isikhombo esijwayelekile esinemibandela, akulona inani elilindelekile epulazini.",
    "st": "Kotulo e nyenyane hoo e ka bang selemong sa 5 tataisong ya KZN, bakeng sa dibaka tse nosetswang tse nang le lehlabula le tjhesang, mariha a batang le mongobo o tlase nakong ya kgolo. E supa dikgohlo tse ommeng tsa dinoka tsa Zululand/Lowveld e le dibaka tse loketseng tsa sebaka. Mokgwa wa ho atisa, mofuta le dilemo tsa sethopo ha di a bolelwa; sena ke tshupiso e akaretsang e nang le dipehelo, ha se bongata bo lebelletsweng polasing.",
    "ts": "Ku tswala katsongo kwalomu ka lembe ra 5 eka nkongomiso wa KZN, eka tindhawu leti cheletiwaka leti nga ni ximumu xo hisa, xixika xo titimela ni ndzhongho lowutsongo hi nguva yo kula. Wu komba minkova yo oma ya milambu ya Zululand/Lowveld yi ri tindhawu leti faneleke ta xifundzha. Ndlela yo andzisa, muxaka ni vukhale bya ximilana enxaviselweni a swi vuriwanga; lexi i xikombiso xo angarhela lexi nga ni swipimelo, a hi nhlayo leyi languteriweke epurasini.",
    "ve": "U aṋwa zwiṱuku hu ṱoḓaho u vha kha ṅwaha wa 5 kha nyendedzi ya KZN, fhethu hu sheledzwaho hu re na tshilimo tshi fhisaho, vhuriha vhu rotholelaho na ṅukelo ya fhasi nga tshifhinga tsha u aluwa. I bula mikovhe yo omaho ya milambo ya Zululand/Lowveld sa madzingu o teaho. Maitele a u andisa, lushaka na miṅwaha ya tshimela fhethu ha zwiraba a zwo ngo bulwa; itshi ndi tshiko nga u angaredza tshi re na nyimele, a si tshivhalo tsho lavhelelwaho bulasini."
  },
  {
    "english": "KZN citrus guide; first crop means initial fruit, not full production. The same table gives an expected orchard lifespan of 23 years.",
    "zu": "Incwadi yezithelo ze-citrus yase-KZN; isivuno sokuqala sisho izithelo zokuqala, hhayi ukukhiqiza okugcwele. Ithebula elifanayo linikeza iminyaka engu-23 njengobude bempilo obulindelekile bensimu yezihlahla zezithelo.",
    "st": "Tataiso ya citrus ya KZN; kotulo ya pele e bolela ditholwana tsa pele, e seng tlhahiso e felletseng. Tafole yona eo e fana ka bophelo bo lebelletsweng ba serapa sa ditholwana ba dilemo tse 23.",
    "ts": "Nkongomiso wa citrus wa KZN; kotulo yo sungula yi vula mihandzu yo sungula, ku nga ri vuhumelerisi byo helela. Tafula rero ri nyika nkarhi wa ku hanya lowu languteriweke wa ntanga wa mihandzu wa malembe ya 23.",
    "ve": "Nyendedzi ya citrus ya KZN; khaṋo ya u thoma i amba mitshelo ya u thoma, hu si u bveledza ho fhelelaho. Thebulu yeneyo i ṋea miṅwaha ya 23 sa tshifhinga tsho lavhelelwaho tsha u tshila ha tsimu ya mitshelo."
  },
  {
    "english": "The source states at least three years. This is the earliest age, not a typical age or an upper limit; no later bound is supplied.",
    "zu": "Umthombo uthi okungenani iminyaka emithathu. Lobu ubudala bokuqala kakhulu, akubona ubudala obuvamile noma umkhawulo ongaphezulu; awukho umkhawulo wakamuva onikeziwe.",
    "st": "Mohlodi o bolela bonyane dilemo tse tharo. Ena ke nako ya pele ka ho fetisisa, ha se dilemo tse tlwaelehileng kapa moedi o ka hodimo; ha ho moedi wa morao o fanoeng.",
    "ts": "Xihlovo xi vula malembe manharhu kumbe ku hundza. Lebyi i vukhale byo sungula swinene, a hi vukhale byo toloveleka kumbe mpimo wa le henhla; a ku nyikiwanga mpimo wa nkarhi wa le ndzhaku.",
    "ve": "Tshiko tshi amba miṅwaha miraru kana u fhira. Iyi ndi miṅwaha ya u thoma nga maanḓa, a si miṅwaha yo ḓoweleaho kana mukano wa nṱha; a hu na mukano wa murahu wo ṋewaho."
  },
  {
    "english": "About years 4–5 in the KZN horticultural guide. Context is frost-free warm, humid subtropical production areas; cultivar, propagation age and field establishment are not specified. This is a first-crop reference, not a guaranteed local quantity or full-bearing age.",
    "zu": "Cishe iminyaka engu-4–5 encwadini yezolimo lwengadi yase-KZN. Isimo esichaziwe yizindawo ezingenasithwathwa, ezifudumele, ezinomswakama zesimo esiseduze nesasezindaweni ezishisayo; uhlobo, ubudala ngesikhathi sokwandiswa nokuqala ensimini akucacisiwe. Lesi isikhombo sesivuno sokuqala, akulona inani lasendaweni eliqinisekisiwe noma ubudala bokuthela ngokugcwele.",
    "st": "Hoo e ka bang dilemo tse 4–5 tataisong ya temo ya dirapa ya KZN. Maemo ke dibaka tse futhumetseng, tse mongobo tsa subtropical tse se nang serame se bakang leqhwa; mofuta, dilemo tsa ho atisa le ho tsitsisa tshimong ha di a bolelwa. Sena ke tshupiso ya kotulo ya pele, ha se bongata ba sebakeng seo bo tiisitsweng kapa dilemo tsa ho beha ka botlalo.",
    "ts": "Kwalomu ka malembe ya 4–5 eka nkongomiso wa horticulture wa KZN. Ndhawu leyi hlamuseriweke i ya vuhumelerisi bya subtropical byo kufumela ni ndzhongho leyi nga riki na gwitsi; muxaka, vukhale loko xi andzisiwa ni ku simekiwa ensin’weni a swi vuriwanga. Lexi i xikombiso xa kotulo yo sungula, a hi nhlayo ya laha kaya leyi tiyisisiweke kumbe vukhale bya ku tswala hi ku helela.",
    "ve": "Hu ṱoḓaho u vha miṅwaha ya 4–5 kha nyendedzi ya u lima zwiraba ya KZN. Nyimele ndi madzingu a u bveledza a subtropical a dudelaho a re na ṅukelo a si na ṅwando; lushaka, miṅwaha musi hu tshi andiswa na u khwaṱhisa tsimu a zwo ngo bulwa. Itshi ndi tshiko tsha khaṋo ya u thoma, a si tshivhalo tsha henefho tsho khwaṱhisedzwaho kana miṅwaha ya u aṋwa nga vhuḓalo."
  },
  {
    "english": "KZN establishment reference; this source also describes later bearing at higher elevations. Not a promise for all cultivars or every SA site.",
    "zu": "Isikhombo sokuqala ukukhula sase-KZN; lo mthombo uchaza nokuthela kamuva ezindaweni eziphakeme. Akusona isithembiso kuzo zonke izinhlobo noma kuyo yonke indawo yase-SA.",
    "st": "Tshupiso ya ho tsitsisa dimela ya KZN; mohlodi ona o boetse o hlalosa ho beha hamorao dibakeng tse phahameng. Ha se tshepiso bakeng sa mefuta yohle kapa sebaka se seng le se seng sa SA.",
    "ts": "Xikombiso xa ku simeka eKZN; xihlovo lexi xi tlhela xi hlamusela ku tswala endzhaku eka tindhawu leti tlakukeke. A hi xitshembiso eka mixaka hinkwato kumbe ndhawu yin’wana ni yin’wana ya SA.",
    "ve": "Tshiko tsha u khwaṱhisa zwimela tsha KZN; tshiko itshi tshi dovha tsha ṱalutshedza u aṋwa nga murahu fhethu hu re nṱha. A si fulufhedziso kha tshaka dzoṱhe kana fhethu hoṱhe ha SA."
  },
  {
    "english": "KZN guide reference for light cropping at year 3, in temperate apple conditions best adapted there to Dry Highland Sourveld. Rootstock, cultivar and nursery starting age are not specified. A named low-chill cultivar still needs adequate local winter chilling and establishment; this is not a warm-coast guarantee.",
    "zu": "Isikhombo sencwadi yase-KZN sokuthela okuncane ngonyaka wesi-3, ezimweni zama-apula zesimo esipholile ezifaneleka kakhulu lapho kuyi-Dry Highland Sourveld. Isiphunzi, uhlobo nobudala bokuqala basenkulisa akucacisiwe. Uhlobo olubiziwe oludinga amakhaza ambalwa lusadinga amakhaza anele ebusika endaweni nokusimama; lokhu akusona isiqinisekiso sogu olufudumele.",
    "st": "Tshupiso ya tataiso ya KZN ya kotulo e nyenyane selemong sa 3, maemong a diapole a phodileng a loketseng haholo Dry Highland Sourveld moo. Kutu ya motso, mofuta le dilemo tsa ho qala sethopong ha di a bolelwa. Mofuta o bitsitsweng ka lebitso o hlokang mohatsela o monyenyane o ntse o hloka mohatsela o lekaneng wa mariha sebakeng seo le ho tsitsisa; sena ha se tiiso bakeng sa lebopo le futhumetseng.",
    "ts": "Xikombiso xa nkongomiso wa KZN wa ku tswala katsongo eka lembe ra 3, eka swiyimo swa maapula swa maxelo yo ringanisela leswi faneleke swinene eDry Highland Sourveld kwalaho. Nsinya wa timitsu, muxaka ni vukhale byo sungula enxaviselweni a swi vuriwanga. Muxaka lowu boxiweke lowu lavaka ku titimela kutsongo wa ha lava ku titimela loku eneleke ka xixika endhawini ni ku simekiwa; lexi a hi xitiyisiso xa ribuwa ro kufumela.",
    "ve": "Tshiko tsha nyendedzi ya KZN tsha u aṋwa zwiṱuku kha ṅwaha wa 3, kha nyimele dza maapula dza fhethu hu rotholelaho dzi teaho nga maanḓa Dry Highland Sourveld henefho. Mudzi wa mutheo, lushaka na miṅwaha ya u thoma fhethu ha zwiraba a zwo ngo bulwa. Lushaka lwo bulwaho lu ṱoḓaho u rothola huṱuku lu kha ḓi ṱoḓa u rothola ha vhuriha ho eḓanaho henefho na u khwaṱhisa; itshi a si khwaṱhisedzo ya khunzikhunzi i dudelaho."
  },
  {
    "english": "Grafted mango stock in the KZN guide generally begins bearing after 3–4 years. Context is frost-free tropical/warm subtropical production with low humidity at flowering, including dry Zululand, Valley Bushveld and Lowveld. The text distinguishes grafted stock from seed-raised Peach/Sabre; do not apply this age to an unrecorded seedling or infer yearly kg.",
    "zu": "Izitshalo zomango ezixhunyelelwe encwadini yase-KZN ngokuvamile ziqala ukuthela emva kweminyaka engu-3–4. Isimo esichaziwe ukukhiqiza endaweni engenasithwathwa, eshisayo/efudumele eseduze nesimo sasezindaweni ezishisayo, enomswakama ophansi ngesikhathi sokuqhakaza, kuhlanganisa i-Zululand eyomile, i-Valley Bushveld ne-Lowveld. Umbhalo uhlukanisa izitshalo ezixhunyelelwe ne-Peach/Sabre ekhuliswe ngembewu; ungasebenzisi lobu budala esithombeni esingaqoshiwe noma ucabange ama-kg onyaka.",
    "st": "Ka tataiso ya KZN, dimela tsa mango tse hlomathisitsweng hangata di qala ho beha ka mora dilemo tse 3–4. Maemo ke tlhahiso ya tropical/subtropical e futhumetseng e se nang serame se bakang leqhwa, e nang le mongobo o tlase nakong ya dipalesa, ho akarelletsa Zululand e ommeng, Valley Bushveld le Lowveld. Mongolo o kgetholla dimela tse hlomathisitsweng ho Peach/Sabre e hodisitsweng ka peo; o se ke wa sebedisa dilemo tsena ho sethopo se sa ngolwang kapa wa hakanya kg tsa selemo.",
    "ts": "Swibyariwa swa mango leswi tlhomiweke eka nkongomiso wa KZN hi ntolovelo swi sungula ku tswala endzhaku ka malembe ya 3–4. Ndhawu leyi hlamuseriweke i ya vuhumelerisi bya tropical/subtropical byo kufumela leyi nga riki na gwitsi ni ndzhongho lowutsongo loko ku huma swiluva, ku katsa Zululand yo oma, Valley Bushveld ni Lowveld. Tsalwa ri hambanisa swibyariwa leswi tlhomiweke ni Peach/Sabre leyi kurisiweke hi mbewu; u nga tirhisi vukhale byebyo eka ximilana xa mbewu lexi nga rhekhodiwangiki kumbe u kumbetela kg ta lembe.",
    "ve": "Zwimela zwa mango zwo ṱumetshedzwaho kha nyendedzi ya KZN nga u ḓowela zwi thoma u aṋwa nga murahu ha miṅwaha ya 3–4. Nyimele ndi u bveledza kha tropical/subtropical hu dudelaho hu si na ṅwando na ṅukelo ya fhasi nga tshifhinga tsha maluvha, hu tshi katelwa Zululand ho omaho, Valley Bushveld na Lowveld. Maṅwalwa a fhambanyisa zwimela zwo ṱumetshedzwaho na Peach/Sabre yo aluwaho nga mbeu; ni songo shumisa miṅwaha iyi kha tshimela tsha mbeu tshi songo rekhodiwaho kana u humbulela kg dza ṅwaha."
  },
  {
    "english": "The 6–12-month reference concerns the first leaf harvest after planting. Flowers and pods are normally produced during the second year of growth in the same North West guide. Leaf readiness does not establish pod production or picking months.",
    "zu": "Isikhombo sezinyanga ezingu-6–12 siphathelene nokuvunwa kokuqala kwamaqabunga emva kokutshala. Izimbali nama-pod ngokuvamile kukhiqizwa ngonyaka wesibili wokukhula encwadini efanayo yase-North West. Ukulungela kwamaqabunga akusho ukukhiqiza ama-pod noma izinyanga zokuwakha.",
    "st": "Tshupiso ya dikgwedi tse 6–12 e mabapi le kotulo ya pele ya mahlaku ka mora ho jala. Dipalesa le diphotlwa hangata di hlahiswa selemong sa bobedi sa kgolo tataisong yona eo ya North West. Ho lokela ha mahlaku ha ho tiise tlhahiso ya diphotlwa kapa dikgwedi tsa ho di kga.",
    "ts": "Xikombiso xa tin’hweti ta 6–12 xi khumba kotulo yo sungula ya matluka endzhaku ko byala. Swiluva ni tinyawa ta kona hi ntolovelo swi humesiwa eka lembe ra vumbirhi ra ku kula eka nkongomiso wolowo wa North West. Ku lungheka ka matluka a ku tiyisisi vuhumelerisi bya tinyawa kumbe tin’hweti ta ku ti kha.",
    "ve": "Tshiko tsha miṅwedzi ya 6–12 tshi amba khaṋo ya u thoma ya maṱari nga murahu ha u ṱavha. Maluvha na khavhi nga u ḓowela zwi bveledzwa kha ṅwaha wa vhuvhili wa u aluwa kha nyendedzi yeneyo ya North West. U lugela ha maṱari a hu khwaṱhisedzi u bveledza khavhi kana miṅwedzi ya u ka."
  },
  {
    "english": "KZN DARD explicitly states the planting-to-harvest and harvest-to-harvest range. Converted months to years (13/12 to 20/12). This is not a dated forecast or an annual all-month harvest window.",
    "zu": "I-KZN DARD isho ngokucacile ibanga lesikhathi kusukela ekutshaleni kuya ekuvuneni nokusukela ekuvuneni kuya ekuvuneni okulandelayo. Izinyanga ziguqulwe zaba iminyaka (13/12 kuya ku-20/12). Lokhu akusona isibikezelo esinedethi noma isikhathi sokuvuna sonyaka sezinyanga zonke.",
    "st": "KZN DARD e bolela ka ho hlaka nako ho tloha ho jaleng ho ya kotulong le ho tloha kotulong ho ya kotulong. Dikgwedi di fetotswe ho ba dilemo (13/12 ho ya ho 20/12). Sena ha se ponelopele e nang le letsatsi kapa nako ya kotulo ya selemo dikgweding tsohle.",
    "ts": "KZN DARD yi vula hi ku kongoma mpimo wa nkarhi wa ku suka eku byaleni ku ya eku kotuleni ni ku suka eka kotulo ku ya eka kotulo. Tin’hweti ti hundzuriwile ti va malembe (13/12 ku ya eka 20/12). Lexi a hi mvhumbo wa masiku kumbe nguva ya kotulo ya lembe eka tin’hweti hinkwato.",
    "ve": "KZN DARD i bula nga ho livhaho tshifhinga u bva kha u ṱavha u ya kha khaṋo na u bva kha khaṋo u ya kha iṅwe. Miṅwedzi yo shandulwa ya vha miṅwaha (13/12 u ya kha 20/12). Itshi a si mbonelaphanḓa i re na datumu kana tshifhinga tsha khaṋo ya ṅwaha kha miṅwedzi yoṱhe."
  },
  {
    "english": "KZN reference: 6–8 months after transplanting, about 0.5–0.67 years. This is a first-harvest interval, not a regional picking calendar.",
    "zu": "Isikhombo sase-KZN: izinyanga ezingu-6–8 emva kokutshala izithombo, cishe iminyaka engu-0.5–0.67. Lesi isikhathi esiphakathi kokutshala nokuvuna kokuqala, akulona ikhalenda lokukha lesifunda.",
    "st": "Tshupiso ya KZN: dikgwedi tse 6–8 ka mora ho jala dithopo, hoo e ka bang dilemo tse 0.5–0.67. Ena ke nako pele ho kotulo ya pele, ha se khalendara ya ho kga ya sebaka.",
    "ts": "Xikombiso xa KZN: tin’hweti ta 6–8 endzhaku ko hundzisela swibyariwa, kwalomu ka malembe ya 0.5–0.67. Lowu i nkarhi wo ya eka kotulo yo sungula, a hi khalendara ya ku kha ya xifundzha.",
    "ve": "Tshiko tsha KZN: miṅwedzi ya 6–8 nga murahu ha u ṱavhulula, hu ṱoḓaho u vha miṅwaha ya 0.5–0.67. Itshi ndi tshifhinga u ya kha khaṋo ya u thoma, a si khalenda ya u ka ya dzingu."
  },
  {
    "english": "Bruyns Hill, Natal Midlands bioclimatic group 2; irrigated Hass on clonal Duke 7 rootstock, 7 x 7 m (200 trees/ha), planted 1982–1984. The paper reports Hass starting in its second season and Fuerte in its third. The two-to-three-year reference describes those trial cultivars, not every avocado or nursery starting age.",
    "zu": "Bruyns Hill, iqembu lesimo sezulu nokuphila lase-Natal Midlands lesi-2; i-Hass eniselwayo esiphunzini se-Duke 7 esiphindwe ngendlela ye-clone, 7 x 7 m (izihlahla ezingu-200/ha), yatshalwa ngo-1982–1984. Iphepha libika ukuthi i-Hass yaqala ngesizini yayo yesibili ne-Fuerte ngeyesithathu. Isikhombo seminyaka emibili kuya kwemithathu sichaza lezo zinhlobo ezavivinywa, hhayi wonke ama-avocado noma ubudala bokuqala basenkulisa.",
    "st": "Bruyns Hill, sehlopha sa bioclimatic sa Natal Midlands sa 2; Hass e nosetswang kutung ya motso ya clone ya Duke 7, 7 x 7 m (difate tse 200/ha), e jadilweng ka 1982–1984. Pampiri e tlaleha hore Hass e qalile nakong ya yona ya bobedi mme Fuerte ya qala nakong ya boraro. Tshupiso ya dilemo tse pedi ho isa ho tse tharo e hlalosa mefuta eo ya teko, e seng avocado e nngwe le e nngwe kapa dilemo tsa ho qala sethopong.",
    "ts": "Bruyns Hill, ntlawa wa bioclimatic wa Natal Midlands wa 2; Hass leyi cheletiwaka eka nsinya wa timitsu wa clone wa Duke 7, 7 x 7 m (mirhi ya 200/ha), yi byariwe hi 1982–1984. Papila ri vika leswaku Hass yi sungule eka nguva ya yona ya vumbirhi ni Fuerte eka ya vunharhu. Xikombiso xa malembe mambirhi ku ya eka manharhu xi hlamusela mixaka yoleyo ya ndzingo, ku nga ri avocado yin’wana ni yin’wana kumbe vukhale byo sungula enxaviselweni.",
    "ve": "Bruyns Hill, tshigwada tsha bioclimatic tsha Natal Midlands tsha 2; Hass yo sheledzwaho kha mudzi wa mutheo wa clone wa Duke 7, 7 x 7 m (miri ya 200/ha), yo ṱavhiwaho nga 1982–1984. Bammbiri ḽi vhiga uri Hass yo thoma kha tshifhinga tshayo tsha vhuvhili na Fuerte kha tsha vhuraru. Tshiko tsha miṅwaha mivhili u ya kha miraru tshi ṱalutshedza tshaka dzenedzo dza ndingo, hu si avocado iṅwe na iṅwe kana miṅwaha ya u thoma fhethu ha zwiraba."
  },
  {
    "english": "General KZN peach guide; the section identifies Muden, Middelrus and Weenen river valleys as low-chill growing areas. Confirm the cultivar and nursery starting age.",
    "zu": "Incwadi ejwayelekile yamapentshisi yase-KZN; lesi sigaba sikhomba izigodi zemifula zase-Muden, Middelrus nase-Weenen njengezindawo zokukhula ezidinga amakhaza ambalwa. Qinisekisa uhlobo nobudala bokuqala basenkulisa.",
    "st": "Tataiso e akaretsang ya diperekisi ya KZN; karolo ena e supa dikgohlo tsa dinoka tsa Muden, Middelrus le Weenen e le dibaka tsa ho lema tse hlokang mohatsela o monyenyane. Netefatsa mofuta le dilemo tsa ho qala sethopong.",
    "ts": "Nkongomiso wo angarhela wa maperekisi wa KZN; xiyenge xi komba minkova ya milambu ya Muden, Middelrus ni Weenen yi ri tindhawu to byala leti lavaka ku titimela kutsongo. Tiyisisa muxaka ni vukhale byo sungula enxaviselweni.",
    "ve": "Nyendedzi nga u angaredza ya maperegisi ya KZN; tshipiḓa itshi tshi bula mikovhe ya milambo ya Muden, Middelrus na Weenen sa fhethu ha u ṱavha hu ṱoḓaho u rothola huṱuku. Khwaṱhisedzani lushaka na miṅwaha ya u thoma fhethu ha zwiraba."
  },
  {
    "english": "Stated for African Delight® specifically, an ARC-bred Japanese plum cultivar; 'third growth season' interpreted as year 3.",
    "zu": "Kushiwo nge-African Delight® kuphela, uhlobo lweplamu lwase-Japan olwakhiwa yi-ARC; “isizini yesithathu yokukhula” ithathwe njengonyaka wesi-3.",
    "st": "Ho boletswe ka African Delight® feela, mofuta wa plum ya Japanese o hlahisitsweng ke ARC; “nako ya boraro ya kgolo” e hlalositswe e le selemo sa 3.",
    "ts": "Swi vuriwe hi African Delight® ntsena, muxaka wa Japanese plum lowu humesiweke hi ARC; “nguva ya vunharhu ya ku kula” yi tekiwe yi ri lembe ra 3.",
    "ve": "Zwo bulwa nga African Delight® fhedzi, lushaka lwa Japanese plum lwo bveledzwaho nga ARC; “tshifhinga tsha vhuraru tsha u aluwa” tsho dzhiiwa sa ṅwaha wa 3."
  },
  {
    "english": "International ICRAF reference for clonally propagated stock only: trees often begin bearing during the first year after planting. The seedling timing in the source concerns flowering, so no seed-grown first fruit age is assigned. This is not confirmed for South African sites.",
    "zu": "Isikhombo samazwe ngamazwe se-ICRAF sezitshalo ezandiswe njenge-clone kuphela: izihlahla zivame ukuqala ukuthela ngonyaka wokuqala emva kokutshala. Isikhathi sezithombo emthonjeni siphathelene nokuqhakaza, ngakho abukho ubudala bezithelo zokuqala obabelwe izitshalo ezikhuliswe ngembewu. Lokhu akuqinisekisiwe ezindaweni zaseNingizimu Afrika.",
    "st": "Tshupiso ya matjhaba ya ICRAF bakeng sa dimela tse atisitsweng ka clone feela: hangata difate di qala ho beha selemong sa pele ka mora ho jala. Nako ya dithopo mohloding e mabapi le dipalesa, kahoo ha ho dilemo tsa ditholwana tsa pele tse abetsweng dimela tse hodisitsweng ka peo. Sena ha se a tiisetswa dibakeng tsa Afrika Borwa.",
    "ts": "Xikombiso xa matiko xa ICRAF xa swibyariwa leswi andzisiweke hi clone ntsena: mirhi yi tala ku sungula ku tswala eka lembe ro sungula endzhaku ko byala. Nkarhi wa swimilana swa mbewu eka xihlovo wu khumba ku huma swiluva, kutani a ku vekiwanga vukhale bya mihandzu yo sungula eka leswi kurisiweke hi mbewu. Lexi a xi tiyisisiwanga eka tindhawu ta Afrika Dzonga.",
    "ve": "Tshiko tsha mashango tsha ICRAF tsha zwimela zwo andiswaho nga clone fhedzi: miri i anzela u thoma u aṋwa kha ṅwaha wa u thoma nga murahu ha u ṱavha. Tshifhinga tsha zwimela zwa mbeu kha tshiko tshi amba maluvha, ngauralo a hu na miṅwaha ya mitshelo ya u thoma yo avhelwaho zwimela zwo aluwaho nga mbeu. Izwi a zwo ngo khwaṱhisedzwa kha fhethu ha Afrika Tshipembe."
  },
  {
    "english": "The review attributes this 3–5-year age to Avakoudjo et al.'s study in Benin, West Africa, rather than a South African bearing trial. Propagation method and local conditions must be confirmed before using it at a South African site; it is not a locally validated age or a yield-by-age curve.",
    "zu": "Ukubuyekezwa kubeka lobu budala beminyaka engu-3–5 ocwaningweni luka-Avakoudjo et al. e-Benin, eNtshonalanga Afrika, hhayi esivivinyweni sokuthela saseNingizimu Afrika. Indlela yokwandisa nezimo zendawo kufanele kuqinisekiswe ngaphambi kokusebenzisa lesi sikhombo endaweni yaseNingizimu Afrika; akubona ubudala obuqinisekisiwe endaweni noma igrafu yesivuno ngokobudala.",
    "st": "Tlhahlobo e amahanya dilemo tsena tse 3–5 le thuto ya Avakoudjo et al. naheng ya Benin, Afrika Bophirimela, e seng teko ya ho beha Afrika Borwa. Mokgwa wa ho atisa le maemo a sebaka di lokela ho netefatswa pele e sebediswa sebakeng sa Afrika Borwa; ha se dilemo tse netefaditsweng sebakeng seo kapa mothalo wa chai ho ya ka dilemo.",
    "ts": "Nkambisiso wu hlanganisa vukhale byebyo bya malembe ya 3–5 ni ndzavisiso wa Avakoudjo et al. eBenin, Afrika Vupeladyambu, ku nga ri ndzingo wa ku tswala wa Afrika Dzonga. Ndlela yo andzisa ni swiyimo swa ndhawu swi fanele ku tiyisisiwa ku nga si tirhisiwa endhawini ya Afrika Dzonga; a hi vukhale byo tiyisisiwa endhawini kumbe girafu ya mbuyelo hi vukhale.",
    "ve": "Tsedzuluso i livhisa miṅwaha iyi ya 3–5 kha ngudo ya Avakoudjo et al. ngei Benin, Afrika Vhukovhela, hu si ndingo ya u aṋwa ya Afrika Tshipembe. Maitele a u andisa na nyimele dza henefho zwi tea u khwaṱhisedzwa musi zwi sa athu shumiswa fhethu ha Afrika Tshipembe; iyi a si miṅwaha yo khwaṱhisedzwaho henefho kana girafu ya khaṋo u ya nga miṅwaha."
  },
  {
    "english": "The USDA FAS industry reference concerns fruit of export quality after up to two to three years. Earlier light fruiting is not excluded; this is not a guaranteed first harvest date.",
    "zu": "Isikhombo semboni se-USDA FAS siphathelene nezithelo ezisezingeni lokuthekelisa emva kwesikhathi esingafika eminyakeni emibili kuya kwemithathu. Ukuthela okuncane ngaphambi kwalokho akukhishelwanga ngaphandle; lokhu akulona usuku lwesivuno sokuqala oluqinisekisiwe.",
    "st": "Tshupiso ya indasteri ya USDA FAS e mabapi le ditholwana tsa boleng ba ho romelwa kantle ka mora nako e ka fihlang dilemong tse pedi ho isa ho tse tharo. Ho beha ho honyenyane pele ho moo ha ho qhelelwe ka thoko; sena ha se letsatsi la kotulo ya pele le tiisitsweng.",
    "ts": "Xikombiso xa indasitiri xa USDA FAS xi khumba mihandzu ya xiyimo xo rhumela ematikweni ya le handle endzhaku ka nkarhi lowu fikaka eka malembe mambirhi ku ya eka manharhu. Ku tswala katsongo ka le mahlweni a ku siyiwi ehandle; lexi a hi siku ra kotulo yo sungula leri tiyisisiweke.",
    "ve": "Tshiko tsha ndowetshumo tsha USDA FAS tshi amba mitshelo ya khwaḽithi ya u rumela mashangoni nga murahu ha tshifhinga tshi swikaho kha miṅwaha mivhili u ya kha miraru. U aṋwa zwiṱuku nga phanḓa a zwo ngo bviswa; itshi a si ḓuvha ḽa khaṋo ya u thoma ḽo khwaṱhisedzwaho."
  },
  {
    "english": "First crop reference: {age}. {note} Actual timing depends on variety and site care.",
    "zu": "Isikhombo sesivuno sokuqala: {age}. {note} Isikhathi sangempela sincike ohlotsheni nasekunakekelweni kwendawo.",
    "st": "Tshupiso ya kotulo ya pele: {age}. {note} Nako ya nnete e itshetlehile ka mofuta le tlhokomelo ya sebaka.",
    "ts": "Xikombiso xa kotulo yo sungula: {age}. {note} Nkarhi wa xiviri wu titshege hi muxaka ni nhlayiso wa ndhawu.",
    "ve": "Tshiko tsha khaṋo ya u thoma: {age}. {note} Tshifhinga tsha vhukuma tshi ya nga lushaka na ṱhogomelo ya fhethu."
  },
  {
    "english": "Check the source conditions and starting stock.",
    "zu": "Hlola izimo zomthombo nezitshalo zokuqala.",
    "st": "Hlahloba maemo a mohlodi le dimela tsa ho qala.",
    "ts": "Kambela swiyimo swa xihlovo ni swibyariwa swo sungula.",
    "ve": "Ṱolani nyimele dza tshiko na zwimela zwa u thoma ngazwo."
  },
  {
    "english": "Time to first crop: not sourced; do not rely on newly planted stock for immediate food.",
    "zu": "Isikhathi sesivuno sokuqala: asitholakali emthonjeni; ungathembeli ezitshalweni ezisanda kutshalwa ukuze uthole ukudla ngokushesha.",
    "st": "Nako ya kotulo ya pele: ha e a fumanwa mohloding; o se ke wa itshetleha ka dimela tse sa tswa jalwa bakeng sa dijo hanghang.",
    "ts": "Nkarhi wa kotulo yo sungula: a wu kumekanga eka xihlovo; u nga titshegi hi swimilana leswi swa ha ku byariwaka leswaku u kuma swakudya hi ku hatlisa.",
    "ve": "Tshifhinga tsha khaṋo ya u thoma: a tsho ngo wanala tshikoni; ni songo ḓitika nga zwimela zwi sa athu bva u ṱavhiwa uri ni wane zwiḽiwa nga u ṱavhanya."
  },
  {
    "english": "{age} months",
    "zu": "izinyanga ezingu-{age}",
    "st": "dikgwedi tse {age}",
    "ts": "tin’hweti ta {age}",
    "ve": "miṅwedzi ya {age}"
  },
  {
    "english": "{age} years",
    "zu": "iminyaka engu-{age}",
    "st": "dilemo tse {age}",
    "ts": "malembe ya {age}",
    "ve": "miṅwaha ya {age}"
  }
];
// Source results stay qualified: a translation must never turn a trial figure into an annual promise.
export const PRODUCT_YIELD_COPY: readonly {english:string;zu:string;st:string;ts:string;ve:string}[] = [
  {
    "english": "Full production around years 12–13 in the general KZN guide. Cultivar, propagation, density and management affect actual output; mature ages do not automatically create an annual kg/tree curve.",
    "zu": "Ukukhiqiza okugcwele cishe ngeminyaka engu-12–13 encwadini ejwayelekile yase-KZN. Uhlobo olukhethiwe, indlela yokwandisa, ukuminyana nokuphathwa kuthinta ukukhiqiza kwangempela; ubudala bokuvuthwa abuzakheli ngokuzenzakalela igrafu yama-kg ngesihlahla ngonyaka.",
    "st": "Tlhahiso e felletseng hoo e ka bang dilemong tse 12–13 tataisong e akaretsang ya KZN. Mofuta o kgethilweng, ho atisa, bongata ba dimela sebakeng le taolo di ama tlhahiso ya nnete; dilemo tsa ho hola ka botlalo ha di iketsetse mothalo wa kg ka sefate ka selemo.",
    "ts": "Vuhumelerisi byo helela kwalomu ka lembe ra 12–13 eka nkongomiso wo angarhela wa KZN. Muxaka, ku andzisa, ku tala ka swimilana endhawini ni mafambiselo swi khumba vuhumelerisi bya xiviri; vukhale bya ku kula hi ku helela a byi endli girafu ya kg hi murhi hi lembe hi byoxe.",
    "ve": "U bveledza ho fhelelaho hu ṱoḓaho u vha kha miṅwaha ya 12–13 kha nyendedzi nga u angaredza ya KZN. Lushaka, u andisa, tshivhalo tsha zwimela fhethu na ndangulo zwi kwama zwibveledzwa zwa vhukuma; miṅwaha ya u hula a i ḓi iteli girafu ya kg nga muri nga ṅwaha."
  },
  {
    "english": "Calculated orchard-average equivalent using the KZN guide's likely production of 50 t/ha and midpoint planting spacings: cool KZN Midlands, 5.75 x 2.75 m, about 79 kg/tree; hot areas, 7.5 x 3.5 m, about 131 kg/tree. Calculation: 50,000 kg/ha x m²/tree / 10,000 m²/ha. These values are derived, not measured individual-tree yields. The spread reflects spacing, not varieties or a production-by-age curve. Confirm local orchard yield and actual spacing before using this reference.",
    "zu": "Isilinganiso sensimu yezihlahla zezithelo sibalwe kusetshenziswa ukukhiqiza okungenzeka okungu-50 t/ha okusencwadini yase-KZN nezikhala eziphakathi nendawo zamabanga okutshala: e-KZN Midlands epholile, 5.75 x 2.75 m, cishe 79 kg/tree; ezindaweni ezishisayo, 7.5 x 3.5 m, cishe 131 kg/tree. Ukubala: 50,000 kg/ha x m²/tree / 10,000 m²/ha. La manani abalwe, awazona izivuno zesihlahla ngasinye ezilinganisiwe. Umehluko ukhombisa izikhala zokutshala, hhayi izinhlobo noma igrafu yokukhiqiza ngokobudala. Qinisekisa isivuno sendawo sensimu nezikhala zangempela ngaphambi kokusebenzisa lesi sikhombo.",
    "st": "Ho badilwe tekano ya karolelano ya serapa sa ditholwana ho sebediswa tlhahiso e ka bang 50 t/ha tataisong ya KZN le bohareng ba dibaka pakeng tsa dimela: KZN Midlands e phodileng, 5.75 x 2.75 m, hoo e ka bang 79 kg/tree; dibakeng tse tjhesang, 7.5 x 3.5 m, hoo e ka bang 131 kg/tree. Palo: 50,000 kg/ha x m²/tree / 10,000 m²/ha. Dipalo tsena di balilwe, ha se chai ya sefate ka seng e lekantsweng. Phapang e bontsha sebaka pakeng tsa dimela, e seng mefuta kapa mothalo wa tlhahiso ho ya ka dilemo. Netefatsa chai ya serapa sa sebakeng seo le sebaka sa nnete pakeng tsa dimela pele o sebedisa tshupiso ena.",
    "ts": "Ku hlayiwe mpimo lowu ringanaka ni avhareji ya ntanga wa mihandzu hi ku tirhisa vuhumelerisi bya 50 t/ha byi nga ha vaka kona eka nkongomiso wa KZN ni swipimelo swa le xikarhini swa mpfhuka wo byala: KZN Midlands leyi titimelaka, 5.75 x 2.75 m, kwalomu ka 79 kg/tree; tindhawu to hisa, 7.5 x 3.5 m, kwalomu ka 131 kg/tree. Nhlayo: 50,000 kg/ha x m²/tree / 10,000 m²/ha. Mimpimo leyi yi hlayeriwile, a hi mimbuyelo leyi pimiweke ya murhi wun’wana ni wun’wana. Ku hambana ku komba mpfhuka wo byala, ku nga ri mixaka kumbe girafu ya vuhumelerisi hi vukhale. Tiyisisa mbuyelo wa ntanga wa laha kaya ni mpfhuka wa xiviri wo byala u nga si tirhisa nkombiso lowu.",
    "ve": "Ho vhalwa ndinganyelo i linganaho na ya tsimu ya mitshelo nga u shumisa u bveledza hu nga vha 50 t/ha kha nyendedzi ya KZN na vhukati ha zwikhala zwa u ṱavha: KZN Midlands hu rotholelaho, 5.75 x 2.75 m, hu ṱoḓaho u vha 79 kg/tree; fhethu hu fhisaho, 7.5 x 3.5 m, hu ṱoḓaho u vha 131 kg/tree. U vhala: 50,000 kg/ha x m²/tree / 10,000 m²/ha. Tshivhalo itshi tsho bva kha u vhala, a si khaṋo yo kaliwaho ya muri muṅwe na muṅwe. Phambano i sumbedza zwikhala, hu si tshaka kana girafu ya u bveledza u ya nga miṅwaha. Khwaṱhisedzani khaṋo ya tsimu ya henefho na zwikhala zwa vhukuma musi ni sa athu shumisa tshiko itshi."
  },
  {
    "english": "USDA FAS describes commercial maturity at 7–9 years while yields can continue increasing for a further 15–20 years. This does not establish a stable maximum-yield age.",
    "zu": "I-USDA FAS ichaza ukuvuthwa kokukhiqiza kokudayisa ngeminyaka engu-7–9 kuyilapho izivuno zingaqhubeka zikhula eminye iminyaka engu-15–20. Lokhu akubeki ubudala obusimeme besivuno esiphezulu kunazo zonke.",
    "st": "USDA FAS e hlalosa ho hola bakeng sa tlhahiso ya kgwebo dilemong tse 7–9 ha chai e ka tswela pele ho eketseha ka dilemo tse ding tse 15–20. Sena ha se netefatse dilemo tse tsitsitseng tsa chai e phahameng ka ho fetisisa.",
    "ts": "USDA FAS yi hlamusela ku kula ka vuhumelerisi bya bindzu eka lembe ra 7–9 kasi mimbuyelo yi nga ya mahlweni yi engeteleka ku ringana ni man’wana ya 15–20 wa malembe. Lexi a xi veki vukhale byo tshamiseka bya mbuyelo wa le henhla swinene.",
    "ve": "USDA FAS i ṱalutshedza u hula ha zwa vhubindudzi kha miṅwaha ya 7–9 ngeno khaṋo i tshi nga bvela phanḓa na u engedzea kha miṅwaha miṅwe ya 15–20. Izwi a zwi khwaṱhisedzi miṅwaha yo dzikaho ya khaṋo khulwanesa."
  },
  {
    "english": "Full production at year 7 in this general KZN guide. No per-tree output at that age is stated, and rootstock, cultivar and management can change bearing. The four Langkloof budgets are separate regional planning assumptions, not measured confirmation of this generic age.",
    "zu": "Ukukhiqiza okugcwele ngonyaka wesi-7 kule ncwadi ejwayelekile yase-KZN. Akukho nani lokukhiqiza ngesihlahla elishiwo kulobu budala, futhi isiphunzi, uhlobo nokuphathwa kungashintsha ukuthela. Izabelomali ezine zase-Langkloof ziyizinto ezicatshangelwe zokuhlela zesifunda ezihlukene, azisona isiqinisekiso esilinganisiwe salobu budala obujwayelekile.",
    "st": "Tlhahiso e felletseng selemong sa 7 tataisong ena e akaretsang ya KZN. Ha ho tlhahiso ka sefate e boletsweng dilemong tseo, mme kutu ya motso, mofuta le taolo di ka fetola ho beha. Ditekanyetso tsa ditjhelete tse nne tsa Langkloof ke dikakanyo tse arohaneng tsa moralo wa sebaka, e seng tiiso e lekantsweng ya dilemo tsena tse akaretsang.",
    "ts": "Vuhumelerisi byo helela eka lembe ra 7 eka nkongomiso lowu wo angarhela wa KZN. A ku vuriwanga vuhumelerisi bya murhi wun’we eka vukhale byebyo, naswona nsinya wa timitsu, muxaka ni mafambiselo swi nga cinca ku tswala. Mpimanyeto wa mune wa mali wa Langkloof i leswi tekiweke swi ri masungulo yo pulana ya xifundzha leswi hambaneke, a hi xitiyisiso lexi pimiweke xa vukhale byebyo byo angarhela.",
    "ve": "U bveledza ho fhelelaho kha ṅwaha wa 7 kha nyendedzi iyi nga u angaredza ya KZN. A hu na zwibveledzwa nga muri zwo bulwaho kha miṅwaha yeneyo, nahone mudzi wa mutheo, lushaka na ndangulo zwi nga shandula u aṋwa. Mikovhelo ya masheleni miṋa ya Langkloof ndi mihumbulo yo fhambanaho ya u pulana ya dzingu, a si khwaṱhisedzo yo kaliwaho ya miṅwaha iyi nga u angaredza."
  },
  {
    "english": "The KZN guide states full bearing within 18 months. This is an upper timing reference, not a promise of annual food kilograms.",
    "zu": "Incwadi yase-KZN ithi ukuthela ngokugcwele kungakapheli izinyanga ezingu-18. Lesi isikhombo sesikhathi esingumkhawulo ongaphezulu, akusona isithembiso samakhilogremu okudla ngonyaka.",
    "st": "Tataiso ya KZN e bolela ho beha ka botlalo pele dikgwedi tse 18 di fela. Sena ke tshupiso ya moedi o ka hodimo wa nako, ha se tshepiso ya dikilogerama tsa dijo ka selemo.",
    "ts": "Nkongomiso wa KZN wu vula ku tswala hi ku helela ku nga si hela tin’hweti ta 18. Lexi i xikombiso xa mpimo wa le henhla wa nkarhi, a hi xitshembiso xa tikhilogiramu ta swakudya hi lembe.",
    "ve": "Nyendedzi ya KZN i amba u aṋwa nga vhuḓalo hu sa athu fhela miṅwedzi ya 18. Itshi ndi tshiko tsha mukano wa nṱha wa tshifhinga, a si fulufhedziso ya khilogireme dza zwiḽiwa nga ṅwaha."
  },
  {
    "english": "In this irrigated, intensively managed Natal Midlands trial, Hass reached about 20 t/ha at age 6 and orchards approached maximum sustainable average yield by age 8. This is a trial-specific bearing reference; there is no national plateau or automatically interpolated age-yield curve.",
    "zu": "Kulesi sivivinyo sase-Natal Midlands esiniselwayo nesinakekelwa kakhulu, i-Hass yafinyelela cishe ku-20 t/ha ineminyaka engu-6 kanti izinsimu zasondela esivunweni esimaphakathi esiphezulu esingaqhubeka ngokusimama lapho zineminyaka engu-8. Lesi isikhombo sokuthela esiphathelene nalesi sivivinyo kuphela; asikho isilinganiso esingasakhuli sikazwelonke noma igrafu yobudala nesivuno egcwaliswa ngokuzenzakalela phakathi kweminyaka.",
    "st": "Tekong ena ya Natal Midlands e nosetswang le ho laolwa ka matla, Hass e fihletse hoo e ka bang 20 t/ha dilemong tse 6 mme dirapa tsa atamela karolelano e phahameng ya chai e ka bolokwang dilemong tse 8. Sena ke tshupiso ya ho beha e amanang le teko ena feela; ha ho boemo bo sa nyoloheng ba naha kapa mothalo wa dilemo le chai o tlatswang ka boona dipakeng tsa dilemo.",
    "ts": "Eka ndzingo lowu cheletiwaka ni ku fambisiwa hi vukheta wa Natal Midlands, Hass yi fikile eka kwalomu ka 20 t/ha eka vukhale bya 6 kasi mintanga yi tshinelele avhareji ya mbuyelo wa le henhla lowu nga tshamaka wu hlayisekile eka vukhale bya 8. Lexi i xikombiso xa ku tswala xa ndzingo wolowo ntsena; a ku na mpimo wa tiko lowu yimaka kumbe girafu ya vukhale ni mbuyelo leyi tatisiwaka hi yoxe eka nkarhi wa le xikarhini.",
    "ve": "Kha ndingo iyi yo sheledzwaho na u langulwa nga vhuronwane ya Natal Midlands, Hass yo swika kha hu ṱoḓaho u vha 20 t/ha kha miṅwaha ya 6 nahone tsimu dzo sendela kha ndinganyelo khulwanesa ya khaṋo i nga dzulaho yo khwaṱha nga miṅwaha ya 8. Itshi ndi tshiko tsha u aṋwa tsha ndingo iyi fhedzi; a hu na mukano wo dzikaho wa lushaka kana girafu ya miṅwaha na khaṋo ine ya ḓi ḓadza vhukati ha miṅwaha."
  },
  {
    "english": "Same-trial arithmetic at the initial 200 trees/ha: 20,000 kg/ha / 200 = 100 kg/tree at age 6; sustainable average 22,500 kg/ha / 200 = 112.5 kg/tree. At age 3, 10,000 kg/ha / 200 = 50 kg/tree equivalent. These are average-equivalent reference values for the named Hass/Duke 7 orchard conditions, not measured individual-tree yields or default production for a different density, cultivar, climate or management. Intermediate ages are not inferred.",
    "zu": "Ukubala kwesivivinyo esifanayo ngobuningi bokuqala obungu-200 trees/ha: 20,000 kg/ha / 200 = 100 kg/tree eneminyaka engu-6; isilinganiso esingaqhubeka ngokusimama 22,500 kg/ha / 200 = 112.5 kg/tree. Eminyakeni engu-3, 10,000 kg/ha / 200 = 50 kg/tree njengesilinganiso esilinganayo. La manani ayizikhombo ezilinganiswa nesilinganiso esimaphakathi sezimo ezishiwo zensimu ye-Hass/Duke 7, awazona izivuno zesihlahla ngasinye ezilinganisiwe noma ukukhiqiza okuzenzakalelayo kobunye ubuningi, uhlobo, isimo sezulu noma ukuphathwa. Akucatshangelwa amanani obudala obuphakathi.",
    "st": "Palo ya teko yona eo bongateng ba pele ba 200 trees/ha: 20,000 kg/ha / 200 = 100 kg/tree dilemong tse 6; karolelano e ka bolokwang 22,500 kg/ha / 200 = 112.5 kg/tree. Dilemong tse 3, 10,000 kg/ha / 200 = 50 kg/tree e le tekano. Tsena ke dipalo tsa tshupiso tse lekanang le karolelano bakeng sa maemo a bitsitsweng a serapa sa Hass/Duke 7, ha se chai ya sefate ka seng e lekantsweng kapa tlhahiso e nkelwang pele bakeng sa bongata bo fapaneng, mofuta, maemo a lehodimo kapa taolo. Ha ho hakanywe dilemo tse pakeng.",
    "ts": "Nhlayo ya ndzingo wolowo eka ku tala ko sungula ka 200 trees/ha: 20,000 kg/ha / 200 = 100 kg/tree eka vukhale bya 6; avhareji leyi nga hlayisekaka 22,500 kg/ha / 200 = 112.5 kg/tree. Eka vukhale bya 3, 10,000 kg/ha / 200 = 50 kg/tree tani hi mpimo lowu ringanaka. Leyi i mimpimo ya swikombiso leswi ringanaka ni avhareji eka swiyimo leswi boxiweke swa ntanga wa Hass/Duke 7, a hi mimbuyelo leyi pimiweke ya murhi wun’wana ni wun’wana kumbe vuhumelerisi byo teka byi ri kona eka ku tala kun’wana, muxaka, maxelo kumbe mafambiselo. Vukhale bya le xikarhini a byi kumbeteriwi.",
    "ve": "U vhala ha ndingo yeneyo kha tshivhalo tsha u thoma tsha 200 trees/ha: 20,000 kg/ha / 200 = 100 kg/tree kha miṅwaha ya 6; ndinganyelo i nga dzulaho yo khwaṱha 22,500 kg/ha / 200 = 112.5 kg/tree. Kha miṅwaha ya 3, 10,000 kg/ha / 200 = 50 kg/tree sa tshivhalo tshi linganaho. Izwi ndi zwivhalo zwa tshiko zwi linganaho na ndinganyelo kha nyimele dzo bulwaho dza tsimu ya Hass/Duke 7, a si khaṋo yo kaliwaho ya muri muṅwe na muṅwe kana u bveledza hu dzhiiwaho sa ho no vha hone kha tshivhalo, lushaka, kilima kana ndangulo zwo fhambanaho. Miṅwaha ya vhukati a i humbulelwi."
  },
  {
    "english": "The same regional guide describes commercial orchard lifespan of approximately 12–15 years; it does not provide individual-tree yields by age.",
    "zu": "Incwadi yesifunda efanayo ichaza ukuthi impilo yensimu yezihlahla zezithelo zokudayisa icishe ibe iminyaka engu-12–15; ayinikezi izivuno zesihlahla ngasinye ngokobudala.",
    "st": "Tataiso yona eo ya sebaka e hlalosa bophelo ba serapa sa ditholwana sa kgwebo ba hoo e ka bang dilemo tse 12–15; ha e fane ka chai ya sefate ka seng ho ya ka dilemo.",
    "ts": "Nkongomiso wolowo wa xifundzha wu hlamusela nkarhi wa ku hanya wa ntanga wa mihandzu wa bindzu wa kwalomu ka 12–15 wa malembe; a wu nyiki mimbuyelo ya murhi wun’wana ni wun’wana hi vukhale.",
    "ve": "Nyendedzi yeneyo ya dzingu i ṱalutshedza tshifhinga tsha u tshila ha tsimu ya mitshelo ya vhubindudzi tshi ṱoḓaho u vha miṅwaha ya 12–15; a i ṋei khaṋo ya muri muṅwe na muṅwe u ya nga miṅwaha."
  },
  {
    "english": "CONVERTED, arithmetic shown: took the 'Average' yield band (15-18 t/ha) and the same source's stated spacing ('Generally planted 6m x 4m or 5 m x 3 m'). At 6x4m = 24 m²/tree → 10000/24 = 416.7 trees/ha → 15000kg/416.7=36.0 and 18000kg/416.7=43.2 kg/tree. At 5x3m = 15 m²/tree → 666.7 trees/ha → 15000/666.7=22.5 and 18000/666.7=27.0 kg/tree. Combined range across both spacings, rounded: [23, 43] kg/tree. This spread reflects the two different sourced spacings, not cultivar variation.",
    "zu": "KUGUQULIWE, ukubala kubonisiwe: kusetshenziswe ibanga lesivuno elithi “Average” (15-18 t/ha) nezikhala ezishiwo emthonjeni ofanayo (“Generally planted 6m x 4m or 5 m x 3 m”). Ku-6x4m = 24 m²/tree → 10000/24 = 416.7 trees/ha → 15000kg/416.7=36.0 no-18000kg/416.7=43.2 kg/tree. Ku-5x3m = 15 m²/tree → 666.7 trees/ha → 15000/666.7=22.5 no-18000/666.7=27.0 kg/tree. Ibanga elihlanganisa zombili izikhala, elisondezwe: [23, 43] kg/tree. Lo mehluko ukhombisa izikhala ezimbili ezihlukene ezitholakala emthonjeni, hhayi ukuhluka kwezinhlobo.",
    "st": "HO FETOTSWE, palo e bontshitswe: ho nkilwe sehlopha sa chai sa “Average” (15-18 t/ha) le sebaka pakeng tsa dimela se boletsweng mohloding wona oo (“Generally planted 6m x 4m or 5 m x 3 m”). Ho 6x4m = 24 m²/tree → 10000/24 = 416.7 trees/ha → 15000kg/416.7=36.0 le 18000kg/416.7=43.2 kg/tree. Ho 5x3m = 15 m²/tree → 666.7 trees/ha → 15000/666.7=22.5 le 18000/666.7=27.0 kg/tree. Moedi o kopantsweng wa dibaka tseo ka bobedi, o potolohisitsweng: [23, 43] kg/tree. Phapang ena e bontsha dibaka tse pedi tse fapaneng tse fumanweng mohloding, e seng phapang ya mefuta.",
    "ts": "SWI HUNDZURIWILE, nhlayo yi kombisiwile: ku tekiwe mpimo wa mbuyelo wa “Average” (15-18 t/ha) ni mpfhuka lowu boxiweke eka xihlovo xolexo (“Generally planted 6m x 4m or 5 m x 3 m”). Eka 6x4m = 24 m²/tree → 10000/24 = 416.7 trees/ha → 15000kg/416.7=36.0 na 18000kg/416.7=43.2 kg/tree. Eka 5x3m = 15 m²/tree → 666.7 trees/ha → 15000/666.7=22.5 na 18000/666.7=27.0 kg/tree. Mpimo lowu hlanganisiweke eka mipfhuka leyi mimbirhi, wu rhendzelekiwile: [23, 43] kg/tree. Ku hambana loku ku komba mipfhuka leyi mimbirhi leyi hambaneke leyi humaka eka xihlovo, ku nga ri ku hambana ka mixaka.",
    "ve": "ZWO SHANDULWA, u vhala ho sumbedzwa: ho dzhiiwa tshigwada tsha khaṋo tsha “Average” (15-18 t/ha) na zwikhala zwo bulwaho nga tshiko tshenetsho (“Generally planted 6m x 4m or 5 m x 3 m”). Kha 6x4m = 24 m²/tree → 10000/24 = 416.7 trees/ha → 15000kg/416.7=36.0 na 18000kg/416.7=43.2 kg/tree. Kha 5x3m = 15 m²/tree → 666.7 trees/ha → 15000/666.7=22.5 na 18000/666.7=27.0 kg/tree. Mukano wo ṱanganyiswaho kha zwikhala izwi zwivhili, wo moniseledzwaho: [23, 43] kg/tree. Phambano iyi i sumbedza zwikhala zwivhili zwo fhambanaho zwi bvaho tshikoni, hu si phambano ya tshaka."
  },
  {
    "english": "International ICRAF reference; growing conditions and spacing affect full bearing. This is not a South African site forecast.",
    "zu": "Isikhombo samazwe ngamazwe se-ICRAF; izimo zokukhula nezikhala zokutshala kuthinta ukuthela ngokugcwele. Lokhu akusona isibikezelo sendawo yaseNingizimu Afrika.",
    "st": "Tshupiso ya matjhaba ya ICRAF; maemo a kgolo le sebaka pakeng tsa dimela di ama ho beha ka botlalo. Sena ha se ponelopele ya sebaka sa Afrika Borwa.",
    "ts": "Xikombiso xa matiko xa ICRAF; swiyimo swo kula ni mpfhuka wo byala swi khumba ku tswala hi ku helela. Lexi a hi mvhumbo wa ndhawu ya Afrika Dzonga.",
    "ve": "Tshiko tsha mashango tsha ICRAF; nyimele dza u aluwa na zwikhala zwi kwama u aṋwa nga vhuḓalo. Itshi a si mbonelaphanḓa ya fhethu ha Afrika Tshipembe."
  },
  {
    "english": "ICRAF's international species reference reports maximum production of 50–70 kg/plant at about 7 years under good management; at age 5 it reports 30–40 kg/plant. These are not South Africa-specific farm forecasts. Match plant age, cultivar, site and care before applying this reference.",
    "zu": "Isikhombo samazwe ngamazwe sezinhlobo se-ICRAF sibika ukukhiqiza okuphezulu okungu-50–70 kg/plant cishe ngeminyaka engu-7 ngaphansi kokuphathwa okuhle; eminyakeni engu-5 sibika u-30–40 kg/plant. Lokhu akuzona izibikezelo zamapulazi eziqondene neNingizimu Afrika. Qondanisa ubudala besitshalo, uhlobo, indawo nokunakekelwa ngaphambi kokusebenzisa lesi sikhombo.",
    "st": "Tshupiso ya matjhaba ya mefuta ya ICRAF e tlaleha tlhahiso e phahameng ka ho fetisisa ya 50–70 kg/plant hoo e ka bang dilemong tse 7 tlasa taolo e ntle; dilemong tse 5 e tlaleha 30–40 kg/plant. Tsena ha se diponelopele tsa mapolasi tse tobileng Afrika Borwa. Nyalanya dilemo tsa semela, mofuta, sebaka le tlhokomelo pele o sebedisa tshupiso ena.",
    "ts": "Xikombiso xa matiko xa mixaka xa ICRAF xi vika vuhumelerisi bya le henhla swinene bya 50–70 kg/plant eka kwalomu ka 7 wa malembe ehansi ka mafambiselo lamanene; eka vukhale bya 5 xi vika 30–40 kg/plant. Leyi a hi mivhumbo ya mapurasi leyi kongomaka eka Afrika Dzonga. Fananisa vukhale bya ximilana, muxaka, ndhawu ni nhlayiso u nga si tirhisa xikombiso lexi.",
    "ve": "Tshiko tsha mashango tsha tshaka tsha ICRAF tshi vhiga u bveledza huhulwanesa ha 50–70 kg/plant kha hu ṱoḓaho u vha miṅwaha ya 7 kha ndangulo yavhuḓi; kha miṅwaha ya 5 tshi vhiga 30–40 kg/plant. Izwi a si mbonelaphanḓa dza bulasi zwo livhiswaho kha Afrika Tshipembe. Fananyisani miṅwaha ya tshimela, lushaka, fhethu na ṱhogomelo musi ni sa athu shumisa tshiko itshi."
  },
  {
    "english": "The Post-Harvest Innovation programme gives six years to a full crop. It does not provide annual per-tree output at that age.",
    "zu": "Uhlelo lwe-Post-Harvest Innovation lunikeza iminyaka eyisithupha kuze kube nesivuno esigcwele. Alunikezi inani lokukhiqiza ngesihlahla ngonyaka kulobo budala.",
    "st": "Lenaneo la Post-Harvest Innovation le fana ka dilemo tse tsheletseng ho fihla kotulong e felletseng. Ha le fane ka tlhahiso ya selemo ka sefate dilemong tseo.",
    "ts": "Phurogireme ya Post-Harvest Innovation yi nyika malembe ya tsevu ku ya eka kotulo yo helela. A yi nyiki vuhumelerisi bya murhi wun’we hi lembe eka vukhale byebyo.",
    "ve": "Mbekanyamushumo ya Post-Harvest Innovation i ṋea miṅwaha ya rathi u ya kha khaṋo yo fhelelaho. A i ṋei zwibveledzwa zwa ṅwaha nga muri kha miṅwaha yeneyo."
  },
  {
    "english": "ICRAF reports 200–1,500 kg of whole fruit collected from a single wild tree in one season (0.2–1.5 tonnes x 1,000). This seasonal collection range does not establish an orchard average, edible pulp or kernel weight, or a production-by-age forecast.",
    "zu": "I-ICRAF ibika u-200–1,500 kg wezithelo eziphelele eziqoqwe esihlahleni esisodwa sasendle ngesizini eyodwa (0.2–1.5 tonnes x 1,000). Leli banga lokuqoqwa kwesizini alibeki isilinganiso esimaphakathi sensimu yezihlahla zezithelo, isisindo senyama yesithelo edliwayo noma sezinhlamvu, noma isibikezelo sokukhiqiza ngokobudala.",
    "st": "ICRAF e tlaleha 200–1,500 kg ya ditholwana tse felletseng tse bokeletsweng sefateng se le seng sa naheng nakong e le nngwe (0.2–1.5 tonnes x 1,000). Moedi ona wa pokello ya nako ha o netefatse karolelano ya serapa sa ditholwana, boima ba nama e jewang ya tholwana kapa dithollo, kapa ponelopele ya tlhahiso ho ya ka dilemo.",
    "ts": "ICRAF yi vika 200–1,500 kg ya mihandzu leyi heleleke leyi hlengeletiweke eka murhi wun’we wa nhova eka nguva yin’we (0.2–1.5 tonnes x 1,000). Mpimo lowu wa ku hlengeleta ka nguva a wu veki avhareji ya ntanga wa mihandzu, ntiko wa nyama leyi dyiwaka ya muhandzu kumbe timbilu ta yona, kumbe mvhumbo wa vuhumelerisi hi vukhale.",
    "ve": "ICRAF i vhiga 200–1,500 kg dza mitshelo yo fhelelaho yo kuvhanganywaho kha muri muthihi wa ḓaka kha tshifhinga tshithihi (0.2–1.5 tonnes x 1,000). Mukano uyu wa u kuvhanganya wa tshifhinga a u khwaṱhisedzi ndinganyelo ya tsimu ya mitshelo, tshileme tsha ṋama ya mutshelo i ḽiwaho kana mbilwana dza mbeu, kana mbonelaphanḓa ya u bveledza u ya nga miṅwaha."
  },
  {
    "english": "The review reports 40–100 kg per tree stand without an annual period, mature age, matched cultivar or South African field conditions. Retain the original per-plant weight as context only: do not relabel it kg/year, spread it across months or treat it as a farm forecast.",
    "zu": "Ukubuyekezwa kubika u-40–100 kg ngesihlahla esimile ngaphandle kwesikhathi sonyaka, ubudala bokuvuthwa, uhlobo oluqondanisiwe noma izimo zensimu zaseNingizimu Afrika. Gcina isisindo sokuqala ngesitshalo njengomongo kuphela: ungasibizi ngokuthi kg/year, usihlukanisele izinyanga noma usithathe njengesibikezelo sepulazi.",
    "st": "Tlhahlobo e tlaleha 40–100 kg ka sefate se emeng ntle le nako ya selemo, dilemo tsa ho hola ka botlalo, mofuta o nyalanang kapa maemo a tshimo a Afrika Borwa. Boloka boima ba pele ka semela e le moelelo feela: o se ke wa bo bitsa kg/year, wa bo arola ka dikgwedi kapa wa bo nka e le ponelopele ya polasi.",
    "ts": "Nkambisiso wu vika 40–100 kg hi murhi lowu yimeke wu nga ri na nkarhi wa lembe, vukhale bya ku kula hi ku helela, muxaka lowu fambisanaka kumbe swiyimo swa masimu swa Afrika Dzonga. Hlayisa ntiko wo sungula hi ximilana ku va mongo ntsena: u nga wu thyi kg/year, u wu ava eka tin’hweti kumbe u wu teka wu ri mvhumbo wa purasi.",
    "ve": "Tsedzuluso i vhiga 40–100 kg nga muri wo imaho hu si na tshifhinga tsha ṅwaha, miṅwaha ya u hula, lushaka lu tshimbidzanaho kana nyimele dza tsimu dza Afrika Tshipembe. Vhulungani tshileme tsha u thoma nga tshimela sa vhubvo fhedzi: ni songo tshi ira kg/year, u tshi kovhela miṅwedzi kana u tshi dzhia sa mbonelaphanḓa ya bulasi."
  },
  {
    "english": "KZN advice describes Vaccinium species and lists rabbiteye cultivars Tifblue, Beckyblue and Climax. This reference is not specific to southern highbush blueberries.",
    "zu": "Iseluleko sase-KZN sichaza izinhlobo ze-Vaccinium futhi sibala izinhlobo ze-rabbiteye ezithi Tifblue, Beckyblue ne-Climax. Lesi sikhombo asibhekiseli ngokukhethekile kwi-southern highbush blueberries.",
    "st": "Keletso ya KZN e hlalosa mefuta ya Vaccinium mme e thathamisa mefuta ya rabbiteye ya Tifblue, Beckyblue le Climax. Tshupiso ena ha e tobe southern highbush blueberries.",
    "ts": "Xitsundzuxo xa KZN xi hlamusela mixaka ya Vaccinium naswona xi xaxameta mixaka ya rabbiteye ya Tifblue, Beckyblue ni Climax. Xikombiso lexi a xi kongomanga eka southern highbush blueberries.",
    "ve": "Nyeletshedzo ya KZN i ṱalutshedza tshaka dza Vaccinium nahone i bula tshaka dza rabbiteye Tifblue, Beckyblue na Climax. Tshiko itshi a tsho ngo livhiswa kha southern highbush blueberries."
  },
  {
    "english": "Established production reference: {range} years. {note}",
    "zu": "Isikhombo sokukhiqiza osekusimeme: iminyaka engu-{range}. {note}",
    "st": "Tshupiso ya tlhahiso e tsitsitseng: dilemo tse {range}. {note}",
    "ts": "Xikombiso xa vuhumelerisi bya leswi se swi kurile: malembe ya {range}. {note}",
    "ve": "Tshiko tsha u bveledza ho no khwaṱhaho: miṅwaha ya {range}. {note}"
  },
  {
    "english": "Check cultivar, starting stock and growing conditions.",
    "zu": "Hlola uhlobo olukhethiwe, izitshalo zokuqala nezimo zokukhula.",
    "st": "Hlahloba mofuta o kgethilweng, dimela tsa ho qala le maemo a kgolo.",
    "ts": "Kambela muxaka, swibyariwa swo sungula ni swiyimo swo kula.",
    "ve": "Ṱolani lushaka, zwimela zwa u thoma ngazwo na nyimele dza u aluwa."
  },
  {
    "english": "Production reference: {range} kg/plant. {note}",
    "zu": "Isikhombo sokukhiqiza: {range} kg/isitshalo. {note}",
    "st": "Tshupiso ya tlhahiso: {range} kg/semela. {note}",
    "ts": "Xikombiso xa vuhumelerisi: {range} kg/ximilana. {note}",
    "ve": "Tshiko tsha u bveledza: {range} kg/tshimela. {note}"
  },
  {
    "english": "This source result is not a locally confirmed annual forecast.",
    "zu": "Lo mphumela womthombo awusona isibikezelo sonyaka esiqinisekisiwe endaweni.",
    "st": "Sephetho sena sa mohlodi ha se ponelopele ya selemo e netefaditsweng sebakeng seo.",
    "ts": "Mbuyelo lowu wa xihlovo a hi mvhumbo wa lembe na lembe lowu tiyisisiweke endhawini.",
    "ve": "Mvelelo iyi ya tshiko a si mbonelaphanḓa ya ṅwaha yo khwaṱhisedzwaho henefho."
  }
];
const productGuideCopy = new Map([...PRODUCT_GUIDE_COPY,...PRODUCT_FIRST_CROP_COPY,...PRODUCT_YIELD_COPY].map(row => [row.english,row]));
export function productGuideText(english:string,language='en',values:Record<string,string|number>={}):string {
  const row=productGuideCopy.get(english);
  const native=language==='zu'||language==='st'||language==='ts'||language==='ve';
  const template=row&&native?row[language]:cropExportText(english,language);
  // A saved name may contain braces: interpolate it once and never interpret its contents.
  return template.replace(/\{(\w+)\}/g,(token,key:string)=>{
    if(Object.hasOwn(values,key))return String(values[key]);
    if(row&&native&&/^month(?:[1-9]|1[0-2])$/.test(key))return recordsMonthLong(language,Number(key.slice(5)));
    return token;
  });
}

export interface ProductGuideContext {
  trees: readonly PlacedTreeGroup[];
  animals: readonly PlacedAnimalGroup[];
  animalChoices?: Partial<Record<HousingKind, string>>;
  bananaCircles?: number;
}
export interface ExpectedSeason {
  label: string;
  months: number[];
  basis: string;
  /** Short native display label; source season gates never depend on translated wording. */
  calendarLabel?: string;
  source?: Reference;
}
const WARM: GrowingZoneId[] = ['lowveld-bushveld', 'subtropical-coast'];
const COOL: GrowingZoneId[] = ['highveld', 'midlands-mistbelt', 'western-cape', 'southern-cape', 'high-mountain', 'karoo-arid'];

/** Only one applicable source window: never the union of all varieties/regions. */
export function assumedProductSeason(group: PlacedTreeGroup, zones: readonly GrowingZoneId[], conditions?: SiteProductionConditions, language = 'en'): ExpectedSeason | undefined {
  if (!isHouseholdFoodHarvest(group.harvest)) return undefined;
  const id = group.harvest.speciesId;
  const frostSensitive = ['persea-americana', 'carica-papaya', 'musa-acuminata-aaa-group', 'macadamia-integrifolia', 'mangifera-indica', 'litchi-chinensis', 'sclerocarya-birrea-subsp-caffra'];
  if (!zones.length || zones.includes('high-mountain') || conditions?.sunlight === 'mostly-shade' || conditions?.drainage === 'stays-wet' || (conditions?.frost === 'yes' && frostSensitive.includes(id))) return undefined;
  const allIn = (allowed: readonly GrowingZoneId[]) => zones.every(zone => allowed.includes(zone));
  const warm = allIn(WARM);
  const result = (window: HarvestWindow | undefined, label: string, note = '', months?: number[]): ExpectedSeason | undefined => window ? {
    label: isCropExportDraftLanguage(language) && label.startsWith('Regional reference:') && cropExportText(label, language) === label
      ? cropExportText('Regional reference: {name}', language, { name: label.slice('Regional reference:'.length).trimStart() })
      : cropExportText(label, language),
    months: [...(months ?? window.months)],
    ...(isCropExportDraftLanguage(language) ? { calendarLabel: label.startsWith('Regional reference:') ? cropExportText('Regional season', language) : cropExportText(label, language) } : {}),
    basis: cropExportText('{region}. {note}Planning reference when established; confirm local picking dates. No food quantity or first-year crop promised.', language, { region: cropExportText(window.region, language), note: note ? `${cropExportText(note, language)} ` : '' }),
    source: { label: `${window.source.doc}${window.source.page ? `, p. ${window.source.page}` : ''}`, url: window.source.url },
  } : undefined;
  const windows = group.harvest.windows;
  if (id === 'persea-americana') {
    const cool = allIn(COOL) && zones.some(z => ['midlands-mistbelt', 'western-cape', 'southern-cape'].includes(z));
    if (!warm && !cool) return undefined;
    return result(windows.find(w => w.region.toLowerCase().includes(warm ? 'warm' : 'cool') && w.region.includes('Hass')), 'Assumed variety: Hass');
  }
  if (id === 'citrus-limon' && (warm || allIn(['midlands-mistbelt']))) return result(windows.find(w => w.region.startsWith('KZN')), 'Regional reference: lemon main crop', 'Hot and cool main crops remain separate; smaller additional crops are not marked.', warm ? [2, 3] : [5, 6, 7]);
  if (id === 'litchi-chinensis' && warm) return result(windows.find(w => w.region.includes('Mauritius cultivar')), 'Assumed variety: Mauritius');
  if (id === 'prunus-persica' && allIn(['western-cape'])) return result(windows.find(w => w.region.includes('Earligold')), 'Assumed variety: Earligold (chilling needs checking)', 'Reference first pick, not the whole harvest duration.');
  if (id === 'malus-domestica' && allIn(['western-cape'])) return result(windows.find(w => w.region.includes('Granny Smith')), 'Assumed variety: Granny Smith (chilling and pollen source need checking)', 'Elgin first-pick reference, not the whole harvest duration. No other apple cultivar months are joined to it.');
  if (id === 'prunus-salicina' && allIn(['western-cape'])) return result(windows[0], 'Assumed variety: African Delight', 'Reference first pick; confirm chilling and compatible pollinator.');
  if (id === 'fragaria-x-ananassa') {
    if (allIn(['western-cape'])) return result(windows.find(w => w.region === 'Western Cape'), 'Regional reference: outdoor strawberry');
    if (warm && conditions?.frost !== 'yes') return result(windows.find(w => w.region.includes('frost-free areas')), 'Regional reference: frost-free strawberry', 'KZN outdoor reference, not the Transvaal tunnel season.');
    if (allIn(['midlands-mistbelt']) && conditions?.frost === 'yes') return result(windows.find(w => w.region.includes('light frosts')), 'Regional reference: light-frost strawberry', 'Assumes light frost; check severity locally.');
    return undefined;
  }
  if (id === 'carya-illinoinensis' && allIn(['karoo-arid', 'highveld']) && conditions?.drySeasonWater === 'reliable') return result(windows[0], 'Regional reference: pecan nuts', 'Irrigated production reference; confirm cultivar, pollination, summer heat and water capacity.');
  const rules: Record<string, { zones: GrowingZoneId[]; match?: string; note?: string }> = {
    'carica-papaya': { zones: WARM, note: 'KZN regional reference; cultivar-specific local timing remains unknown.' },
    'macadamia-integrifolia': { zones: WARM, note: 'Regional nut-in-shell season; individual cultivar maturity still needs checking.' },
    'mangifera-indica': { zones: WARM, note: 'Regional industry season, not a Tommy Atkins-only harvest window.' },
    'passiflora-edulis': { zones: ['midlands-mistbelt'], note: 'Cool subtropical KZN reference; heavier and secondary crops only.' },
    'rubus-idaeus': { zones: ['midlands-mistbelt'], note: 'Spring-bearing system only; do not use this for autumn-bearing Heritage or Autumn Bliss.' },
    'vaccinium-corymbosum': { zones: ['western-cape'], match: 'Western Cape', note: 'Hex River/Wolseley trial reference; confirm cultivar, chilling and acidic soil.' },
    'ficus-carica': { zones: ['western-cape'], note: 'Breede River main-crop reference; cultivar and local dates still need checking.' },
    'citrus-reticulata': { zones: ['western-cape', 'southern-cape'], match: 'Satsuma', note: 'Satsuma group reference; other soft-citrus varieties have different seasons.' },
    'punica-granatum': { zones: ['western-cape'], note: 'SA industry reference, not a Wonderful-only window.' },
    'englerophytum-magalismontanum': { zones: ['highveld', 'midlands-mistbelt', ...WARM] },
    'grewia-occidentalis': { zones: [...WARM, 'highveld', 'midlands-mistbelt', 'western-cape', 'southern-cape', 'karoo-arid'] },
    'harpephyllum-caffrum': { zones: [...WARM, 'southern-cape'], note: 'Frost-free forest reference; confirm a fruiting female and pollen source.' },
    'mimusops-zeyheri': { zones: [...WARM, 'midlands-mistbelt'], note: 'Summer-rain reference; check frost protection of young plants.' },
    'pappea-capensis': { zones: [...WARM, 'highveld', 'midlands-mistbelt', 'western-cape', 'southern-cape', 'karoo-arid'], note: 'Broad SANBI fruiting reference; local season may be shorter.' },
    'phoenix-reclinata': { zones: [...WARM, 'southern-cape'], match: 'South Africa', note: 'Fruit, not flowering; check moisture and fruiting female stock.' },
    'rhoicissus-tomentosa': { zones: ['subtropical-coast', 'southern-cape'], note: 'Ripe fruit only; tuberous roots are poisonous.' },
    'sclerocarya-birrea-subsp-caffra': { zones: WARM, note: 'Fruit reference, not a separate kernel season; check fruiting female stock.' },
    'strychnos-spinosa': { zones: WARM, note: 'Ripe pulp only; seeds and unripe fruit are toxic.' },
    'syzygium-cordatum': { zones: [...WARM, 'southern-cape'], note: 'Moist-position reference; fruit dates are not honey-flow dates.' },
    'vangueria-infausta': { zones: [...WARM, 'highveld', 'midlands-mistbelt'] },
    'vitis-vinifera': { zones: ['lowveld-bushveld'], match: 'Northern Province', note: 'Northern production-region reference, not the national November–May union.' },
  };
  const rule = rules[id];
  if (!rule || !allIn(rule.zones)) return undefined;
  if (zones.includes('karoo-arid') && conditions?.drySeasonWater !== 'reliable') return undefined;
  return result(rule.match ? windows.find(w => w.region.includes(rule.match!)) : windows[0], `Regional reference: ${group.harvest.name}`, rule.note);
}

export interface PlanningTreeSeason {
  speciesId: string;
  name: string;
  existing: number;
  proposed: number;
  season: ExpectedSeason;
}

/** Confirmed months replace the reference entirely; extra reference months cannot leak in. */
export function planningTreeSeasons(groups: readonly PlacedTreeGroup[], zones: readonly GrowingZoneId[], conditions?: SiteProductionConditions, confirmed: TreeSeasonChoices = {}, language = 'en'): PlanningTreeSeason[] {
  return groups.flatMap(group => {
    if (confirmedTreeMonths(group.harvest, confirmed).length) return [];
    const season = assumedProductSeason(group, zones, conditions, language);
    return season ? [{ speciesId: group.harvest.speciesId, name: group.harvest.name, existing: group.existing, proposed: group.proposed, season }] : [];
  });
}

function links(group: PlacedTreeGroup, profile?: Profile): Reference[] {
  const sources = [...(profile?.sources ?? []), ...group.harvest.windows.map(w => ({ label: `${w.source.doc}${w.source.page ? `, p. ${w.source.page}` : ''}`, url: w.source.url })), ...(group.harvest.pollination ? [{ label: group.harvest.pollination.source.doc, url: group.harvest.pollination.source.url }] : []), ...(group.harvest.yearsToFirstCrop ? [{ label: `${group.harvest.yearsToFirstCrop.source.doc}${group.harvest.yearsToFirstCrop.source.page ? `, p. ${group.harvest.yearsToFirstCrop.source.page}` : ''}`, url: group.harvest.yearsToFirstCrop.source.url }] : [])];
  sources.push(...(['yearsToFullBearing', 'yieldKgPerTree', 'chillUnits'] as const).flatMap(key => {
    const range = group.harvest[key];
    return range ? [{ label: `${range.source.doc}${range.source.page ? `, p. ${range.source.page}` : ''}`, url: range.source.url }] : [];
  }), ...(group.harvest.supplementaryReferences ?? []).map(reference => ({ label: `${reference.source.doc}${reference.source.page ? `, p. ${reference.source.page}` : ''}`, url: reference.source.url })));
  return sources.filter((source, i) => sources.findIndex(other => other.url === source.url && other.label === source.label) === i);
}

export function buildProductGuidance(context: ProductGuideContext, zones: readonly GrowingZoneId[], conditions?: SiteProductionConditions, language='en'): { foodForest: ProductionGuideItem[]; animalProducts: ProductionGuideItem[] } {
  const t=(source:string,values?:Record<string,string|number>)=>productGuideText(source,language,values);
  const productLabel = (product: keyof typeof PRODUCT_LABEL) => isCropExportDraftLanguage(language) ? t(PRODUCT_LABEL[product]).toLowerCase() : product;
  const foodForest = context.trees.map(group => {
    const h = group.harvest;
    const profile = PRODUCT_PROFILES[h.speciesId] ?? (h.productionGuidance ? { ...h.productionGuidance, sources: [] } : undefined);
    const season = assumedProductSeason(group, zones, conditions, language);
    const lines = [
      t('{existing} existing; {proposed} proposed. Products: {products}.',{existing:group.existing,proposed:group.proposed,products:t(profile?.products ?? h.product).replace(/\.$/,'')}),
      ...(!isHouseholdFoodHarvest(h) ? [h.householdFoodStatus === 'not-food' ? t('Food-use review: kept as mapped inventory; the verified product is not household food. No ordinary food availability or production is assumed.') : t('Food-use review: confirm identity, edible part and appropriate preparation with a qualified local adviser before including this plant as household food. Held out of ordinary food totals and picking jobs.')] : []),
      ...(h.speciesId === 'musa-acuminata-aaa-group' && context.bananaCircles ? [t('Count assumption: {count} banana circle(s) × 3 planted bananas. Followers are not additional planted trees.', { count: context.bananaCircles })] : []),
      h.yearsToFirstCrop ? t('First crop reference: {age}. {note} Actual timing depends on variety and site care.', {
        age: firstCropAgeLabel(h.yearsToFirstCrop.value, (age,unit) => t(`{age} ${unit}`,{age})),
        note: t(h.yearsToFirstCrop.note ?? 'Check the source conditions and starting stock.'),
      }) : t('Time to first crop: not sourced; do not rely on newly planted stock for immediate food.'),
      ...(h.yearsToFullBearing ? [t('Established production reference: {range} years. {note}', {
        range: formatRange(h.yearsToFullBearing.value),
        note: t(h.yearsToFullBearing.note ?? 'Check cultivar, starting stock and growing conditions.'),
      })] : []),
      ...(h.yieldKgPerTree ? [t('Production reference: {range} kg/plant. {note}', {
        range: formatRange(h.yieldKgPerTree.value),
        note: t(h.yieldKgPerTree.note ?? 'This source result is not a locally confirmed annual forecast.'),
      })] : []),
      ...(h.supplementaryReferences ?? []).map(reference => `${t(reference.title)}: ${t(reference.note)}`),
      ...(profile?.care.map(text=>t(text)) ?? []),
      ...(!zones.some(z => WARM.includes(z)) && zones.some(z => ['highveld', 'high-mountain', 'karoo-arid'].includes(z)) && ['musa-acuminata-aaa-group', 'carica-papaya', 'mangifera-indica', 'persea-americana'].includes(h.speciesId) ? [t('Cold-area check: these subtropical references do not establish suitability here. Confirm a frost-protected position before buying.')] : []),
      ...(zones.some(z => WARM.includes(z)) && !zones.some(z => COOL.includes(z)) && conditions?.frost !== 'yes' ? h.speciesId === 'musa-acuminata-aaa-group' ? [t('Assumed planting variety: Grand Nain for a warm site; use the wind/cold alternatives in the buying advice if those conditions apply. Local picking months remain unconfirmed.')] : h.speciesId === 'carica-papaya' ? [t('Assumed planting variety: Sunrise Solo, subject to a frost-free, drained growing position. Confirm its local picking months; the calendar uses a labelled regional reference where sourced.')] : h.speciesId === 'mangifera-indica' ? [t('Assumed planting variety: Tommy Atkins, subject to local flowering and frost checks. Confirm its local picking months; the calendar uses a labelled regional reference where sourced.')] : [] : []),
      ...(profile?.purchase.map(text => t('Buying advice: {advice}',{advice:t(text)})) ?? [t('Buying advice: a named variety for this area is not sourced. Confirm cultivar, pollination and local suitability before purchasing.')]),
      ...(h.pollination ? [h.speciesId === 'musa-acuminata-aaa-group' ? t('Edible bananas set fruit without pollination.') : t("Pollination: {type}. Check the chosen cultivar's requirements with the nursery.", { type: t(h.pollination.value.replaceAll('-', ' ')) })] : []),
      ...(season ? [`${season.label}. ${season.basis}`] : [h.windows.length ? t('Expected picking season: no single local cultivar window established. Reference seasons below are not a forecast.') : t('Expected picking season: no fixed regional months sourced. Record planting and picking dates locally.')]),
      ...(!season ? h.windows.map(w => t(h.speciesId === 'moringa-oleifera' ? 'Reference only (pods, not leaf-picking dates) — {region}: {months}.' : 'Reference only — {region}: {months}.', { region: t(w.region), months: formatMonthSpan(w.months, language) })) : []),
      ...(conditions?.frost === 'yes' && ['persea-americana', 'carica-papaya', 'musa-acuminata-aaa-group'].includes(h.speciesId) ? [t('Observed frost conflicts with this proposed reference; confirm a protected growing position before buying.')] : []),
    ];
    return { title: h.name, lines, sources: links(group, profile), ...(season ? { expectedSeason: season } : {}) };
  });
  const animalProducts = context.animals.flatMap(group => {
    const selected = context.animalChoices?.[group.housing];
    const options = enterprisesForHousing(group.housing);
    const enterprise = options.find(e => e.enterpriseId === selected);
    // Unselected housing still gets useful product/care choices; it never acquires livestock.
    if (!enterprise) {
      return [{ title: t('{housing}: choose the product', { housing: t(HOUSING_LABEL[group.housing]) }), lines: [
        t('{existing} existing; {proposed} proposed structure(s). No animal count or production dates assumed.', { existing: group.existing, proposed: group.proposed }),
        t('Enterprise options: {options}.', { options: options.map(option => option.product === 'wool' ? t('{name} ({product}, non-food)', { name: option.name, product: productLabel(option.product) }) : `${option.name} (${productLabel(option.product)})`).join('; ') }),
        ...(group.housing === 'chicken' ? ['For eggs with dependable feed and water, consider commercial layers. For eggs and meat, Potchefstroom Koekoek is a dual-purpose option; Venda, Ovambo and Naked Neck are other ARC-conserved choices. Confirm supplier vaccination, age and care requirements.'] : [t('Choose the product and actual stock before planning output. Match stock to the local feed, climate, water and care capacity.')]),
        ...[...new Set(options.flatMap(option => option.welfare.slice(0, 1).map(point => t(point.point))))],
      ], sources: [...new Map(options.flatMap(option => option.welfare.slice(0, 1).map(point => [point.source.url, { label: point.source.doc, url: point.source.url }] as const))).values(), ...(group.housing === 'chicken' ? [arc(11, '468–480')] : [])] }];
    }
    const entries = [enterprise];
    return entries.map(e => {
      const breed = e.animal === 'chicken' ? e.enterpriseId === 'chicken-layer'
        ? 'Buying advice: for egg production, request vaccinated point-of-lay pullets from a layer supplier, with age, feeding and vaccination records.'
        : e.enterpriseId === 'chicken-indigenous' ? 'Buying advice: Potchefstroom Koekoek is a dual-purpose option; Venda, Ovambo and Naked Neck are other ARC-conserved options. No province-specific winning breed is claimed.'
        : 'Buying advice: choose a meat strain and supplier batch plan; confirm brooding, feed, water and slaughter arrangements.' : 'Buying advice: match breed/stock to the product, local feed, climate and care capacity; confirm with a local livestock or beekeeping adviser.';
      const sources = [...e.welfare.map(p => p.source), ...e.legal.map(p => p.source), ...(e.productionReferences ?? []).map(p => p.source), ...[e.feedKgPerDay, e.waterLPerDay, e.spaceM2, e.outputPerAnimal, e.productiveLifeYears].flatMap(value => value ? [value.source] : []), ...(e.weeksToFirstProduct ? [e.weeksToFirstProduct.source] : [])];
      return { title: `${t(HOUSING_LABEL[group.housing])}: ${e.name}`, lines: [
        t(enterprise ? '{existing} existing; {proposed} proposed structure(s). Selected enterprise: {product}. No animal head count or output is assumed.' : '{existing} existing; {proposed} proposed structure(s). Option — not selected: {product}. No animal head count or output is assumed.', { existing: group.existing, proposed: group.proposed, product: e.product === 'wool' ? t('{product} (non-food)', { product: productLabel(e.product) }) : productLabel(e.product) }),
        t(breed),
        ...(e.animal === 'chicken' ? [t('Plan balanced feed, clean water, shade, ventilation and predator protection. Egg supply depends on laying birds, their age, health and care; a coop alone supplies no eggs.')] : []),
        ...(e.product === 'eggs' ? [t('Collect eggs frequently, keep nest litter clean and dry, and handle/store eggs carefully for household use or sale.')] : []),
        ...(e.enterpriseId === 'chicken-layer' && e.seasonalPattern ? [t('Season reference: {pattern} This commercial management reference is not a naturally flat household egg supply.', { pattern: t(e.seasonalPattern.text) })] : []),
        ...(e.product === 'milk' ? [t('Plan around actual calving/kidding and lactation. Dry animals do not supply milk.')] : []),
        ...(e.product === 'honey' ? [t('Harvest depends on the colony, local flowering and rainfall. Inspect ripeness and leave food for the colony; there is no fixed national honey season.')] : []),
        e.weeksToFirstProduct ? t('First product reference: {range} weeks. {note}', { range: formatRange(e.weeksToFirstProduct.value), note: t(e.enterpriseId === 'chicken-layer' ? 'Bird age from hatch; confirm the strain and rearing with the supplier. Point-of-lay birds start later in this cycle.' : e.weeksToFirstProduct.note ?? 'Confirm the source age/starting point with the supplier.') }) : t('Time to first product: not sourced for this enterprise.'),
        ...(e.outputPerAnimal ? [t('Production reference: {range} {unit}. {note}', { range: formatRange(e.outputPerAnimal.value), unit: t(e.outputUnit), note: t(e.outputPerAnimal.note ?? 'Check the source conditions and reporting period.') })] : []),
        ...(e.productiveLifeYears ? [t('Productive-life reference: {range} years. {note}', { range: formatRange(e.productiveLifeYears.value), note: t(e.productiveLifeYears.note ?? 'Check breed, care and culling assumptions.') })] : []),
        ...(e.productionReferences ?? []).map(reference => t('Age/system reference: {point}', { point: t(reference.point) })),
        t('Check the detailed enterprise references for feed and housing. Match the ration and space to the animal stage and housing system; provide dependable clean water.'),
        ...e.welfare.map(p => t(p.point)), ...e.legal.map(p => t(p.point)),
      ], sources: [...sources.filter((source, i) => sources.findIndex(other => other.url === source.url && other.doc === source.doc && other.page === source.page) === i).map(s => ({ label: `${s.doc}${s.page ? `, p. ${s.page}` : ''}`, url: s.url })), ...(e.animal === 'chicken' ? [arc(11, '468–480')] : []), ...(e.product === 'eggs' ? [{ label: 'FAO: Small-scale poultry production, egg marketing', url: 'https://www.fao.org/4/y5169e/y5169e0a.htm' }, ...(e.seasonalPattern ? [{ label: e.seasonalPattern.source.doc, url: e.seasonalPattern.source.url }] : [])] : []), ...(e.product === 'honey' ? [{ label: 'FAO, Beekeeping in Africa, honey harvesting', url: 'https://www.fao.org/4/t0104e/T0104E08.htm' }] : [])] };
    });
  });
  // One manual can support several page-specific facts. Keep those citations,
  // while removing exact duplicates added by shared husbandry advice.
  return { foodForest, animalProducts: animalProducts.map(item => ({ ...item, sources: item.sources.filter((source, i, all) => all.findIndex(other => other.url === source.url && other.label === source.label) === i) })) };
}

/** Pure snapshot adapter, shared by app and site-report purchasing guidance. */
export function productContextFromItems(items: readonly PlacedPlant[]): ProductGuideContext {
  return { trees: placedTreeGroups(items), animals: placedAnimalGroups(items), bananaCircles: bananaCirclesIn(items) };
}

export function productPurchasingMarkdown(context: ProductGuideContext, zones: readonly GrowingZoneId[], conditions?: SiteProductionConditions, language='en'): string {
  const guide = buildProductGuidance(context, zones, conditions, language);
  const t=(source:string,values?:Record<string,string|number>)=>productGuideText(source,language,values);
  if (!guide.foodForest.length && !guide.animalProducts.length) return '';
  return [`## ${t('Production purchases and variety assumptions')}`, ...(['zu','st','ts','ve'].includes(language)?[t('Some research notes below remain in their original English. This purchasing section is not fully translated yet.')]:[]), t('Research checked 11 October 2026. Buy only proposed stock after checking local suitability. Existing plants and structures are inventory, not repeat purchases. Early/middle/late describes picking order; compatible flowering is a separate pollination check. Expected seasons describe established production, not guaranteed food this year.'), ...[...guide.foodForest, ...guide.animalProducts].flatMap(item => [`### ${item.title}`, ...item.lines, ...(item.sources ?? []).map(s => t('Source: [{label}]({url})',{label:s.label,url:String(s.url)}))])].join('\n\n');
}
