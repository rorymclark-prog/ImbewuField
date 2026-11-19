# CP-118: the site data panel's remaining unsourced verdicts — 2026-11-11

- Auditor: Claude, as author, on Rory's instruction of 11 November 2026 ("go ahead with CP-118 too").
- Reviewed revision: starts from `df8cec04089ff6b4728c23604dfad4b9ffb5ca46`, tree `a8b4bf8f234c1841fd28cacb033f5f3b460039cb`. The change is commit `4e095ecc` on branch `claude/blissful-pasteur-1c4ne6`, PR #1334. The exact head and tree are in the PR comment that links this record.
- Deployment inspected: local development server at that commit.
- Previous audit: [CP-117 and the plan table's frost caveat](cp117-frost-caveat-claude.md), same day, which opened CP-118.
- Scope: the statements CP-118 listed, on `components/DataPanel.tsx` only. Translations, the shared climate adapter and other screens are not touched.
- Evidence type: source review, the real panel rendered whole with the real English and isiZulu dictionaries, browser at phone in light and dark.

## What changed

| Place | Before | Now |
| --- | --- | --- |
| Header, both sizes | "Good fit" (500 mm or more and slope under 15°), "Fair site" (300 mm, 25°), else "Challenging" | No badge |
| Overview, site summary | Under 400 mm: "Only N mm of rain so water harvesting is essential." Otherwise: "N mm annual rainfall estimate. Check dry-season supply before planning year-round crops." | "Modelled annual rainfall: about N mm." In isiZulu the same English sentence, until a reviewed translation exists |
| Overview, rainfall line | Banded at 400 and 700 mm: "Semi-arid site … Water harvesting must come before food-tree establishment", "moderate rainfall. Mulch and swales …", "strong rainfall. Build soil-carbon …" | Removed. The figure is on the stat row |
| Overview, soil-carbon line | Below 1.5 %: "Reported soil carbon … yield gains are not guaranteed"; otherwise "Reasonable soil carbon … hold gains" | "Soil organic carbon: X% (from your soil test)" or "(from the SoilGrids global model, not a test of your soil)". The existing "not measured" line for an unknown source is unchanged |
| Climate, rainfall card | Bars coloured "wet" above 90 % of the monthly mean; chips "Wet · Oct–Mar", "Dry · May–Aug"; "Most rain falls Oct–Mar. Store storm-water to carry the May–Aug dry spell." | One colour; no chips; no advice. The wet and dry months were fixed per rainfall pattern in the adapter, not read from the bars, and are the wrong half of the year north of the equator |
| Overview, "Main challenges" | The biome's general list, shown as if about the site (one item: "Frost can damage plants at higher ground") | The same list, under "General points for this biome, not findings for this site." Kept rather than removed: it is biome-level text in eleven languages, and the label makes its scope true |

No number, threshold, season or translation was added.

## Cases

All in `tests/data-panel-frost-claims.test.ts`, rendering the real panel whole with the real dictionary.

| Case | Inputs | Expected and actual | Result |
| --- | --- | --- | --- |
| Q-1 | Fixtures a (Johannesburg-like), i (48.2° N), 213 mm a year, 1,282 mm on a 30° slope; English and isiZulu | No suitability word, rainfall band, carbon band, fixed wet or dry months or storm-water advice on Overview or Climate; the rainfall sentence states the figure; the biome label shows | passed |
| Q-2 | Soil from a lab test at 2.4 %, and from SoilGrids at 0.9 % | Each figure with its source and no band | passed |
| Q-3 | Panel source | None of the removed keys or names outside comments | passed |

## Verification

- Typecheck: exit 0 (`evidence-cp118/logs/01-typecheck.txt`).
- Affected tests, 73 files, full output: 900 of 900, exit 0 (`logs/02-…`).
- Real-dictionary renders: `evidence-cp118/outputs/datapanel-renders/`.
- Browser, `/farmer?site=demo-place-ubhejane&panel=Climate`, phone light and dark: no badge; the summary reads "Modelled annual rainfall: about 768 mm."; the soil line "(from the SoilGrids global model, not a test of your soil)" in one run and the existing "not measured" line in the other (the soil service answered once and not the other time); the biome label; the rainfall card in one colour with no chips. No page errors, no sideways overflow (`outputs/J.txt`, six screenshots). I opened the dark rainfall card.
- Full suite and `rules`: one run on the final head; result on PR #1334.

## Still open

- **CP-119 (new):** the Soil tab's own verdicts: a 0–10 "soil health score" from fixed pH, carbon, bulk-density and texture bands, the pH "acidic / alkaline" labels at 5.5 and 7.5, "Low — target 2–3%" for carbon below 1.5 %, and "compacted" above 1.4 g/cm³. Not in CP-118's list; not changed.
- The "Summer rainfall / Winter rainfall" chip is the adapter's classification; its thresholds live in `lib/nasa-power.ts` (shared climate fetch, separately owned).
- The paid report route (`app/api/generate-report/route.ts`) still writes "frost likely, protect tender …" from `minTemp` against 2 °C. Not this screen.
- Everything carried in the [CP-117 record](cp117-frost-caveat-claude.md).
