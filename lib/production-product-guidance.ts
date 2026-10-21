// The buying shortlist and the calendar assumption answer different questions. A mixed
// early/middle/late orchard can extend supply, but its union is not one tree's season.
import { bananaCirclesIn, firstCropAgeLabel, formatMonthSpan, formatRange, isHouseholdFoodHarvest, placedTreeGroups, type PlacedPlant, type PlacedTreeGroup, type TreeSeasonChoices, confirmedTreeMonths, type HarvestWindow } from './perennial-harvest';
import { enterprisesForHousing, HOUSING_LABEL, placedAnimalGroups, type HousingKind, type PlacedAnimalGroup } from './animal-enterprises';
import { recordsMonthLong } from './records-months';
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
    "ve": "Fhambanyisani lushaka lwa tshimela u ya nga kilima ya fhethu honoho; iledzani ṅwando muhulwane na mavu a sa bvumisaho maḓi zwavhuḓi."
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
    "ve": "Fhambanyisani tshilimo tshi dudelaho na vhuriha vhu rotholelaho vhu si na ṅwando uri hu vhe na maluvha; tsireledzani kha muya ni sheledze zwimela zwiṱuku."
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
    "ve": "Fhambanyisani lushaka lwa tsimu ya nḓirivhe na dzingu ḽa u bveledza, maḓi na maitele a u tikedza. Tshifhinga tsha mphakelo wa lushaka tshi ṱanganya madzingu manzhi."
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
    "ve": "Shumisani matavhi a navhaho o kunaho ni fhambanyise lushaka na maitele a u bveledza na fhethu. U sheledza hu fulufhedzeaho na u langa malwadze ndi zwa ndeme."
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
    "ve": "Fhambanyisani u rothola na tshaka dzi tshimbidzanaho kha luvhanda. Lushaka lwa vhuvhili lu tea u vha na maluvha nga tshifhinga tshi tshimbidzanaho, hu si u sokou vhibva nga tshifhinga tsho fhambanaho."
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
    "ve": "Fhambanyisani na vhudzulo ha henefho ha mavhiḓa/ḓaka ḽi re na matombo; maḓuvha a maluvha a si maḓuvha a khaṋo."
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
    "ts": "Xi tsakela mati: ndhawu yo oma yi lava xihlovo xa ndzhongho lexi tiyisekaka. Ku huma swiluva leswi tirhisiwaka hi tinyoxi a hi vuprofeta bya ntshovelo wa vulombe.",
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
const productGuideCopy = new Map(PRODUCT_GUIDE_COPY.map(row => [row.english,row]));
export function productGuideText(english:string,language='en',values:Record<string,string|number>={}):string {
  const row=productGuideCopy.get(english);
  const native=language==='zu'||language==='st'||language==='ts'||language==='ve';
  const template=row&&native?row[language]:english;
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
  source?: Reference;
}
const WARM: GrowingZoneId[] = ['lowveld-bushveld', 'subtropical-coast'];
const COOL: GrowingZoneId[] = ['highveld', 'midlands-mistbelt', 'western-cape', 'southern-cape', 'high-mountain', 'karoo-arid'];

/** Only one applicable source window: never the union of all varieties/regions. */
export function assumedProductSeason(group: PlacedTreeGroup, zones: readonly GrowingZoneId[], conditions?: SiteProductionConditions): ExpectedSeason | undefined {
  if (!isHouseholdFoodHarvest(group.harvest)) return undefined;
  const id = group.harvest.speciesId;
  const frostSensitive = ['persea-americana', 'carica-papaya', 'musa-acuminata-aaa-group', 'macadamia-integrifolia', 'mangifera-indica', 'litchi-chinensis', 'sclerocarya-birrea-subsp-caffra'];
  if (!zones.length || zones.includes('high-mountain') || conditions?.sunlight === 'mostly-shade' || conditions?.drainage === 'stays-wet' || (conditions?.frost === 'yes' && frostSensitive.includes(id))) return undefined;
  const allIn = (allowed: readonly GrowingZoneId[]) => zones.every(zone => allowed.includes(zone));
  const warm = allIn(WARM);
  const result = (window: HarvestWindow | undefined, label: string, note = '', months?: number[]): ExpectedSeason | undefined => window ? {
    label, months: [...(months ?? window.months)],
    basis: `${window.region}. ${note ? `${note} ` : ''}Planning reference when established; confirm local picking dates. No food quantity or first-year crop promised.`,
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
export function planningTreeSeasons(groups: readonly PlacedTreeGroup[], zones: readonly GrowingZoneId[], conditions?: SiteProductionConditions, confirmed: TreeSeasonChoices = {}): PlanningTreeSeason[] {
  return groups.flatMap(group => {
    if (confirmedTreeMonths(group.harvest, confirmed).length) return [];
    const season = assumedProductSeason(group, zones, conditions);
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
  const foodForest = context.trees.map(group => {
    const h = group.harvest;
    const profile = PRODUCT_PROFILES[h.speciesId] ?? (h.productionGuidance ? { ...h.productionGuidance, sources: [] } : undefined);
    const season = assumedProductSeason(group, zones, conditions);
    const lines = [
      t('{existing} existing; {proposed} proposed. Products: {products}.',{existing:group.existing,proposed:group.proposed,products:t(profile?.products ?? h.product).replace(/\.$/,'')}),
      ...(!isHouseholdFoodHarvest(h) ? [h.householdFoodStatus === 'not-food' ? 'Food-use review: kept as mapped inventory; the verified product is not household food. No ordinary food availability or production is assumed.' : 'Food-use review: confirm identity, edible part and appropriate preparation with a qualified local adviser before including this plant as household food. Held out of ordinary food totals and picking jobs.'] : []),
      ...(h.speciesId === 'musa-acuminata-aaa-group' && context.bananaCircles ? [`Count assumption: ${context.bananaCircles} banana circle(s) × 3 planted bananas. Followers are not additional planted trees.`] : []),
      h.yearsToFirstCrop ? `First crop reference: ${firstCropAgeLabel(h.yearsToFirstCrop.value)}. ${h.yearsToFirstCrop.note ?? 'Check the source conditions and starting stock.'} Actual timing depends on variety and site care.` : 'Time to first crop: not sourced; do not rely on newly planted stock for immediate food.',
      ...(h.yearsToFullBearing ? [`Established production reference: ${formatRange(h.yearsToFullBearing.value)} years. ${h.yearsToFullBearing.note ?? 'Check cultivar, starting stock and growing conditions.'}`] : []),
      ...(h.yieldKgPerTree ? [`Production reference: ${formatRange(h.yieldKgPerTree.value)} kg/plant. ${h.yieldKgPerTree.note ?? 'This source result is not a locally confirmed annual forecast.'}`] : []),
      ...(h.supplementaryReferences ?? []).map(reference => `${reference.title}: ${reference.note}`),
      ...(profile?.care.map(text=>t(text)) ?? []),
      ...(!zones.some(z => WARM.includes(z)) && zones.some(z => ['highveld', 'high-mountain', 'karoo-arid'].includes(z)) && ['musa-acuminata-aaa-group', 'carica-papaya', 'mangifera-indica', 'persea-americana'].includes(h.speciesId) ? ['Cold-area check: these subtropical references do not establish suitability here. Confirm a frost-protected position before buying.'] : []),
      ...(zones.some(z => WARM.includes(z)) && !zones.some(z => COOL.includes(z)) && conditions?.frost !== 'yes' ? h.speciesId === 'musa-acuminata-aaa-group' ? ['Assumed planting variety: Grand Nain for a warm site; use the wind/cold alternatives in the buying advice if those conditions apply. Local picking months remain unconfirmed.'] : h.speciesId === 'carica-papaya' ? ['Assumed planting variety: Sunrise Solo, subject to a frost-free, drained growing position. Confirm its local picking months; the calendar uses a labelled regional reference where sourced.'] : h.speciesId === 'mangifera-indica' ? ['Assumed planting variety: Tommy Atkins, subject to local flowering and frost checks. Confirm its local picking months; the calendar uses a labelled regional reference where sourced.'] : [] : []),
      ...(profile?.purchase.map(text => t('Buying advice: {advice}',{advice:t(text)})) ?? ['Buying advice: a named variety for this area is not sourced. Confirm cultivar, pollination and local suitability before purchasing.']),
      ...(h.pollination ? [h.speciesId === 'musa-acuminata-aaa-group' ? 'Edible bananas set fruit without pollination.' : `Pollination: ${h.pollination.value.replaceAll('-', ' ')}. Check the chosen cultivar's requirements with the nursery.`] : []),
      ...(season ? [`${season.label}. ${season.basis}`] : [h.windows.length ? 'Expected picking season: no single local cultivar window established. Reference seasons below are not a forecast.' : 'Expected picking season: no fixed regional months sourced. Record planting and picking dates locally.']),
      ...(!season ? h.windows.map(w => `Reference only${h.speciesId === 'moringa-oleifera' ? ' (pods, not leaf-picking dates)' : ''} — ${w.region}: ${formatMonthSpan(w.months)}.`) : []),
      ...(conditions?.frost === 'yes' && ['persea-americana', 'carica-papaya', 'musa-acuminata-aaa-group'].includes(h.speciesId) ? ['Observed frost conflicts with this proposed reference; confirm a protected growing position before buying.'] : []),
    ];
    return { title: h.name, lines, sources: links(group, profile), ...(season ? { expectedSeason: season } : {}) };
  });
  const animalProducts = context.animals.flatMap(group => {
    const selected = context.animalChoices?.[group.housing];
    const options = enterprisesForHousing(group.housing);
    const enterprise = options.find(e => e.enterpriseId === selected);
    // Unselected housing still gets useful product/care choices; it never acquires livestock.
    if (!enterprise) {
      return [{ title: `${HOUSING_LABEL[group.housing]}: choose the product`, lines: [
        `${group.existing} existing; ${group.proposed} proposed structure(s). No animal count or production dates assumed.`,
        `Enterprise options: ${options.map(option => `${option.name} (${option.product}${option.product === 'wool' ? ', non-food' : ''})`).join('; ')}.`,
        ...(group.housing === 'chicken' ? ['For eggs with dependable feed and water, consider commercial layers. For eggs and meat, Potchefstroom Koekoek is a dual-purpose option; Venda, Ovambo and Naked Neck are other ARC-conserved choices. Confirm supplier vaccination, age and care requirements.'] : ['Choose the product and actual stock before planning output. Match stock to the local feed, climate, water and care capacity.']),
        ...[...new Set(options.flatMap(option => option.welfare.slice(0, 1).map(point => point.point)))],
      ], sources: [...new Map(options.flatMap(option => option.welfare.slice(0, 1).map(point => [point.source.url, { label: point.source.doc, url: point.source.url }] as const))).values(), ...(group.housing === 'chicken' ? [arc(11, '468–480')] : [])] }];
    }
    const entries = [enterprise];
    return entries.map(e => {
      const breed = e.animal === 'chicken' ? e.enterpriseId === 'chicken-layer'
        ? 'Buying advice: for egg production, request vaccinated point-of-lay pullets from a layer supplier, with age, feeding and vaccination records.'
        : e.enterpriseId === 'chicken-indigenous' ? 'Buying advice: Potchefstroom Koekoek is a dual-purpose option; Venda, Ovambo and Naked Neck are other ARC-conserved options. No province-specific winning breed is claimed.'
        : 'Buying advice: choose a meat strain and supplier batch plan; confirm brooding, feed, water and slaughter arrangements.' : 'Buying advice: match breed/stock to the product, local feed, climate and care capacity; confirm with a local livestock or beekeeping adviser.';
      const sources = [...e.welfare.map(p => p.source), ...e.legal.map(p => p.source), ...(e.productionReferences ?? []).map(p => p.source), ...[e.feedKgPerDay, e.waterLPerDay, e.spaceM2, e.outputPerAnimal, e.productiveLifeYears].flatMap(value => value ? [value.source] : []), ...(e.weeksToFirstProduct ? [e.weeksToFirstProduct.source] : [])];
      return { title: `${HOUSING_LABEL[group.housing]}: ${e.name}`, lines: [
        `${group.existing} existing; ${group.proposed} proposed structure(s). ${enterprise ? 'Selected enterprise' : 'Option — not selected'}: ${e.product}${e.product === 'wool' ? ' (non-food)' : ''}. No animal head count or output is assumed.`,
        breed,
        ...(e.animal === 'chicken' ? ['Plan balanced feed, clean water, shade, ventilation and predator protection. Egg supply depends on laying birds, their age, health and care; a coop alone supplies no eggs.'] : []),
        ...(e.product === 'eggs' ? ['Collect eggs frequently, keep nest litter clean and dry, and handle/store eggs carefully for household use or sale.'] : []),
        ...(e.enterpriseId === 'chicken-layer' && e.seasonalPattern ? [`Season reference: ${e.seasonalPattern.text} This commercial management reference is not a naturally flat household egg supply.`] : []),
        ...(e.product === 'milk' ? ['Plan around actual calving/kidding and lactation. Dry animals do not supply milk.'] : []),
        ...(e.product === 'honey' ? ['Harvest depends on the colony, local flowering and rainfall. Inspect ripeness and leave food for the colony; there is no fixed national honey season.'] : []),
        e.weeksToFirstProduct ? `First product reference: ${formatRange(e.weeksToFirstProduct.value)} weeks. ${e.enterpriseId === 'chicken-layer' ? 'Bird age from hatch; confirm the strain and rearing with the supplier. Point-of-lay birds start later in this cycle.' : e.weeksToFirstProduct.note ?? 'Confirm the source age/starting point with the supplier.'}` : 'Time to first product: not sourced for this enterprise.',
        ...(e.outputPerAnimal ? [`Production reference: ${formatRange(e.outputPerAnimal.value)} ${e.outputUnit}. ${e.outputPerAnimal.note ?? 'Check the source conditions and reporting period.'}`] : []),
        ...(e.productiveLifeYears ? [`Productive-life reference: ${formatRange(e.productiveLifeYears.value)} years. ${e.productiveLifeYears.note ?? 'Check breed, care and culling assumptions.'}`] : []),
        ...(e.productionReferences ?? []).map(reference => `Age/system reference: ${reference.point}`),
        'Check the detailed enterprise references for feed and housing. Match the ration and space to the animal stage and housing system; provide dependable clean water.',
        ...e.welfare.map(p => p.point), ...e.legal.map(p => p.point),
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
