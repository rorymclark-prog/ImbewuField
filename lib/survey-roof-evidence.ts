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

/** Display the sum of the recorded canonical decimal components without binary
 * addition tails. Keep the numeric subtotal and harvest arithmetic untouched. */
export function surveyRoofSubtotalText(roof: SurveyRoofEvidence): string | null {
  if (roof.subtotalM2 === null || !Number.isFinite(roof.subtotalM2)) return null;
  const parts = [roof.mainM2, roof.secondaryM2].filter((value): value is number => value !== null);
  if (parts.length < 2) return String(roof.subtotalM2);
  const decimal = parts.map(value => {
    const [mantissa, exponent = '0'] = String(value).split('e');
    const fractionLength = mantissa.split('.')[1]?.length ?? 0;
    return { digits: BigInt(mantissa.replace('.', '')), power: Number(exponent) - fractionLength };
  });
  // Validated finite Number components bound this alignment, including exponent notation.
  const power = Math.min(...decimal.map(part => part.power));
  const digits = decimal.reduce((sum, part) => sum + part.digits * BigInt(10) ** BigInt(part.power - power), BigInt(0));
  const displayed = Number(`${digits}e${power}`);
  return String(Number.isFinite(displayed) ? displayed : roof.subtotalM2);
}
