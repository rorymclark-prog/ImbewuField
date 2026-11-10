# Evidence for the crop plan accuracy audit of 10 November 2026

This folder backs [`../crop-plan-accuracy-claude.md`](../crop-plan-accuracy-claude.md). Nothing here uses a private farm or an account. The scripts call the app's own library functions and two public climate services.

## What is here

| Item | What it is |
| --- | --- |
| `location-harness.ts` | For 62 locations: the app's own climate fetch and calendar choice, 20 years of independent daily weather, and every crop and sowing month checked against frost and heat |
| `dump-catalog.ts` | Writes the crop catalogue's planning fields to JSON |
| `compare-kzn-table6.py` | Catalogue sowing months against the KZN "Plant Establishment" Table 6 rows as transcribed in this repository |
| `compare-sansor.py` | The calendar the app assigns to each South African test site against the SANSOR regional sowing guide |
| `harvest-timing-bias.py` | The app's first-harvest month against the published duration range |
| `frost-by-app-rule.py` | Frost exposure using the app's own rule for when a crop is exposed |
| `lowest-minimum.py` | The lowest daily minimum in 20 years for the sites whose frost status matters most |
| `outputs/kzn-table6-rows.md` | Where each KZN row in the comparison comes from: the transcribed text, the repo file that holds it and the page recorded |
| `outputs/` | What those scripts printed, plus `catalog.json`, `locations-climate.json` (monthly climate, frost statistics, missing days and both classifications per location) and `crop-month-matrix.csv` (every crop and sowing month for the 44 South African sites: 7,462 rows) |

## Which code and data were run

- **Code.** The harness imports the app's own modules and ran on this branch on 10 November 2026 between about 04:45 and 05:05 UTC. Every module that decides a calendar, a date or a quantity was identical to released `8a4d1fd` then, and is identical to released `29e5516` now:

  ```bash
  for c in 8a4d1fd 29e5516; do git diff --quiet $c HEAD -- lib/crop-catalog.ts lib/koppen-global.ts lib/site-climate.ts lib/nasa-power.ts lib/climate-temperature.ts lib/crop-climate-gate.ts lib/crop-plan.ts lib/harvest-targets.ts lib/crop-autosuggest.ts && echo "$c identical"; done
  ```

- **App climate input.** `fetchNasaPower(lat, lon)` from `lib/nasa-power.ts`, unchanged: NASA POWER monthly climatology of 2 m air temperature and precipitation for the point, with the app's own rule that swaps in Open-Meteo 1991–2020 rainfall when the two differ by more than 30% (10 of 62 sites; marked `rainfallSource: open-meteo`).
- **Independent input.** `https://archive-api.open-meteo.com/v1/archive` with `daily=temperature_2m_min,temperature_2m_max,temperature_2m_mean,precipitation_sum`, `start_date=2001-01-01`, `end_date=2020-12-31`, `timezone=auto`, one request per site. `outputs/locations-climate.json` records the grid cell's coordinates and elevation, the number of days returned and the number missing for each site.
- **Classification.** `siteClimateFromLocationData` for the app's answer; `classifyKoppen` and `rainPatternFor` again on the ERA5 monthly means for the cross-check. Thresholds are the app's own constants.
- **Timing.** `harvestMonthForCrop` and `bedEntryMonth` from `lib/crop-plan.ts`.

## Four kinds of evidence, kept apart

| Kind | What it is here | How far to trust it |
| --- | --- | --- |
| Code fact | The catalogue's months, the calendar the app assigns, the harvest month it computes | Exact and reproducible: it is what the app does |
| Modelled or gridded estimate | NASA POWER and ERA5 temperatures, rain and frost-day counts for a grid cell | Good for comparing regions. Not a station reading and not a farm's microclimate: a hollow can frost when its cell does not |
| Published advice | The SANSOR regional guide, Starke Ayres guidelines, the Cowpeas Infopak; the KZN table rows as transcribed earlier | General guidance for a region, not validated for any one farm. The KZN rows are second-hand until the document is re-read |
| Not available to this audit | Weather-station observations, on-farm frost dates, an agronomist's or extension officer's local advice, a grower's own records | Outranks everything above where it exists |

Nothing in this folder is validated local advice. A finding that says the app disagrees with a regional guide means exactly that.

## Nursery time and field time

A tray-raised crop has two periods, and they are kept apart throughout:

- **Nursery:** sowing to transplanting. The app plans 2 months and reserves the bed from 1 month after sowing. The sources say 4–6 weeks in warm conditions.
- **Field:** transplanting to first harvest. The app treats a tray crop's catalogue duration as counted from transplanting (`lib/crop-plan.ts:1190`) and a direct-sown crop's as counted from sowing. Whether each source figure is from sowing or from transplanting was not re-checked crop by crop.

`outputs/harvest-timing-bias.txt` shows the two parts in separate columns. In `outputs/crop-month-matrix.csv`, `months_sow_to_first_harvest` includes the nursery months of a tray crop and `months_earliest_bed_entry_to_first_harvest` does not; frost is only meaningful for the second.

## Reproduce

Node 22.18 or newer and Python 3, from the repository root. The harness needs network access to `power.larc.nasa.gov` and `archive-api.open-meteo.com`; a cold run takes about 25 minutes because the weather service rate-limits.

```bash
E=docs/audits/2026-11-10/evidence-crop-plan-accuracy
export OUT=/tmp/crop-accuracy                       # cache and full outputs go here, not in the repo
node --import ./tests/register-alias.mjs $E/location-harness.ts          # writes $OUT/locations.json and summary.md
node --import ./tests/register-alias.mjs $E/dump-catalog.ts $OUT/catalog.json
python3 $E/compare-kzn-table6.py   $OUT/catalog.json
python3 $E/compare-sansor.py       $OUT/catalog.json $OUT/locations.json Komatipoort Durban "Cape Town" Johannesburg Gqeberha Pretoria
python3 $E/harvest-timing-bias.py  $OUT/catalog.json
python3 $E/frost-by-app-rule.py    $OUT/locations.json
python3 $E/lowest-minimum.py       $OUT
```

`outputs/location-summary.md` is the harness's own summary. Its section (b) counts a transplanted crop's tray month as a field month, which overstates frost; `frost-by-app-rule.py` applies the app's own rule (exposure starts the month after sowing) and is the one the record quotes. The full per-crop `locations.json` is 12 MB and is not committed; `outputs/locations-climate.json` keeps the per-location climate, frost statistics and both classifications.

## Sources

- NASA POWER monthly climatology, through the app's `fetchNasaPower`: what the app itself uses.
- ERA5 reanalysis daily minimum, maximum, mean temperature and rain for 2001–2020, through the Open-Meteo archive API: the independent record.
- "General sowing guide (according to SANSOR)", reproduced by Sutherland Seedlings, PDF dated 2004: <https://www.sutherlandseedlings.co.za/wp-content/uploads/2015/12/Vegetable-Sowguide-Sutherland-Seedlings.pdf>. Read by me from the page image and typed into `compare-sansor.py`. Secondary, seed-industry.
- Starke Ayres production guidelines (2019) for tomato, cabbage, carrot and beetroot, for example <https://www.starkeayres.com/uploads/files/Tomato-Production-Guideline-2019.pdf>. Seed-company guidance.
- Cowpeas Infopak (National Department of Agriculture and ARC, 1997): <https://www.arc.agric.za/arc-gci/Documents/CultivatingCowpeas.pdf>. Primary.
- KZN Department of Agriculture "Plant Establishment", Table 6: **not reachable** on 10 November 2026 (404, 503, "website under maintenance"). The rows in `compare-kzn-table6.py` are the transcriptions already in `research/crop-sources/_frost-free-months.json`, the per-crop dossiers and comments in `lib/crop-catalog.ts`.

The downloaded PDFs are not committed.

## Limits

- **Frost figures are grid estimates, not site frost observations.** ERA5 is a grid of roughly 9–25 km cells, not a weather station. It smooths mountains and can miss cold air pooling in valleys, so a farm in a hollow may frost when its cell does not. No validation here establishes a one-sided bound at any farm. (Reworded 10 November 2026 after independent review; this line used to say "Frost is a lower bound". The counts are unchanged.) Frost here means a daily minimum air temperature at or below 0 °C; `lowest-minimum.txt` shows how close each key site came. No station record was used.
- **Thresholds, as coded.** The app's calendar choice uses the coldest-month mean (7, 11 and 13 °C) and the share of rain from October to March (65% and 35%), from `lib/koppen-global.ts`. A site near a line can fall either side with either dataset; that two gridded records disagree does not say which calendar is right.
- **Two climate records, different periods.** NASA POWER is a long-term climatology; the ERA5 figures are 2001–2020. At 10 of 62 sites the app itself replaces NASA rainfall with Open-Meteo rainfall, which is not independent of ERA5. Temperatures always are.
- **The regional guide is a yardstick, not an authority.** It is secondary and from 2004. Which of its eight regions a site belongs to is the auditor's assignment in `compare-sansor.py`. Hillcrest and Port St Johns were left out as ambiguous. Lephalale and Polokwane (Middleveld), Springbok and Graaff-Reinet (Northern Cape and Great Karoo), and East London and Gqeberha (Eastern Cape and Little Karoo, the nearest column to a coast it does not cover) are judgement calls.
- **Agreement percentages count months.** They show which regions fit and which do not. They are not a pass mark, and a crop the guide does not list for a region is counted as offered-but-unlisted.
- **The KZN rows are second-hand.** A slash in a cell ("Feb - Jun/Jul") is read both ways: the script reports months outside the widest reading and months missing from the narrowest.
- **Harvest timing** assumes sowing can fall on any day of the month and a nursery period of four to six weeks, the range the app's own comments cite.
- **Not done:** no farm visited, no agronomist consulted, no primary table re-read, yields not re-verified, fruit trees and animals not covered.
