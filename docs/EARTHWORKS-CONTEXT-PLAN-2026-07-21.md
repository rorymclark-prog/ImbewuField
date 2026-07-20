# Earthworks, context registers and render layers — plan, 2026-07-21

36 agents, every finding adversarially verified: 13 confirmed, 19 refuted. Phases 1 and 3 landed
in 45bf687. Phases 2 and 4 are OPEN. The 'Do not build' section is a decision record, not a
backlog — re-read it before anyone revisits these ideas.

# ImbewuField — implementation plan, 2026-07-21

## Your three questions, answered

**1. "Auto-place a companion basin/mulch ring when a tree goes down — can we?"**
Technically yes, cheaply; **but don't**, and the agronomy is the reason, not the code. A sunken basin at the collar of an avocado or a pawpaw is not a mis-sized helper, it is the disease. *Phytophthora cinnamomi* is the defining avocado disease in SA and the industry plants on **mounds**; pawpaw collapses to collar rot in a wet basin; macadamia is P. cinnamomi-susceptible and wants a mulch ring, not ponding. An auto-placer that silently drops `tree_basin` next to every fruit tree would ship agronomically wrong advice at scale, under our name, on a printed plan. **Build the tip, not the placement** (Phase 4 below).

Also, three of the arguments in that lane are wrong and shouldn't be quoted in favour of building it: `deriveWaterSystem` (lib/water-system.ts:446) has **zero call sites** — it is not a working precedent for anything; the "completion score inflation" claim is false at its own consumer; and the ghost-suggestion UI being "half-built" does not make wiring it cheap.

**2. "Should earthworks be its own layer / 9th sheet?"**
**No.** Reasons in order of weight:
- It is **10 elements, not 13** — `grep -c "category: 'earthworks'" lib/design-elements.ts` → 10 (design-elements.ts:255–398). docs/LAYER-AUDIT-2026-07-20.md:426 is wrong and that error propagated into the brief. Fix the doc.
- After SHEET_OVERRIDE (glossy-filters.ts:35–41) only 5 would remain: greywater_basin, infiltration_basin, half_moon, berm, terrace. On a real smallholder plan that sheet is empty or near-empty most of the time.
- Cost of yes: one new union member touches ~20 exhaustive sites — glossy-filters.ts:8/45/47/75/82/97, producer-prompt.ts:258/319/371/415 — and three of those (`LEGEND_BY_SHEET`, `SHEET_NO`, `ICON_KEYS_BY_SHEET`) are **prose Records**: tsc will not flag a missing entry, someone must author a marker legend and an icon vocabulary. Plus a Cloud Functions deploy, a Firestore rules edit, and a renumber of the print set we just unified.
- Note the render-budget argument *against* is weaker than the lane claimed: DesignGlossy.tsx:5448 skips zero-content layers, so a mostly-empty sheet costs nothing per job. The real cost is the 20 sites and the prose.

**3. "Generalise the context register beyond Water — is the idea right?"**
**Yes, and it is the cheapest of the three and the only one that fixes bugs that have already cost money.** The idea is right; the current implementation is a water-only special case keyed on a name regex (glossy-filters.ts:66–73: `if (filter !== 'water') return false` + `/bed|basin|circle|spiral/i`). Worse, there is a **ground** register that the prompt asserts exists and doesn't: producer-prompt.ts:521 says "see groundRegister in glossy-filters.ts, which this mirrors" — repo-wide grep for `groundRegister` returns exactly that one comment. The actual rule is the hard-coded ternary on the next line (producer-prompt.ts:522). Three copies of the same membership idea, none of them the authority.

---

## Order of work

### Phase 1 — Prompt truthfulness (text-only, ~half a day, ship alone)
No types, no schema, no deploy beyond the normal one. Visible on the very next render. Every item here is a **shipped bug**: rule 7 says the element list is the sheet's complete contents, so anything drawn-but-unnamed is asserted absent and anything named-but-undrawn gets invented.

1. `lib/producer-prompt.ts:596` — narrow rule 7 from "the COMPLETE contents of this sheet" to *the complete list of this layer's **placed elements***, and state explicitly that ground, boundary and served items are also present and are described by their own rules. Rule 7 as written contradicts `siteFabric` (:523) and `servedClause` (:533), which name additional drawable things on the same sheet.
2. `lib/producer-prompt.ts:600` — gate the drip/pipe/swale sentence on `sheetKind`. `lineInFilter` (glossy-filters.ts:82–95) puts those three on **water only**, so on Planting and Structures we currently name lines that are not in the composite. That is the exact shape of the invention bug.
3. `lib/producer-prompt.ts` rule 6 / `ICON_KEYS_BY_SHEET.zones` (~:419–423, `present` at :475) — on a Zones render nothing matches, and rule 6 degenerates to the literal fragment `ICON LANGUAGE ...: .` Suppress the whole rule when `present` is empty.
4. `lib/producer-prompt.ts:534` — the served clause ends "...they never take a RAINWATER, IRRIGATION or GREYWATER row." Those headings only exist on Water. Replace with "...they are what this layer connects to, not part of it."
5. `lib/producer-prompt.ts:521` — delete the `groundRegister` reference or make it true in Phase 2. Do not leave a comment pointing at a function that does not exist.

**Farmer-visible:** every AI sheet re-rendered after this differs — mainly by *not* containing invented irrigation runs on Planting/Structures. This is the change that pays for itself.

### Phase 2 — Make the ground register real (one function, five consumers)
Write the thing the prompt already claims exists. `export function groundRegister(filter): 'content' | 'context' | 'absent'` in `lib/glossy-filters.ts`, beside `sheetForElement`. Then replace every hand-rolled copy:

- `lib/producer-prompt.ts:522` — `fabricIsContent` ternary → call it.
- `components/design/DesignGlossy.tsx:2383-2389` and `:2769-2777` — the same six-line house/driveway/boundary predicate, copy-pasted, with a comment at :2765 saying they MUST agree. Collapse to one helper, **give it a `filter` parameter**. Today neither takes one, so the orchard wash on the Water sheet paints at the identical alpha it gets on Planting (`${meta.color}99` / `${meta.color}55`+hatch, :2403) — a context register with no visual difference.
- `components/design/DesignGlossy.tsx:294-309` — `layerContentCount` counts zones, filtered items, filtered lines and a free `+1` for boundary on `all`. Ground counts nowhere. Two consequences: a farmer who traced an orchard and a veg garden but placed no trees is **refused the Planting sheet today**; and once ground is content on 01/05/06/07 the gate must count exactly the content rows and nothing else.
- `components/design/DesignPrint.tsx:110-117` — the non-`drawDesign` legend is three hard-coded rows (boundary / house / driveway). Sheet 01 is the one page where ground is unambiguously content and `drawMarks` already paints traced ground on it (DesignGlossy.tsx:578-637, deliberately ungated). Today 01 paints washes its own legend cannot explain. Derive the rows.

**Farmer-visible:** Water sheets show planting context dimmer than before; sheet 01 gains legend rows; some previously-refused Planting sheets now render.

### Phase 3 — Cache and gallery versioning (must ship **with** Phases 1–2, not after)
Non-negotiable: after Phases 1–2 the same map key returns pre-change images.
- `mapKey` (DesignGlossy.tsx:4691/4693) is `producer:${style}:${filter}` with no content hash; the localStorage key is `imbewu_design_glossy_<siteId>_<mapKey>` (:4463), loaded into the preview on mount and on every mapKey change (:4737-4741) with no age signal. Add a plan-version segment and bump it. Five write sites, incl. :5269 (batch queue) and :5438 (which writes an **exact** zones image under a `producer:` key — check that one by hand).
- The durable gallery is the worse vector: `pushGallery` (DesignGlossy.tsx:4710-4722) stamps `id: map-<timestamp>-<random>` and a human label only, persisted via `lib/sheet-store.ts` with **no schema/plan-version field**. A cache prefix bump does nothing here. After this lands a farmer's gallery holds pre- and post-change "04 — Water Plan" side by side, indistinguishable and both downloadable. Add a version field, and either badge or hide pre-version sheets.

### Phase 4 — Companion *advice*, not companion *placement* (only after an agronomist signs off)
Extend the existing advisor, not the canvas. `lib/design-rules.ts:248-264` already filters to `banana_circle` and does proximity work — that is the right home. Emit a tip when a fruit tree is placed: basin / mulch ring / **mound**, per species. No auto-placed item, no parent-child link, no ghost/accept wiring.

---

## Do not build

- **A 9th "Earthworks" sheet.** ~20 sites, three prose Records, a functions deploy, a rules edit, a print-set renumber — for a sheet that is usually empty. Fix the audit doc's 13→10 instead.
- **Auto-placed companion elements.** Agronomically unsafe for avocado/pawpaw/macadamia; and it would land items on the **Planting** sheet (glossy-filters.ts:35-41 maps `tree_basin` → planting), which is probably not what you pictured when you said "basin".
- **A stored parent-child link between element and companion.** No owner for the invariant across copy/paste, remote sync and multi-select delete (placement is a bare object, DesignCanvas.tsx:722-728).
- **A Design Studio BOQ.** `lib/price-book.ts` has two importers, both facilitator-only. Don't open that front to serve this.
- **Wiring `deriveWaterSystem` as a prerequisite.** Zero call sites (lib/water-system.ts:446). If you want it, that's its own decision, not a dependency of this work.
- **A second membership table.** `SECTION_BY_ID` (DesignGlossy.tsx:1417-1421) currently agrees with `sheetForElement` — it duplicates but does not contradict. Leave it, or delete it in favour of the register; do not add a third.

---

## Every place an existing farmer design renders differently

1. **Planting and Structures AI sheets** — drip/pipe/swale lines stop being described, so they stop being invented (Phase 1.2). Biggest visible change.
2. **Zones AI sheet** — the dangling `ICON LANGUAGE ...: .` fragment disappears (Phase 1.3).
3. **All AI sheets** — rule 7's absent-assertion softens; expect fewer omissions of ground and served items (Phase 1.1).
4. **Water sheet** — traced ground washes drop to context alpha; they currently paint at full Planting-sheet strength (Phase 2).
5. **Sheet 01 print legend** — gains real rows in place of the fixed three (Phase 2).
6. **Planting sheet availability** — designs with traced ground but no placed growing items become renderable where they were refused (Phase 2, `layerContentCount`).
7. **Every cached preview and every stored gallery sheet** — invalidated / version-badged (Phase 3). Farmers who already downloaded sheets keep files we can't reach; accept that, but stop the gallery from mixing eras.

---

## Needs an agronomist, not a developer

- Per-species basin vs **mound** vs mulch ring for the fruit-tree catalog — avocado and pawpaw are actively wrong today; macadamia is wrong-ish. This is the only Phase 4 blocker.
- Whether `tree_basin` should keep a fixed 2 m × 2 m circle (design-elements.ts:309-320) at all, or be split into "basin (dryland, water-harvesting)" and "mound (wet/heavy soil, root-rot risk)". Note the lane's claim that catalog canopy figures are the wrong sizing input was **refuted** on the code facts — the sizing question is real, the stated mechanism was not.
- The 33 catalog fields still flagged unsourced from the earlier agronomy pass. Unchanged by this plan, still owed.