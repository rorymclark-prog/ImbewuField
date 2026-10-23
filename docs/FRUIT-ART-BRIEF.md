# Fruit Art Brief — what the food forest gives, per month

**Status:** open (2026-09-29). Placeholders are live; this brief is for the painted set.
**Why:** Rory, 2026-09-29: *"instead of fruit trees as the icons make them actual fruit"*. The crop
calendar (`app/facilitator/crops/page.tsx`) now shows the food forest by what is PICKED each
month — in the bed calendar's "Fruit, nuts & berries" row and in the food chart's tree tray —
not by a picture of the tree. Every species in `lib/perennial-harvest-data.ts` (36) has a flat
placeholder SVG in `public/fruit-art/<speciesId>.svg`, drawn by
`scripts/build-fruit-placeholder-art.mjs`. Replace each with a painted PNG.

**Before you start:** `git fetch origin && git checkout origin/main -b codex/fruit-art`.

## The files

| where it shows | path | size |
|---|---|---|
| calendar month cells (20 px), hover card (18 px), food-chart tray (18 px) | `public/fruit-art/<speciesId>.png` | **128×128** RGBA, ≤ 25 KB each |

- **Style:** the same soft-shaded illustration as the crop icons in `public/crop-art/` (open
  `tomatoes.png` and `butternut.png` first). The fruit fills 80–90% of the frame, centred.
- All four corners fully transparent. No ground, shadow, plate, text or border.
- It must read at **18 px**: one or two fruits, not a basket. Colour and silhouette carry it.
- Show the part that is picked. Where the record's product is not "fruit", draw that product
  (pecan and macadamia: the nut; moringa: pods and leaves).

## Species

| speciesId | name | product (record) | what to draw |
|---|---|---|---|
| `carica-papaya` | Pawpaw | fruit | one elongated pawpaw, yellow-orange skin with a green blush; optionally a half showing orange flesh and black seeds |
| `carissa-macrocarpa` | Num-num | fruit | two glossy scarlet oval num-num fruits on a short stem |
| `carpobrotus-edulis` | Sour fig | fruit | one sour fig fruit: a fleshy, many-segmented top-shaped fruit, straw-brown and wrinkled when ripe |
| `carya-illinoinensis` | Pecan | nut in shell | two pecans in their smooth brown striped shells, one cracked to show the kernel |
| `citrus-limon` | Lemon | fruit | one lemon with its pointed ends, bright yellow, one leaf |
| `citrus-reticulata` | Soft citrus | fruit | one naartjie, flattened sphere, deep orange peel with visible pores, one leaf |
| `dovyalis-afra` | Kei apple | fruit | two round kei apples, apricot-yellow, smooth |
| `englerophytum-magalismontanum` | Transvaal milkplum | fruit | a cluster of three glossy red oval stamvrug fruits growing straight off a bit of branch |
| `ficus-carica` | Fig | fruit | one purple fig, and a half showing pink seedy flesh |
| `fragaria-x-ananassa` | Strawberry | fruit | one red strawberry with yellow seeds and a green calyx |
| `garcinia-livingstonei` | African mangosteen | fruit | three small round bright-orange imbe fruits on a stem |
| `grewia-occidentalis` | Cross-berry | fruit | one cross-berry: a four-lobed reddish-brown fruit (the four lobes are the read) |
| `harpephyllum-caffrum` | Wild plum | fruit | a small cluster of oval dark-red wild plums |
| `litchi-chinensis` | Litchi | fruit | two litchis with red bumpy skin, one peeled to show white flesh |
| `macadamia-integrifolia` | Macadamia | nut in shell | one round macadamia in its green husk split open, beside one brown shelled nut |
| `mangifera-indica` | Mango | fruit | one mango, green blushing to orange-red, kidney shaped |
| `mimusops-zeyheri` | Red milkwood | fruit | a cluster of small oval orange-yellow moepel fruits |
| `moringa-oleifera` | Moringa | leaves and pods | two long green drumstick pods with a sprig of small round moringa leaflets (leaves AND pods: both are picked) |
| `musa-acuminata-aaa-group` | Banana | fruit (bunch of bananas) | a hand of three or four yellow bananas |
| `pappea-capensis` | Jacket plum | fruit (seed used for oil) | one furry green capsule split to show a bright red fleshy jacket around a dark seed |
| `passiflora-edulis` | Purple granadilla | fruit | one purple granadilla, wrinkled when ripe, and a half with yellow pulp and black seeds |
| `persea-americana` | Avocado | fruit | one dark-green avocado and a half with pale flesh and the round stone |
| `phoenix-reclinata` | Wild date palm | fruit | a small bunch of oval orange-brown wild dates |
| `physalis-peruviana` | Cape gooseberry | fruit | one orange Cape gooseberry sitting in its opened papery beige husk |
| `prunus-persica` | Low-chill peach | fruit | one peach with a crease, yellow-orange with red blush |
| `prunus-salicina` | Japanese plum | fruit | one Japanese plum, dark red-purple, with a bloom |
| `psidium-guajava` | Guava | fruit | one pale yellow-green guava and a half with pink flesh |
| `punica-granatum` | Pomegranate | fruit | one red pomegranate with its crown, and a wedge showing the red seeds |
| `rhoicissus-tomentosa` | Common wild grape | fruit | a loose bunch of small dark-purple wild grapes |
| `rubus-idaeus` | Raspberry | fruit | one or two red raspberries (drupelets are the read) |
| `sclerocarya-birrea-subsp-caffra` | Marula | fruit (also the nut/kernel inside the stone is eaten, but the picked product is the fruit) | two round yellow marula fruits |
| `strychnos-spinosa` | Spiny monkey orange | fruit | one large round hard-shelled monkey orange, green going yellow-orange: the biggest fruit in the set |
| `syzygium-cordatum` | Waterberry | fruit | a cluster of oval dark-purple waterberries |
| `vaccinium-corymbosum` | Blueberry | fruit | three or four blue blueberries with a dusty bloom and the star-shaped crown |
| `vangueria-infausta` | Wild medlar | fruit | two round brown-yellow wild medlars |
| `vitis-vinifera` | Grape vine | fruit | a bunch of green table grapes with one leaf |

## Wiring (same commit as the PNGs)

In `lib/species-art.ts`, add each painted speciesId to `FRUIT_ART_PNG`:

```ts
export const FRUIT_ART_PNG: ReadonlySet<string> = new Set<string>([
  'mangifera-indica', 'persea-americana', // …
]);
```

`speciesFruitArtworkUrl` then serves the `.png`. Keep the `.svg` placeholders in the repo; they
stay the fallback for any species added later. `tests/calendar-produce.test.ts` checks that every
harvest species has a file on disk at the URL the helper returns.
