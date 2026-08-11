/**
 * WHICH GENERATION OF THE PLAN SET THE APP RENDERS TODAY.
 *
 * This used to live inside components/design/DesignGlossy.tsx, where the sheets are drawn — which
 * was right while the sheet renderer was the only thing that cared. It is not any more: the report
 * appendix has to know which saved sheets are current, so that a plate from an older era of the
 * render rules is not printed as though it were today's plan (lib/report-plates.ts).
 *
 * One home, because two copies of a version number is the same defect this codebase keeps finding
 * in other shapes — a coarse biome beside a precise one, a stamp beside a merge sha. The moment a
 * second module needed this, a second literal would have drifted from the first on the next bump.
 *
 * THE BUMP PROTOCOL AND ITS CHANGELOG STAY WITH THE RENDERER, next to the drawing rules whose
 * changes justify a bump. Only the value moved.
 */
export const PLAN_VERSION = 'v93';
