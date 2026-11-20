# Evidence: Atlas climate card, CP-114 and CP-115 (11 November 2026)

Record: [`../atlas-climate-card-claude.md`](../atlas-climate-card-claude.md). Source commit `05105b0b`. Everything here was captured on the working tree that became that commit; nothing was re-run afterwards.

| File | What it is | Captured (UTC) |
| --- | --- | --- |
| `class-note-check.ts` | Offline: classifies the 100 saved places and prints each class's range | script |
| `outputs/class-note-check-before.txt` | Its output with the OLD notes (the first lines are a Node warning) | before the edit |
| `outputs/class-note-check.txt` | Its output with the new notes | after the edit |
| `scripts/g.cjs` | The browser run: six cases | script |
| `outputs/G.json` | Its full output: route answer, theme, each element's text, computed colour and box | browser run |
| `outputs/G.stderr.txt` | Its error stream (empty) | browser run |
| `screenshots/G-atlas-*.png` | Six screenshots | browser run |
| `scripts/contrast-from-pixels.cjs`, `outputs/G-contrast.txt` | Contrast measured from those screenshots | after the run |
| `scripts/before-measure.cjs`, `outputs/before-eaa5b98b-dark-contrast.txt` | The same measurement on the ORIGINAL dark screenshot of `eaa5b98b` (`../evidence-decisions/F-atlas-complete-phone-dark.png`, not regenerated). Chip boxes are placed by offset, so treat the two chip rows as approximate | after the run |
| `logs/01-new-tests-against-eaa5b98b-source.tap.txt` | The two changed test files against the source at `eaa5b98b`: 4 fail, exit 1. Made by writing the two old source files back, running, and restoring them | before commit |
| `logs/02-new-tests-on-revision.tap.txt` | The same two files on the revision: 27 of 27, exit 0 | before commit |
| `logs/03-typecheck.txt` | `npx tsc --noEmit -p .`: no output, exit 0 | before commit |
| `logs/04-affected-tests.tap.txt` | 23 affected test files, full output and the file list: 287 of 287, exit 0 | before commit |
| `logs/05-dev-server-4242.log` | The development server's log for the browser run | browser run |
| `logs/06-release-note-tests.tap.txt` | Every test file that reads the release notes, full output: 355 of 355, exit 0 | after the source commit, with the restamped release note |
| `logs/07-focused-render.tap.txt` | `npm run test:render`, full output: 674 of 674, exit 0 | same |
| `logs/08-typecheck-final.txt` | `npx tsc --noEmit -p .` again: no output, exit 0 | same |

Real and synthetic, as in the earlier run: the place search is stubbed; the climate answer is the local route's live answer; the two "incomplete" cases replace its temperature fields. No real provider gap was observed. Opened by the author: complete phone dark, complete phone light, complete desktop dark.
