# Evidence for the crop plan accuracy fixes of 10 November 2026

This folder backs [`../crop-plan-accuracy-fixes-claude.md`](../crop-plan-accuracy-fixes-claude.md). Everything here can be re-run from files in this repository; nothing needs the network, a private farm or an account.

## What is here

| Item | What it is |
| --- | --- |
| `calendar-choice-matrix.ts` | The sowing calendar each of the 44 audited South African places gets, before and after, from the app's own reading and from the independent record |
| `guide-agreement.py` | Agreement with the seed industry's regional sowing guide before and after, per place and per region, and every sowing-month row that changed |
| `outputs/calendar-choice-matrix.txt` | What the first script printed |
| `outputs/calendar-choices.json` | The same, as data, for the second script |
| `outputs/catalog-after.json` | The crop catalogue's planning fields after the fixes (the "before" is `../evidence-crop-plan-accuracy/outputs/catalog.json`) |
| `outputs/guide-agreement-before-after.txt` | What the second script printed, ending with the 39 changed rows |
| `01`–`04` PNG | The running page after the fixes: the calendar name and reasons on desktop and on a phone in light and dark, and the weekly-target warning |

## Reproduce

Node 22.18 or newer and Python 3, from the repository root.

```bash
E=docs/audits/2026-11-10/evidence-crop-plan-accuracy-fixes
node --import ./tests/register-alias.mjs $E/calendar-choice-matrix.ts /tmp/calendar-choices.json
node --import ./tests/register-alias.mjs docs/audits/2026-11-10/evidence-crop-plan-accuracy/dump-catalog.ts /tmp/catalog-after.json
python3 $E/guide-agreement.py /tmp/catalog-after.json /tmp/calendar-choices.json
```

The "after" columns are computed by the code the scripts are run on, so on a later revision they show that revision. The committed outputs were made on the commit that adds this folder.

## Inputs, and what kind of evidence each is

| Input | Kind | Held in |
| --- | --- | --- |
| The app's reading for each place: monthly mean temperature, monthly rain and record minimum, as `fetchNasaPower` returned them on 10 November 2026 | Gridded estimate (NASA POWER) | `tests/fixtures/sa-climate-sites-2026-11-10.json` |
| The independent frost record: ERA5 daily minimum temperature 2001–2020, frost days a year and lowest daily minimum | Gridded estimate (ERA5) | the same fixture, and `../evidence-crop-plan-accuracy/outputs/locations-climate.json` for monthly means |
| The calendar each place had before | Code fact | `../evidence-crop-plan-accuracy/outputs/locations-climate.json` |
| KZN Department of Agriculture "Plant Establishment" Table 6 rows | Published advice, **second-hand**: transcriptions already in this repository. The document could not be re-read | `research/crop-sources/_kzn-table6-rows.json` |
| "General sowing guide (according to SANSOR)", eight regions | Published advice, **secondary**: a seed-industry table reproduced by a nursery, 2004 | `research/crop-sources/_sansor-sowing-guide.json` |
| FAO ECOCROP optimum temperatures used for two thresholds | Published model data: `Phaseolus vulgaris` TOPMN 16 °C; cabbage, broccoli, carrot and pea TOPMX 24 °C | read from <https://raw.githubusercontent.com/OpenCLIM/ecocrop/master/EcoCrop_DB.csv>, the table `lib/crop-climate-gate.ts` already cites |
| What NASA POWER's minimum-temperature field means | Provider definition: "The minimum hourly air (dry bulb) temperature at 2 meters above the surface of the earth in the period of interest" | <https://power.larc.nasa.gov/api/system/manager/parameters?parameters=T2M_MIN&community=ag&temporal=climatology> |

No weather-station record, on-farm frost date or agronomist's advice was available. Where one exists it outranks all of this.

## Limits

- **The Western Cape agreement figure is not independent.** Those rows are now taken from the guide they are compared with. The script prints a total without the Western Cape for that reason.
- **Agreement percentages count months.** They show which regions fit and which do not. They are not a pass mark.
- **Which guide region a place belongs to is the auditor's assignment**, unchanged from the audit. Hillcrest and Port St Johns are not scored.
- **Frost is a lower bound.** Both records smooth valleys. A hollow frosts when its grid cell does not.
- **The screenshots are of the public sample farm** on a local development server, not the deployed site.
