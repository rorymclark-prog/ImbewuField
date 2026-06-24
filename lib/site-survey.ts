export interface SiteSurvey {
  placeId: string;
  savedAt: string;
  people: string;           // '1' | '2-5' | '5-10' | '10+'
  goal: string;             // 'food' | 'income' | 'soil' | 'education' | 'mixed'
  waterSource: string[];    // 'municipal'|'borehole'|'river'|'rainwater'|'none'
  hasIrrigation: boolean;
  roofAreaM2: number | null;
  infrastructure: string[]; // 'fencing'|'electricity'|'compost'|'greenhouse'|'storage'
  soilCondition: string;    // 'good'|'compacted'|'poor'|'unknown'
  slopeObs: string;         // 'flat'|'gentle'|'steep'
  challenges: string[];     // 'drought'|'pests'|'funding'|'labour'|'market'|'flooding'
  marketAccess: string;     // 'direct'|'local'|'remote'|'none'
  notes: string;
}

export function surveyToPrompt(s: SiteSurvey, annualRainfallMm: number): string {
  const roofLine = s.roofAreaM2
    ? `Roof catchment area: ${s.roofAreaM2} m² → estimated annual roof harvest: ~${Math.round(s.roofAreaM2 * annualRainfallMm * 0.8 / 1000)} kL (at 80% efficiency)`
    : 'Roof catchment area: not measured';
  return [
    `Workers / household members on this site: ${s.people}`,
    `Primary goal: ${{ food: 'Food security for household', income: 'Generate income from produce', soil: 'Restore and rebuild the soil', education: 'Education / demonstration site', mixed: 'Mixed (food + income)' }[s.goal] ?? s.goal}`,
    `Water sources available: ${s.waterSource.length ? s.waterSource.join(', ') : 'none stated'}`,
    `Irrigation: ${s.hasIrrigation ? 'Yes' : 'No'}`,
    roofLine,
    `Infrastructure on site: ${s.infrastructure.length ? s.infrastructure.join(', ') : 'none stated'}`,
    `Soil condition (self-assessed): ${s.soilCondition}`,
    `Slope (self-observed): ${s.slopeObs}`,
    `Main challenges: ${s.challenges.length ? s.challenges.join(', ') : 'none stated'}`,
    `Market access: ${{ direct: 'Direct on-site sales', local: 'Local informal / community market', remote: 'Remote — must transport', none: 'No market currently' }[s.marketAccess] ?? s.marketAccess}`,
    s.notes ? `Additional notes from farmer: "${s.notes}"` : '',
  ].filter(Boolean).join('\n');
}

const KEY = (placeId: string) => `imbewu_site_survey_${placeId}`;

export function loadSurvey(placeId: string): SiteSurvey | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(KEY(placeId)) ?? 'null'); } catch { return null; }
}

export function saveSurvey(survey: SiteSurvey): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(KEY(survey.placeId), JSON.stringify(survey)); } catch {}
}
