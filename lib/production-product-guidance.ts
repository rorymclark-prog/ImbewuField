// The buying shortlist and the calendar assumption answer different questions. A mixed
// early/middle/late orchard can extend supply, but its union is not one tree's season.
import { bananaCirclesIn, formatMonthSpan, formatRange, placedTreeGroups, type PlacedPlant, type PlacedTreeGroup, type TreeSeasonChoices, confirmedTreeMonths, type HarvestWindow } from './perennial-harvest';
import { enterprisesForHousing, HOUSING_LABEL, placedAnimalGroups, type HousingKind, type PlacedAnimalGroup } from './animal-enterprises';
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
  return sources.filter((source, i) => sources.findIndex(other => other.url === source.url) === i);
}

export function buildProductGuidance(context: ProductGuideContext, zones: readonly GrowingZoneId[], conditions?: SiteProductionConditions): { foodForest: ProductionGuideItem[]; animalProducts: ProductionGuideItem[] } {
  const foodForest = context.trees.map(group => {
    const h = group.harvest;
    const profile = PRODUCT_PROFILES[h.speciesId];
    const season = assumedProductSeason(group, zones, conditions);
    const lines = [
      `${group.existing} existing; ${group.proposed} proposed. Products: ${(profile?.products ?? h.product).replace(/\.$/, '')}.`,
      ...(h.speciesId === 'musa-acuminata-aaa-group' && context.bananaCircles ? [`Count assumption: ${context.bananaCircles} banana circle(s) × 3 planted bananas. Followers are not additional planted trees.`] : []),
      h.yearsToFirstCrop ? `First crop reference: ${h.speciesId === 'musa-acuminata-aaa-group' ? `${formatRange([h.yearsToFirstCrop.value[0] * 12, h.yearsToFirstCrop.value[1] * 12])} months` : h.speciesId === 'carica-papaya' ? `about ${formatRange([h.yearsToFirstCrop.value[0] * 12, h.yearsToFirstCrop.value[1] * 12])} months in KZN; 9–11 months under favourable Makhathini Flats conditions` : `${formatRange(h.yearsToFirstCrop.value)} years (source conditions)`}. Actual timing depends on starting stock, variety and site care.` : 'Time to first crop: not sourced; do not rely on newly planted stock for immediate food.',
      ...(profile?.care ?? []),
      ...(!zones.some(z => WARM.includes(z)) && zones.some(z => ['highveld', 'high-mountain', 'karoo-arid'].includes(z)) && ['musa-acuminata-aaa-group', 'carica-papaya', 'mangifera-indica', 'persea-americana'].includes(h.speciesId) ? ['Cold-area check: these subtropical references do not establish suitability here. Confirm a frost-protected position before buying.'] : []),
      ...(zones.some(z => WARM.includes(z)) && !zones.some(z => COOL.includes(z)) && conditions?.frost !== 'yes' ? h.speciesId === 'musa-acuminata-aaa-group' ? ['Assumed planting variety: Grand Nain for a warm site; use the wind/cold alternatives in the buying advice if those conditions apply. Local picking months remain unconfirmed.'] : h.speciesId === 'carica-papaya' ? ['Assumed planting variety: Sunrise Solo, subject to a frost-free, drained growing position. Confirm its local picking months; the calendar uses a labelled regional reference where sourced.'] : h.speciesId === 'mangifera-indica' ? ['Assumed planting variety: Tommy Atkins, subject to local flowering and frost checks. Confirm its local picking months; the calendar uses a labelled regional reference where sourced.'] : [] : []),
      ...(profile?.purchase.map(text => `Buying advice: ${text}`) ?? ['Buying advice: a named variety for this area is not sourced. Confirm cultivar, pollination and local suitability before purchasing.']),
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
      const sources = [...e.welfare.map(p => p.source), ...e.legal.map(p => p.source), ...[e.feedKgPerDay, e.waterLPerDay, e.spaceM2].flatMap(value => value ? [value.source] : []), ...(e.weeksToFirstProduct ? [e.weeksToFirstProduct.source] : [])];
      return { title: `${HOUSING_LABEL[group.housing]}: ${e.name}`, lines: [
        `${group.existing} existing; ${group.proposed} proposed structure(s). ${enterprise ? 'Selected enterprise' : 'Option — not selected'}: ${e.product}${e.product === 'wool' ? ' (non-food)' : ''}. No animal head count or output is assumed.`,
        breed,
        ...(e.animal === 'chicken' ? ['Plan balanced feed, clean water, shade, ventilation and predator protection. Egg supply depends on laying birds, their age, health and care; a coop alone supplies no eggs.'] : []),
        ...(e.product === 'eggs' ? ['Collect eggs frequently, keep nest litter clean and dry, and handle/store eggs carefully for household use or sale.'] : []),
        ...(e.enterpriseId === 'chicken-layer' && e.seasonalPattern ? [`Season reference: ${e.seasonalPattern.text} This commercial management reference is not a naturally flat household egg supply.`] : []),
        ...(e.product === 'milk' ? ['Plan around actual calving/kidding and lactation. Dry animals do not supply milk.'] : []),
        ...(e.product === 'honey' ? ['Harvest depends on the colony, local flowering and rainfall. Inspect ripeness and leave food for the colony; there is no fixed national honey season.'] : []),
        e.weeksToFirstProduct ? `First product reference: ${formatRange(e.weeksToFirstProduct.value)} weeks. ${e.enterpriseId === 'chicken-layer' ? 'Bird age from hatch; confirm the strain and rearing with the supplier. Point-of-lay birds start later in this cycle.' : e.weeksToFirstProduct.note ?? 'Confirm the source age/starting point with the supplier.'}` : 'Time to first product: not sourced for this enterprise.',
        'Check the detailed enterprise references for feed and housing. Match the ration and space to the animal stage and housing system; provide dependable clean water.',
        ...e.welfare.map(p => p.point), ...e.legal.map(p => p.point),
      ], sources: [...new Map(sources.map(s => [s.url, { label: `${s.doc}${s.page ? `, p. ${s.page}` : ''}`, url: s.url }])).values(), ...(e.animal === 'chicken' ? [arc(11, '468–480')] : []), ...(e.product === 'eggs' ? [{ label: 'FAO: Small-scale poultry production, egg marketing', url: 'https://www.fao.org/4/y5169e/y5169e0a.htm' }, ...(e.seasonalPattern ? [{ label: e.seasonalPattern.source.doc, url: e.seasonalPattern.source.url }] : [])] : []), ...(e.product === 'honey' ? [{ label: 'FAO, Beekeeping in Africa, honey harvesting', url: 'https://www.fao.org/4/t0104e/T0104E08.htm' }] : [])] };
    });
  });
  return { foodForest, animalProducts };
}

/** Pure snapshot adapter, shared by app and site-report purchasing guidance. */
export function productContextFromItems(items: readonly PlacedPlant[]): ProductGuideContext {
  return { trees: placedTreeGroups(items), animals: placedAnimalGroups(items), bananaCircles: bananaCirclesIn(items) };
}

export function productPurchasingMarkdown(context: ProductGuideContext, zones: readonly GrowingZoneId[], conditions?: SiteProductionConditions): string {
  const guide = buildProductGuidance(context, zones, conditions);
  if (!guide.foodForest.length && !guide.animalProducts.length) return '';
  return ['## Production purchases and variety assumptions', 'Research checked 4 October 2026. Buy only proposed stock after checking local suitability. Existing plants and structures are inventory, not repeat purchases. Early/middle/late describes picking order; compatible flowering is a separate pollination check. Expected seasons describe established production, not guaranteed food this year.', ...[...guide.foodForest, ...guide.animalProducts].flatMap(item => [`### ${item.title}`, ...item.lines.filter(line => /existing;|Buying advice:|Assumed|Pollination:|Cold-area|Observed frost|Edible bananas|Count assumption|First crop|First product|Enterprise options:|No animal|Choose the product|For eggs/.test(line)), ...(item.sources ?? []).map(s => `Source: [${s.label}](${s.url})`)])].join('\n\n');
}
