/**
 * Which drawing recipe produced a saved sheet.
 *
 * PLAN_VERSION describes what the plan contains and deliberately does not move for every visual
 * repair, because moving it hides paid renders from the farmer. The recipe is narrower: it lets
 * the gallery keep those renders while saying plainly that a bitmap made before a framing or
 * compositing repair will not redraw itself after an app update.
 */
export const SHEET_RENDER_RECIPE = 'r5';

export type SavedSheetFreshness = 'current' | 'older-plan' | 'older-render';

export function savedSheetFreshness(
  saved: { planVersion?: string; renderRecipe?: string },
  currentPlanVersion: string,
  currentRenderRecipe: string = SHEET_RENDER_RECIPE,
): SavedSheetFreshness {
  if (saved.planVersion !== currentPlanVersion) return 'older-plan';
  if (saved.renderRecipe !== currentRenderRecipe) return 'older-render';
  return 'current';
}
