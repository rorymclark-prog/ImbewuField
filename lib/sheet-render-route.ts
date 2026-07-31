// Sheet-render ROUTING DECISION — the ONE authority for "given a sheet + output mode + selected
// style, which renderer runs, with what style, and under what render-authority flags". Pure, no
// React, no side effects.
//
// Before this file the same truth was spread across five places in
// components/design/DesignGlossy.tsx and lib/*: applySheet (seeds exactSheet/producerStyle per
// sheet+mode, sanitising satellite_overlay for base/sector/implementation), runCurrentSheet
// (dispatches on that state), lib/locked-polish-flow.ts's lockedPolishStyle (the guided-flow style
// authority), lib/render-policy.ts's renderAuthorityFlagsForStyle, and the pre-payment guard in
// generateOneViaQueue. That drift has bitten repeatedly — most recently the satellite_overlay Full
// Treatment dead-end (commit e0bf17a, 2026-07-26): lockedPolishStyle() was the fix there, and
// sheetRenderRoute now composes it instead of leaving each call site to re-derive the same rule.
import { lockedPolishStyle, type SheetOutputMode } from '@/lib/locked-polish-flow';
import { renderAuthorityFlagsForStyle, type RenderAuthorityFlags } from '@/lib/render-policy';
import { isModelChromeStyle, type StylePreset } from '@/lib/producer-prompt';
import type { GlossyLayerFilter } from '@/lib/glossy-filters';

// Moved out of components/design/DesignGlossy.tsx (was a local const at ~291) so this lib carries
// no component dependency. The component re-imports it under the same name, so every existing
// call site (DEFAULT_PRODUCER_STYLE used a dozen+ places in DesignGlossy.tsx) keeps compiling
// unchanged.
export const DEFAULT_PRODUCER_STYLE: StylePreset = 'precision_atlas';

// The 9 plan-set sheets (docs/PLAN-SET-SPEC.md / DESIGN_SHEETS in DesignGlossy.tsx): three
// analytical sheets with their own deterministic renderer (01 Site/base, 02 Sector/sector, 09
// Phasing/implementation), and six design-layer sheets identified by GlossyLayerFilter (03 Zones,
// 04 Water, 05 Earthworks, 06 Planting, 07 Structures, 08 Whole/'all'). Earthworks split out of
// Water as its own sheet (05, renumbering Planting/Structures/Whole/Phasing up one each) but needed
// no new SheetRoutePath here — it is a { filter: GlossyLayerFilter } SheetSpec like every other
// design-layer sheet, so it already falls through the generic (not 'exact' in sheet) branch below
// and gets full Hybrid/Full Treatment support the same way Water and Planting do.
export type SheetSpec =
  | { exact: 'base' | 'sector' | 'implementation' }
  | { filter: GlossyLayerFilter };

export type SheetRoutePath =
  | 'render-base'
  | 'render-sector'
  | 'render-implementation'
  | 'render-design-map'
  | 'phasing-queue'
  | 'sector-queue'
  | 'one-via-queue';

export interface SheetRoute {
  path: SheetRoutePath;
  styleUsed: StylePreset | null;
  hybridFlags: RenderAuthorityFlags | null;
  polishFlags: RenderAuthorityFlags | null;
}

/**
 * The one place that decides which renderer a sheet+mode combination runs through.
 *
 * mode 'exact' is always the deterministic, no-AI-cost path: an exact sheet renders through its
 * own rules-engine renderer (renderBaseMap/renderSectorMap/renderImplementationMap in
 * DesignGlossy.tsx); a design-layer sheet renders through the deterministic blueprint
 * (renderDesignMap). Style is meaningless here — styleUsed/hybridFlags/polishFlags are all null.
 *
 * mode 'hybrid' | 'full' preserve the selected visual style exactly, AND the style decides who owns
 * the finished page — because the style already decides everything else about that page.
 *
 * This paragraph used to claim the opposite: "visual style never decides factual authority", with
 * hybridFlags hardcoded to { showcase: false, geometryLock: true } for EVERY style. That is a
 * defensible principle in the abstract, and it was wrong here, because only half the pipeline obeys
 * it. `isModelChromeStyle(style)` — not these flags — already decides the input shape
 * (extendWithLegendPanel, DesignGlossy ~9191), the prompt (buildSatelliteOverlayPrompt, ~9239) and
 * the finisher branch (the model-chrome early return in finishStyledSheet, ~8840).
 *
 * For satellite_overlay the hardcode therefore produced a sheet that was sent to the model as a
 * full page, lettered by the model as a full page, and then handed to the app-chrome compositor —
 * which draws into MAP dimensions while the model's output is 1.28x wider. The result came back
 * horizontally squashed, with the satellite repainted over the model's own artwork, carrying the
 * locked title "04 — WATER, GREYWATER & IRRIGATION" instead of the model's, and grew a SECOND
 * legend panel beside the one the model had already drawn. Nothing threw. Rory reported it as
 * "the quality of the polygons everything is just not good at all".
 *
 * It also meant one style produced two different products depending on which button was pressed:
 * "AI · ALL sheets" went through renderAuthorityFlagsForStyle and came out correct, while the
 * per-sheet Generate came through here and came out squashed.
 *
 * Authority now composes renderAuthorityFlagsForStyle instead of restating it, so the rule has one
 * home. Note this is NOT a revert of c252349's good idea — workflow STAGE still owns the polish
 * flags below, and resultKind (lib/render-jobs.ts) still decouples stage from style. Only the
 * hardcode goes.
 *
 * polishFlags is populated only for mode 'full', mirroring the fixed enqueue values every polish
 * stage uses (generateOneViaQueue/generateSectorViaQueue/generatePhasingViaQueue all enqueue
 * showcase:true, geometryLock:false on their polish branch, regardless of style — the model owns
 * the already-complete polished page at that stage, never geometry-locked. geometryLock:true here
 * would also be a REJECTED combination — hasConflictingRenderAuthority rejects showcase && lock
 * both true).
 */
export function sheetRenderRoute(
  sheet: SheetSpec,
  mode: SheetOutputMode,
  selectedStyle: StylePreset | null,
): SheetRoute {
  if (mode === 'exact') {
    if ('exact' in sheet) {
      const path: SheetRoutePath =
        sheet.exact === 'base'
          ? 'render-base'
          : sheet.exact === 'sector'
            ? 'render-sector'
            : 'render-implementation';
      return { path, styleUsed: null, hybridFlags: null, polishFlags: null };
    }
    return { path: 'render-design-map', styleUsed: null, hybridFlags: null, polishFlags: null };
  }

  // mode is 'hybrid' | 'full' from here.
  //
  // THE THREE ANALYSIS SHEETS CANNOT RUN A MODEL-CHROME STYLE. Site (01), Sector (02) and Phasing
  // (09) composite their own analysis marks, schedule text, labels and legend back over whatever
  // the model returns — that is the entire contract of composeSectorSheet and composePhasingSheet.
  // satellite_overlay's premise is the opposite: the model letters its own page. Running one
  // through the other produces two legends and two sets of labels fighting on one sheet.
  //
  // This rule used to live inside lockedPolishStyle, which applied it to EVERY sheet and so also
  // blocked satellite_overlay on the six design-layer sheets where it is the whole point — the
  // Full Treatment dead-end of e0bf17a. c252349 removed it from there, correctly, and did not put
  // it back anywhere, so applySheet's comment promising "a non-satellite_overlay producer style"
  // became untrue. It belongs here, where the sheet is known.
  const requested = lockedPolishStyle(selectedStyle, DEFAULT_PRODUCER_STYLE);
  const styleUsed = 'exact' in sheet && isModelChromeStyle(requested)
    ? DEFAULT_PRODUCER_STYLE
    : requested;
  const hybridFlags = renderAuthorityFlagsForStyle(styleUsed);
  const polishFlags: RenderAuthorityFlags | null =
    mode === 'full' ? { showcase: true, geometryLock: false } : null;

  const path: SheetRoutePath =
    'exact' in sheet
      ? sheet.exact === 'implementation'
        ? 'phasing-queue' // generatePhasingViaQueue
        : 'sector-queue' // generateSectorViaQueue (base OR sector — one function, a `kind` param)
      : 'one-via-queue'; // generateOneViaQueue

  return { path, styleUsed, hybridFlags, polishFlags };
}
