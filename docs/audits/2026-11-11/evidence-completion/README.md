# Evidence: completion corrections (11 November 2026)

Record: [`../completion-corrections-claude.md`](../completion-corrections-claude.md). Source commit `7ee356e0`. Everything here was captured on the working tree that became that commit, except logs 06 to 08, which were made after it with the restamped release note.

| File | What it is |
| --- | --- |
| `outputs/datapanel-renders/datapanel-{a..i}-{overview,climate}.txt` | Text of the REAL `DataPanel` rendered whole for each of nine fixtures, written by the test itself (`DATAPANEL_RENDER_DUMP`). Interface keys appear as their key names because the test supplies no dictionary |
| `outputs/H-plan.txt`, `outputs/H-sample.txt` | Console output of `scripts/h-plan.cjs`: the plan page's frost notice, the calendar reason with its temperatures, and the files saved |
| `artifacts/*.pdf` and `*.pdf.txt` | The exported plan, future-harvest and reference PDFs for the local fixture farm and the plan PDF for the sample farm, with `pdftotext -layout` text |
| `screenshots/H-local-…`, `H-sample-…` | The frost notice on the plan page, desktop and phone |
| `screenshots/PDF-*.png` | Page images (`pdftoppm -r 70`): reference cover, bed-by-bed table, the guide page, future harvest, sample cover |
| `outputs/H-atlas.json`, `screenshots/H-atlas-*.png`, `outputs/H-atlas-contrast.txt` | The Atlas panel at 390 px in earth and slate, light and dark, at the soil card and the crop list, with contrast measured from the pixels by `../evidence-atlas-climate-card/scripts/contrast-from-pixels.cjs` |
| `outputs/soil-snapshot-text-check.txt` | The four soil caution snapshots' visible text, identical before and after the colour-only update |
| `logs/01-…`, `logs/02-…` | The two helper agents' own test runs (DataPanel: before I removed the calendar strip's frost class) |
| `logs/03-typecheck.txt` | `npx tsc --noEmit -p .`: no output, exit 0 |
| `logs/04a-…` | First run of the 98 affected test files: 5 failures, exit 1 |
| `logs/04b-…` | Final run: 1,338 of 1,338, exit 0 |
| `logs/05-dev-server-4242.log` | The development server's log for the browser runs |
| `logs/06-…`, `07-…`, `08-…` | Release-note tests, focused render group and a final typecheck, with exit codes |

Real and synthetic: the plan runs use the constructed local fixture and the sample farm, with the app's own live climate answer. The Atlas runs use the local route's live answer, unaltered; the place search is stubbed. The DataPanel fixtures are constructed. No real provider gap and no grower record is involved.
