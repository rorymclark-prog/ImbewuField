import { RENDER_SHEET_KEYS, type RenderSheetKey } from './render-job-contract';
import { decodeRenderSceneSnapshot, MAX_RENDER_SCENE_BYTES } from './render-scene';
import type { RenderJobDoc, RenderSheetState, RenderSheetSpec } from './render-jobs';
import { historicalBaselineFromPrompt } from './historical-map-baseline';
import { isObliqueJobStyle } from './oblique-render';

export interface ComparisonSource {
  sceneJson: string;
  sourceDataUrl?: string;
  sheetKey: RenderSheetKey;
  historical: boolean;
  oblique: boolean;
  recipe?: CorrectionRecipe;
}

export interface CorrectionRecipe {
  style: string;
  sheet: RenderSheetSpec;
}

export function originalRecipe(job: RenderJobDoc, sheet: RenderSheetState, input: string, mask?: string): CorrectionRecipe {
  return { style: job.style, sheet: { key: sheet.key, label: sheet.label, prompt: sheet.prompt,
    compositeDataUrl: input, protectMaskDataUrl: mask, useProtectMaskForEdit: sheet.useProtectMaskForEdit,
    geometryLock: sheet.geometryLock, showcase: sheet.showcase, resultKind: sheet.resultKind } };
}

export interface IllustrationIdentity {
  jobId?: string;
  rawOutputPath?: string;
  designRevision?: string;
  attemptId?: string;
}

export function isComparisonSource(value: unknown): value is ComparisonSource {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<ComparisonSource>;
  return typeof s.sceneJson === 'string' && s.sceneJson.length > 0 && s.sceneJson.length <= MAX_RENDER_SCENE_BYTES
    && RENDER_SHEET_KEYS.some(key => key === s.sheetKey)
    && typeof s.historical === 'boolean' && typeof s.oblique === 'boolean'
    && (!s.oblique || s.sheetKey === 'all')
    && (s.sourceDataUrl === undefined || typeof s.sourceDataUrl === 'string');
}

export function comparisonSource(job: RenderJobDoc, sheet: RenderSheetState, image?: string | null, recipe?: CorrectionRecipe): ComparisonSource | undefined {
  const sheetKey = RENDER_SHEET_KEYS.find(key => key === sheet.key);
  if (!job.sceneJson || !sheetKey || !job.designRevision) return undefined;
  return { sceneJson: job.sceneJson, sheetKey, recipe, historical: !!historicalBaselineFromPrompt(sheet.prompt),
    oblique: isObliqueJobStyle(job.style), ...(image ? { sourceDataUrl: image } : {}) };
}

export function originalJobSheet(job: RenderJobDoc, id: IllustrationIdentity, siteId: string) {
  if (!id.jobId || !id.designRevision || !id.rawOutputPath || job.siteId !== siteId
    || job.designRevision !== id.designRevision || (id.attemptId && id.attemptId !== (job.attemptId ?? id.jobId))) return;
  return job.sheets.find(sheet => sheet.status === 'done' && sheet.outputPath === id.rawOutputPath);
}

export async function openComparisonSource(source: ComparisonSource, id: IllustrationIdentity, siteId: string) {
  const path = id.rawOutputPath?.split('/');
  if (!id.designRevision || !id.jobId || path?.length !== 4 || path[0] !== 'renders' || !path[1]
    || path[2] !== id.jobId || ![`output-${source.sheetKey}.png`, `output-${source.sheetKey}.jpg`].includes(path[3])) return null;
  const scene = await decodeRenderSceneSnapshot(source.sceneJson, id.designRevision, source.sourceDataUrl);
  return scene.state.siteId === siteId ? scene : null;
}
