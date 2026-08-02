> ## STATUS — 2026-08-02, updated as items land
>
> 93 findings raised by a 102-agent audit, 76 survived independent refutation, 27 queued.
>
> **DONE by Claude (committed, pushed, CI green):**
> - **Q22 + Q23 — security.** Anyone could sign up as "Mentor" and read every farmer's sales,
>   production and expense records; and a farmer could re-point their own sale into someone else's
>   books. Also closed: `shared_sites` could be LISTED, exposing every shared farm design to an
>   unauthenticated caller. `tests/firestore-rules.test.ts` had asserted two of these since it was
>   written and had **never once run** — it now runs in CI. **RULES ARE NOT DEPLOYED. Rory must run
>   `firebase deploy --only firestore:rules`.**
> - **Q1, Q2, Q3 — the printed BOQ.** Charged for things already standing (a traced boundary, track
>   and dam ≈ R268 000 on the funder's copy while the screen showed R0); priced a tank bank off its
>   combined litres (R39 000 vs R21 000, error grows with every tank); costed swales on the wrong
>   basis from a hand-kept list that had lost `swalew`.
> - **Q6, Q7 — invoices.** 12.5 kg billed as 12, always in the farmer's disfavour; and a failed save
>   still printed and WhatsApped the invoice while burning the number.
> - **Q15 — crop prices.** Clearing a price field persisted R0 and permanently shadowed the
>   researched default, with no reset control to undo it.
>
> **NEXT, in harm order:** Q21 (offline renders R0 as fact, then offers to seed fake money into the
> real books), Q27, Q17, Q19, Q18, then the rest of the partition below.
>
> A Codex brief for Group A already exists at `~/ImbewuField-money/CODEX-TASK.md` (worktree on
> branch `codex/farmer-money-boq`) — now superseded for Q1-Q3, but the format is the template for
> handing over the remaining groups.

## 1. DO NOT TOUCH — standing rules

1. **Never change a number.** No price, rate, yield, VAT figure, spacing, depth constant, or agronomic value may be edited. Changing *how a number is calculated, labelled, filtered, formatted, or sourced* is queue work. Changing the number itself is section 3, always. This explicitly includes `PRICE_BOOK` `zar` values, `DEFAULT_CROP_PRICES`, `CROPS[].yieldKgPerM2`, `POND_ASSUMED_DEPTH_M`, `DEFAULT_CASHFLOW_SETTINGS`, and `TANK_SIZES`.
2. **Never touch `PLAN_VERSION`.** Bumping it re-charges paid renders.
3. **Never commit secrets, `.env*`, `serviceAccount.json`, or service-account keys.**
4. **Any new test file must be added to the hand-maintained list in `package.json`** (the `test` script manifest, enforced by `tests/test-manifest.test.ts`), or it will not run. `tests/firestore-rules.test.ts` stays in `EXTERNAL_TEST_FILES` — do not move it into `npm test`.
5. **One commit per queue item.** Do not batch. Commit message must name the item.
6. **Do not deploy.** No `firebase deploy`, no `vercel`, no rules push. Rules changes are code changes only.
7. **Do not refactor beyond the item's stated scope.** No renames, no file moves, no style sweeps.
8. **Do not fix a section-3 item** even if it is one line away from a file you are editing.
9. **Do not delete or weaken an existing test.** Extend it.

---

## 2. QUEUE

Ordered by (farmer harm × confidence).

---

### Q1 — Printed BOQ costs existing-layer geometry; on-screen budget does not

**Files:** `app/facilitator/print/page.tsx` lines 339–341 (tally input), 421–452 (tallies), 454–487 (costing), 679–705 (render).

**What is wrong.** `components/FacilitatorCanvas.tsx` deliberately excludes everything on the `'existing'` layer before costing: `isExistingItem`/`isExistingLine` (2235–2236), `plannedItems` (2252), `plannedLines` (2297), `boqCosts`/`lineCosts`/`estBudgetTotal` (2312–2322), and renders the excluded set uncosted under "Already on the land — Existing, not counted in the budget" (4014–4030). The print page contains **zero** occurrences of the string `existing` in its costing path: `itemPts`/`linePts` are built from all of `state.items`/`state.lines` and every row is priced into `total`.

Existing geometry is auto-created, not just hand-marked: `FacilitatorCanvas.tsx:1173` writes the traced property boundary as `{kind:'fence', closed:true, layer:'existing'}`, `:1183` map water as `waterbody/existing`, `:1195` OSM roads as `path/existing`, `:1544`/`:1555` detected beds/tanks as `existing`. `lib/facilitator-design.ts:76-80` also makes "What's there" a first-class step whose palette places shed/tree/well/fence/path on the existing layer.

**Failure.** 1 ha plot, "Find map features" accepted: 400 m boundary fence + 300 m track + 800 m² dam. Screen shows R0 under "Already on the land". Printed BOQ TOTAL reads 400×R250 + 300×R80 + 800×R180 = R268 000. The printed pack is what goes to a funder.

`lib/price-book.ts:112` states the intended rule in its own note: "Only applies when planning a NEW dam — an existing one traced from the map is not costed." The print path violates it.

**Fix.**
1. Import `layerForItem` and `layerForLine` from `lib/facilitator-design`.
2. Derive two new arrays immediately after line 341:
   - `const plannedItemPts = itemPts.filter(({ it }) => layerForItem(it.layer, it.type) !== 'existing');`
   - `const plannedLinePts = linePts.filter(({ l }) => layerForLine(l.layer, l.kind) !== 'existing');`
3. Drive `itemTally` (421–437) and `lineTally` (438–452) from `plannedItemPts`/`plannedLinePts` instead of `itemPts`/`linePts`. Leave the drawing code using the full `itemPts`/`linePts` untouched.
4. Add an uncosted "Already on the land" block below the BOQ table, built from the complement (existing items/lines), showing label + quantity only, no rand, with the text `Existing — not counted in the budget.` — mirroring `FacilitatorCanvas.tsx:4014-4030`.

**HOW TO VERIFY.** Extend `tests/facilitator-design.test.ts`. Add a test `'the print BOQ excludes existing-layer geometry'` that reads `app/facilitator/print/page.tsx` as source and asserts: it imports `layerForItem` and `layerForLine` from `lib/facilitator-design`, and that the identifiers feeding `itemTally`/`lineTally` are the filtered arrays (assert the source matches `/plannedItemPts/` and `/plannedLinePts/` and `assert.doesNotMatch` the tally loops against the unfiltered names). Better if practicable: extract the tally+cost computation into an exported pure function in `lib/facilitator-design.ts` taking `FacilitatorDesignState` and returning `{rows, total}`, have both builders call it, and write a real numeric test asserting a fixture with one `layer:'existing'` fence of 400 m yields `total === 0`. If you extract, both callers must use the extracted function — do not leave a second copy.

**Do NOT change while in this file.** Any `zar` value, `resolveItemLayer`/`resolveLineLayer` page-selection logic (lines 496–499), the hand-copied `CATALOG`/`LINES` tables (32–68), or the drawing/paging code.

---

### Q2 — Printed BOQ prices a tank bank off combined litres, then multiplies by count

**File:** `app/facilitator/print/page.tsx` lines 437, 460, 467–470.

**What is wrong.** Line 437 accumulates `cur.litres += it.litres ?? 5000` across every tank, so `t.litres` is the **sum**. Line 460 computes the correct per-unit cost with `t.litres / t.count` — and the tank branch at 467–470 discards it, passing the **total** into `costForItem` and then multiplying the returned per-unit price by `t.count`. `lib/price-book.ts:343-349` treats `litres` as one tank's volume and snaps via `nearestTankKey` (261–284) to 2500/5000/10000.

**Failure.** Three default 5 000 L tanks: `t.litres = 15000` → `nearestTankKey` → `tank_10000` = R13 000 → ×3 = **R39 000**. Correct: 3 × R7 000 = **R21 000**. `FacilitatorCanvas.tsx:2314` costs per item and shows R21 000 on screen. Four 2 500 L tanks: R52 000 printed vs R22 000 true. Error grows with tank count and always overstates.

**Fix.** Cost tanks per placed instance, not per tally row. Inside the `type === 'tank'` branch (467–470), keep the `qty` display string unchanged, and replace the cost computation so it sums `costForItem('tank', c.w, c.h, it.litres ?? 5000)?.zar` over the individual tank items that contributed to this tally row, multiplied by each item's own `count ?? 1` — matching `FacilitatorCanvas.tsx:2314`. If the tally structure makes per-instance access impractical, carry a running `zarSum` on the tally object accumulated at line 437 alongside `litres`, and use that. Do not use the `t.litres / t.count` average — it mis-prices a mixed bank (one 2 500 + one 10 000 averages to two 5 000).

**HOW TO VERIFY.** New test in `tests/price-book.test.ts` (already in the manifest): `'N tanks of size S cost N x the size-S rate'` asserting `costForItem('tank', w, h, 5000)!.zar * 3 === 21000` and, critically, that `costForItem('tank', w, h, 15000)!.zar !== costForItem('tank', w, h, 5000)!.zar * 3` — documenting that summed litres must never be passed. Then add a source-level assertion in `tests/facilitator-design.test.ts` that `app/facilitator/print/page.tsx` does not contain `costForItem(type, c.w, c.h, t.litres)`.

**Do NOT change while in this file.** `nearestTankKey`, `TANK_SIZES`, any tank price, or the `qty` display string format.

---

### Q3 — `swalew` is missing from the print page's area-priced item list, inflating every swale by ×1.5

**File:** `app/facilitator/print/page.tsx` line 463 (the hardcoded type list), 460, 465, 471–472.

**What is wrong.** `swalew` is `unit: 'per_m2'` in `lib/price-book.ts:121-126` and mapped at `:322`. The print page's hardcoded area-priced whitelist at line 463 (`bed|hugel|foodforest|nursery|greenhouse|tunnel|shed|reedbed|pond|firebreak`) omits it — it is the **only** `per_m2` entry in `ITEM_TYPE_MAP` missing from that list. It therefore falls to the generic branch, where line 460 passes `t.areaM2 / t.count` as `wM` and the **catalog default `c.h` (1.5)** as `hM`, so `costForItem` computes `area × 1.5`.

**Failure.** Default 8 m × 1.5 m swale berm = 12 m². Canvas: 8 × 1.5 × R60 = **R720**. Print: 12 × 1.5 × R60 = **R1 080**. Six 20 m × 2 m swales (240 m², true R14 400) print as R21 600. Fixed +50% on every swale, and the Qty column reads `×6` rather than the m² actually charged.

**Fix.** Two parts, both required:
1. Replace the hardcoded type list at line 463 with a derivation from the price book: add and export a predicate from `lib/price-book.ts` — `export function isAreaPricedItemType(type: string): boolean` returning whether `PRICE_BOOK[ITEM_TYPE_MAP[type]]?.unit === 'per_m2'` — and use it at line 463 so no future `per_m2` element can be missed. Do not hand-add `'swalew'` to the string list; derive it.
2. Confirm the area branch at 465 (`costForItem(type, t.areaM2, 1)`) is the one taken, and that the Qty column prints m² for these types.

**HOW TO VERIFY.** New test in `tests/price-book.test.ts`: `'every per_m2 item type is recognised as area-priced'` — iterate `ITEM_TYPE_MAP`, and for each whose `PRICE_BOOK` entry has `unit === 'per_m2'`, assert `isAreaPricedItemType(type) === true`; assert it is `false` for `'tank'`. Plus a source assertion in `tests/facilitator-design.test.ts` that `app/facilitator/print/page.tsx` imports `isAreaPricedItemType` and no longer contains the literal `type === 'firebreak'` chain.

**Do NOT change while in this file.** The `swalew` rate (that inconsistency is section 3, item D3), `CATALOG` heights, or the drawing code.

---

### Q4 — `foodforest` is drawn and measured as a circle but costed as a square

**File:** `lib/price-book.ts` lines 363–364.

**What is wrong.** `const isCircular = type === 'pond' && (!hM || hM === wM);` hardcodes circularity to one type. `foodforest` is `shape: 'circle', w: 8, h: 8` (`FacilitatorCanvas.tsx:68`), `keepRatio` on the Transformer (`:3843`), `bakeTransform` preserves `wM === hM` (`:2049-2051`), and the property panel shows only a "diameter m" field for circles (`:3911-3916`). The area **displayed** is circular (`FacilitatorCanvas.tsx:2241`, `Math.PI*(wM/2)**2`), but the area **costed** is `wM * hM`.

**Failure.** Default 8 m food forest: BOQ row reads `Food forest ×1 · 50m²` and beside it `R4 480` (from 64 m² × R70). The circular figure is 50.27 × R70 = R3 519. The row contradicts itself, and the print page — which passes the already-circular `t.areaM2` — prints R3 519, so screen and paper differ by R961 on one element, R6 009 on a 20 m one.

**Fix.** Make circularity a property, not a type check.
1. Add an optional parameter to `costForItem`: `costForItem(type, wM?, hM?, litres?, opts?: { circular?: boolean })`, defaulting to the existing behaviour when omitted.
2. Change line 363 to `const isCircular = opts?.circular ?? (type === 'pond' && (!hM || hM === wM));` — preserving pond's current behaviour exactly.
3. At `components/FacilitatorCanvas.tsx:2314`, pass `{ circular: CATALOG[i.type]?.shape === 'circle' }`.
4. Leave the print page call sites alone: they already pass the circular area with `hM = 1`, which is correct.

**HOW TO VERIFY.** New test in `tests/price-book.test.ts`: `'a circular footprint is costed on its circle area, not its bounding box'` asserting `costForItem('foodforest', 8, 8, undefined, { circular: true })!.zar === Math.round(Math.PI * 16 * 70)` and that without the flag it still returns `Math.round(64 * 70)`; plus `costForItem('pond', 12, 12)` continues to return the circular figure unchanged (regression guard on the existing pond path).

**Do NOT change while in this file.** Any `zar` value, any `note` text, `nearestTankKey`, `FREE_LINE_KINDS`, or the pond branch's existing result.

---

### Q5 — `saSeasonMonths`/`inPeriod` on the finances page break the year-crossing summer season

**File:** `app/finances/page.tsx` lines 642–656 (delete), plus call sites in `buildLedgerRows` (662–676).

**What is wrong.** Line 652 rejects any row whose calendar year differs from `now`'s **before** the season-month test at 655 — but `saSeasonMonths` returns `[11, 0, 1]` (Dec/Jan/Feb) for the SA summer, which crosses New Year. In December, January and February of the *same* calendar year (the *previous* season) are pulled in; in January and February, the December that started the season is dropped.

The corrected implementation already exists and is tested: `lib/harvest-reconciliation.ts:90-112` anchors the season to its starting December, with the comment at 100–102, covered by `tests/harvest-reconciliation.test.ts:170`. Its header at 68–71 states it was duplicated **from** this page. Both render on the same screen (`page.tsx:1006` and `:1014`, same `period` prop), so the ledger and the harvest panel currently disagree.

**Failure.** 20 Dec 2026, "Season": Jan 2026 R8 400 + Feb 2026 R6 100 + Dec 2026 R3 200 = Income R17 700 instead of R3 200. 15 Jan 2027, "Season": the R3 200 December vanishes. Wrong figures also flow into `exportLedgerCsv` → `imbewufield-financial-sheet-season.csv`, the file handed to a co-op or lender.

**Fix.**
1. In `lib/harvest-reconciliation.ts`, export the existing `monthsForPeriod` and `inPeriod` helpers (add `export` — do not alter their logic).
2. In `app/finances/page.tsx`, delete the private `saSeasonMonths` and `inPeriod` (642–656) and import the exported ones. Keep the call signature at 662–676 identical.
3. Remove the now-stale "duplicated from" comment at `lib/harvest-reconciliation.ts:68-71` and replace it with a one-line note that this is the single season authority.

**HOW TO VERIFY.** Extend `tests/harvest-reconciliation.test.ts` (already in the manifest) with two cases against the now-exported `inPeriod`: with `now = 2026-12-20` and `period = 'season'`, assert a `2026-01-12` date returns `false` and a `2026-12-20` date returns `true`; with `now = 2027-01-15`, assert a `2026-12-20` date returns `true` and a `2025-12-20` date returns `false`. Do not weaken the existing test at line 170.

**Do NOT change while in this file.** `fmtZAR`, `fmtDate`, `exportLedgerCsv` (that is Q10), the sample-data seeder, or the `month`/`year` period semantics.

---

### Q6 — Invoice quantity is `parseInt`, truncating fractional kg and silently zeroing sub-unit lines

**File:** `app/invoice/page.tsx` line 384.

**What is wrong.** `qty: Math.max(0, parseInt(e.target.value, 10) || 0)` with `inputMode="numeric"`, while `UNITS` (line 20) includes `'kg'` and `'crates'`, and the price field one line below (395) correctly uses `parseFloat` with `inputMode="decimal"`. `lib/invoices.ts:115-131` `cleanItem` accepts any finite `qty > 0` — fractions persist fine; the input field is the only thing destroying the number. The same app parses kg with `parseFloat` and `step="0.1"` on the sales form (`app/finances/page.tsx:419`, `:533`).

**Failure.** 12.5 kg tomatoes at R29/kg → `parseInt('12.5')` = 12 → line R348 instead of R362.50, on the PDF the buyer pays from. Truncation is one-directional: the farmer is always underpaid. Sub-unit quantities (0.75 kg chillies) become `0`; with a second valid line present, `valid` still passes, `cleanItem` rejects the zero line, `cleanInvoice` rejects the **whole** invoice, `saveInvoice` returns the prior list — a printed and WhatsApped invoice with no stored record, and the sequence number burned.

**Fix.**
1. Line 384: `qty: Math.max(0, parseFloat(e.target.value) || 0)`.
2. Change `inputMode="numeric"` → `inputMode="decimal"` and add `step="0.01"` on the same input, matching line 395.
3. Do **not** attempt decimal-comma normalisation — locale input handling is out of scope here.

**HOW TO VERIFY.** Add to `tests/invoices.test.ts` (already in the manifest): `'a fractional kilogram line survives save and totals correctly'` — build an invoice with `items: [{ desc: 'Tomatoes', qty: 12.5, unit: 'kg', price: 29 }]`, `saveInvoice` it, `loadInvoices`, and assert the stored `items[0].qty === 12.5` and `total === 362.5`. This asserts the persistence contract the UI must now honour.

**Do NOT change while in this file.** `total` (that is Q8), `persist()` (Q7/Q9), the date logic (Q11), the hardcoded seller line (Q13), or the `min={0}` clamp.

---

### Q7 — `persist()` discards `saveInvoice`'s failure signal, then prints and burns the number anyway

**File:** `app/invoice/page.tsx` lines 82–101 (`persist`), 103–106 (`printInvoice`), 155–171 (`shareInvoice`).

**What is wrong.** `saveInvoice` returns the **durable** ledger and skips `notify()` when the write fails or the record is rejected (`lib/invoices.ts:254`, `:260`) — deliberate, tested behaviour (`tests/invoices.test.ts:251`). `saveNextInvoiceNumber` returns `false` on failure (`lib/invoices.ts:324-337`). `persist()` reads neither, then unconditionally advances `seq`, persists it, and sets `currentId` — so the UI shows "Editing #0044" and the farmer prints and WhatsApps an invoice with no stored record.

Two reachable triggers: (a) a described line with `qty <= 0` (see Q6) makes `cleanInvoice` reject the whole record; (b) localStorage quota exhaustion or Safari private mode — `lib/design-canvas.ts` documents a real production incident of the render cache starving other saves.

**Failure.** #0044 for R3 500 goes to the buyer; the ledger has no #0044; `/finances` income and CSV omit it; the counter jumps to #0045 leaving a permanent numbering gap. If `saveNextInvoiceNumber` also failed (quota), `loadNextInvoiceNumber` falls back to 44 on next load and a *second* different invoice is issued as #0044.

**Fix.**
1. Change `persist()` to return a discriminated result: capture `const list = saveInvoice({...});` then `const stored = list.some((x) => x.id === id);`.
2. If `!stored`: do **not** advance `seq`, do **not** call `saveNextInvoiceNumber`, do **not** set `currentId`. Set a new error state string and return a failure result.
3. Only advance and persist the sequence when **both** `stored` is true and `saveNextInvoiceNumber(nextSeq)` returned `true`.
4. In `printInvoice` and `shareInvoice`, abort before `window.print()` / PDF build when `persist()` reports failure.
5. Render the error above the action buttons with the literal text: `Not saved — this phone's storage may be full, or a line has no quantity. Fix it before printing.` Clear the error on the next successful persist.

**HOW TO VERIFY.** Add to `tests/invoices.test.ts`: `'saveInvoice returns a ledger without the record when the invoice is rejected'` — call `saveInvoice` with an invoice containing one valid and one `qty: 0` item and assert the returned array contains no entry with that `id`, i.e. the caller has a reliable success test. (The page-level abort is not unit-testable without a DOM harness; reason it through by confirming both call sites gate on the returned flag.)

**Do NOT change while in this file.** `lib/invoices.ts` semantics — `saveInvoice`'s `return before` and the `cleanInvoice` reject-whole rule are deliberate and tested; adapt the caller, not the library.

---

### Q8 — PDF Total is summed over lines the PDF does not print and the ledger does not store

**File:** `app/invoice/page.tsx` lines 58 (`total`), 134 (PDF row filter), 144 (PDF total), 89 (save filter), 258 (screen rows).

**What is wrong.** `total` sums **all** `items`. The PDF renders only `items.filter((it) => it.desc.trim())` and then prints the unfiltered `total`. `persist()` saves only the filtered items, and `cleanInvoice` (`lib/invoices.ts:153`) recomputes the stored total from those — deliberately, per `tests/invoices.test.ts:117-122`. `valid` (line 59) only requires *some* line to have a description, so a priced nameless line passes.

**Failure.** Line 1 Amadumbe 3 bags @ R250 = R750. Line 2: price 300, qty 2, description never typed (easy — `updateItem` autofills price *from* description, so clearing a name to retype leaves a priced nameless row). PDF prints one line at R750 under `Total R1 350`. Ledger stores R750. The buyer is billed R600 more than is itemised; the farmer's income under-reports by R600.

**Fix.**
1. Introduce `const billable = items.filter((it) => it.desc.trim() !== '');` near line 58.
2. Compute `total` from `billable`.
3. Use `billable` for the PDF rows (134), the on-screen document rows (258), and the `items` passed to `saveInvoice` (89) — one array feeding all four.
4. Leave the editor list (the input rows) iterating the full `items` so the farmer can still see and finish the incomplete row.

**HOW TO VERIFY.** Add to `tests/invoices.test.ts`: `'the stored total equals the sum of the lines that survive cleaning'` — save an invoice whose `items` include one described line (3 × 250) and pass a deliberately inflated `total: 1350`; assert the loaded record's `total === 750` and `items.length === 1`. This pins the library contract the page must now match. Additionally assert in a source-level check that `app/invoice/page.tsx` contains exactly one `reduce` computing `total` and that it operates on `billable`.

**Do NOT change while in this file.** `valid`'s semantics beyond what is stated, the `cleanInvoice` recompute in `lib/invoices.ts`, or the placeholder text rendering.

---

### Q9 — Printing or sharing a saved invoice overwrites its issue date and prints today's

**File:** `app/invoice/page.tsx` lines 90 (`persist`), 127 (PDF date), 245 (screen date), 182–189 (`openSaved`), 23 (`todayLong`).

**What is wrong.** `persist()` writes `dateISO: new Date().toISOString()` unconditionally — including when `currentId` is set (a reopen). The document never reads the stored date: both the PDF (127) and the screen (245) call `todayLong()`. `openSaved` restores id/no/billTo/items but there is no date state in the component at all. `lib/invoices.ts:246-252` explicitly preserves `paidAt`/`paymentMethod` on re-save ("must not erase evidence") — `dateISO` was omitted from that protection.

**Failure.** #0044 issued to Spar 15 March, unpaid. On 2 August the farmer reopens it to resend a reminder and taps Share PDF. The buyer receives an invoice numbered #0044 dated 2 August; the Saved list — the farmer's only debt-ageing signal (line 321) — now reads 2 Aug. The March date exists nowhere. She stops chasing a 140-day debt.

**Fix.**
1. Add component state `const [docDateISO, setDocDateISO] = useState<string>(() => new Date().toISOString());`
2. `newInvoice()` sets it to `new Date().toISOString()`.
3. `openSaved(inv)` sets it to `inv.dateISO`.
4. `persist()` writes `dateISO: docDateISO`.
5. Render the document date from `docDateISO` — replace `todayLong()` at 127 and 245 with a formatter taking `docDateISO` (reuse `todayLong`'s `toLocaleDateString('en-GB', ...)` options; do not change the format).
6. In `lib/invoices.ts` `saveInvoice`, add `dateISO` to the same preservation block as `paidAt` (246–252): when a `previous` record exists, keep `previous.dateISO`.

**HOW TO VERIFY.** Add to `tests/invoices.test.ts`, mirroring the existing `paidAt` test at line 171: `'re-saving an existing invoice never moves its issue date'` — save an invoice with `dateISO: '2026-03-15T…'`, then `saveInvoice` the same `id` with a different `dateISO` and a changed `billTo`; assert `billTo` updated and `dateISO === '2026-03-15T…'`.

**Do NOT change while in this file.** `paidAt` handling, the invoice-number sequence, or the `todayLong` format string.

---

### Q10 — CSV export writes rounded currency as text and year-less dates

**File:** `app/finances/page.tsx` lines 679–686 (`exportLedgerCsv`), 29–33 (`fmtZAR`), 34–41 (`fmtDate`), 658 (`LedgerRow.iso`).

**What is wrong.** The In/Out columns are written through `fmtZAR`, which `Math.round`s and prefixes `R ` with space thousands separators, then every cell is quoted — so amounts land as text with cents destroyed. The Date column is `fmtDate` output (day + short month, no year). `LedgerRow` already carries an `iso` field with the full date (658), populated for all four row kinds — the correct date is available and discarded.

**Failure.** Cents are reachable by design: the amount input is `step="0.01"` (541) parsed with `parseFloat` (418), and invoice totals are unrounded `qty * price` (`lib/invoices.ts:153`). A R4 237.50 invoice exports as `"R 4 238"`, dated `"15 Mar"`. The on-screen Income stat rounds the *sum* once (705) while the CSV rounds *each row*, so three R100.50 sales show `R 302` on screen and `R 101 ×3 = R303` in the file. This is the only export the farmer's books have.

**Fix.**
1. Amount columns: write the raw numbers — `r.inAmt ?? ''` and `r.outAmt ?? ''` — with no `fmtZAR`, no currency symbol, no thousands separator.
2. Emit them unquoted (leave the quoting wrapper for the text columns only, or quote uniformly but ensure the value is a bare numeric string like `4237.5`).
3. Date column: write `r.iso.slice(0, 10)` (ISO `YYYY-MM-DD`) instead of `r.date`.
4. Rename the header cells to `In (ZAR)` and `Out (ZAR)`.
5. Add the year to the filename when `period !== 'year'` is ambiguous — append `now.getFullYear()`, e.g. `imbewufield-financial-sheet-season-2026.csv`.
6. Leave `fmtZAR` and `fmtDate` untouched for on-screen display.

**HOW TO VERIFY.** New test file `tests/finances-export.test.ts` — **add it to the `test` script list in `package.json`**. Export `buildLedgerRows` and `exportLedgerCsv`'s pure CSV-building step from `app/finances/page.tsx` (extract the string-building into an exported helper, e.g. `export function ledgerRowsToCsv(rows: LedgerRow[]): string`, keeping the blob/download side effect in the component). Assert: a row with `inAmt: 4237.5` produces a cell whose value parses as `4237.5` under `Number()`; the date cell matches `/^\d{4}-\d{2}-\d{2}$/`; and the sum of the parsed In column equals the sum of `inAmt` exactly.

**Do NOT change while in this file.** `fmtZAR`'s rounding behaviour for the on-screen stat tiles, `buildLedgerRows`'s filtering (that is Q5), or the sample-data seeder.

---

### Q11 — Printed WhatsApp budget quotes perimeter metres against per-m² prices

**File:** `components/FacilitatorCanvas.tsx` lines 2509–2513.

**What is wrong.** `shareBudgetOnWhatsApp` prints `${l.m.toFixed(0)} m` for every line row with no branch on `l.areaM2`, while the rand figure beside it comes from `lineCosts` (2317–2320), which for `AREA_LINE_KINDS` (`driveway`, `patio`, `waterbody` — `lib/facilitator-design.ts:33`) is `costForMeasuredAreaLine(kind, l.areaM2)`, an area × per-m² rate. The on-screen row gets this right (4057: `l.areaM2 != null ? m² : ~m`), the printed pack gets it right (`app/facilitator/print/page.tsx:656-658`), and the BOQ loop directly above at 2505 already branches on `b.areaM2`. Only the WhatsApp text omits it.

**Failure.** 20 m × 5 m driveway = 100 m² area, 50 m perimeter, R25 000. Screen: `Driveway 100 m² — R25 000`. WhatsApp: `• Driveway — 50 m — R25 000`. A contractor reading it quotes 50 running metres; the farmer computes R500/m and prices an extension at half its real cost.

**Fix.** In the loop at 2509–2513, replace the quantity expression with the same branch used at line 4057: emit `${l.areaM2.toFixed(0)} m²` when `l.areaM2 != null`, else `~${l.m.toFixed(0)} m`.

**Also fix in the same commit** (same root, same file): line 2474 in the AI design-review layout text reports `~${l.m.toFixed(1)}m total` for area kinds, so the review model never sees the area. Apply the identical branch.

**HOW TO VERIFY.** Extract the row-formatting expression into a small exported pure helper in `lib/facilitator-design.ts` — `export function formatLineQuantity(l: { m: number; areaM2?: number | null }): string` — and use it at `FacilitatorCanvas.tsx:2512`, `:2474`, `:4057` and `app/facilitator/print/page.tsx:656`. Then add to `tests/facilitator-design.test.ts`: `'area-measured lines are quoted in square metres everywhere'` asserting `formatLineQuantity({ m: 50, areaM2: 100 })` contains `m²` and not a bare ` m`, and `formatLineQuantity({ m: 50 })` contains ` m`. Add a source assertion that `FacilitatorCanvas.tsx` no longer contains `l.m.toFixed(0)} m${costTxt}`.

**Do NOT change while in this file.** `estBudgetTotal`, the planned/existing split, `POND_ASSUMED_DEPTH_M`, or the "Planning estimates — prices vary." suffix.

---

### Q12 — The guided-mode budget figure carries no disclaimer, and guided mode cannot reach one

**File:** `components/FacilitatorCanvas.tsx` lines 3603–3610.

**What is wrong.** The guided `plan` step renders `Estimated cost of your plan  R X` bare. `DISCLAIMER` (`lib/price-book.ts:258-259` — the only place the pricing date appears in any UI) is rendered at exactly one place in this component, line 4070 — inside the block gated at 3887 by `{uiMode === 'pro' && (`, closing at 4254. Guided mode is the default (694, `useState<'guided' | 'pro'>('guided')`). So for a first-time farmer the disclaimer is not collapsed — it is **not in the DOM**. The two other caveat-bearing exits (WhatsApp share button at 4081, Print plan button at 4125) are also inside the Pro block.

`GUIDED_STEPS[3]` (line 46) instructs "Check the cost, then make your finished map" — the app directs the farmer to treat this bare figure as the cost check.

**Fix.** Render a short caveat directly beneath the guided total at line 3609. Use a new short constant exported from `lib/price-book.ts` alongside `DISCLAIMER` — `export const DISCLAIMER_SHORT = 'Rough estimate, late-2025/early-2026 prices — get local quotes.'` — and render it in a small muted line under the figure. Do not alter `DISCLAIMER`. Do not change the pricing date wording (it is a number-adjacent fact; the text must match the existing `DISCLAIMER` vintage string exactly).

**HOW TO VERIFY.** Add to `tests/facilitator-design.test.ts`: `'the guided cost figure carries a caveat'` — read `components/FacilitatorCanvas.tsx` as source and assert that within the guided tool-tray block, the string `Estimated cost of your plan` is followed within 400 characters by `DISCLAIMER_SHORT`. Plus a test in `tests/price-book.test.ts` asserting `DISCLAIMER_SHORT` and `DISCLAIMER` both contain the same vintage substring, so the two can never drift.

**Do NOT change while in this file.** The Pro/guided gate itself, `estBudgetTotal`, the BOQ panel, or `DISCLAIMER`'s wording.

---

### Q13 — Every invoice states a hardcoded false place of business

**Files:** `app/invoice/page.tsx` lines 119 (PDF) and 232 (screen); `lib/db/types.ts` lines 15–23 (`Profile`); `app/account/page.tsx` lines 41, 70 (profile form).

**What is wrong.** `'Tugela Valley smallholding'` is a string literal on both the shared PDF and the printed/on-screen document, immediately under the farmer's real name and phone (which *are* read from the profile at 55–56). `Profile` has no address, farm-name, town or district field, so it cannot be replaced by user data, and the account form writes only `full_name`, `phone`, `language`, `photo_url`. It fires on 100% of invoices for 100% of users.

**Failure.** A farmer in Limpopo sends a wholesaler a PDF headed with her real name and then, as her place of business, a KwaZulu-Natal location ~900 km away. A SA tax invoice must identify the supplier; a buyer's bookkeeper checking supplier details finds a false address.

**Fix.**
1. Add an optional field to `Profile` in `lib/db/types.ts`: `farm_location?: string; // freeform town / district shown on invoices`.
2. Add a text input for it to `app/account/page.tsx` (label `Farm location (town or district)`, placeholder empty) and include it in the `updateMyProfile` payload at line 70.
3. In `app/invoice/page.tsx`, replace both literals with `profile?.farm_location`. When it is empty or missing, **render nothing** — omit the line entirely on both the PDF (skip the `y += 16; doc.text(...)`) and the screen. Never substitute a placeholder.

**HOW TO VERIFY.** Source-level assertion — add to an existing test file that already greps sources, e.g. `tests/sensitive-tsx-account-storage.test.ts` is the wrong home; instead create `tests/invoice-seller-identity.test.ts` and **add it to `package.json`'s test list**. Assert: `app/invoice/page.tsx` contains no occurrence of `Tugela`, and `lib/db/types.ts` contains `farm_location`. Additionally assert that the PDF and screen render paths both reference `farm_location`.

**Do NOT change while in this file.** The footer URL (`fieldproof.vercel.app` — it is app-wide branding, out of scope and appears in 15+ files), `sellerName`'s `'Your name'` fallback, or any invoice figure.

---

### Q14 — Deleting an invoice is one unguarded tap next to the Paid toggle

**File:** `app/invoice/page.tsx` lines 324–336.

**What is wrong.** The delete control calls `deleteInvoice(inv.id)` directly from `onClick` with no confirmation, no undo, no tombstone. It is a ~23 px target at 50% opacity, 8 px (`gap-2`) from the Paid/Unpaid pill — the control the farmer taps most on that row. `lib/invoices.ts:264-272` filters and writes with no recoverable copy, and invoices have no cloud mirror. The same app requires a two-tap arm-then-confirm ("Sure?", 3.5 s window) to delete a *sale* — `app/finances/page.tsx:204-217`, `:313` — which is Firestore-backed.

**Failure.** A mis-tap while marking #0051 paid destroys #0047 (R3 200, unpaid, being chased) instantly and irrecoverably. If the deleted invoice was paid, the month's Income card and CSV export silently drop by its total.

**Fix.** Reuse the existing pattern from `SalesLedger` verbatim:
1. Add `const [pendingDelete, setPendingDelete] = useState<string | null>(null);` and a `pendingTimer` ref.
2. First tap arms: `setPendingDelete(inv.id)` and a 3500 ms timeout clearing it. Second tap on the same id performs `deleteInvoice(inv.id)`.
3. While armed, render the label `Sure?` in place of the X icon, matching `app/finances/page.tsx:313`.
4. Increase the button's `padding` so the touch target is at least 44 px, and move it to the end of the row separated from the Paid pill by at least `gap-4`.

**HOW TO VERIFY.** Not unit-testable without a DOM harness. Reason through: confirm `deleteInvoice` is called only from the branch where `pendingDelete === inv.id`, and that the timeout is cleared on unmount and on a successful delete. Additionally add a source assertion to the new `tests/invoice-seller-identity.test.ts` (rename it `tests/invoice-page-guards.test.ts` if you take both) that `app/invoice/page.tsx` does not contain `onClick={() => deleteInvoice(`.

**Do NOT change while in this file.** `lib/invoices.ts` `deleteInvoice`, the Paid/Unpaid toggle behaviour, or the payment-method chips.

---

### Q15 — Clearing a crop price field persists R0 and erases that crop's income

**Files:** `app/facilitator/crops/page.tsx` lines 1603–1608, 1613–1618, 468–474; `lib/crop-prices.ts` lines 104–114 (`saveCropPriceOverrides`), 90–102 (`loadCropPriceOverrides`).

**What is wrong.** Both price inputs coerce with `Number(e.target.value) || 0` and write through to `saveCropPriceOverrides` on every keystroke with no validation. `priceFor` (`lib/crop-prices.ts:117-120`) uses `??`, which only falls back on `null`/`undefined`, so a stored `0` permanently shadows the researched default. `lib/crop-plan.ts:694` guards with `if (price)` — object truthiness, not value — so `kgPerMonth * 0` is contributed for every month. There is no `min` attribute, so `-5` persists too. There is no reset-to-default control anywhere on the page, so the researched value is unreachable once overwritten.

**Failure.** Farmer clears the tomatoes retail field intending to retype, is interrupted, collapses the panel (it is closed by default, line 1361). `{tomatoes: {retailPerKg: 0}}` is in localStorage forever. Every tomato month contributes R0 to the Retail chart and to "Estimated for the year". The money-mode chart has no per-crop tooltip, so nothing shows which crop went to zero.

**Fix.**
1. Add `min="0"` to both inputs.
2. In `updatePriceOverride` (468–474), validate before persisting: if the incoming `retailPerKg`/`wholesalePerKg` is not finite or is `<= 0`, **delete that crop's key** from the overrides object rather than storing the bad value — restoring the researched default.
3. In `loadCropPriceOverrides` (`lib/crop-prices.ts:90-102`), drop any entry whose `retailPerKg` or `wholesalePerKg` is not a finite number `> 0`, so an already-corrupted store self-heals on next load.
4. Add a per-crop reset control in the editor (1592–1624): a `↺` button that deletes that crop's override key. Label it `Reset to researched price`.

**HOW TO VERIFY.** New test file `tests/crop-prices.test.ts` — **add it to `package.json`'s test list**. Assert: `loadCropPriceOverrides` returns an object with no `tomatoes` key when the stored JSON contains `{"tomatoes":{"retailPerKg":0,"wholesalePerKg":14}}`; that `priceFor('tomatoes', {})` therefore returns the researched default; and that a negative value is likewise dropped.

**Do NOT change while in this file.** `DEFAULT_CROP_PRICES` values, `UNPRICED_CROPS`, the caption text at 1436–1451 (that is Q16), or `confidence` semantics.

---

### Q16 — The price caption credits researched figures when the farmer's own edits are in force

**File:** `app/facilitator/crops/page.tsx` lines 1436–1451; `lib/crop-prices.ts` lines 32–40 (`CropPrice` shape), 104–114.

**What is wrong.** The caption renders unconditionally: `using researched South African {mode} prices (2026-07-14) — a one-time researched snapshot, not a live market feed`. It renders for exactly the retail/wholesale modes where an override may be in force, and nothing reads `priceOverrides` to soften it. Overrides carry no timestamp (the `CropPrice` shape has no date field), and the `confidence` field the editor writes (`'estimated'`, lines 1606/1616) is never read for display anywhere in the app.

**Failure.** August 2026 the farmer corrects tomatoes to R40 and cabbage to R11 from her local market. The paragraph directly above the chart continues to credit those numbers to a dated research snapshot — immediately, not only after ageing. Two seasons later she plans off her own stale figures believing they are the app's researched ones, with no indication which crops are hers.

**Fix.**
1. Add an optional `updatedAt?: string` (ISO) to the `CropPrice` type in `lib/crop-prices.ts`, and set it in `updatePriceOverride` when an override is written.
2. Make the caption conditional. When `Object.keys(priceOverrides).length > 0`, render: `Using your own prices for {n} crop(s); researched South African {mode} prices (2026-07-14) for the rest — a one-time researched snapshot, not a live market feed.` Otherwise render the existing text unchanged. Do not alter the date string.
3. In the price editor rows (1592–1624), render a small badge on any crop with an override: `your price` plus the formatted `updatedAt` date when present.

**HOW TO VERIFY.** Extend `tests/crop-prices.test.ts` (created in Q15): assert `saveCropPriceOverrides` round-trips an `updatedAt` field, and that `loadCropPriceOverrides` preserves it. Plus a source assertion that `app/facilitator/crops/page.tsx` no longer renders the `researched South African` string unconditionally — i.e. the string appears inside a conditional branch keyed on `priceOverrides`.

**Do NOT change while in this file.** Any price value, the `2026-07-14` date string, or the loss/sell slider defaults (section 3).

---

### Q17 — The crop-plan money headline includes crops that were already growing

**File:** `app/facilitator/crops/page.tsx` line 675 (the `buildFoodValueByMonth` call), 1388–1393, 1483; `lib/crop-plan.ts` line 690.

**What is wrong.** The kg headline deliberately splits out `p.existing` plantings, and the code says why (654–659: "Already-growing crops are informational … the same way the design map's BOQ keeps existing features out of the budget"). The Rand figure is built from the **unfiltered** `plantings` list — `lib/crop-plan.ts:690` iterates every planting with no `existing` test. Meanwhile the cost side already excludes them: `lib/crop-plan.ts:499` has `if (p.existing) continue;` in `seedBoqForPlan`, guarded by `tests/crop-plan.test.ts:609`. So costs are plan-scoped and revenue is site-scoped, biased toward planting.

**Failure.** Farmer has 100 m² of existing cabbage marked `existing` and plans one new 20 m² chard bed. The kg tile correctly reads `60.0 kg/yr to plant` + `300.0 kg/yr already growing (not new)`. The money tab reads `R5 340 cash income` — R4 500 of it the cabbage that was already there. The plan she is deciding about adds R840. Worst in the ordinary onboarding case, where an established smallholding marks all current beds existing.

**Fix.**
1. Add an `existing` breakdown to `FoodValueMonth` in `lib/crop-plan.ts`: alongside `retailValue`/`wholesaleValue`, accumulate `existingRetailValue`/`existingWholesaleValue` for plantings where `p.existing` is true, and keep the current fields as the **new-planting** totals (so the headline becomes plan-scoped).
2. Update `app/facilitator/crops/page.tsx` to render, beneath the headline, an informational line mirroring the kg tile: `+ R{existing} already growing (not new)`.
3. Do not change the loss or sell factors.

**HOW TO VERIFY.** Extend `tests/crop-plan.test.ts` (already in the manifest), mirroring the existing seed-BOQ test at line 609: `'buildFoodValueByMonth splits existing plantings out of the new-planting value'` — build two plantings of the same crop, one `existing: true`, and assert the returned month's `retailValue` reflects only the non-existing planting while `existingRetailValue` reflects only the existing one, and that their sum equals the previous unfiltered figure.

**Do NOT change while in this file.** Yield values, prices, `lossFactor`/`sellFactor` defaults (section 3), or `seedBoqForPlan`'s existing behaviour.

---

### Q18 — Circular beds are yielded, valued and seeded off their bounding box

**File:** `lib/design-beds-bridge.ts` line 45.

**What is wrong.** `areaM2: round1(wM * hM)` for every bed regardless of shape. Two of the four accepted `BED_DEF_IDS` (line 18) — `keyhole_bed` and `herb_spiral` — are declared `shape: 'circle', wM: 2, hM: 2` in `lib/design-elements.ts:381-407`. The doc comment at 28–30 acknowledges the bounding-box choice but justifies consistency with legacy maths, not accuracy, and nothing in the UI discloses it. The app already knows the correct formula (`lib/price-book.ts:363-364`).

**Failure.** Default 2 m keyhole bed: `areaM2 = 4.0` where the circle is 3.14 m². Swiss chard at 3 kg/m² gives 12.0 kg instead of 9.42; at R14/kg the Retail tab shows R168 instead of R132; `seedBoqForPlan` orders 82 seeds where the bed holds ~64. A fixed 4/π ≈ 27% overstatement on yield, income and seed for every keyhole bed and herb spiral.

**Fix.** In `bedsFromDesignCanvas`, read the def's `shape` and compute `areaM2` as `Math.PI * (wM / 2) ** 2` when `shape === 'circle'`, else `wM * hM`. Round with the existing `round1`. Do not introduce a keyhole "planted fraction" constant — that would be inventing an agronomic figure (see section 3, D5).

**HOW TO VERIFY.** Extend `tests/design-substeps.test.ts` (already in the manifest, and already has a bed-area assertion at line 135 using rectangles): add `'a circular bed reports its circle area, not its bounding box'` asserting a `keyhole_bed` at `wM: 2, hM: 2` yields `areaM2 === 3.1` (i.e. `round1(Math.PI)`), and that a `raised_bed` at 2 × 4 still yields `8`.

**Do NOT change while in this file.** `BED_DEF_IDS`, `treesFromDesignCanvas`, or any element default dimension.

---

### Q19 — Unpriced crops contribute kilograms but no rand, silently

**Files:** `lib/crop-plan.ts` lines 700–708; `app/facilitator/crops/page.tsx` lines 1382, 1436–1452.

**What is wrong.** `byMonth[m].kg += kgPerMonth` is unconditional; the rand contribution is inside `if (price)` with no `else` and no counter. `UNPRICED_CROPS` (`lib/crop-prices.ts:86`) holds `coriander`, which `priceFor` returns `null` for. The price editor filters unpriced crops out entirely (`page.tsx:1382`), so the crop appears in no money surface at all, and the caption makes no exclusion statement. Money mode has no per-crop tooltip (unlike Kg mode), so there is no attribution surface either.

Coriander is a real, plantable catalog crop (`lib/crop-catalog.ts:570-590`) and auto-suggest can place it without the farmer choosing it (`lib/crop-autosuggest.ts:920`, `lib/crop-groups.ts:63`). The project already treats this class as a bug elsewhere: `tests/price-book.test.ts:82` — "unpriced must remain distinct from free".

**Failure.** 12 m² of coriander = 18 kg/yr. Kg mode shows and names it; Retail mode values it at R0 and rolls that into the year total. The farmer reads coriander as worthless.

**Fix.**
1. Add `unpricedKg: number` to `FoodValueMonth` in `lib/crop-plan.ts` and accumulate `kgPerMonth` into it in the `else` branch of `if (price)`.
2. In `app/facilitator/crops/page.tsx`, when the year's `unpricedKg` sum is `> 0`, render a footnote under the money chart naming the crops and their kg: `{names} ({n} kg/yr) are not sold by weight, so they are not counted in this Rand total.` Derive the crop names from the plantings whose `priceFor` returned null — do not hardcode "coriander".

**HOW TO VERIFY.** Extend `tests/crop-plan.test.ts`: `'kilograms of an unpriced crop are reported separately from the rand total'` — call `buildFoodValueByMonth` with a coriander planting and assert `kg > 0`, `retailValue === 0`, and `unpricedKg === kg` for the harvest months. Assert the invariant holds if `UNPRICED_CROPS` grows, by iterating `UNPRICED_CROPS` rather than naming coriander.

**Do NOT change while in this file.** `UNPRICED_CROPS` membership, any yield, or any price.

---

### Q20 — Money is formatted with `toLocaleString` on the two farmer-facing money screens

**Files:** `app/facilitator/crops/page.tsx` lines 1483, 1487, 1492; `app/invoice/page.tsx` line 191; `app/api/chat/route.ts` line 88.

**What is wrong.** The repo has a deterministic, locale-proofed `formatZar` (`lib/price-book.ts:465-472`) with a test that exists precisely for this — `tests/price-book.test.ts:85-90`, `assert.doesNotMatch(formatZar(1_000_000), /[,.]/, 'locale punctuation leaked into ZAR output')`. `lib/water-system.ts:369` documents the same hazard in prose. The BOQ obeys it; three money surfaces do not.

- `crops/page.tsx:1483` uses bare `.toLocaleString()` with **no locale argument** — the headline projected-income figure follows the device. On a point-grouping locale (de, pt, es, it, nl, tr, id) `R12 500` renders `R12.500`, which a South African reads as twelve rand fifty. On en-US it renders `R12,500`, where the comma is the ZA decimal mark.
- `invoice/page.tsx:191` uses `toLocaleString('en-ZA')` with no options: default `maximumFractionDigits: 3`, minimum 0. R87.50 prints `R87,5` on the PDF a buyer pays from; the trailing cent zero is structurally unreachable.
- `api/chat/route.ts:88` runs server-side, so the locale is the container's ICU default and is not correctable by the user — `contractValue` enters the model's context as authoritative fact.

**Fix.**
1. Lift `formatZar` into a new `lib/money.ts` (re-export it from `lib/price-book.ts` so existing imports keep working — do not change any call site that already uses it). Add a sibling `formatZarCents(n: number): string` that always renders exactly two decimals with a fixed `,` decimal separator and space thousands grouping, hand-rolled, never via `toLocaleString`.
2. `app/facilitator/crops/page.tsx` 1483/1487/1492: use `formatZar`.
3. `app/invoice/page.tsx:191`: replace `money` with `formatZarCents`.
4. `app/api/chat/route.ts:88`: use `formatZar`.

**HOW TO VERIFY.** Extend `tests/price-book.test.ts`: assert `formatZarCents(87.5) === 'R87,50'`, `formatZarCents(1234.5) === 'R1 234,50'`, `formatZarCents(0) === 'R0,00'`, and `assert.doesNotMatch(formatZarCents(1_000_000), /\./)`. Add a source assertion (new test in the same file or `tests/facilitator-design.test.ts`) that `app/invoice/page.tsx`, `app/facilitator/crops/page.tsx` and `app/api/chat/route.ts` contain no `toLocaleString` applied to a money value.

**Do NOT change while in this file.** `fmtZAR` in `app/finances/page.tsx` (its on-screen rounding is intentional for stat tiles; only the CSV path changes, in Q10), or `formatZar`'s existing output format.

---

### Q21 — Offline/failed reads render as R0 with no error, and then offer to seed fake money into the real books

**Files:** `app/finances/page.tsx` lines 892–909 (`loadData`), 945 (`hasAnyData`), 1045–1057 (sample button), 814–856 (`loadSampleData`); `lib/firebase/init.ts` line 80.

**What is wrong.** Firestore is initialised with no persistent cache — a repo-wide grep for `persistentLocalCache`/`enableIndexedDbPersistence`/`localCache` returns zero hits — so the memory cache is empty on every load. `getDocs` with default source **fulfils** with an empty snapshot when offline rather than rejecting, so `Promise.allSettled` sees success and the `console.error` at 903 never even fires. The three cards render `R 0` / `R 0` / `0.0 kg` and "No sales logged yet", identical to a genuinely empty ledger. `hasAnyData` is then false, so the screen offers "Load sample data", whose `loadSampleData` calls the **real** `addSale`/`addExpense`/`saveInvoice` — 6 fake sales, 5 fake expenses, 2 invoices into the live account. Separately, `handleSubmit` (433) awaits `addSale`, which resolves only on server ack, so logging a sale offline hangs on "Saving..." forever with no timeout.

**Failure.** Farmer at the homestead with no signal opens Finances before a market run. R0 income is presented as fact; her real R6 400 is intact in Firestore and unreachable. She may then tap the sample button and permanently mix labelled-but-summed fake rows into her books.

**Fix.**
1. `lib/firebase/init.ts:80` — enable persistence: `initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`, keeping the existing `catch` fallback to `getFirestore(app)`.
2. `app/finances/page.tsx` — add a `loadFailed` state. In `loadData`, set it true if **any** settled result is `rejected`, **and** additionally track `navigator.onLine === false` at fetch time. When either is true, render a banner in place of the zeros: `Couldn't load your records — you may be offline. These figures are not your books.`
3. Gate the sample-data button on a clean, online load: change the condition at 1045 to `{!dataLoading && !hasAnyData && !loadFailed && navigator.onLine && (...)}`.
4. Add a confirmation to `handleLoadSampleData` before it writes, with the literal text: `This adds example rows to your real records. You will have to delete them one by one. Continue?`
5. Add a 15-second timeout around the `await addSale`/`addExpense` in `handleSubmit`: on timeout, stop the "Saving..." state and show `Still saving — you may be offline. Your entry will sync when you have signal.`

**HOW TO VERIFY.** Not unit-testable without a Firestore harness. Reason through and document in the commit message: confirm (a) `persistentLocalCache` is imported from `firebase/firestore` and the `catch` fallback still compiles, (b) the sample button's condition includes `!loadFailed`, (c) `handleLoadSampleData`'s first statement is the confirm gate. Add a source assertion to a new or existing grep-style test that `app/finances/page.tsx` does not render the sample-data button without a `loadFailed` guard in its condition.

**Do NOT change while in this file.** `loadSampleData`'s seeded amounts, the `Sample — ` prefixes, `buildLedgerRows`, or `fmtZAR`.

---

### Q22 — Firestore rules let any signup read every farmer's financial records

**File:** `firestore.rules` lines 14, 43–45, 84, 93, 103, 17; `app/login/page.tsx` lines 12–18.

**What is wrong.** `allow read` on `production_logs`, `sales_logs` and `expense_logs` includes a bare `isMentor()`, and `isMentor()` is `myRole() == 'mentor'` — it never inspects `resource.data`, so it authorises an unfiltered collection `list`. `/profiles/{uid}` `create` (43–45) permits self-assigning `role: 'mentor'`, and `app/login/page.tsx:12-18` puts "Mentor (trainer / field supervisor)" in the **public signup dropdown**. So anyone who signs up and picks Mentor can `getDocs(collection(db,'sales_logs'))` and read every farmer's crop, kilograms and rand amounts, across every org — plus `/profiles` (line 40) to attach names and phones.

Secondary: `sameOrg(d)` (line 17) is `isStaff() && d.org_id == myOrg()` with no null guard, while the neighbouring `inMyOrg()` (19–20) has one and the file itself documents why ("null == null would otherwise be true").

`tests/firestore-rules.test.ts:98-109` already asserts the opposite of the shipped behaviour, and it runs only under `test:rules`, which no CI workflow invokes (`.github/workflows/test.yml:47` runs `npm test` only).

**Fix.**
1. Remove the bare `isMentor()` disjunct from the `allow read` on all three log collections (84, 93, 103). Replace it with the learner-enrollment-scoped check the test models — a mentor may read a farmer's logs only where an enrollment or garden-membership link exists between them. Model it on the existing scoped patterns in the same file; do not invent a broader grant.
2. Give `sameOrg(d)` the same null guard `inMyOrg()` has: `return isStaff() && myOrg() != null && d.org_id == myOrg();`
3. Remove `'mentor'`, `'ngo'` and `'funder'` from the self-assignable role list at line 44, leaving `['farmer','student']`. Elevated roles must come from an Admin-SDK path.
4. Remove the corresponding elevated options from `SIGNUP_ROLES` in `app/login/page.tsx:12-18` so the UI matches the rules.
5. Add `npm run test:rules` as a step in `.github/workflows/test.yml` after the `npm test` step, with the Firestore emulator.

**HOW TO VERIFY.** `tests/firestore-rules.test.ts` already contains the target assertion at 98–109 — make it pass. Additionally **fix its first assertion at 100–102**, which currently proves nothing (it writes to `profiles/new-self-assigned-mentor` while authed as a different uid, so `uid == request.auth.uid` fails regardless of role): rewrite it to authenticate as uid `X` and attempt `setDoc(doc('profiles', X), { role: 'mentor', ... })`, asserting `assertFails`. Do **not** move this file into `npm test` — it stays in `EXTERNAL_TEST_FILES` (`tests/test-manifest.test.ts:8`); wire it into CI via the `test:rules` script instead.

**Do NOT change while in this file.** The `update`/`delete` owner-only rules on those collections (that is Q23), the profiles role/org_id immutability block at 49–51, or any collection not named above. **Do not deploy the rules** — code change only.

---

### Q23 — Financial log `update` rules never pin `profile_id` or `org_id`

**File:** `firestore.rules` lines 89, 99, 108.

**What is wrong.** `allow update, delete: if owns(resource.data);` checks the **pre-update** document only. `owns(d)` is `signedIn() && d.profile_id == request.auth.uid`. Nothing constrains `request.resource.data.profile_id` or `org_id`, and the create-time validation (`kg > 0`, `amount >= 0`, non-empty `crop`/`item`) is not re-applied on update. The same file pins exactly these fields elsewhere — `/profiles` at 49–51, `/course_enrollments` at 152–156 with the explicit comment about never re-pointing at a different learner, `/board_posts` `owner_id` at 252–253. The three money collections are the outliers. `lib/db/queries.ts:141-145` and `:246-250` send unconstrained patches.

**Failure.** A user creates their own sale, then issues `updateDoc(doc(db,'sales_logs', myId), { profile_id: '<victim uid>', amount: 90000 })`. The victim's `/finances` query (`where('profile_id','==',uid)`) picks it up: their Income, Net profit and CSV export all include R90 000 they never earned. The same move with a large `expense_logs` row makes a rival's books look unprofitable. Because `amount` is not re-validated, `-90000` also persists and subtracts from income.

**Fix.** On each of `production_logs`, `sales_logs` and `expense_logs`, split the rule:
```
allow update: if owns(resource.data)
  && request.resource.data.profile_id == resource.data.profile_id
  && request.resource.data.org_id == resource.data.org_id
  && <the same field type/range predicates used on that collection's create rule>;
allow delete: if owns(resource.data);
```
Copy the create-time predicates verbatim from each collection's own `allow create` — do not invent new ranges.

**HOW TO VERIFY.** Extend `tests/firestore-rules.test.ts` with `'a farmer cannot re-point their own log at another uid'`: as farmer A, create a `sales_logs` doc, then `assertFails` an `updateDoc` setting `profile_id` to farmer B's uid; and `'a farmer cannot update a log to a negative amount'`, `assertFails` on `{ amount: -100 }`. This file stays in `EXTERNAL_TEST_FILES`.

**Do NOT change while in this file.** The `read` rules (that is Q22), any other collection, or the `delete` semantics. **Do not deploy.**

---

### Q24 — Guest-namespace invoices are stranded on sign-in and numbering restarts at 44

**Files:** `app/invoice/page.tsx` lines 29–31, 46–48; `app/finances/page.tsx` line 972; `lib/invoices.ts` lines 311–322.

**What is wrong.** `/invoice` has no sign-in guard. `app/finances/page.tsx:972` puts the "Invoice" link in the **header**, outside the `!user && !isSampleMode() ? <SignInPrompt />` conditional that wraps only `<main>` — so a signed-out farmer sees a sign-in prompt in the body and a working Invoice button above it. While signed out, `activeAccountLocalStorageKey` returns `<key>::imbewu-owner::guest`, and nothing migrates that namespace into an account on sign-in (`removeSignedInLegacyLocalStorageKey` handles only bare legacy keys and is called only from `lib/i18n.tsx:8498` and `components/PopiaConsent.tsx:112`).

**Failure.** A farmer tries the app before signing up, issues #0044–#0047 to real buyers (printed and WhatsApped). She then signs up: the Saved list is empty and the next invoice is #0044 again. Two buyers hold different documents both numbered #0044. Nothing detects the collision — `cleanInvoices` dedupes on `id`, never on `no`.

**Fix.** Two independent changes, both required, in one commit:
1. **Guard the route.** In `app/invoice/page.tsx`, when `!user && !isSampleMode()`, render the same `<SignInPrompt />` component `/finances` uses instead of the invoice UI. Also move the Invoice link at `app/finances/page.tsx:972` inside the signed-in branch so it is not offered when signed out.
2. **Seed the sequence defensively.** In `app/invoice/page.tsx` at 46–48, seed `seq`/`currentNo` from `Math.max(loadNextInvoiceNumber(), ...loadInvoices().map(i => i.no + 1))` so a loaded ledger can never be numbered over, even if the stored sequence is lost.

**HOW TO VERIFY.** Add to `tests/invoices.test.ts`: `'the next number never collides with an invoice already in the ledger'` — write invoices numbered 44–47 into storage, clear the sequence key, and assert the computed next number is 48, not 44. (Expose the max-based computation as a small exported helper in `lib/invoices.ts` — e.g. `export function nextInvoiceNumber(invoices: SavedInvoice[]): number` — so it is unit-testable.)

**Do NOT change while in this file.** `activeAccountLocalStorageKey`'s scoping logic, the `guest` owner constant, or any attempt to auto-adopt guest data into an account (silent ownership transfer is out of scope — see section 3, D8).

---

### Q25 — Demo finance data is written to unscoped keys and fed to the AI as the farmer's own income

**Files:** `lib/demo-data.ts` lines 16–18; `components/ChatPanel.tsx` lines 92–110; `app/api/chat/route.ts` lines 77–88.

**What is wrong.** `PKEY`/`SKEY`/`JKEY` are **bare** localStorage keys — the only financial store in the app that does not go through `activeAccountLocalStorageKey()`. `lib/account-local-storage.ts:53-64` exists precisely so signed-out sessions cannot read bare rows, and `tests/sensitive-tsx-account-storage.test.ts:21-71` enforces scoping via a hand-maintained 7-file list that omits `lib/demo-data.ts`. `signOutUser` (`lib/auth.tsx:271-277`) clears no localStorage, so the keys survive an account switch. `ChatPanel.tsx:96` merges these rows with the real signed-in farmer's Firestore production and ships the blob with no sample marker; `app/api/chat/route.ts:81` renders it under `--- THIS FARMER'S SALES / INCOME ---` and the system prompt says "Use real rand figures from their sales."

**Failure.** On a training-centre or family tablet, farmer A taps "Load sample farm data". Farmer B signs in later and asks "how much did I make this season?" — the assistant answers, in her language, `Total income: R7 920 — spinach 90 kg for R1 800, tomatoes 65 kg for R1 950…`, and reports an R18 000 funder contract with R6 000 outstanding. None of it is hers. Real production is blended with fake (`[...production, ...localProd]`).

**Fix.**
1. Route all three keys in `lib/demo-data.ts` through `activeAccountLocalStorageKey()`, exactly as every other store does.
2. Tag the rows: add a `sample: true` marker to the demo sales/production/project objects.
3. In `components/ChatPanel.tsx`, carry that marker into the context object rather than merging silently — keep sample rows in a separate field.
4. In `app/api/chat/route.ts`, emit sample rows under a distinct heading `--- SAMPLE DATA (NOT THIS FARMER'S RECORDS) ---` with an appended instruction: `Never present the figures in the SAMPLE DATA block as this farmer's own records.` Leave the real-data headings untouched.
5. Add `lib/demo-data.ts` to the file list in `tests/sensitive-tsx-account-storage.test.ts`.

**HOW TO VERIFY.** Extend `tests/demo-data.test.ts` (already in the manifest): `'demo keys are account-scoped'` — assert the keys written contain the `::imbewu-owner::` separator, and that switching the harness uid isolates the stores. Plus the scoping test in `tests/sensitive-tsx-account-storage.test.ts` now covering `lib/demo-data.ts` must pass.

**Do NOT change while in this file.** Any `SAMPLE_SALES`/`SAMPLE_PRODUCTION`/`SAMPLE_PROJECT` figure, or the button's placement in `ChatPanel.tsx`.

---

### Q26 — Reusing the still-open invoice form overwrites the previous invoice and inherits its payment evidence

**File:** `app/invoice/page.tsx` lines 83, 91–92, 94, 99.

**What is wrong.** After Print/Share, `currentId` stays set (99) and the form still holds the last invoice. Nothing resets it — `newInvoice()` (173–180) fires only from the explicit button. `persist()` then reuses `currentId` and `currentNo`, so `saveInvoice` replaces the earlier record (`lib/invoices.ts:255`, filter-and-prepend, no versioning), and `status: existing?.status ?? 'unpaid'` / `paidAt: existing?.paidAt` (91–92) carry the previous buyer's payment evidence onto a different buyer.

**Failure.** Farmer prints #0044 for Spar (R4 200), marks it Paid cash. Ten minutes later at the same market she overwrites the buyer name with "Nquthu Fresh" and the lines with R1 800 and prints again without pressing New invoice. Both buyers hold paper numbered #0044. The app holds one record: Nquthu Fresh, R1 800, **paid**. The R4 200 actually collected is gone from the ledger; R1 800 never collected shows as paid income (`app/finances/page.tsx:82`, `:673-674`).

**Fix.**
1. After a successful `persist()` inside `printInvoice` and `shareInvoice`, call `newInvoice()` to reset to a fresh document. (Order: persist → produce the PDF/print → reset.)
2. Independently, never inherit payment evidence across a buyer change: in `persist()`, only apply `status: existing?.status` and `paidAt: existing?.paidAt` when `existing.billTo === billTo.trim()`; otherwise write `status: 'unpaid'` and omit `paidAt`.

**HOW TO VERIFY.** Add to `tests/invoices.test.ts`: `'saving over an id with a different buyer does not carry payment evidence'` — save a paid invoice for buyer A with a `paidAt`, then `saveInvoice` the same `id` with `billTo: 'B'`, `status: 'unpaid'`, no `paidAt`; assert the stored record has `status === 'unpaid'` and no `paidAt`. Note this requires the caller-side guard, since `lib/invoices.ts:246-252` deliberately preserves evidence — do **not** weaken that library behaviour; the page must stop asking for it.

**Do NOT change while in this file.** `lib/invoices.ts`'s `paidAt`/`paymentMethod` preservation block (it is correct for genuine edits and is tested at `tests/invoices.test.ts:181`), or the "Editing #0044" label.

---

### Q27 — Paid invoices and logged sales are added together with no dedupe, and the app pushes the farmer to enter both

**Files:** `app/finances/page.tsx` lines 82–84, 662–675, 696–698, 770; `components/HarvestReconciliation.tsx` lines 41–46; `lib/harvest-reconciliation.ts` lines 332–339.

**What is wrong.** Revenue = SalesLog rows + paid invoice totals with no matching key, no dedupe and no warning. The data model cannot express the link: `SavedInvoice` (`lib/invoices.ts:17-27`) has no sale reference and `SalesLog` (`lib/db/types.ts:40-43`) has no invoice field. Worse, `HarvestReconciliation` is passed only `{production, sales}` — invoices are never passed — so an invoice-only sale makes the panel report "Harvested 40 kg, only 0 kg sold — 40 kg unaccounted for". The app therefore actively pushes the farmer to log the sale, and logging it is exactly what doubles the rand figure. The empty-state copy at 770 frames both routes as interchangeable with no caution.

**Failure.** 40 kg spinach to Spar for R1 200. Invoice #0051 marked Paid, then "Money in" logged to clear the reconciliation flag. Income reads R2 400, Net profit R1 200 too high, and both rows go into the CSV handed to an accountant.

**Fix.** Do **not** auto-create or auto-suppress rows (that changes what is recorded — section 3, D9). Ship the detection and the warning only:
1. Add a duplicate-suspicion pass in `buildLedgerRows`: flag any pair of one paid invoice and one sale where the amounts are equal and the dates are within 3 days. Do not merge them; mark both rows.
2. Render the flag inline on both rows: `Possibly the same sale — a paid invoice is already counted as income.`
3. Add a one-line footer under the ledger: `A paid invoice already counts as income. Do not also log it as a sale.`
4. Add the same sentence to `app/finances/page.tsx:770`'s empty-state copy.

**HOW TO VERIFY.** New test in the file created for Q10, `tests/finances-export.test.ts` (or extract the pass into `lib/harvest-reconciliation.ts` and test there). Extract the detection as an exported pure function — `export function flagLikelyDuplicates(rows: LedgerRow[]): LedgerRow[]` — and assert: a paid invoice of R1 200 dated 2026-08-02 and a sale of R1 200 dated 2026-08-03 both come back flagged; the same pair 10 days apart does not; a sale of R1 100 against an invoice of R1 200 does not.

**Do NOT change while in this file.** The income arithmetic itself (both rows must still be counted — suppressing one is a business decision), `addSale`, or the harvest-reconciliation thresholds.

---

## 3. RORY MUST DECIDE

Codex must not start any of these.

- **D1 — Lined vs unlined water body.** `pond_per_m2` ("Liner + excavation") and `waterbody_per_m2` ("unlined … lining adds cost") are both R180/m² (`lib/price-book.ts:229-234`, `:109-114`); one is wrong — either raise the lined rate to excavation + liner + geotextile, lower the unlined one, or collapse both to one element with a lined/unlined toggle.
- **D2 — Two water tools with reversed names.** `pond` is labelled "Pond / dam" and `waterbody` "Dam / pond" (`FacilitatorCanvas.tsx:60`, `:106`) at identical prices — decide whether to rename, merge, or keep both with distinct rates.
- **D3 — `swalew` per-m² vs `swale_per_m` per-metre.** The same physical earthwork is priced R60/m² as an element and R60/m as a line (`lib/price-book.ts:116-126`) — decide whether a berm genuinely costs more than a bare swale (and by how much, sourced) or whether `swalew` should resolve to the per-metre rate.
- **D4 — Tank sizes the picker offers but the book cannot price.** 750 L and 1 000 L snap to the R5 500 2 500 L rate and anything above 10 000 L snaps down to R13 000 (`lib/price-book.ts:261-284`, `FacilitatorCanvas.tsx:122`) — decide whether to add `tank_750`/`tank_1000` and an above-10 000 L rule (round up × multiples?), or remove the unpriceable options from the picker.
- **D5 — Keyhole bed planted fraction.** A keyhole bed's access wedge means planted ground is below even its circle area — decide whether to apply a documented planted-fraction constant (and what value), or leave it at full circle area after Q18.
- **D6 — Pond volume assumption.** `POND_ASSUMED_DEPTH_M = 1.5` invents ~42 kL from a 6 m circle and feeds the "Water store" tile and the coach's ✓ against its own 10 kL benchmark (`FacilitatorCanvas.tsx:2229`, `:2243`, `lib/facilitator-design.ts:190-193`) — decide whether pond volume should count toward storage at all, count at a different depth, or be shown separately from real tank capacity.
- **D7 — Cashflow defaults.** `DEFAULT_CASHFLOW_SETTINGS = { sellPercent: 100, lossPercent: 0 }` (`lib/crop-plan.ts:761`) is the most optimistic possible starting point for the headline income figure — decide whether to ship non-optimistic defaults and at what values.
- **D8 — Guest-to-account invoice adoption.** Should signing in offer a one-time explicit merge of a non-empty guest invoice ledger into the account, or should `/invoice` simply require sign-in (Q24 ships the guard; the merge is the open question)?
- **D9 — Invoice/sale double entry.** Should marking an invoice Paid auto-create the matching SalesLog row (and add kg to invoice lines so harvest reconciliation stops flagging it), or should the two remain separate with only the warning Q27 ships?
- **D10 — Crop cost side.** The crop screen shows gross "cash income" with no input costs deducted while computing a full seed BOQ with no rand (`app/facilitator/crops/page.tsx:1483`, `lib/crop-plan.ts:496-519`) — decide whether to price the seed BOQ from the price book and show a net line, or relabel the figure "before input costs".
- **D11 — 33 unreviewed catalog yields.** The known-unreviewed fields still multiply into income; decide whether to add a machine-readable `yieldConfidence` and surface it, and who signs off the outstanding figures.
- **D12 — VAT.** Whether the invoice tool should gain any VAT capability at all is a regulatory call, not a code one; the current no-VAT document is arguably correct for a below-threshold fresh-produce seller.
- **D13 — Invoice cloud sync.** The entire accounts-receivable book is device-local with no backup and no export of unpaid invoices (`lib/invoices.ts:37-64`, absent from `lib/user-sync.ts`) — decide whether to mirror invoices into Firestore under `user_map_data/{uid}` with a server-side monotonic number, or ship an explicit "invoices are stored on this device only" warning plus a full export.

---

## 4. FILE PARTITION

Disjoint groups; each can be taken by a separate Codex run without collision.

**Group A — Print pack BOQ** (`app/facilitator/print/page.tsx`, plus a new exported predicate in `lib/price-book.ts` for Q3): **Q1, Q2, Q3**. Take in order; all three touch the same tally/cost block.

**Group B — Price book maths** (`lib/price-book.ts` costing logic, `components/FacilitatorCanvas.tsx:2314` call site, new `lib/money.ts`): **Q4, Q20**. Q4 adds the `opts` parameter; Q20 lifts `formatZar`. Must not run concurrently with Group A (both touch `lib/price-book.ts`) — sequence A then B, or B then A.

**Group C — Facilitator canvas surfacing** (`components/FacilitatorCanvas.tsx` lines 2474/2509–2513 and 3603–3610, plus a helper in `lib/facilitator-design.ts`): **Q11, Q12**.

**Group D — Invoice page** (`app/invoice/page.tsx`, `lib/invoices.ts`, `lib/db/types.ts`, `app/account/page.tsx`): **Q6, Q7, Q8, Q9, Q13, Q14, Q24, Q26**. One run, sequential commits — these overlap heavily in `persist()` and the saved-list row. Suggested order: Q6 → Q8 → Q7 → Q9 → Q26 → Q24 → Q13 → Q14.

**Group E — Finances screen** (`app/finances/page.tsx`, `lib/harvest-reconciliation.ts`, `lib/firebase/init.ts`): **Q5, Q10, Q21, Q27**. Order: Q5 (exports the shared season helpers) → Q10 → Q27 → Q21.

**Group F — Crop plan and prices** (`app/facilitator/crops/page.tsx`, `lib/crop-prices.ts`, `lib/crop-plan.ts`, `lib/design-beds-bridge.ts`): **Q15, Q16, Q17, Q18, Q19**. Order: Q15 → Q16 (same editor block) → Q17 → Q19 (both touch `buildFoodValueByMonth`) → Q18 (independent file). Note Q20 also edits `app/facilitator/crops/page.tsx:1483` — sequence Group F and Group B, do not run them concurrently.

**Group G — Security rules** (`firestore.rules`, `app/login/page.tsx`, `tests/firestore-rules.test.ts`, `.github/workflows/test.yml`): **Q22, Q23**.

**Group H — Demo data isolation** (`lib/demo-data.ts`, `components/ChatPanel.tsx`, `app/api/chat/route.ts`, `tests/sensitive-tsx-account-storage.test.ts`): **Q25**. Note Q20 also edits `app/api/chat/route.ts:88` — sequence H and B.