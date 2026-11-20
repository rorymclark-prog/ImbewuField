/** Report-only view of survey choices. Never merge these with mapped features or
 * infer installed quantities, capacity or reliable supply from a checkbox. */
export interface SurveyWaterEvidence {
  sources: string[];
  delivery: string[];
  storage: string[];
}

// Exact existing SiteSurveySheet option IDs/labels, not guesses from prose.
const SOURCE_LABELS: Record<string, string> = {
  municipal: 'Municipal tap', borehole: 'Borehole', river: 'River / stream',
  rainwater: 'Rainwater', grey: 'Grey water', none: 'No water yet',
};
const DELIVERY_LABELS: Record<string, string> = {
  drip: 'Drip irrigation', sprinkler: 'Sprinkler', piped: 'Piped to tap / hose',
  gravity: 'Gravity-fed', bucket: 'Hand-watered', flood: 'Flood / furrow', none: 'Rain-fed only',
};
const STORAGE_LABELS: Record<string, string> = {
  jojo: 'Jojo / plastic tanks', dam: 'Earth dam', pond: 'Pond / retention pit',
  cistern: 'Underground cistern', none: 'No storage',
};

// Match the saved survey's trim/dedupe semantics, without changing that record.
const choices = (input: unknown): string[] => Array.isArray(input)
    ? [...new Set(input.filter((entry): entry is string => typeof entry === 'string').map(entry => entry.trim()).filter(Boolean))]
    : [];

/** Older surveys stored one watering method as text. Keep that answer at both
 * read/report boundaries; other multi-choice fields have no such legacy shape. */
export function surveyWaterDeliveryChoices(value: unknown): string[] {
  return choices(typeof value === 'string' ? [value] : value);
}

export function surveyWaterEvidence(value: unknown): SurveyWaterEvidence | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  return { sources: choices(row.waterSource), delivery: surveyWaterDeliveryChoices(row.waterDelivery), storage: choices(row.waterStorage) };
}

export function surveyWaterSummary(evidence: SurveyWaterEvidence | undefined): string | null {
  if (!evidence) return null;
  // Unknown historic entries remain visible, but cannot create report rows/headings
  // or acquire the meaning of a known infrastructure choice. Originals stay intact.
  const structural = new Set("\\`*_{}[]<>#|\r\n");
  const unknown = (entry: string) => Array.from(entry, character => structural.has(character)
    ? String.fromCharCode(92) + 'u' + character.charCodeAt(0).toString(16).padStart(4, '0') : character).join('');
  const list = (entries: string[], labels: Record<string, string>) => entries.length
    ? entries.map(entry => Object.hasOwn(labels, entry) ? labels[entry] : `unrecognized reported entry: ${unknown(entry)}`).join(', ')
    : 'not recorded';
  const conflict = [evidence.sources, evidence.delivery, evidence.storage].some(entries => entries.includes('none') && entries.length > 1);
  return `Sources: ${list(evidence.sources, SOURCE_LABELS)}; delivery: ${list(evidence.delivery, DELIVERY_LABELS)}; storage: ${list(evidence.storage, STORAGE_LABELS)}.`
    + (conflict ? ' Conflicting survey choices include none and another answer; verify the report rather than resolving the conflict automatically.' : '');
}

export const SURVEY_WATER_LIMITS = 'Farmer-reported choices, not independently verified access, condition, reliability, count, capacity or available supply. Keep map/design and survey records separate; they may describe the same features. Do not add quantities or silently choose between conflicting sources.';
