# Animal and Fruit-Tree Art Brief

**Status:** open, drawn by Codex (2026-09-28)
**Why:** the fruit-tree harvest table (`lib/perennial-harvest-data.ts`, 30 species) and the animal
table (`lib/animal-enterprises-data.ts`, 15 enterprises) went live without pictures for part of the
set. 17 of the trees already had artwork under their design element and are now linked in
`lib/species-art.ts`. This brief covers what is still missing:

- **Part A:** 5 fruit trees that have no picture anywhere, plus a picker picture for guava.
- **Part B:** 15 animal pictures for the "Animals on your map" card on the crop plan.

**Before you start:** run `git fetch origin && git checkout origin/main -b codex/animal-tree-art`.
A clone that is behind `main` has an older crop brief (1024×1024) and none of the files named
here. Every size below is the **deployed** size on `main`; keep to it, because farmers download
these over mobile data.

The crop icons are a separate job: see Batch 2 in `docs/CROP-ART-BRIEF.md`.

---

## Part A — fruit trees

Each species needs **two** files, in the style of the existing pairs (open `tree_marula.png` with
`marula-tree-v2.png`, and `tree_mango.png` with `mango-tree-v2.png`, before you start):

| view | where it shows | path | size |
|---|---|---|---|
| **Picker** | the species list in the Design Studio, 24–64 px | `public/element-art/tree_<name>.png` | **192×192** RGBA |
| **Plan** | composited top-down onto the farm plan, clipped to the tree's footprint | `public/render-assets/reference-blueprint/<name>-v1.png` | **1024×1024** RGBA |

- **Picker:** the whole plant in side view, soft-shaded illustration, trunk (or base) at the bottom
  centre, fruit visible. All four corners are fully transparent. No ground, shadow or text.
- **Plan:** a top-down crown only. Follow `docs/CANOPY-ART-BRIEF-V2.md` for the edge: jagged leaf
  lobes out to 95–100% of the radius, transparent notches at 72–85%, and **no basin, soil,
  mulch, shadow or ring**. Fruit should be visible from above in the species' fruit colour.
  Deliver at 1024×1024 (not 2048), which is what the rest of the set ships at.

| speciesId | name | picker file | plan file | what to draw, and how it differs from its look-alike |
|---|---|---|---|---|
| `carpobrotus-edulis` | Sour fig | `tree_sour_fig.png` | `sour-fig-v1.png` | **not a tree:** a low spreading mat of fleshy three-angled finger leaves, a few yellow (fading pink) daisy flowers and one or two fig-shaped fruits. From above it is an irregular succulent mat, not a round crown |
| `englerophytum-magalismontanum` | Transvaal milkplum (stamvrug) | `tree_transvaal_milkplum.png` | `transvaal-milkplum-v1.png` | small rounded tree, leathery leaves with silvery-rust undersides, clusters of glossy red oval fruit growing straight off the branches |
| `garcinia-livingstonei` | African mangosteen (imbe) | `tree_african_mangosteen.png` | `african-mangosteen-v1.png` | small dense tree, stiff blue-green leaves in whorls of three, small round bright-orange fruit |
| `pappea-capensis` | Jacket plum (doppruim) | `tree_jacket_plum.png` | `jacket-plum-v1.png` | spreading tree, stiff wavy-edged leaves, furry green capsules, some split open to show a bright red fleshy jacket around a dark seed — the red jacket is the read |
| `strychnos-spinosa` | Spiny monkey orange | `tree_spiny_monkey_orange.png` | `spiny-monkey-orange-v1.png` | small tree with short spines, oval leaves, and large round hard-shelled fruit, green ripening to yellow-orange, clearly bigger than every other fruit in this batch |
| `psidium-guajava` | Guava | `tree_guava.png` | *(exists: `guava-v2.png`)* | picker only: small tree with peeling brown bark, prominently veined leaves, pale yellow-green pear-round fruit, one cut to show pink flesh |

**Wiring (same commit as the PNGs):** add or complete each species in `SPECIES_ART` in
`lib/species-art.ts`, e.g.

```ts
'pappea-capensis': { picker: 'tree_jacket_plum.png', plan: 'jacket-plum-v1.png' },
```

For guava, change `picker: null` to `picker: 'tree_guava.png'`.

---

## Part B — animals

One picture per enterprise, shown at 16 px on the choice chip and 56–72 px above the figures once
the farmer picks it (`components/crops/AnimalEnterprisesCard.tsx`).

- **Path:** `public/animal-art/<enterpriseId>.png`, named exactly after the enterprise id.
- **256×256 RGBA**, all four corners fully transparent, no ground, shadow, fence, text or border.
- **One animal**, whole body, three-quarter side view facing left, filling the frame (≤3% margin).
  Same soft-shaded illustration and upper-left daylight as the crop and tree sets.
- **Must read at 16 px.** Breeds that share a species must differ in silhouette or colour
  blocking, not in fine detail. Test it: downscale to 16×16 and name the animal without the
  filename.

| enterpriseId | what to draw | tell it apart from |
|---|---|---|
| `chicken-layer` | brown commercial laying hen (Hy-Line brown type), upright, small red comb | village chicken: plainer and uniform brown |
| `chicken-broiler` | white broiler, heavy and broad-breasted, low-set | layer: white and chunky, not brown and upright |
| `chicken-indigenous` | village hen, mixed speckled black/red/white plumage, lean, long legs | the only multicoloured chicken |
| `duck` | white Pekin duck standing, orange bill and feet | the only waterfowl; flat bill is the read |
| `rabbit` | white New Zealand White rabbit sitting, pink-red eye, upright ears | — |
| `bees` | a single honeybee in three-quarter view, wings visible (not a hive — the hive is the map element) | — |
| `goat-meat` | Boer goat: white body, red-brown head, long drooping ears, stocky | dairy goat: Boer has the red head |
| `goat-dairy` | Saanen dairy goat: all white, upright ears, lean, visible udder | Boer: no red head, finer build |
| `goat-indigenous` | indigenous veld goat: small, mixed patchy colours (brown, black, white), short coat, lob ears | the only patchy goat |
| `cattle-beef` | Nguni cow: patterned hide (brown/black/white patches), lyre horns, hump-less | dairy cow: Nguni has horns and a pied hide |
| `cattle-dairy` | Jersey dairy cow: fawn/light-brown all over, dark muzzle, large udder, polled | beef: plain fawn and an udder |
| `sheep-mutton` | Dorper: white body, black head and neck, short hair coat | wool sheep: the black head is the read |
| `sheep-wool` | Merino: all white, heavy wrinkled fleece to the knees | Dorper: all woolly, no black head |
| `pig-pork` | pink Large White sow, upright ears, curly tail | — |
| `fish-tilapia` | Mozambique tilapia, side view facing left, olive-grey body, spiny dorsal fin | — |

**Wiring (same commit as the PNGs):** add each file to `ANIMAL_ART` in `lib/animal-art.ts`:

```ts
export const ANIMAL_ART: Readonly<Record<string, string>> = {
  'chicken-layer': '/animal-art/chicken-layer.png',
  // …
};
```

The card falls back to the Lucide icon for any enterprise without an entry, so partial batches
are safe.

---

## Self-check (run on every file before moving on)

```python
from PIL import Image
import sys

SIZES = {"animal-art": 256, "element-art": 192, "reference-blueprint": 1024}
for path in sys.argv[1:]:
    want = next(v for k, v in SIZES.items() if f"/{k}/" in path)
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    assert (w, h) == (want, want), f"{path}: {w}x{h}, want {want}x{want}"
    for i, xy in enumerate([(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]):
        assert im.getpixel(xy)[3] == 0, f"{path}: corner {i} not transparent"
    clear = sum(1 for a in im.split()[-1].getdata() if a == 0) / (w * h)
    assert 0.05 < clear < 0.85, f"{path}: {clear:.0%} transparent — subject too big or too small"
    print(f"{path}: OK ({clear:.0%} transparent)")
```

Then look at each one downscaled: 16 px for animals, 24 px for pickers, 96 px for plan crowns.

When everything is done, run:

```
node --import ./tests/register-alias.mjs --test tests/animal-enterprises.test.ts tests/element-art.test.ts tests/reference-feature-art.test.ts
```

Commit only the PNGs plus the `lib/species-art.ts` and `lib/animal-art.ts` entries.

---

## Ready-to-paste Codex prompt

> Run `git fetch origin && git checkout origin/main -b codex/animal-tree-art`, then read
> `docs/ANIMAL-TREE-ART-BRIEF.md` in full. Draw the 11 tree files in Part A (5 species × picker +
> plan, plus the guava picker) and the 15 animal files in Part B, one file at a time. Match the
> existing art: open `public/element-art/tree_marula.png`,
> `public/render-assets/reference-blueprint/marula-tree-v2.png` and 3–4 files in
> `public/crop-art/` first. Deployed sizes: animals 256×256, tree pickers 192×192, plan crowns
> 1024×1024, all RGBA with transparent corners and no ground or shadow. Run the brief's self-check
> after each file and do the downscale look test. Add each file's entry to `lib/species-art.ts` or
> `lib/animal-art.ts` in the same commit. Finish by running the three test files named in the
> brief, then open a PR.
