import type { GlossyLayerFilter } from '@/lib/glossy-filters';
import { groundContractFor, isModelChromeStyle, type StylePreset } from '@/lib/producer-prompt';

export type RenderAuthority = 'app' | 'model';

export interface StyleRenderPolicy {
  authority: RenderAuthority;
  modelChrome: boolean;
  exactGeometry: boolean;
  useStyleReference: boolean;
}

export interface RenderAuthorityFlags {
  showcase: boolean;
  geometryLock: boolean;
}

/**
 * One authority decision for every illustrated style.
 *
 * The app-owned path lets the model paint texture only; exact geometry, labels and sheet chrome are
 * drawn afterwards. Satellite Overlay intentionally remains the reversible model-authored path.
 */
export function renderPolicyForStyle(style: StylePreset): StyleRenderPolicy {
  const modelChrome = isModelChromeStyle(style);
  return {
    authority: modelChrome ? 'model' : 'app',
    modelChrome,
    exactGeometry: !modelChrome,
    useStyleReference: style === 'precision_atlas' && !modelChrome,
  };
}

/** Persisted queue flags derived from the same policy as the UI and finisher. */
export function renderAuthorityFlagsForStyle(style: StylePreset): RenderAuthorityFlags {
  const policy = renderPolicyForStyle(style);
  return {
    showcase: policy.modelChrome,
    geometryLock: policy.exactGeometry,
  };
}

/** A model-authored sheet cannot also promise app-owned exact geometry. */
export function hasConflictingRenderAuthority(flags: Partial<RenderAuthorityFlags>): boolean {
  return flags.showcase === true && flags.geometryLock === true;
}

/** Satellite Overlay is defined by a real photo underneath its model-authored graphics. */
export function styleSupportsGroundSource(
  style: StylePreset,
  groundSource: 'photo' | 'paper',
): boolean {
  return style !== 'satellite_overlay' || groundSource === 'photo';
}

export interface ModelInputMarks {
  showToolGlyphs: boolean;
  showDrivewayEdge: boolean;
  showDesignLines: boolean;
  showDesignItems: boolean;
  showHouseMark: boolean;
  showDrivewayMark: boolean;
  itemGuideStyle?: 'filled' | 'outline' | 'registration';
}

export interface LockedProtectMaskOptions {
  protectOutside: boolean;
  protectLines: boolean;
  protectItems: boolean;
  protectBoundary: boolean;
  protectDriveway: boolean;
  protectHouse: boolean;
  protectUnmarkedGround: boolean;
  houseHaloRatio: number;
  houseFeatherRatio: number;
}

/** Existing access is quiet site context; rendered sheets never add a decorative kerb/casing. */
export const RENDERED_DRIVEWAY_EDGE = false;

/**
 * Exact styles never ask the model to interpret editor markers. The app draws the real layer from
 * saved data after generation, which removes duplicated objects, copied emoji and guessed counts.
 */
export function exactModelInputMarks(_filter: GlossyLayerFilter): ModelInputMarks {
  return {
    showToolGlyphs: false,
    showDrivewayEdge: false,
    showDesignLines: false,
    showDesignItems: false,
    showHouseMark: false,
    showDrivewayMark: false,
  };
}

/**
 * Geometry Lock needs placement geometry and a truthful feature identity.
 *
 * Filled discs and complete canopy rings were copied into both Photo Plan and Reference Blueprint
 * renders as farm features. Registration ticks retain centre, size and rotation without handing
 * the model a full silhouette it can mistake for finished artwork. The small identity glyph stays:
 * saved features can share colour and footprint, so removing the only per-marker cue would let the
 * model swap them while the app's exact label confidently named the wrong feature.
 */
export function polishModelInputMarks(
  style: StylePreset,
  _filter: GlossyLayerFilter,
  groundSource: 'photo' | 'paper' = 'photo',
): ModelInputMarks {
  // On plain paper there is no photographed roof or access track underneath the guide canvas.
  // Keep their existing factual marks there; photo-backed sheets can omit them because the real
  // structures are already present and are restored by the app after generation.
  const ground = groundContractFor(style, groundSource);
  const needsStructureGuides = ground !== 'photo';
  return {
    showToolGlyphs: true,
    showDrivewayEdge: false,
    showDesignLines: true,
    showDesignItems: true,
    showHouseMark: needsStructureGuides,
    showDrivewayMark: needsStructureGuides,
    itemGuideStyle: 'registration',
  };
}

/**
 * Prompt and compositor must answer the same question about the ground.
 *
 * Photo Plan and plain paper preserve their source, so their mask starts opaque and opens bounded
 * feature edits. Painted styles promise one edge-to-edge illustration; restoring the aerial
 * everywhere except item holes is what created the pasted-island Reference Blueprint. Those
 * styles leave the ground editable. The finisher redraws the exact boundary from saved geometry;
 * the mask retains the source-derived house and driveway facts.
 */
export function lockedProtectMaskOptionsForStyle(
  style: StylePreset,
  _filter: GlossyLayerFilter,
  groundSource: 'photo' | 'paper',
): LockedProtectMaskOptions {
  const preserveSource = groundContractFor(style, groundSource) !== 'paint';
  return {
    protectOutside: preserveSource,
    protectLines: false,
    protectItems: false,
    // A restored boundary corridor is raw-photo artwork, not geometry. The finisher draws the
    // saved fence once over the completed map, so painted styles stay continuous up to the line.
    protectBoundary: false,
    protectDriveway: true,
    protectHouse: true,
    protectUnmarkedGround: preserveSource,
    houseHaloRatio: 0.003,
    houseFeatherRatio: 0.0012,
  };
}
