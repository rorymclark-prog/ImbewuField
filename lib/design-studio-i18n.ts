import type { WizardStep } from '@/lib/design-canvas';

export type DesignStudioTranslate = (key: string) => string;

export const DESIGN_STEP_LABEL_KEYS: Record<WizardStep, string> = {
  base: 'designStepBase',
  sector: 'designStepSector',
  water: 'designStepWater',
  zones: 'designStepZones',
  planting: 'designStepPlanting',
  structures: 'designStepStructures',
  review: 'designStepReview',
  glossy: 'designStepGlossy',
};

export const DESIGN_STEP_GUIDANCE_KEYS: Record<WizardStep, string> = {
  base: 'designGuidanceBase',
  sector: 'designGuidanceSector',
  water: 'designGuidanceWater',
  zones: 'designGuidanceZones',
  planting: 'designGuidancePlanting',
  structures: 'designGuidanceStructures',
  review: 'designGuidanceReview',
  glossy: 'designGuidanceGlossy',
};

export const DESIGN_CHROME_KEYS = {
  whyThisStep: 'designWhyThisStep',
  stepProgress: 'designStepProgress',
  back: 'designBack',
  next: 'designNext',
  nextStep: 'designNextStep',
  guideAllDone: 'designGuideAllDone',
  guideStepByStep: 'designGuideStepByStep',
  guideMinimise: 'designGuideMinimise',
  guideCelebration: 'designGuideCelebration',
  guideOptional: 'designGuideOptional',
  guideSkipped: 'designGuideSkipped',
  guideDoThis: 'designGuideDoThis',
  guideSkip: 'designGuideSkip',
  guideLater: 'designGuideLater',
  guidePlanCrops: 'designGuidePlanCrops',
  guidePlanCropsHint: 'designGuidePlanCropsHint',
  guideChecklistWorked: 'designGuideChecklistWorked',
  guideWhyMatters: 'designGuideWhyMatters',
} as const;

export const DESIGN_STUDIO_I18N_KEYS = [
  ...Object.values(DESIGN_STEP_LABEL_KEYS),
  ...Object.values(DESIGN_STEP_GUIDANCE_KEYS),
  ...Object.values(DESIGN_CHROME_KEYS),
] as const;

export function translatedDesignStepLabel(t: DesignStudioTranslate, step: WizardStep): string {
  return t(DESIGN_STEP_LABEL_KEYS[step]);
}

export function translatedDesignStepGuidance(t: DesignStudioTranslate, step: WizardStep): string {
  return t(DESIGN_STEP_GUIDANCE_KEYS[step]);
}

export function formatDesignTranslation(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (token, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : token);
}
