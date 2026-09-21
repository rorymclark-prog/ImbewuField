export type ScaleBed = { reference: string; label: string; xM: number; yM: number; widthM: number; lengthM: number };
export type ScalePair = readonly [ScaleBed, ScaleBed];
export type ScaleMode = 'supplied' | 'touching' | 'overlap';
export const SCALE_MODES: { id: ScaleMode; label: string; explanation: string }[] = [
  { id: 'supplied', label: 'Supplied gap', explanation: 'The two bed outlines keep the positions supplied by the app’s sample model.' },
  { id: 'touching', label: 'Edges touch', explanation: 'Only Bed 2 moves. Its left edge meets Bed 1’s right edge. There is no clear gap between them.' },
  { id: 'overlap', label: 'Outlines overlap', explanation: 'Only Bed 2 moves, until half of Bed 1’s width is overlapped. Counting both full bed areas would count the shared ground twice.' },
];
export const SCALE_NOTICE = 'Simulated scale exercise. These dimensions come from the app’s illustrative sample model, not a ground survey. They are not recommended bed or access widths. This is separate from the unmeasured busy-yard case.';

type SourceBed = { id: string; xM?: number; yM?: number; wM: number; hM: number; rotation: number };
/** Read the existing sample once on the server; only these geometric values reach the exercise. */
export function sampleScalePair(items: readonly SourceBed[]): ScalePair {
  const selected = ['demo-bed-1', 'demo-bed-2'].map((id, index): ScaleBed => {
    const matches = items.filter(item => item.id === id);
    if (matches.length !== 1) throw Error(`Scale exercise needs exactly one ${id}`);
    const item = matches[0];
    if (![item.xM, item.yM, item.wM, item.hM].every(value => typeof value === 'number' && Number.isFinite(value)) || item.wM <= 0 || item.hM <= 0 || item.rotation !== 0) throw Error(`Scale source geometry needs review: ${id}`);
    return { reference: item.id, label: `Bed ${index + 1}`, xM: item.xM!, yM: item.yM!, widthM: item.wM, lengthM: item.hM };
  });
  const [a, b] = selected;
  // These lessons compare aligned equal rectangles. Refuse source changes that would make that explanation false.
  if (a.yM !== b.yM || a.widthM !== b.widthM || a.lengthM !== b.lengthM || b.xM <= a.xM + a.widthM) throw Error('The sample pair no longer matches the aligned-bed exercise');
  return [a, b];
}

export function scaleArrangement(pair: ScalePair, mode: ScaleMode) {
  const [a, suppliedB] = pair;
  const b = { ...suppliedB, xM: mode === 'touching' ? a.xM + a.widthM : mode === 'overlap' ? a.xM + a.widthM / 2 : suppliedB.xM };
  const separationM = b.xM - (a.xM + a.widthM);
  const gapM = Math.max(0, separationM);
  const overlapM = Math.max(0, -separationM);
  const bedAreaM2 = a.widthM * a.lengthM;
  const overlapAreaM2 = overlapM * a.lengthM;
  const coveredM2 = bedAreaM2 + b.widthM * b.lengthM - overlapAreaM2;
  const outerWidthM = b.xM + b.widthM - a.xM;
  return { beds: [a, b] as ScalePair, gapM, overlapM, bedAreaM2, overlapAreaM2, coveredM2, outerWidthM, frameWidthM: suppliedB.xM + suppliedB.widthM - a.xM, outerAreaM2: outerWidthM * a.lengthM, gapAreaM2: gapM * a.lengthM };
}
export type ScaleArrangement = ReturnType<typeof scaleArrangement>;
export function scaleNumber(value: number) { return Number(value.toFixed(6)).toString(); }

/** A blank or partly numeric answer cannot silently become zero or earn a match. */
export function scaleAnswer(raw: string): number | null {
  const clean = raw.trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(clean)) return null;
  const value = Number(clean);
  return Number.isFinite(value) && value <= Number.MAX_SAFE_INTEGER ? value : null;
}
export function scaleQuestions(model: ScaleArrangement) {
  return [
    { id: 'bed', label: 'Area of Bed 1', unit: 'm²', expected: model.bedAreaM2 },
    { id: 'space', label: model.overlapM > 0 ? 'Width of the overlap' : 'Width of the clear gap', unit: 'm', expected: model.overlapM || model.gapM },
    { id: 'covered', label: 'Ground inside the bed outlines, counting overlap only once', unit: 'm²', expected: model.coveredM2 },
  ];
}
export function checkScaleAnswers(model: ScaleArrangement, answers: Record<string, string>) {
  return scaleQuestions(model).map(question => {
    const entered = scaleAnswer(answers[question.id] ?? '');
    return { ...question, entered, correct: entered !== null && Math.abs(entered - question.expected) < 1e-8 };
  });
}
