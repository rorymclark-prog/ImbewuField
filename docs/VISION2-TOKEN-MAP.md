# Vision 2 token map — approved direction, measured

Rory chose the **cool palette** on 2026-08-06. This is the map the design pack does not contain:
the pack proposes 22 colours and shares exactly **one** (`#ffffff`) with this app's 852. Without a
mapping, a `hex → var()` codemod has nothing to key on.

Every row below was measured against `origin/main`. `Δlum` is the change in WCAG relative luminance
— the number that decides whether a swap is invisible or is a redesign. Under ±0.06 reads as the
same colour; above ±0.15 is a visible change to anyone using the app daily.

## The twenty that matter

Twenty mappings cover **3,467 of 5,204 colour uses — 66.6%**.

| app hex | uses | role | → token | new | Δlum | |
|---|---|---|---|---|---|---|
| `#1f4d2b` | 542 | brand / primary action | `--color-forest-800` | `#1e4d33` | +0.000 | ✅ |
| `#e2d8c4` | 531 | hairline border | `--color-border` | `#dde3dc` | +0.062 | ⚠ |
| `#5c5040` | 439 | secondary text | `--color-muted-strong` | *new* | — | see below |
| `#20190f` | 405 | primary text | `--color-ink` | `#1f2420` | +0.006 | ✅ |
| `#8c7a62` | 352 | tertiary text | `--color-muted` | `#667168` | −0.047 | ✅ |
| `#fffefa` | 330 | card surface | `--color-surface` | `#ffffff` | +0.010 | ✅ |
| `#c07a1e` | 130 | status / seasonal | `--color-harvest` | `#d18a1f` | +0.066 | ⚠ |
| `#f7f2e9` | 102 | tint / inset | `--color-canvas` | `#f7f5ef` | +0.021 | ✅ |
| `#eaf3e2` | 80 | brand tint | `--color-sage-100` | `#eef3ea` | +0.011 | ✅ |
| `#fbf6ec` | 78 | tint / inset | `--color-canvas` | `#f7f5ef` | −0.012 | ✅ |
| `#e4dcc6` | 75 | **page background** | `--color-canvas` | `#f7f5ef` | **+0.196** | ⚠⚠ |
| `#9a8268` | 71 | tertiary text | `--color-muted` | `#667168` | −0.082 | ⚠ |
| `#235e86` | 65 | info / water | `--color-water` | `#2e64b5` | +0.029 | ✅ |
| `#94876f` | 54 | tertiary text | `--color-muted` | `#667168` | −0.091 | ⚠ |
| `#ffffff` | 44 | pure white | `--color-surface` | `#ffffff` | +0.000 | ✅ |
| `#d8cbb2` | 37 | strong border | `--color-border` | `#dde3dc` | +0.150 | ⚠ |
| `#f7c97e` | 36 | soft status fill | `--color-sun` | `#f2c94c` | −0.019 | ✅ |
| `#0b120b` | 34 | near-black | `--color-ink` | `#1f2420` | +0.011 | ✅ |
| `#2d6b3c` | 33 | brand light | `--color-forest-700` | `#2e6548` | −0.010 | ✅ |
| `#4e8b3b` | 29 | brand lighter | `--color-leaf-500` | `#5fa66a` | +0.103 | ⚠ |

**The brand survives untouched.** `#1f4d2b → #1e4d33` at Δlum +0.000 across 542 uses is the single
most-used colour in the app and it does not move. Whatever else changes, ImbewuField still looks
like itself.

## Two things the pack must gain before any codemod runs

### 1. A second muted step, or the text hierarchy collapses

The app uses **four** warm greys doing **two different jobs**:

| hex | lum | uses | job |
|---|---|---|---|
| `#5c5040` | 0.084 | 439 | secondary text |
| `#8c7a62` | 0.204 | 352 | tertiary text |
| `#9a8268` | 0.238 | 71 | tertiary text |
| `#94876f` | 0.248 | 54 | tertiary text |

The pack has **one** `--color-muted` at lum 0.156 — between the two groups. Mapping all four to it
pulls secondary text *lighter* and tertiary text *darker* until they meet. **Secondary and tertiary
stop being distinguishable**, which is a loss of information, not a change of style, and it would
land on 916 uses at once.

**Add `--color-muted-strong` at roughly lum 0.085** so `#5c5040`'s job survives. `--color-muted`
then serves the three tertiary greys, which genuinely are one value pretending to be three.

### 2. The page background is the whole decision, in one row

`#e4dcc6 → #f7f5ef` is **Δlum +0.196**, by far the largest shift here, and it is what "warm paper
becomes near-white" actually means. `app/globals.css` says of this exact value: *"page — warm paper,
**never #fff**"*.

That comment is a decision someone made deliberately for an app used outdoors in bright sun, where a
near-white ground glares and a warm one does not.

**DECIDED 2026-08-06 — go near-white, do not wait for a sun test.** Rory: *"most work is going to be
done indoors design finance loging just about everything except taking photos of diseased plants
etc so i would go with what we feel best and if that proves to need tweaking in a few months so be
it."*

The reasoning holds, and holds harder than stated: the one screen genuinely used standing in a field
is the map, and the map is mostly satellite imagery with **dark-on-photo chrome** that this token
does not touch (see the three-layer split — imagery, chrome, data marks). `--color-canvas` governs
the document-like screens, which are the indoor ones.

If a glare problem ever does surface, the fix is one line — `--color-canvas` moves toward the pack's
own `--color-sand-100 #F3E9D6` — and **every other row in this map still stands**. That is precisely
why the migration goes through tokens first: this decision stays reversible at one site instead of
5,217. The screens to re-check first if it is ever revisited are the two that are plausibly used
outdoors: the field journal and harvest logging.

## The remaining third

**1,737 uses across 832 distinct colours** are not in the table. Do not batch these. They are
one-offs, chart series, illustration fills and per-component tints, and a blanket rule over them is
how 500 borders quietly change shade. Map them per component, as each screen is redesigned.

## Themes

The app has **four** — `earth`, `earth.dark`, `slate`, `slate.dark`. The pack has **one `:root`**
and no dark values at all. Adopting it as written deletes dark mode and the slate theme.

Keep the existing four-theme structure. The pack supplies the `earth` (light) column only; the dark
columns are derived and reviewed separately. **A token map with one value per token is incomplete by
construction** and must not be applied as though it were finished.

## Order

1. Add `--color-muted-strong` and the four theme columns to `globals.css`. No component changes.
2. Migrate **one screen** end to end — `/finances` is a good first: dense, text-heavy, no map.
3. Look at it on a phone, outdoors, in sun. Then decide whether to continue.
4. Only then the remaining screens, one at a time.

Never a repo-wide codemod. `tests/css-token-collisions.test.ts` guards the duplicate-declaration
fault that caused Q22; it does not guard a wrong mapping, and nothing can.
