# Codex work queue — ImbewuField

Read `AGENTS.md` first. It carries the verification commands, the ownership split, the guardrails
and — most importantly — **§5 LOOK AT WHAT YOU MADE**.

The previous run's queue is archived at `docs/CODEX-QUEUE-ARCHIVE-2026-07-29.md`. Do not work from
it: it carries a retired `PLAN_VERSION` instruction that now causes harm. See the correction below.

---

## ⚠ OPERATING MODE FROM 2026-08-05: CLAUDE IS OFFLINE UNTIL SATURDAY

Rory is out of Claude usage until **Saturday 8 August 2026**. Every previous version of this file
said *"Claude reviews and merges behind you"*. **That is now false and you must not wait for it.**

**You own the whole loop until Saturday.** For each item:

1. Branch, build it, verify it — `npx tsc --noEmit`, then `npm test`, then **look at the output**.
2. Push the branch.
3. Read the CI result on that push. If `test.yml` is green, **merge it to `main` yourself.**
4. Append one line to the ledger, issue #35: what merged, and what Rory should look at.
5. Take the next item immediately.

This is a deliberate, temporary widening of your authority, granted because the alternative is a
queue of finished branches that nobody merges for three days. The guardrails in `AGENTS.md` §4 are
**not** widened — every one still binds, and several bind harder now that nobody reviews behind you.

### CORRECTION: never touch `PLAN_VERSION`

The archived queue says to **bump `PLAN_VERSION` in the same commit as any sheet-drawing change**.
**That instruction is retired and following it now causes harm.** `AGENTS.md` §1b is current and it
is the opposite: *leave `PLAN_VERSION` exactly as you found it, on any branch, ever.*

Why it changed: a bump re-keys the sheet gallery, so an AI sheet a farmer has already **paid for**
stops being found. It also collided eight times in two days when parallel branches each picked "the
next number" from a stale copy. Exactly one writer owns that counter and it is not you.

If your change alters what a sheet looks like, **say so in the ledger** — "this changes the picture"
— and leave the number alone. Rory assigns it once, on Saturday.

### What you still may not do, even with merge authority

- **Do not spend money on paid AI renders.** Gemini/Imagen sheet renders cost real money per image
  and Rory is not here to authorise it. Items marked **[NO PAID RENDER]** get the deterministic and
  code-level work only, verified against cached or local output.
- **Do not deploy Firestore or Storage rules.** `firestore.rules` and `storage.rules` are read-only
  to agents. Propose a diff in the ledger; do not `firebase deploy`.
- **Never `git add -A` or `git add .`** — always explicit paths. Other work shares this checkout.
- **Never commit** secrets, `.env*`, `serviceAccount.json`, CareLink/medical data, logs, `.venv/`.
- **Invent no number that reads as an agronomic or financial recommendation.** If a figure is not
  measured or sourced, the honest output says it is unknown. This app's outputs are instructions
  real smallholders spend money against.
- **The release-notes gate is blocking and it is easy to trip.** `test.yml` runs
  `npm run notes:pending`, which FAILS when commits touching `app/`, `components/` or `lib/` carry
  no farmer-facing note. It was red on **every** push on 5 August for exactly this reason. Add an
  entry to `lib/release-notes.ts` stamped with your newest sha, in the farmer's language,
  **≤ 90 characters per line** — enforced by `tests/canvas-labels.test.ts`, and a first draft
  usually breaches it.
- **Push each branch once, when it is finished.** Vercel allows 100 deployments/24h across the whole
  account; an overnight run has already exhausted it and frozen production twice.

### Verification is not `npm test`

A green suite means nothing broke that was already guarded. It does not mean what you built is
right. Every serious defect in this repo's history was **visible in the output and invisible in a
green suite** — the report describing a dam the farm does not have; the harvest optimiser that
measured as a no-op after three iterations; the beds billed twice in the bill of quantities on
5 August, which 23 brand-new tests all passed straight through and which was caught by printing the
document and reading it.

So for each item: render it, print it, screenshot it, or run a probe — and read what came out.
`tests/report-document-probe.ts` and `tests/harvest-continuity-probe.ts` are the pattern. Write one
if the item has none.

---

## Priority 1 — the app tells the farmer something untrue

Ordered by how badly the app misleads. Do these first.

### Q1. `/finances` shows harvest data it gives you no way to enter — `codex/finances-harvest-entry`

`app/finances/page.tsx:112` displays "Kg harvested" and mounts the whole harvest-reconciliation
panel (lines ~1066, ~1096). The page contains **no form and no link** that can create a
`ProductionLog`.

`addProduction()` (`lib/db/queries.ts:129`) has exactly one caller — `components/MyRecords.tsx:229`
— mounted only on the `'Farm'` tab of `components/DataPanel.tsx:1753`, which is filtered out of the
visible strip by `VISIBLE_TABS` at `DataPanel.tsx:75`. It is reachable only via the
`/farmer?panel=Farm` deep link from one home-screen quick action. `components/TabBar.tsx` has no
route to it at all.

Fix the reachability, not the display. A farmer looking at "0 kg harvested" must be one tap from
logging a harvest.

### Q2. The sales list on that same screen is permanently empty — `codex/myrecords-sales-dead`

`components/MyRecords.tsx:624` declares `const [sales, setSales] = useState<SalesLog[]>([])`.
`setSales` is called **once**, at line 670, with `[]`. `mySales()` is exported at
`lib/db/queries.ts:231` and never called here. The comment at line 774 claims an optimistic append
that does not exist. The "Sales summary" card (line 781) and "Recent sales" list (line 819) stay
empty **even immediately after the farmer logs a sale on that screen**.

### Q3. Home consumption overstated 122%, and "eaten" clamped to zero — `codex/reconciliation-truth`

Two defects in one section. Both measured on the app's own sample farm.

**(a) Paid invoices never reach reconciliation.** `buildLedgerRows` counts paid invoices as income
(`app/finances/page.tsx:673-675`) but `HarvestReconciliation` is handed only `production` and
`sales` (lines ~1066, ~1096). Six paid invoices carry **15.0 kg** of produce, so reconciliation sees
sold = 110.5 kg instead of 125.5 kg and prints *"unaccounted for: home-eaten, given away, or
spoiled?"* as **27.3 kg** where the honest figure is **12.3 kg**. The code already knows: the
comment at `page.tsx:676-684` documents this exact gap and defers it as "Rory's decision (D9)".
**Rory's decision, 5 August: count them.** Invoiced produce is sold produce.

**(b) `unaccountedKg` is clamped at zero and fails in the direction that matters.**
`lib/harvest-reconciliation.ts:383` does `Math.max(harvestedKg - soldKg, 0)`. Against the sample
books under realistic logging — money is memorable, picking is not:

| what the farmer logs | harvested | sold | "eaten" | flags |
|---|---|---|---|---|
| both books complete | 48.0 kg | 37.5 kg | 10.5 kg | 2 |
| harvest at 30%, sales complete | 9.0 kg | 37.5 kg | **0.5 kg** | **4 yield-gap** |
| no harvest, sales complete | 0.0 kg | 37.5 kg | **0.0 kg** | **4 yield-gap** |

Row 2 is the common case. The app tells a subsistence farmer she ate nothing precisely when she ate
most of it, **and** fires four "the plan expected X, you only got Y" warnings blaming her for a
logging artefact. It never says "I don't know."

Required: a real **unknown** state. When `soldKg > harvestedKg` the harvest book is incomplete — say
that, suppress the yield-gap flags for those crops, and print no consumption figure at all. Label
the derived quantity **"kept"** (home-eaten, gifted, spoiled, fed out, seed saved), never "eaten":
the leakage is real and the honest word covers it.

### Q4. The printed crop plan has no first year — `codex/printed-plan-year-one` (task #69)

Month 1 tells the farmer to harvest crops it never sowed. The most directly actionable falsehood the
app prints.

### Q5. "Climate: Not set" is a separator bug — `codex/pdf-separator` (task #80)

The PDF splits on `-` while the app joins with `·`. Small, contained, and it makes the export look
broken to exactly the audience the export exists for.

### Q6. Chart and prose compute monthly kg two different ways — `codex/monthly-kg-one-authority`

Tasks #64 and #68. Two authorities for one question — the recurring bug `AGENTS.md` §6 names. #68 is
the same fault surfacing again when a crop is already growing or loss is above zero. Fix as one
item: one function, both callers.

### Q7. Workload chart counts phantom mulch jobs — `codex/workload-phantom-jobs` (task #81)

And page 1 draws **uncaveated staffing conclusions** from that chart. A staffing number a funder
reads is a number someone hires against.

---

## Priority 2 — the funder demo (Rory is showing this)

### Q8. Ubhejane must click through to its design, plan and report — `codex/network-ubhejane-deeplink`

**Rory asked for this directly on 5 August**: *"in the sample view i want ubhejane creche on the
network i go in and can click various info see the designs? reports?"*

Half exists already. `lib/network-demo.ts:220` is `siteName: 'Ubhejane Crèche Garden'` at the **same
coordinate as `DEMO_SITE`** in `lib/demo-farm.ts`. What is missing is the click-through:
`components/network/FarmerPanel.tsx` contains **zero** `href` and **zero** `router.push` — grep it.
The panel is a dead end.

Add links from the panel to the design map, the crop plan, the field journal and the report.

**Only Ubhejane has that data.** For the other 15 demo farmers the buttons must be **absent, not
dead** — because that bug already exists one component over and you must not reproduce it:
`components/NgoDashboard.tsx:550-560` renders two cards, "Garden design" and "Garden report", each
with the word **"view"** under it, and **neither has an `onClick`**. Wire them or remove the word,
in the same item.

### Q9. Demo-data coherence — `codex/demo-data-coherence`

Three contradictions an attentive funder will catch, found by the adversarial reviews on 5 August:

- The field journal's first entry is dated **27 May 2026**, but the ledger carries sales from
  **12 Sep 2025** — 21 of 33 sales predate the journal meant to record the work.
- The rainwater tank appears in **three mutually exclusive states**: the ledger says bought
  2025-09-04 for R5 500, the journal says delivered 2026-06-26, the report draws it as **PROPOSED**.
- **Four of five** journal harvest notes are contradicted by their own `ProductionLog` rows.

One coherent timeline. The demo data is a claim about a real farm; it should survive close reading.

### Q10. The invoice page is hardcoded to the wrong farm — `codex/invoice-hardcoded`

`app/invoice/page.tsx` says **"Tugela Valley smallholding"** at lines 144 and 257 regardless of whose
invoice it is, and its footer carries the **retired domain** `fieldproof.vercel.app` at lines 172 and
303. The live URL is `imbewufield.vercel.app` and nothing else.

### Q11. Finances needs one chart, and the planned side is free — `codex/finance-chart`

Measured on the sample plan (16 plantings, 7 beds, 44 m²), all from **existing pure functions**, at
zero data-entry cost: **150.4 kg/yr** (`yieldByCrop`, `lib/crop-plan.ts:381`), **R3 976 retail /
R1 284 wholesale** (`buildFoodValueByMonth`, `lib/crop-plan.ts:753`), kg by month
10/22/8/12/2/28/18/7/19/15/7/4. **None of it appears on `/finances`.**

Build one chart: planned as a faint band, harvested and sold as lines over it. Then the insight
**only this app can give** — price achieved versus the reference band in `lib/crop-prices.ts`. On
demo data, routing each crop's volume from its worst-paying to its best-paying buyer is **+R463**.
Frame it as a band ("shops pay R14, gate R29"), never a verdict: that price book is a dated snapshot
(2026-07-14) and 14 of 24 entries are `estimated`.

Three presentation bugs belong in the same item:

- `app/finances/page.tsx:1096` hard-pins `period="month"` on phones while the page default is
  `'season'` — **6.0 kg shown instead of 48.0 kg**, one eighth of the season.
- The produced/sold pair renders at `#8C7A62` on `#FFFEFA` — **4.1:1 contrast, below the WCAG AA
  4.5:1 floor** — while the crop name beside it sits at 17.2:1. The two numbers that answer the
  question are the least legible text on the panel.
- `lib/harvest-reconciliation.ts:94` treats "this year" as the **calendar** year, so in January it
  shows almost nothing. Trailing 12 months is what the farmer means.

### Q12. "Tap to add photos" is a dead button — `codex/add-photos-dead` (task #44)

In the Add-site-photos modal. Small, and photographs are what a funder puts in their board pack.

---

## Priority 3 — the crop plan and the catalog

- **Q13** (task #86) — irrigation switch: *"I can water my beds"* opens dry-season sowing windows.
  The highest-value plan change left. Harvest continuity was measured on 5 August as
  **catalog-bound, not optimiser-bound** (see `tests/harvest-continuity-probe.ts`, closed task #85):
  under 'summer' rainfall July's fresh feeders are the leafy group plus broad beans, and September
  offers 2 crops. Irrigation is the lever that moves it. **Do not rebuild the optimiser** — a full
  steady-harvest machine was built, iterated three times, measured against a stashed baseline as a
  **no-op**, and parked in a stash on Rory's `claude/atlas` worktree.
- **Q14** (task #87) — show stored food beside the harvest chart; flush months feed the gap months.
- **Q15** (tasks #73, #84) — the catalog has 25 entries and a 1000-bed farm draws every planting from
  22 of them. Expanding it is what unblocks Q13/Q14 properly. **Every new crop needs a sourced row**
  — the catalog was found systematically optimistic once already (yields 1.5–3× too high, 62
  corrections). Cite the source in the comment, as the DARD spacing rows do.
- **Q16** (task #78) — rotation uses food groups, not botanical families, **and the UI claims
  otherwise**. The claim is the bug; fix the rotation or fix the claim.
- **Q17** (task #79) — `nextStapleCourse` is dead code; the plan promises a next-season rotation the
  engine cannot do.
- **Q18** (task #77) — cover crop reads as a failed crop: "Oats … 0.0 kg" needs a label pass.
- **Q19** (task #59) — intercropping: audit the figures, add instructions and a choice.
- **Q20** (task #63) — desktop has no way to save the crop-plan PDF: share sheet only, no Downloads,
  no Print.
- **Q21** (task #83) — soil-test upload: let a farmer's lab result override the global model.
  `soilBasis()` in `lib/report-doc.ts` already handles `soilSource === 'lab'`; the upload path is
  what is missing.

---

## Priority 4 — render pipeline **[NO PAID RENDER]**

Tasks #41, #42, #46, #65. Code-level work only, verified against cached output. Each burns money per
image and Rory is not here to authorise the spend. If an item genuinely cannot be verified without a
paid render, **say so in the ledger and skip it** — that is the correct result, not a failure.

---

## Priority 5 — course, blocked on humans

Tasks #18, #19, #20, #21, #55. #19 needs a first-language isiZulu reviewer; #18 is Rory's decision on
the no-AI-video rule. Do not resolve either by deciding it yourself.

---

## Standing work, when the queue runs dry

Do **not** invent a new hardening sweep. On 2026-07-29 the queue emptied, the standing work took over
exactly as written, and the run spent six hours and 5 million tokens on module-by-module input
hardening — real work, correctly done, and not what the project needed. It had not gone off-brief;
**it ran out of brief and nobody was told.**

So: **post `QUEUE LOW` on issue #35 when you take the item that leaves three or fewer**, then work
this list, which is bounded on purpose.

1. Re-run `tests/report-document-probe.ts` and `tests/harvest-continuity-probe.ts` and **read the
   output**. File what you see.
2. Reconcile the features built in parallel on 5 August that overlap and were never merged in
   concept: `/network` versus `components/NgoDashboard.tsx` (both are funder portfolio views),
   `/exchange` versus the Community `BoardPost` feature (`lib/db/types.ts:103-120`), and
   `app/journal` versus the pre-existing `MyRecords`. Propose one owner per job in the ledger
   **before** deleting anything.
3. Stop. Leave the rest for Saturday.
