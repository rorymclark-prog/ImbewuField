# Glossy Render Prompt Audit — why the AI stopped obeying the drawn geometry

**Date:** 2026-07-16 · **Auditor:** Claude (Fable 5), read-only audit — no source changed.
**Scope:** `components/design/DesignGlossy.tsx`, `app/api/ai-render/route.ts`, `lib/ai-render-client.ts` (gpt-image-2 / `falgpt` strict-glossy path; Gemini path noted where relevant).

**Complaint:** the glossy render "does such a nice image" but no longer holds the farmer's traced
boundaries, polygons and zones — it reinterprets them. It "was SO good last time."

---

## TL;DR

The regression is **prompt-caused, introduced today in commit `df6230f`** ("make per-layer glossy
maps type-specific"). The new `FILTER_THEME` text actively instructs gpt-image-2 to **redraw**
zones/tanks/trees/structures ("render each zone as a … coloured band radiating out from the
house"), and on this model **the mask is only guidance — the prompt wins**. OpenAI's own docs:

> "Masking with GPT Image is entirely prompt-based. The model uses the mask as guidance, but may
> not follow its exact shape with complete precision."

So the moment the prompt describes an idealised layout, the model paints that layout — mask or no
mask. Two pre-existing amplifiers make it worse: zone polygons are only edge-locked in the mask
(interiors fully editable), and the criteria demand "a square canvas" while the composite is
~3:2, inviting a reframe.

---

## 1. Root causes, ranked by confidence

### RC1 (very high) — `FILTER_THEME` injects active-redraw instructions that override the lock
**Introduced:** `df6230f` (2026-07-16 16:50). Before it, every layer used the plain
`STRICT_PROMPT` ("repaint background as pretty texture, do NOT touch any feature") — that is the
"SO good last time" version (`e218bfc` and earlier, back to `2e6fcf9`).

**Evidence (current file, `components/design/DesignGlossy.tsx`):**

- Line 73 — `FILTER_THEME.zones.focus`:
  `'a permaculture ZONE map: each numbered zone (0–5) as a clearly coloured band radiating out from the house, warm near the home and wilder toward the edges'`
  → this literally prescribes a **different geometry** (concentric bands around the house) than
  whatever polygons the farmer traced. Via `strictPromptFor()` (lines 98–106) it becomes the
  **BASE INSTRUCTION** — the *last* block of the final prompt (`route.ts:468–469`), the position
  with the strongest recency effect.
- Lines 75–76 — `zones.emphasise`:
  `'render each zone as a distinct, clearly coloured and numbered area (Zone 1 nearest the house, higher numbers further out)'`
  → "render each zone" is a foreground-drawing command, and "(Zone 1 nearest the house, higher
  numbers further out)" again dictates spatial arrangement. Via `mapCriteriaFor()` (line 111,
  `[...theme.emphasise, ...STRICT_MAP_CRITERIA.mustInclude]`) these land **first** in the
  MUST INCLUDE list, *above* the geometry-preservation bullets.
- Line 67 — `water.emphasise`: `'make each rainwater tank, tap point, swale line, pipe/drip run and pond visually obvious and labelled'` → "make … visually obvious" = restyle the locked marks.
  Line 64 — `water.focus` names "ponds and greywater basins" unconditionally → invites inventing
  ponds on farms that have none.
- Line 83 — `planting.emphasise`: `'draw each tree as a leafy canopy at roughly its real mature size; show beds as tidy planted rows'` → "draw each tree … at mature size" = resize items; "tidy planted rows" = rearrange beds.
- Line 91 — `structures.emphasise`: `'render each structure as a clear, simple building footprint with a roof'` → redraw command for locked footprints.

**Why it wins over the preservation text:** the preservation lines
(`route.ts:464–466` — "Preserve the traced geometry … exactly", "Keep every locked boundary …
exactly where the mask and source image place it") are **abstract**, sit **first** (weakest
position), and are contradicted by later **concrete, visually imagable** commands. Image models
follow the concrete picture description. And per OpenAI, for gpt-image the mask is guidance:
the prompt is the real control surface. `route.ts:708–709`'s comment ("Mask … protects the
house/driveway so only the open ground is repainted") overstates what the mask does on this model.

Note: the `'all'` (Whole design) filter is byte-identical to the pre-regression prompt
(`strictPromptFor('all')` returns `STRICT_PROMPT`; `mapCriteriaFor('all')` adds nothing), so the
complaint is dominated by the per-layer maps — exactly the ones `df6230f` changed.

### RC2 (high) — zone polygons are only edge-locked in the mask; interiors are fully editable
**Evidence:** `DesignGlossy.tsx:385–396` — comment says it outright:
`// Zone ring stroke bands (edges locked; interior remains editable background).`
Zones are stroked with a 16 px band (`lineWidth 8 * SCALE`, line 394) on a ~1920×1280 canvas —
≪1 % of the zone's pixels. The whole interior is transparent (= editable, correct OpenAI
polarity: transparent-edit / opaque-preserve, set up at lines 343–349). This design *predates*
the regression (present since `2e6fcf9`) and worked when the prompt said "repaint as pretty
texture" — but under RC1's "paint a ZONE map of coloured bands", the interiors are legal canvas
for the model to lay its own bands, and the 16 px edge guidance gets steamrolled (mask =
guidance). Same structural weakness: boundary is only a stroke band (lines 362–372) and **nothing
outside the boundary is protected**, so the model may also repaint the neighbours' land and
re-cut the boundary line.

### RC3 (medium) — "a square canvas" criteria + `image_size: 'auto'` invite a reframe
**Evidence:** `DesignGlossy.tsx:28` — MUST INCLUDE `'a square canvas that reaches all four edges'`.
The composite is `frame.imgW×2 by frame.imgH×2` (lines 313–314), typically ~1920×1280 (**3:2,
not square** — `lib/design-canvas.ts:18–19`). `route.ts:705` sends `image_size: 'auto'` (fal:
"infer from input images"). Telling the model the output must be square while feeding a 3:2 input
is an explicit instruction to recompose/crop/stretch — any reframe breaks pixel alignment for
*every* locked feature, even on the 'all' map.

### RC4 (low-medium) — fidelity params below what the async path allows
**Evidence:** `route.ts:704` `quality: 'medium'` — fal's default for this endpoint is **`high`**;
the downgrade rationale lives in the *synchronous* `callOpenAI` comment (`route.ts:548, 554` —
"exceed Vercel Hobby's 60s cap") and does **not apply here**: `submitFalGptQueue`
(`route.ts:694–736`) submits to `queue.fal.run` and returns immediately; generation runs on fal
and the client polls (`lib/ai-render-client.ts:11–28`, 45 × 3 s = 135 s budget;
`app/api/ai-render/poll/route.ts` never nears its own 30 s cap). Also `route.ts:706`
`output_format: 'jpeg'` and the composite sent as JPEG 0.9 (`DesignGlossy.tsx:331`) soften the
thin geometry lines the model is supposed to key on — and OpenAI's edit docs require "the image
to edit and mask must be of the same format and size", while we send JPEG image + PNG mask
(fal tolerates it, but PNG+PNG is the documented contract).

### Non-causes checked
- **Mask polarity** is correct: transparent = editable, opaque white = preserved
  (`DesignGlossy.tsx:344–348`). Not the bug.
- **Per-layer mask base protection**: for every filter the house fill, boundary band and driveway
  band remain protected (lines 351–383 run unconditionally). Filtering only removes *other
  layers'* items/lines from both composite and mask — consistent, by design. The real per-layer
  gap is RC2's zone interiors, plus a larger editable fraction on single-layer maps.
- **Dead context fields:** `mapType` (falgpt call, `DesignGlossy.tsx:552`) and `mapFocus` (gemini
  call, line 585) are not in `RenderContext` (`route.ts:38–62`) and are silently ignored —
  harmless but misleading; the gemini glossy is themed only via `layer`.

---

## 2. Exact recommended changes

### 2.1 Prompt strings (the big win) — `components/design/DesignGlossy.tsx`

**A. Replace `FILTER_THEME` (lines 56–96).** Rule applied throughout: theming may describe the
**background's palette/mood/texture and labels only**; it must refer to drawn features solely as
*already-existing source pixels to style around*, and must never name a layout, size, or position.

BEFORE (abridged, the offending strings):
```ts
zones:      focus: 'a permaculture ZONE map: each numbered zone (0–5) as a clearly coloured band radiating out from the house, warm near the home and wilder toward the edges',
            emphasise: ['render each zone as a distinct, clearly coloured and numbered area (Zone 1 nearest the house, higher numbers further out)', 'keep the zone colours strong and legible so the zoning is the story of the map'],
water:      emphasise: ['…', 'make each rainwater tank, tap point, swale line, pipe/drip run and pond visually obvious and labelled', '…'],
planting:   emphasise: ['draw each tree as a leafy canopy at roughly its real mature size; show beds as tidy planted rows', 'render tree shade falling to the south side …', '…'],
structures: emphasise: ['render each structure as a clear, simple building footprint with a roof', '…'],
```

AFTER (copy-pasteable):
```ts
// Per-layer theming. HARD RULE: a theme may only style the EDITABLE BACKGROUND (palette, mood,
// ground texture, labels beside features). It must NEVER instruct the model to draw, render,
// move, resize or rearrange any feature — the farmer's drawn marks are final geometry.
const FILTER_THEME: Record<GlossyLayerFilter, { title: string; focus: string; emphasise: string[] }> = {
  all: {
    title: 'whole-farm permaculture design',
    focus: 'a beautiful hand-illustrated permaculture map (soft earth tones, gentle textures, subtle grass/soil detail)',
    emphasise: [],
  },
  water: {
    title: 'water plan',
    focus: 'a WATER-PLAN background: cool blue-green ground wash and damp soil tones on the open ground, so the blue water marks already drawn on the image stand out',
    emphasise: [
      'tint the editable open ground with a soft blue-green wash so the map reads as a water plan',
      'every blue mark already drawn (tank circles, swale/pipe/drip lines, ponds) stays exactly as drawn — brighten the ground AROUND each one, never redraw, thicken, move or duplicate the mark itself',
      'add one short label pill BESIDE (never covering) each drawn water mark, naming it',
    ],
  },
  zones: {
    title: 'zone map',
    focus: 'a ZONE-MAP background: calm, slightly desaturated ground texture so the coloured zone shapes already painted on the image are the loudest thing on the map',
    emphasise: [
      'the coloured shapes already painted on the image ARE the zones — their painted outlines are final; do not move, bend, extend, shrink or re-cut any of them, and do not paint zone colour outside a painted outline',
      'do not add any zone that is not already painted, and do not rearrange zones around the house — the farmer chose where each zone is',
      'add one small numbered badge inside each painted zone shape, matching the number shown on it',
    ],
  },
  planting: {
    title: 'planting plan',
    focus: 'a PLANTING-PLAN background: lush green growing ground texture on the open soil BETWEEN the drawn features',
    emphasise: [
      'the circles and rectangles already drawn ARE the trees and beds — keep every one at exactly its drawn size and position; do not enlarge canopies, do not regroup beds into rows, do not add plants anywhere',
      'style only the open ground between the drawn features with a rich, green, growing feel',
    ],
  },
  structures: {
    title: 'structures & animals plan',
    focus: 'a STRUCTURES-PLAN background: calm neutral paper-like ground tones so the drawn footprints read clearly',
    emphasise: [
      'the drawn footprints ARE the structures — keep each exactly where and how it is drawn; do not add roofs, sheds, pens or paths anywhere else',
      'add one short label pill BESIDE each drawn footprint, naming it',
    ],
  },
};
```

**B. Replace `strictPromptFor` (lines 98–106)** so the themed base instruction itself re-asserts
the lock in concrete, image-referential language (this text ends the whole prompt — strongest
position):

BEFORE:
```ts
return (
  `Repaint ONLY the unprotected background as ${theme.focus}. Keep it a beautiful hand-illustrated ` +
  'map. This design was drawn by the farmer: do NOT add, move, remove, resize or restyle ANY element, ' +
  'zone, line or label — every feature stays exactly where and how it is. Follow the strict map criteria.'
);
```

AFTER:
```ts
return (
  `Repaint ONLY the unprotected background in the style of ${theme.focus}. ` +
  'Every shape, line, coloured area and icon already visible in the source image was drawn by the farmer and is FINAL GEOMETRY: ' +
  'do NOT add, move, remove, resize, reshape or restyle any of them — style the ground around them only. ' +
  'The output must overlay the source image exactly: same framing, same north-up orientation, every drawn feature in the same pixels. ' +
  'Follow the strict map criteria.'
);
```

**C. Fix the square-canvas criterion and harden `STRICT_MAP_CRITERIA` (lines 23–45).**

BEFORE (line 28): `'a square canvas that reaches all four edges',`
AFTER: `'the exact framing and aspect of the source image, repainted edge to edge — no crop, no zoom, no rotation, no borders',`

Add to `mustAvoid` (after line 34):
```ts
    'changing the shape, size or position of ANY drawn outline, line or coloured area — drawn geometry is final',
    'painting any zone colour, canopy or texture beyond the edge of the drawn shape it belongs to',
```

**D. Re-order `mapCriteriaFor` (line 111)** so geometry comes first and theme styling last:

BEFORE: `mustInclude: [...theme.emphasise, ...STRICT_MAP_CRITERIA.mustInclude],`
AFTER:  `mustInclude: [...STRICT_MAP_CRITERIA.mustInclude, ...theme.emphasise],`

### 2.2 Prompt wrapper — `app/api/ai-render/route.ts`, `buildStrictMapTouchupPrompt` (446–473)

Append a closing geometry lock so the *last words* of the prompt are always preservation (defends
against any future creative text sneaking into the base instruction). Change the return (462–472):

```ts
  return [
    'STRICT MAP EDIT MODE',
    'This is a cartographic edit, not a redesign. Preserve the traced geometry, north-up orientation, and the real satellite base exactly.',
    'Only repaint the editable background. Do not invent features, labels, legends, title cards, side panels, borders, 3D perspective, or decorative elements.',
    'Keep every locked boundary, roof, driveway, road, tree, bed, and line exactly where the mask and source image place it.',
    criteriaBlock,
    'BASE INSTRUCTION',
    basePrompt.trim(),
    'FINAL RULE — GEOMETRY LOCK',
    'If anything above could be read as permission to redraw, move, resize or restyle a drawn feature, it is not. The farmer-drawn geometry in the source image is final. Repaint the background only, and return the image at the same framing as the source.',
  ]
    .filter(Boolean)
    .join('\n\n');
```

### 2.3 Mask — `buildProtectMask` in `DesignGlossy.tsx` (334–441)

What the mask SHOULD protect, per map type (mask remains soft guidance on gpt-image, but wider
protected areas measurably reduce drift, and they make the composite's own pixels the fallback):

1. **Everything outside the property boundary — all filters** (new, insert after the house fill,
   before the boundary band). Pins the boundary from the outside and stops the model repainting
   the neighbours:
   ```ts
   // Protect ALL land outside the property boundary (even-odd: canvas rect minus boundary poly).
   if (refLayers.boundary.length >= 3) {
     ctx.beginPath();
     ctx.rect(0, 0, imgW, imgH);
     refLayers.boundary.forEach(([x, y], i) => {
       const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
       fn.call(ctx, px(x), py(y));
     });
     ctx.closePath();
     ctx.fill('evenodd');
   }
   ```
   Keep the existing 16 px boundary band (pins it from the inside too).
2. **Zone polygons: FILL, not just edge bands, when `filter === 'zones'`** (change at 385–396 —
   add `ctx.fill()` before the existing `ctx.stroke()` for that filter). Pair with pre-styling in
   `drawMarks` for the zones filter: raise the zone fill alpha from `${def.color}33` to
   `${def.color}59` (line 247) and draw a small centroid badge pill with the zone number, so the
   protected interior already *is* the zone map and the model only paints the ground outside.
   For `filter === 'all'`, keep interiors editable (zones are secondary there and full protection
   would leave raw-satellite patches inside an illustrated map).
3. **House** — already a full polygon fill (351–360): keep.
4. **Driveway / lines** — stroke bands (374–383, 398–408): keep; widths are adequate.
5. **Item footprints** — filled, rotated, +25 % margin (410–438): keep.

### 2.4 Params — `submitFalGptQueue` (`route.ts:694–736`) and composite encoding

- Line 704: `quality: 'medium'` → **`quality: 'high'`** (fal's own default; the 60 s rationale is
  for the sync path only — this is the async queue). Give headroom by raising the poll loop from
  `i < 45` to **`i < 60`** in `lib/ai-render-client.ts:11` (180 s budget) — and mirror the same
  constant in `components/GeometryDesignStudio.tsx`'s `pollFalRender`, which the client-lib header
  promises to keep in lockstep.
- Line 705: `image_size: 'auto'` is acceptable once the "square canvas" text is fixed ('auto'
  infers from the input); for zero ambiguity, pass the composite's exact dims through the request
  and send `image_size: { width, height }` (fal supports custom dimensions).
- Line 706: `output_format: 'jpeg'` → **`'png'`** (crisp thin geometry lines).
- `DesignGlossy.tsx:331`: send the composite as **PNG** (`canvas.toDataURL('image/png')`) — OpenAI
  edits require image and mask "of the same format and size", and PNG removes JPEG ringing along
  the exact lines the model must key on. (Payload grows ~3–4×; still fine for fal data-URIs.)

### 2.5 Housekeeping (optional)
- Remove the dead `mapType` / `mapFocus` context fields or add them to `RenderContext` and
  actually use them; today they are silently dropped (`route.ts:38–62`).
- `route.ts:708` comment overpromises ("mask … protects") — reword to "mask = guidance on
  gpt-image; the prompt carries the lock" so the next editor doesn't lean on it.

---

## 3. Priority order (biggest fidelity win first)

1. **2.1-A/B — rewrite `FILTER_THEME` + `strictPromptFor`** (pure string change; removes the
   direct redraw commands that caused the regression; restores the pre-`df6230f` contract while
   keeping the per-type look Rory asked for).
2. **2.1-C — kill the "square canvas" criterion** (stops prompt-driven reframing of a 3:2 image).
3. **2.2 — FINAL RULE geometry lock** + **2.1-D criteria re-ordering** (preservation text owns
   both the first and last word of the prompt).
4. **2.3 — mask: outside-boundary protection (all maps) + filled zone polygons with pre-styled
   fills/badges (zones map)** (structural fix for zone-shape drift and boundary spill).
5. **2.4 — quality 'high' + PNG in/out (+ poll to 60)** (fidelity headroom the async path already
   affords).

Verification suggestion: regenerate the same site's Zones map before/after, overlay the output on
the composite at 50 % opacity, and check the traced zone outlines coincide. Repeat for Water and
Whole-design.
