# Evidence: CP-117 and the plan table's frost caveat (11 November 2026)

Record: [`../cp117-frost-caveat-claude.md`](../cp117-frost-caveat-claude.md). Source commit `25612c28`. Captured on the working tree that became that commit, except the release-note logs, which follow it.

| File | What it is |
| --- | --- |
| `outputs/datapanel-renders/` | Text of the REAL site data panel rendered whole, with the real English dictionary (and isiZulu for fixture k), for fixtures a to n, written by `tests/data-panel-frost-claims.test.ts` |
| `outputs/I3.txt`, `screenshots/I3-*.png` | The panel in a real browser, `/farmer?site=demo-place-ubhejane&panel=Climate`, phone light and dark: Climate (class card, sun and wind cards) and Overview |
| `outputs/I.txt` | Part A: the Atlas errors with messages and stacks. Part B: a first attempt to open the panel that did not reach it. Part C: the plan page's guide with frost not recorded, the browser reference PDF, and a failed attempt to reach the survey's frost question |
| `outputs/I2.txt` | Follow-up: a load with no pointer movement raises no Atlas error; the survey's frost options were still not reachable by script |
| `scripts/frost-table-pdf.ts`, `outputs/frost-table-cases.txt`, `artifacts/builder-frost-*.pdf` (+ text), `screenshots/builder-frost-*-table-*.png` | The app's own PDF builder, offline, for "not recorded", "no", and April/July/December recorded |
| `artifacts/reference-frost-not-recorded.pdf` | The reference PDF exported in the browser with frost not recorded |
| `logs/01-…` to `03-…` | The helper agent's own runs (two expected count-check failures, and type errors in my files while I was mid-edit) |
| `logs/04-typecheck.txt` | `npx tsc --noEmit -p .`: exit 0 |
| `logs/05-affected-tests.tap.txt` | 100 affected test files: 1,378 of 1,378, exit 0 |
| `logs/06-…`, `logs/08-…` | Development server logs |
| `logs/07-frost-table-pdf.txt` | The builder run's console output, with exit code |
| `logs/09a-…`, `10a-…` | First runs after the restamp: one failure each, a release-note line one character over the 90-character limit |
| `logs/09b-…`, `10b-…`, `11-…` | After shortening it: release-note tests 355 of 355 and focused render 674 of 674, exit 0; typecheck exit 0 |

Real and synthetic: the saved place and the 27 sowings are the constructed local fixture (the published sample farm saved as a local farm); the climate answer in the browser is the local route's live answer; the survey answers in the builder run and every DataPanel test fixture are constructed. No grower record is involved.
