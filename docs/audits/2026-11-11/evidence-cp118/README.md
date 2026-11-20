# Evidence: CP-118 (11 November 2026)

Record: [`../cp118-site-data-claims-claude.md`](../cp118-site-data-claims-claude.md).

| File | What it is |
| --- | --- |
| `logs/01-typecheck.txt` | `npx tsc --noEmit -p .`: exit 0 |
| `logs/02-affected-tests.tap.txt` | 73 test files touching the panel, full output: 900 of 900, exit 0 |
| `logs/03-dev-server-4242.log` | Development server log for the browser run |
| `logs/04-…`, `05-…` | Release-note tests and focused render group after the restamp |
| `outputs/datapanel-renders/` | The real panel rendered whole with the real dictionary, per fixture (written by the test) |
| `scripts/j.cjs`, `outputs/J.txt`, `screenshots/J-*.png` | Browser run, phone light and dark: Overview top, Overview insights, Climate rainfall card |

The saved place is the published sample farm saved as a local farm (a constructed fixture). The climate and soil answers are the local routes' live answers. The test fixtures are constructed.
