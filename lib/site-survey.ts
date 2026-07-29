import { getFirebase } from './firebase/init';
import { upsertSurvey } from './user-sync';
import { loadPlaces } from './saved-places';
import { canonicalCoordinateSiteId, coordinateSiteIdParts } from './site-id';

export interface SiteSurvey {
  siteId: string;   // canonical key: designSiteIdFromLocation()'s `site:${lat.toFixed(5)},${lon.toFixed(5)}`
  placeId: string;  // legacy key (SavedPlace id) — kept for provenance/migration, no longer used to store
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
  roofAreaSource?: 'auto' | 'manual'; // 'auto' = last set from traced map shapes, farmer hasn't overridden

  // Screen 3 — Land & soil
  landPrepMethod: string;   // 'hand' | 'tractor' | 'animal' | 'none'
  soilCondition: string;    // 'healthy' | 'compacted' | 'sandy' | 'clay' | 'unknown'
  soilAmendments: string[]; // 'compost' | 'kraal-manure' | 'mulch' | 'commercial-fert' | 'none'
  hasFencing: string;       // 'full' | 'partial' | 'none'

  // Screen 4 — What exists
  existingCrops: string[];  // 'vegetables' | 'fruit-trees' | 'herbs' | 'indigenous' | 'fodder' | 'grain' | 'nothing'
  existingGrowingAreaM2: number | null;
  existingGrowingAreaSource?: 'auto' | 'manual'; // 'auto' = last set from traced map shapes, farmer hasn't overridden
  livestock: string[];      // 'chickens' | 'goats' | 'cattle' | 'pigs' | 'bees' | 'none'
  otherInfra: string[];     // 'shade-tunnel' | 'greenhouse' | 'compost-bay' | 'shed' | 'kraal'

  // Screen 5 — Challenges & commercial
  farmingPractice: string;  // 'organic' | 'mostly-organic' | 'conventional' | 'experimenting'
  challenges: string[];
  isCommercial: boolean;
  marketType?: string;      // 'farm-stall' | 'local-market' | 'wholesale' | 'not-sure'

  notes: string;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const entry of value) {
    const text = stringValue(entry);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    clean.push(text);
  }
  return clean;
}

function areaValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function normaliseSurvey(value: unknown, siteId: string): SiteSurvey | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !siteId) return null;
  const row = value as Partial<SiteSurvey>;
  const roofAreaSource = row.roofAreaSource === 'auto' || row.roofAreaSource === 'manual'
    ? row.roofAreaSource
    : undefined;
  const existingGrowingAreaSource = row.existingGrowingAreaSource === 'auto'
    || row.existingGrowingAreaSource === 'manual'
    ? row.existingGrowingAreaSource
    : undefined;
  return {
    siteId,
    placeId: stringValue(row.placeId),
    savedAt: stringValue(row.savedAt),
    updatedAt: typeof row.updatedAt === 'number'
      && Number.isFinite(row.updatedAt)
      && row.updatedAt >= 0
      ? row.updatedAt
      : undefined,
    siteType: row.siteType === 'community' ? 'community' : 'homestead',
    adults: stringValue(row.adults),
    memberCount: stringValue(row.memberCount) || undefined,
    goals: stringArray(row.goals),
    waterSource: stringArray(row.waterSource),
    waterDelivery: stringArray(row.waterDelivery),
    waterStorage: stringArray(row.waterStorage),
    roofMainM2: areaValue(row.roofMainM2),
    roofSecondaryM2: areaValue(row.roofSecondaryM2),
    hasGutters: row.hasGutters === true,
    roofAreaSource,
    landPrepMethod: stringValue(row.landPrepMethod),
    soilCondition: stringValue(row.soilCondition),
    soilAmendments: stringArray(row.soilAmendments),
    hasFencing: stringValue(row.hasFencing),
    existingCrops: stringArray(row.existingCrops),
    existingGrowingAreaM2: areaValue(row.existingGrowingAreaM2),
    existingGrowingAreaSource,
    livestock: stringArray(row.livestock),
    otherInfra: stringArray(row.otherInfra),
    farmingPractice: stringValue(row.farmingPractice),
    challenges: stringArray(row.challenges),
    isCommercial: row.isCommercial === true,
    marketType: stringValue(row.marketType) || undefined,
    notes: stringValue(row.notes),
  };
}

export function surveyToPrompt(s: SiteSurvey, annualRainfallMm: number): string {
  // Reports are a public boundary for long-lived browser data. Normalise again
  // even though load/save do it, because API callers can pass decoded JSON directly.
  s = normaliseSurvey(s, stringValue(s?.siteId) || 'site:unknown')
    ?? normaliseSurvey({}, 'site:unknown')!;
  const totalRoof = (s.roofMainM2 ?? 0) + (s.roofSecondaryM2 ?? 0);
  const rainfallMm = Number.isFinite(annualRainfallMm) && annualRainfallMm >= 0
    ? annualRainfallMm
    : null;
  const efficiency = s.hasGutters ? 0.80 : 0.60;
  const roofHarvestKL = totalRoof > 0 && rainfallMm !== null
    ? Math.round(totalRoof * rainfallMm * efficiency / 1000)
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
    if (roofHarvestKL !== null) {
      lines.push(`Estimated annual roof harvest at ${rainfallMm} mm rainfall: ~${roofHarvestKL} kL`);
      lines.push(`Use this figure to size storage tanks and prioritise swale / contour placement.`);
    } else {
      lines.push('Estimated annual roof harvest: unavailable until annual rainfall is known.');
    }
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
  if (s.existingGrowingAreaM2 && s.existingGrowingAreaM2 > 0) {
    lines.push(`Existing growing area (traced or entered): ${s.existingGrowingAreaM2} m²`);
  }
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

const key = (id: string) => `imbewu_site_survey_${id}`;

export const canonicalSurveySiteId = canonicalCoordinateSiteId;

// One-time read-repair: survey answers saved under the old placeId-keyed scheme (before the
// storage key was switched to the lat/lon-derived siteId) would otherwise never be found by
// callers that only know the coordinate-derived siteId. Coordinate-match against SavedPlace,
// look up the legacy key, and copy the data forward (localStorage + Firestore) so it's found
// directly next time and syncs to other devices.
function migrateLegacySurvey(siteId: string): SiteSurvey | null {
  if (typeof window === 'undefined') return null;
  const canonicalSiteId = canonicalSurveySiteId(siteId);
  if (!canonicalSiteId) return null;
  const parts = coordinateSiteIdParts(canonicalSiteId);
  if (!parts) return null;
  const place = loadPlaces().find((p) =>
    Number.isFinite(p.lat)
    && Number.isFinite(p.lon)
    && p.lat.toFixed(5) === parts.lat.toFixed(5)
    && p.lon.toFixed(5) === parts.lon.toFixed(5));
  if (!place) return null;

  let legacy: SiteSurvey | null;
  try { legacy = JSON.parse(localStorage.getItem(key(place.id)) ?? 'null'); } catch { legacy = null; }
  const repaired = normaliseSurvey(legacy, canonicalSiteId);
  if (!repaired) return null;

  const migrated: SiteSurvey = repaired;
  try { localStorage.setItem(key(canonicalSiteId), JSON.stringify(migrated)); } catch {}
  const uid = getFirebase()?.auth?.currentUser?.uid;
  if (uid) upsertSurvey(uid, migrated).catch(() => {});
  return migrated;
}

export function loadSurvey(siteId: string): SiteSurvey | null {
  if (typeof window === 'undefined') return null;
  const canonicalSiteId = canonicalSurveySiteId(siteId);
  if (!canonicalSiteId) return null;
  try {
    const direct = JSON.parse(localStorage.getItem(key(canonicalSiteId)) ?? 'null');
    const repaired = normaliseSurvey(direct, canonicalSiteId);
    if (repaired) return repaired;
  } catch {}
  return migrateLegacySurvey(canonicalSiteId);
}

export function saveSurvey(survey: SiteSurvey): SiteSurvey | null {
  if (typeof window === 'undefined') return null;
  const siteId = canonicalSurveySiteId(survey?.siteId);
  if (!siteId) return null;
  const clean = normaliseSurvey(survey, siteId);
  if (!clean) return null;
  const stamped: SiteSurvey = { ...clean, updatedAt: Date.now() };
  try {
    localStorage.setItem(key(stamped.siteId), JSON.stringify(stamped));
  } catch {
    return null;
  }
  window.dispatchEvent(new CustomEvent('imbewu-surveys-changed'));
  const uid = getFirebase()?.auth?.currentUser?.uid;
  if (uid) upsertSurvey(uid, stamped).catch(() => {});
  return stamped;
}
