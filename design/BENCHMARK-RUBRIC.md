# Paid-render benchmark rubric

This rubric defines the **measurable minimum** for saying that a paid sheet matches the stored
benchmark. It is based on images opened from Firebase Storage, not on prompt intent.

It does not evaluate `buildFinishedSheetPolishPrompt`. As of 2026-07-29 no stored job has sent that
prompt to a model, so there is no real output against which to tune or score it.

## Evidence actually inspected

| Evidence | Stored facts | What was opened or measured |
|---|---|---|
| `76wIa3J81KZmXhVyqFJ0l0PaztG2_1785068880049_pv9bkm` | Water; `precision_atlas`; `showcase:true`; `geometryLock:false`; one paid pass; no protect mask | Stored input and output at native resolution, plus the verbatim prompt. The output is a complete authored sheet with map, title/legend panel, map labels, north arrow and scale bar. |
| `76wIa3J81KZmXhVyqFJ0l0PaztG2_1785344428945_3h5mz9` | Planting; `photo_plan`; `resultKind:hybrid`; `showcase:false`; `geometryLock:true`; `useProtectMaskForEdit:false` | Stored input and raw output at native resolution, the verbatim prompt, and a locally reconstructed source/output composite. The mask was measured from alpha bytes; it was **not** judged by how its RGB channels look in an image viewer. |
| `design/benchmark/01_…png` through `08_…png` | Rory's primary ChatGPT reference set | All eight sheets were opened. Their detected right-panel widths and OCR measurements provide the range used below. |

The second job is a failure specimen, not a lower-quality acceptable benchmark. Its reconstructed
composite has hard source/model cut-outs: round keyholes, long strips through the vegetable beds,
and large irregular joins around the house and orchard. The first job demonstrates that the app has
already produced the target complete-page look without compositing the old sheet back over it.

## Pass rule

A candidate only earns “matches the benchmark” when every applicable gate below passes. Report the
individual measurements; do not collapse them into a subjective score.

### B1 — Complete page structure

The finished image must contain a map and a distinct title/legend panel. For this benchmark set the
script must detect one majority-parchment panel in the right-hand 40% of the page, with a width from
**13.2% through 26.0%** of the sheet. Those are the measured extremes of the eight primary reference
sheets, not design guesses. The panel OCR must also find the supplied sheet title and the word
`LEGEND` (or the sheet's explicit panel heading, such as `SECTOR LEGEND`).

The stored Water output's panel starts at pixel 2019 of 2544 and occupies **19.772%** of the page.

**Stored-image evidence:** job
`76wIa3J81KZmXhVyqFJ0l0PaztG2_1785068880049_pv9bkm`, stored Water output.

**Script check:** `measureRightPanel()` in `scripts/benchmark-render-audit.mjs`, followed by
panel-region OCR. Its panel detector is covered by `tests/benchmark-render-audit.test.ts`.

### B2 — Legend and saved-element agreement

Build an expected register from the saved design data supplied to the render. Never derive the
expected register from the model output. Normalize case, punctuation, whitespace, `×` and `x`, but
do not normalize away a name or quantity.

The check has two parts:

1. The rendered-map manifest must have exactly the same saved element IDs and counts as the expected
   register: no missing, duplicate or invented entry.
2. Panel OCR must find every expected legend name and its quantity. A missing quantity is a failure,
   even when the name is present.

For the stored Water output the concrete OCR register was:

- `JoJo Tank 5000L ×2`
- `Tap Point ×4`
- `Drip header and laterals`
- `Buried water pipe`
- `Banana Circle ×2`
- `Greywater Basin`
- `Tree Basin ×6`
- `Filtered greywater line`
- `Small Pond`

Tesseract `--psm 11` found **9/9** phrases in the detected panel. The corresponding map labels and
marks are visible on the stored output. This list is evidence for that job only; it is not a
hard-coded Water design for other farms.

**Stored-image evidence:** job
`76wIa3J81KZmXhVyqFJ0l0PaztG2_1785068880049_pv9bkm`, stored Water input and output.

**Script check:** pass the current sheet's phrases as repeated `--expect` arguments. Require
`image.panelOcr.expectedPhraseCoverage.fraction === 1`. Phrase normalization and missing-term
reporting are covered by `tests/benchmark-render-audit.test.ts`. Structured map/legend identity is
also guarded in the application suite by `tests/legend-map-agreement.test.ts`; OCR is not a
substitute for that data-level check.

### B3 — Text legibility at delivered resolution

Run OCR on the final native-resolution page, not a development screenshot or zoomed crop.

The gate is:

- every required title, legend name and quantity is recognized;
- median recognized-word height is at least **1.12% of sheet height**.

The height floor is the lowest measured median across the eight primary reference sheets. The
stored Water output measured **1.466%** overall and **1.466%** within its panel.

Raw OCR confidence is diagnostic, not a gate. The eight visibly legible ChatGPT references ranged
from 42.0 to 92.9 median confidence because illustration texture affects Tesseract. The stored Water
panel measured 94.35. Phrase recall and relative glyph size are the checks that can fail for the
right reasons.

**Stored-image evidence:** job
`76wIa3J81KZmXhVyqFJ0l0PaztG2_1785068880049_pv9bkm`, stored Water output.

**Script check:** `parseTesseractTsv()` and `expectedPhraseCoverage()` in
`scripts/benchmark-render-audit.mjs`. Both are covered by
`tests/benchmark-render-audit.test.ts`.

### B4 — Zero deterministic stitch seams

For the illustrated benchmark look, source pixels must not be cut back into the paid output through
a protection mask. The measurable target is:

- `boundaryComponents === 0`
- `transitionEdges === 0`

The stored Water benchmark job has no protect mask, so both values are zero by construction.

The stored Planting failure has **10** separate source/model transition networks, **15,362**
horizontal or vertical transition edges, and **6,251.943 transition edges per megapixel**. Its
reconstructed composite visibly follows those cuts. This makes transition topology a useful
fail-fast check: a non-zero result cannot be called benchmark-matching even if a thumbnail hides
the joins.

**Stored-image evidence:** positive job
`76wIa3J81KZmXhVyqFJ0l0PaztG2_1785068880049_pv9bkm`; negative job
`76wIa3J81KZmXhVyqFJ0l0PaztG2_1785344428945_3h5mz9`.

**Script check:** `measureMaskTransitions()` in `scripts/benchmark-render-audit.mjs`. Separate
editable islands are exercised by `tests/benchmark-render-audit.test.ts`.

### B5 — Report the photographic/drawn authority split

Use the mask alpha bytes to report the exact blend authority:

```text
sourceWeight = sum(alpha) / (255 × pixelCount)
modelWeight  = 1 − sourceWeight
```

For an illustrated `precision_atlas` / Extension Blueprint benchmark page, the pass target is
**0% forced source restoration and 100% paid output**. The stored Water benchmark follows that path.

The stored Planting failure measures:

- **72.367%** fully protected pixels;
- **26.782%** fully editable pixels;
- **0.851%** partial-alpha pixels;
- **72.727%** source weight;
- **27.273%** model weight.

These values explain how much of the final pixel authority comes from the old photographic source
versus the paid render. They do not claim that an image classifier can semantically distinguish
every painted tree from every photographed tree.

There is not yet a real, accepted `photo_plan` output that establishes a different passing
source/model ratio. Do not invent one from the failed Planting job. Until such a positive specimen
exists, a Photo Plan can be reported with these measurements but cannot be certified against a
style-specific ratio. It still fails B4 when mask transitions are non-zero.

**Stored-image evidence:** positive job
`76wIa3J81KZmXhVyqFJ0l0PaztG2_1785068880049_pv9bkm`; negative job
`76wIa3J81KZmXhVyqFJ0l0PaztG2_1785344428945_3h5mz9`.

**Script check:** `measureMask()` in `scripts/benchmark-render-audit.mjs`. Alpha weighting and the
fully protected/editable/partial partitions are covered by
`tests/benchmark-render-audit.test.ts`.

### B6 — Preserve page framing

The output must keep the input orientation and its relative aspect-ratio drift must be no greater
than **0.665%**:

```text
abs((outputWidth / outputHeight) / (inputWidth / inputHeight) − 1)
```

That ceiling is the measured drift of the accepted stored Water output: 2496×1280 input
(1.9500) to 2544×1296 output (1.962963), or 0.66477%. It allows the model's observed encoder sizing
without permitting a portrait/landscape flip, crop, or visibly different page frame.

This is a page-framing check only. It does not prove that internal saved geometry stayed fixed.

**Stored-image evidence:** job
`76wIa3J81KZmXhVyqFJ0l0PaztG2_1785068880049_pv9bkm`, stored Water input and output.

**Script check:** pass both `--source-image` and `--image`; require `aspect.sameOrientation === true`
and `aspect.relativeDrift <= 0.00664767331434013`. The calculation is covered by
`tests/benchmark-render-audit.test.ts`.

## Reproduce the audit

Fetch only to a temporary directory outside the repository. The fetcher refuses both an in-repo
artifact directory and an in-repo service-account file.

```bash
node scripts/fetch-stored-render.mjs \
  --service-account /absolute/path/to/serviceAccount.json \
  --admin-dir /absolute/path/to/functions/node_modules/firebase-admin \
  --job-suffix 1785068880049_pv9bkm \
  --job-suffix 1785344428945_3h5mz9 \
  --out-dir /private/tmp/imbewu-render-audit
```

Then audit the native stored files:

```bash
node scripts/benchmark-render-audit.mjs \
  --source-image /private/tmp/imbewu-render-audit/JOB/01-water-input.jpg \
  --image /private/tmp/imbewu-render-audit/JOB/01-water-output.png \
  --expect "JoJo Tank 5000L ×2" \
  --expect "Tap Point ×4" \
  --expect "Drip header and laterals" \
  --expect "Buried water pipe" \
  --expect "Banana Circle ×2" \
  --expect "Greywater Basin" \
  --expect "Tree Basin ×6" \
  --expect "Filtered greywater line" \
  --expect "Small Pond"

node scripts/benchmark-render-audit.mjs \
  --mask /private/tmp/imbewu-render-audit/JOB/01-planting-mask.png
```

Replace `JOB` with the resolved full job directory written to `manifest.json`. Expected phrases
must come from that candidate sheet's saved design, not from this example.

## What this rubric cannot yet verify

- No stored output has exercised `buildFinishedSheetPolishPrompt`, so this rubric says nothing about
  second-pass polish quality.
- The accepted Water specimen has `geometryLock:false`. Its image proves complete-page production
  quality and register/legend preservation, but does not establish a pixel tolerance for every
  internal footprint or route. A future geometry-registration check needs real matched control
  points from input and output; no tolerance is invented here.
- OCR proves that required text can be read by a script. It does not prove that every leader line
  ends on the correct physical object. That remains a full-resolution visual audit until leader
  endpoints are exported as structured data.
- The stored artifacts are the paid input, raw model output and mask. The Planting composite used
  for visual diagnosis was reconstructed locally with the app's alpha-blend rule; it is not a
  separately stored final gallery PNG.

Accordingly, a report should say “passes B1–B6” and list the values. It should not say “visually
fixed” unless a person also opened the final delivered sheet at full resolution.
