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
| `outputs/` | What those scripts printed, plus `catalog.json`, `locations-climate.json` (monthly climate, frost statistics, missing days and both classifications per location) and `crop-month-matrix.csv` (every crop and sowing month for the 44 South African sites: 7,462 rows) |

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

- **Frost is a lower bound.** ERA5 is a grid of roughly 9–25 km cells, not a weather station. It smooths mountains and misses cold air pooling in valleys. Frost here means a daily minimum air temperature at or below 0 °C; `lowest-minimum.txt` shows how close each key site came. No station record was used.
- **Thresholds, as coded.** The app's calendar choice uses the coldest-month mean (7, 11 and 13 °C) and the share of rain from October to March (65% and 35%), from `lib/koppen-global.ts`. A site near a line can fall either side with either dataset; that two gridded records disagree does not say which calendar is right.
- **Two climate records, different periods.** NASA POWER is a long-term climatology; the ERA5 figures are 2001–2020. At 10 of 62 sites the app itself replaces NASA rainfall with Open-Meteo rainfall, which is not independent of ERA5. Temperatures always are.
- **The regional guide is a yardstick, not an authority.** It is secondary and from 2004. Which of its eight regions a site belongs to is the auditor's assignment in `compare-sansor.py`. Hillcrest and Port St Johns were left out as ambiguous. Lephalale and Polokwane (Middleveld), Springbok and Graaff-Reinet (Northern Cape and Great Karoo), and East London and Gqeberha (Eastern Cape and Little Karoo, the nearest column to a coast it does not cover) are judgement calls.
- **Agreement percentages count months.** They show which regions fit and which do not. They are not a pass mark, and a crop the guide does not list for a region is counted as offered-but-unlisted.
- **The KZN rows are second-hand.** A slash in a cell ("Feb - Jun/Jul") is read both ways: the script reports months outside the widest reading and months missing from the narrowest.
- **Harvest timing** assumes sowing can fall on any day of the month and a nursery period of four to six weeks, the range the app's own comments cite.
- **Not done:** no farm visited, no agronomist consulted, no primary table re-read, yields not re-verified, fruit trees and animals not covered.
