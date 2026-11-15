/** Survey roof entries are a separate source from traced geometry. Keep their
 * validation shared without importing browser storage/sync into report code. */
export interface SurveyRoofEvidence {
  mainM2: number | null;
  secondaryM2: number | null;
  mainSource?: 'auto' | 'manual';
  secondarySource?: 'auto' | 'manual';
  /** Sum of supplied components, not proof that every roof was measured. */
  subtotalM2: number | null;
}

export function surveyRoofEvidence(value: unknown): SurveyRoofEvidence {
  const row = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  const area = (input: unknown) => typeof input === 'number' && Number.isFinite(input) && input >= 0 ? input : null;
  const source = (input: unknown) => input === 'auto' || input === 'manual' ? input : undefined;
  const mainM2 = area(row.roofMainM2), secondaryM2 = area(row.roofSecondaryM2);
  const sum = mainM2 === null && secondaryM2 === null ? null : (mainM2 ?? 0) + (secondaryM2 ?? 0);
  return { mainM2, secondaryM2, mainSource: source(row.roofAreaSource), secondarySource: source(row.roofSecondarySource),
    subtotalM2: sum !== null && Number.isFinite(sum) ? sum : null };
}
