import type { GlossyLayerFilter } from '@/lib/glossy-filters';
import { isModelChromeStyle, type StylePreset } from '@/lib/producer-prompt';

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

export interface ModelInputMarks {
  showToolGlyphs: boolean;
  showDrivewayEdge: boolean;
  showDesignLines: boolean;
  showDesignItems: boolean;
  showHouseMark: boolean;
  showDrivewayMark: boolean;
}

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
