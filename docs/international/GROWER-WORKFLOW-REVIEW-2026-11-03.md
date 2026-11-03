# Grower automatic-plan and nursery review milestone

The production-planner page now connects canonical buyer targets and grower
estimates to checked saved bed/field measurements, the automatic cycle planner
and dated nursery requirements. Unsupported countries can keep their own target
records without receiving South African catalogue recommendations.

Controls start blank. Availability, propagation inputs, loss estimates and other
nursery commitments require explicit supplied assumptions. Unknown seed quantities
or incomplete capacity stay unknown. Proposed crop cycles are not appended to the
saved plan, counted as planted crops or treated as fulfilled buyer deliveries.

Canonical nursery settings preserve ambiguous raw inputs as held evidence through
save/reload and unrelated edits; those rows supply no capacity and stay out of the
review CSV. Three account-transition writer gaps were reproduced and repaired:
growing-estimate saves, workspace reference changes and queued ordinary autosaves
now share the actual Firebase/mounted-actor check.

Validation before publication: Node 24 typecheck clean; 676 tests across 41
affected files pass; tracked and new-file whitespace clean. Tests exercise actual
source readers, assembler/engine, canonical storage receipts, malformed/ambiguous
records, exact decimal capacity, competing occupations, late asynchronous work,
account changes and failed saves. Synthetic quantities are engineering fixtures,
not agronomic recommendations.

Browser evidence covers the real empty review form on desktop and a 390px phone
viewport with equal content/viewport widths. A completed proposal/nursery view,
hosted current-head preview and real account save/reload remain release gates.
Cloud sources are fetched snapshots, not live subscriptions or server CAS. Older
cached clients' preservation of additive nursery metadata needs release review.
The existing catalogue nursery export is separate from the newly checked own-input
CSV and does not inherit its current-source recheck.

This changes the planner picture. It does not change PLAN_VERSION or measured
saved geometry. Full current-head tests and security checks must pass before merge;
no production release or new-region farming approval is claimed here.
