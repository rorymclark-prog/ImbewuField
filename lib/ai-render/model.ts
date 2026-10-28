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
