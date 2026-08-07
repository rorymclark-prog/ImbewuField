# Codex work queue — ImbewuField

Read `AGENTS.md` first. It carries the verification commands, the ownership split, the guardrails
and — most importantly — **§5 LOOK AT WHAT YOU MADE**.

The previous run's queue is archived at `docs/CODEX-QUEUE-ARCHIVE-2026-07-29.md`. Do not work from
it: it carries a retired `PLAN_VERSION` instruction that now causes harm. See the correction below.

---

## ⚠ OPERATING MODE — UPDATED 2026-08-06 17:00. START AT QD1.

**Rory is away from the computer and Claude is not watching your run.** You own the whole loop:
build it, push it, read BOTH CI jobs, merge it yourself, log it on issue #35, take the next item.

**Start with QD1, then QD2, then QD3** (Priority 1c, below the Priority 2 block). Those three are
the Vision 2 design work Rory asked for today and they are written against code that was verified
this afternoon — file paths and line numbers in them are current as of `origin/main`.

**Nine items were closed today and are marked ✅ DONE. Do not reopen them.** Two of those had wrong
premises — Q3(a) was already fixed by #40, and Q10's "hardcoded seller details" had read the
signed-in profile since the file's first commit. **Before starting ANY item, check its premise
against the real code.** Finding an item already done is a useful result and `AGENTS.md` says so;
rebuilding something that works is not.

Also true as of today, and worth knowing before you touch anything:

- **The Firestore and Storage rules were deployed for the first time on 6 August**, after 19 days
  stale. Three live holes closed. The rules in the repo are now what production runs — so a rules
  change you merge is still INERT until Rory deploys, and that matters more than it did.
- **The Anthropic API account is out of credit.** Fifteen routes are down, including `/api/chat`
  (Ask Lima) and `/api/generate-report`. If you are testing anything AI-backed and it fails, that is
  why — it is not a bug you introduced and not one to chase. Gemini-backed paths (sheet renders,
  image producer, the Functions worker) are on separate billing and still work.

**You own the whole loop until Saturday.** For each item:

1. Branch, build it, verify it — `npx tsc --noEmit`, then `npm test`, then **look at the output**.
2. Push the branch.
3. Read the CI result on that push. **`test.yml` now has TWO jobs — `test` and `rules` — and both
   must be green before you merge.** Check the jobs, not the run summary:
   `gh run view <id> --json jobs --jq '.jobs[] | "\(.name): \(.conclusion)"'`
4. Append one line to the ledger, issue #35: what merged, and what Rory should look at.
5. Take the next item immediately.

> **2026-08-06, Claude — READ THIS BEFORE YOUR NEXT MERGE.** Six merges landed on `main` today
> (`c80cec7`, `3390441`, `01c462f`, `f19d925`, `aaa19e1`, `b99560c`) and **`main` was red after
> every one of them.** That is not a reprimand: the gate was structurally unsatisfiable and no
> amount of care on your side could have passed it. A squash merge creates a NEW commit, and the
> release note riding inside it was necessarily stamped with a sha that predates it — so the note
> could never cover the commit carrying it, and the next branch stamped THAT sha and landed another
> unnoted squash. You were exactly one commit behind, permanently, by construction.
>
> It is fixed (`claude/ci-gate-order`): one commit of lag passes when that commit is HEAD itself,
> two still fail. **But the second fault is the one that matters.** The Firestore rules tests sat
> downstream of that gate in the same job, and on `main` the gate is blocking — so the job stopped
> before the emulator ever started. **The rules tests did not run on any of those six merges.** A
> security check that a cosmetic check can switch off is not a check; they are now a separate
> `rules` job. This is why step 3 above now says *both jobs*.

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
- **A rules change is NEVER "done", and you must not write that it is.** Verified on 6 August:
  **nothing in this repository has ever deployed the rules.** No workflow, no npm script, no
  Makefile target calls `firebase deploy --only firestore:rules` or `storage:rules` — `firebase.json`
  declares both files and nobody ships them. So a merged rules commit changes a text file and
  changes nothing a farmer's phone talks to. An external audit spent thirty-one pages reasoning
  about those two files as though they were production; they may not be.
  **Every ledger line for a rules change ends with `INERT UNTIL RORY DEPLOYS`**, and the item is not
  closed until he confirms he has. Passing `npm run test:rules` proves the rule you wrote does what
  you meant *in the emulator* — it says nothing about what is live.
- **Never `git add -A` or `git add .`** — always explicit paths. Other work shares this checkout.
- **Never commit** secrets, `.env*`, `serviceAccount.json`, CareLink/medical data, logs, `.venv/`.
- **Invent no number that reads as an agronomic or financial recommendation.** If a figure is not
  measured or sourced, the honest output says it is unknown. This app's outputs are instructions
  real smallholders spend money against.
- **The release-notes gate is blocking on `main` and it is still easy to trip.** `test.yml` runs
  `npm run notes:pending`, which FAILS when commits touching `app/`, `components/` or `lib/` carry
  no farmer-facing note. Add an entry to `lib/release-notes.ts` stamped with your newest sha, in the
  farmer's language, **≤ 90 characters per line** — enforced by `tests/canvas-labels.test.ts`, and a
  first draft usually breaches it. Since 6 August it tolerates exactly one commit of lag when that
  commit is HEAD itself, so a squash merge no longer fails on arrival — **but two unnoted commits
  still fail, which means you cannot skip a note twice running.**
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

## Q0 — DO THIS FIRST. Q1 shipped broken and it is live.

**Rory tapped "Log harvest" on the deployed app and landed on the map with no panel open.**

Q1 (PR #36, merged `f114cf8`) added the right link. The destination refuses to render it.

`components/DataPanel.tsx:638`:

```ts
if (!data && !loading) return <EmptyState />;
```

`data` is the SITE ANALYSIS for a selected location. Arriving from `/finances` there is no site
selected, so `data` is null, so DataPanel returns `<EmptyState />` — the "Tap anywhere in South
Africa to get a full permaculture plan" placeholder — and it returns **before any tab rendering
happens**. `forcedTab` is set correctly at `app/farmer/page.tsx:168`; nothing ever reads it.

Confirmed signed-in on production (Rory's own screenshot) and signed-out in sample mode, where it
stops one step earlier at the "Sign in to keep your own records" gate. Both dead ends.

**Branch:** `codex/q1-farm-panel-needs-no-site`

**The question to settle first, because it decides the fix:** does the harvest log actually depend
on the site analysis at all? `ProductionLog` (`lib/db/types.ts:35`) carries `garden_id`, not
coordinates. If the Farm tab does not need `data`, the honest fix is to let it render without one
rather than to fake a site for it. `lib/last-site.ts` (`setLastSite` is called at
`app/farmer/page.tsx:313`) is the other candidate — hydrate the last site when a panel is
deep-linked — but that only works for a farmer who has already analysed somewhere, so it fixes the
common case and leaves a new farmer at the same dead end.

**Verify by USING IT, not by adding a test.** Deep-link `/farmer?panel=Farm` in a browser with no
site selected and confirm a crop field and a kg field are on screen. A test that mounts the panel
with `data` already present will pass while the bug is still there — that is precisely how this
shipped.

**Why this is Q0.** It went out on a green suite of 1,992 tests and a new test file of its own,
and the first human to touch it found it in about thirty seconds. Nothing in the suite could have
caught it, because every test supplies `data`. Read §"Verification is not `npm test`" above again
before starting.

---

## Priority 1 — the app tells the farmer something untrue

Ordered by how badly the app misleads. Do these first.

### ✅ DONE #36 — Q1. `/finances` shows harvest data it gives you no way to enter — `codex/finances-harvest-entry`

> **Closed 2026-08-06.** shipped, then repaired by Q0


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

### ✅ DONE #37 — Q2. The sales list on that same screen is permanently empty — `codex/myrecords-sales-dead`

> **Closed 2026-08-06.** sales list now loads


`components/MyRecords.tsx:624` declares `const [sales, setSales] = useState<SalesLog[]>([])`.
`setSales` is called **once**, at line 670, with `[]`. `mySales()` is exported at
`lib/db/queries.ts:231` and never called here. The comment at line 774 claims an optimistic append
that does not exist. The "Sales summary" card (line 781) and "Recent sales" list (line 819) stay
empty **even immediately after the farmer logs a sale on that screen**.

### ✅ DONE #44 — Q3. Home consumption overstated 122%, and "eaten" clamped to zero — `codex/reconciliation-truth`

> **Closed 2026-08-06.** (a) was ALREADY FIXED by #40 — invoice kg reach reconciliation via lib/invoice-sales.ts. (b) fixed: keptKg is number|null, yield-gap withheld when the harvest log is provably short


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

### ✅ DONE #45 — Q5. "Climate: Not set" is a separator bug — `codex/pdf-separator` (task #80)

> **Closed 2026-08-06.** U+00B7 MIDDLE DOT joined, ASCII hyphen split — all 7 regions printed "Not set". locationLine/climateLine are now their own fields


The PDF splits on `-` while the app joins with `·`. Small, contained, and it makes the export look
broken to exactly the audience the export exists for.

### ✅ DONE #47 — Q6. Chart and prose compute monthly kg two different ways — `codex/monthly-kg-one-authority`

> **Closed 2026-08-06.** #64 was already fixed 4 Aug. The remaining half was two SCOPES, both deliberate, undisclosed — the prose now names what it omits. Its guard could not fail and now can


Tasks #64 and #68. Two authorities for one question — the recurring bug `AGENTS.md` §6 names. #68 is
the same fault surfacing again when a crop is already growing or loss is above zero. Fix as one
item: one function, both callers.

### ✅ DONE #46 — Q7. Workload chart counts phantom mulch jobs — `codex/workload-phantom-jobs` (task #81)

> **Closed 2026-08-06.** mulch counted as a second visit; up to +50% on sowing months. FOLDED_ACTIONS is now read by both the chart and the field sheet


And page 1 draws **uncaveated staffing conclusions** from that chart. A staffing number a funder
reads is a number someone hires against.

### ✅ DONE #43 — Q22. `--border` is defined twice at equal specificity and the wrong one wins — `codex/border-token-collision`

> **Closed 2026-08-06.** two :root blocks disagreed; /home drew 51 hairlines in one colour and 41 in another. Fixed and verified live in production


Measured on `b99560c`. `app/globals.css` declares `--border` in **two separate `:root` blocks**:

- line 54 — `#E2D8C4`, commented *"the actually-used hairline (~warm ink)"*
- line 339 — `#ECE3C9`, inside a *"legacy alias"* shim added so old `var(--bg-0)` callers pick up
  almanac colours

Same selector, same specificity, so **the later one wins and `--border` resolves to `#ECE3C9`** —
the shim, not the block that documents itself as authoritative. This is `AGENTS.md` §6's recurring
bug exactly: two places answering one question and silently diverging.

**Why it is Priority 1 and not a cosmetics item.** `#e2d8c4` is the **second most-used colour
literal in the codebase — 518 occurrences** (`#1f4d2b` leads with 539; 5 334 hex uses in total,
855 distinct, top 20 covering 66.9%). A `hex → var()` migration would rewrite those 518 sites to
`var(--border)` and repaint every one of them to a different colour. Both values are pale warm
greys, so the diff reads as correct and the screen is wrong — a silent substitution across 518
sites, which is this repo's signature failure mode.

Fix the collision only: decide which value is the real hairline, make it the single definition, and
delete the loser. **Do not migrate any colours in this item.** Add a test that fails when a token is
declared twice at the same specificity — that is the check that must be able to fail.

- **Do NOT run a `hex → var()` codemod, on any branch, until Q22 has merged and Rory has approved a
  token map.** A design audit is in progress and will propose one. Applying it over the current
  `globals.css` corrupts 518 borders silently and no existing test would notice. The app has **four**
  themes — `earth`, `earth.dark`, `slate`, `slate.dark` — so any token map with one value per token
  is incomplete by construction.

---

## Priority 1b — asked for directly by Rory, 6 August

### ✅ DONE 3390441 — QR1. Invoice: preloaded product and customer pickers with price guidance — `codex/invoice-pickers`

> **Closed 2026-08-06.** invoice pickers


Rory, looking at a blank invoice line: *"i want to add a whole lot of premade option with price
sugestion for products products must be a drop down menu as well preloaded as well as customers,
we can also have some presaved customer options neighbour spaza shop etc etc"*

`app/invoice/page.tsx` already has the memory half of this: `products` (line 41) learns
`{desc, unit, price}` from what the farmer has typed before, and `updateItem` (line 68) auto-fills
unit and price on a name match. **It is empty on day one, which is the whole complaint.** Do not
replace that mechanism — seed it, and put a picker in front of it.

**Where the prices come from — the only acceptable source.** `lib/crop-prices.ts`
(`DEFAULT_CROP_PRICES`, `priceFor()`, plus the farmer's saved overrides). It carries
`retailPerKg` and `wholesalePerKg` per crop. **Do not write a new price table.** Do not derive a
price for a crop the book does not carry.

**Four constraints. Each one is a way this feature could quietly lie to a farmer about money.**

1. **The book is per KILOGRAM. The form defaults to `bags`.** Suggesting R15/kg into a line whose
   unit is "bags" is wrong by whatever a bag weighs, and it will be wrong on a printed invoice a
   farmer hands to a shop. So: picking a crop from the catalogue **snaps the unit to `kg`**. If the
   farmer then changes the unit to bags/crates/bunches/trays, the suggested price must be
   **cleared**, not carried across — a per-kg figure sitting in a per-bag row is exactly the silent
   substitution this repo keeps getting bitten by.

2. **A suggestion is a band, never a price.** 14 of the book's 24 entries are `confidence:
   'estimated'`, and the whole snapshot is dated 2026-07-14. Show both ends with the date, e.g.
   *"Shops pay about R14/kg · at the gate about R29/kg — guide price, July 2026"*. Never pre-fill
   the price field so that it looks like a decision the app made. The farmer's own number always
   wins and is remembered by the existing `addProduct` path.

3. **`UNPRICED_CROPS` gets no suggestion at all** — not R0, not a blank that reads as free.
   Coriander is in that set deliberately. Show the crop in the list with no price line.

4. **`confidence: 'estimated'` must be visible**, not hidden behind an average. A farmer pricing
   dry beans off a sourced R65 and a farmer pricing something off a proxy figure are in different
   positions and are entitled to know which they are in.

**Customers.** Two groups in one dropdown: the farmer's own saved buyers first (from their existing
invoices — `billTo` is already stored per invoice, so build the list from saved invoices), then a
preset group of the buyer TYPES that actually exist for a KZN smallholder — neighbour, farm gate,
spaza shop, bakkie trader, market stall, hawker, school, crèche, church, restaurant or lodge,
co-op. These are categories, not invented business names: never ship a fake customer called
"Spar Nquthu" as though it were a real account. The existing placeholder already reads
"e.g. Spar Nquthu (wholesale)" — keep that an example, not an entry.

**The one genuinely good idea here — connect the two dropdowns.** The buyer type tells you which
end of the band to show. Neighbour, farm gate and church sit at the retail end; spaza, bakkie
trader, market stall and school sit at the wholesale end. So choosing "spaza shop" and then
"cabbage" should surface the wholesale figure first, with the retail figure still visible beside
it. This needs no new data and it is the thing no other invoicing app can do for this farmer,
because no other app holds both her buyer and a researched price for her crop.

**Verify by using it.** Open `/invoice`, pick a customer type, pick a crop, and read the line back:
does the unit say kg, does the guide price name its date, and does switching the unit to bags clear
the suggestion? A test that asserts the dropdown has 24 entries proves nothing about any of that.

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

### ✅ DONE #48 — Q10. The invoice page is hardcoded to the wrong farm — `codex/invoice-hardcoded`

> **Closed 2026-08-06.** seller name/phone were NEVER hardcoded — half the premise was wrong. 'Tugela Valley smallholding' was, on both render paths; now Profile.farm_name


`app/invoice/page.tsx` says **"Tugela Valley smallholding"** at lines 144 and 257 regardless of whose
invoice it is, and its footer carries `imbewufield.vercel.app`.
The live URL is `imbewufield.vercel.app` and nothing else (previously used a different domain).

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

### Q12. "Tap to add photos" is a dead button — ~~`codex/add-photos-dead`~~ (task #44)

**ALREADY FIXED — DO NOT START THIS.** Verified 2026-08-06 against `origin/main`. The control is
wired: `components/DataPanel.tsx:1850` is `onClick={() => promptInputRef.current?.click()}` and the
ref is attached to a real input eleven lines above at `:1839-1846`. The two silences that made it
*read* dead were closed on 4 August (`04bf23d`), before this queue was written. Two narrow residuals
remain and are NOT this item: non-`image/*` files are filtered out at `DataPanel.tsx:553` *before*
the skip count is computed at `:556`, so a HEIC that fails conversion vanishes with no amber note;
and the input's `value` is never cleared, so re-picking the same file fires no change event.

---

## Priority 1c — the Vision 2 design direction, starting with Design Studio

Rory, 2026-08-06, on the Water-step mockup: *"i want to impliment most of the design style ui and
want to start with this... i like this very much look at thos elements at the bottom we need a rain
barrel and water trough and i like the graphics on these very much"*

### QD1. Design Studio: element tray artwork and the desktop layout — `codex/studio-vision2-shell`

**READ THIS BEFORE TOUCHING ANYTHING. THE TWO ELEMENTS HE ASKED FOR ALREADY EXIST.** Verified on
`origin/main`:

| | |
|---|---|
| `lib/design-elements.ts:256` | `id: 'rain_barrel'`, `category: 'water'`, `0.6 × 0.6 m`, `icon: '🪣'` |
| `lib/design-elements.ts:317` | `id: 'water_trough'`, `category: 'water'`, `0.6 × 2 m`, `icon: '🥛'` |

The mockup captions read `Ø 0.6 m` and `0.6×2 m`. **Those are this catalog's own numbers** — the
mockup was drawn from the app, so there is nothing to add and nothing to size. Adding a second
`rain_barrel` would split every existing farmer's saved geometry across two ids. **Do not add,
rename or re-dimension either one.**

What he is actually asking for is the **presentation**, and there are three separable pieces.

**(a) Element tiles can show artwork instead of an emoji.** Today every tile is
`<span style={{ fontSize: 20 }}>{def?.icon}</span>` — `app/design/page.tsx:3704` — and the repo
contains **no element artwork at all** (no `public/elements`, `public/icons` or `public/symbols`).
The pictures in the mockup do not exist anywhere and you cannot generate them.

So build the *seam*, not the art: add an optional `art?: string` to `ElementDef`
(`lib/design-elements.ts:18`) holding a path under `public/elements/`, and render it when present
with the existing emoji as the fallback. Ship with `art` unset on every element — the tray must look
exactly as it does today until artwork is committed, so this change is provably zero-risk. Artwork
arrives separately, per element, and each addition is then a one-line data change.
**Do not invent placeholder art. Do not restyle the emoji into fake artwork.**

Add the dimension caption under each tile from the def's own `wM`/`hM` — that IS in the mockup, it
is measured data the catalog already holds, and it is the one part of the tile you can complete now.
Circles read `Ø {wM} m`, rectangles `{wM}×{hM} m`.

**(b) The tablet/desktop layout.** The design review's top finding for this screen, and the one
that changes someone's day: a facilitator works on an iPad and currently gets the phone layout. The
mockup's three panes — tool rail left, canvas centre, layers/quick-actions right — are the target.
`app/design/page.tsx` is 3,959 lines; **add a breakpoint branch, do not restructure the file.**

**(c) The layer panel: nested sub-layers and per-layer opacity.** The mockup nests JoJo Tanks / Tap
Points / Pipes & Lines / Drip Irrigation / Swales under *Water infrastructure*, each with its own
eye toggle and percentage. Check what `lib/design-studio.ts` already models before designing a new
shape — several things in this app are built and merely unwired.

**BEWARE THE LAYER-FOCUS BUG CLASS.** A step that creates a shape on a layer it has switched off
saves the shape and shows nothing, and the farmer believes the work was lost. Any per-layer
visibility work must be checked by drawing something on each layer and confirming it appears.

**Guardrails specific to this item:**
- **Never mutate saved geometry.** Presentation is paint-time only; the farmer's measurements are
  the product. This item touches no coordinate.
- **Leave `PLAN_VERSION` exactly as you found it** (`components/design/DesignGlossy.tsx:10419`).
  If a tray or layer change alters what a rendered sheet looks like, say so in the ledger.
- **[NO PAID RENDER].** Nothing here needs a Gemini call.
- **Do not apply any colour from the design pack.** Its palette shares exactly ONE hex with this
  app — `#ffffff` — out of 852 distinct values in 5,166 uses. It is a new identity, not a token map,
  and adopting it is Rory's decision and not part of this item. Typography, spacing, radii, shadow
  and the 44/48 px touch targets from `Design_System/design-tokens.css` ARE safe and welcome.

**Verify by looking.** `npm test` cannot see a squashed tray, a tile with no caption, or a layer
toggle that hides the wrong thing. Open the preview URL your push creates, place a rain barrel and a
water trough on the Water step, toggle every layer, and say in the ledger what you actually saw.

### QD2. The baseline survey — the unlock for everything food-security — `codex/baseline-survey`

**DO THIS BEFORE ANY FOOD-SECURITY DASHBOARD.** Every panel in Rory's two mockups reads from data
this survey does not yet collect, and building the dashboard first would force you to invent it.

**The insight that makes this buildable.** The app has yield data for **25 crops**
(`lib/crop-catalog.ts`). It has **none** for fruit, nuts, berries, eggs, chicken, rabbits or honey —
`lib/species-catalog.ts` carries 197 species with height, water need and biome but **no yield and no
bearing age**, and beehive / chicken_coop / rabbit_hutch exist only as drawable objects in
`lib/design-elements.ts`. So the app cannot compute those categories. **But it does not have to.**
The mockup's own "CURRENT PRODUCTION SURVEY — Item / Qty per Year / Used by Family / Sold / Income"
is the farmer *reporting* her production. A reported figure is not an invented one. The survey is
the data source; the dashboard renders what she said.

**What exists today.** `lib/site-survey.ts` records PRESENCE and never QUANTITY:
`existingCrops: string[]` (:40) and `livestock: string[]` (:43) say *which* — never how many, never
what it earned. `isCommercial` (:49) is a boolean. So the app knows she has chickens and cannot say
whether that is two or two hundred, which is why no impact claim can be made from it.

**Extend `SiteSurvey` with, per production category:** quantity per year and its unit, how much the
household used, how much was sold, and what it earned. Cover the nine categories in the mockups —
leafy greens, other vegetables, staple crops, fruit, nuts and berries, eggs, poultry, rabbits,
honey — plus a free row for anything else. Everything OPTIONAL: a farmer who does not know her egg
count must be able to finish the survey, and a blank must stay blank rather than become a zero.
Follow the file's existing shape (`loadSurvey`/`saveSurvey`, `updatedAt` newest-wins) — do not add a
parallel store.

Structure it as the mockup's seven sections: Household Info · Land & Location · Current Production ·
Livestock & Poultry · Income & Sales · Resources & Inputs · Challenges. Four already exist in some
form; reuse those screens rather than duplicating them.

**THE TWO SCORES IN THE MOCKUPS MUST NOT BE BUILT.** "Food Diversity Score 82/100" and
"Nutritional Diversity Score 8.6/10" have no defined inputs, no weighting, no scale and no source.
Inventing a 0–100 scale for a household's nutrition is exactly the harm `AGENTS.md` §4 forbids, and
a funder would quote it.

**Build these instead, and cite them:**

- **Food groups covered, out of 12** — the mockup's own "11/12" is already the right shape. Twelve
  food groups is the FAO **Household Dietary Diversity Score**. Use that group list, name it on
  screen, and count it from what she reported. Published instrument, explicable in one sentence,
  and more use to a farmer than "82/100".
- **Self-sufficiency** — only if the survey asks BOTH halves: what the household ate, and how much
  of it she grew. Do not model the denominator from household size. If either half is missing, the
  figure is unknown and the screen says so.
- **Months with food** and **months with a gap** — countable today from `buildFoodAvailability`
  (`lib/crop-plan.ts:712`) for the catalogued crops, and from reported harvest months for the rest.

**Every figure carries where it came from**, the way the site report's "Where it comes from" column
already does: `reported by the farmer`, `measured from the map`, `from the crop catalog`. A funder
reading a household number must be able to see which of the three it is.

**Verify by filling it in.** Complete the survey as a farmer on the preview URL, then read the
figures back and check each against what you typed. A survey that loses an answer is worse than no
survey, because the farmer believes it was recorded.

---

### QD3. The design foundation — take the spec, hold the palette — `codex/vision2-foundation`

The pack lives at `ImbewuField_Vision_2_Complete_Design_Pack/Design_System/`. Rory has the zip;
ask him for the files rather than guessing at values.

**TAKE, in this order — all additive, none of it changes a colour:**

1. **Touch targets.** `--target-min: 44px`, `--target-field: 48px`. This is a field app used outdoors
   with wet or gloved hands and it matters more than anything else in the pack. Audit against the
   real controls; report what is currently below 44 px rather than silently resizing layouts.
2. **The spacing scale** (4/8/12/16/20/24/32/40/48/64/80/96) and **radius scale** (4/8/12/16/24/999)
   as tokens. The app has neither; every value today is a literal.
3. **The shadow ramp** (four levels) and the **`prefers-reduced-motion`** block, which is drop-in.
4. **Typography.** The spec names Newsreader + Public Sans — **exactly what `app/layout.tsx` already
   loads**, so this is a scale-and-weight change, not a font change. Do not add a webfont.

**DO NOT TAKE THE PALETTE.** Measured on `origin/main`: the pack proposes 22 colours; this app uses
**852 distinct colours across 5,166 uses**; the overlap is **ONE — `#ffffff`**. Of the twenty most-used
colours, covering 67% of all uses, exactly one appears in the pack. It is a new visual identity, not
a token map, and there is no row anywhere in ~100 pack files mapping an existing hex to a token.

It also contradicts this repo in writing: `app/globals.css` says of the page background *"warm paper,
**never #fff**"*, and the pack proposes `--color-surface: #FFFFFF`. Adopting it moves the whole app
from warm to cool. **That is Rory's decision and it is not part of this item. Do not run a
`hex → var()` codemod. Do not "harmonise" colours as you go.**

Note the naming differs too — `--color-border` vs this app's `--border`, `--color-ink` vs `--text` —
so it is not even a drop-in rename.

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
