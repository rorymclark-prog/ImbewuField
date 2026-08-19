import type { GlossyLayerFilter } from '@/lib/glossy-filters';
import {
  groundContractFor,
  isModelChromeStyle,
  type GroundContract,
  type StylePreset,
} from '@/lib/producer-prompt';

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

export interface GeometryLockCompositionPolicy {
  ground: GroundContract;
  protectUnmarkedGround: boolean;
  protectHousePixels: boolean;
  protectDrivewayPixels: boolean;
  useSourceStructurePixels: boolean;
  useExactGroundOverlay: boolean;
}

/**
 * Decide which source pixels may be stamped back over a Geometry-Lock render.
 *
 * Painted styles need one continuous illustrated property interior. Restoring isolated source
 * rectangles around every saved feature, then burning the exact ground artwork over them, is what
 * turned Reference Blueprint into a collage of satellite keyholes and mismatched crop tiles.
 * Photo Plan and plain paper have the opposite contract: their factual background is already the
 * intended finish, so it remains protected and only the marked design features are editable.
 */
export function geometryLockCompositionPolicy(
  style: StylePreset,
  groundSource: 'photo' | 'paper' = 'photo',
): GeometryLockCompositionPolicy {
  const ground = groundContractFor(style, groundSource);
  const keepsSourceGround = ground !== 'paint';
  return {
    ground,
    protectUnmarkedGround: keepsSourceGround,
    protectHousePixels: keepsSourceGround,
    protectDrivewayPixels: keepsSourceGround,
    // Plain paper has no factual roof pixels to recover; its exact corrugated roofs are drawn by
    // the app. Only a genuinely photographic contract may paste photographed structures back.
    useSourceStructurePixels: ground === 'photo',
    useExactGroundOverlay: keepsSourceGround,
  };
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

export interface ModelInputMarks {
  showToolGlyphs: boolean;
  showDrivewayEdge: boolean;
  showDesignLines: boolean;
  showDesignItems: boolean;
  showHouseMark: boolean;
  showDrivewayMark: boolean;
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
 * Paid Geometry-Lock polish shows only the saved placement context while keeping structure exact.
 *
 * Tool glyphs are editor furniture, not field evidence. Gemini copied their sticker-like visual
 * language into otherwise coherent aerial plans; coloured footprints and the feature register are
 * sufficient to preserve every saved position, count and footprint.
 */
export function polishModelInputMarks(_filter: GlossyLayerFilter): ModelInputMarks {
  return {
    showToolGlyphs: false,
    showDrivewayEdge: false,
    showDesignLines: true,
    showDesignItems: true,
    showHouseMark: true,
    showDrivewayMark: true,
  };
}
