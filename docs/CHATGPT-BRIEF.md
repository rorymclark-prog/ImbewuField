# Brief for ChatGPT — help me improve my AI site-plan image pipeline

*(Paste everything below the line into ChatGPT. It fully describes the system, the exact prompts, the API settings, and the specific problems, then asks for advice. Attach 1–2 of your rendered sheets when you send it so it can see the failures.)*

---

I'm building a phone app for South African smallholder farmers that turns a farm's satellite photo + a permaculture design into a set of beautiful illustrated "plan sheets." I generate the illustrations with **OpenAI `gpt-image-2`** via the **`/v1/images/edits`** endpoint. I want your help getting the output to a consistently professional standard — I can hand-produce excellent results by pasting an image into you with a simple prompt, but my automated pipeline still makes specific, repeatable mistakes. Please give concrete, technical, prompt- and API-level advice.

## What I'm producing

A "plan set" of 5 AI-illustrated sheets for one farm, all in the same art style ("Extension Blueprint" — a clean technical site plan):
- **Whole design** (everything), **Zones**, **Water**, **Planting**, **Structures**.
Each sheet must show the farm's real layout, illustrated, with a title block, a small legend, up to ~6 labels, and a north arrow.

## The exact pipeline

1. **Client builds a "composite" image** (an HTML canvas, exported as PNG, ~2200×1480, ~3.3MP). The composite = the **real satellite photo** of the plot, with the farmer's placed design drawn ON TOP as coloured placeholder markers:
   - vegetable beds = green rectangles; water tanks = small drum shapes; fruit trees = tree markers; buildings = the real roof from the photo; the property **boundary = a drawn line**; permaculture **zones = large translucent coloured bands**; fences/paths/swales/pipes/drip lines = coloured lines (violet/gold/light-blue/dark-blue/green); dams = blue areas.
   - So the composite already contains the exact geometry and placement — the photo underneath + markers on top.
2. **This composite is the single input image** to `POST /v1/images/edits`, along with a text prompt (below). No mask is sent. No seed (the Images API has none).
3. **The model returns a PNG.** In my default ("showcase") mode I use the model's output mostly as-is. (I also have a stricter mode that clips the model output to the boundary and burns my own exact labels back on, but I'm focused on the showcase mode here because it looks more like a hand-illustration.)
4. **The 5 sheets are 5 independent API calls** (run ~3 in parallel). They share only the text prompt's style description — there's no shared reference image or seed between them.

### Exact API parameters I send to `/v1/images/edits`
```
model:          gpt-image-2
prompt:         (the text below)
n:              1
size:           aspect-matched to the composite, ~3.3 MP (e.g. 2224x1488) — NOT "auto"
quality:        high
output_format:  png
moderation:     low
image[]:        the composite PNG (one image)
```
(No `mask`, no `background`, no `seed`, no `input_fidelity`.)

### The exact text prompt I currently send (for the "Whole design" sheet, Extension Blueprint style)

```
STYLE — Extension Blueprint: a clean technical site plan with slight isometric character on structures, thin consistent linework, high legibility at small print size. Fixed palette: slate blue, sage green, buff soil, warm grey, off-white paper — the ground is always softly tinted living land (sage lawn, buff soil, olive veld), never blank white. This sheet is one page of a five-sheet plan set painted in one sitting with one fixed palette: identical colour temperature, paper tone, line weight and brushwork on every sheet. Flat even midday daylight, neutral white balance — no golden-hour warmth, no orange cast, no vignette.

Turn this satellite photo of a real South African smallholding into a beautiful hand-illustrated site plan sheet titled "FULL DESIGN — Carl and Sandys Place".

You are RENDERING an existing plan, not designing a new one — stay faithful to the photo. Illustrate the land inside the property boundary in the style above, keeping the ground exactly as the photo shows it: open lawn stays open lawn, grass stays grass, bare soil stays bare soil. Paint each building as its FULL roof seen from directly above, keeping the exact roof outline — never crop, shrink, cover or plant over any part of a roof. Everything outside the boundary stays the untouched original photograph; the boundary line, every roof and the driveway keep exactly the shape, size and position the photo shows; top of the image is north.

Each coloured marker on the photo is a placeholder — paint the real thing in its place, same spot, same size, same count: green rectangles are vegetable beds full of cabbages and leafy greens; a tree marker is a fruit tree with a full canopy; a deep-green line is a windbreak hedge of dense shrubs and trees; a small drum marker is a green cylindrical JoJo water tank; a blue area is a dam or pond of open water, exactly that shape; a light-blue dashed line is a swale — a planted water-harvesting ditch on contour; a dark-blue line is a buried water-pipe route, shown as a subtle trench line; a green dashed line is a drip-irrigation line; a hut or shed marker is that building; a hive marker is a striped beehive; a warm-tan area is a paved outdoor patio, exactly that shape; a dusty-violet line is a farm fence of posts and wire along exactly that path; a gold dashed line is a walking path along exactly that route; the grey strip is the existing driveway — a plain tar access track of exactly its traced shape, empty of vehicles; the large coloured bands are the permaculture zones (Zone 0–5) — paint each as a soft translucent tinted wash laid over the illustrated land, keeping the land, buildings and lighting beneath them in the style's own palette and neutral daylight, never tinted warm by the band colours. This sheet's features are: 🚜 Chicken Tractor, 🐝 Beehive ×2, 🌴 Pawpaw Tree, ⛽ JoJo Tank 5000L ×2, ♻️ Greywater Basin, 🪱 Compost Bay (3-bin), 🌱 Nursery Table, 🚰 Tap Point ×4, 🐸 Small Pond, 🍌 Banana Circle ×2, 🥑 Avocado Tree, 🍊 Citrus Tree, 🌰 Macadamia Tree, 🥭 Mango Tree, 🍂 Mulch Bank, 🥬 Vegetable Bed ×8, 🐝 Pollinator Strip ×3, 🌳 Moringa Tree ×6, 🕳️ Borehole, 🕶️ Shade House, [zones + lines]. Every tree, bed, tank and feature you paint sits on one of these markers — ground with no marker stays open lawn or veld, unchanged. Add nothing that is not marked: no extra trees, beds, ponds or paths of your own.

In the corner with the least map content, on clean paper panels in the same style: a title block reading "FULL DESIGN — Carl and Sandys Place" — the largest lettering on the sheet — a small legend listing each of this sheet's feature types with a colour swatch beside its name, and a small north arrow. Label up to six of the most important features in small elegant lettering placed beside them, using exactly these spellings: [element list]. These are the only words anywhere on the sheet, all horizontal and print-legible.
```

(The single-layer sheets — Water, Planting, etc. — use a shorter version with only that layer's markers in the legend, plus a line telling it to keep the rest of the plot a quiet base.)

## What's WORKING now (recent wins, don't break these)
- The art style and legend/title block look genuinely good.
- Cross-sheet consistency is good — the 5 sheets read as one set (I added the "one sitting, one fixed palette, neutral white balance" instruction).
- It mostly keeps things inside the boundary and leaves the surrounding photo untouched.
- I switched from a much LONGER prompt (~5,900 chars, full of "NEVER do X / DO NOT Y" rules) to this shorter positive-framed one, and quality + instruction-following improved a lot. The heavy negation seemed to *cause* some of the bugs (mentioning "shed, carport, garage" as forbidden seemed to make it draw them).

## The remaining PROBLEMS I need fixed (see attached images)
1. **Buildings get distorted / bent out of shape.** The house roof sometimes comes out warped, wrong-angled, or with wings reshaped, even though the exact roof is right there in the input photo and I tell it to keep the outline exact.
2. **It invents features that aren't marked.** Example: it planted a **hedge across the front lawn** where there is no hedge marked — the lawn should stay open grass. (I suspect it's interpreting the boundary line or a fence/windbreak line, or just "decorating.")
3. **Counts are wrong.** "Moringa Tree ×6" might render as 5 or 7; same for beds/trees.

## What I want from you
Please give specific, actionable advice — I'll implement it:

1. **Geometry / building distortion:** What's the best way to make `gpt-image-2` preserve the exact building footprint from the input photo? Would sending a **`mask`** (inpainting) — masking OUT the roof so the model can't repaint it, and only letting it illustrate the garden areas — solve the distortion? How would you structure that mask given I want the WHOLE plot re-illustrated except I need the roof + boundary to stay geometrically exact? Any downsides?
2. **Stopping invented features (the phantom hedge):** Is there a prompt formulation that reliably stops it adding un-marked features, WITHOUT the heavy negation that backfired on me? Is a mask the better tool here too?
3. **Exact counts:** Is there any reliable way to hit exact object counts with `gpt-image-2`, or is that a hard limitation I should stop fighting (and instead burn exact markers via my own deterministic layer)?
4. **Architecture:** Is a single `/v1/images/edits` call the right approach, or would you recommend a different structure — e.g. a mask-based inpaint, multiple input reference images, a two-pass (rough then refine), or `n>1` and pick-the-best? I care about: exact geometry, no invented features, correct counts, beautiful hand-illustrated style, and consistency across the 5 sheets.
5. **Prompt structure:** Any concrete rewrite of the prompt above that you think would follow instructions better. Is it still too long/complex? Should the style, the fidelity rules, and the legend spec be ordered differently?

Assume I'm a competent developer — give me the real technical levers (parameters, mask strategy, prompt structure), not generic tips. If you need to see the failures, I've attached example sheets.
