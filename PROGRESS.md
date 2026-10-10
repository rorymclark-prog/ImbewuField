# ImbewuField — Build Progress

> **Current map-render goal and ongoing task list:** see
> **`docs/ACTIVE-MAP-QUALITY-TASKS.md`**. The older "What's left" section below describes the
> original 33-frame product handoff only; it is not the completion list for the current
> Reference Blueprint / Geometry Lock quality work.

**Picking this up (incl. cloud / phone Claude Code)?** Read **this** file for *what's
done and what's left*, and **`design/DESIGN.md`** for the *design system + per-frame
status*. The visual source of truth is `design/handoff/*.png` (33 frames) and the
build brief is `design/BUILD-INSTRUCTIONS.md` + `design/MAP-TOOLS-CORRECTIONS.md`.

**Update this file after each work iteration** — add a dated bullet to the top of
the Build Log, and move anything finished out of "What's left".

- **Repo:** `rorymclark-prog/ImbewuField` (its own repo — NOT the `~/Claude` monorepo)
- **Live:** `imbewufield.vercel.app` (also `permamap-sa.vercel.app`, `imbewufield.vercel.app`)
- **Deploy:** push to `main` → GitHub Actions (`.github/workflows/deploy.yml`) auto-deploys to Vercel (~2 min).
- **Stack:** Next.js 14 App Router · TypeScript · Tailwind · Firebase/Firestore · Mapbox GL · Anthropic (`claude-sonnet-4-6`).

---

## Status — 2026-06-23

**Every screen in the 33-frame handoff is built and live, except the Google
Sheets / Calendar OAuth sync** (which needs a Google Cloud OAuth client the owner
must provision — not buildable from code alone).

### What's live
- **Auth** — email/password + Google sign-in + password reset + change-password +
  profile photo. Firebase env is set in the Vercel project; Auth authorized domains
  include the vercel.app domains + localhost. (The old `SITE_PASSWORD` site gate was deleted 2026-09-26.)
- **Roles** — five: farmer · mentor · student · ngo · funder (+admin). Mentor merges
  the old supervisor + trainer. Task-first home; roles behind a quiet "Dashboards" link.
- **Map** (`/farmer`) — search/analyse, draw land boundary + water storage (reticle
  **or** GPS-walk), satellite/topo/HD/contours/relief/3D layers, Save-place pins
  (named + coloured by label), redesigned calm tools panel, Lima coach-marks ("?").
  Responsive: landscape/desktop = side panel; phone + portrait tablet = bottom sheet.
- **Lima Vision** (`/vision`) — photo → Claude estimates crop + yield + weeks, or weighs a harvest.
- **Crop Planner** (`/plan`) — crops with bed quantities → projected plants/kg.
- **Crop Plan** (`/cropplan`) — Day/Week/Month/Season task scheduler.
- ~~**Garden Survey** (`/survey`)~~ deleted 2026-09-26 (orphaned) — was a 5-step wizard → Lima-sized beds → 6-week plan + print.
- **Calendar** (`/calendar`) — SA planting calendar, filtered to your crops.
- **Field Journal** (`/journal`) · **Report** (ReportView, AI, print/share).
- **Finances** (`/finances`) — Money in/out logging (+ **scan a till slip** OCR);
  desktop **financial sheet** (ledger + CSV export) at lg+; **Invoice** builder (`/invoice`).
- **Surveys** (`/surveys`) — NGOs build, farmers answer in-app.
- **Mentor / NGO / Funder / Student** dashboards.
- **Onboarding** — language picker + POPIA consent + "get to know you" (`PopiaConsent`).

---

## Build Log (newest first)

### 10 Oct 2026 — Wave 10: last audit leftovers (#990)
- Report footnotes (Köppen, rainfall pattern, wet/dry season) translated per language; isiZulu pending translator CSV.
- New `--on-forest` theme token replaces ~65 hardcoded `#F7F2E9` text colours in 28 files; guard test `tests/stale-paper-hex.test.ts`. Crop planner files left for later (Codex active there).
- Dead `designMode` prop removed from the design wizard.
- Audit close-out filed: `docs/audits/2026-10-10/app-wide-closeout-claude.md`. All 92 original findings dispositioned (90 implemented, 1 verified, 1 owner decision). Next app-wide work needs a fresh audit.

### 9 Oct 2026 — AI allowance in rand: R18/person/month
- Rory: "keep it 18 rand". `lib/ai-budget.ts` now counts in rand: `AI_MONTHLY_CAP_ZAR` (default 18),
  `AI_GUEST_DAILY_ZAR` (default 1), `AI_ZAR_PER_USD` (default 18). The `*_EUR` vars are gone (never set).
- Account page shows "R x of R18 left". Note: R18 equals the whole R18/month price — AI could use all
  of a user's revenue; the research's R6 target is one env change away.

### 6 Oct 2026 — Money book in Sesotho, Tshivenda and Xitsonga (unreviewed drafts)
- **What:** `/records` (Picked · Sold · Spent · Charts; `/finances` redirects there) now reads
  source-keyed machine drafts in Sesotho, Tshivenda and provisional standard written Xitsonga, and
  fills isiZulu where it still fell back to English. One lookup, `lib/records-regional-drafts.ts`,
  keyed by the exact English on screen, so editing the English retires its draft. Existing wording
  always wins; instructions about money and saved records show the English first. A visible
  "Unreviewed … machine draft" notice sits above the tabs.
- **Unchanged on purpose:** totals, formulas, units, currencies, dates, storage keys, validation
  rules, paid AI (`/api/read-slip`) and recovery logic. Placeholders (`{kg}`, `{amount}`) must match
  the English or the draft is refused.
- **Review:** per-language drafting lane, then an independent blind back-translation review.
  Reviewer repairs of whole sentences were not re-reviewed, so those, and every reviewer hold,
  show English. Packet, briefs, verdicts and held rows: `docs/translation-reviews/records-finance-2026-10-06/`.
- **Existing-wording fixes:** "Save sale & invoice" no longer drops "& invoice" in isiZulu and Sesotho.
- **Still open:** Charts-tab components are isiZulu-only inline (`CashflowChart`, `FinanceGraphs`,
  `ComingUpHarvests`, `HarvestReconciliation`, `AreaReturnCards`); held strings (units such as eggs
  and jars, fuel, the lender disclaimer, Tshivenda Export); everything needs a fluent speaker.

### 1 Oct 2026 — Calendar sections; food chart month on top; phone gutter removed
- **Four calendar sections** (`CalendarSectionHeader`, `CalendarSectionNote` in
  `app/facilitator/crops/page.tsx`): Vegetables (beds), Staple crops (plots), Fruit, nuts &
  berries, Animal products. Rory: "must all have their place". An empty section keeps its band and
  says why; a section hidden by the orchard or animals switch says so, with a Show button
  (the orchard switch is still the one shared with Money and Records).
- **Food chart**: month name heads each column, count under the bar ("just switch them").
  Switches renamed "Fruit, nuts & berries shown/hidden" and "Animal products shown/hidden": Rory
  saw "Orchard out" and asked where the fruit was.
- **Phone gutter**: below 768px the chart's 128px bed-label gutter shrinks to 8px
  (`.crop-chart-track` in `globals.css`). Months keep their width, so the shared scroll still
  lines up with the calendar.

### 30 Sep 2026 — Squashes & melons tile; saved crop mix per map; fruit and animal bars
- **Squashes & melons** (`lib/crop-groups.ts`, `squash_melon`): pumpkin, butternut, gem squash,
  baby marrow, watermelon and spanspek moved out of Fruiting veg into their own crop-mix tile.
  Cucumber stays in Fruiting veg (trellised, bed-sized). `nutritionGroupOf` maps it back to
  fruiting veg, so the breadth-first turns (`BREADTH_SLOTS`) are unchanged. PDF: same terracotta
  ink and legend swatch as Fruiting crops.
- **Saved crop mix** (`lib/crop-mix-preference.ts`): ticked tiles plus exact crops, saved per map
  (canvas site, or `design:<id>`) and per goal, in account-scoped localStorage like the animal
  choices. Auto-suggest opens with it; "Reset to recommended" clears it. A tile added to the app
  after a save comes back on for family/hybrid and stays off for commercial. Not synced across
  devices. Tests: `tests/crop-mix-preference.test.ts` (added to `npm test`).
- **Fruit and animal rows as bars**: Rory wanted "the avocado like a cabbage planting". Each tree
  kind or animal product is now its own lane of bars over its sourced months (`produceLanes` in
  `lib/calendar-produce.ts`, runs cut at the year-two seam), in place of up to 3 icons per month.
  Names stick just right of the bed labels while scrolling. Proposed plants stay faded and say
  "(proposed)". Hover/tap a bar for the written line.
- Not done, on purpose: fruit and animals as crop-mix tiles. The mix only steers bed auto-suggest;
  trees and animals come from the Design Studio map, have their own calendar switches, and animals
  are chosen per coop/hive under "Animals on your map".

### 30 Sep 2026 — Crop-mix switches for herbs, fringe crops and cover crops; one-bed vine fix; honey flows
- **Crop mix** (`lib/crop-groups.ts`): "Alliums & herbs" split into **Onions & garlic** and
  **Herbs** (coriander, parsley). Added **Less common crops** (soybean, bambara, mung bean, spider
  plant, African nightshade) and **Cover crops** (sunn hemp, medic, fodder radish). Rory: many
  farmers won't grow coriander, parsley or mung beans, so each can be switched off.
  - Breadth-first turns still go by nutrition (`BREADTH_SLOTS` / `breadthSlotOf`), so the split
    doesn't change what a family plan fits. Less common crops queue last within their slot.
    `suggestSubstituteCrop` uses `nutritionGroupOf` and offers them last.
  - With Cover crops off (`winterCoversWanted`), plots rest after summer instead of getting
    broad beans or oats, and the plan says so. A named crop list still gets covers.
  - PDF legend: 6 swatches ("Less common, cover" share the muted one).
- **"Only three plantings"**: Rory was on a one-bed map. On one bed a ticked vine (butternut) used
  to take the whole bed. It is now left out with a note, and the other chosen crops fill the bed
  (7 plantings). There's a regression test in `tests/crop-plan-ideal.test.ts`.
- **Honey** (option 1): no month bar. The Animals row shows a honey line with "Honey flows depend
  on local plants and rain" and a hover/pin tooltip. The tooltip lists 5 regional flow records
  quoted from Johannsmeier 2016 (SANBI Strelitzia 37), with page numbers
  (`research/animal-sources/bees.json` → `flowNote`, `flowRecords`; `unmarkedAnimalLines` in
  `lib/calendar-produce.ts`).

### 29 Sep 2026 — Pawpaw picking months sourced; honey searched again
Rory: "please search deep the answers will be out there!" (about honey and pawpaw showing only
"not shown" notes in the bed calendar).
- **Pawpaw** (`research/perennial-sources/carica-papaya.json`): KZN DARD "Fruit and Nut
  Production in KZN", §1.6 Papaya, PDF p.18: "The cropping season usually extends from about April
  to January, with a peak from September to November." Now charted April–January for KZN. Quote
  checked against the PDF text. The DAFF papaya brochure (nda.gov.za) still 503s from the sandbox;
  year-round picking appears only in trade press (FreshPlaza, Food For Mzansi), so not used.
- **Honey** (`research/animal-sources/bees.json`): still no months. The round-2 rule stands: chart
  honey only when a source states a region's harvest or main-flow months. Found and recorded in
  gaps, not charted: Buys 2019 (Zululand, "March … the middle of the honey flow", plus bar charts
  of kg harvested by month, roughly Mar–Jul), Masehela 2017 (beekeeper-reported bloom months of
  honey-crop plants by province), Human 2006 and Hutton-Squire 2014 (nectar-plant months).
  Unread: DFFE "The Honey Trade" (2005) and Johannsmeier's ARC-PPRI handbook.
- Rebuilt `lib/perennial-harvest-data.ts`; `lib/animal-enterprises-data.ts` unchanged. Release
  note added (placeholder sha).

### 29 Sep 2026 — Berries and moringa in the design studio; tree picking in the monthly plan
Rory: "what about berries and other food forest crops can we add them to the design studio etc?
what about moringa put all these things in there… and maybe have it even show in the monthly crop
plan? harvest period etc etc".
- **Catalogue** (`lib/species-catalog.ts`, now 200): strawberry (groundcover; Fynbos + Grassland),
  southern highbush blueberry (Fynbos), raspberry (Fynbos + Grassland), Cape gooseberry (seven
  biomes, rank 5). All `reviewed: false`, NEMBA checked against GN 1003 of 2020. Height, frost
  class and biome ranks are editor placeholders and each `source` says so; Cape gooseberry's
  facts rest on seed-company/trade pages only (said in its source). **Blackberry left out**:
  *Rubus fruticosus* agg. is NEMBA category 2.
- **Harvest dossiers** (`research/perennial-sources/`): strawberry (Acta Hort. 265, SASGA, KZN
  DARD), blueberry (Stellenbosch MSc 2022, USDA GAIN 2017, KZN DARD; its chill figure is in
  hours so the chill-units field stays null), raspberry (KZN DARD Nov–Jan), purple granadilla
  (KZN DARD Nov–Jan + Jun–Jul, first crop 6–8 months), moringa (leaves and pods; first leaves
  6–12 months and pods Mar–Apr, North West DARD p.7), Cape gooseberry (picking late Oct–Jan in one
  Stellenbosch University tunnel trial; the seed company's sowing calendar is not used). Mulberry
  still has no SA harvest record.
- **Art:** moringa mapped in `lib/species-art.ts`; `tree_moringa` → `moringa-oleifera` in
  `ELEMENT_SPECIES`. The four berries have no painted picker art yet (Lucide fallback) — Codex batch
  needed.
- **Fruit, not trees** (Rory: "instead of fruit trees as the icons make them actual fruit"): flat
  placeholder fruit icons for all 36 harvest species in `public/fruit-art/*.svg`
  (`scripts/build-fruit-placeholder-art.mjs`), served by `speciesFruitArtworkUrl` in
  `lib/species-art.ts`. The food chart's tree tray uses them. Painted PNGs: `docs/FRUIT-ART-BRIEF.md`.
- **Bed calendar rows** (Rory: "include fruit and nuts and berries (also add for animal products)
  into this calendar … if you hover … a written version of what's in that month"): under the beds,
  **Fruit, nuts & berries** and **Animal products** rows show each month's fruit icons or Lucide
  product icons (egg, milk, fish); hover, focus or tap opens a fixed-position card listing each
  line ("Mango — fruit · 3 plants on your map · 1 of them proposed"). Whole design, proposed faded
  and said not cropping yet. Footnotes name what is on the map but not shown (no sourced months,
  e.g. Pawpaw, honey; or a structure with no "what for"). `lib/calendar-produce.ts`. Follows the
  orchard/animal switches.
- **Chosen crops** (Rory: "i selected pumin theres no pumkin or amadumbe or peanuts bambara"): a
  vine picked by name (pumpkin, butternut, watermelon) now takes a bed even with vines kept out of
  beds; a picked crop with no sowing month on the farm's calendar (amadumbe on hard frost; bambara
  off the summer calendar) gets a note saying so instead of a false "didn't fit". Groundnuts were
  already placed. `lib/crop-autosuggest.ts`; the family/steady ideal anchor re-pinned March →
  November from the re-read sweep (`tests/crop-plan-ideal.test.ts`).
- **Monthly plan** (`app/facilitator/crops/page.tsx` Tasks card): under each month (this, next,
  Looking ahead for 12 months) a **From your trees** box lists standing trees in their sourced SA
  season — "Pick Raspberry (2) — SA season Nov–Jan" — with a note that seasons are every region
  together. Proposed trees are left out (years from a crop); follows the food-forest switch; the
  WhatsApp share carries the lines too. `treePickingByMonth` / `treePickingPhrase` in
  `lib/perennial-harvest.ts`.
- **Printed task summary** (`lib/crop-export-pdf.ts`): the same pick lines per month, via the
  export card's new `treeGroups` prop.
- Tests: pick-line and berry/moringa cases in `tests/perennial-harvest.test.ts`, task-summary case
  in `tests/crop-plan-pdf-build.test.ts`, species count 196 → 200, `tests/calendar-produce.test.ts`,
  and a chosen-crops case in `tests/crop-autosuggest.test.ts`.

### 29 Sep 2026 — Food availability: tree and animal picture trays, month labels, printed page
Rory, looking at the availability chart: "i would prefer icons of fruoit and berrues just like the
others so a 3rd, 4th litle box after staple crops animal products and food forest pruducts etc with
icons", "i dont know what month this is?", and "i want in the crop plan printed a version of the
calendar we have in the app with the veg and other icons".
- **Picture trays** (`app/facilitator/crops/page.tsx`): the food-forest and animal rows are now
  tinted trays of the same art as the veg (`speciesPickerArtworkUrl`, `animalArtUrl`; Lucide
  fallback), one tray per month, replacing the count/Lucide rows. Legend has tinted swatches.
- **Month identity** (`lib/month-axis.ts`): each column knows its calendar year; the first shows a
  **Now** pill with the year, every January shows its year. On the timeline header, the
  availability chart and the line charts; tooltips/aria read e.g. "September 2026 (now)".
- **Printed page** (`lib/crop-export-pdf.ts` section `availability`, in the default export after
  the bed calendar): landscape "What there is to eat: Sep 2026 - Aug 2027" — fresh / stored veg,
  food forest, animal products (empty trays left off, as on screen), a **field space used** row
  (% + bar, red over 100%), January seam, a key naming every picture, and the source notes.
  Pictures come from `lib/pdf-icons.ts` (browser: fetched, drawn at 64 px, embedded once by alias);
  a missing or unreadable picture prints the crop code instead. The export card passes the chart's
  first 12 columns via `lib/crop-export-availability.ts`, honouring the tree/animal switches.
  Quick print stays calendar + tasks and loads no pictures.
- **Not printed:** the plan-cycle value chart (prices move; it stays on screen with its dates).
- **Regional harness** (`scripts/crop-plan-pdf-regions.ts`) now adds a sample food forest and a
  layer coop + tilapia pond with icons from `public/`; all 16 site/water PDFs rebuilt and the
  page checked. Picture cost ~10 KB each (~290 KB for a busy plan).
- Guava, pawpaw and honey have no sourced months yet, so they stay off the chart and the page.
- **Next (PR2):** berries, moringa and tree picking in the monthly plan — done, see the entry above.
- Tests: `tests/print-availability.test.ts` (new), availability cases in `tests/crop-plan-pdf-build.test.ts`.

### 29 Sep 2026 — Crop-plan PDF audited at eight SA sites
- **Harness:** `scripts/crop-plan-pdf-regions.ts` builds the full PDF through the planner's own
  pipeline for KZN Midlands, Durban, Gauteng, Stellenbosch, Tzaneen, Mthatha, Bloemfontein and
  Kimberley, irrigated and rain-fed (NASA POWER climatology in `scripts/fixtures/crop-plan-regions/`).
- **Truth fix:** `fillFirstSeasonGaps` split each year-one bare run by the repeating plan's year-two
  ledger. Only months also bare in year two say "recurs every year"; the rest print as "First-year
  gap only" (cycle crop sown in a month already passed). Test in `tests/staple-crops.test.ts`.
- **Layout:** title wraps to two lines; stat tiles size to their text; page-1 trust panel kept off the
  footer; workload chart unit moved beside its title with 1/2/5 steps; crop-code key filed by colour
  and empty colours dropped; `m²` throughout.
- **Wording:** buying list and field sheet places compact to "Beds 2, 4, 8, 9; Plot 3"; crop names
  keep inner capitals ("true spinach (English spinach)"); covered prep note printed once; long crop
  whitelists counted instead of listed; Aug nursery seedlings not bought on a Sep plan.
- **Next:** fruit/berry icon trays, month-chart year labels, berries + moringa, food-forest rows.

### 29 Sep 2026 — Recommended prices for the last five unpriced catalogue crops
- New price confidence level `'recommended'` (`lib/crop-prices.ts`): the plain average of the
  like-for-like cited prices found, for crops no single source fits. Labelled "Recommended price —
  average of prices found" on the price card, sales log, invoice and planner price editor.
- Parsley R243.64/R20.27, sorghum R32.50/R4.12, bambara R97.37/R37, sweetcorn R74.47/R28.30,
  cowpea R56/R12.50 (retail/wholesale per kg). Quotes + method: `research/crop-sources/_prices-2026-09-29.json`.
- `UNPRICED_CROPS` is down to coriander and true spinach. Test: every recommended price carries
  `pricedAt` and wholesale < retail.

### 28 Sep 2026 — Variety guidance by growing zone; yield benchmarks checked; crop prices
- **Growing zones (`lib/growing-zones.ts`):** the site's own monthly temperature and rain → the
  zone(s) `research/crop-sources/_zones.json` files the variety research under, using the Köppen
  class and koppen-global's frost lines (7 °C / 13 °C coldest month). Where monthly data can't split
  two zones (Highveld/Midlands, Lowveld/coast, BSk steppe, hard frost vs high mountain) it names
  both. No site climate → no zone claimed. Tested against 9 reference places (`tests/growing-zones.test.ts`).
- **Sourced cultivars:** `scripts/build-crop-varieties.mjs` turns the variety dossiers into
  `lib/crop-varieties-data.ts` (28 crops, 105 cultivars). Evidence citing the app itself is dropped,
  and any cultivar left with no outside source; researcher notes ("fetched directly, verbatim") are
  stripped from the source name. `tests/crop-varieties.test.ts` fails if data and dossiers drift.
- **Crop picker → Variety guidance** (`components/crops/VarietyGuidance.tsx`): "Your area" line,
  zone notes, cultivars named for your area, then "Other varieties" with the areas their source
  named; every card links its source with the quote on hover. Catalog advice stays as General guidance.
- **Low benchmarks checked** against a second source (KZN crop guides, ARC, Elsenburg). All three
  follow Table 8's conservative-through-likely convention like every other row, so planning points
  stay. Green beans range upper 0.8 → 1.0 kg/m² (ARC "Estimated yield: 100 kg/100m2"); broccoli
  0.8 → 0.9 (KZN Cole Crops "6 to 9 tons per hectare"); peas left (KZN Green Peas average 5–6 t/ha).
- **Prices for batch-1 crops** (`lib/crop-prices.ts`, quotes in `research/crop-sources/_prices-2026-09-28.json`):
  gem squash, brinjal, baby marrow both sides real (Joburg Market + shop listing); cauliflower,
  spanspek, soybean, sunflower have real wholesale (Joburg Market / SAFEX) with retail derived by
  the file's ~38% ratio, because the only shop listings were a different product (florets, cooked
  soya, snack seed). Still excluded, with reasons: parsley (pack vs market 21x apart), sorghum,
  bambara, sweetcorn (two market codes 18x apart), cowpea. `PRICE_SNAPSHOT_MONTHS` now reads
  "July, August and September 2026".

### 28 Sep 2026 — Artwork: Codex batches merged (20 crops, 15 animals, 5 fruit trees)
- **Crop Batch 2 (#779):** the 20 flat placeholders in `public/crop-art/` replaced with finished
  256² art; the whole crop library is 3.79 MB, under the 4 MB gate in `tests/element-art.test.ts`.
- **Animals + trees (#774):** 15 animal pictures in `public/animal-art/`, wired in `lib/animal-art.ts`
  (the Animals on your map chips and picked-animal picture); pickers + plan crowns for sour fig,
  Transvaal milkplum, African mangosteen, jacket plum and spiny monkey orange, plus a guava picker.
- **Crown size fix:** the 5 new plan crowns shipped as 1024² RGBA at ~1.8 MB each (9 MB together).
  Re-saved as 768² 256-colour palette PNGs, 242–258 KB each, the same format and range as the rest
  of `reference-blueprint/` (all palette, max 262 KB). No visible difference at map scale.
- Both briefs marked done, and ANIMAL-TREE-ART-BRIEF now asks for palette crowns ≤ 270 KB.

### 28 Sep 2026 — Artwork: 17 fruit trees linked, Codex brief for trees and animals
- **17 harvest-table fruit trees linked to art they already had** (`lib/species-art.ts`): pawpaw,
  num-num/Natal plum, lemon, naartjie, Kei apple, fig, wild plum, litchi, macadamia, mango, avocado,
  peach, Japanese plum, pomegranate, marula, waterberry, plus guava's plan crown. The Plant Catalog
  (opened from Other Tree) showed them with no picture, and on the plan they drew the generic
  orchard crown because they are saved as `tree_other` + `speciesId`.
- **Animal picture slot:** `lib/animal-art.ts` (empty map) + `AnimalEnterprisesCard` shows a 16 px
  chip image and a 56–72 px picture when an entry exists; Lucide icon otherwise.
  `tests/animal-enterprises.test.ts` guards id ↔ file ↔ 256×256 transparent corners, and orphans.
- **`docs/ANIMAL-TREE-ART-BRIEF.md`:** Codex brief + paste-ready prompt. Part A: 5 trees with no art
  anywhere (sour fig, Transvaal milkplum, African mangosteen, jacket plum, spiny monkey orange;
  picker 192² + plan 1024²) and a guava picker. Part B: 15 animal pictures (256²).
- **`docs/CROP-ART-BRIEF.md`:** status now says the 20 Batch 2 files are placeholders, and tells
  Codex to branch from current `main` (a stale clone read the old 1024² rule).
- **Left:** all Codex drawing (20 crops, 11 tree files, 15 animals). *Done — see the entry above.*

### 28 Sep 2026 — Animal enterprises, round 2 (Phase C: cattle, sheep, pigs, fish; month search)
- **New enterprises (15 in all):** beef cattle (Nguni/crossbred, communal veld), dairy cow, meat
  sheep, wool sheep, pigs (small-scale sow herd) and tilapia (Mozambique tilapia, small pond or
  tank). Dossiers in `research/animal-sources/`; same build script and drift test.
- **Housing, not animal:** choices are now keyed by the structure (`HousingKind`). A kraal holds
  cattle, sheep or goats, so it offers every enterprise of those three ("What is the kraal for?");
  a small pond asks "Keeping fish in it?"; a pig pen offers pigs. `cleanChoices` drops a saved
  choice that no longer fits its housing. Product `fish` (Fish icon, "Harvest per fish") and
  `wool` (Scissors) are new. Wool is not food: `isFoodProduct` keeps it off the Availability chart
  and the Year of food, and the card says so.
- **Months now on the chart:** laying hens, dairy cows ("processors require a year-round even milk
  flow", Elsenburg Dairy Farming Handbook) and tilapia (year-round harvest, North-Eastern SA).
- **Month search for honey, goat milk, rabbits, ducks, broilers and village hens:** each was
  searched again; no source states the months the product is taken for the system recorded, so
  they stay empty with a "Round 2" gaps line. Withdrawn in editor review:
  - Honey: two Johannsmeier (Strelitzia 37) months described one plant's nectar flow, not a
    region's honey season.
  - Boer goat meat: kidding months plus an assumed weaning age (the kidding pattern stays as text).
  - Beef: the "months" were a paper's birth-season classes; age at first calving is not a first
    weaned calf; a holding-pen floor minimum is not housing space.
  - Dairy: shade m² moved to a welfare point; a dead KZN URL replaced; wrong ± figures in a
    productive-life quote replaced by the paper's own sentence; table notes corrected.
  - PMC quotes were checked against the Europe PMC full text (PMC serves scripts a reCAPTCHA).
- **Tests:** `tests/animal-enterprises.test.ts` adds kraal/pond/pig housing, choice-fits-housing
  and wool-never-food cases. 14 `npm test` failures in this container (auth transition, course
  deck, product tour, public SSR, venue location, saved reports, paired slides) fail identically
  on `origin/main` here — loader/environment, not this change.

### 28 Sep 2026 — Year of food (Phase D: one calendar, gap-fill sowings)
- **New `lib/year-of-food.ts`:** `buildYearOfFood` folds the Availability chart's OWN first 12
  slots (bed crops, fruit trees, animals) into one verdict per month: fresh (anything fresh from any
  source), stored-only, or empty. It recomputes nothing, so it cannot disagree with the chart, and
  it follows the chart's year mode and the Orchard/Animals switches. A "veg gap" month has no fresh
  vegetable even if fruit or eggs cover it.
- **Gap-fill sowings (`suggestGapFills`):** for each veg-gap month (hungry months first), up to 3
  sowings that pick fresh in it. Only crops the auto-planner trusts (`hasAutomaticPlanningBasis`,
  yield > 0, so no soil covers; not maize), sown in the region's window, inside the site climate gate
  auto-suggest uses (heat always, rain when rain-fed), on a veg bed (not a staple plot) with room
  from the printed field-entry month to the end of picking. The share offered is the largest picker
  share still free; vines only get a whole bed. Fresh months use `buildFoodAvailability`'s own
  arithmetic, and the test adds each suggestion as a planting and checks the chart shows it.
  When no bed has room, the card names the crops that could have picked and says so.
- **Crop plan (`/facilitator/crops`):** "Year of food" card under the chart: 12 month cells with
  Lucide pips (fresh veg, fruit, eggs/milk/meat/honey, in store), empty months dashed in ochre, a
  one-line summary ("Something fresh in 9 of 12 months; nothing fresh in Jun–Aug") and an
  availability-not-sufficiency caveat. "Plan it" opens the normal crop picker prefilled with bed,
  crop, sow month and share, so the overlap warning and window note still show before anything is
  added. Tests: `tests/year-of-food.test.ts`.

### 28 Sep 2026 — Animal enterprises (Phase C: chickens, goats, bees, rabbits, ducks)
- **New table `lib/animal-enterprises.ts`:** per ENTERPRISE, not per m². Each of 9 enterprises
  (layer, broiler and village chickens; dairy, meat and indigenous goats; honeybees; meat rabbits;
  meat ducks) holds output per animal, production months, first product, productive life, feed,
  water, space, welfare points and legal points (avian flu and FMD as controlled diseases, movement
  restrictions, beekeeper registration, animal ID marks, abattoir rule and its own-use exemption).
  - Generated from `research/animal-sources/<enterpriseId>.json` by
    `node scripts/build-animal-enterprises.mjs`; `tests/animal-enterprises.test.ts` fails on drift,
    a missing quote/URL, a banned host or animals reaching the bed-yield modules.
- **Quote check:** every quote was re-fetched and matched. Withdrawn or restated in review, each with
  a `gaps` line starting "Editor review 2026-09-28":
  - Derived figures: layer eggs/year and laying life (two documents stitched), broiler feed/day
    (cumulative ÷ 35) and space (kg/m² ÷ a weight from elsewhere; kept as a welfare point), rabbit
    water (g/kg × assumed weight), goat-milk litres (assumed density; restored to kg/305-day
    lactation), indigenous-goat months (kidding + assumed weaning; kept as `unverifiedMonths`).
  - Wrong fit: rabbit feed was a buck figure; experimental conditions read as welfare rules (rabbit,
    duck); village-chicken "seasonal pattern" was a nutrition finding.
  - Legal points citing only the Animal Diseases Act's general definition were dropped or re-cited
    to a statement that names the disease (SAnews for FMD; the controlled-disease list for NAI).
  - Breed egg counts from a paper with no fetchable text were removed even from notes.
- **Crop plan (`/facilitator/crops`):** "Animals on your map" card groups coops, pens, hives,
  hutches and duck ponds by animal. The farmer picks what they are for (per canvas site); nothing
  is multiplied by structure count (a coop is housing, not a head count). Laying hens' sourced
  months add a row to the Availability chart; the Animals switch only appears for kinds that can
  put something on it. Small amounts keep 2 significant figures (0.083 m², not 0.1).
- **Gaps:** no sourced months yet for honey, goat milk, rabbits, ducks, broilers or village hens,
  so only laying hens reach the chart. Kraal and pig pen are not guessed at.
- **Test script fix:** a merge (4d003ea, PR #762) left `npm test` as
  `node --import ./tests/tshivenda-…test.ts …` — no `register-alias`, no `--test` — so CI ran two
  files and PRs #763/#764 went untested. Restored in b9e2d2f; the full suite passes in CI again.

### 28 Sep 2026 — Perennial harvest layer (Phase B: fruit trees)
- **New table `lib/perennial-harvest.ts`:** for each tree species it holds harvest months by SA
  region, years to first crop and to full bearing, kg per mature tree, chill units and pollination.
  Every value carries a verbatim quote, URL and page. Anything no approved source states is `null`.
  - The data file `lib/perennial-harvest-data.ts` is GENERATED from
    `research/perennial-sources/<speciesId>.json` by `node scripts/build-perennial-harvest.mjs`.
  - `tests/perennial-harvest.test.ts` fails if the file drifts from the dossiers, or if a citation
    lacks a quote/URL or uses a banned host.
- **Quote check:** every quote was fetched and matched against its source (pypdf for PDFs); table
  layouts were checked by hand. Values withdrawn in review, each with a `gaps` line in its dossier:
  - Harpephyllum: its "harvest" months were really its flowering months.
  - Carissa: first-crop and pollination came from Morton/Purdue, which is not an approved tier.
  - Lemon, mandarin and litchi: the pollination quote did not say what the value claimed.
  - Garcinia: first crop came from a secondary source, and its only window is Kenyan.
  - Pappea: 21.85 kg was seed weight for oil, not fruit.
  - Carpobrotus: pollination came from the GISD compilation, not the primary paper.
  - Plum: window cut to the February that its quote supports.
  - Mango: pollination came from a table of flower visitors, which does not say whether a second
    cultivar is needed. Papaya pollination is also blank: it depends on the cultivar and the plant.
  - Pecan: 20 kg was an industry average across orchards of every age, not a mature-tree yield.
  - Banana: first-crop age was inferred from a fertiliser calendar. The all-year window is blank
    because no quoted SA source says the harvest runs all year.
  - Macadamia: changed to partly self-fertile. SAMAC measured 10–97% outcrossing, and cross-pollination
    raises yield by about half.
  - Papaya first crop and guava bearing/yield come from FAO and ICRAF, not SA sources. Their notes
    say so. A harvest window is never taken from a non-SA source.
- **Kei apple duplicate fixed:** `dovyalis-caffra` merged into `dovyalis-afra`. `lib/species-aliases.ts`
  maps the retired id, so saved designs keep working.
- **Crop plan → Availability** gets a tree row for fruit trees placed on the Studio map:
  - Months are the SA-wide sourced span, labelled as such. Trees placed from the palette (Mango
    Tree…) map to a species via `ELEMENT_SPECIES`; ambiguous elements (Citrus, Plum) are not guessed.
  - "From today" counts only existing trees; an established year adds proposed ones.
  - It uses the same orchard switch as Money/Records (`lib/produce-scope.ts`). Trees never enter a
    per-m² figure, and the bed-yield modules may not import the table (a test enforces this).
- **Design species picker** shows "Picking … in SA sources · first crop … yrs · about … kg a mature
  tree" when the table has the data.
- **Gaps:** most indigenous species have months only — no SA source gives their yield or bearing
  age. Chill units exist for peach and plum only. Banana, papaya and guava have no SA window yet
  (ARC-ITSC and DALRRD pages were unreachable). Regional window matching (the farm's own window
  rather than the SA span) is next.

### 28 Sep 2026 — Crop catalog batch 1: 20 new crops + planner fixes
- **Added (primary sources, cited per value in `lib/crop-catalog.ts`):** amaranth, cauliflower,
  parsley, sorghum, soybean, brinjal, gem squash, baby marrow, spanspek, sweetcorn, cowpea,
  bambara groundnut, sunflower, radish, mung bean, spider plant, African nightshade, sunn hemp,
  medic, fodder radish. Research dossiers in `research/crop-sources/<key>.json`.
- **Judgement calls:** cowpea has no yield (only SA trial: 60.7 vs 1184 kg/ha at two sites) so it
  is manual-add only; bambara uses the UKZN 2023 genotype-mean range 0.16–0.96 t/ha, planning at the
  low end; sorghum from national production/area; parsley from the conservative KZN 2 t/ha.
- **Cover crops** sunn hemp, medic and fodder radish carry `timingVerified: false` (termination days
  are proxies), so they are recorded but not auto-scheduled. Only oats/broad beans stay as winter cover.
- **Not added:** Chinese cabbage, leeks, cassava — no primary SA source for the missing values.
- **Prices:** 12 new crops are in `UNPRICED_CROPS` (no price research yet); plan value skips them.
- **Planner fixes the bigger catalog exposed:** (1) a sowing that would leave a bed with no crop able
  to reach a bare winter month is tried last (winter route guard); (2) few-big follow-on sowings
  may use any shared bed, so a large crop can't strand a second sowing; (3) the sowing-cadence pass
  prefers the candidate that fills a fresh-harvest month no bed covers yet.
- **Art:** 20 placeholder PNGs in `public/crop-art/`; the Codex brief is `docs/CROP-ART-BRIEF.md` (batch 2).

### 27 Sep 2026 — Crop-plan audit, phase 3: the nine open items
- **Few big harvests:** each crop now gets its next big sowing once its last harvest ends (follow-on
  rounds), instead of one cohort and bare ground. Reference farm family/few-big 88 → 254 kg,
  bed-months 29.6% → 80.3%; nine-bed August plan 53.7% → 70.4%. Commercial few-big unchanged
  (rotation blocks the same-crop repeat).
- **Heat check:** `lib/crop-climate-gate.ts` holds FAO ECOCROP TOPMX/TMAX for all 29 schedulable crops.
  With the site's NASA POWER monthly means (`SiteClimate.monthlyTempC`, new) a sowing month is
  skipped when the crop would grow through a month above TMAX (ECOCROP suitability 0); months
  above TOPMX get a basis note. No site temperatures = regional calendar unchanged.
- **Rain-fed mode:** irrigation off no longer means "no plan" when the site's own rain, temperature
  and latitude are known: a cohort is sown only if every field month has P ≥ 0.5 PET (FAO AEZ
  growing-period rule; Thornthwaite PET). Still refuses without site climate.
- **Frost-free calendar:** `FROST_FREE_CALENDAR_CITED` lists the 8 crops whose 'all-year' months come
  from KZN DARD Table 6 hot-area column (carrots corrected to Feb–Sep); a frost-free plan names every
  other crop it uses as unchecked. The other 21 crops still need a source (none found; .gov.za blocked).
- **Heat-season crops (cowpea, amaranth, okra):** NOT added — no days-to-harvest for cowpea, no yield
  for amaranth, okra only from secondary sites; the DAFF PDFs could not be fetched here.
- UI: review screen shows each crop's bed; Simple mode shows the double-booking card; `/calendar`
  follows the saved plan's climate column; the Task Planner includes beds on every saved site.

### 27 Sep 2026 — Crop-plan audit, phase 2: existing crops + frost gate
- **Whole-year plan double-booking (critical):** the ideal-year sweep aged already-growing crops from
  each synthetic anchor, so the winning plan was stacked on top of them (73% of 1,152 probe inputs;
  Simple mode showed no conflict). Occupancy/BedRotation now age them from realNow and, in synthetic
  frames, block their remaining calendar months. Regression test fails on the old engine.
- **Frost gate (critical):** new `frostTender` flag on 14 warm-season crops; the hard-frost 'summer'
  column no longer offers months that leave them in the field through May–Aug frost before first
  harvest (potato Feb/Mar, maize/pumpkin/sweet potato Dec, dry beans Jan, groundnuts Nov, amadumbe).
  Invariant: `tests/crop-catalog-frost.test.ts`.
- Tried and reverted: a commercial focus-set chooser scored by one-bed rotation — after #749 it lost
  17% on the audit case because the engine gives each focus crop its own beds.
- Still open: heat gating from monthly temperatures (needs sourced per-crop limits), a sourced
  frost-free column, rain-fed mode, "few big harvests" packing, heat-season crops, review screen
  showing beds, Simple-mode conflict card, `/calendar` following the plan's climate, plans for
  non-main sites in the Task Planner.

### 27 Sep 2026 — Crop-plan audit: climate calendar + rotation packing
- Multi-agent audit of every crop-planning feature, plus a line-by-line fact-check of one engine
  plan for the Mkuze demo farm against two independent expert plans.
- **Climate (critical):** `rainPatternFor` (lib/koppen-global.ts) now chooses the calendar column by
  frost class first (coldest-month mean < 7 / < 11 / >= 13 °C), rain second. Before, the coldest
  sites (< 4 °C) got the KZN *light*-frost calendar, hard-frost bimodal Karoo sites got the
  frost-free column, and frost-free lowveld/coast (the demo farm, Durban, Mbombela) could only get
  the hard-frost Highveld windows. Arid sites stay on the frost column. Warm-area plans now carry a
  basis note to confirm months with an extension officer outside KZN.
- **Rotation (critical):** a second, staggered sowing of one crop was refused because its partner's
  next-year copy read as a same-family repeat, leaving beds mostly empty under the default settings.
  Staggered cohorts joined in the current cycle now carry their annual copies (one course, as the
  code's own comment says). The test oracle now also draws year −1, matching the engine.
- Measured: Mkuze demo farm 154 → 191 kg/yr, bed-months 91.4% → 92.7%, winter tomatoes appear;
  reference farm commercial/steady 324 → 365 kg, bed use 58% → 66%.
- Still open from the audit (see the PR): temperature/heat gating, a sourced frost-free column,
  kg-per-bed-month ranking, "few big harvests" packing, rain-fed mode, existing-crop double-booking in
  the whole-year plan, potato/frost-tail windows, missing heat-season crops.

### 2026-09-29 (Permaculture Manual — Sesotho uses moroho; nasturtium line)
- Sesotho chapters now say *moroho* (Sesotho for leafy greens, as in *papa le moroho*) instead of
  *morogo*, the Setswana/Sepedi form. English keeps *morogo*. Decision noted in
  `research/manual/glossary-st.md`. Fluent-speaker review of the translations is deferred for now.
- Chapter 10 trap crops: the unsupported "we have seen nasturtiums…" line replaced with general
  advice (nasturtiums draw aphids, especially black aphids), in all five languages.

### 2026-09-27 (Permaculture Manual — second edition in Rory's voice)
- **What:** the English manual rewritten in Rory's teaching voice (`research/manual/VOICE.md`,
  from his Style Engine) and cut from 55,370 to 37,858 words (print: 257 → 214 A4 pages). Every
  chapter opens with WHY, lists what the reader will be able to do, has one hands-on "Try it",
  a short Key points list and a forward-looking close. SA words throughout (morogo, mielies,
  veld, pikmatok). Brief: `research/manual/REWRITE.md`.
- **Warnings and law out of the chapters:** Safety boxes, legal sections and "consult / check
  with" lines removed (callouts 94 → 13, none warnings); a handful of life-safety facts stay as
  plain steps. Everything else is one paragraph in the new **chapter 13 Notes and references**,
  with 278 references grouped by chapter.
- **Accuracy:** second fact-check pass appended to every `research/manual/factcheck/*.md`;
  overlap check against the source handbook found no copied runs.
- **Translations:** isiZulu, Sesotho, Tshivenḓa and Xitsonga re-translated from the new English
  (`research/manual/RETRANSLATE.md`); Xitsonga stays paused. Machine drafts for fluent review.
- **Pictures:** 41 re-mapped to new sections; 8 captions reworded; `CODEX-IMAGE-BRIEF.md` §4.D has
  prompts to replace every photo with one uniform AI-illustrated set.
- **For Rory:** `research/manual/FIELD-STORIES.md` — 52 story slots; nothing invented.

### 27 Sep 2026 — Monthly AI allowance + value models
- New `lib/ai-budget.ts` + `lib/metered-ai.ts`: every Claude call in app/api goes through one metered
  client. €3/person/month (env `AI_MONTHLY_CAP_EUR`), priced from real usage, ledger in Firestore
  `ai_spend` (server-only rule). Over the cap → cheap model until the 1st, never blocked.
- Guests: €0.05/day per hashed IP (`AI_GUEST_DAILY_EUR`) on the cheap model, then a sign-in reply (429).
- No Firestore Admin credentials → 1.5 s-capped read, then an in-memory per-instance ledger (partial,
  like the rate limiter). Account page shows "AI this month" via `/api/ai-allowance`.
- Models: main → Sonnet 5 ($2/$10), deep → Opus 5 (same price as before); thinking kept off and
  max_tokens ×1.3 for the new tokenizer. Gemini 3.8 Flash from the research is NOT wired yet —
  needs a GEMINI_API_KEY and the side-by-side comparison the research asks for.

### 26 Sep 2026 — Wave 9 (final): last theme leftovers (#706)
- Community, community profile, Contact, PopiaConsent, Onboarding and login now paint with theme
  tokens instead of hardcoded forest/paper/error hexes (Google logo colours kept).
- New guard `tests/theme-leftovers.test.ts` stops these files regressing. Closes the audit backlog.

### 26 Sep 2026 — Wave 8: mentor screens i18n + translator hand-off (#699)
- FieldTeams, MemberAccessPreview and PeoplePanel route visible text through t() (new MENTOR_ENGLISH_PENDING; FieldTeams' inline isiZulu drafts moved to lib/locales/zu.ts). Exported funder report text stays English on purpose.
- `npm run i18n:pending` writes docs/translation/pending-isizulu.csv (group,key,english,isizulu) for a translator; README explains how to bring it back into zu.ts. Test fails if the CSV is stale.
- Guard: tests/mentor-screens-i18n.test.ts, tests/pending-translations-csv.test.ts.

### 2026-09-26 (Permaculture Manual — pictures, printable book, English terms + glossary)
- **Pictures:** 73 of the original handbook photos/diagrams (`public/manual/figures/<id>.jpg`,
  10 MB, ≤1400px) placed per section via `content/manual/figures.json` (captions in all five
  languages). Two or more in a section render as a grid (1 column on phones, 2 from 560px and in
  print). 22 more slots (replacements for photos with private faces, sesbania or third-party
  art, plus captioned figures the handbook never had as images) are listed but hidden until a
  file with that name exists — ChatGPT prompts in `research/manual/COVER-PROMPTS.md`. Picture
  inventory and verdicts: `research/manual/FIGURES.md`. Tests check ids, sections, file size
  and that the JPEG dimensions match the JSON.
- **Book:** `/manual/<lang>/book` — cover, imprint, contents, a title page per chapter, A4 print
  CSS. Cover/chapter art is optional, text-free, and dropped in `public/manual/covers/`
  (`cover.jpg`, `chapter-00.jpg` … `chapter-12.jpg`); titles are overlaid per language.
  `node scripts/build-manual-pdfs.mjs [baseUrl] [lang…]` prints the PDFs to `output/manual/`.
- **English terms:** the 67 technical words (swale, berm, compost, mulch, food forest …) stay in
  English in zu/st/ve/ts with the language's prefix and a short gloss on first use per chapter;
  new chapter 12 Glossary in all five languages. (Xitsonga stays on disk but is off the public
  routes since #697 paused it; the PDF script defaults to the four public languages.) Record per language in `glossary-<lang>.md`.
- **Fix:** the manual routes check `public/` at build time, which made file tracing pack all of
  `public/` into their serverless function (540 MB). `outputFileTracingExcludes` in
  `next.config.mjs` keeps it out.
- **Still to check before publishing:** sources of 5 images and consent for 4 (listed in
  FIGURES.md); all non-English text is a machine draft for fluent-speaker review.

### 2026-09-26 (swarm wave 7 — last audit leftovers; three unused pages deleted)
- **Deleted (owner-approved):** the orphaned `/survey` Garden Survey wizard (+ `lib/survey-pdf.ts`),
  `components/ReportDocView.tsx`, and the unlinked `/design-studio-2` scaffold (+ `components/design-studio-2/`,
  `lib/design-studio-2-storage.ts`, `lib/preview-export.ts`) with their tests. `lib/design-studio-shell.ts`
  and `lib/report-doc.ts` stay (still read by live modules/tests). ~4,600 lines removed.
- **Dead code (#693):** duplicate `app/student/guides/{invoices,sales}` pages removed (`[guide]` serves them);
  the `'pro'` DesignMode and ~86 always-true `guided ?` ternaries in `DesignPalette.tsx` folded (output unchanged).
- **Photos + labels (#694):** `MyRecords.tsx` produce photos go through `resizeFileForUpload`; SpeciesPicker
  section names, size line and use tags go through `t()` (English pending, no isiZulu coined); DesignPrint's
  on-screen sheet picker uses `labelKey` while the printed title stays English by design (existing test).
  `FieldTeams.tsx` left English — the whole mentor screen has no i18n yet; full localisation is a separate job.
- **Tests:** `species-picker-i18n`, `design-print-sheet-labels`; `profile-photo-resize` covers MyRecords.

### 2026-09-26 (Permaculture Manual — fact-checked edition in five languages; locale clean-up)
- **What:** Rory's *RVCC Permaculture Gardening Handbook* (UNDP / Government of Lesotho project,
  2020–21) is now the in-app **Permaculture Manual** at `/manual`, listed under Farm tools and in
  Simple mode. It has 12 chapters (~53,500 English words) plus machine-draft isiZulu, Sesotho,
  Tshivenḓa and Xitsonga for every chapter.
- **English edition:** every chapter is fact-checked and rewritten for SA smallholders. The
  per-chapter change logs with sources are in `research/manual/factcheck/`. The main corrections:
  - NEMBA invasives removed (beefwood, American elder, guava, granadilla, *Tithonia*…).
  - Law added or corrected: National Water Act, Veld and Forest Fire Act, CARA slope limits
    (replacing the source's 18%), beekeeper registration and AFB, Newcastle disease, swill feeding.
  - The roof-harvest arithmetic is fixed.
  - Safety boxes added: tobacco spray, biogas, CO, wonder bag, manure, greywater.
  - Succession no longer implies grassland or fynbos "should" become forest.
  - Figures are not yet in the reader; their captions are logged per chapter so they can be added.
- **Reader:** `content/manual/<lang>/<slug>.md` is read at build time, so every chapter is a static
  page (`app/manual/[lang]/[slug]`).
  - `lib/manual.ts` is a strict Markdown-subset parser with no HTML passthrough.
  - A machine-translation notice and English fallback appear per chapter, with a language switch.
  - `tests/manual.test.ts` checks that every translation keeps the English structure (headings,
    list items, Safety boxes, table rows).
- **Translations:** the brief and fixed rules are in `research/manual/STYLE.md` and `TRANSLATE.md`.
  The glossaries are `research/manual/glossary-{zu,st,ve,ts}.md`, with uncertain terms marked
  "(check)". Callout labels are one per meaning in each language.
- **Locale clean-up** (glossary-driven; each glossary ends with an "App clean-up log"):
  - Xitsonga: ~180 strings in `ts.ts` were siSwati/isiZulu/Sepedi.
  - Tshivenḓa: ~185 strings in `ve.ts` were not Tshivenḓa, and roles were mistranslated.
  - Sesotho: Lesotho → SA orthography, and compost said "dung" / "manure that kills".
  - isiZulu: compost, frost, sector and contour terms made consistent.
  - All four: menu label for the manual.
- **Checks:** tsc clean and `next build` green. The full `npm test` has 9 failures that are
  identical on `main` (auth transition/guest migration, course-deck playback, product-tour,
  public-route-ssr, venue-location, saved-reports relabel).
- **Needs Rory / people:**
  - Fluent-speaker review of all four languages.
  - Confirm that the ACT (2014) "used with permission" and the UNDP/RVCC origin cover an app
    edition.
  - Check the "not found as listed" NEMBA rows against the gazette PDF (the proxy blocked it).
### 2026-09-26 (swarm wave 6b — Farm Finance in isiZulu)
- **Finance track retry (PR #689).** New `lib/course-finance-i18n.ts` holds source-paired isiZulu
  drafts for the Farm Finance course: `financeZu(map, id, liveEnglish)` only returns the draft while
  its stored English still equals the live English, so an edited lesson falls back to English
  instead of showing a stale translation. `components/studies/FinanceZu.tsx` renders the drafts plus
  a "draft translation" badge/notice; wired into the course page, lesson reader, project worksheet,
  CourseSyllabus (title/blurb widened to ReactNode) and the mentor course list.
- **Due-date months via Intl.** `lib/course-assignments.ts` `monthAbbrev` now formats with
  `Intl.DateTimeFormat`, checking `supportedLocalesOf` first — an unsupported tag (ss/nr/ve/ts)
  would otherwise fall back to the *browser's* locale (German months in Vienna), so it pins English.
- Tests: new `tests/course-finance-zu.test.ts`; `tests/student-simple.test.ts` pins the
  supported-locale check.

### 2026-09-26 (gate deleted)
- **Rory: "yes delete the gate".** Removed `app/gate/page.tsx`, `app/api/gate/route.ts` and
  `tests/gate-guard.test.ts`; dropped `/gate` from ChatWidget's exclusions and `NO_FLOATING_BACK`,
  and pointed the tests that anchored on it at `/login`. `middleware.ts` notes where to restore
  it from git history. The optional `SITE_PASSWORD` env var is now unused (left in Vercel — not
  touched from here).

### 2026-09-26 (swarm wave 6 — lighter pages, less clutter, tap targets, API guard)
- **Merged (four swarm PRs, one integration PR):** Perf (#668: profile photos on /account and
  ProfileSheet go through `resizeFileForUpload` before upload; the lazy release-notes import,
  weather cache and Portfolio next/link were already done). Clutter (#669: `isStaffRole` in
  `lib/app-level-core.ts`; the Study readiness badge and the offline quality picker are staff-only
  and hidden in Simple; /calendar left the Simple nav). Tap targets (#673: EvidenceSheet photo and
  document remove buttons reach 44×44; the other four items were already fixed). API guard (#670).
- **API guard finding:** the open map routes (contours, site-features, location-data) were
  ALREADY rate-limited per IP by `guardPaidApiRequest` (data 20/hr anon, 300/hr signed in), and
  the contour cache key already snaps to the DEM grid. The only real gap was `/api/gate`: it now
  allows 10 attempts per 10 minutes per IP and compares with `crypto.timingSafeEqual`. Deleting
  the unused gate was blocked by the session safeguard, so it was hardened instead —
  `middleware.ts` routes nothing to /gate; deleting it is Rory's call.
- **Not touched:** MyRecords produce photos still upload unresized (next wave).
- **Farm Finance isiZulu track:** hit the session limit without pushing; relaunched, lands as 6b.
- **Checks:** tsc clean; the four new tests plus student-simple, nav-simple-track, app-level,
  nav-menu-links, test-registry/manifest and theme-token gates pass (53/53).
- **Cost:** about $20 of Sonnet so far (including the failed first isiZulu run).

### 2026-09-26 (swarm wave 5 — audit leftovers: language honesty, icons, crop planner theme)
- **Owner decisions (Rory, 26 Sep):** no extra sign-in — the public map data routes (contours,
  site-features, location-data) stay open behind their existing rate limits and REQUIRE_API_AUTH
  stays off for them. Mentors keep defaulting to All tools. A partly-translated-language notice
  is approved.
- **Merged (four swarm PRs, one integration PR):** Language notice (#662: `lib/lang-coverage.ts`
  counts keys a locale renders differently from English; under 95% shows "Partly in English"
  in the Settings picker plus a note for the active language; Xitsonga keeps its draft notice).
  Design Studio isiZulu (#660: resume-gave-up banner in isiZulu, print-preview failures logged;
  the other audit items were already fixed). Crop planner theme (#661: planner chrome on theme
  tokens, clamp() headings, ochre text via --gold-dim, white-on-ochre banner #9A6018). Icons
  (#663: Design Studio chrome, line tools, canvas handles and facilitator print page picker on
  Lucide; unreachable ProWizard removed — `designMode` is the constant 'guided').
- **Integrator fix:** SectorSummary, TankCalculator and the Glossy saved-maps header paint the
  fixed PAPER constant in every theme, so their ochre text stays #7A4408 (dark mode's --gold-dim
  is ~2.6:1 on it); the crop-plan month count now reads --color-forest-800 on the themed card.
- **Dead taps track:** nothing to change — all six items were already fixed on main (spot-checked
  the facilitator print disable, /assessments BackButton and the sign-up auth-code map).
- **Checks:** tsc clean; the five new tests plus design-simple, theme-token, facilitator-print and
  release-notes gates pass locally.
- **Cost:** about $34 of Sonnet across the five tracks.

### 2026-09-25 (swarm wave 4 — Simple mode for the rest of the app)
- **Merged (six swarm PRs, one integration PR):** Design Studio Preview & Export (#644: Simple
  keeps choose-a-sheet and Finish as step 2; underlay, plant labels, style, AI layers, All sheets
  and the saved-maps rail stay in All tools). Farm map (#641: Simple keeps finding land, boundary
  tracing, a two-item Add (tree, tank), basemap switch and locate-me; contours, terrain/3D, HD
  imagery, the edit-engine picker, printing, elevation and Labels are All tools only — Simple
  always uses the big-handle editor without touching the stored preference). Community board,
  messages and profiles (#642, with more isiZulu). Crop plan + Prices (#643). Lima Vision + Field
  Journal (#640). Account + survey answering (#639). Each track added a source-level test.
- **Checks:** tsc clean; the six new tests plus design-simple, app-level, theme-token and
  release-notes gates pass locally; no new hex or emoji in the convention scan.
- **Cost:** about $31 of Sonnet across the six tracks (~20 min each).

### 2026-09-25 (swarm wave 2b/3 — money charts dark, Exchange/Study polish, staff theme, lighter notes)
- **Merged (four swarm PRs, one integration PR):** money charts (#619: CashflowChart,
  FinanceGraphs, AreaReturnCards, ComingUpHarvests on theme tokens; sample-mode pending invoice
  links now live in the in-memory sandbox, never real storage). Exchange & Study (#616: numbers
  shown once, "How the exchange works" collapsed in Simple, one back control, named course links
  in Study Simple). Staff theme (#618: Mentor / Surveys / Funder + two map-page hairlines on theme
  tokens). Report + notes (#617: the Köppen/BRU technical footnote hidden in Simple and put
  through tr() in All tools; PWAUpdateNotifier and UpdateGuide import lib/release-notes lazily, so
  the 2,500-line changelog leaves the shared layout bundle).
- **Integrator fix:** UpdateGuide's lazy import gets a quiet catch for an offline tap.
- **Ops:** the swarm hit the account's five-hour usage limit at ~07:00 and the container restart
  held work until 11:30; the two stalled tracks were relaunched and all four finished in ~25 min
  (about $26 of Sonnet in total). A parallel translation stream (isiZulu / Sesotho / Xitsonga
  drafts) merged ~24 PRs to main meanwhile; integrations merge main in and keep both sides.
- **Still open:** Design Studio surfaces on theme tokens (design-08) and its emoji element
  catalogue (design-02); dead routes (/survey, /gate, /design-studio-2); the owner decisions
  listed under wave 1b (public data routes vs REQUIRE_API_AUTH, mentors' default level).

### 2026-09-25 (swarm wave 1b — Design Studio + People screens in Simple, dark-mode fixes)
- **Merged (four swarm PRs, one integration PR):** Design Studio Simple (#585: curated element
  palette with Show all, one top Lima tip, guided base-photo line-up, Print → one "Save my plan" +
  Share; Layers / workspace layouts / multi-select / align stay in All tools; live-preview errors
  now shown with a retry; ochre text → #7A4408 on the studio's fixed light surface). People +
  Atlas (#582: Contact / Community / map popup isiZulu, Field Journal fonts, dark-mode tokens on
  Community / Contact / Atlas / Example, board and profile photos resized to 1200px before upload,
  Simple for Contact / profile crops / Feedback, `/api/location-data` rate-limited). First-run
  Onboarding + POPIA consent follow the theme (#586). Records polish (#587: 44px edit/delete,
  isiZulu lender-export strings, theme reds/ambers). Crop planner (#588: `/facilitator/crops`
  surfaces, text and borders on theme tokens; clamp() type for headings, month labels, beds and
  the R/m² figure, so desktop is no longer phone-sized).
- **Integrator fix:** the POPIA step-2 button put white 15px type on #C07A1E (3.5:1); now
  #9A6018 (5.2:1), per the ochre rule.
- **Open, for the owner:** `/api/contours`, `/api/site-features` and now `/api/location-data`
  sit behind `guardPaidApiRequest`, so with REQUIRE_API_AUTH=1 they would refuse signed-out
  callers: guests drawing a farm would lose contours / OSM features / climate, and the public
  Atlas would stop answering. Decide alongside the REQUIRE_API_AUTH switch (a public-data guard
  that stays rate-limited but never requires sign-in is one option).
- **Still running:** money-chart dark mode (relaunched as `swarm/money-charts-dark-v2`), Exchange
  & Study polish.

### 2026-09-25 (swarm wave 1 — Simple mode across the farmer screens + 17 verified fixes)
- **How:** an app-wide code audit (9 Sonnet auditors, one per area, each followed by a Sonnet
  verifier told to refute every bug/security claim) found 92 issues; all 17 bug/security claims
  were confirmed. Twelve Sonnet cloud sessions then took one track each (branch `swarm/<track>`,
  draft PR, own CI); the integrator merged the nine green ones into `claude/wave-1`, re-ran the
  full suite, hardened one rule, and shipped them as one PR with one release note.
- **Simple mode (All tools unchanged):** Records (Picked/Sold/Spent + "You kept R…" for 12
  months; Charts in All tools), Crop planner (grid kept; % labels, task chips, Clear all and the
  long panels hidden; one Auto-suggest), Farm map (5 site-panel tabs; Overview folded), menu,
  Study, Invoice & Exchange, Planting calendar (this month's card), Print, Mentor / NGO / Funder
  (NGO 4 tabs, funder Cohort + Progress, mentor declutter), Assessments, Surveys, Offline.
- **Fixes:** tour button contrast (dark text on dim ochre), NGO/funder tab label, Garden Survey
  dead tap, calendar "your crops" filter (read the real plan), Assessments navigation, survey
  answers limited to farmer/student (rules too; a profile with no role counts as farmer), print
  blank job, contours/site-features/build-info API guards, baseline security headers (no CSP
  yet), sign-up error field, ochre error text, vendor badges removed, emoji icons → Lucide,
  isiZulu for Tour discovery / update toast / Tips / unlock reason / due dates.
- **Still open (wave 2):** Design Studio, People screens + Atlas API guard, money-chart dark mode
  (sessions still running); Exchange Simple still wordy (explainer, stats twice, two back
  buttons); Study companion links read as bare headlines; theme tokens on the crop planner.
- **Owner decisions pending:** REQUIRE_API_AUTH (paid AI routes are log-only), mentors' default
  level, partly translated languages (9 of 11 under half).

### 2026-09-25 (Simple / All tools switch — Home is the first screen to use it)
- **Why:** Rory: the app "has now become very busy". A 20-screen audit (390 × 844, sample farm)
  found Home's busyness was mostly repetition: the main site's name three times, "75% complete"
  twice (`HomeHeroCard` and `FarmPlanCard` both read `useSiteProgress`), Lima named three times,
  a Back button on the root screen, "My Records" as both a tile and a tab. Shown the tidy Home next
  to today's, Rory: "there's a lot I like about both ... let's keep it a switch", so both stay.
- **The switch:** `lib/app-level.ts` (+ pure `lib/app-level-core.ts`) — `useAppLevel()` returns
  `'simple' | 'full'`, stored per account in localStorage. Defaults: farmers and signed-out
  visitors → Simple; mentor/student/ngo/funder/admin → All tools; the sample tour → All tools
  unless previewing the farmer. Settings (`components/ThemePanel.tsx`) → "How much to show".
- **Home:** All tools = Home exactly as before. Simple = the site card headed "Main site" + name
  with the next step inside it, no FarmPlanCard, weather card without the repeated name, no Back,
  no My Records tile. The step table moved to `lib/home-next-step.ts`, shared by both layouts.
- **Measured (Simple vs old Home):** whole-page tap targets 62 → 60, words 327 → 312, "My Records
  ×2" gone; first-screen taps 38 → 39 (the page is shorter, so more tiles fit on it).
- **Next:** app-wide audit (running), then Simple mode screen by screen; an organisation-wide
  default for its farmers (Step 3) on the org record.

### 2026-08-24 (Phase 1/4 of NGO/funder dashboards: cross-org Firestore/Storage leak fix — PR #350, draft)
Rory: *"i need to build the full ngo and funder dashboard now the ngo needs admin powers to
designate what users can or cannot do audit and research what we need and they need to be able
to see all the data and compile reports accordingly etc etc i will be the developer and i need
to be able to update the app from time to time so make i can o that safely"*. Plan (4 sequential
draft PRs): (1) security fix + data model, (2) platform admin panel, (3) farmer consent flow,
(4) dashboard real-data + aggregate reporting. **This is Phase 1**, opened as draft PR #350.

Root problem, independently flagged CRITICAL in `docs/AUDIT-NEEDS-RORY-2026-08-15.md` Finding
#1 and left unfixed pending this decision: any provisioned `ngo`/`funder`/`admin` account could
read every OTHER org's farmers, not just their own — `profiles` (list), `organizations`,
`designs`, `course_submissions`, `survey_responses`, `course_progress` and the three financial
log collections all gated on a bare staff-role check with no org comparison.

**Fix:** `firestore.rules` — `isAdmin()` unconditional platform-admin bypass; `staffOrgAccess(d)`
requires `d.org_id == myOrg()` for ngo/funder; `grantedOrg(orgId)` lets a funder read any NGO org
it holds a new `/grants/{funder_org_id}_{ngo_org_id}` record for (funder → many NGOs);
`consentGranted()`/`staffConsentedAccess()` additionally require the farmer's own
`Profile.dataConsent.granted == true` on the five collections that identify a specific farmer
(the three log collections, `course_progress`, `course_submissions`) — mentor access is
deliberately untouched by consent anywhere. `storage.rules`' `isCourseStaffOrMentor()` now
org-scopes the same way via a second Firestore lookup. Defense in depth: `designs`/
`course_progress`/`course_submissions`/`survey_responses` create now pin `org_id` to the
caller's own, so a farmer can't spoof their doc into another org's staff view.

**Data model:** new `Grant` type; `Profile.dataConsent?`; optional `org_id` denormalised onto
`Design`/`CourseProgress`/`SurveyResponse`/`CourseSubmission` (optional, not required — existing
docs don't have it yet). `lib/db/queries.ts` stamps `org_id` at write time and filters by it at
read time for the four newly-scoped collections. New `scripts/backfill-org-id.mjs`
(`npm run backfill:org-id`) — **Rory needs to run this against production** before/alongside
deploying the new rules, or pre-existing docs in those four collections go invisible to staff
until backfilled. `app_config/ngo_dashboard_v2` scaffolded (`ngoDashboardV2On()`) but not wired
to anything yet — ready for phases 2-4.

New `tests/firestore-rules.test.ts` coverage for every changed branch (same-org allow / cross-org
deny, admin unconditional, funder-with/without-grant, consent-withheld vs. mentor-unaffected, the
org-spoof-on-create rejection, `/grants` read scope + no client writes). Verified: `tsc --noEmit`
clean, `npm run build` clean, `npm test` at baseline (3055 pass / 2 pre-existing unrelated
auth-suite failures / 1 pre-existing TODO, no regressions). **`npm run test:rules` could not run
in this sandbox** (no firebase CLI/emulator/egress) — flagged explicitly in the PR for Rory to
run before trusting the rules as verified rather than just read-through. No UI changes; rules
deploy stays a manual step.

### 2026-08-15 (the real /design crash fix: `lib/i18n.tsx` bundle diet, not another band-aid)
Rory: *"It still crashes"* (iOS Safari's native "A problem repeatedly occurred" crash-loop on
`/design`), after "i want a comprehensive fix... i dont want any light page fix" and "disable
this now its interfering with my laptop use too" — this is that comprehensive fix.

Root cause was **not** mapbox-gl (a red herring — a substring match on the translation key
`editEngineMapboxTool`, present in every language). It was `lib/i18n.tsx`: all eleven South
African language dictionaries lived inline in one ~8,590-line module (~420 KB raw / 144 KB
gzip), imported eagerly by `DesignCanvas.tsx` and 326 files app-wide — so `/design` shipped
every farmer's full string table in every one of the eleven languages on every load, regardless
of which one was active.

**Fix:** split `lib/i18n.tsx` into English (`T_en`, stays inline — the default locale and the
synchronous fallback for missing keys) plus ten `lib/locales/<code>.ts` files, each lazy-loaded
on demand via a new `loadLocale()` dynamic `import()`. `translate()`/`t()` stay fully
synchronous (`LOADED[lang]?.[key] ?? LOADED.en[key] ?? key}`) so none of the 326 consuming files
needed to change. `lib/i18n-pending.ts` holds the block of keys shared verbatim across every
locale. `Onboarding.tsx` prefetches all ten locale chunks up front (it's the language-pick
screen, so the point is previewing correctly the instant a farmer picks one).

**Result:** `/design` First Load JS **633 kB → 512 kB**; the i18n chunk itself **144 kB → 22.8
kB gzip** (other ten locales now live in separate chunks not part of `/design`'s initial load
at all). Full test suite green (2647/2649, the 2 remaining failures pre-exist on `main`,
confirmed by running them against a clean checkout — an ESM loader issue in
`auth-account-transition`/`auth-guest-migration.test.ts` unrelated to i18n). `tsc --noEmit`
clean.

### 2026-08-10 (two finishes: Exact Canvas and AI Polished — the second paid pass is shelved)
Rory: *"I just want an exact version for now and a ai render polished version also those 2
because you haven't been able to fix the hybrid properly and messes the ai polished version too."*

The Design Studio's finish picker now offers **exactly two** choices, and the shelf moved off
the AI render and onto the **second** paid pass.

- **Exact Canvas** — free, instant, deterministic; every label, legend and line at full sheet
  resolution.
- **AI Polished** — one paid render. The model paints the **map artwork only**; the app then
  locks the boundary, plant labels, legend panel, title block, north arrow and scale bar back
  on top. The model never sees a word of type, which is why this tier keeps its chrome.
- **Full Treatment** (the second pass over the finished sheet) — shelved behind `?aifinish=1`,
  **not deleted**. It is the tier that returned "Planting · Photo Plan · AI polished · Geometry
  locked" with no labels, no legend and a stamped-on boundary: an image model cannot reproduce
  9px type, and that pass is handed a page covered in it.

Why the previous shelve was wrong: it gated **both** paid tiers on one flag, which left the
Studio with no AI finish at all — Rory: *"i wanted the hybrid shelved not the ai!!!! i didnt say
remoe the ai"*. `SECOND_POLISH_PASS_SHELVED` now gates Full Treatment alone.

Also fixed in the same pass: the one-tap **"AI-polish this exact map · 1 AI render"** button was
dispatching a Full Treatment, which is *two* renders. It now runs the single-render flow it
advertises. The paid button takes the gold, since it is one of two choices and the only one that
spends money.

Naming: the farmer-facing label changed from "AI Hybrid" to **AI Polished** — the old name
described the plumbing, not the result. The internal stage stays `hybrid` everywhere (render
queue, stored `resultKind`, every gallery entry already on a farmer's device); renaming it would
relabel sheets that have already been paid for.

`tests/ai-finishes-shelved.test.ts` → `tests/sheet-finishes.test.ts`, rewritten for the new
contract: the offered AI finish must be reachable with **no** flag and no query string, every
Full Treatment entry point must be gated, the one-tap flip must spend what its label says, the
gallery must never consult the shelf, and the pipeline must still be importable.

### 2026-08-10 (one-surface Phase 3: design flows back to the map, read-only)
Phase 3 of `docs/ONE-SURFACE-PLAN.md` — the farmer's Design Studio work now appears on the
live farmer map as a read-only "My design" layer, completing the loop the plan calls
"builds trust in the one model before the weld".
- **New pure converter `lib/design-map-layer.ts`** — `designStateToGeoJSON(state, frame)`:
  normalised canvas coords → real-world [lng,lat] GeoJSON via the Studio's own inverse-Mercator
  (`makeMercatorUnprojector`). Zones → Polygons (kind/zone/label/color), lines → LineStrings
  (lineKind/color/width/dashed), placed items → Points (name/category/icon/color). Deterministic,
  no side effects; designs whose frame lacks geo-registration — drawn over a custom PHOTO or
  BLANK paper, whose geometry is anchored to the photo's pixels rather than the earth (see
  `migrateStateToFrame`) — yield an EMPTY collection instead of painting confidently in the
  wrong place. `lib/design-overlay.ts` is now a thin impure wrapper (loadCanvasState + the
  Marker/GeoJSON split) over this one implementation.
- **Map.tsx (strictly additive, design-overlay sections only)** — the overlay gains small
  centroid labels (`design-label` symbol layer reading each polygon's `label` prop), and the
  map now OWNS visibility: a "My design" chip in the labels pill (Lucide `PenTool`, exact
  pattern of the Shapes/Hatching/Places chips, same session-scoped persistence), ON by default
  whenever a saved geo-registered design exists. The parent-owned `showDesign` prop and the
  farmer page's separate floating "Show design" button (default-off, emoji icon) are gone.
  Sync unchanged and verified: the overlay refreshes on `DESIGN_CANVAS_CHANGED_EVENT` +
  `storage`, so an edit in /design shows on the map on return without a reload.
- Tests: new `tests/design-map-layer.test.ts` (lng/lat round-trip < 1e-6°, empty state → empty
  collection, photo/blank/corrupt frames → empty, style-property contract, determinism +
  input-mutation guard, invalid-shape quarantine) and a photo/blank skip test in
  `tests/design-overlay.test.ts`. Full suite green except the pre-existing
  `tests/auth-account-transition.test.ts` ESM-loader failure (also fails on clean main).
### 2026-08-10 (beds under the trees; veg you can actually see)
Two more defects off Rory's phone review of a live Reference Blueprint planting sheet.
- **Beds sit under the trees now** (`lib/glossy-filters.ts`, `components/design/DesignGlossy.tsx`) —
  `cartographicItemPaintRank` was ordered by palette category rather than by height above the
  ground, so a bed sat at rank 3: above every path, tank, shed and hive on the farm, with only the
  canopy rank over it. Beds and crop rows drop to rank 1 — still above the basins and berms they
  are built on, below everything that stands up. And `drawExistingSiteItems` (Site + Site-Hybrid)
  was the one item loop that painted in SAVED ARRAY ORDER, so a bed recorded after a citrus painted
  its crop rows straight over the crown; it sorts through `compareCartographicPaint` like every
  other stack. The canopy small-crown-first inversion is untouched.
- **A bed carries real, large vegetables** (`lib/crop-row-cartography.ts`, `DesignGlossy.tsx`) —
  the oversized cabbage head shipped last night never showed, because the mark size came from the
  ROW PITCH, and a bed's row pitch is its own 1.2 m width divided by its rows: ~11 px at sheet
  scale, so every mark drew ~17 px on the 1920 px master (three pixels on a phone). Worse, at that
  scale a bed rarely reached the painter's "three plants or don't bother" floor, so it fell through
  to `production-bed-v1.png` — the one green rectangle every bed shared — and the cabbage code was
  never reached at all. New `bedCropMarkUnitPx` sizes the mark from the PAGE (≥1.7% of sheet width,
  capped to the bed so an oversized head still belongs to it), `bedCropRows` takes the matching
  pitch and lays out fewer, larger plants, and the bail is now "can a vegetable be read here at
  all". A typical bed prints ~33 px heads instead of ~17 px dots. Footprints, rotations, legend
  rows and counts are untouched — symbol size only; staple plots keep their own field treatment.
- Guards: `tests/glossy-filters.test.ts` pins canopy-over-bed for every bed × canopy pair (and
  bed-over-basin), plus the comparator count for the fourth paint loop;
  `tests/crop-row-cartography.test.ts` pins the mark's readable floor, the fewer-larger layout and
  that the renderer actually asks for it.
### 2026-08-10 (paid sheets: the app draws the chrome, always, and never sends it to the model)
Rory's live Full Treatment render — "Planting · Photo Plan · AI polished · Geometry locked" — came
back with **no plant labels, no legend panel, no title block, no north arrow, no scale bar**, and
the property boundary sitting on it as a hard vector line stamped over completely repainted ground.
Two failures, one picture, both now structural rather than conditional (`lib/sheet-chrome-pass.ts`):
- **The model was handed the composed sheet.** An image model cannot reproduce 9px type, so it
  erased every label and repainted the legend. Every paid path now uploads MAP-AREA ARTWORK only:
  design layers already did; **Sector / Existing Site** crop the finished Hybrid back to its map
  column (`cropStyleSheetToMap`) and **Phasing** uploads its map column via a new `cropSheetRegion`
  (which also fixes the model's page-shaped return being squeezed into the narrower map column).
- **The app's re-draw of that chrome was conditional, and the condition could not hold.** It
  compared the uploaded input's PIXEL SIZE with the map size — but `capForAiInput` uniformly
  downscales every AI-bound bitmap to `AI_INPUT_WIDTH` (1920), so at the High render scale (2880px
  maps, the desktop default) the "legacy composed-page input" escape hatch fired on *every* polish
  and skipped the chrome pass entirely. The decision now comes from the committed workflow stage
  (`paidPolishNeedsChromePass`, off the job doc's `resultKind`), never from a protect mask, an
  image size or a style; `modelInputCarriesChrome` compares ASPECT (which the downscale preserves)
  and only chooses whether a legacy page's map column needs cutting out first.
- **One chrome pass, one place** (`composeSheetChromeOverMapArt`) — boundary stroke, plant labels +
  leaders, label gutters, legend panel, title block, north arrow, scale bar — drawn from the saved
  design over whatever comes back. Both of its exits, including the error path, return a composed
  sheet; the old catch returned the bare source map. Sector's "ship the model's page raw" exit is
  gone for the same reason.
- **Boundary reads as part of the sheet again.** Nothing is byte-restored on the polish tier; the
  property line is drawn in the same pass as the labels and the legend, from the same geometry.
  `fullTreatmentProtectPolicy` is unchanged (boundary only) but re-documented: its mask now marks
  *app-owned* pixels for the difference gate rather than *byte-restored* ones. Phasing's and
  Sector-polish's masks are gone — a mask promises a restore neither of them performs, and both
  would have hidden real map area from the gate. Geometry, counts and positions untouched.
- Cache: r-token `:r1` → `:r2` (a cached r1 Full Treatment is exactly the picture this stops
  re-serving); `PLAN_VERSION` deliberately untouched. Dead helpers removed
  (`extendProtectMaskToStyleSheet`, `buildPhasingProtectMask`). New `tests/chrome-after-ai.test.ts`.

### 2026-08-10 (plan-sheet art: real vetiver, grassed berms, actual cabbages)
Three pieces of Rory's phone review of a live Reference Blueprint sheet, all seeded-deterministic
(same design → identical paint, byte for byte):
- **Vetiver reads as a grass hedge, not a strip** (`lib/vetiver-hedge.ts`) — tuft sizes, spacing
  and off-line drift now vary per seeded crown; blade count and tone vary per tussock (three
  near-neighbour greens); and the band's cream casing + fill follow the UNION of the tussock
  blobs instead of the footprint rectangle, so the edges are softly ragged. Saved geometry is
  untouched — the width-honesty inset (`VETIVER_BLADE_REACH`, now 2.4) still caps every blob and
  blade inside the saved band.
- **Berms/terraces get scrappy grass fringes** (`lib/cartographic-water-symbols.ts`) — seeded
  bowed blades rooted along both long edges lean across the outline and break it visually
  (clipped to the exact footprint), and the internal contour lines are hand-wavered instead of
  ruled. Half-moons unchanged.
- **Rosette beds paint actual cabbages** (`lib/crop-row-cartography.ts` `cabbageHeadLeaves` +
  `DesignGlossy` renderer) — layered wrapper leaves around a tight pale heart, deliberately
  oversized to the same 2.6·s footprint the veg sprites use, always vector (the rosette sprite
  read as a blob at phone size). Rows, pitch and glyph choice contracts untouched; 'generic'
  stays a plain plant so no crop is invented.
Tests extended in `tests/vetiver-hedge.test.ts` (paint-pass determinism via recording canvas,
irregularity, band-from-tussocks), `tests/cartographic-symbols.test.ts` (berm/terrace fringe
determinism) and `tests/crop-row-cartography.test.ts` (cabbage geometry + reach bound).

### 2026-07-26 (live emulator walkthrough — found and fixed two pre-existing bugs)
Ran the whole flow against the Firebase emulator with a seeded mentor + learner in one org
(`scripts/seed-course-demo.mjs`), driven end to end in a real browser. Static checks had all
passed; the walkthrough still found two bugs, both older than this branch.

- **The mentor dashboard could never load a cohort from Firestore.** Two independent causes:
  1. `firestore.rules` had a single `allow read` on `/profiles/{uid}` combining
     `uid == request.auth.uid || isStaff() || isMentor()`. A **list** is authorised once, up
     front, before any document is read, so the per-document `uid` term cannot be proven and
     drags the whole OR to false. Every profile query a mentor made was `PERMISSION_DENIED`.
     Split into `allow get` (unchanged) and `allow list` (staff/mentor only) — strictly no more
     permissive than the original intent, since list was previously denied to everyone.
  2. `app/mentor/page.tsx` ran `load()` on mount instead of waiting for auth. Every query in it
     is org-scoped and the org comes from the caller's own profile, so running while
     `currentUser` was still null returned empty lists with **no error** and never retried. The
     student page already had this guard; the mentor page did not.
- Both failures rendered as the same innocent empty state — "Learners will appear here once
  they enrol" — which is precisely why static verification could not see them. The mentor page
  also swallowed load errors in a bare `catch {}`; it now logs and shows the sync banner, so a
  denial can never again be mistaken for an empty cohort.
- **Verified live, in the browser:** mentor signs in → sees the learner at 2/10 with status
  "Not enrolled" → enrols (cohort counter goes to 1) → assigns Seeds with a due date → both
  documents land in Firestore with the mentor's uid and org stamped, zero rules denials. Learner
  signs in → "Set by your mentor · 0 of 1 done · 1 due this week" → Seeds lifted to the top of
  the list keeping its curriculum number 6, badged "Due in 4 days" → opens it → isiZulu
  narration plays (`/course-audio/seeds-sovereignty/zu/slide-02.mp3`, clock running, 84s
  duration matching the file). Screenshots in `docs/verification/`.
- 233 tests pass, `tsc --noEmit` clean, `npm run build` passes.

### 2026-07-26 (recorded isiZulu + English module narration, playing in the app)
- Rory's Gemini/Antigravity narration of the Seeds facilitator deck is now **in the app**: 10
  slide clips per language, isiZulu and English, plus a full-module track. Sourced from the
  `Imbewu Learning Portal` notebook and imported from `~/Downloads/imbewu_seeds_audio`.
- **`scripts/import-course-audio.mjs`** is the seam so the next module is one command, not a
  manual copy: `node scripts/import-course-audio.mjs <moduleId> <exportDir>`. It normalises
  whatever the export looks like into `public/course-audio/<module>/<lang>/slide-NN.mp3`,
  warns when two languages have different track counts, and prints the manifest block to paste.
- **`lib/course-audio.ts`** is the manifest and lookups. Slides map to lessons (2–3 → lesson 1,
  4–6 → lesson 2, 7–9 → lesson 3, with 1 and 10 as module intro/recap), so the audio appears
  both as a whole-module playlist and inside the lesson it belongs to. Every URL goes through
  `trackUrl()`, so moving audio to Firebase Storage later is a one-line `baseUrl` change and no
  component moves.
- **`components/course/CourseAudioPlayer.tsx`**: nothing autoplays, `preload="none"` and the
  `src` is only set on press, so a learner on a metered rural connection downloads the two
  minutes they asked for and not eleven megabytes. Clips auto-advance to the end of the list
  and stop — never loop. If a module was not recorded in the app's language the player *says*
  which language it is playing instead of quietly substituting English.
- This is the honest fix for the caveat in `lib/tts.ts`: SpeechSynthesis has no isiZulu voice
  on most real devices, so isiZulu lessons were being read out in English or not at all.
  Recorded narration side-steps the device. SpeechSynthesis stays for everything unrecorded.
- Guard tests cross-check the manifest against the filesystem in both directions — a promised
  clip that is not on disk fails, and an orphan clip on disk that no module claims also fails.
  Module and lesson ids in the manifest are validated against `lib/course-modules.ts`.
- Verified: 233 tests pass, `npx tsc --noEmit` clean, `npm run build` passes. Clip durations
  read back correctly via ffprobe (isiZulu 7:52 total, English 5:45; isiZulu consistently ~35%
  longer, matching the longer isiZulu script).
- **NOT verified: that the isiZulu clips are actually spoken in an isiZulu voice.** Rory's own
  notebook chat shows Gemini defaulting to an English voice model on isiZulu text for the video
  overview. The same failure could have hit these clips. Someone who speaks isiZulu must listen
  to one clip before this ships.
- Built in a separate git worktree because another agent was editing `DesignGlossy.tsx` and
  `lib/locked-polish-flow.ts` in the main checkout at the same time.

### 2026-07-26 (course enrolment + mentor-set assignments)
- Built the two modules the last handover assumed already existed: **`lib/course-enrollment.ts`**
  and **`lib/course-assignments.ts`**. Neither was in the repo — the mentor dashboard's
  "Learners will appear here once they enrol" empty state was unreachable because nothing in
  the app could enrol anybody.
- **Enrolment** is a separate record from `course_progress`, which stays the single source of
  truth for "is this module finished". Status is DERIVED from progress (none → not started,
  some → in progress, all → complete); only a mentor's `paused`/`withdrawn` is stored, and a
  manual pause is never overruled by progress.
- **Assignments** are mentor-owned: learner, module, optional due date, optional note. They
  never record completion. The learner's Portal lifts outstanding assigned modules to the top
  of the list without removing anything — the full syllabus stays reachable.
- Firestore rules for both collections: a learner reads their own and can write neither. Only
  a mentor or staff member in a **non-null** org may enrol or assign (`inMyOrg()` is stricter
  than `sameOrg()` — it refuses to match two org-less accounts through `null == null`).
  `profile_id` and `org_id` are pinned on update, so an enrolment can't be re-pointed at a
  different learner or walked across to another org. No composite indexes needed — every query
  is a single-field equality.
- Mentor writes are optimistic for a slow rural connection, and re-read from the server on
  failure rather than leaving an unsaved value on screen.
- Date handling is deliberate: due dates are plain `YYYY-MM-DD`, day arithmetic goes through
  `Date.UTC` so a DST transition can't round a deadline to the wrong side of zero, and "today"
  resolves after mount so server and client can't disagree across midnight.
- **Not touched, on purpose:** no lesson body, key point, quiz question, rationale or species
  name in `lib/course-modules.ts` was edited.
- Verified: 26 new unit tests, **222 passing** total, `npx tsc --noEmit` clean, `npm run build`
  passes, and `firestore.rules` loads in the Firestore emulator without a compile error.
  Branch `feat/course-enrollment` — **not merged, not deployed.** Still needs a live run against
  a real mentor + learner pair before it goes near `main`.

### 2026-07-19 (production Geometry Lock quality audit + reversible style reference)
- Verified Geometry Lock against the real saved **Carl and Sandys Place / Water** sheet on the
  production domain. The exact house, driveway, boundary, labels and tool-glyph cleanup improved,
  but the first production result was still too dark, photographic and visually flat compared with
  Rory's direct ChatGPT map set. Do not use the earlier local comparison as a quality claim.
- Added an appearance-only reference image cropped from Rory's direct ChatGPT planting map. The
  worker sends it as Image 2 only for **Precision Atlas + Geometry Lock On**; Image 1 remains the
  sole source of geometry and content. Other styles and Geometry Lock Off keep the existing
  single-image workflow, so the experiment can be disconnected instantly.
- Strengthened the deterministic Precision Atlas context palette without moving any pixels. The
  house/driveway restore, water symbols, leaders, legend, boundary, north arrow and scale remain
  browser-drawn from saved map data, not invented by the model.
- Unit tests, TypeScript checks and both app/function builds pass locally. Final sign-off still
  requires deploying `runRenderJob` after Firebase CLI reauthentication, deploying Vercel, using
  the in-app **Refresh update** action, and inspecting a newly generated production Water sheet.

### 2026-07-18 (geometry lock toggle + reversible queue mask)
- Added an opt-in **Geometry Lock** switch to the glossy gpt-image-2 queue path, so the strict
  render can send a protect mask only when requested and restore the protected source pixels after
  the model returns.
- Threaded the optional mask through the background render job contract and worker, while keeping
  the existing showcase/AI-legend pipeline dormant and untouched.
- Added a focused test for the new pixel-restore helper so the masked path can be flipped off again
  cleanly without changing the rest of the map pipeline.
- Tightened the Geometry Lock prompt footer and the strict edit wrapper, and asked the worker for
  the highest input fidelity the edit API supports to squeeze out better map detail without
  changing the off-switch or the showcase path.

### 2026-07-12 (site audit + repair pass)
- Ran a repo-wide audit with subagents across shell/login, map/design, API/auth, and content flows.
- Landed the safe fixes: removed the duplicate home language provider, improved login scrolling/labels/focus, hid the closed nav drawer from the accessibility tree, fixed role-switcher semantics, synced farmer query params, cleared stale report/photo analysis, centralized the zone palette, made the design studio use the local fallback plan, and made shared map imports persist/recompute.
- Left the gate/auth hardening findings as a separate decision because they change deployment behavior.

### 2026-07-12 (strict map generator)
- Added a strict-map edit mode to `/api/ai-render` so the GPT-image-2 path gets map-specific guardrails, explicit must-include / must-avoid criteria, and a cartography-only prompt wrapper.
- Rewired the glossy design renderer to opt into the strict-map mode and renamed the UI copy so the "best quality" action now reads as a strict map generator.
- This keeps the existing fast Gemini render and the other AI touch-up flows intact while giving the final map render a harder contract.

### 2026-06-23 (critical bug fixes + UX pass 2)
- **BLOCKER fixed: water colour** — MapboxDraw missing `userProperties:true`; without
  it `user_featureType` style filters never matched → all polygons green, no blue water.
- **Persistence race fixed** — `recompute()` now guards persist behind `restoredRef`
  so a fast first draw can't wipe saved shapes before restore runs.
- **Name/category survives edit** — snapshot in `startReticleEdit`, restore in finish+cancel.
- **GPS error auto-dismisses** after 2 s. **Draw hint banner** fades after 6 s.
- **Rename in edit bars** — both custom and native edit modes have a Rename button.
- **Place colour/name edit** — tap the colour dot in Places list; sheet re-titles "Edit place".
- **Parcel names in right panel** — DataPanel "Your land"/"Water storage" cards now
  list named parcels/stores under the aggregate total.
- **Search placeholder** → "Search town or address".
- **Draw bar** "Add corner" font reduced 15→13.

### 2026-06-23 (drawing persistence + map fixes)
- **Drawn parcels + water now PERSIST** (localStorage `imbewu_farm_shapes`) — the
  big one: drawing was lost on refresh/navigation. Saved on every change, restored
  when the map is ready (poll-based, since the contour/terrain sources keep
  `isStyleLoaded()` perpetually false). Teardown guard stops the unmount `deleteAll()`
  from wiping storage. Verified: survives refresh AND navigate-away-and-back.
- **Existing shapes LOCKED while drawing** — switch MapboxDraw to a `static` mode
  during reticle-draw so panning under the crosshair can't grab/move an existing
  boundary (fixes "drawing water moved my land boundary").
- **Water renders ON TOP of the boundary** — split the draw fills by type and order
  them land-then-water (+ higher water opacity) so the blue is visible even where a
  dam sits inside a parcel.
- **Saved-place GPS points in the report** — ReportView now lists each saved place
  with its label + lat/lon (5dp). Verified.
- **STILL TODO from this feedback:** parcel naming/categorise popup + rename-on-Edit
  (parcels are still auto-named "Parcel 1"); linking a drawn farm to a saved place;
  a show/hide toggle for the drawn layer.

### 2026-06-23 (live-feedback fixes)
- **Draw-bar tap bug fixed** — on phones the 5 draw controls (Cancel/Undo/GPS/Add
  corner/Finish) overflowed the viewport so Finish sat off-screen and only a sliver
  responded ("5% clickable"). Shrunk the button bases/gaps + the oversized 21px
  "Add corner" font, added `minWidth:0`, raised the bar to clear the TabBar (now 20px
  above it), and hid the Lima FAB during draw. Verified at 375px: all buttons 5/5
  clickable, no overflow.
- **Right panel fonts tightened** (the "too big" complaint) — applied the §0 scale
  to the SITE REPORT panel: biome name 22→18, stat rows 56→46px / value 18→16,
  Stat component 29→21, Lima card + buttons down a notch.
- **Live "Your land" / "Water storage" card** in the panel Overview — shows area +
  perimeter (+ parcel/store count, est. volume), updates live as a boundary is drawn.
- **Saved places: delete + labels toggle + colour** — each place row now has a
  colour dot (by label) + a red delete trash; a "Show names on map" toggle controls
  always-on pin labels. Verified delete end-to-end (storage + list + badge + marker).

### 2026-06-23
- **Lima coach-marks** — first-time map guide card; "?" in the tools-panel header.
- **Map tools v2 corrections** (frame 33 / `MAP-TOOLS-CORRECTIONS.md`) — blue centred
  Draw-water paired with ochre Draw-land-boundary; rewritten parcel/water list
  (labelled sections + named rows + buttons); draw-bar progress pill + "Add corner";
  layers summary-row collapse; **Save-place drops a pin + naming sheet** (label→colour).
- **Lima Vision** (`/vision`, frames 13/14) + **expense-slip OCR** (frame 32) +
  **GPS boundary-walk** (frame 05) — all on existing Claude vision / browser geolocation.
- **NGO surveys** (`/surveys`, frame 21).
- **Cost/expense logging** + **POPIA consent onboarding** (frames 16/23/24).
- **iPad/tablet layout** (frame 26) + **desktop financial sheet** (frame 15).
- **Map tools panel redesign** (calm/unified/ochre) + **responsive type** fix (§0) + NgoDashboard.
- **Crop-plan scheduler** (frame 31) + **crop quantities** (frame 30) + **invoice builder** (frame 17/32).
- **Garden survey wizard** (frame 29).
- **Role merge → Mentor**, **task-first home**, **vendor badges removed** (frames 02/03/19).
- **Auth backend** (reset / Google / change-pw / photo) + Firestore rules & indexes.
- **Trainer→Mentor hub**, **Student portal**, `mySales`.
- **Live-auth fix** — mirrored Firebase/Mapbox/Anthropic env into Vercel (`set-vercel-env.yml`)
  + added Auth authorized domains. (Was stuck in "Backend not connected".)

---

## What's left

1. **Google Sheets mirror + Google Calendar sync** (frames 15/18) — the only handoff
   item blocked on external setup. Needs a Google Cloud **OAuth client + consent
   screen** the project owner must provision. The desktop sheet + CSV export and the
   in-app calendar/cropplan are already built; only the live two-way Google sync is out.

### Deliberate skips / lower priority (see `design/DESIGN.md`)
- Map tools **mobile bottom-sheet** — the panel redesign already applies on phone; a
  bottom sheet would collide with the Details sheet + Lima FAB + TabBar at the map bottom.
- Site-analysis Q&A stepper (frame 04) — overlaps the built `/survey` garden wizard.
- Invoice → auto-post to ledger; yield-vs-planned (frame 32) — nice-to-have.
- **Cost note:** OCR/vision uses `claude-sonnet-4-6`. At scale, dropping the slip-OCR to
  Haiku 4.5 (same provider, ~3× cheaper) or Gemini 2.5 Flash (~8× cheaper, +1 provider)
  is a clean win — revisit when volume justifies it.

---

## Auth / passwords (operational)
- **Site gate:** deleted 2026-09-26 (`/gate` + `/api/gate`). `SITE_PASSWORD` in Vercel is now unused and can be removed.
- **Account auth:** Firebase email/password (enabled) + Google. To enable the Google button end-to-end, the owner enables **Google** as a sign-in provider in Firebase Console → Authentication → Sign-in method (email/password is already on; authorized domains are set).
- **Env:** managed via GitHub repo secrets → pushed to the Vercel project by `.github/workflows/set-vercel-env.yml` (`gh workflow run set-vercel-env.yml`). Never commit `.env*`.
