// Scale-of-permanence evidence catalogue for ImbewuField site assessments

export interface EvidenceCatalogueItem {
  key: string;
  label: string;
  docOnly?: boolean;  // PDF / document tile (not a photo)
  invasive?: boolean; // flagged red
  mentorOnly?: boolean;
}

export interface EvidenceCatalogueGroup {
  key: string;
  label: string;
  color: string;       // text / border colour
  bg: string;          // chip background
  iconBg: string;      // icon badge background
  description?: string;
  items: EvidenceCatalogueItem[];
}

export const EVIDENCE_CATALOGUE: EvidenceCatalogueGroup[] = [
  {
    key: 'water',
    label: 'Water',
    color: '#2E6E96',
    bg: '#EAF2F7',
    iconBg: '#DCEAF2',
    items: [
      { key: 'rain_tanks', label: 'Rain tanks & JoJos' },
      { key: 'gutters', label: 'Gutters & downpipes' },
      { key: 'borehole', label: 'Borehole / wellpoint' },
      { key: 'dam_pond', label: 'Dam / pond / stream' },
      { key: 'spring', label: 'Spring / seep' },
      { key: 'irrigation', label: 'Irrigation & pumps' },
      { key: 'swales', label: 'Swales / berms' },
      { key: 'water_bills', label: 'Water bills / test', docOnly: true },
      { key: 'lab_result', label: 'Lab water test result', docOnly: true },
    ],
  },
  {
    key: 'structures',
    label: 'Structures & access',
    color: '#7A6243',
    bg: '#F2EDE2',
    iconBg: '#E7E0D2',
    items: [
      { key: 'house_roof', label: 'House & roof' },
      { key: 'sheds', label: 'Sheds & outbuildings' },
      { key: 'fencing', label: 'Fencing & type' },
      { key: 'gates', label: 'Gates' },
      { key: 'greenhouse', label: 'Greenhouse / tunnel' },
      { key: 'roads', label: 'Roads, tracks & paths' },
      { key: 'tool_store', label: 'Tool / equipment store' },
    ],
  },
  {
    key: 'soil',
    label: 'Soil & growing beds',
    color: '#9A6E2E',
    bg: '#F6ECD9',
    iconBg: '#EFE3CE',
    items: [
      { key: 'soil_photos', label: 'Soil photos (across land)' },
      { key: 'jar_test', label: 'Jar / settle test' },
      { key: 'veg_beds', label: 'Existing veg beds' },
      { key: 'compost', label: 'Compost & manure bays' },
      { key: 'mulch', label: 'Mulch / ground cover' },
      { key: 'erosion', label: 'Erosion / bare patches' },
      { key: 'lab_result', label: 'Lab soil result', docOnly: true },
    ],
  },
  {
    key: 'trees',
    label: 'Existing trees & plants',
    color: '#3C6B3F',
    bg: '#E7F1DD',
    iconBg: '#DDEBCF',
    items: [
      { key: 'fruit_canopy', label: 'Fruit trees — canopy' },
      { key: 'fruit_trunk', label: 'Fruit trees — base & trunk' },
      { key: 'indigenous_edible', label: 'Indigenous edible trees' },
      { key: 'windbreaks', label: 'Windbreaks & hedges' },
      { key: 'grasses', label: 'Grasses & veld' },
      { key: 'invasive', label: 'Invasive / problem plants', invasive: true },
    ],
  },
  {
    key: 'animals',
    label: 'Animal systems',
    color: '#B05A3C',
    bg: '#F6E5DC',
    iconBg: '#F1DDD3',
    items: [
      { key: 'chickens', label: 'Chicken coop / run' },
      { key: 'beehives', label: 'Beehives' },
      { key: 'kraal', label: 'Kraal / livestock pens' },
      { key: 'grazing', label: 'Grazing camps' },
      { key: 'aquaponics', label: 'Fish / aquaponics pond' },
      { key: 'small_stock', label: 'Rabbit / small stock' },
    ],
  },
  {
    key: 'energy',
    label: 'Energy & power',
    color: '#B07A1E',
    bg: '#F7EFD6',
    iconBg: '#F6ECCF',
    items: [
      { key: 'grid', label: 'Grid connection / box' },
      { key: 'solar', label: 'Solar panels & battery' },
      { key: 'generator', label: 'Generator' },
      { key: 'gas_cooking', label: 'Gas / wood cooking' },
      { key: 'electricity_bills', label: 'Electricity bills', docOnly: true },
    ],
  },
  {
    key: 'land_legal',
    label: 'Land & legal',
    color: '#4A5578',
    bg: '#EAECF3',
    iconBg: '#DFE2EE',
    items: [
      // CASP and comparable SA smallholder funding programmes ask for these by name. Every tile
      // here is docOnly — the same capture flow as water_bills / lab_result / electricity_bills
      // above, not a new one — because these are papers to photograph or upload, not garden shots.
      { key: 'pto_lease_title', label: 'PTO / lease / title deed', docOnly: true },
      { key: 'certified_id', label: 'Certified ID copy', docOnly: true },
      { key: 'bank_confirmation', label: 'Bank confirmation letter', docOnly: true },
      { key: 'water_use_licence', label: 'Water-use licence', docOnly: true },
      { key: 'dam_registration', label: 'Dam registration certificate', docOnly: true },
    ],
  },
];

// Quick-number fields per group for the evidence sheet
export const QUICK_NUMBERS: Record<string, { key: string; label: string; unit: string }[]> = {
  water: [
    { key: 'borehole_yield', label: 'Borehole yield', unit: 'L/hr' },
    { key: 'monthly_municipal', label: 'Monthly municipal water', unit: 'kL' },
    { key: 'tank_capacity', label: 'Total tank capacity', unit: 'L' },
  ],
  energy: [
    { key: 'monthly_kwh', label: 'Monthly electricity', unit: 'kWh' },
    { key: 'solar_kw', label: 'Solar capacity', unit: 'kW' },
  ],
};

/**
 * Emoji badge per catalogue group, PLUS the ad hoc 'site_photos' bucket the Reports tab and
 * evidence sheets use for the farm's general/all-groups photo roll — it is not a catalogue
 * group (no items[] of its own), but it opens the same EvidenceSheet and needs the same badge.
 *
 * Three call sites used to keep their own copy of this map. The Reports tab's "Site photos"
 * tile (DataPanel.tsx) had the 'site_photos' entry; the sheet that tile opens (EvidenceSheet.tsx)
 * did not, so its header badge sat blank — a catalogue entry known in one file and missing from
 * the file that renders it. One map now, so a new group can only ever be un-iconed everywhere
 * or nowhere.
 */
export const EVIDENCE_GROUP_ICON: Record<string, string> = {
  water: '💧',
  structures: '🏠',
  soil: '🌱',
  trees: '🌿',
  animals: '🐓',
  energy: '⚡',
  site_photos: '📸',
};

const evidenceGroupsByKey = new Map(EVIDENCE_CATALOGUE.map((group) => [group.key, group]));
const evidenceStorageKeys = new Set(EVIDENCE_CATALOGUE.flatMap((group) => [
  `${group.key}_site_photos`,
  ...group.items.map((item) => `${group.key}_${item.key}`),
]));
const quickNumberFields = new Map(Object.entries(QUICK_NUMBERS).map(([groupKey, fields]) => [
  groupKey,
  new Set(fields.map((field) => field.key)),
]));

/** True only for one of the catalogue's report sections. */
export function isEvidenceGroupKey(value: string): boolean {
  return evidenceGroupsByKey.has(value);
}

/**
 * True only for a storage key produced by an evidence tile or a group's
 * general site-photos sheet.
 */
export function isEvidenceStorageKey(value: string): boolean {
  return evidenceStorageKeys.has(value);
}

/** Match a storage key to a group without relying on a shared string prefix. */
export function evidenceStorageKeyBelongsToGroup(storageKey: string, groupKey: string): boolean {
  if (!isEvidenceGroupKey(groupKey) || !isEvidenceStorageKey(storageKey)) return false;
  return storageKey === `${groupKey}_site_photos`
    || evidenceGroupsByKey.get(groupKey)!.items.some(
      (item) => storageKey === `${groupKey}_${item.key}`,
    );
}

/**
 * Turn a storage key back into something a person — or a model — can read.
 *
 * Storage keys are `<group>_<item>` (`soil_compaction`) plus a per-group `<group>_site_photos`
 * catch-all. The report used to send the raw key with the underscores swapped for spaces, which
 * turns `trees_windbreak` into "trees windbreak" and `water_dam_pond` into "water dam pond" — a
 * model can guess at those, and guessing is the one thing this report may not do. Returns null for
 * a key the catalogue does not know, so a caller can drop it rather than print it.
 */
export function evidenceKeyLabel(storageKey: string): { group: string; item: string } | null {
  if (!isEvidenceStorageKey(storageKey)) return null;
  for (const group of EVIDENCE_CATALOGUE) {
    if (storageKey === `${group.key}_site_photos`) {
      return { group: group.label, item: 'General site photos' };
    }
    const item = group.items.find((i) => storageKey === `${group.key}_${i.key}`);
    if (item) return { group: group.label, item: item.label };
  }
  return null;
}

/** True only for a quick-number field shown for the specified catalogue group. */
export function isQuickNumberField(groupKey: string, fieldKey: string): boolean {
  return quickNumberFields.get(groupKey)?.has(fieldKey) ?? false;
}

// Lima coaching tips per evidence group
export const LIMA_TIPS: Record<string, string> = {
  water: '"Keep a clear photo of the municipal bill, then enter its litres in the quick numbers so the report can use the measured amount."',
  soil: '"Keep soil photos from at least 3 different spots, corner to corner, and add a note about what you saw at each spot."',
  trees: '"For fruit trees, keep two shots: canopy from 5 m back, then base and trunk up close. Add the known name, or note that a mentor must confirm it."',
  structures: '"Stand back to record the whole roof, add a note about its condition, and trace it on the map for a measured catchment area."',
  animals: '"Record even empty kraals and coops, and add a note naming the animals they serve so the report has useful context."',
  energy: '"Keep a clear photo of the electricity bill, then enter the monthly kWh in the quick numbers so the report can use it."',
  land_legal: '"Photograph or scan every page flat and in good light, including stamps, signatures and dates — a funder has to be able to read every word, and keep the real paper safe too, this app is not where it is kept."',
};

export const INDIGENOUS_EDIBLES = [
  { name: 'Marula', sci: 'Sclerocarya birrea', desc: 'Fruit, juice, beer, kernel oil', protected: true },
  { name: 'Wild plum', sci: 'Harpephyllum caffrum', desc: 'Red edible fruit · fast shade · KZN coast', protected: false },
  { name: 'Mobola plum', sci: 'Parinari curatellifolia', desc: 'Sweet fruit · drought-hardy', protected: false },
  { name: 'Monkey orange', sci: 'Strychnos spinosa', desc: 'Hard-shell fruit · roadside trade', protected: false },
  { name: 'Kei apple', sci: 'Dovyalis caffra', desc: 'Tart fruit · thorny living fence', protected: false },
  { name: 'Wild medlar', sci: 'Vangueria infausta', desc: 'Brown edible fruit · bushveld', protected: false },
  { name: 'Red milkwood', sci: 'Mimusops caffra', desc: 'Edible berries · evergreen shade', protected: false },
];
