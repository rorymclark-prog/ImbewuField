import { getFirebase } from './firebase/init';
import { upsertSurvey } from './user-sync';

export interface SiteSurvey {
  placeId: string;
  savedAt: string;
  updatedAt?: number; // ms — drives cross-device newest-wins merge

  // Branching
  siteType: 'homestead' | 'community';

  // Screen 0 — Site & Goals
  adults: string;           // '1' | '2-5' | '6-10' | '10+'
  memberCount?: string;     // community only: 'under-20' | '20-50' | '50+'
  goals: string[];          // 'food' | 'income' | 'soil' | 'education'

  // Screen 1 — Water resources
  waterSource: string[];    // 'municipal' | 'borehole' | 'river' | 'rainwater' | 'grey'
  waterDelivery: string[];  // array: 'piped' | 'gravity' | 'bucket' | 'drip' | 'sprinkler' | 'flood' | 'none'
  waterStorage: string[];   // 'jojo' | 'dam' | 'pond' | 'cistern' | 'none'

  // Screen 2 — Roof catchment
  roofMainM2: number | null;
  roofSecondaryM2: number | null;
  hasGutters: boolean;

  // Screen 3 — Land & soil
  landPrepMethod: string;   // 'hand' | 'tractor' | 'animal' | 'none'
  soilCondition: string;    // 'healthy' | 'compacted' | 'sandy' | 'clay' | 'unknown'
  soilAmendments: string[]; // 'compost' | 'kraal-manure' | 'mulch' | 'commercial-fert' | 'none'
  hasFencing: string;       // 'full' | 'partial' | 'none'

  // Screen 4 — What exists
  existingCrops: string[];  // 'vegetables' | 'fruit-trees' | 'herbs' | 'indigenous' | 'fodder' | 'grain' | 'nothing'
  livestock: string[];      // 'chickens' | 'goats' | 'cattle' | 'pigs' | 'bees' | 'none'
  otherInfra: string[];     // 'shade-tunnel' | 'greenhouse' | 'compost-bay' | 'shed' | 'kraal'

  // Screen 5 — Challenges & commercial
  farmingPractice: string;  // 'organic' | 'mostly-organic' | 'conventional' | 'experimenting'
  challenges: string[];
  isCommercial: boolean;
  marketType?: string;      // 'farm-stall' | 'local-market' | 'wholesale' | 'not-sure'

  notes: string;
}

export function surveyToPrompt(s: SiteSurvey, annualRainfallMm: number): string {
  // Older-schema surveys loaded from localStorage may be missing array fields entirely.
  // Default them all so the .map/.filter/.join calls below never throw (report 500).
  s = {
    ...s,
    goals: s.goals ?? [], waterSource: s.waterSource ?? [], waterStorage: s.waterStorage ?? [],
    soilAmendments: s.soilAmendments ?? [], existingCrops: s.existingCrops ?? [],
    livestock: s.livestock ?? [], challenges: s.challenges ?? [], otherInfra: s.otherInfra ?? [],
  };
  const totalRoof = (s.roofMainM2 ?? 0) + (s.roofSecondaryM2 ?? 0);
  const efficiency = s.hasGutters ? 0.80 : 0.60;
  const roofHarvestKL = totalRoof > 0
    ? Math.round(totalRoof * annualRainfallMm * efficiency / 1000)
    : null;

  const goalLabels: Record<string, string> = {
    food: 'food security for household',
    income: 'generate income from produce',
    soil: 'restore / rebuild the soil',
    education: 'education / demonstration site',
  };
  const deliveryLabels: Record<string, string> = {
    piped: 'piped tap', gravity: 'gravity-fed', bucket: 'hand-watered by bucket',
    drip: 'drip irrigation', sprinkler: 'sprinkler', flood: 'flood/furrow irrigation', none: 'no irrigation yet',
  };
  const prepLabels: Record<string, string> = {
    hand: 'hand tools', tractor: 'tractor', animal: 'animal draft (ox/donkey)', none: 'not yet prepared',
  };

  const lines: string[] = [
    `Site type: ${s.siteType === 'community' ? 'Community garden / cooperative' : 'Household homestead'}`,
  ];
  if (s.siteType === 'community' && s.memberCount) {
    lines.push(`Members involved: ${s.memberCount}`);
  } else {
    lines.push(`Adults working this land: ${s.adults || 'not specified'}`);
  }
  lines.push(`Goals: ${s.goals.map(g => goalLabels[g] ?? g).join('; ') || 'not specified'}`);

  lines.push('');
  lines.push('--- WATER RESOURCES ---');
  lines.push(`Sources available: ${s.waterSource.length ? s.waterSource.join(', ') : 'none specified'}`);
  const deliveryArr = Array.isArray(s.waterDelivery) ? s.waterDelivery : (s.waterDelivery ? [s.waterDelivery] : []);
  lines.push(`Delivery / irrigation: ${deliveryArr.map(v => deliveryLabels[v] ?? v).join(' + ') || 'not specified'}`);
  lines.push(`On-site water storage: ${s.waterStorage.filter(v => v !== 'none').join(', ') || 'none'}`);

  lines.push('');
  lines.push('--- ROOF CATCHMENT ---');
  if (totalRoof > 0) {
    if (s.roofMainM2) lines.push(`Main building roof: ${s.roofMainM2} m²`);
    if (s.roofSecondaryM2 && s.roofSecondaryM2 > 0) lines.push(`Secondary roofs (barn/shed/other): ${s.roofSecondaryM2} m²`);
    lines.push(`Gutters & downpipes in place: ${s.hasGutters ? 'Yes' : 'No (using 60% efficiency)'}`);
    lines.push(`Total harvestable roof area: ${totalRoof} m²`);
    lines.push(`Estimated annual roof harvest at ${annualRainfallMm} mm rainfall: ~${roofHarvestKL} kL`);
    lines.push(`Use this figure to size storage tanks and prioritise swale / contour placement.`);
  } else {
    lines.push(`Roof area: not measured — rely on location rainfall data for water yield estimates.`);
  }

  lines.push('');
  lines.push('--- LAND & SOIL ---');
  lines.push(`Land preparation method: ${(prepLabels[s.landPrepMethod] ?? s.landPrepMethod) || 'not specified'}`);
  lines.push(`Soil condition (self-assessed): ${s.soilCondition || 'not assessed'}`);
  lines.push(`Soil amendments applied: ${s.soilAmendments.filter(v => v !== 'none').join(', ') || 'none'}`);
  lines.push(`Fencing: ${s.hasFencing || 'not specified'}`);

  lines.push('');
  lines.push('--- EXISTING RESOURCES ---');
  lines.push(`Crops growing now: ${s.existingCrops.filter(v => v !== 'nothing').join(', ') || 'nothing yet'}`);
  lines.push(`Livestock: ${s.livestock.filter(v => v !== 'none').join(', ') || 'none'}`);
  lines.push(`Other infrastructure: ${s.otherInfra.length ? s.otherInfra.join(', ') : 'none mentioned'}`);

  lines.push('');
  lines.push('--- APPROACH & CONSTRAINTS ---');
  lines.push(`Farming practice: ${s.farmingPractice || 'not specified'}`);
  lines.push(`Main challenges: ${s.challenges.length ? s.challenges.join(', ') : 'none highlighted'}`);
  if (s.isCommercial) {
    lines.push(`Selling produce: Yes — ${s.marketType ?? 'market type not specified'}`);
  } else {
    lines.push(`Selling produce: No (household / community use)`);
  }

  if (s.notes) {
    lines.push('');
    lines.push('--- FARMER NOTES ---');
    lines.push(s.notes);
  }

  return lines.join('\n');
}

const key = (placeId: string) => `imbewu_site_survey_${placeId}`;

export function loadSurvey(placeId: string): SiteSurvey | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(key(placeId)) ?? 'null'); } catch { return null; }
}

export function saveSurvey(survey: SiteSurvey): void {
  if (typeof window === 'undefined') return;
  const stamped = { ...survey, updatedAt: Date.now() };
  try { localStorage.setItem(key(stamped.placeId), JSON.stringify(stamped)); } catch {}
  window.dispatchEvent(new CustomEvent('imbewu-surveys-changed'));
  const uid = getFirebase()?.auth?.currentUser?.uid;
  if (uid) upsertSurvey(uid, stamped).catch(() => {});
}
