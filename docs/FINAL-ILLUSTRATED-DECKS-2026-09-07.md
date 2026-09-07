# Illustrated course review editions — 7 September 2026

All nine non-Seeds modules now have English illustrated review decks and matching
isiZulu illustrated drafts. Rory asked for the Seeds formula: a clear illustrated
teaching front, complete reading material, narration and a demonstration at the
appropriate point. The 185 existing narration identities are preserved. Extra
reading frames repeat their own slide number instead of creating recording slots.

These changes are on draft PR #426. They have not been merged or released.

## Export inventory

Fronts include the cover. PDF pages include both fronts and all reading frames.
The illustrations reuse scenes across teaching compositions; these are not 175
different generated pictures.

| Module | Blocks | Fronts | English reading frames | English PDF pages | isiZulu reading frames | isiZulu PDF pages |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Introduction | 22 | 22 | 33 | 55 | 38 | 60 |
| Reading the Landscape | 21 | 21 | 29 | 50 | 39 | 60 |
| Water Harvesting | 24 | 24 | 25 | 49 | 35 | 59 |
| Soil Health | 20 | 19 | 21 | 40 | 27 | 46 |
| Plant Guilds | 20 | 20 | 22 | 42 | 37 | 57 |
| Food Forest | 20 | 20 | 25 | 45 | 36 | 56 |
| Vegetables and Staples | 18 | 18 | 34 | 52 | 45 | 63 |
| Small Livestock | 20 | 20 | 29 | 49 | 39 | 59 |
| Market and Community | 20 | 20 | 27 | 47 | 30 | 50 |
| **Total** | **185** | **184** | **245** | **429** | **326** | **510** |

The 18 ordinary PDFs have numbered bookmarks and no encryption. They require no
HTML viewer or sign-in. The combined download contains those PDFs and a README.
Every isiZulu frame is marked DRAFT and is excluded from reviewed live coverage.
Soil slide 13 still needs a verified wattle-pod identification image; its complete
reading material is included in both languages.

## Accuracy corrections in the final five modules

Market and Community now distinguishes sales from profit, includes production and
selling costs, and labels its R18/R15/R3 arithmetic as a hypothetical example. It
uses actual buyer terms and local food-gap records, avoids guaranteed box income,
and distinguishes seed varieties from duplicate packets. It no longer claims a
fixed share of food is lost or that local selling eliminates losses.

Plant Guilds now separates nitrogen fixation in legume nodules from subsequent
nutrient release through decomposition. Sesbania sesban is described as a shrub or
small tree, not an annual. Fixed nitrogen yields, universal planting ratios,
downhill fertility promises and guaranteed pest control were removed. Pruning
does not end root competition; guilds still require observation and care.

Food Forest uses site, mature size, cultivar and frost suitability when discussing
layers and spacing. It no longer implies every named plant is edible or promises
automatic harvest or independence in a particular year. The loquat exclusion for
the Western Cape and forest biome remains, together with checking current local
restrictions. A planning percentage is not presented as an ecological threshold.

Vegetables and Staples bases sowing intervals on crop records and days to harvest,
not a guarantee that the fourth sowing coincides with the first harvest. It
acknowledges competition in intercropping. All four natural pest-management steps
and the neem label warning remain. The new aphid illustration was corrected to
show intact leaves rather than holes caused by chewing insects.

Small Livestock strengthens daily care, feed, water, shelter and food hygiene.
Ducks are not a food-safety exemption. Birds do not replace veterinary parasite
care, and goats are not promised a natural deworming treatment. Pollination is
crop-specific; healthy-looking bees do not prove chemical safety or automatic
varroa resistance. Registration advice points to current Department requirements.

The affected lesson bodies, key points, quizzes, artwork references, English and
isiZulu narration scripts and reading decks were reconciled together. The source
changes in these five modules supersede 49 historical Leah review takes; together
with the earlier four-module corrections, **74 takes and all nine full tracks**
need replacement/reassembly. Exact current scripts and hashes are in
`course-production/current-recording-review.json`; final-four source corrections
are also recorded in `course-production/remaining-source-corrections.json`.

## Animation and voice handover

The pack contains 12 starting frames with Rory's illustrated animation prompts,
plus 16 controlled process clips and their posters. Starting frames are not finished
animations. The square compost heap has a flat top and square footprint, with a
wheelbarrow in the illustrated reference. The controlled compost and livestock
nutrient-cycle clips now use the same square heap. Root-nodule fixation and later
decomposition are shown as separate stages rather than a direct fertiliser pipe.

English target voice remains Microsoft `en-ZA-LeahNeural`; isiZulu remains
`zu-ZA-ThandoNeural`. Compare the -12% review rate audibly with Seeds before
acceptance. No new audio was generated during this continuation. The 111 unchanged
historical Leah takes still need source-hash and listening verification; old Luke
tracks are held rather than relabelled as Leah.

Automatic approval review rejected sending corrected narration to
`speech.platform.bing.com` because that external destination and transfer had not
been explicitly authorised. No alternate endpoint or indirect execution was used.
The complete 185-script pack and exact 74 corrections are prepared for review so
that any renewed recording approval can refer to a concrete result.

Rory can test the supplied starting frames in his existing Google Flow allowance.
The actual account tier and remaining credits have not been inspected. No paid
video service was invoked and no generated clip has been accepted without review.

## Verification and recovery

- TypeScript check passed, followed by the full suite: 3,454 passing tests, zero
  failures, one existing TODO (3,455 total), then a clean whitespace check.
- Fixed the two real failures found during verification: stale animation byte
  counts and missing course-art entries in the offline asset inventory.
- The SVG check now rejects unexpected leftover files. PDF export checks the
  actual source, ordering, missing/stale/extra frames before rendering.
- All 18 PDFs were opened programmatically; final-module contact sheets and
  representative PDF pages were visually inspected. The final isiZulu Plant Guilds
  caption adjustments were inspected after rendering. No phone/browser playback
  claim is made; that review remains outstanding.
- Seeds was preserved. No production build was run and PLAN_VERSION was not changed.

Workspace cleanup removed the original working folder during the session. The
repository was recovered from published commit `8f6cd535768ee0e21f2281089be25442dc0404cb`.
Saved Market artwork and temporary source-edit scripts allowed the in-progress
changes to be reconstructed and verified. New deliverables were exported again
from the recovered source; the final state is the published checkpoint accompanying
this note, not an assumption that every transient intermediate survived.

## Before release

Review the isiZulu with a first-language farmer; obtain explicit permission for the
corrected English speech transfer, then record and listen; finish Rory's 12
illustrated motions; complete the outstanding soil temperature/maturity and wattle
source review recorded in the Soil audit; supply the verified Soil 13 identification image; inspect
playback, offline behaviour and legibility on a phone. Keep PR #426 in draft until
those production checks are resolved. The PDF decks are review deliverables, not
evidence that the whole course is ready to ship.

## Primary-source checks used for the final modules

- [FAO farm business school material](https://www.fao.org/4/i3227e/i3227e.pdf)
- [FAO marketing costs](https://www.fao.org/4/a1298e/a1298e06.pdf)
- [World Agroforestry: Sesbania sesban](https://apps.worldagroforestry.org/treedb/AFTPDFS/Sesbania_sesban.PDF)
- [NC State: nitrogen immobilisation](https://covercrops.ces.ncsu.edu/nitrogen-immobilization/)
- [Oregon State: sheet mulching](https://extension.oregonstate.edu/catalog/em-9559-sheet-mulching-lasagna-composting-cardboard)
- [WVU Extension: succession planting](https://extension.wvu.edu/lawn-gardening-pests/news/2019/01/15/basics-of-succession-planting)
- [Virginia Tech: chicken manure and vegetables](https://psdocs.spes.vt.edu/consumer/3_using_chicken_manure.pdf)
- [Mississippi State: sheep and goat parasite control](https://extension.msstate.edu/publications/sustainable-parasite-control-for-sheep-and-goats)
- [Review of avocado pollination evidence](https://pmc.ncbi.nlm.nih.gov/articles/PMC8647928/)
- [Department of Agriculture registration form, 2026 copy](https://wcba.co.za/wp-content/uploads/2026/02/DOA-BEEKEEPING-REGISTRATION-FORM.pdf)
