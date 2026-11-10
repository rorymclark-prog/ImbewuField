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
| `outputs/guide-agreement-before-after.txt` | What the second script printed: per place and region, then every crop-and-place pair that shares no month with the guide, before (72) and after (13), by name, then the 39 changed rows |
| `01`–`04` PNG | The running page after the fixes: the calendar name and reasons on desktop and on a phone in light and dark, and the weekly-target warning |
| `05`–`08` PNG | The later update: choosing a calendar in the pop-up, the out-of-season list on a phone in light and dark, and the "chosen by you" header on desktop |
| `missing-marker-effect.ts`, `outputs/missing-marker-effect.txt` | Update 2: what a NASA POWER missing-value marker did to the calendar at the 44 places before the record-minimum helper cleaned it |
| `sample-farm-cold-cache-check.cjs`, `outputs/sample-farm-cold-cache-check.txt`, `09`–`11` PNG | Update 2: the sample farm in a browser with the climate endpoint aborted: the labelled fallback calendar and no out-of-season list, on a phone in light and dark and on desktop |
| `make-local-farm-seeds.ts`, `saved-plan-path-check.cjs`, `outputs/saved-plan-path-check.txt`, `12` PNG | Update 2: a real local farm (signed out, not sample mode) through a fresh plan, an old saved plan, reloads, hide, a different calendar, clearing and two PDF downloads |
| `outputs/pdf-calendar-lines.txt` | Update 2: the calendar line read back from the two downloaded plan PDFs |
| `sample-farm-fixed-calendar-check.cjs`, `outputs/sample-farm-fixed-calendar-check.txt`, `13`–`15` PNG | Update 3: the sample farm's fixed calendar in a browser, with the climate route aborted and answering: the box on a phone in light and dark, and the header on desktop |
| `outputs/hosted-saved-plan-path-check.txt` | Update 2: the saved-plan path and two plan PDFs on the PR's hosted preview at `73734a4`, signed out, in guest storage |
| `outputs/stale-hide-handler-before-fix.txt` | Update 2: the hide handler as published at `73734a40`, run after a change of account: it wrote account A's site under account B's key (CP-101) |
| `outputs/hosted-preview-fresh-sample-check.txt` | Update 2: the sample farm on the PR's hosted preview at `292bd10` for a fresh signed-out visitor, and the climate route's answer on the preview (401) and on production (200) |

## Reproduce

Node 22.18 or newer and Python 3, from the repository root.

```bash
E=docs/audits/2026-11-10/evidence-crop-plan-accuracy-fixes
node --import ./tests/register-alias.mjs $E/calendar-choice-matrix.ts /tmp/calendar-choices.json
node --import ./tests/register-alias.mjs docs/audits/2026-11-10/evidence-crop-plan-accuracy/dump-catalog.ts /tmp/catalog-after.json
python3 $E/guide-agreement.py /tmp/catalog-after.json /tmp/calendar-choices.json
```

The "after" columns are computed by the code the scripts are run on, so on a later revision they show that revision. The committed outputs were made on the commit that adds this folder. They were regenerated on `9a980a5c` (Update 2): the matrix and the catalogue dump were byte-identical, and the agreement output gained only the two lists of named pairs.

The Update 2 browser checks need a running app and Playwright, so they are not network-free:

```bash
node dev-server.mjs --port 4242 &
node --import ./tests/register-alias.mjs $E/missing-marker-effect.ts
OUT=/tmp/shots node $E/sample-farm-cold-cache-check.cjs
node --import ./tests/register-alias.mjs $E/make-local-farm-seeds.ts /tmp/seeds.json
SEEDS=/tmp/seeds.json OUT=/tmp/shots DL=/tmp/pdfs node $E/saved-plan-path-check.cjs
pdftotext -layout /tmp/pdfs/real-farm-chosen-calendar.pdf - | grep 'satellite climate records'
```

Set `PLAYWRIGHT` to the module's path if it is not on the default resolution path. The real-farm script writes the sample farm's design and saved place into that browser profile's own storage and clicks through the first-run consent and goal prompts. It signs in to nothing and sends no farm data anywhere. Its climate reading is a live call to the app's own endpoint, so the calendar it reports depends on that answer.

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
- **Frost figures are grid estimates, not site frost observations.** Both records smooth valleys and can miss frost in a cold hollow. Nothing here shows the size or the direction of the difference at any one farm.
- **The screenshots are of the public sample farm** on a local development server, not the deployed site. Screen `12` is the real local farm built from the sample farm's design.
- **Sample mode keeps its data in memory.** Every edit, a calendar choice included, is forgotten on reload. That is how the sample works for all data, so the saved-plan path was checked on a real local farm instead.
- **A pair that shares no month with the guide is a disagreement with one secondary source,** under the auditor's assignment of places to regions. It is not a finding that the app's months are wrong, and no month was moved to raise the overlap.
