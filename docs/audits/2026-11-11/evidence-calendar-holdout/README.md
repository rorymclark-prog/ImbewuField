# Evidence: held-out test of the sowing-calendar rule, 11 November 2026

Record: [`../calendar-rule-holdout-claude.md`](../calendar-rule-holdout-claude.md).

| File | What it is |
| --- | --- |
| `holdout-places.json` | The 56 places, their guide regions and the four pass criteria. Committed in `46610e05`, before any climate data for these places was requested. |
| `holdout-harness.ts` | Runs the app's own `fetchNasaPower` and `siteClimateFromLocationData` for each place, fetches the independent record, applies the criteria. |
| `summarise.py` | Turns the raw results into the tables. |
| `outputs/holdout-results.json` | Every place: the app's reading and calendar, the independent record, the criteria it failed, guide overlap. |
| `outputs/holdout-summary.txt` | The tables: every place, per criterion, dataset disagreement, close calls, shared grid readings, guide overlap, named pairs with no shared month. |
| `outputs/holdout-run.txt` | The run's console output, including every rate-limit wait. |
| `outputs/raw-response-checksums.txt` | sha256 and size of each raw response, taken before they were archived. |
| `outputs/raw-responses-2026-11-11.tar.xz` | Every raw response of the run, unchanged (1.1 MB). The 44 places of 10 November are in `../../2026-11-10/evidence-crop-plan-accuracy/outputs/raw-responses-2026-11-10.tar.xz`. |
| `verify-raw-responses.py` | Offline check of the raw daily responses: exact dates, units, missing values, and the frost figures rebuilt without the collector's code. `--audit-2026-11-10` checks the 44; `--negative-controls` shows it refusing five corrupt records. |
| `outputs/raw-verification.txt`, `outputs/raw-verification-audit-2026-11-10.txt`, `outputs/raw-verification-negative-controls.txt` | Its three outputs. |
| `criteria-controls.py`, `outputs/criteria-controls.txt` | Place-blind answers scored on the four criteria (always-winter passes all), and a post-hoc rain-timing description. |

## Sources

| Source | Used for | Notes |
| --- | --- | --- |
| NASA POWER climatology API, `https://power.larc.nasa.gov/api/temporal/climatology/point` | The app's reading: monthly mean temperature, monthly rain, record minimum | Called through the app's own `lib/nasa-power.ts`, retrieved 11 November 2026. A grid cell about 50 km wide. |
| Open-Meteo historical archive, `https://archive-api.open-meteo.com/v1/archive`, daily values 2001-01-01 to 2020-12-31, **default model selection** | The second record: frost days, lowest daily minimum | Retrieved 11 November 2026. The request sent no `models` or `cell_selection`. Per the provider's documentation the default "Best Match" combines ECMWF IFS (from 2017), ERA5 and ERA5-Land, uses a land cell of similar elevation and adjusts to the point's elevation. The responses do not name the model. First described here as "ERA5"; corrected after independent review (CBR-02). Not a station. |
| "General sowing guide (according to SANSOR)", as reproduced by Sutherland Seedlings, PDF dated 2004 | Month overlap, reported only | Secondary, seed-industry. Transcription in `research/crop-sources/_sansor-sowing-guide.json` (sha256 `9c767dac…3f52eb`). The app's Western Cape rows are taken from it. |

## The next collection must not reuse the collector as it stands

`holdout-harness.ts` is kept exactly as it ran. Before any new collection it needs three things the review found missing (CBR-02, CBR-03): the model and grid-cell policy sent explicitly in the request and recorded with the response; the request URL saved beside each response; and the admission step of `verify-raw-responses.py` applied before anything is scored, with a refused record counted as unscored, never as a pass. A new collection is a new run with a new name. It does not replace these results.

## To run it again

```
OUT=<an empty directory> node --import ./tests/register-alias.mjs docs/audits/2026-11-11/evidence-calendar-holdout/holdout-harness.ts
cp <OUT>/holdout-results.json docs/audits/2026-11-11/evidence-calendar-holdout/outputs/
python3 docs/audits/2026-11-11/evidence-calendar-holdout/summarise.py
```

The archive limits requests a minute, so a full run takes about fifteen minutes. Both services serve live data: a later run can differ slightly from the recorded one. To check the recorded run without any network: `python3 verify-raw-responses.py`.
