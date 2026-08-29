# GOAL — climate-zone plant art

This file is the goal, not the chat. Chats crash and take their instructions with them;
this file does not. If you are picking this up cold, read it, then read
`docs/PLANT-ART-BRIEF-CLIMATE-ZONES.md` for the full spec and the species list.

---

## The goal in one sentence

**Give every South African climate zone the same quality of plant art that KZN subtropical
already has — 52 species, two views each, every file measured and passing.**

Today the catalogue is good for a KZN smallholder and thin everywhere else. A farmer in the
Karoo, the Cape or the Highveld opens the picker and finds fruit that does not grow where she
lives. That is the gap this closes: apricots, cherries, almonds, quince, pistachio, and the
indigenous fruit and berries of those biomes.

## Definition of done

All five must be true. Four of them are machine-checkable, so check them.

1. **104 files exist** — 52 species × 2 views.
2. **Every file exits 0 on the checker.** No exceptions, no "close enough".
3. **Top-down crowns** in `public/render-assets/reference-blueprint/`, **≤ 250 KB each.**
4. **Front views** in `public/element-art/`, downsized to 192 px, **≤ 60 KB each.**
5. **No `.ts` or `.tsx` file touched.** Wiring is Claude's job, not yours. Images only.

## The checker is the standard

```bash
~/Claude/.venv/bin/python scripts/check-plant-art.py <file.png> --view topdown
~/Claude/.venv/bin/python scripts/check-plant-art.py <file.png> --view front
```

One line per rule, exit 0 = pass, exit 1 = fail. It measures what the eye gets wrong:

| rule | why it exists |
|---|---|
| `square` | the app clips to a square footprint |
| `corner-alpha-0` | a baked checkerboard has shipped before and painted an opaque box across a farm |
| `genuine-alpha` | a PNG header check cannot catch a fully-opaque alpha channel; decode the pixels |
| `foliage-reaches-frame` | the app clips to a circle — a clear margin becomes a visible gap |
| `outer-band-not-soil` | the first canopy set measured 56–70% brown and read as a dug basin round every tree |
| `file-size` | 38 MB of art for something drawn at 576 px, re-downloaded after every deploy |

**Never deliver a file that fails.** Regenerate, or downsize, until it passes.

## Hard constraints

- **Built-in `image_gen` tool only.** Never `scripts/image_gen.py` — the CLI fallback needs
  `OPENAI_API_KEY`, which costs real money the owner has explicitly refused. If the built-in
  tool fails, **stop and say so**. Do not fall back.
- **Work from the existing art, not from a text description of it.** Read the PNGs already in
  `public/element-art` and match that set. This is the single most load-bearing lesson from
  the earlier rounds: text prompts guessed the style wrong; image references got it right.
- **Colour identity per species.** Its true foliage green and its true fruit colour. Across
  the set, ≥70° of hue spread. The first canopy family spanned 17.5° — every tree a variant
  of the same yellow-green, which is how you get seven trees nobody can tell apart.
- **No ground, ever.** No soil, mulch ring, basin, grass, shadow or background. The app paints
  its own ground; anything you add is drawn twice.

## Order of work, with stop points

Stop points are not optional. They exist so a systematic mistake costs three images, not 104.

1. **Pilot — 3 top-downs:** `tree_sweet_cherry`, `tree_almond`, `tree_quince`.
   **STOP.** Show the checker output for all three.
2. **Exotic fruit & nuts** — 11 species, both views. **STOP.** Report pass/fail counts.
3. **Indigenous fruit** — 15 species. **STOP.**
4. **Shrubs** (6), **small trees & large shrubs** (8) — **STOP.**
5. **Climbers** (7), **medium** (4), **large** (2) — done.

## Stop and ask, rather than guess

- The built-in image tool fails or is unavailable.
- Three consecutive failures on one species — something about that species is wrong, and a
  fourth attempt will not find it.
- A species where the brief and the existing art disagree.
- Any temptation to touch a `.ts` file. That is the signal to hand back, not to proceed.

## What "good" looks like

The accepted reference is the apricot top-down: square, trunk centred, crown filling the
frame with insets of 0–2 px on all four midlines, genuinely transparent corners, no ground,
and its own colour identity. Measured, not admired.
