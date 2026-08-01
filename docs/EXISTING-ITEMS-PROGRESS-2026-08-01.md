# Existing-item status progress — 2026-08-01

- Baseline: clean working tree on `main`; `npm test 2>&1 | grep "pass"` reported 1,510 passing tests.
- Audit verified: the item editor has no status field; the exact Base map and Site Hybrid finisher use `groundLabelsForSheet` extra rows but draw no placed items; `status === 'existing'` is not read anywhere.
- Implementation milestone: added the status editor control and explicit proposed defaults; added shared existing-item selection, discrete footprint drawing, and extra-row labels to exact Base and Site Hybrid paths; added category-coverage regression test.
- Verification: `npx tsc --noEmit` passed; full `npm test` passed with 1,511/1,511; `git diff --check` passed. Port 4343 refused the connection, so browser/rendered-image verification was unavailable; no paid AI render was triggered.
