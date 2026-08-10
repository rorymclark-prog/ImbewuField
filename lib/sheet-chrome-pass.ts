// THE CHROME PASS — what the app owns on a finished sheet, and when it is drawn.
//
// WHY THIS FILE EXISTS. A paid Full Treatment sheet came back from gpt-image-2 with NO plant
// labels, NO legend panel, no title block, no north arrow and no scale bar — and with the property
// boundary sitting on the page as a hard vector line stamped over ground the model had completely
// repainted. ("Planting · Photo Plan · AI polished · Geometry locked", reviewed by Rory.)
//
// Two separate mistakes produced that one picture:
//
//   1. The second paid pass was handed the ALREADY-COMPOSED sheet — legend panel, plant labels,
//      title block, north arrow and scale bar included. An image model cannot reproduce small
//      text, so it did the only thing it can do with a page full of 9px type: it erased it.
//   2. The app's own re-draw of that chrome was CONDITIONAL, and the condition compared the job
//      input's PIXEL SIZE with the sheet's map size. Every AI-bound bitmap is uniformly downscaled
//      to AI_INPUT_WIDTH before upload (capForAiInput), so the moment the render scale went above
//      2 the sizes could never match, the "this is a legacy page input" escape hatch fired on
//      EVERY sheet, and the chrome pass was skipped entirely. What shipped was the model's
//      repainted page with the boundary corridor byte-restored over it — the one hard-edged mark
//      on otherwise repainted ground.
//
// THE RULE THIS FILE ENCODES: app-owned chrome is never sent to the model and never depends on the
// model's cooperation. The model receives MAP-AREA artwork only (ground + features); the app draws
// every element in SHEET_CHROME_ELEMENTS afterwards, from the saved design, over whatever comes
// back. Several prompts in lib/producer-prompt.ts already promise the model that "the app draws all
// of this afterwards" — this is the file that makes the promise true.
//
// PURE MODULE — no canvas, no DOM. The decisions live here so they can be tested without a render.

/**
 * Everything the app draws itself, after the paid pass, on a design-layer sheet.
 *
 * Documentation with teeth: tests assert that the finisher really does run each of these, so
 * deleting one from the pipeline breaks a test rather than a farmer's sheet.
 */
export const SHEET_CHROME_ELEMENTS = [
  'boundary-stroke',
  'plant-labels',
  'label-gutters',
  'legend-panel',
  'title-block',
  'north-arrow',
  'scale-bar',
] as const;

export type SheetChromeElement = typeof SHEET_CHROME_ELEMENTS[number];

/**
 * A composed sheet is [gutter][map][gutter][legend] (lib/reference-presentation.ts). The legend
 * panel alone is 30% of the gutter-inclusive canvas, floored at 360px, so a composed page is never
 * narrower than about 1.30x its own map panel's aspect ratio, and usually wider. Anything at or
 * below the map's own aspect is map-area artwork.
 *
 * The margin sits well clear of both: far above the ~1.00 a map-only input measures (jpeg/png
 * rounding moves it by less than a pixel) and far below the ~1.30 floor for a page.
 */
export const COMPOSED_SHEET_ASPECT_MARGIN = 1.12;

/**
 * Did this job hand the model a composed PAGE rather than map-area artwork?
 *
 * Answered from the ASPECT RATIO of the image that was uploaded, never from its pixel size: the
 * upload is uniformly downscaled to AI_INPUT_WIDTH, which changes every dimension and preserves
 * every ratio. A size comparison here is the defect described at the top of this file.
 *
 * Only ever true for a job enqueued before the map-only contract shipped and still in flight. It
 * does not switch the chrome pass off — nothing does — it only tells the finisher to take the map
 * panel out of the returned page before drawing chrome around it, instead of using the whole image.
 */
export function modelInputCarriesChrome(
  inputWidth: number,
  inputHeight: number,
  mapWidth: number,
  mapHeight: number,
): boolean {
  const finite = [inputWidth, inputHeight, mapWidth, mapHeight].every(
    (n) => Number.isFinite(n) && n > 0,
  );
  if (!finite) return false; // unmeasurable input → assume the current contract (map-only)
  return (inputWidth / inputHeight) > (mapWidth / mapHeight) * COMPOSED_SHEET_ASPECT_MARGIN;
}

/**
 * Does Full Treatment's returned artwork go through the app's chrome pass?
 *
 * Decided by the COMMITTED WORKFLOW STAGE — RenderSheetSpec.resultKind, persisted on the job doc
 * when the pass was enqueued — and never by a protect mask, an image size or a visual style.
 *
 * Every one of those was a previous discriminator, and every one of them could be absent for
 * reasons that had nothing to do with who owns the page: a mask that failed the usability check is
 * not uploaded, a Storage fetch can fail, and the uploaded input's pixel size never matches the
 * sheet's because the upload is downscaled. Each time one of them was absent, a paid sheet shipped
 * with no legend and no labels.
 *
 * `geometryLock` is the Hybrid tier, whose chrome is composed further along its own path (the
 * exact overlays it restores have to be burned first). `modelChromeStyle` is Satellite Overlay:
 * the one tier where the model is genuinely commissioned to draw its own legend and labels, and
 * where recomposing app chrome would nest a sheet inside a sheet.
 */
export function paidPolishNeedsChromePass(opts: {
  resultKind?: 'hybrid' | 'ai-polished' | 'legacy-ai';
  geometryLock: boolean;
  modelChromeStyle: boolean;
}): boolean {
  if (opts.modelChromeStyle) return false;
  if (opts.geometryLock) return false;
  return opts.resultKind === 'ai-polished';
}
