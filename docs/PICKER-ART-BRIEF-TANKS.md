# Picker art — tank colour-coding, and a width bug the tests missed

Small batch, five files, all in `public/element-art/`. Two separate problems, both measured.

Rory, on a mockup where the tanks were colour-coded: *"I like the colour coding here and the rain
barrel. Please get Codex to do these colours and sizes also."*

---

## 1. The four JoJo tanks are the same colour

Measured across the delivered set (foliage-free, so this is the tank body itself):

| file | hue | sat | val |
|---|---|---|---|
| `jojo_1000` | 131.1 | 0.529 | 0.413 |
| `jojo_2500` | 114.3 | 0.507 | 0.413 |
| `jojo_5000` | 127.2 | 0.625 | 0.455 |
| `jojo_10000` | 117.8 | 0.551 | 0.424 |
| `rain_barrel` | 217.5 | 0.727 | 0.457 |

**All four tanks sit in a 17° hue band.** They are four green cylinders, and at 88px on a picker
card the only thing telling them apart is size — which is also broken (see below). The rain barrel
is the one element in the group that reads instantly, because it is blue.

**Give each capacity its own colour.** These are real JoJo product colours, so this is
identification, not decoration:

| id | colour | note |
|---|---|---|
| `jojo_1000` | **black / dark charcoal** | the small entry tank |
| `jojo_2500` | **mid green** | keep roughly the current hue, ~115° |
| `jojo_5000` | **dark teal-green** | clearly deeper than the 2500 |
| `jojo_10000` | **beige / sandstone** | the big one, unmistakable |
| `rain_barrel` | **blue** | already right — do not change it |

Target ≥60° of hue spread across the five, and no two within 15°. Report the same
hue/saturation/value table above for the new files.

---

## 2. The 2500 L is drawn NARROWER than the 1000 L

This is the batch-2 failure repeating in a dimension nothing was guarding.

| id | real Ø | drawn width | drawn height |
|---|---|---|---|
| `jojo_1000` | 1.0 m | **88 px** | 112 px |
| `jojo_2500` | 1.4 m | **79 px** ← smaller | 115 px |
| `jojo_5000` | 1.85 m | 118 px | 152 px |
| `jojo_10000` | 2.2 m | 165 px | 183 px |

A farmer comparing the 1000 and the 2500 sees the **larger** tank drawn narrower. The existing
test (`tests/element-art.test.ts`) checks the family is monotonic by drawn **height** — which it
is, 112/115/152/183 — so it passed while the width regressed underneath it. A width guard is being
added on our side, so the corrected files have to satisfy it.

**Draw each tank's width proportional to its real diameter, on a shared ground line**, inside a
192px-equivalent frame:

| id | Ø | width should be about |
|---|---|---|
| `jojo_1000` | 1.0 m | 75 px |
| `jojo_2500` | 1.4 m | 105 px |
| `jojo_5000` | 1.85 m | 139 px |
| `jojo_10000` | 2.2 m | 165 px |

(That is the real diameter scaled so the 10000 L fills the frame as it does now. Height follows the
real tank proportions — a 10000 L JoJo is 2.2 m across and 3.15 m tall, so it stays the tallest.)

The rain barrel is a different family and keeps its own size.

---

## 3. One missing drawing

`greywater_outlet` has **no art at all** — it renders as a lucide glyph on a tinted disc beside
five illustrated neighbours in the new Greywater section of the Water palette.

| id | Ø | oblique ¾ view |
|---|---|---|
| `greywater_outlet` | 0.8 m | Where a greywater line discharges into a basin: a pipe end over a spreader of stones, mulch visible around it. Must read differently from `greywater_diverter`, which is a Y-junction valve up at the house. |

---

## Delivery

`public/element-art/<exact catalogue id>.png`. Same rules as every previous batch: RGBA, all four
corners alpha 0, no ground/shadow/background beyond what the subject itself stands on, and it must
read at 24 px.

Deliver at 512 square, not 1024. These are drawn at 88 px on a picker card and the whole library
is downsized to 192 px anyway — the last two batches both arrived several times larger than
anything ever displayed, and that is now a per-file size test rather than a note.

Paste the hue/sat/val table and the drawn width/height in px for all five tank-family files.
