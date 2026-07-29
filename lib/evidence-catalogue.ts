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

// Lima coaching tips per evidence group
export const LIMA_TIPS: Record<string, string> = {
  water: '"Keep a clear photo of the municipal bill, then enter its litres in the quick numbers so the report can use the measured amount."',
  soil: '"Keep soil photos from at least 3 different spots, corner to corner, and add a note about what you saw at each spot."',
  trees: '"For fruit trees, keep two shots: canopy from 5 m back, then base and trunk up close. Add the known name, or note that a mentor must confirm it."',
  structures: '"Stand back to record the whole roof, add a note about its condition, and trace it on the map for a measured catchment area."',
  animals: '"Record even empty kraals and coops, and add a note naming the animals they serve so the report has useful context."',
  energy: '"Keep a clear photo of the electricity bill, then enter the monthly kWh in the quick numbers so the report can use it."',
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
