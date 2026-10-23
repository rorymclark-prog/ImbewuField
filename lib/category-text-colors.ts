import type { ModuleCategory } from './course-modules';

// Text-safe, theme-following variant of CATEGORY_COLORS (w16-03). Raw category hues fail as text in
// dark (forest/soil/business 1.7-3.2:1) and seeds fails in light (2.81:1); ochre (design) is a FILL
// (2.54:1 on paper, CLAUDE.md). Every category chip/label that paints readable TEXT with the
// category colour uses this map: each value is a --cat-<name>-text token declared in all four theme
// columns of app/globals.css. These are var() strings, so never append a hex alpha ('+ "15"') to
// them -- tint with color-mix(in srgb, ...) and keep CATEGORY_COLORS for fills, borders and icons.
// It lives beside lib/course-modules.ts rather than in it so the canonical course source (which the
// Study translation proofs pin byte for byte) does not move; the older light-only
// CATEGORY_TEXT_COLORS there is no longer imported by any screen.
export const CATEGORY_TEXT_COLORS: Record<ModuleCategory, string> = {
  foundation: "var(--cat-foundation-text)",
  water:      "var(--cat-water-text)",
  soil:       "var(--cat-soil-text)",
  plants:     "var(--cat-plants-text)",
  design:     "var(--cat-design-text)",
  business:   "var(--cat-business-text)",
  seeds:      "var(--cat-seeds-text)",
};
