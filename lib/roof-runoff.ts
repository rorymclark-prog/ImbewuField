// One authority for every generic roof-catchment coefficient in the app.
//
// Recommendation for the eventual single value: 0.80. South Africa's Department of Human
// Settlements/CSIR Red Book says roof coefficients vary with surface and rainfall, lists 0.85 for
// a pitched tiled roof, and says 0.80 is the usual general roof efficiency. ImbewuField does not
// yet ask for roof material, gutter condition or first-flush loss, so the more conservative generic
// assumption is the more honest one:
// https://www.dhs.gov.za/sites/default/files/documents/Redbook/REDBOOK_Section_J_Water_v1-1.pdf
//
// Changing a farmer-facing agronomic figure needs Rory's approval. Until then, preserve the two
// existing outputs here, visibly and audibly, instead of silently changing the Tank Calculator
// from 0.85 to the recommended 0.80. Both consumers now derive from this object, so a future
// decision is one reviewed edit and the values cannot drift unnoticed in distant modules.
export const ROOF_RUNOFF_COEFFICIENTS = Object.freeze({
  waterSheet: 0.8,
  tankCalculator: 0.85,
} as const);

export const WATER_SHEET_ROOF_RUNOFF_COEFFICIENT = ROOF_RUNOFF_COEFFICIENTS.waterSheet;
export const TANK_CALCULATOR_ROOF_RUNOFF_COEFFICIENT = ROOF_RUNOFF_COEFFICIENTS.tankCalculator;

// Legacy facilitator sheets explicitly model a roof MATERIAL, unlike the generic Design Studio
// paths above. Keep the published values unchanged, but own them here so a fourth private runoff
// table cannot appear unnoticed. `describeHarvest` still defaults to metal because its callers do
// not yet collect material; that assumption is now visible and reportable rather than buried.
export const ROOF_MATERIAL_RUNOFF_COEFFICIENTS = Object.freeze({
  metal: 0.9,
  tile: 0.85,
  thatch: 0.6,
} as const);

/** Dimensional identity: 1 mm on 1 m² is 1 L before the bounded loss coefficient. */
export function roofHarvestLitres(
  roofAreaM2: number,
  rainfallMm: number,
  coefficient: number,
): number {
  if (
    !Number.isFinite(roofAreaM2)
    || !Number.isFinite(rainfallMm)
    || !Number.isFinite(coefficient)
    || roofAreaM2 <= 0
    || rainfallMm <= 0
    || coefficient <= 0
    || coefficient > 1
  ) return 0;
  const litres = roofAreaM2 * rainfallMm * coefficient;
  return Number.isFinite(litres) && litres > 0 ? litres : 0;
}
