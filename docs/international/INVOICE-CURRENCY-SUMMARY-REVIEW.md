# Saved invoice amounts by currency

Invoice → Saved now offers an explicit summary-currency choice. The three groups
show issued, recorded paid and unpaid invoice document counts/amounts across all
loaded dates on this device. Pending link drafts, external sales and costs are
excluded. Recorded paid is the saved document status, not proof of bank receipt,
complete cash income, profit or tax compliance. No exchange conversion, date
filter, new ledger or new export is introduced.

A private read-view receipt reuses the existing protected-storage capture and
canonical invoice parser. Coherent records can be read while another tab holds
the editing lease. The public view grants no write admission and does not
initialise storage. Absent/unreadable or incomplete evidence stays unavailable;
an explicitly chosen currency with no matching documents can show legitimate
zero totals. Historical absent denomination keeps its existing Rand meaning;
present malformed denomination cannot become that historical claim through
optional-field omission.

Receipts bind the original actor/sample epoch, window/storage identity, raw bytes
and delivered projection. Observed changes withdraw the old delivery, including
synchronous changed-then-restored events during reads. Bounded event witnesses
reuse the original fingerprint and withdraw on nested reentry. An unchanged
source event or same-byte editor-lease release remains a valid read. Silent,
unobserved byte changes restored between observations are not claimed detectable.
The component binds source and currency-selection intent, withdraws stale totals
and requires explicit Refresh plus a new currency choice. Existing writer-hook
behaviour and stored schemas are preserved.

Ordered coordinator checks: pinned Node 24 typecheck exit 0, then 1,147/1,147 tests
across 91 affected files, zero failures/skips/TODO, and whitespace clean. This
includes the native 19-case totals kernel, 162 model/receipt cases across eight
suites and 17 real hook/panel integration cases. A separate read-only reviewer
replayed five source-race/positive controls after the same implementation owner
repaired observed source ABA, delivered projection mutation and nested events.
Earlier failing runs are retained privately; final counts describe the repaired
tree. The readability sweep now follows the actual /invoice route and four
farmer-facing invoice surfaces at the unchanged 12px zero-debt floor. It adds no
exception or relaxed assertion.

Actual local desktop and 390px phone review used two labelled synthetic GBP
invoices: issued 2 / GBP16, recorded paid 1 / GBP6, unpaid 1 / GBP10. EUR showed
legitimate zero counts/amounts. The phone document width was 390px and both
summary controls measured 44px high. A second actual tab displayed those totals
while the editor remained read-only. Saving a synthetic note through the first
tab withdrew the second tab's numbers and currency selection; explicit Refresh
and selection restored the expected values without acquiring editing ownership.
No real farmer/account data was used. Temporary preview/tabs/cache and owned
asset link were cleaned up after review.

The 98 native AGY language candidates remain inactive, source-bound AI drafts;
all 98 pairs passed independent structural checks and 19 damaged controls were
rejected. They have no fluent approval. Twelve separate existing-language release
descriptions have Codex provenance. English financial-language holds remain.

Stacked after draft #1256 at a412b28b7e2adc31045b500f3dc83900d58e0314. Full current-head
CI and exact hosted/account review remain release gates. Focused checks are not
full-suite success, and no production merge or release is claimed. PLAN_VERSION,
species, calibrated lessons and measured geometry are untouched. This changes
the invoice screen picture.
