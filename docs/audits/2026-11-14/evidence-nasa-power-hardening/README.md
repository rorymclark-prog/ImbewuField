# Evidence: shared climate fetch hardening, 14 November 2026

Record: [`../nasa-power-hardening-claude.md`](../nasa-power-hardening-claude.md). Base `f5243f94` (PR #1334 head); code commit `4ba53e40`.

No weather data was collected. Measurements read the raw responses already archived under
`docs/audits/2026-11-10/evidence-crop-plan-accuracy/outputs/raw-responses-2026-11-10.tar.xz` and
`docs/audits/2026-11-11/evidence-calendar-holdout/outputs/raw-responses-2026-11-11.tar.xz`, extracted to a
scratch folder, and the two `tests/fixtures/sa-climate-*.json` fixtures.

| File | What it is |
| --- | --- |
| `scripts/measure.py` | Stated units in all 118 archived Open-Meteo responses; hemisphere of the 100 recorded places and their rainfall word under the old and new rule; the February 28.25-day effect at the 87 places on NASA POWER rainfall. Run: `python3 -I measure.py <raw10> <raw11> <sites fixture> <holdout fixture>` |
| `scripts/coverage.py` | Temperature coverage status in the 118 archived `fetchNasaPower` outputs. Run: `python3 -I coverage.py <raw10> <raw11>` |
| `outputs/measure.txt` | Output of both scripts |
| `scripts/export-location.ts`, `scripts/report-source.cjs` | Writes the sample site's location with `rainfallSource: 'open-meteo'` (a constructed fixture, not grower data); seeds it as one saved report and opens it at `/reports` on the local dev server |
| `outputs/report-source.txt`, `screenshots/report-rain-source-*.png` | The report's rainfall source line at 390 px light and dark and 1280 px light; overflow and page errors |
| `logs/01-new-tests-on-f5243f94-source.tap.txt` | `tests/nasa-power.test.ts` with the new tests, run against `f5243f94`'s `lib/nasa-power.ts`: 20 pass, 2 fail (the unit and the season-word tests) |
| `logs/02-…after.tap.txt` | `nasa-power` and `site-climate` after the fix: 28 of 28 |
| `logs/03-affected-tests.tap.txt`, `logs/03-affected-test-files.txt` | 100 affected test files: 1,355 of 1,355 |
| `logs/04-typecheck.txt` | `npx tsc --noEmit`, exit 0 |
| `logs/05-release-note-tests.tap.txt` | 19 release-note and update test files: 388 of 388 |
| `logs/06-dev-server-4242.log` | The dev server's log for the browser run (the "Failed to find font override values" lines are the sandbox's offline font fetch) |
