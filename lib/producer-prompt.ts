// The image-producer prompt builder — extracted so BOTH the /api/image-producer route (synchronous
// Gemini path) and the CLIENT (which builds the prompt to hand to the background render queue, see
// lib/render-jobs.ts + functions/) use the identical prompt. Pure function, no server deps.

export type StylePreset = 'field_ledger' | 'homestead_storybook' | 'extension_blueprint' | 'karoo_folk';

// Every style MUST render the ground as living land — a style that swaps the plot for "paper" or
// blank white is exactly the satellite-disappears failure.
export const STYLE_LINES: Record<StylePreset, string> = {
  field_ledger:
    'STYLE — Field Ledger: a hand-inked site-plan illustration — fine dark pen linework over rich watercolour. The ground inside the plot is painted as living land in greens, olive and warm earth tones with visible lawn/veld/soil texture; it must NEVER read as blank, cream or paper. Warm, credible surveyor character.',
  homestead_storybook:
    'STYLE — Homestead Storybook: a saturated gouache-painted illustrated garden map, warm picture-book quality, rounded stylised beds bursting with vegetables, canopy-textured fruit trees, an earthy palette of ochre, leaf green and terracotta, whimsical but legible.',
  extension_blueprint:
    'STYLE — Extension Blueprint: a clean technical site plan with slight isometric character on structures, muted professional palette (slate blue, sage, warm grey) — but the ground is still softly tinted living land (sage lawn, buff soil, olive veld), never blank white; thin consistent linework, high legibility at small print size.',
  karoo_folk:
    'STYLE — Karoo Folk Map: a bold naive folk-art farm map, flattened bird’s-eye view, saturated colours (barn red, cobalt, sunflower yellow, pine green), decorative South African folk pattern textures, oversized clearly-iconic feature shapes, charming handmade brushwork.',
};

// The producer illustrates the marked elements beautifully and recognisably, in place, inventing
// nothing new. The composite the model receives has the farmer's placed elements drawn as coloured
// markers; elementsText names what each is so the model draws it as the real thing.
export function buildProducerPrompt(
  layerLabel: string | undefined,
  stylePreset: StylePreset,
  elementsText: string,
  mapKind: 'base' | 'full' = 'full',
  retry = false,
  designBrief = '',
): string {
  const noWrite =
    `ABSOLUTELY NO WRITING: the output image must contain ZERO text, letters, words, labels, captions, numbers, legends, banners, signage, compass rose or watermark — not on features, not in corners, nowhere. If you are about to draw any glyph, do not. (Labels are added separately afterwards.) `;
  const noInvent =
    `DO NOT INVENT: draw only what is already visible or marked — no extra gardens, beds, paths, ponds, trees, buildings, fences, vehicles, animals, people or decorations. `;
  const featureLegend =
    `a green rectangle marker → a tidy vegetable bed full of cabbages and leafy greens; a small cylinder/drum marker → a green cylindrical JoJo water tank; a hive marker → a striped beehive; a tree marker → a fruit tree with a full canopy; a hut/shed marker → that building; ` +
    `a grey/tan tinted polygon area → a real driveway surface (gravel or paving) exactly that shape and size, empty of vehicles; a warm-tan tinted polygon area → a paved outdoor patio exactly that shape and size; a blue tinted polygon area → a real dam or pond of open water exactly that shape and size. `;
  const orient =
    `Keep the crop, scale and orientation identical (top of image is north); make the property boundary the crispest line.`;
  const fillIt =
    `PAINT THE WHOLE PLOT: illustrate the ENTIRE area inside the property boundary as a complete, richly hand-painted garden map — the ground (grass, veld, soil, cultivated earth), every building, existing trees and shrubs, and paths. NEVER leave any area blank, white, plain, empty or unpainted — even if only a few features are marked, the whole plot must be a finished, beautiful illustration that matches the real photo's layout. `;
  const roofs =
    `BUILDINGS ARE ROOFS: paint the main house as its roof seen from directly above, matching the exact roof outline and colour visible in the photo — never as a floor plan, never with interior walls, never as a plain white shape. ` +
    `STRICT BUILDING RULE — READ THIS TWICE: paint ONLY the main house's roof, plus any building explicitly marked in the list below. Do NOT paint a second building, shed, carport, garage or any other outbuilding ANYWHERE on the plot, even if a shape near the driveway, a gate, a shadow or a tree canopy looks roof-like to you — those are ALWAYS ground, vegetation or hardstanding, never a structure, unless that exact structure is named in the marked-features list. When in doubt, it is not a building. `;

  const task = mapKind === 'base'
    ? `\nTASK: repaint this satellite photo of a REAL South African smallholding as a beautiful illustrated BASE MAP of the land exactly as it is today${layerLabel ? ' (the ' + layerLabel + ')' : ''}. Paint what the photo actually shows — the main house, existing trees and vegetation, lawn, bare ground, paths and driveway — plus exactly the marked existing features, and no other buildings (see the strict building rule below). `
    : `\nTASK: turn this satellite photo of a REAL South African smallholding${layerLabel ? ' (the ' + layerLabel + ')' : ''} into a beautiful illustrated site map. `;

  const isLayerMap = !!layerLabel && layerLabel !== 'Full design';
  const layerFocus = isLayerMap
    ? `SINGLE-LAYER SHEET — READ CAREFULLY: this is the ${layerLabel!.toUpperCase()} sheet of a plan set and must communicate ONLY the ${layerLabel} layer. Every other layer has its own sheet. Do NOT illustrate vegetable beds, crop rows, orchards, flower borders, livestock, tanks or structures unless that exact element is named in the marked-features list below. Existing vegetation stays as plain, flat, muted canopy/ground — never elaborated into a designed garden. `
    : '';

  const fillItCalm =
    `PAINT THE WHOLE PLOT, BUT CALMLY: illustrate the ENTIRE area inside the property boundary — never leave any area blank, white, plain or unpainted — but keep it a QUIET BASE: plain grass, veld, bare soil and existing tree canopies in flat, muted, low-contrast tones, matching the real photo's layout. The ${layerLabel} content must be the only thing that stands out. `;

  const rules =
    (retry ? `IMPORTANT — YOUR PREVIOUS ATTEMPT FAILED: it left the plot blank / plain white. That is unacceptable. Every part of the plot must be painted as living land this time. ` : '') +
    noWrite + noInvent +
    task +
    layerFocus +
    (isLayerMap ? fillItCalm : fillIt) + roofs +
    `Redraw EACH marked feature as an attractive, instantly-recognisable illustration exactly where it is marked and at the same count — ` +
    featureLegend +
    (elementsText ? `The marked features are: ${elementsText}. ` : '') +
    `Keep the main house, driveway, road and the property boundary exactly in their true position, shape and size; ` +
    `the driveway is a simple access track of the exact traced shape — do NOT turn it into a loop, roundabout, circular drive or turning circle, and do not add extra branches to it; ${orient}`;

  const briefBlock = designBrief
    ? `\n\n=== MASTER DESIGN BRIEF — EVERY SHEET SHARES THIS ONE DESIGN ===\n` +
      `This site has ONE permaculture design. Every sheet in this plan set (base map, zones, water, planting, structures, whole design) depicts THIS SAME design from a different angle, so every sheet MUST agree with every other about WHERE everything is and WHAT it is. The placements below were measured from the real site and are FINAL: do not re-imagine, re-arrange, re-position, resize, rename or re-invent any of them, and never move anything between sheets. Compass directions are relative to the plot and north is the top of the image.\n` +
      `${designBrief}\n` +
      `HOW TO USE THIS BRIEF: it is REFERENCE, not a drawing list. It exists so that this sheet agrees with its sibling sheets — nothing more. You must still draw ONLY this sheet's own layer, exactly as instructed above: anything named in this brief that is NOT in this sheet's marked-features list belongs to a different sheet and must NOT be drawn here.\n` +
      `=== END MASTER DESIGN BRIEF ===`
    : '';

  return `${rules}${briefBlock}\n\n${STYLE_LINES[stylePreset]}`;
}
