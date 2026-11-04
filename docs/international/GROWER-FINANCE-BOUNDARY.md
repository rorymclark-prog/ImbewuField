# Own-cycle evidence at the finance boundary

The finance source previously selected rows by current bed IDs before its
forecast consumers could see orphan own-cycle markers. The actual source and
rendered `FinanceGraphs` reproduced two misleading results: an orphan marker
produced “Your crop plan is empty”; a mixed book showed a legacy benchmark while
silently omitting the unresolved own record.

`loadFinancePlanSource()` keeps its existing public shape and selected measured
beds, area and allocations. Its forecast gate now also reads the actual canonical
raw receipt. Missing/unreadable books, unreadable row evidence and relevant own
markers leave the forecast unavailable. A withheld forecast is not a zero or an
empty plan. Counts, when available, count relevant authored row occurrences;
an unreadable book has no invented row count.

Own-marker presence, duplicate-ID holds and intact foreign proof remain owned by
the shared cycle/projector authorities. Excluding a foreign own row requires an
inspected authored current source, explicit valid other scope and disjointness
from every eligible and held current bed identity. A normalized first winner,
malformed marker, missing scope, broken identity or ambiguous ID is insufficient.
Own-cycle yield estimates are not relabelled as catalogue finance forecasts.

No crop book, geometry, observed harvest, sale, currency or measurement is changed
or saved. Measured allocations retain the existing selected-source behavior.
An intact foreign/disjoint row does not disable an otherwise supported legacy
forecast; a genuinely empty canonical book remains an empty-plan control.

The existing graph's unavailable branch already explains the hold and leaves
picked/sold records visible, so no graph component change was required.
`tests/international-grower-finance-boundary.test.ts` exercises actual raw storage,
source geometry, forecast logic and rendered graph text. Only external identity,
framework navigation/language and TSX loading are controlled. It includes real
saved-cycle fixtures, orphan/malformed records, duplicate identities, held current
polygons, invalid authored geometry, raw-read failures, measured quantities and
legacy/foreign/empty positive controls.

Verification is source/runtime rendering, not a browser visual review or country
launch approval. This boundary adds no financial forecast for own cycles and no
new advice, persistence ledger, species, translation approval or API integration.
