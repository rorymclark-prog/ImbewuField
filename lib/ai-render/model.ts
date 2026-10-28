// One model authority for the worker request and the picker. Stored maps keep the model that
// actually painted them, so an upgrade cannot relabel a farmer's earlier paid image.
// https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst
export const OPENAI_MAP_MODEL = 'gpt-image-2.5-sunburst';
export const OPENAI_MAP_MODEL_LABEL = 'GPT Image 2.5 Sunburst';

export function isMapModelId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_.-]{1,128}$/.test(value);
}

export function openAiMapModelLabel(model?: string): string {
  return model === OPENAI_MAP_MODEL ? OPENAI_MAP_MODEL_LABEL : model || 'gpt-image-2';
}


/** The edits API requires a 16-pixel grid. Both the request and its registration repair use
 * this exact calculation; a general aspect tolerance would also admit unrelated cropped maps. */
export function openAiMapRequestedSize(width: number, height: number): string {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) return 'auto';
  const scale = Math.sqrt(3_300_000 / (width * height));
  const w = Math.round(width * scale / 16) * 16;
  const h = Math.round(height * scale / 16) * 16;
  const pixels = w * h;
  return pixels < 655_360 || pixels > 8_294_400 || Math.max(w, h) / Math.min(w, h) > 3
    || Math.max(w, h) > 3840 ? 'auto' : `${w}x${h}`;
}
