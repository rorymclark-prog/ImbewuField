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
import type { StylePreset } from '@/lib/producer-prompt';
import type { GlossyLayerFilter } from '@/lib/glossy-filters';

// Moved out of components/design/DesignGlossy.tsx (was a local const at ~291) so this lib carries
// no component dependency. The component re-imports it under the same name, so every existing
// call site (DEFAULT_PRODUCER_STYLE used a dozen+ places in DesignGlossy.tsx) keeps compiling
// unchanged.
export const DEFAULT_PRODUCER_STYLE: StylePreset = 'precision_atlas';

// The 8 plan-set sheets (docs/PLAN-SET-SPEC.md / DESIGN_SHEETS in DesignGlossy.tsx): three
// analytical sheets with their own deterministic renderer (01 Site/base, 02 Sector/sector, 08
// Phasing/implementation), and five design-layer sheets identified by GlossyLayerFilter (03 Zones,
// 04 Water, 05 Planting, 06 Structures, 07 Whole/'all').
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
 * mode 'hybrid' | 'full' are the two AI-underlayer stages of the guided 3-button flow (the
 * farmer's own words: "hybrid AI polish underlayer + our polished elements overlayed" / "full
 * treatment hybrid + 2nd step AI polish" — see lib/locked-polish-flow.ts). Both ALWAYS sanitise
 * the selected style through lockedPolishStyle before using it — the ONE authority for "never a
 * model-chrome style in the locked flow", because a model-chrome style (Satellite Overlay) enqueues
 * showcase:true/geometryLock:false, which breaks the "AI underlayer + exact elements locked on
 * top" promise the 3-button flow makes (and is exactly how Full Treatment died post-payment in
 * e0bf17a).
 *
 * DesignGlossy.tsx's applySheet had its OWN inline copy of that same sanitising rule for
 * base/sector/implementation AI mode:
 *   (cur) => (cur && cur !== 'satellite_overlay' ? cur : DEFAULT_PRODUCER_STYLE)
 * This is provably equivalent to lockedPolishStyle(cur, DEFAULT_PRODUCER_STYLE): isModelChromeStyle
 * (lib/producer-prompt.ts) currently tests only `style === 'satellite_overlay'`, so both rules
 * reduce to "null or satellite_overlay -> DEFAULT_PRODUCER_STYLE, else pass the style through
 * unchanged" for every StylePreset value. Per the truth table:
 *   cur = null                -> inline: DEFAULT   | lockedPolishStyle: DEFAULT   (equal)
 *   cur = 'satellite_overlay' -> inline: DEFAULT   | lockedPolishStyle: DEFAULT   (equal)
 *   cur = anything else       -> inline: cur       | lockedPolishStyle: cur       (equal)
 * so this function uses lockedPolishStyle for EVERY sheet type (base/sector/implementation and
 * every design layer alike) rather than keeping a second, drift-prone copy of the same rule.
 *
 * hybridFlags therefore always comes out {showcase:false, geometryLock:true} for every style the
 * sanitiser can produce (renderAuthorityFlagsForStyle of any non-model-chrome style), matching the
 * app-owned "AI paints texture, app owns geometry/labels/chrome" contract every Hybrid stage makes.
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
  const styleUsed = lockedPolishStyle(selectedStyle, DEFAULT_PRODUCER_STYLE);
  const hybridFlags = renderAuthorityFlagsForStyle(styleUsed);
  // Fixed contract, not style-derived — see doc above for why this is always these exact values.
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
